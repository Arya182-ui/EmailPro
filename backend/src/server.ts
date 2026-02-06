import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { config } from './config';
import { initializeRedis, queueService } from './services/queue';
import { EmailService } from './services/email';
import { notificationService } from './services/notifications';
import { cacheService } from './services/cache';
import { mobileDetection, deviceCheck } from './middleware/mobile-detection';

// Initialize workers (this must be imported to register queue processors)
import './workers/email-worker';

// Import routes
import authRoutes from './routes/auth';
import smtpRoutes from './routes/smtp';
import templateRoutes from './routes/templates';
import recipientRoutes from './routes/recipients';
import campaignRoutes from './routes/campaigns';
import { analyticsRoutes } from './services/analytics';

const app = express();
const server = createServer(app);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// Mobile detection middleware
app.use(mobileDetection);

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.nodeEnv === 'development' ? 1000 : config.rateLimit.maxRequests, // Much higher limit for dev
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for auth/me endpoint in development
    if (config.nodeEnv === 'development' && req.path === '/api/auth/me') {
      return true;
    }
    return false;
  },
});
app.use('/api', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

// Device check endpoint
app.get('/api/device-check', deviceCheck);

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/smtp', smtpRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/recipients', recipientRoutes);
app.use('/api/campaigns', campaignRoutes);

// Analytics routes
const analyticsRouter = express.Router();
analyticsRoutes(analyticsRouter);
app.use('/api', analyticsRouter);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large' });
  }
  
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }
  
  res.status(500).json({ 
    error: 'Internal server error',
    ...(config.nodeEnv === 'development' && { details: err.message })
  });
});

// Initialize services and start server
async function startServer() {
  try {
    // Initialize Redis connection
    await initializeRedis();
    console.log('Redis initialized successfully');

    // Initialize cache service
    await cacheService.initialize();
    console.log('Cache service initialized successfully');

    // Initialize real-time notifications
    notificationService.initialize(server);
    console.log('Notification service initialized successfully');

    // Clean up any orphaned email jobs from previous runs
    setTimeout(async () => {
      const removedCount = await queueService.cleanupOrphanedEmailJobs();
      if (removedCount > 0) {
        console.log(`🧹 Cleaned up ${removedCount} orphaned email jobs`);
      }
    }, 5000); // Run cleanup after 5 seconds

    // Periodic cleanup every 30 minutes
    setInterval(async () => {
      const removedCount = await queueService.cleanupOrphanedEmailJobs();
      if (removedCount > 0) {
        console.log(`🧹 Periodic cleanup: Removed ${removedCount} orphaned email jobs`);
      }
    }, 30 * 60 * 1000); // 30 minutes

    // Start HTTP server
    server.listen(config.port, () => {
      console.log(`
🚀 Email Automation Platform API Server Started
📍 Environment: ${config.nodeEnv}
🌐 Server running on: http://localhost:${config.port}
📊 Health check: http://localhost:${config.port}/health
⏰ Office Hours: ${config.campaign.officeHoursStart}:00 - ${config.campaign.officeHoursEnd}:00
📈 Rate Limit: ${config.rateLimit.maxRequests} requests per ${config.rateLimit.windowMs / 1000 / 60} minutes
📱 Mobile Detection: Enabled (Desktop only access)
🔔 Real-time Notifications: Enabled
💾 Caching: Enabled (Redis)
      `);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully...');
      server.close(async () => {
        console.log('HTTP server closed');
        
        // Cleanup SMTP connections
        await EmailService.cleanup();
        console.log('SMTP connections closed');
        
        // Cleanup cache service
        await cacheService.shutdown();
        console.log('Cache service closed');
        
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('SIGINT received, shutting down gracefully...');
      server.close(async () => {
        console.log('HTTP server closed');
        
        // Cleanup SMTP connections
        await EmailService.cleanup();
        console.log('SMTP connections closed');
        
        // Cleanup cache service
        await cacheService.shutdown();
        console.log('Cache service closed');
        
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

startServer();