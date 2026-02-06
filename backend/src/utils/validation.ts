import Joi from 'joi';

export const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

export const smtpAccountSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  host: Joi.string().required(),
  port: Joi.number().integer().min(1).max(65535).required(),
  secure: Joi.boolean().required(),
  username: Joi.string().required(),
  password: Joi.string().required(),
  fromName: Joi.string().min(2).max(100).required(),
  fromEmail: Joi.string().email().required(),
  dailyLimit: Joi.number().integer().min(1).max(10000).default(100),
  delayMin: Joi.number().integer().min(10).max(3600).default(30),
  delayMax: Joi.number().integer().min(10).max(3600).default(180),
});

export const templateSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  subject: Joi.string().min(1).max(200).required(),
  htmlBody: Joi.string().min(1).required(),
  variables: Joi.array().items(Joi.string()).default([]),
  isActive: Joi.boolean().default(true),
  autoAddUnsubscribe: Joi.boolean().default(false),
});

export const campaignSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  smtpAccountIds: Joi.array().items(Joi.string()).min(1).required(),
  templateId: Joi.string().required(),
  recipients: Joi.array().items(Joi.object({
    email: Joi.string().email().required(),
    firstName: Joi.string().optional(),
    lastName: Joi.string().optional(),
    customData: Joi.object().optional(),
  })).min(1).required(),
  scheduledAt: Joi.date().iso().optional().allow(null, ''),
  settings: Joi.object({
    delayBetweenEmails: Joi.number().integer().min(1).max(3600).default(30),
    batchSize: Joi.number().integer().min(1).max(1000).default(50),
    batchDelay: Joi.number().integer().min(60).max(86400).default(300),
    maxRetriesPerEmail: Joi.number().integer().min(1).max(5).default(3),
  }).optional(),
});

export const validate = (schema: Joi.ObjectSchema) => {
  return (req: any, res: any, next: any) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details.map(detail => detail.message),
      });
    }
    next();
  };
};