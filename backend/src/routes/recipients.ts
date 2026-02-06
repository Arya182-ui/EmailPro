import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { ExcelParser, ParsedRecipient } from '../utils/excel-parser';

const router = express.Router();
const prisma = new PrismaClient();

// Upload and parse Excel file
router.post('/upload', authMiddleware, upload.single('file'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Parse the Excel file
    const parseResult = ExcelParser.parseExcelFile(req.file.path);

    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Failed to parse Excel file',
        details: parseResult.errors,
      });
    }

    res.json({
      message: 'File parsed successfully',
      data: {
        totalRows: parseResult.totalRows,
        validRows: parseResult.validRows,
        invalidRows: parseResult.invalidRows,
        recipients: parseResult.recipients.slice(0, 10), // Return first 10 for preview
        totalRecipients: parseResult.recipients.length,
        errors: parseResult.errors,
        hasMore: parseResult.recipients.length > 10,
      },
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Validate email list (for manual input)
router.post('/validate-emails', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { emails } = req.body;

    if (!Array.isArray(emails)) {
      return res.status(400).json({ error: 'Emails must be an array' });
    }

    const validation = ExcelParser.validateEmailList(emails);

    res.json({
      valid: validation.valid,
      invalid: validation.invalid,
      totalEmails: emails.length,
      validCount: validation.valid.length,
      invalidCount: validation.invalid.length,
    });
  } catch (error) {
    console.error('Error validating emails:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create recipients from parsed data for a campaign
router.post('/create-recipients', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { campaignId, recipients } = req.body;

    if (!campaignId || !Array.isArray(recipients)) {
      return res.status(400).json({ error: 'Campaign ID and recipients array are required' });
    }

    // Verify campaign belongs to user
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        userId: req.userId,
      },
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Check if campaign already has recipients
    const existingRecipients = await prisma.campaignRecipient.count({
      where: { campaignId },
    });

    if (existingRecipients > 0) {
      return res.status(400).json({ 
        error: 'Campaign already has recipients',
        details: 'Delete existing recipients first or create a new campaign'
      });
    }

    // Create recipients
    const recipientData = recipients.map((recipient: ParsedRecipient) => ({
      campaignId,
      email: recipient.email,
      firstName: recipient.firstName,
      lastName: recipient.lastName,
      company: recipient.company,
      customData: recipient.customData ? JSON.stringify(recipient.customData) : null,
    }));

    const createdRecipients = await prisma.campaignRecipient.createMany({
      data: recipientData,
    });

    // Update campaign recipient count
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { totalRecipients: createdRecipients.count },
    });

    res.status(201).json({
      message: 'Recipients created successfully',
      count: createdRecipients.count,
    });
  } catch (error) {
    console.error('Error creating recipients:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get recipients for a campaign (with pagination)
router.get('/campaign/:campaignId/recipients', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { campaignId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    // Verify campaign belongs to user
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        userId: req.userId,
      },
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Get recipients with pagination
    const [recipients, totalCount] = await Promise.all([
      prisma.campaignRecipient.findMany({
        where: { campaignId },
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'asc' },
        include: {
          emailLogs: {
            select: {
              status: true,
              sentAt: true,
              errorMessage: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
      prisma.campaignRecipient.count({
        where: { campaignId },
      }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      recipients,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (error) {
    console.error('Error fetching recipients:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete all recipients from a campaign
router.delete('/campaign/:campaignId/recipients', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { campaignId } = req.params;

    // Verify campaign belongs to user and is not running
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        userId: req.userId,
      },
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    if (campaign.status === 'RUNNING') {
      return res.status(400).json({ 
        error: 'Cannot delete recipients from running campaign',
        details: 'Pause the campaign first'
      });
    }

    // Delete recipients and related email logs
    const deletedCount = await prisma.campaignRecipient.deleteMany({
      where: { campaignId },
    });

    // Update campaign recipient count
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { 
        totalRecipients: 0,
        sentCount: 0,
        failedCount: 0,
        bounceCount: 0,
        bounceRate: 0.0,
      },
    });

    res.json({
      message: 'All recipients deleted successfully',
      deletedCount: deletedCount.count,
    });
  } catch (error) {
    console.error('Error deleting recipients:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get sample data for template preview
router.get('/campaign/:campaignId/sample-data', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { campaignId } = req.params;

    // Verify campaign belongs to user
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        userId: req.userId,
      },
      include: {
        template: {
          select: {
            variables: true,
          },
        },
      },
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Get first recipient as sample
    const sampleRecipient = await prisma.campaignRecipient.findFirst({
      where: { campaignId },
    });

    if (!sampleRecipient) {
      return res.status(404).json({ error: 'No recipients found for this campaign' });
    }

    // Parse custom data if it exists
    let customData = {};
    try {
      customData = typeof sampleRecipient.customData === 'string' 
        ? JSON.parse(sampleRecipient.customData || '{}')
        : sampleRecipient.customData || {};
    } catch (error) {
      console.error('Error parsing custom data:', error);
    }

    // Create sample data object
    const sampleData: Record<string, any> = {
      email: sampleRecipient.email,
      firstName: sampleRecipient.firstName || 'John',
      lastName: sampleRecipient.lastName || 'Doe',
      fullName: `${sampleRecipient.firstName || 'John'} ${sampleRecipient.lastName || 'Doe'}`,
      company: (customData as any).company || (customData as any).Company || 'Sample Company',
      ...customData,
    };

    // Ensure all template variables have sample values
    if (campaign.template.variables) {
      const variables = JSON.parse(campaign.template.variables);
      for (const variable of variables) {
        if (!(variable in sampleData)) {
          sampleData[variable] = `Sample ${variable}`;
        }
      }
    }

    res.json({ sampleData });
  } catch (error) {
    console.error('Error getting sample data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;