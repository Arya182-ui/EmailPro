import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';
import { EncryptionUtils } from '../utils/encryption';
import { config } from '../config';

const prisma = new PrismaClient();

export interface EmailData {
  to: string;
  subject: string;
  htmlBody: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  customData?: Record<string, any>;
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromName: string;
  fromEmail: string;
}

interface PooledTransporter {
  transporter: nodemailer.Transporter;
  inUse: boolean;
  lastUsed: number;
  smtpAccountId: string;
}

class SMTPConnectionPool {
  private pools = new Map<string, PooledTransporter[]>();
  private maxPoolSize = config.smtpPool.maxPoolSize;
  private idleTimeout = config.smtpPool.idleTimeout;
  private cleanupInterval: NodeJS.Timeout;
  
  // Performance metrics
  private metrics = {
    totalConnections: 0,
    activeConnections: 0,
    poolHits: 0,
    poolMisses: 0,
    connectionsCreated: 0,
    connectionsDestroyed: 0,
  };

  constructor() {
    // Cleanup idle connections every 2 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleConnections();
    }, 2 * 60 * 1000);
  }

  async getTransporter(smtpAccountId: string, smtpConfig: SmtpConfig): Promise<nodemailer.Transporter> {
    const poolKey = smtpAccountId;
    let pool = this.pools.get(poolKey) || [];

    // Find an available transporter
    const available = pool.find(p => !p.inUse);
    if (available) {
      available.inUse = true;
      available.lastUsed = Date.now();
      this.metrics.poolHits++;
      this.metrics.activeConnections++;
      return available.transporter;
    }

    this.metrics.poolMisses++;

    // Create new transporter if pool not full
    if (pool.length < this.maxPoolSize) {
      const transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        auth: {
          user: smtpConfig.username,
          pass: smtpConfig.password,
        },
        pool: true, // Enable connection pooling in nodemailer
        maxConnections: config.smtpPool.maxConnections,
        maxMessages: config.smtpPool.maxMessages,
        rateDelta: 1000,
        rateLimit: config.smtpPool.rateLimit,
        // Add timeout settings
        connectionTimeout: 60000, // 60 seconds
        greetingTimeout: 30000,   // 30 seconds
        socketTimeout: 75000,     // 75 seconds
      });

      const pooledTransporter: PooledTransporter = {
        transporter,
        inUse: true,
        lastUsed: Date.now(),
        smtpAccountId,
      };

      pool.push(pooledTransporter);
      this.pools.set(poolKey, pool);
      
      this.metrics.connectionsCreated++;
      this.metrics.totalConnections++;
      this.metrics.activeConnections++;

      return transporter;
    }

    // Wait for an available connection (fallback)
    return new Promise((resolve) => {
      const checkAvailability = () => {
        const available = pool.find(p => !p.inUse);
        if (available) {
          available.inUse = true;
          available.lastUsed = Date.now();
          this.metrics.poolHits++;
          this.metrics.activeConnections++;
          resolve(available.transporter);
        } else {
          setTimeout(checkAvailability, 100);
        }
      };
      checkAvailability();
    });
  }

  releaseTransporter(smtpAccountId: string, transporter: nodemailer.Transporter): void {
    const pool = this.pools.get(smtpAccountId);
    if (pool) {
      const pooledTransporter = pool.find(p => p.transporter === transporter);
      if (pooledTransporter) {
        pooledTransporter.inUse = false;
        pooledTransporter.lastUsed = Date.now();
        this.metrics.activeConnections--;
      }
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      poolSize: Array.from(this.pools.values()).reduce((total, pool) => total + pool.length, 0),
      hitRate: this.metrics.poolHits / (this.metrics.poolHits + this.metrics.poolMisses) || 0,
    };
  }

  private cleanupIdleConnections(): void {
    const now = Date.now();
    
    for (const [poolKey, pool] of this.pools.entries()) {
      const activePool = pool.filter(p => {
        if (!p.inUse && (now - p.lastUsed) > this.idleTimeout) {
          // Close idle connection
          p.transporter.close();
          this.metrics.connectionsDestroyed++;
          this.metrics.totalConnections--;
          return false;
        }
        return true;
      });
      
      if (activePool.length === 0) {
        this.pools.delete(poolKey);
      } else {
        this.pools.set(poolKey, activePool);
      }
    }

    // Log metrics every cleanup cycle
    console.log('SMTP Pool Metrics:', this.getMetrics());
  }

  async closeAll(): Promise<void> {
    clearInterval(this.cleanupInterval);
    
    for (const pool of this.pools.values()) {
      for (const pooledTransporter of pool) {
        pooledTransporter.transporter.close();
      }
    }
    
    this.pools.clear();
  }
}

// Global connection pool instance
const smtpConnectionPool = new SMTPConnectionPool();

export class EmailService {
  private static templateCache = new Map<string, any>();
  private static smtpCache = new Map<string, any>();

  static async sendEmail(emailLogId: string): Promise<{ success: boolean; error?: string; messageId?: string }> {
    try {
      // Get email log with all related data
      const emailLog = await prisma.emailLog.findUnique({
        where: { id: emailLogId },
        include: {
          recipient: true,
          campaign: {
            include: {
              template: true,
            },
          },
        },
      });

      if (!emailLog || !emailLog.campaign || !emailLog.recipient) {
        throw new Error('Email log or related data not found');
      }

      // Check if already sent or failed
      if (emailLog.status !== 'PENDING' && emailLog.status !== 'QUEUED') {
        return { success: false, error: 'Email already processed' };
      }

      // Get SMTP configuration using smtpAccountId from emailLog
      const smtpConfig = await this.getSmtpConfig(emailLog.smtpAccountId);
      
      // Check daily sending limit
      const canSend = await this.checkDailyLimit(emailLog.smtpAccountId);
      if (!canSend) {
        await prisma.emailLog.update({
          where: { id: emailLogId },
          data: {
            status: 'FAILED',
            failedAt: new Date(),
            errorMessage: 'Daily sending limit exceeded',
          },
        });
        return { success: false, error: 'Daily sending limit exceeded' };
      }

      // Check office hours
      if (!this.isOfficeHours()) {
        // Reschedule for next office hours
        const nextOfficeHour = this.getNextOfficeHour();
        const delay = nextOfficeHour.getTime() - new Date().getTime();
        
        // Re-queue with delay
        const { emailQueue } = await import('./queue');
        await emailQueue.add('send-email', { emailLogId }, { delay });
        
        return { success: false, error: 'Outside office hours, rescheduled' };
      }

      // Render email content
      const emailContent = this.renderTemplate(
        emailLog.campaign.template,
        emailLog.recipient
      );

      // Create transporter
      const transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        auth: {
          user: smtpConfig.username,
          pass: smtpConfig.password,
        },
        // Add timeout settings
        connectionTimeout: 60000, // 60 seconds
        greetingTimeout: 30000,   // 30 seconds
        socketTimeout: 75000,     // 75 seconds
      });

      // Send email
      const info = await transporter.sendMail({
        from: `"${smtpConfig.fromName}" <${smtpConfig.fromEmail}>`,
        to: emailLog.recipient.email,
        subject: emailContent.subject,
        html: emailContent.htmlBody,
      });

      // Update email log
      await prisma.emailLog.update({
        where: { id: emailLogId },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          messageId: info.messageId,
        },
      });

      // Update campaign stats
      await this.updateCampaignStats(emailLog.campaignId, 'sent');

      // Update daily sending limit
      await this.updateDailyLimit(emailLog.smtpAccountId);

      // Update SMTP account last used
      await prisma.smtpAccount.update({
        where: { id: emailLog.smtpAccountId },
        data: { lastUsed: new Date() },
      });

      return { success: true, messageId: info.messageId };

    } catch (error) {
      console.error('Error sending email:', error);
      
      try {
        // Update email log with error - only if it exists
        const emailLogExists = await prisma.emailLog.findUnique({
          where: { id: emailLogId },
          select: { id: true, campaignId: true },
        });

        if (emailLogExists) {
          await prisma.emailLog.update({
            where: { id: emailLogId },
            data: {
              status: 'FAILED',
              failedAt: new Date(),
              errorMessage: error instanceof Error ? error.message : 'Unknown error',
            },
          });

          // Update campaign stats
          if (emailLogExists.campaignId) {
            await this.updateCampaignStats(emailLogExists.campaignId, 'failed');
          }
        } else {
          console.error(`Email log ${emailLogId} not found - unable to update status`);
        }
      } catch (updateError) {
        console.error('Error updating email log status:', updateError);
      }

      throw error;
    }
  }

  private static async getSmtpConfig(smtpAccountId: string): Promise<SmtpConfig> {
    // Check cache first
    if (this.smtpCache.has(smtpAccountId)) {
      return this.smtpCache.get(smtpAccountId);
    }

    const smtpAccount = await prisma.smtpAccount.findUnique({
      where: { id: smtpAccountId },
    });

    if (!smtpAccount) {
      throw new Error('SMTP account not found');
    }

    const decryptedPassword = EncryptionUtils.decrypt(smtpAccount.password);
    
    const smtpConfig: SmtpConfig = {
      host: smtpAccount.host,
      port: smtpAccount.port,
      secure: smtpAccount.secure,
      username: smtpAccount.username,
      password: decryptedPassword,
      fromName: smtpAccount.fromName,
      fromEmail: smtpAccount.fromEmail,
    };

    // Cache for 10 minutes (longer cache since we have connection pooling)
    this.smtpCache.set(smtpAccountId, smtpConfig);
    setTimeout(() => this.smtpCache.delete(smtpAccountId), 10 * 60 * 1000);

    return smtpConfig;
  }

  // Cleanup method for graceful shutdown
  static async cleanup(): Promise<void> {
    await smtpConnectionPool.closeAll();
    this.smtpCache.clear();
    this.templateCache.clear();
  }

  // Get connection pool metrics
  static getPoolMetrics() {
    return smtpConnectionPool.getMetrics();
  }

  private static renderTemplate(template: any, recipient: any): { subject: string; htmlBody: string } {
    let subject = template.subject;
    let htmlBody = template.htmlBody;

    // Parse custom data if it's a JSON string
    let customData = {};
    try {
      customData = typeof recipient.customData === 'string' 
        ? JSON.parse(recipient.customData || '{}') 
        : recipient.customData || {};
    } catch (error) {
      console.error('Error parsing recipient custom data:', error);
    }

    // Replace variables
    const variables: Record<string, any> = {
      email: recipient.email,
      firstName: recipient.firstName || '',
      lastName: recipient.lastName || '',
      fullName: `${recipient.firstName || ''} ${recipient.lastName || ''}`.trim(),
      ...customData,
    };

    // Add unsubscribe URL (placeholder for now)
    variables.unsubscribe_url = `https://example.com/unsubscribe?email=${encodeURIComponent(recipient.email)}`;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      subject = subject.replace(regex, String(value || ''));
      htmlBody = htmlBody.replace(regex, String(value || ''));
    }

    // Replace [UNSUBSCRIBE] placeholder
    htmlBody = htmlBody.replace(
      /\[UNSUBSCRIBE\]/g,
      `<a href="${variables.unsubscribe_url}" style="color: #666; text-decoration: none;">Unsubscribe</a>`
    );

    // Wrap content in mobile-responsive HTML structure if not already wrapped
    if (!htmlBody.includes('<html>') && !htmlBody.includes('<!DOCTYPE')) {
      htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subject}</title>
    <style>
        /* Reset styles */
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; }
        
        /* Container */
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        .email-content {
            padding: 30px 20px;
        }
        
        /* Typography */
        h1, h2, h3, h4, h5, h6 { margin-bottom: 15px; }
        p { margin-bottom: 15px; }
        
        /* Links */
        a { color: #2563eb; text-decoration: none; }
        a:hover { text-decoration: underline; }
        
        /* Footer */
        .email-footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            border-top: 1px solid #e9ecef;
        }
        
        .unsubscribe-link {
            font-size: 12px;
            color: #666;
            text-decoration: none;
        }
        
        /* Mobile responsive */
        @media only screen and (max-width: 600px) {
            .email-container { 
                width: 100% !important;
                margin: 0 !important;
                border-radius: 0 !important;
            }
            .email-content { 
                padding: 20px 15px !important;
            }
            h1 { font-size: 24px !important; }
            h2 { font-size: 20px !important; }
            p, div { font-size: 16px !important; }
        }
        
        @media only screen and (max-width: 480px) {
            .email-content { 
                padding: 15px 10px !important;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="email-content">
            ${htmlBody}
        </div>
        <div class="email-footer">
            <a href="${variables.unsubscribe_url}" class="unsubscribe-link">Unsubscribe from these emails</a>
        </div>
    </div>
</body>
</html>`;
    }

    return { subject, htmlBody };
  }

  private static async checkDailyLimit(smtpAccountId: string): Promise<boolean> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const smtpAccount = await prisma.smtpAccount.findUnique({
      where: { id: smtpAccountId },
      select: { dailyLimit: true },
    });

    if (!smtpAccount) {
      return false;
    }

    const dailyRecord = await prisma.dailySendingLimit.findUnique({
      where: {
        smtpAccountId_date: {
          smtpAccountId,
          date: today,
        },
      },
    });

    const sentToday = dailyRecord?.sentCount || 0;
    return sentToday < smtpAccount.dailyLimit;
  }

  private static async updateDailyLimit(smtpAccountId: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.dailySendingLimit.upsert({
      where: {
        smtpAccountId_date: {
          smtpAccountId,
          date: today,
        },
      },
      create: {
        smtpAccountId,
        date: today,
        sentCount: 1,
      },
      update: {
        sentCount: { increment: 1 },
      },
    });
  }

  private static async updateCampaignStats(campaignId: string, type: 'sent' | 'failed'): Promise<void> {
    const updateData = type === 'sent' ? 
      { sentCount: { increment: 1 } } : 
      { failedCount: { increment: 1 } };

    const updatedCampaign = await prisma.campaign.update({
      where: { id: campaignId },
      data: updateData,
      select: {
        totalRecipients: true,
        sentCount: true,
        failedCount: true,
        bounceCount: true,
      },
    });

    // Calculate bounce rate
    const totalProcessed = updatedCampaign.sentCount + updatedCampaign.failedCount;
    const bounceRate = totalProcessed > 0 ? 
      (updatedCampaign.bounceCount / totalProcessed) * 100 : 0;

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { bounceRate },
    });

    // Check if campaign is complete
    if (totalProcessed >= updatedCampaign.totalRecipients) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });
    }

    // Auto-pause if bounce rate is too high
    if (bounceRate > config.campaign.maxBounceRate && totalProcessed >= 10) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: 'PAUSED',
          pausedAt: new Date(),
        },
      });
      
      console.warn(`Campaign ${campaignId} auto-paused due to high bounce rate: ${bounceRate}%`);
    }
  }

  private static isOfficeHours(): boolean {
    const now = new Date();
    const hour = now.getHours();
    // Allow 24/7 operation, no weekend check
    return hour >= config.campaign.officeHoursStart && hour < config.campaign.officeHoursEnd;
  }

  private static getNextOfficeHour(): Date {
    const now = new Date();
    let nextOfficeHour = new Date(now);
    
    // Set to start of next office hours
    nextOfficeHour.setHours(config.campaign.officeHoursStart, 0, 0, 0);
    
    // If it's past office hours today, move to tomorrow
    if (now.getHours() >= config.campaign.officeHoursEnd) {
      nextOfficeHour.setDate(nextOfficeHour.getDate() + 1);
    }
    
    // Skip weekends
    while (nextOfficeHour.getDay() === 0 || nextOfficeHour.getDay() === 6) {
      nextOfficeHour.setDate(nextOfficeHour.getDate() + 1);
    }
    
    return nextOfficeHour;
  }

  static getRandomDelay(minDelay: number, maxDelay: number): number {
    return Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
  }

  static getRandomBatchSize(): number {
    const { batchSizeMin, batchSizeMax } = config.emailLimits;
    return Math.floor(Math.random() * (batchSizeMax - batchSizeMin + 1)) + batchSizeMin;
  }

  static getBatchBreakDelay(): number {
    // 2-minute break in milliseconds
    return config.emailLimits.batchBreakDuration * 1000;
  }

  static getEmailDelay(): number {
    // Random delay between 15-20 seconds in milliseconds
    const { minDelayBetweenEmails, maxDelayBetweenEmails } = config.emailLimits;
    return this.getRandomDelay(
      minDelayBetweenEmails * 1000,
      maxDelayBetweenEmails * 1000
    );
  }
}