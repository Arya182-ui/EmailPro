import { Server as SocketServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AuthenticatedSocket {
  userId: string;
  email: string;
  join: (room: string) => void;
  emit: (event: string, data: any) => void;
  leave: (room: string) => void;
}

class NotificationService {
  private io: SocketServer | null = null;
  private connectedUsers = new Map<string, string>(); // userId -> socketId

  initialize(server: HTTPServer) {
    this.io = new SocketServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        methods: ['GET', 'POST']
      }
    });

    // Authentication middleware for Socket.IO
    this.io.use(async (socket: any, next: (err?: Error) => void) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, config.jwt.secret) as any;
        
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: { id: true, email: true, firstName: true }
        });

        if (!user) {
          return next(new Error('User not found'));
        }

        socket.userId = user.id;
        socket.email = user.email;
        socket.user = user;
        
        next();
      } catch (error) {
        next(new Error('Invalid authentication token'));
      }
    });

    this.io.on('connection', (socket: any) => {
      console.log(`User connected: ${socket.user.email} (${socket.id})`);
      
      // Store user connection
      this.connectedUsers.set(socket.userId, socket.id);
      
      // Join user-specific room
      socket.join(`user_${socket.userId}`);
      
      // Send welcome notification
      socket.emit('notification', {
        type: 'info',
        title: 'Connected',
        message: 'Real-time notifications enabled',
        timestamp: new Date()
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.user.email}`);
        this.connectedUsers.delete(socket.userId);
      });

      // Handle campaign subscription
      socket.on('subscribe_campaign', (campaignId: string) => {
        socket.join(`campaign_${campaignId}`);
        console.log(`User ${socket.user.email} subscribed to campaign ${campaignId}`);
      });

      // Handle campaign unsubscription
      socket.on('unsubscribe_campaign', (campaignId: string) => {
        socket.leave(`campaign_${campaignId}`);
        console.log(`User ${socket.user.email} unsubscribed from campaign ${campaignId}`);
      });
    });

    console.log('Real-time notification service initialized');
  }

  // Send notification to specific user
  sendToUser(userId: string, notification: {
    type: 'success' | 'error' | 'info' | 'warning';
    title: string;
    message: string;
    data?: any;
  }) {
    if (!this.io) return;
    
    this.io.to(`user_${userId}`).emit('notification', {
      ...notification,
      timestamp: new Date()
    });
  }

  // Send notification to all users subscribed to a campaign
  sendToCampaign(campaignId: string, notification: {
    type: 'success' | 'error' | 'info' | 'warning';
    title: string;
    message: string;
    data?: any;
  }) {
    if (!this.io) return;
    
    this.io.to(`campaign_${campaignId}`).emit('campaign_update', {
      ...notification,
      campaignId,
      timestamp: new Date()
    });
  }

  // Campaign status updates
  notifyCampaignStart(userId: string, campaignId: string, campaignName: string) {
    this.sendToUser(userId, {
      type: 'info',
      title: 'Campaign Started',
      message: `Campaign "${campaignName}" has started sending emails`,
      data: { campaignId, status: 'RUNNING' }
    });

    this.sendToCampaign(campaignId, {
      type: 'info',
      title: 'Campaign Running',
      message: `Email sending in progress...`,
      data: { status: 'RUNNING' }
    });
  }

  notifyCampaignComplete(userId: string, campaignId: string, campaignName: string, stats: {
    totalSent: number;
    failed: number;
    bounced: number;
  }) {
    this.sendToUser(userId, {
      type: 'success',
      title: 'Campaign Completed',
      message: `Campaign "${campaignName}" completed. Sent: ${stats.totalSent}, Failed: ${stats.failed}`,
      data: { campaignId, status: 'COMPLETED', stats }
    });

    this.sendToCampaign(campaignId, {
      type: 'success',
      title: 'Campaign Completed',
      message: `All emails have been processed`,
      data: { status: 'COMPLETED', stats }
    });
  }

  notifyCampaignError(userId: string, campaignId: string, campaignName: string, error: string) {
    this.sendToUser(userId, {
      type: 'error',
      title: 'Campaign Error',
      message: `Campaign "${campaignName}" encountered an error: ${error}`,
      data: { campaignId, status: 'FAILED', error }
    });
  }

  // Email sending progress
  notifyEmailProgress(userId: string, campaignId: string, progress: {
    sent: number;
    total: number;
    currentRecipient: string;
  }) {
    this.sendToCampaign(campaignId, {
      type: 'info',
      title: 'Sending Progress',
      message: `${progress.sent}/${progress.total} emails sent`,
      data: {
        progress: Math.round((progress.sent / progress.total) * 100),
        sent: progress.sent,
        total: progress.total,
        currentRecipient: progress.currentRecipient
      }
    });
  }

  // SMTP connection issues
  notifySmtpIssue(userId: string, smtpName: string, error: string) {
    this.sendToUser(userId, {
      type: 'warning',
      title: 'SMTP Connection Issue',
      message: `SMTP account "${smtpName}" is experiencing issues: ${error}`,
      data: { smtpName, error }
    });
  }

  // Get connected users count
  getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  // Check if user is connected
  isUserConnected(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }
}

export const notificationService = new NotificationService();
export { NotificationService };