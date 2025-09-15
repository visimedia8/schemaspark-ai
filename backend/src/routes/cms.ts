import express, { Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { cmsIntegrationService } from '../services/cmsIntegrationService';
import { logger } from '../utils/logger';
const { body } = require('express-validator');

const router = express.Router();

// Get supported CMS types
router.get('/types', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const cmsTypes = cmsIntegrationService.getSupportedCMSTypes();

    res.json({
      success: true,
      data: cmsTypes
    });
  } catch (error: any) {
    logger.error('Error fetching CMS types:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch CMS types'
    });
  }
});

// Test CMS connection
router.post('/test-connection',
  authenticateToken,
  [
    body('type').isIn(['wordpress', 'shopify', 'custom']).withMessage('Invalid CMS type'),
    body('baseUrl').optional().isURL().withMessage('Invalid base URL'),
    body('username').optional().isLength({ min: 1 }).withMessage('Username required'),
    body('password').optional().isLength({ min: 1 }).withMessage('Password required'),
    body('accessToken').optional().isLength({ min: 1 }).withMessage('Access token required'),
    body('storeDomain').optional().isLength({ min: 1 }).withMessage('Store domain required')
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { type, baseUrl, username, password, accessToken, storeDomain } = req.body;

      const config = {
        type,
        baseUrl,
        username,
        password,
        accessToken,
        storeDomain
      };

      const result = await cmsIntegrationService.testConnection(config);

      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      logger.error('Error testing CMS connection:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to test CMS connection'
      });
    }
  }
);

// Deploy schema to CMS
router.post('/deploy',
  authenticateToken,
  [
    body('schema').isObject().withMessage('Schema must be a valid object'),
    body('targetUrl').isURL().withMessage('Target URL must be valid'),
    body('placement').isIn(['head', 'body', 'footer']).withMessage('Invalid placement'),
    body('cmsConfig.type').isIn(['wordpress', 'shopify', 'custom']).withMessage('Invalid CMS type'),
    body('cmsConfig.baseUrl').optional().isURL().withMessage('Invalid base URL'),
    body('cmsConfig.username').optional().isLength({ min: 1 }).withMessage('Username required'),
    body('cmsConfig.password').optional().isLength({ min: 1 }).withMessage('Password required'),
    body('cmsConfig.accessToken').optional().isLength({ min: 1 }).withMessage('Access token required'),
    body('cmsConfig.storeDomain').optional().isLength({ min: 1 }).withMessage('Store domain required')
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { schema, targetUrl, placement, cmsConfig } = req.body;
      const userId = req.user._id;

      logger.info('Deploying schema to CMS', {
        userId,
        cmsType: cmsConfig.type,
        targetUrl,
        schemaType: schema['@type']
      });

      const deployment = {
        schema,
        targetUrl,
        placement,
        cmsConfig
      };

      let result;

      switch (cmsConfig.type) {
        case 'wordpress':
          result = await cmsIntegrationService.deployToWordPress(deployment);
          break;
        case 'shopify':
          result = await cmsIntegrationService.deployToShopify(deployment);
          break;
        case 'custom':
          result = await cmsIntegrationService.deployToCustomCMS(deployment);
          break;
        default:
          return res.status(400).json({
            success: false,
            error: 'Unsupported CMS type'
          });
      }

      if (result.success) {
        logger.info('Schema deployment successful', {
          userId,
          deploymentUrl: result.deploymentUrl,
          schemaId: result.schemaId
        });

        res.json({
          success: true,
          data: result
        });
      } else {
        logger.warn('Schema deployment failed', {
          userId,
          error: result.error
        });

        res.status(400).json({
          success: false,
          error: result.message,
          details: result.error
        });
      }
    } catch (error: any) {
      logger.error('Error deploying schema to CMS:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to deploy schema to CMS'
      });
    }
    return;
  }
);

// Validate CMS configuration
router.post('/validate-config',
  authenticateToken,
  [
    body('type').isIn(['wordpress', 'shopify', 'custom']).withMessage('Invalid CMS type'),
    body('baseUrl').optional().isURL().withMessage('Invalid base URL'),
    body('username').optional().isLength({ min: 1 }).withMessage('Username required'),
    body('password').optional().isLength({ min: 1 }).withMessage('Password required'),
    body('accessToken').optional().isLength({ min: 1 }).withMessage('Access token required'),
    body('storeDomain').optional().isLength({ min: 1 }).withMessage('Store domain required')
  ],
  validateRequest,
  (req: AuthenticatedRequest, res: Response) => {
    try {
      const config = req.body;
      const validation = cmsIntegrationService.validateCMSConfig(config);

      res.json({
        success: true,
        data: validation
      });
    } catch (error: any) {
      logger.error('Error validating CMS config:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to validate CMS configuration'
      });
    }
  }
);

// Get deployment history (placeholder for future implementation)
router.get('/deployments', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  // This would typically fetch from a database
  // For now, return empty array
  res.json({
    success: true,
    data: {
      deployments: [],
      total: 0
    }
  });
});

export default router;