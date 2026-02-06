import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';

const prisma = new PrismaClient();

export class AnalyticsService {
  // Comprehensive dashboard stats
  static async getDashboardAnalytics(userId: string, timeRange: '7d' | '30d' | '90d' | 'all' = '30d') {
    const now = new Date();
    let startDate: Date;

    switch (timeRange) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(0); // All time
    }

    // Campaign statistics
    const campaignStats = await prisma.campaign.groupBy({
      by: ['status'],
      where: {
        userId,
        createdAt: { gte: startDate }
      },
      _count: true
    });

    // Email statistics
    const emailStats = await prisma.emailLog.groupBy({
      by: ['status'],
      where: {
        campaign: { userId },
        createdAt: { gte: startDate }
      },
      _count: true
    });

    // Recent campaigns
    const recentCampaigns = await prisma.campaign.findMany({
      where: {
        userId,
        createdAt: { gte: startDate }
      },
      include: {
        template: { select: { name: true } },
        _count: {
          select: {
            recipients: true,
            emailLogs: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    // SMTP performance
    const smtpPerformance = await prisma.emailLog.groupBy({
      by: ['smtpAccountId', 'status'],
      where: {
        campaign: { userId },
        createdAt: { gte: startDate }
      },
      _count: true
    });

    // Daily email volume
    const dailyVolume = await prisma.$queryRaw`
      SELECT 
        DATE(created_at) as date,
        status,
        COUNT(*) as count
      FROM email_logs el
      INNER JOIN campaigns c ON el.campaign_id = c.id
      WHERE c.user_id = ${userId}
        AND el.created_at >= ${startDate}
      GROUP BY DATE(created_at), status
      ORDER BY date DESC
      LIMIT 30
    `;

    // Top performing templates
    const templatePerformance = await prisma.template.findMany({
      where: {
        userId,
        campaigns: {
          some: {
            createdAt: { gte: startDate }
          }
        }
      },
      include: {
        _count: {
          select: {
            campaigns: {
              where: {
                createdAt: { gte: startDate }
              }
            }
          }
        }
      },
      orderBy: {
        campaigns: {
          _count: 'desc'
        }
      },
      take: 5
    });

    return {
      summary: {
        totalCampaigns: campaignStats.reduce((sum, stat) => sum + stat._count, 0),
        activeCampaigns: campaignStats.find(s => s.status === 'RUNNING')?._count || 0,
        completedCampaigns: campaignStats.find(s => s.status === 'COMPLETED')?._count || 0,
        totalEmails: emailStats.reduce((sum, stat) => sum + stat._count, 0),
        sentEmails: emailStats.find(s => s.status === 'SENT')?._count || 0,
        failedEmails: emailStats.find(s => s.status === 'FAILED')?._count || 0,
        bounceRate: this.calculateBounceRate(emailStats),
        deliveryRate: this.calculateDeliveryRate(emailStats)
      },
      campaignStats,
      emailStats,
      recentCampaigns: recentCampaigns.map(campaign => ({
        ...campaign,
        sentCount: campaign._count.emailLogs,
        totalRecipients: campaign._count.recipients,
        progress: campaign._count.recipients > 0 ? 
          Math.round((campaign._count.emailLogs / campaign._count.recipients) * 100) : 0
      })),
      smtpPerformance: this.processSMTPPerformance(smtpPerformance),
      dailyVolume,
      topTemplates: templatePerformance,
      timeRange
    };
  }

  // Real-time campaign monitoring
  static async getCampaignRealTimeStats(campaignId: string, userId: string) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId },
      include: {
        template: { select: { name: true, subject: true } },
        _count: {
          select: { recipients: true }
        }
      }
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    // Email status breakdown
    const emailStatus = await prisma.emailLog.groupBy({
      by: ['status'],
      where: { campaignId },
      _count: true
    });

    // Recent email activities
    const recentActivity = await prisma.emailLog.findMany({
      where: { campaignId },
      include: {
        recipient: {
          select: { email: true, firstName: true, lastName: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    // Hourly sending pattern
    const hourlySending = await prisma.$queryRaw`
      SELECT 
        strftime('%H', sent_at) as hour,
        COUNT(*) as count
      FROM email_logs
      WHERE campaign_id = ${campaignId} 
        AND status = 'SENT'
        AND sent_at IS NOT NULL
      GROUP BY strftime('%H', sent_at)
      ORDER BY hour
    `;

    const totalEmails = emailStatus.reduce((sum, stat) => sum + stat._count, 0);
    const sentEmails = emailStatus.find(s => s.status === 'SENT')?._count || 0;
    const failedEmails = emailStatus.find(s => s.status === 'FAILED')?._count || 0;

    return {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        template: campaign.template,
        totalRecipients: campaign._count.recipients,
        startedAt: campaign.startedAt,
        completedAt: campaign.completedAt
      },
      progress: {
        total: campaign._count.recipients,
        processed: totalEmails,
        sent: sentEmails,
        failed: failedEmails,
        pending: campaign._count.recipients - totalEmails,
        percentage: campaign._count.recipients > 0 ? 
          Math.round((totalEmails / campaign._count.recipients) * 100) : 0
      },
      emailStatus,
      recentActivity: recentActivity.slice(0, 10).map(log => ({
        email: log.recipient.email,
        name: `${log.recipient.firstName || ''} ${log.recipient.lastName || ''}`.trim(),
        status: log.status,
        sentAt: log.sentAt,
        errorMessage: log.errorMessage
      })),
      hourlySending
    };
  }

  // Email preview functionality
  static async getEmailPreview(templateId: string, sampleData: any = {}) {
    const template = await prisma.template.findUnique({
      where: { id: templateId }
    });

    if (!template) {
      throw new Error('Template not found');
    }

    // Parse variables from template
    const variables = JSON.parse(template.variables || '[]');
    
    // Default sample data
    const defaultSampleData = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      company: 'Example Corp',
      ...sampleData
    };

    // Replace variables in subject and body
    let previewSubject = template.subject;
    let previewBody = template.htmlBody;

    variables.forEach((variable: string) => {
      const value = defaultSampleData[variable] || `[${variable}]`;
      const regex = new RegExp(`{{\\s*${variable}\\s*}}`, 'g');
      previewSubject = previewSubject.replace(regex, value);
      previewBody = previewBody.replace(regex, value);
    });

    return {
      template: {
        id: template.id,
        name: template.name,
        variables
      },
      preview: {
        subject: previewSubject,
        htmlBody: previewBody
      },
      sampleData: defaultSampleData
    };
  }

  private static calculateBounceRate(emailStats: any[]): number {
    const total = emailStats.reduce((sum, stat) => sum + stat._count, 0);
    const bounced = emailStats.find(s => s.status === 'BOUNCED')?._count || 0;
    return total > 0 ? Math.round((bounced / total) * 100 * 100) / 100 : 0;
  }

  private static calculateDeliveryRate(emailStats: any[]): number {
    const total = emailStats.reduce((sum, stat) => sum + stat._count, 0);
    const sent = emailStats.find(s => s.status === 'SENT')?._count || 0;
    return total > 0 ? Math.round((sent / total) * 100 * 100) / 100 : 0;
  }

  private static processSMTPPerformance(smtpPerformance: any[]) {
    const grouped = smtpPerformance.reduce((acc, item) => {
      if (!acc[item.smtpAccountId]) {
        acc[item.smtpAccountId] = { total: 0, sent: 0, failed: 0 };
      }
      acc[item.smtpAccountId].total += item._count;
      if (item.status === 'SENT') {
        acc[item.smtpAccountId].sent += item._count;
      } else if (item.status === 'FAILED') {
        acc[item.smtpAccountId].failed += item._count;
      }
      return acc;
    }, {} as any);

    return Object.entries(grouped).map(([smtpAccountId, stats]: [string, any]) => ({
      smtpAccountId,
      ...stats,
      successRate: stats.total > 0 ? Math.round((stats.sent / stats.total) * 100) : 0
    }));
  }
}

// Analytics routes
export const analyticsRoutes = (router: any) => {
  // Dashboard analytics
  router.get('/analytics/dashboard', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const timeRange = req.query.timeRange as '7d' | '30d' | '90d' | 'all' || '30d';
      
      const analytics = await AnalyticsService.getDashboardAnalytics(userId, timeRange);
      res.json(analytics);
    } catch (error) {
      console.error('Dashboard analytics error:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard analytics' });
    }
  });

  // Campaign real-time stats
  router.get('/analytics/campaign/:campaignId', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { campaignId } = req.params;
      
      const stats = await AnalyticsService.getCampaignRealTimeStats(campaignId, userId);
      res.json(stats);
    } catch (error) {
      console.error('Campaign analytics error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch campaign analytics' });
    }
  });

  // Email preview
  router.get('/preview/:templateId', async (req: Request, res: Response) => {
    try {
      const { templateId } = req.params;
      const sampleData = req.query.sampleData ? JSON.parse(req.query.sampleData as string) : {};
      
      const preview = await AnalyticsService.getEmailPreview(templateId, sampleData);
      res.json(preview);
    } catch (error) {
      console.error('Email preview error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to generate email preview' });
    }
  });
};