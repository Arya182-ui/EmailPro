import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  }
}

class RateLimiter {
  private store: RateLimitStore = {};
  private windowMs: number;
  private maxRequests: number;

  constructor(windowMs: number = 60000, maxRequests: number = 10) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    
    // Cleanup old entries every 5 minutes
    setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  private cleanup() {
    const now = Date.now();
    Object.keys(this.store).forEach(key => {
      if (this.store[key].resetTime < now) {
        delete this.store[key];
      }
    });
  }

  isRateLimited(identifier: string): boolean {
    const now = Date.now();
    const record = this.store[identifier];

    if (!record || record.resetTime < now) {
      // First request or window has passed
      this.store[identifier] = {
        count: 1,
        resetTime: now + this.windowMs
      };
      return false;
    }

    if (record.count >= this.maxRequests) {
      return true;
    }

    record.count++;
    return false;
  }

  getRemainingTime(identifier: string): number {
    const record = this.store[identifier];
    if (!record) return 0;
    return Math.max(0, record.resetTime - Date.now());
  }

  getRemainingRequests(identifier: string): number {
    const record = this.store[identifier];
    if (!record) return this.maxRequests;
    return Math.max(0, this.maxRequests - record.count);
  }
}

// Different rate limiters for different endpoints
export const authRateLimiter = new RateLimiter(60000, 5); // 5 requests per minute for auth
export const generalRateLimiter = new RateLimiter(60000, 30); // 30 requests per minute for general APIs

export const createRateLimit = (rateLimiter: RateLimiter, message?: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Use IP address as identifier, fallback to a default if not available
    const identifier = req.ip || req.connection.remoteAddress || 'unknown';
    
    if (rateLimiter.isRateLimited(identifier)) {
      const remainingTime = rateLimiter.getRemainingTime(identifier);
      
      res.set({
        'X-RateLimit-Limit': '5',
        'X-RateLimit-Remaining': '0',
        'Retry-After': Math.ceil(remainingTime / 1000).toString()
      });

      return res.status(429).json({ 
        error: message || 'Too many requests. Please try again later.',
        retryAfter: Math.ceil(remainingTime / 1000)
      });
    }

    const remainingRequests = rateLimiter.getRemainingRequests(identifier);
    res.set({
      'X-RateLimit-Limit': '5',
      'X-RateLimit-Remaining': remainingRequests.toString()
    });

    next();
  };
};

// Pre-configured middleware
export const authRateLimit = createRateLimit(
  authRateLimiter, 
  'Too many authentication attempts. Please wait a moment and try again.'
);

export const generalRateLimit = createRateLimit(
  generalRateLimiter,
  'Too many requests. Please slow down.'
);