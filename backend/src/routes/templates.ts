import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { templateSchema, validate } from '../utils/validation';

const router = express.Router();
const prisma = new PrismaClient();

// Helper function to extract variables from template
const extractVariables = (htmlBody: string, subject: string): string[] => {
  const variablePattern = /\{\{(\w+)\}\}/g;
  const variables = new Set<string>();
  
  // Extract from HTML body
  let match;
  while ((match = variablePattern.exec(htmlBody)) !== null) {
    variables.add(match[1]);
  }
  
  // Extract from subject
  variablePattern.lastIndex = 0; // Reset regex
  while ((match = variablePattern.exec(subject)) !== null) {
    variables.add(match[1]);
  }
  
  return Array.from(variables);
};

// Get all templates for user
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const templates = await prisma.template.findMany({
      where: { userId: req.userId },
      select: {
        id: true,
        name: true,
        subject: true,
        htmlBody: true,
        variables: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            campaigns: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single template
router.get('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const template = await prisma.template.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
      include: {
        _count: {
          select: {
            campaigns: true,
          },
        },
      },
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(template);
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create template
router.post('/', authMiddleware, validate(templateSchema), async (req: AuthRequest, res) => {
  try {
    const { name, subject, htmlBody, variables, isActive = true, autoAddUnsubscribe = false } = req.body;

    // Auto-extract variables if not provided
    const extractedVariables = variables?.length > 0 ? variables : extractVariables(htmlBody, subject);

    let finalHtmlBody = htmlBody;
    
    // Only add unsubscribe if explicitly requested by user OR if already present
    const hasUnsubscribe = htmlBody.toLowerCase().includes('unsubscribe') || 
                          htmlBody.includes('{{unsubscribe_url}}') ||
                          htmlBody.includes('[UNSUBSCRIBE]');
    
    // Only auto-add if user explicitly wants it AND it's not already there
    if (autoAddUnsubscribe && !hasUnsubscribe) {
      finalHtmlBody = htmlBody + `
      <br><br>
      <div style="text-align: center; font-size: 12px; color: #666; border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px;">
        <a href="{{unsubscribe_url}}" style="color: #666; text-decoration: none;">Unsubscribe from these emails</a>
      </div>`;
    }

    const template = await prisma.template.create({
      data: {
        userId: req.userId!,
        name,
        subject,
        htmlBody: finalHtmlBody,
        variables: JSON.stringify(extractedVariables),
        isActive,
      },
      select: {
        id: true,
        name: true,
        subject: true,
        htmlBody: true,
        variables: true,
        isActive: true,
        createdAt: true,
      },
    });

    res.status(201).json({
      message: 'Template created successfully',
      template,
    });
  } catch (error) {
    console.error('Error creating template:', error);
    
    // Handle Prisma validation errors
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return res.status(409).json({
        error: 'A template with this name already exists',
        details: 'Please choose a different template name.'
      });
    }
    
    res.status(500).json({ 
      error: 'Internal server error',
      details: 'Failed to create template. Please try again.'
    });
  }
});

// Update template
router.put('/:id', authMiddleware, validate(templateSchema), async (req: AuthRequest, res) => {
  try {
    const { name, subject, htmlBody, variables, isActive = true, autoAddUnsubscribe = false } = req.body;

    // Check if template exists and belongs to user
    const existingTemplate = await prisma.template.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
    });

    if (!existingTemplate) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Auto-extract variables if not provided
    const extractedVariables = variables?.length > 0 ? variables : extractVariables(htmlBody, subject);

    let finalHtmlBody = htmlBody;
    
    // Only add unsubscribe if explicitly requested by user OR if already present
    const hasUnsubscribe = htmlBody.toLowerCase().includes('unsubscribe') || 
                          htmlBody.includes('{{unsubscribe_url}}') ||
                          htmlBody.includes('[UNSUBSCRIBE]');
    
    // Only auto-add if user explicitly wants it AND it's not already there
    if (autoAddUnsubscribe && !hasUnsubscribe) {
      finalHtmlBody = htmlBody + `
      <br><br>
      <div style="text-align: center; font-size: 12px; color: #666; border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px;">
        <a href="{{unsubscribe_url}}" style="color: #666; text-decoration: none;">Unsubscribe from these emails</a>
      </div>`;
    }

    const updatedTemplate = await prisma.template.update({
      where: { id: req.params.id },
      data: {
        name,
        subject,
        htmlBody: finalHtmlBody,
        variables: JSON.stringify(extractedVariables),
        isActive,
      },
      select: {
        id: true,
        name: true,
        subject: true,
        htmlBody: true,
        variables: true,
        isActive: true,
        updatedAt: true,
      },
    });

    res.json({
      message: 'Template updated successfully',
      template: updatedTemplate,
    });
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete template
router.delete('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Check if template exists and belongs to user
    const existingTemplate = await prisma.template.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
    });

    if (!existingTemplate) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Check if there are any campaigns using this template
    const campaigns = await prisma.campaign.findMany({
      where: { templateId: req.params.id },
      select: { name: true }
    });

    if (campaigns.length > 0) {
      const campaignNames = campaigns.map(c => c.name).join(', ');
      return res.status(400).json({
        error: 'Cannot delete template',
        details: `This template is being used by ${campaigns.length} campaign(s): ${campaignNames}. Please remove it from those campaigns first.`,
      });
    }

    await prisma.template.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Preview template with sample data
router.post('/:id/preview', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { sampleData } = req.body;

    const template = await prisma.template.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Replace variables in template
    let previewSubject = template.subject;
    let previewBody = template.htmlBody;

    if (sampleData) {
      for (const [key, value] of Object.entries(sampleData as Record<string, any>)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        previewSubject = previewSubject.replace(regex, String(value));
        previewBody = previewBody.replace(regex, String(value));
      }
    }

    // Add sample unsubscribe URL
    previewBody = previewBody.replace(/\{\{unsubscribe_url\}\}/g, 'https://example.com/unsubscribe');
    previewBody = previewBody.replace(/\[UNSUBSCRIBE\]/g, '<a href="https://example.com/unsubscribe">Unsubscribe</a>');

    res.json({
      subject: previewSubject,
      htmlBody: previewBody,
      variables: template.variables,
    });
  } catch (error) {
    console.error('Error previewing template:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Toggle template active status
router.patch('/:id/toggle', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const template = await prisma.template.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const updatedTemplate = await prisma.template.update({
      where: { id: req.params.id },
      data: { isActive: !template.isActive },
      select: {
        id: true,
        name: true,
        isActive: true,
      },
    });

    res.json({
      message: `Template ${updatedTemplate.isActive ? 'activated' : 'deactivated'} successfully`,
      template: updatedTemplate,
    });
  } catch (error) {
    console.error('Error toggling template status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Duplicate template
router.post('/:id/duplicate', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const originalTemplate = await prisma.template.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
    });

    if (!originalTemplate) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const duplicatedTemplate = await prisma.template.create({
      data: {
        userId: req.userId!,
        name: `${originalTemplate.name} (Copy)`,
        subject: originalTemplate.subject,
        htmlBody: originalTemplate.htmlBody,
        variables: originalTemplate.variables as any,
      },
      select: {
        id: true,
        name: true,
        subject: true,
        htmlBody: true,
        variables: true,
        isActive: true,
        createdAt: true,
      },
    });

    res.status(201).json({
      message: 'Template duplicated successfully',
      template: duplicatedTemplate,
    });
  } catch (error) {
    console.error('Error duplicating template:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;