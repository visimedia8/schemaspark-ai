import express, { Response } from 'express';
const { body, param, query } = require('express-validator');
import { aiSchemaService } from '../services/aiSchemaService';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { logger } from '../utils/logger';

const router = express.Router();

// Generate schema from URL
router.post('/generate/url',
  authenticateToken,
  [
    body('url').isURL().withMessage('Valid URL is required'),
    body('targetKeywords').optional().isArray().withMessage('Keywords must be an array'),
    body('targetKeywords.*').optional().isString().withMessage('Each keyword must be a string'),
    body('optimize').optional().isBoolean().withMessage('Optimize must be a boolean')
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { url, targetKeywords, optimize } = req.body;
      const userId = req.user._id;

      logger.info('AI schema generation from URL requested', {
        userId,
        url,
        keywordsCount: targetKeywords?.length || 0
      });

      const result = await aiSchemaService.generateSchema({
        url,
        targetKeywords,
        optimize
      });

      if (result.success) {
        return res.json({
          success: true,
          data: {
            schema: result.schema,
            metadata: result.metadata
          }
        });
      } else {
        return res.status(400).json({
          success: false,
          error: result.error,
          metadata: result.metadata
        });
      }

    } catch (error: any) {
      logger.error('AI schema generation error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to generate schema',
        message: error.message
      });
    }
  }
);

// Generate schema from content
router.post('/generate/content',
  authenticateToken,
  [
    body('content').isString().isLength({ min: 10 }).withMessage('Content must be at least 10 characters'),
    body('targetKeywords').optional().isArray().withMessage('Keywords must be an array'),
    body('targetKeywords.*').optional().isString().withMessage('Each keyword must be a string'),
    body('schemaType').optional().isString().withMessage('Schema type must be a string'),
    body('optimize').optional().isBoolean().withMessage('Optimize must be a boolean')
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { content, targetKeywords, schemaType, optimize } = req.body;
      const userId = req.user._id;

      logger.info('AI schema generation from content requested', {
        userId,
        contentLength: content.length,
        keywordsCount: targetKeywords?.length || 0,
        schemaType
      });

      const result = await aiSchemaService.generateSchema({
        content,
        targetKeywords,
        schemaType,
        optimize
      });

      if (result.success) {
        return res.json({
          success: true,
          data: {
            schema: result.schema,
            metadata: result.metadata
          }
        });
      } else {
        return res.status(400).json({
          success: false,
          error: result.error,
          metadata: result.metadata
        });
      }

    } catch (error: any) {
      logger.error('AI schema generation from content error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to generate schema from content',
        message: error.message
      });
    }
  }
);

// Analyze content for schema generation
router.post('/analyze',
  authenticateToken,
  [
    body('url').isURL().withMessage('Valid URL is required')
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { url } = req.body;
      const userId = req.user._id;

      logger.info('Content analysis requested', { userId, url });

      const analysis = await aiSchemaService.analyzeContent(url);

      return res.json({
        success: true,
        data: analysis
      });

    } catch (error: any) {
      logger.error('Content analysis error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to analyze content',
        message: error.message
      });
    }
  }
);

// Optimize existing schema
router.post('/optimize',
  authenticateToken,
  [
    body('schema').isObject().withMessage('Schema must be a valid object'),
    body('content').isString().isLength({ min: 10 }).withMessage('Content must be at least 10 characters')
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { schema, content } = req.body;
      const userId = req.user._id;

      logger.info('Schema optimization requested', { userId });

      const result = await aiSchemaService.optimizeExistingSchema(schema, content);

      if (result.success) {
        return res.json({
          success: true,
          data: {
            schema: result.schema,
            metadata: result.metadata
          }
        });
      } else {
        return res.status(400).json({
          success: false,
          error: result.error,
          metadata: result.metadata
        });
      }

    } catch (error: any) {
      logger.error('Schema optimization error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to optimize schema',
        message: error.message
      });
    }
  }
);

// Batch generate schemas
router.post('/batch',
  authenticateToken,
  [
    body('urls').isArray().isLength({ min: 1, max: 50 }).withMessage('URLs array must contain 1-50 URLs'),
    body('urls.*').isURL().withMessage('Each URL must be valid'),
    body('targetKeywords').optional().isArray().withMessage('Keywords must be an array'),
    body('targetKeywords.*').optional().isString().withMessage('Each keyword must be a string'),
    body('optimize').optional().isBoolean().withMessage('Optimize must be a boolean'),
    body('concurrency').optional().isInt({ min: 1, max: 10 }).withMessage('Concurrency must be between 1-10')
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { urls, targetKeywords, optimize, concurrency } = req.body;
      const userId = req.user._id;

      logger.info('Batch schema generation requested', {
        userId,
        urlsCount: urls.length,
        concurrency: concurrency || 3
      });

      const results = await aiSchemaService.batchGenerateSchemas(urls, {
        targetKeywords,
        optimize,
        concurrency
      });

      const successful = results.filter(r => r.success).length;
      const failed = results.length - successful;

      return res.json({
        success: true,
        data: {
          results,
          summary: {
            total: results.length,
            successful,
            failed,
            successRate: Math.round((successful / results.length) * 100)
          }
        }
      });

    } catch (error: any) {
      logger.error('Batch schema generation error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to process batch request',
        message: error.message
      });
    }
  }
);

// Get AI service status
router.get('/status',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user._id;

      logger.info('AI service status requested', { userId });

      const status = await aiSchemaService.getServiceStatus();

      return res.json({
        success: true,
        data: status
      });

    } catch (error: any) {
      logger.error('AI service status error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get service status',
        message: error.message
      });
    }
  }
);

// Get supported schema types
router.get('/schema-types',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const schemaTypes = [
        {
          type: 'Article',
          description: 'News articles, blog posts, and editorial content',
          properties: ['headline', 'author', 'datePublished', 'image', 'publisher']
        },
        {
          type: 'Product',
          description: 'E-commerce products and services',
          properties: ['name', 'description', 'image', 'offers', 'brand', 'aggregateRating']
        },
        {
          type: 'Organization',
          description: 'Businesses, companies, and organizations',
          properties: ['name', 'url', 'logo', 'contactPoint', 'sameAs']
        },
        {
          type: 'LocalBusiness',
          description: 'Local businesses with physical locations',
          properties: ['name', 'address', 'telephone', 'openingHours', 'priceRange']
        },
        {
          type: 'Event',
          description: 'Events, conferences, and gatherings',
          properties: ['name', 'startDate', 'endDate', 'location', 'description', 'offers']
        },
        {
          type: 'Recipe',
          description: 'Cooking recipes and instructions',
          properties: ['name', 'author', 'datePublished', 'description', 'recipeIngredient', 'recipeInstructions']
        },
        {
          type: 'FAQ',
          description: 'Frequently asked questions pages',
          properties: ['name', 'mainEntity']
        },
        {
          type: 'HowTo',
          description: 'How-to guides and tutorials',
          properties: ['name', 'description', 'step', 'supply', 'tool']
        }
      ];

      return res.json({
        success: true,
        data: schemaTypes
      });

    } catch (error: any) {
      logger.error('Schema types retrieval error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve schema types'
      });
    }
  }
);

export default router;