import Queue from 'bull';
import { createClient } from 'redis';
import { PrismaClient } from '@prisma/client';
import { config } from '../config';

const prisma = new PrismaClient();

// Create Redis client
export const redisClient = createClient({
  url: config.redisUrl,
});

redisClient.on('error', (err) => {
  console.warn('Redis Client Error (continuing without Redis):', err.message);
});

redisClient.on('connect', () => {
  console.log('Connected to Redis');
});

// Initialize Redis connection
export const initializeRedis = async () => {
  try {
    await redisClient.connect();
    console.log('Connected to Redis');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn('Redis connection failed, continuing without Redis:', errorMessage);
  }
};

// Email sending queue
export const emailQueue = new Queue('email processing', config.redisUrl, {
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

// Campaign processing queue
export const campaignQueue = new Queue('campaign processing', config.redisUrl, {
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 10,
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

// Queue monitoring
emailQueue.on('completed', (job) => {
  console.log(`Email job ${job.id} completed`);
});

emailQueue.on('failed', (job, err) => {
  console.error(`Email job ${job.id} failed:`, err.message);
});

campaignQueue.on('completed', (job) => {
  console.log(`Campaign job ${job.id} completed`);
});

campaignQueue.on('failed', (job, err) => {
  console.error(`Campaign job ${job.id} failed:`, err.message);
});

export interface EmailJobData {
  emailLogId: string;
  campaignId: string;
  recipientId: string;
  smtpAccountId: string;
  templateId: string;
  delay?: number;
}

export interface CampaignJobData {
  campaignId: string;
  userId: string;
}

// Queue service methods
export const queueService = {
  async addCampaignJob(campaignId: string) {
    const job = await campaignQueue.add('process-campaign', {
      campaignId,
    }, {
      delay: 1000, // Start after 1 second
    });
    
    console.log(`Added campaign job ${job.id} for campaign ${campaignId}`);
    return job;
  },

  async addEmailJob(emailJobData: EmailJobData) {
    const job = await emailQueue.add('send-email', emailJobData, {
      delay: emailJobData.delay || 0,
    });
    
    console.log(`Added email job ${job.id} for campaign ${emailJobData.campaignId}`);
    return job;
  },

  async cleanupOrphanedEmailJobs() {
    try {
      const waitingJobs = await emailQueue.getWaiting();
      const activeJobs = await emailQueue.getActive();
      const allJobs = [...waitingJobs, ...activeJobs];
      
      let removedCount = 0;
      
      for (const job of allJobs) {
        const { emailLogId } = job.data;
        
        // Check if email log still exists
        const emailLog = await prisma.emailLog.findUnique({
          where: { id: emailLogId },
          select: { id: true },
        });
        
        if (!emailLog) {
          await job.remove();
          removedCount++;
          console.log(`Removed orphaned email job ${job.id} for non-existent email log ${emailLogId}`);
        }
      }
      
      if (removedCount > 0) {
        console.log(`Cleaned up ${removedCount} orphaned email jobs`);
      }
      
      return removedCount;
    } catch (error) {
      console.error('Error cleaning up orphaned email jobs:', error);
      return 0;
    }
  },
};