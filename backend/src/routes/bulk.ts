import express, { Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { bulkProcessingService } from '../services/bulkProcessingService';
import { logger } from '../utils/logger';
const { body, param, query } = require('express-validator');

const router = express.Router();

// Create bulk processing job
router.post('/jobs',
  authenticateToken,
  [
    body('urls').isArray({ min: 1, max: 100 }).withMessage('URLs must be an array with 1-100 items'),
    body('urls.*').isURL().withMessage('Each URL must be valid'),
    body('options.maxConcurrency').optional().isInt({ min: 1, max: 10 }).withMessage('Max concurrency must be 1-10'),
    body('options.delayBetweenRequests').optional().isInt({ min: 0, max: 10000 }).withMessage('Delay must be 0-10000ms'),
    body('options.skipDuplicates').optional().isBoolean().withMessage('Skip duplicates must be boolean'),
    body('options.targetKeywords').optional().isArray().withMessage('Target keywords must be an array'),
    body('options.targetKeywords.*').optional().isString().withMessage('Keywords must be strings'),
    body('options.timeout').optional().isInt({ min: 5000, max: 120000 }).withMessage('Timeout must be 5000-120000ms')
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { urls, options } = req.body;
      const userId = req.user._id;

      logger.info('Creating bulk processing job', {
        userId,
        urlCount: urls.length,
        options
      });

      const job = bulkProcessingService.createJob(userId, urls, options);

      res.status(201).json({
        success: true,
        data: {
          jobId: job.id,
          status: job.status,
          total: job.urls.length,
          message: 'Bulk processing job created successfully'
        }
      });
    } catch (error: any) {
      logger.error('Error creating bulk processing job:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Start bulk processing job
router.post('/jobs/:jobId/start',
  authenticateToken,
  [
    param('jobId').isString().withMessage('Job ID must be a string')
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { jobId } = req.params;
      const userId = req.user._id;

      logger.info('Starting bulk processing job', { jobId, userId });

      await bulkProcessingService.startJob(jobId);

      res.json({
        success: true,
        message: 'Bulk processing job started successfully'
      });
    } catch (error: any) {
      logger.error('Error starting bulk processing job:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Cancel bulk processing job
router.post('/jobs/:jobId/cancel',
  authenticateToken,
  [
    param('jobId').isString().withMessage('Job ID must be a string')
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { jobId } = req.params;
      const userId = req.user._id;

      logger.info('Cancelling bulk processing job', { jobId, userId });

      bulkProcessingService.cancelJob(jobId, userId);

      res.json({
        success: true,
        message: 'Bulk processing job cancelled successfully'
      });
    } catch (error: any) {
      logger.error('Error cancelling bulk processing job:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
    return;
  }
);

// Get bulk processing job status
router.get('/jobs/:jobId',
  authenticateToken,
  [
    param('jobId').isString().withMessage('Job ID must be a string')
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { jobId } = req.params;
      const userId = req.user._id;

      const job = bulkProcessingService.getJob(jobId, userId);

      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'Job not found or access denied'
        });
      }

      res.json({
        success: true,
        data: {
          job: {
            id: job.id,
            status: job.status,
            progress: job.progress,
            createdAt: job.createdAt,
            startedAt: job.startedAt,
            completedAt: job.completedAt,
            options: job.options
          }
        }
      });
    } catch (error: any) {
      logger.error('Error getting bulk processing job:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get job status'
      });
    }
    return;
  }
);

// Get user's bulk processing jobs
router.get('/jobs',
  authenticateToken,
  [
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be 1-50'),
    query('status').optional().isIn(['pending', 'processing', 'completed', 'failed', 'cancelled']).withMessage('Invalid status')
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user._id;
      const limit = parseInt(req.query.limit as string) || 10;
      const status = req.query.status as string;

      let jobs = bulkProcessingService.getUserJobs(userId, limit);

      // Filter by status if provided
      if (status) {
        jobs = jobs.filter(job => job.status === status);
      }

      res.json({
        success: true,
        data: {
          jobs: jobs.map(job => ({
            id: job.id,
            status: job.status,
            progress: job.progress,
            createdAt: job.createdAt,
            startedAt: job.startedAt,
            completedAt: job.completedAt,
            urlCount: job.urls.length
          })),
          total: jobs.length
        }
      });
    } catch (error: any) {
      logger.error('Error getting user bulk processing jobs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get jobs'
      });
    }
    return;
  }
);

// Get bulk processing job results
router.get('/jobs/:jobId/results',
  authenticateToken,
  [
    param('jobId').isString().withMessage('Job ID must be a string'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be >= 0'),
    query('status').optional().isIn(['success', 'failed', 'skipped']).withMessage('Invalid status')
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { jobId } = req.params;
      const userId = req.user._id;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const status = req.query.status as string;

      const job = bulkProcessingService.getJob(jobId, userId);

      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'Job not found or access denied'
        });
      }

      let results = job.results;

      // Filter by status if provided
      if (status) {
        results = results.filter(result => result.status === status);
      }

      // Apply pagination
      const paginatedResults = results.slice(offset, offset + limit);

      res.json({
        success: true,
        data: {
          jobId,
          status: job.status,
          total: results.length,
          results: paginatedResults,
          pagination: {
            limit,
            offset,
            hasMore: offset + limit < results.length
          }
        }
      });
    } catch (error: any) {
      logger.error('Error getting bulk processing job results:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get job results'
      });
    }
    return;
  }
);

// Get bulk processing statistics
router.get('/stats', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stats = bulkProcessingService.getStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    logger.error('Error getting bulk processing stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get statistics'
    });
  }
});

// Clean up old jobs (admin only)
router.post('/cleanup',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      bulkProcessingService.cleanupOldJobs();

      res.json({
        success: true,
        message: 'Old bulk processing jobs cleaned up successfully'
      });
    } catch (error: any) {
      logger.error('Error cleaning up bulk processing jobs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cleanup jobs'
      });
    }
  }
);

export default router;