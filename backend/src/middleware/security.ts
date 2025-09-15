import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import { logger } from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  user?: any;
}

// Admin-only registration middleware
export const adminOnlyRegistration = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email } = req.body;

    // Check if this is the first user (allow registration)
    const userCount = await User.countDocuments();

    if (userCount === 0) {
      // First user becomes admin automatically
      req.body.role = 'admin';
      req.body.isActive = true;
      logger.info('First user registration - granting admin role', { email });
      return next();
    }

    // For subsequent registrations, require admin authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(403).json({
        success: false,
        error: 'Registration requires admin authentication'
      });
      return;
    }

    const token = authHeader.substring(7);
    // In a real implementation, you'd verify the JWT token here
    // For now, we'll just check if the token matches a simple admin token

    const adminToken = process.env.ADMIN_REGISTRATION_TOKEN;
    if (!adminToken || token !== adminToken) {
      res.status(403).json({
        success: false,
        error: 'Invalid admin registration token'
      });
      return;
    }

    // Verify the requesting user is an admin
    // This would require JWT verification in production
    req.body.role = 'user'; // New users start as regular users
    req.body.isActive = true;

    next();
  } catch (error) {
    logger.error('Admin registration middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration validation failed'
    });
  }
};

// Admin-only access middleware
export const requireAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
    return;
  }

  if (req.user.role !== 'admin') {
    res.status(403).json({
      success: false,
      error: 'Admin access required'
    });
    return;
  }

  next();
};

// Account lockout middleware
export const checkAccountLockout = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      return next();
    }

    const user = await User.findOne({ email });
    if (!user) {
      return next(); // User doesn't exist, let login handle it
    }

    if (user.isLocked()) {
      const remainingTime = Math.ceil(
        (user.lockoutUntil!.getTime() - Date.now()) / 1000 / 60
      );

      res.status(423).json({
        success: false,
        error: `Account is locked due to too many failed login attempts. Try again in ${remainingTime} minutes.`
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Account lockout check error:', error);
    next();
  }
};

// Extend global object for rate limiting
declare global {
  var registrationAttempts: Map<string, number[]> | undefined;
}

// IP-based rate limiting for registration
export const registrationRateLimit = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Simple in-memory rate limiting for registration
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxRequests = 3; // 3 registration attempts per 15 minutes

  // In production, you'd use Redis or a database for this
  if (!global.registrationAttempts) {
    global.registrationAttempts = new Map();
  }

  const attempts = global.registrationAttempts.get(clientIP) || [];
  const recentAttempts = attempts.filter((time: number) => now - time < windowMs);

  if (recentAttempts.length >= maxRequests) {
    res.status(429).json({
      success: false,
      error: 'Too many registration attempts. Please try again later.'
    });
    return;
  }

  recentAttempts.push(now);
  global.registrationAttempts.set(clientIP, recentAttempts);

  next();
};

// Security headers middleware
export const securityHeaders = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Remove sensitive headers
  res.removeHeader('X-Powered-By');

  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Only add HSTS in production
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
};

// IP whitelist middleware (optional)
export const ipWhitelist = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const allowedIPs = process.env.ALLOWED_IPS?.split(',') || [];

  // Skip whitelist check if not configured
  if (allowedIPs.length === 0) {
    return next();
  }

  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';

  if (!allowedIPs.includes(clientIP)) {
    logger.warn('Blocked request from unauthorized IP', { ip: clientIP });
    res.status(403).json({
      success: false,
      error: 'Access denied from this IP address'
    });
    return;
  }

  next();
};

// Request logging middleware with security focus
export const securityLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';

    // Log security-relevant requests
    if (res.statusCode >= 400) {
      logger.warn('Security event', {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        ip: clientIP,
        userAgent: req.get('User-Agent'),
        duration
      });
    } else if (req.url.includes('/auth/') || req.url.includes('/admin/')) {
      logger.info('Auth/Admin request', {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        ip: clientIP,
        duration
      });
    }
  });

  next();
};