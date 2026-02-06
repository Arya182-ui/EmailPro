import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { campaignSchema, validate } from '../utils/validation';
import { queueService, emailQueue } from '../services/queue';

const router = express.Router();
const prisma = new PrismaClient();

// Get campaign stats for dashboard
router.get('/stats', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    // Get total campaigns count
    const totalCampaigns = await prisma.campaign.count({
      where: { userId },
    });

    // Get active campaigns count
    const activeCampaigns = await prisma.campaign.count({
      where: {
        userId,
        status: { in: ['SCHEDULED', 'RUNNING'] },
      },
    });

    // Get total emails sent
    const emailStats = await prisma.emailLog.aggregate({
      where: {
        campaign: { userId },
        status: 'SENT',
      },
      _count: true,
    });

    const stats = {
      totalCampaigns,
      activeCampaigns,
      totalEmailsSent: emailStats._count || 0,
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching campaign stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all campaigns for user
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const campaigns = await prisma.campaign.findMany({
      where: { userId: req.userId },
      include: {
        template: {
          select: {
            name: true,
            subject: true,
            isActive: true,
          },
        },
        _count: {
          select: {
            recipients: true,
            emailLogs: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json(campaigns);
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single campaign
router.get('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            subject: true,
            htmlBody: true,
            variables: true,
            isActive: true,
          },
        },
        _count: {
          select: {
            recipients: true,
            emailLogs: true,
          },
        },
      },
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json(campaign);
  } catch (error) {
    console.error('Error fetching campaign:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create campaign
router.post('/', authMiddleware, validate(campaignSchema), async (req: AuthRequest, res) => {
  try {
    const { name, smtpAccountIds, templateId, recipients, scheduledAt, settings } = req.body;

    // Verify SMTP accounts belong to user and are active
    const smtpAccounts = await prisma.smtpAccount.findMany({
      where: {
        id: { in: smtpAccountIds },
        userId: req.userId,
        isActive: true,
      },
    });

    if (smtpAccounts.length !== smtpAccountIds.length) {
      return res.status(400).json({ error: 'One or more SMTP accounts are invalid or inactive' });
    }

    // Verify template belongs to user and is active
    const template = await prisma.template.findFirst({
      where: {
        id: templateId,
        userId: req.userId,
        isActive: true,
      },
    });

    if (!template) {
      return res.status(400).json({ error: 'Invalid or inactive template' });
    }

    // Determine initial status
    let status: string = 'RUNNING'; // Default to RUNNING for immediate execution
    if (scheduledAt && scheduledAt.trim() !== '') {
      const scheduleTime = new Date(scheduledAt);
      status = scheduleTime > new Date() ? 'SCHEDULED' : 'RUNNING';
    }

    // Clean scheduledAt - convert empty string to null
    const cleanScheduledAt = scheduledAt && scheduledAt.trim() !== '' ? scheduledAt : null;

    // Create default settings if not provided
    const defaultSettings = {
      delayBetweenEmails: 30,
      batchSize: 50,
      batchDelay: 300,
      maxRetriesPerEmail: 3,
      ...settings,
    };

    const campaign = await prisma.campaign.create({
      data: {
        userId: req.userId!,
        name,
        templateId,
        status,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        settings: JSON.stringify(defaultSettings),
        smtpAccountIds: JSON.stringify(smtpAccountIds),
        totalRecipients: recipients.length,
        sentCount: 0,
        failedCount: 0,
      },
    });

    // Create recipients
    const recipientData = recipients.map((recipient: any) => ({
      campaignId: campaign.id,
      email: recipient.email.toLowerCase(),
      firstName: recipient.firstName || null,
      lastName: recipient.lastName || null,
      customData: JSON.stringify(recipient.customData || {}),
      status: 'PENDING',
    }));

    await prisma.campaignRecipient.createMany({
      data: recipientData,
    });

    // If this is an immediate campaign (no scheduledAt), start it immediately
    if (status === 'RUNNING') {
      try {
        await queueService.addCampaignJob(campaign.id);
        console.log(`Started immediate campaign: ${campaign.id}`);
      } catch (queueError) {
        console.error('Error starting immediate campaign:', queueError);
      }
    }

    // Get campaign with relations for response
    const createdCampaign = await prisma.campaign.findUnique({
      where: { id: campaign.id },
      include: {
        template: {
          select: {
            name: true,
            subject: true,
          },
        },
        _count: {
          select: {
            recipients: true,
          },
        },
      },
    });

    res.status(201).json({
      message: 'Campaign created successfully',
      campaign: {
        ...createdCampaign,
        smtpAccountIds: JSON.parse(createdCampaign?.smtpAccountIds as string || '[]'),
        settings: JSON.parse(createdCampaign?.settings as string || '{}'),
      },
    });
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update campaign
router.put('/:id', authMiddleware, validate(campaignSchema), async (req: AuthRequest, res) => {
  try {
    const { name, smtpAccountIds, templateId, scheduledAt, settings } = req.body;

    // Check if campaign exists and belongs to user
    const existingCampaign = await prisma.campaign.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
    });

    if (!existingCampaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Prevent updating running campaigns
    if (existingCampaign.status === 'RUNNING') {
      return res.status(400).json({ 
        error: 'Cannot update running campaign',
        details: 'Pause the campaign first'
      });
    }

    // Verify SMTP accounts and template
    const [smtpAccounts, template] = await Promise.all([
      prisma.smtpAccount.findMany({
        where: {
          id: { in: smtpAccountIds },
          userId: req.userId,
          isActive: true,
        },
      }),
      prisma.template.findFirst({
        where: {
          id: templateId,
          userId: req.userId,
          isActive: true,
        },
      }),
    ]);

    if (smtpAccounts.length !== smtpAccountIds.length) {
      return res.status(400).json({ error: 'One or more SMTP accounts are invalid or inactive' });
    }

    if (!template) {
      return res.status(400).json({ error: 'Invalid or inactive template' });
    }

    // Determine status
    let status = existingCampaign.status;
    if (scheduledAt) {
      const scheduleTime = new Date(scheduledAt);
      if (scheduleTime > new Date()) {
        status = 'SCHEDULED';
      }
    }

    const updatedCampaign = await prisma.campaign.update({
      where: { id: req.params.id },
      data: {
        name,
        smtpAccountIds: JSON.stringify(smtpAccountIds),
        templateId,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        status,
        settings: JSON.stringify(settings || {}),
      },
      include: {
        template: {
          select: {
            name: true,
            subject: true,
          },
        },
      },
    });

    res.json({
      message: 'Campaign updated successfully',
      campaign: {
        ...updatedCampaign,
        smtpAccountIds: JSON.parse(updatedCampaign.smtpAccountIds),
        settings: JSON.parse(updatedCampaign.settings as string || '{}'),
      },
    });
  } catch (error) {
    console.error('Error updating campaign:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start campaign
router.post('/:id/start', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
      include: {
        _count: {
          select: {
            recipients: true,
          },
        },
      },
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Validate campaign can be started
    if (!['PENDING', 'PAUSED', 'SCHEDULED'].includes(campaign.status)) {
      return res.status(400).json({ 
        error: 'Campaign cannot be started',
        details: `Current status: ${campaign.status}`
      });
    }

    if (campaign._count.recipients === 0) {
      return res.status(400).json({ 
        error: 'Cannot start campaign without recipients',
        details: 'Upload recipients first'
      });
    }

    // Check if SMTP accounts are still active
    const smtpAccountIds = JSON.parse(campaign.smtpAccountIds);
    const activeSmtpAccounts = await prisma.smtpAccount.findMany({
      where: {
        id: { in: smtpAccountIds },
        isActive: true,
      },
    });

    if (activeSmtpAccounts.length === 0) {
      return res.status(400).json({ 
        error: 'No active SMTP accounts available',
        details: 'Activate at least one SMTP account first'
      });
    }

    // Update campaign status
    const updatedCampaign = await prisma.campaign.update({
      where: { id: req.params.id },
      data: {
        status: 'RUNNING',
        startedAt: new Date(),
        pausedAt: null,
      },
      select: {
        id: true,
        name: true,
        status: true,
        startedAt: true,
      },
    });

    // TODO: Add campaign to email queue (implemented in email automation engine)

    res.json({
      message: 'Campaign started successfully',
      campaign: updatedCampaign,
    });
  } catch (error) {
    console.error('Error starting campaign:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Pause campaign
router.post('/:id/pause', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    if (campaign.status !== 'RUNNING') {
      return res.status(400).json({ 
        error: 'Campaign is not running',
        details: `Current status: ${campaign.status}`
      });
    }

    const updatedCampaign = await prisma.campaign.update({
      where: { id: req.params.id },
      data: {
        status: 'PAUSED',
        pausedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        status: true,
        pausedAt: true,
      },
    });

    res.json({
      message: 'Campaign paused successfully',
      campaign: updatedCampaign,
    });
  } catch (error) {
    console.error('Error pausing campaign:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Resume campaign
router.post('/:id/resume', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId,
        status: 'PAUSED',
      },
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found or is not paused' });
    }

    // Resume campaign
    const updatedCampaign = await prisma.campaign.update({
      where: { id: req.params.id },
      data: {
        status: 'RUNNING',
        pausedAt: null,
      },
      select: {
        id: true,
        name: true,
        status: true,
        pausedAt: true,
      },
    });

    // Start campaign processing again
    try {
      await queueService.addCampaignJob(req.params.id);
      console.log(`Resumed campaign: ${req.params.id}`);
    } catch (queueError) {
      console.error('Error resuming campaign:', queueError);
    }

    res.json({
      message: 'Campaign resumed successfully',
      campaign: updatedCampaign,
    });
  } catch (error) {
    console.error('Error resuming campaign:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Stop/Cancel campaign
router.post('/:id/stop', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    if (!['RUNNING', 'PAUSED', 'SCHEDULED'].includes(campaign.status)) {
      return res.status(400).json({ 
        error: 'Campaign cannot be stopped',
        details: `Current status: ${campaign.status}`
      });
    }

    // Clean up pending email jobs for this campaign
    try {
      const activeJobs = await emailQueue.getActive();
      const waitingJobs = await emailQueue.getWaiting();
      const delayedJobs = await emailQueue.getDelayed();
      
      const allJobs = [...activeJobs, ...waitingJobs, ...delayedJobs];
      let removedJobsCount = 0;
      
      for (const job of allJobs) {
        if (job.data.campaignId === req.params.id) {
          await job.remove();
          removedJobsCount++;
        }
      }
      
      if (removedJobsCount > 0) {
        console.log(`Removed ${removedJobsCount} email jobs for stopped campaign ${req.params.id}`);
      }
    } catch (cleanupError) {
      console.error('Error cleaning up email jobs for campaign stop:', cleanupError);
    }

    const updatedCampaign = await prisma.campaign.update({
      where: { id: req.params.id },
      data: {
        status: 'CANCELLED',
        completedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        status: true,
        completedAt: true,
      },
    });

    res.json({
      message: 'Campaign stopped successfully',
      campaign: updatedCampaign,
    });
  } catch (error) {
    console.error('Error stopping campaign:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete campaign
router.delete('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    if (campaign.status === 'RUNNING') {
      return res.status(400).json({ 
        error: 'Cannot delete running campaign',
        details: 'Stop the campaign first'
      });
    }

    // Clean up any pending email jobs for this campaign
    try {
      const activeJobs = await emailQueue.getActive();
      const waitingJobs = await emailQueue.getWaiting();
      const delayedJobs = await emailQueue.getDelayed();
      
      const allJobs = [...activeJobs, ...waitingJobs, ...delayedJobs];
      let removedJobsCount = 0;
      
      for (const job of allJobs) {
        if (job.data.campaignId === req.params.id) {
          await job.remove();
          removedJobsCount++;
        }
      }
      
      if (removedJobsCount > 0) {
        console.log(`Removed ${removedJobsCount} email jobs for deleted campaign ${req.params.id}`);
      }
    } catch (cleanupError) {
      console.error('Error cleaning up email jobs for campaign deletion:', cleanupError);
    }

    await prisma.campaign.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Campaign deleted successfully' });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get campaign statistics
router.get('/:id/stats', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
      include: {
        _count: {
          select: {
            recipients: true,
            emailLogs: true,
          },
        },
      },
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Get detailed email statistics
    const emailStats = await prisma.emailLog.groupBy({
      by: ['status'],
      where: { campaignId: req.params.id },
      _count: { status: true },
    });

    const stats = {
      totalRecipients: campaign.totalRecipients,
      sentCount: campaign.sentCount,
      failedCount: campaign.failedCount,
      bounceCount: campaign.bounceCount,
      bounceRate: campaign.bounceRate,
      pendingCount: campaign.totalRecipients - campaign.sentCount - campaign.failedCount,
      emailStatusBreakdown: emailStats.reduce((acc: Record<string, number>, stat) => {
        acc[stat.status] = stat._count.status;
        return acc;
      }, {}),
      campaignDuration: campaign.startedAt ? {
        started: campaign.startedAt,
        paused: campaign.pausedAt,
        completed: campaign.completedAt,
        totalDuration: campaign.completedAt ? 
          campaign.completedAt.getTime() - campaign.startedAt.getTime() : 
          campaign.startedAt ? new Date().getTime() - campaign.startedAt.getTime() : 0,
      } : null,
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching campaign stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get campaign email logs
router.get('/:id/logs', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const status = req.query.status as string;
    const offset = (page - 1) * limit;

    const campaign = await prisma.campaign.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const whereClause: any = { campaignId: req.params.id };
    if (status) {
      whereClause.status = status;
    }

    const [logs, totalCount] = await Promise.all([
      prisma.emailLog.findMany({
        where: whereClause,
        include: {
          recipient: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.emailLog.count({ where: whereClause }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      logs,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (error) {
    console.error('Error fetching campaign logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Duplicate campaign
router.post('/:id/duplicate', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const originalCampaign = await prisma.campaign.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
      include: {
        recipients: true,
        template: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!originalCampaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Create duplicate campaign
    const duplicateCampaign = await prisma.campaign.create({
      data: {
        userId: req.userId!,
        name: `${originalCampaign.name} (Copy)`,
        templateId: originalCampaign.templateId,
        status: 'DRAFT',
        scheduledAt: null,
        settings: originalCampaign.settings,
        smtpAccountIds: originalCampaign.smtpAccountIds,
        totalRecipients: originalCampaign.totalRecipients,
        sentCount: 0,
        failedCount: 0,
      },
    });

    // Duplicate recipients
    const recipientData = originalCampaign.recipients.map(recipient => ({
      campaignId: duplicateCampaign.id,
      email: recipient.email,
      firstName: recipient.firstName,
      lastName: recipient.lastName,
      customData: recipient.customData,
      status: 'PENDING',
    }));

    await prisma.campaignRecipient.createMany({
      data: recipientData,
    });

    res.status(201).json({
      message: 'Campaign duplicated successfully',
      campaign: {
        ...duplicateCampaign,
        smtpAccountIds: JSON.parse(duplicateCampaign.smtpAccountIds as string || '[]'),
        settings: JSON.parse(duplicateCampaign.settings as string || '{}'),
      },
    });
  } catch (error) {
    console.error('Error duplicating campaign:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Restart campaign
router.post('/:id/restart', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId,
        status: { in: ['COMPLETED', 'FAILED', 'PAUSED'] },
      },
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found or cannot be restarted' });
    }

    // Reset campaign status
    await prisma.campaign.update({
      where: { id: req.params.id },
      data: {
        status: 'RUNNING',
        startedAt: new Date(),
        completedAt: null,
        sentCount: 0,
        failedCount: 0,
      },
    });

    // Reset recipient statuses to PENDING (reset ALL recipients regardless of current status)
    const recipientUpdateResult = await prisma.campaignRecipient.updateMany({
      where: {
        campaignId: req.params.id,
      },
      data: {
        status: 'PENDING',
      },
    });

    console.log(`Reset ${recipientUpdateResult.count} recipients to PENDING status for campaign ${req.params.id}`);

    // Clean up existing email jobs for this campaign before clearing logs
    try {
      const activeJobs = await emailQueue.getActive();
      const waitingJobs = await emailQueue.getWaiting();
      const delayedJobs = await emailQueue.getDelayed();
      
      const allJobs = [...activeJobs, ...waitingJobs, ...delayedJobs];
      let removedJobsCount = 0;
      
      for (const job of allJobs) {
        if (job.data.campaignId === req.params.id) {
          await job.remove();
          removedJobsCount++;
        }
      }
      
      if (removedJobsCount > 0) {
        console.log(`Removed ${removedJobsCount} existing email jobs for campaign ${req.params.id}`);
      }
    } catch (cleanupError) {
      console.error('Error cleaning up email jobs:', cleanupError);
    }

    // Clear old email logs for restart
    await prisma.emailLog.deleteMany({
      where: {
        campaignId: req.params.id,
      },
    });

    // Start campaign processing
    try {
      await queueService.addCampaignJob(req.params.id);
      console.log(`Restarted campaign: ${req.params.id}`);
    } catch (queueError) {
      console.error('Error restarting campaign:', queueError);
    }

    res.json({ message: 'Campaign restarted successfully' });
  } catch (error) {
    console.error('Error restarting campaign:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;