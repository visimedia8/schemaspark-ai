import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface CustomError extends Error {
  statusCode?: number;
  status?: number;
  errors?: any[];
}

export const errorHandler = (
  error: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = error.statusCode || error.status || 500;
  let message = error.message || 'Internal Server Error';
  let errors = error.errors;

  // Log the error
  logger.error({
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: (req as any).user?._id || 'anonymous',
    statusCode
  });

  // Mongoose validation error
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
    errors = Object.values((error as any).errors).map((err: any) => ({
      field: err.path,
      message: err.message,
      value: err.value
    }));
  }

  // Mongoose duplicate key error
  if ((error as any).code === 11000) {
    statusCode = 409;
    message = 'Duplicate field value entered';
    const field = Object.keys((error as any).keyValue)[0];
    errors = [{ field, message: `${field} already exists` }];
  }

  // Mongoose cast error (invalid ObjectId)
  if (error.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid resource ID';
    errors = [{ field: 'id', message: 'Invalid ID format' }];
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }

  if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // Rate limiting error
  if (error.message && error.message.includes('Too many requests')) {
    statusCode = 429;
    message = 'Too many requests, please try again later';
  }

  // Development vs production error response
  const errorResponse: any = {
    success: false,
    message,
    ...(errors && { errors }),
    ...(process.env.NODE_ENV === 'development' && {
      stack: error.stack,
      error: error.name
    })
  };

  // Remove stack trace in production
  if (process.env.NODE_ENV !== 'development') {
    delete errorResponse.stack;
    delete errorResponse.error;
  }

  res.status(statusCode).json(errorResponse);
};

// Async error wrapper (eliminates try-catch blocks)
export const asyncHandler = (fn: Function) => (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  return Promise.resolve(fn(req, res, next)).catch(next);
};

// 404 handler (should be placed after all routes)
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error: CustomError = new Error(`Not found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

// Graceful shutdown handler
export const gracefulShutdown = (server: any, mongoose: any): void => {
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received. Starting graceful shutdown...`);
    
    try {
      // Stop accepting new connections
      server.close(() => {
        logger.info('HTTP server closed.');
      });

      // Close database connections
      if (mongoose) {
        await mongoose.connection.close();
        logger.info('MongoDB connection closed.');
      }

      // Exit process
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
};

// Unhandled promise rejection handler
export const unhandledRejectionHandler = (): void => {
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Close server & exit process
    process.exit(1);
  });
};

// Uncaught exception handler
export const uncaughtExceptionHandler = (): void => {
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception:', error);
    // Close server & exit process
    process.exit(1);
  });
};