import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database
  databaseUrl: process.env.DATABASE_URL!,

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET!,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  // Email
  smtp: {
    fromName: process.env.SMTP_FROM_NAME || 'Email Automation Platform',
    fromEmail: process.env.SMTP_FROM_EMAIL!,
  },

  // File Upload
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB for production
    uploadDir: process.env.UPLOAD_DIR || (process.env.NODE_ENV === 'production' ? '/tmp/uploads' : './uploads'),
  },

  // Security
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
    encryptionKey: process.env.ENCRYPTION_KEY || 'default-key-change-in-production',
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1000', 10), // Increased from 100 to 1000
  },

  // Email Sending
  emailLimits: {
    defaultDailyLimit: parseInt(process.env.DEFAULT_DAILY_LIMIT || '100', 10),
    minDelayBetweenEmails: parseInt(process.env.MIN_DELAY_BETWEEN_EMAILS || '15', 10),
    maxDelayBetweenEmails: parseInt(process.env.MAX_DELAY_BETWEEN_EMAILS || '20', 10),
    batchSizeMin: parseInt(process.env.BATCH_SIZE_MIN || '10', 10),
    batchSizeMax: parseInt(process.env.BATCH_SIZE_MAX || '15', 10),
    batchBreakDuration: parseInt(process.env.BATCH_BREAK_DURATION || '120', 10),
  },

  // SMTP Connection Pool
  smtpPool: {
    maxPoolSize: parseInt(process.env.SMTP_POOL_SIZE || '5', 10),
    idleTimeout: parseInt(process.env.SMTP_IDLE_TIMEOUT || '300000', 10), // 5 minutes
    maxConnections: parseInt(process.env.SMTP_MAX_CONNECTIONS || '3', 10),
    maxMessages: parseInt(process.env.SMTP_MAX_MESSAGES || '100', 10),
    rateLimit: parseInt(process.env.SMTP_RATE_LIMIT || '5', 10),
  },

  // Campaign Settings
  campaign: {
    officeHoursStart: parseInt(process.env.OFFICE_HOURS_START || '9', 10),
    officeHoursEnd: parseInt(process.env.OFFICE_HOURS_END || '17', 10),
    maxBounceRate: parseInt(process.env.MAX_BOUNCE_RATE || '5', 10),
  },

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
};

// Validate required environment variables
const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'SMTP_FROM_EMAIL',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}