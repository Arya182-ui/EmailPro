import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { smtpAccountSchema, validate } from '../utils/validation';
import { EncryptionUtils } from '../utils/encryption';
import nodemailer from 'nodemailer';
import { EmailService } from '../services/email';

const router = express.Router();
const prisma = new PrismaClient();

// Get all SMTP accounts for user
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const smtpAccounts = await prisma.smtpAccount.findMany({
      where: { userId: req.userId },
      select: {
        id: true,
        name: true,
        host: true,
        port: true,
        secure: true,
        username: true,
        fromName: true,
        fromEmail: true,
        dailyLimit: true,
        delayMin: true,
        delayMax: true,
        isActive: true,
        lastUsed: true,
        createdAt: true,
        updatedAt: true,
        // Don't include encrypted password in response
      },
    });

    res.json(smtpAccounts);
  } catch (error) {
    console.error('Error fetching SMTP accounts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single SMTP account
router.get('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const smtpAccount = await prisma.smtpAccount.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
      select: {
        id: true,
        name: true,
        host: true,
        port: true,
        secure: true,
        username: true,
        fromName: true,
        fromEmail: true,
        dailyLimit: true,
        delayMin: true,
        delayMax: true,
        isActive: true,
        lastUsed: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!smtpAccount) {
      return res.status(404).json({ error: 'SMTP account not found' });
    }

    res.json(smtpAccount);
  } catch (error) {
    console.error('Error fetching SMTP account:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create SMTP account
router.post('/', authMiddleware, validate(smtpAccountSchema), async (req: AuthRequest, res) => {
  try {
    const {
      name,
      host,
      port,
      secure,
      username,
      password,
      fromName,
      fromEmail,
      dailyLimit,
      delayMin,
      delayMax,
    } = req.body;

    // Test SMTP connection before saving
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user: username,
        pass: password,
      },
    });

    try {
      await transporter.verify();
    } catch (verifyError) {
      return res.status(400).json({
        error: 'SMTP connection failed',
        details: 'Please check your SMTP settings and try again',
      });
    }

    // Encrypt password before storing
    const encryptedPassword = EncryptionUtils.encrypt(password);

    const smtpAccount = await prisma.smtpAccount.create({
      data: {
        userId: req.userId!,
        name,
        host,
        port,
        secure,
        username,
        password: encryptedPassword,
        fromName,
        fromEmail,
        dailyLimit,
        delayMin,
        delayMax,
      },
      select: {
        id: true,
        name: true,
        host: true,
        port: true,
        secure: true,
        username: true,
        fromName: true,
        fromEmail: true,
        dailyLimit: true,
        delayMin: true,
        delayMax: true,
        isActive: true,
        createdAt: true,
      },
    });

    res.status(201).json({
      message: 'SMTP account created successfully',
      smtpAccount,
    });
  } catch (error) {
    console.error('Error creating SMTP account:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update SMTP account
router.put('/:id', authMiddleware, validate(smtpAccountSchema), async (req: AuthRequest, res) => {
  try {
    const {
      name,
      host,
      port,
      secure,
      username,
      password,
      fromName,
      fromEmail,
      dailyLimit,
      delayMin,
      delayMax,
    } = req.body;

    // Check if SMTP account exists and belongs to user
    const existingAccount = await prisma.smtpAccount.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
    });

    if (!existingAccount) {
      return res.status(404).json({ error: 'SMTP account not found' });
    }

    // Test SMTP connection before updating
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user: username,
        pass: password,
      },
    });

    try {
      await transporter.verify();
    } catch (verifyError) {
      return res.status(400).json({
        error: 'SMTP connection failed',
        details: 'Please check your SMTP settings and try again',
      });
    }

    // Encrypt password before storing
    const encryptedPassword = EncryptionUtils.encrypt(password);

    const updatedAccount = await prisma.smtpAccount.update({
      where: { id: req.params.id },
      data: {
        name,
        host,
        port,
        secure,
        username,
        password: encryptedPassword,
        fromName,
        fromEmail,
        dailyLimit,
        delayMin,
        delayMax,
      },
      select: {
        id: true,
        name: true,
        host: true,
        port: true,
        secure: true,
        username: true,
        fromName: true,
        fromEmail: true,
        dailyLimit: true,
        delayMin: true,
        delayMax: true,
        isActive: true,
        updatedAt: true,
      },
    });

    res.json({
      message: 'SMTP account updated successfully',
      smtpAccount: updatedAccount,
    });
  } catch (error) {
    console.error('Error updating SMTP account:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete SMTP account
router.delete('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Check if SMTP account exists and belongs to user
    const existingAccount = await prisma.smtpAccount.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
    });

    if (!existingAccount) {
      return res.status(404).json({ error: 'SMTP account not found' });
    }

    // Check if there are any active campaigns using this SMTP account
    const campaigns = await prisma.campaign.findMany({
      where: {
        status: { in: ['PENDING', 'SCHEDULED', 'RUNNING', 'PAUSED'] },
      },
      select: {
        id: true,
        smtpAccountIds: true,
      },
    });

    // Filter campaigns that contain this SMTP account ID in their JSON array
    const activeCampaigns = campaigns.filter(campaign => {
      try {
        const smtpIds = JSON.parse(campaign.smtpAccountIds);
        return Array.isArray(smtpIds) && smtpIds.includes(req.params.id);
      } catch {
        return false;
      }
    }).length;

    if (activeCampaigns > 0) {
      return res.status(400).json({
        error: 'Cannot delete SMTP account',
        details: 'There are active campaigns using this SMTP account',
      });
    }

    await prisma.smtpAccount.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'SMTP account deleted successfully' });
  } catch (error) {
    console.error('Error deleting SMTP account:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test SMTP connection
router.post('/:id/test', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const smtpAccount = await prisma.smtpAccount.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
    });

    if (!smtpAccount) {
      return res.status(404).json({ error: 'SMTP account not found' });
    }

    // Decrypt password
    const decryptedPassword = EncryptionUtils.decrypt(smtpAccount.password);

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: smtpAccount.host,
      port: smtpAccount.port,
      secure: smtpAccount.secure,
      auth: {
        user: smtpAccount.username,
        pass: decryptedPassword,
      },
    });

    // Test connection
    await transporter.verify();

    // Update lastUsed timestamp
    await prisma.smtpAccount.update({
      where: { id: req.params.id },
      data: { lastUsed: new Date() },
    });

    res.json({ message: 'SMTP connection test successful' });
  } catch (error) {
    console.error('SMTP connection test failed:', error);
    res.status(400).json({
      error: 'SMTP connection test failed',
      details: 'Please check your SMTP settings',
    });
  }
});

// Toggle SMTP account active status
router.patch('/:id/toggle', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const smtpAccount = await prisma.smtpAccount.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
    });

    if (!smtpAccount) {
      return res.status(404).json({ error: 'SMTP account not found' });
    }

    const updatedAccount = await prisma.smtpAccount.update({
      where: { id: req.params.id },
      data: { isActive: !smtpAccount.isActive },
      select: {
        id: true,
        name: true,
        isActive: true,
      },
    });

    res.json({
      message: `SMTP account ${updatedAccount.isActive ? 'activated' : 'deactivated'} successfully`,
      smtpAccount: updatedAccount,
    });
  } catch (error) {
    console.error('Error toggling SMTP account status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get SMTP connection pool metrics
router.get('/pool/metrics', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const metrics = EmailService.getPoolMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('Error fetching pool metrics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
