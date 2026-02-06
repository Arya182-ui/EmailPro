import { emailQueue, campaignQueue } from '../services/queue';
import { EmailService } from '../services/email';
import { CampaignService } from '../services/campaign';
import { config } from '../config';

// Email processing worker
emailQueue.process('send-email', 3, async (job) => {
  const { emailLogId, batchInfo } = job.data;
  
  const batchDetails = batchInfo ? 
    `(${batchInfo.position}/${batchInfo.total}, batch: ${batchInfo.batchPosition}/${batchInfo.batchSize})` : '';
  
  console.log(`Processing email job: ${job.id} for email log: ${emailLogId} ${batchDetails}`);
  
  try {
    const result = await EmailService.sendEmail(emailLogId);
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    console.log(`✅ Email sent successfully: ${emailLogId} ${batchDetails}, messageId: ${result.messageId}`);
    return result;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Check if this is a "record not found" error
    if (errorMessage.includes('Email log or related data not found')) {
      console.error(`❌ Email job ${job.id} failed ${batchDetails}: Email log ${emailLogId} not found - job may be stale`);
      // Don't retry this job as the email log doesn't exist
      return { success: false, error: 'Email log not found' };
    }
    
    console.error(`❌ Email job ${job.id} failed ${batchDetails}:`, error);
    throw error;
  }
});

// Campaign processing worker
campaignQueue.process('process-campaign', 2, async (job) => {
  const { campaignId } = job.data;
  
  console.log(`Processing campaign job: ${job.id} for campaign: ${campaignId}`);
  
  try {
    await CampaignService.processCampaign(campaignId);
    console.log(`Campaign processed successfully: ${campaignId}`);
    
  } catch (error) {
    console.error(`Campaign job ${job.id} failed:`, error);
    throw error;
  }
});

// Schedule checker (runs every minute)
setInterval(async () => {
  try {
    await CampaignService.checkScheduledCampaigns();
  } catch (error) {
    console.error('Error in scheduled campaign checker:', error);
  }
}, 60 * 1000); // Every minute

// Queue status monitoring
setInterval(() => {
  emailQueue.getJobCounts().then((counts) => {
    if (counts.active > 0 || counts.waiting > 0 || counts.delayed > 0) {
      console.log('Email Queue Status:', {
        active: counts.active,
        waiting: counts.waiting,
        delayed: counts.delayed,
        completed: counts.completed,
        failed: counts.failed,
      });
    }
  });

  campaignQueue.getJobCounts().then((counts) => {
    if (counts.active > 0 || counts.waiting > 0 || counts.delayed > 0) {
      console.log('Campaign Queue Status:', {
        active: counts.active,
        waiting: counts.waiting,
        delayed: counts.delayed,
        completed: counts.completed,
        failed: counts.failed,
      });
    }
  });
}, 30 * 1000); // Every 30 seconds

console.log('Email worker started successfully');
console.log(`Email queue concurrency: 5`);
console.log(`Campaign queue concurrency: 2`);
console.log(`Office hours: ${config.campaign.officeHoursStart}:00 - ${config.campaign.officeHoursEnd}:00`);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, closing queues...');
  await emailQueue.close();
  await campaignQueue.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, closing queues...');
  await emailQueue.close();
  await campaignQueue.close();
  process.exit(0);
});