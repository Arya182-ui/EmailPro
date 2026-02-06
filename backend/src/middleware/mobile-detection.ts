import { Request, Response, NextFunction } from 'express';

// Mobile device detection middleware
export const mobileDetection = (req: Request, res: Response, next: NextFunction) => {
  const userAgent = req.headers['user-agent'] || '';
  
  const mobilePatterns = [
    /Android/i,
    /webOS/i,
    /iPhone/i,
    /iPad/i,
    /iPod/i,
    /BlackBerry/i,
    /Windows Phone/i,
    /Opera Mini/i,
    /IEMobile/i,
    /Mobile/i
  ];

  const isMobile = mobilePatterns.some(pattern => pattern.test(userAgent));
  
  // Add mobile detection to request object
  (req as any).isMobile = isMobile;
  
  // For frontend routes, return mobile restriction message
  if (isMobile && !req.path.startsWith('/api/')) {
    return res.status(403).json({
      error: 'Mobile Access Restricted',
      message: 'This application is optimized for desktop use only. Please access from a desktop or laptop computer.',
      mobileDetected: true
    });
  }

  next();
};

// API endpoint to check device type
export const deviceCheck = (req: Request, res: Response) => {
  const userAgent = req.headers['user-agent'] || '';
  
  const mobilePatterns = [
    /Android/i, /webOS/i, /iPhone/i, /iPad/i, /iPod/i,
    /BlackBerry/i, /Windows Phone/i, /Opera Mini/i, /IEMobile/i, /Mobile/i
  ];

  const isMobile = mobilePatterns.some(pattern => pattern.test(userAgent));
  
  res.json({
    isMobile,
    userAgent,
    message: isMobile ? 
      'Mobile device detected. Please use a desktop for better experience.' : 
      'Desktop device detected. Welcome!'
  });
};