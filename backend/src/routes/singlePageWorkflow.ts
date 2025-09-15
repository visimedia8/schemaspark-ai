import express, { Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { aiSchemaService } from '../services/aiSchemaService';
import { cmsIntegrationService } from '../services/cmsIntegrationService';
import { logger } from '../utils/logger';
const { body } = require('express-validator');

const router = express.Router();

// Single page processing workflow - complete pipeline in one request
router.post('/process',
  authenticateToken,
  [
    body('url').isURL().withMessage('Valid URL is required'),
    body('targetKeywords').optional().isArray().withMessage('Target keywords must be an array'),
    body('targetKeywords.*').optional().isString().withMessage('Keywords must be strings'),
    body('schemaType').optional().isString().withMessage('Schema type must be a string'),
    body('optimize').optional().isBoolean().withMessage('Optimize must be a boolean'),
    body('deployToCMS').optional().isBoolean().withMessage('Deploy to CMS must be a boolean'),
    body('cmsConfig').optional().isObject().withMessage('CMS config must be an object'),
    body('cmsConfig.type').optional().isIn(['wordpress', 'shopify', 'custom']).withMessage('Invalid CMS type'),
    body('cmsConfig.baseUrl').optional().isURL().withMessage('Invalid base URL'),
    body('cmsConfig.username').optional().isLength({ min: 1 }).withMessage('Username required'),
    body('cmsConfig.password').optional().isLength({ min: 1 }).withMessage('Password required'),
    body('cmsConfig.accessToken').optional().isLength({ min: 1 }).withMessage('Access token required'),
    body('cmsConfig.storeDomain').optional().isLength({ min: 1 }).withMessage('Store domain required'),
    body('placement').optional().isIn(['head', 'body', 'footer']).withMessage('Invalid placement')
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        url,
        targetKeywords = [],
        schemaType,
        optimize = true,
        deployToCMS = false,
        cmsConfig,
        placement = 'head'
      } = req.body;

      const userId = req.user._id;

      logger.info('Starting single page processing workflow', {
        userId,
        url,
        targetKeywords,
        schemaType,
        optimize,
        deployToCMS
      });

      const workflowResult = {
        url,
        steps: [] as any[],
        finalResult: null as any,
        errors: [] as string[]
      };

      // Step 1: Generate Schema
      try {
        workflowResult.steps.push({
          step: 'schema_generation',
          status: 'in_progress',
          timestamp: new Date()
        });

        const schemaRequest = {
          url,
          targetKeywords,
          schemaType,
          optimize
        };

        const schemaResult = await aiSchemaService.generateSchema(schemaRequest);

        if (!schemaResult.success) {
          throw new Error(schemaResult.error || 'Schema generation failed');
        }

        workflowResult.steps[0].status = 'completed';
        workflowResult.steps[0].result = schemaResult;

        logger.info('Schema generation completed', {
          userId,
          url,
          schemaType: schemaResult.schema?.['@type']
        });

      } catch (error: any) {
        workflowResult.steps[0].status = 'failed';
        workflowResult.steps[0].error = error.message;
        workflowResult.errors.push(`Schema generation failed: ${error.message}`);

        return res.status(400).json({
          success: false,
          error: 'Schema generation failed',
          workflow: workflowResult
        });
      }

      // Step 2: Deploy to CMS (if requested)
      if (deployToCMS && cmsConfig) {
        try {
          workflowResult.steps.push({
            step: 'cms_deployment',
            status: 'in_progress',
            timestamp: new Date()
          });

          const schemaResult = workflowResult.steps[0].result;
          const deployment = {
            schema: schemaResult.schema,
            targetUrl: url,
            placement,
            cmsConfig
          };

          let deploymentResult;

          switch (cmsConfig.type) {
            case 'wordpress':
              deploymentResult = await cmsIntegrationService.deployToWordPress(deployment);
              break;
            case 'shopify':
              deploymentResult = await cmsIntegrationService.deployToShopify(deployment);
              break;
            case 'custom':
              deploymentResult = await cmsIntegrationService.deployToCustomCMS(deployment);
              break;
            default:
              throw new Error('Unsupported CMS type');
          }

          if (!deploymentResult.success) {
            throw new Error(deploymentResult.error || 'CMS deployment failed');
          }

          workflowResult.steps[1].status = 'completed';
          workflowResult.steps[1].result = deploymentResult;

          logger.info('CMS deployment completed', {
            userId,
            url,
            cmsType: cmsConfig.type,
            deploymentUrl: deploymentResult.deploymentUrl
          });

        } catch (error: any) {
          workflowResult.steps[1].status = 'failed';
          workflowResult.steps[1].error = error.message;
          workflowResult.errors.push(`CMS deployment failed: ${error.message}`);
        }
      }

      // Prepare final result
      const schemaResult = workflowResult.steps[0].result;
      const cmsResult = workflowResult.steps[1]?.result;

      workflowResult.finalResult = {
        schema: schemaResult.schema,
        metadata: schemaResult.metadata,
        deployment: cmsResult ? {
          success: true,
          deploymentUrl: cmsResult.deploymentUrl,
          schemaId: cmsResult.schemaId
        } : null
      };

      const success = workflowResult.errors.length === 0;

      res.json({
        success,
        data: {
          workflow: workflowResult,
          summary: {
            url,
            schemaGenerated: !!schemaResult.schema,
            schemaType: schemaResult.schema?.['@type'],
            deployedToCMS: !!cmsResult,
            cmsType: cmsConfig?.type,
            errors: workflowResult.errors
          }
        }
      });

    } catch (error: any) {
      logger.error('Single page processing workflow error:', error);
      res.status(500).json({
        success: false,
        error: 'Workflow processing failed',
        details: error.message
      });
    }
    return;
  }
);

// Get workflow history for user
router.get('/history', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user._id;

    // This would typically fetch from a database
    // For now, return placeholder data
    res.json({
      success: true,
      data: {
        workflows: [],
        total: 0,
        message: 'Workflow history tracking coming soon'
      }
    });
  } catch (error: any) {
    logger.error('Error fetching workflow history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch workflow history'
    });
  }
});

// Get workflow statistics
router.get('/stats', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // This would typically fetch from a database
    // For now, return placeholder data
    res.json({
      success: true,
      data: {
        totalWorkflows: 0,
        successfulWorkflows: 0,
        failedWorkflows: 0,
        averageProcessingTime: 0,
        popularSchemaTypes: [],
        message: 'Workflow statistics coming soon'
      }
    });
  } catch (error: any) {
    logger.error('Error fetching workflow stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch workflow statistics'
    });
  }
});

export default router;