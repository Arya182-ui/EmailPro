import Redis from 'ioredis';
import { config } from '../config';

class CacheService {
  private redis: Redis | null = null;
  private isConnected = false;

  async initialize() {
    try {
      this.redis = new Redis(config.redisUrl);
      
      this.redis.on('connect', () => {
        this.isConnected = true;
        console.log('Cache service connected to Redis');
      });

      this.redis.on('error', (error) => {
        console.error('Redis cache error:', error);
        this.isConnected = false;
      });

      this.redis.on('close', () => {
        this.isConnected = false;
        console.log('Redis cache connection closed');
      });

      // Test connection
      await this.redis.ping();
      
    } catch (error) {
      console.error('Failed to initialize cache service:', error);
    }
  }

  // Generic cache methods
  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected || !this.redis) return null;
    
    try {
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set(key: string, value: any, ttl: number = 3600): Promise<boolean> {
    if (!this.isConnected || !this.redis) return false;
    
    try {
      await this.redis.setex(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    if (!this.isConnected || !this.redis) return false;
    
    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  // User data caching
  async getUserData(userId: string) {
    return this.get(`user:${userId}`);
  }

  async setUserData(userId: string, userData: any, ttl: number = 1800) {
    return this.set(`user:${userId}`, userData, ttl);
  }

  // Template caching
  async getTemplate(templateId: string) {
    return this.get(`template:${templateId}`);
  }

  async setTemplate(templateId: string, template: any, ttl: number = 3600) {
    return this.set(`template:${templateId}`, template, ttl);
  }

  // Campaign stats caching
  async getCampaignStats(campaignId: string) {
    return this.get(`campaign:stats:${campaignId}`);
  }

  async setCampaignStats(campaignId: string, stats: any, ttl: number = 300) {
    return this.set(`campaign:stats:${campaignId}`, stats, ttl);
  }

  // Dashboard analytics caching
  async getDashboardAnalytics(userId: string, timeRange: string) {
    return this.get(`analytics:dashboard:${userId}:${timeRange}`);
  }

  async setDashboardAnalytics(userId: string, timeRange: string, analytics: any, ttl: number = 900) {
    return this.set(`analytics:dashboard:${userId}:${timeRange}`, analytics, ttl);
  }

  // Rate limiting cache
  async getRateLimit(key: string): Promise<number> {
    if (!this.isConnected || !this.redis) return 0;
    
    try {
      const count = await this.redis.get(`ratelimit:${key}`);
      return count ? parseInt(count) : 0;
    } catch (error) {
      console.error('Rate limit get error:', error);
      return 0;
    }
  }

  async incrementRateLimit(key: string, ttl: number = 3600): Promise<number> {
    if (!this.isConnected || !this.redis) return 0;
    
    try {
      const multi = this.redis.multi();
      multi.incr(`ratelimit:${key}`);
      multi.expire(`ratelimit:${key}`, ttl);
      const results = await multi.exec();
      return results?.[0]?.[1] as number || 0;
    } catch (error) {
      console.error('Rate limit increment error:', error);
      return 0;
    }
  }

  // Graceful shutdown
  async shutdown() {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
      this.isConnected = false;
      console.log('Cache service shutdown completed');
    }
  }
}

export const cacheService = new CacheService();

// Cache middleware for Express routes
export const cacheMiddleware = (ttl: number = 300) => {
  return async (req: any, res: any, next: any) => {
    // Generate cache key based on URL and user
    const userId = req.user?.id || 'anonymous';
    const cacheKey = `route:${userId}:${req.originalUrl}`;
    
    try {
      const cached = await cacheService.get(cacheKey);
      
      if (cached) {
        return res.json(cached);
      }
      
      // Store original res.json method
      const originalJson = res.json.bind(res);
      
      // Override res.json to cache the response
      res.json = (data: any) => {
        // Cache the response
        cacheService.set(cacheKey, data, ttl);
        return originalJson(data);
      };
      
      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      next();
    }
  };
};
