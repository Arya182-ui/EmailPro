import { PrismaClient } from '@prisma/client';
import { emailQueue, campaignQueue } from '../services/queue';
import { EmailService } from '../services/email';

const prisma = new PrismaClient();

export class CampaignService {
  static async processCampaign(campaignId: string): Promise<void> {
    try {
      console.log(`Processing campaign: ${campaignId}`);

      // Get campaign details
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        include: {
          _count: {
            select: {
              recipients: true,
            },
          },
        },
      });

      if (!campaign) {
        throw new Error('Campaign not found');
      }

      if (!['RUNNING', 'PAUSED'].includes(campaign.status)) {
        console.log(`Campaign ${campaignId} is not running or paused. Status: ${campaign.status}`);
        return;
      }

      // If campaign is paused, don't process further
      if (campaign.status === 'PAUSED') {
        console.log(`Campaign ${campaignId} is paused, skipping processing`);
        return;
      }

      // Get SMTP accounts from the JSON array
      const smtpAccountIds = JSON.parse(campaign.smtpAccountIds as string || '[]');
      if (smtpAccountIds.length === 0) {
        throw new Error('No SMTP accounts configured for campaign');
      }

      // Get active SMTP accounts
      const smtpAccounts = await prisma.smtpAccount.findMany({
        where: {
          id: { in: smtpAccountIds },
          isActive: true,
        },
      });

      if (smtpAccounts.length === 0) {
        await prisma.campaign.update({
          where: { id: campaignId },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
          },
        });
        throw new Error('No active SMTP accounts available');
      }

      // Get all unprocessed recipients (PENDING or QUEUED)
      const unprocessedRecipients = await prisma.campaignRecipient.findMany({
        where: {
          campaignId,
          status: { in: ['PENDING', 'QUEUED'] }, // Include both PENDING and QUEUED
        },
        orderBy: { createdAt: 'asc' },
      });

      if (unprocessedRecipients.length === 0) {
        console.log(`No unprocessed recipients for campaign ${campaignId}`);
        
        // Debug: Check actual recipient statuses
        const allRecipients = await prisma.campaignRecipient.findMany({
          where: { campaignId },
          select: { status: true, email: true },
        });
        console.log(`Total recipients: ${allRecipients.length}`);
        console.log('Recipient statuses:', allRecipients.map(r => ({ email: r.email, status: r.status })));
        
        // Check if campaign is complete
        const totalRecipients = await prisma.campaignRecipient.count({
          where: { campaignId },
        });
        
        const processedCount = await prisma.campaignRecipient.count({
          where: { campaignId, status: { in: ['SENT', 'FAILED'] } },
        });

        if (processedCount >= totalRecipients) {
          await prisma.campaign.update({
            where: { id: campaignId },
            data: {
              status: 'COMPLETED',
              completedAt: new Date(),
            },
          });
        }
        
        return;
      }

      console.log(`Found ${unprocessedRecipients.length} unprocessed recipients`);

      let currentDelay = 0;
      let emailsInCurrentBatch = 0;
      const batchSize = EmailService.getRandomBatchSize();
      
      // Use first available SMTP account (you can implement round-robin later)
      const selectedSmtp = smtpAccounts[0];
      
      // Queue emails for each recipient with batch processing
      for (let i = 0; i < unprocessedRecipients.length; i++) {
        const recipient = unprocessedRecipients[i];
        
        try {
          // Create email log
          const emailLog = await prisma.emailLog.create({
            data: {
              campaignId,
              recipientId: recipient.id,
              smtpAccountId: selectedSmtp.id,
              status: 'QUEUED',
              subject: '', // Will be filled when sending
            },
          });

          // Calculate delay based on batch processing
          let emailDelay;
          
          // Check if we need a batch break (after 10-15 emails)
          if (emailsInCurrentBatch >= batchSize && i < unprocessedRecipients.length - 1) {
            // Add 2-minute break after batch
            emailDelay = EmailService.getBatchBreakDelay();
            emailsInCurrentBatch = 0; // Reset batch counter
            console.log(`Adding 2-minute batch break after ${batchSize} emails`);
          } else {
            // Regular 15-20 second delay between emails
            emailDelay = EmailService.getRandomDelay(
              selectedSmtp.delayMin * 1000, // Convert to milliseconds
              selectedSmtp.delayMax * 1000
            );
            emailsInCurrentBatch++;
          }

          currentDelay += emailDelay;

          // Add to email queue with calculated delay
          await emailQueue.add(
            'send-email',
            {
              emailLogId: emailLog.id,
              campaignId,
              recipientId: recipient.id,
              smtpAccountId: selectedSmtp.id,
              templateId: campaign.templateId,
              batchInfo: {
                position: i + 1,
                total: unprocessedRecipients.length,
                batchPosition: emailsInCurrentBatch,
                batchSize: batchSize
              }
            },
            {
              delay: currentDelay,
            }
          );

          // Mark recipient as queued
          await prisma.campaignRecipient.update({
            where: { id: recipient.id },
            data: { status: 'QUEUED' },
          });

          const delayInSeconds = Math.round(emailDelay / 1000);
          console.log(`Queued email for ${recipient.email} with ${delayInSeconds}s delay (${emailsInCurrentBatch}/${batchSize} in batch)`);

        } catch (recipientError) {
          console.error(`Error processing recipient ${recipient.id}:`, recipientError);
          
          // Create failed email log
          await prisma.emailLog.create({
            data: {
              campaignId,
              recipientId: recipient.id,
              smtpAccountId: selectedSmtp.id,
              status: 'FAILED',
              subject: '',
              errorMessage: recipientError instanceof Error ? recipientError.message : 'Unknown error',
              failedAt: new Date(),
            },
          });

          // Mark as failed
          await prisma.campaignRecipient.update({
            where: { id: recipient.id },
            data: { status: 'FAILED' },
          });
        }
      }

      console.log(`Campaign ${campaignId} processing completed. Queued ${unprocessedRecipients.length} emails.`);

    } catch (error) {
      console.error(`Error processing campaign ${campaignId}:`, error);
      
      // Update campaign status to failed
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
        },
      });
      
      throw error;
    }
  }

  static async startCampaign(campaignId: string): Promise<void> {
    console.log(`Starting campaign: ${campaignId}`);
    
    // Add campaign to processing queue
    await campaignQueue.add(
      'process-campaign',
      { campaignId },
      {
        delay: 1000, // Small delay to ensure campaign status is updated
      }
    );
  }

  static async checkScheduledCampaigns(): Promise<void> {
    try {
      const now = new Date();
      
      // Find campaigns that are scheduled to start
      const scheduledCampaigns = await prisma.campaign.findMany({
        where: {
          status: 'SCHEDULED',
          scheduledAt: {
            lte: now,
          },
        },
        include: {
          _count: {
            select: {
              recipients: true,
            },
          },
        },
      });

      for (const campaign of scheduledCampaigns) {
        try {
          // Get SMTP accounts from the JSON array
          const smtpAccountIds = JSON.parse(campaign.smtpAccountIds as string || '[]');
          if (smtpAccountIds.length === 0) {
            await prisma.campaign.update({
              where: { id: campaign.id },
              data: { status: 'FAILED' },
            });
            console.error(`Campaign ${campaign.id} failed: No SMTP accounts configured`);
            continue;
          }

          // Check if any SMTP account is active
          const activeSmtpCount = await prisma.smtpAccount.count({
            where: {
              id: { in: smtpAccountIds },
              isActive: true,
            },
          });

          if (activeSmtpCount === 0) {
            await prisma.campaign.update({
              where: { id: campaign.id },
              data: { status: 'FAILED' },
            });
            console.error(`Campaign ${campaign.id} failed: No active SMTP accounts`);
            continue;
          }

          if (campaign._count.recipients === 0) {
            await prisma.campaign.update({
              where: { id: campaign.id },
              data: { status: 'FAILED' },
            });
            console.error(`Campaign ${campaign.id} failed: No recipients`);
            continue;
          }

          // Start campaign
          await prisma.campaign.update({
            where: { id: campaign.id },
            data: {
              status: 'RUNNING',
              startedAt: new Date(),
            },
          });

          // Add to processing queue
          await this.startCampaign(campaign.id);
          
          console.log(`Started scheduled campaign: ${campaign.id}`);
          
        } catch (campaignError) {
          console.error(`Error starting scheduled campaign ${campaign.id}:`, campaignError);
        }
      }
      
    } catch (error) {
      console.error('Error checking scheduled campaigns:', error);
    }
  }

  static async pauseCampaign(campaignId: string): Promise<void> {
    // Remove pending jobs from queue
    const jobs = await emailQueue.getJobs(['delayed', 'waiting']);
    
    for (const job of jobs) {
      if (job.data.campaignId === campaignId) {
        await job.remove();
        console.log(`Removed job ${job.id} for paused campaign ${campaignId}`);
      }
    }

    // Update email logs that are still queued
    await prisma.emailLog.updateMany({
      where: {
        campaignId,
        status: 'QUEUED',
      },
      data: {
        status: 'PENDING',
      },
    });
  }

  static async resumeCampaign(campaignId: string): Promise<void> {
    console.log(`Resuming campaign: ${campaignId}`);
    
    // Reset queued emails back to pending
    await prisma.emailLog.updateMany({
      where: {
        campaignId,
        status: 'QUEUED',
      },
      data: {
        status: 'PENDING',
      },
    });

    // Reset status for pending recipients that haven't been sent or failed
    await prisma.campaignRecipient.updateMany({
      where: {
        campaignId,
        status: 'PENDING',
      },
      data: {
        status: 'PENDING',
      },
    });

    // Restart campaign processing
    await this.startCampaign(campaignId);
  }
}