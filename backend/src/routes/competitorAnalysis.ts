import express, { Response } from 'express';
const { body, param, query } = require('express-validator');
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { logger } from '../utils/logger';
import { serpAnalysisService } from '../services/serpAnalysisService';
import { enhancedAIService } from '../services/enhancedAIService';

const router = express.Router();

/**
 * GET /api/competitor-analysis/:keyword
 * Analyze SERP for a keyword and return competitor data
 */
router.get('/keyword/:keyword',
  authenticateToken,
  [
    param('keyword').isLength({ min: 2, max: 100 }).withMessage('Keyword must be 2-100 characters'),
    query('location').optional().isLength({ min: 2, max: 50 }).withMessage('Location must be 2-50 characters'),
    query('num').optional().isInt({ min: 1, max: 20 }).withMessage('Number of results must be 1-20')
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { keyword } = req.params;
      const { location = 'United States', num = 10 } = req.query;

      logger.info(`Analyzing SERP for keyword: ${keyword}`);

      const analysis = await serpAnalysisService.analyzeKeyword(keyword, {
        location: location as string,
        num: parseInt(num as string)
      });

      res.json({
        success: true,
        data: analysis,
        message: `Found ${analysis.results.length} competitors for "${keyword}"`
      });

    } catch (error: any) {
      logger.error('SERP analysis error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to analyze SERP',
        error: error.message
      });
    }
  }
);

/**
 * GET /api/competitor-analysis/:keyword/gaps
 * Analyze schema gaps between target URL and competitors
 */
router.get('/keyword/:keyword/gaps',
  authenticateToken,
  [
    param('keyword').isLength({ min: 2, max: 100 }).withMessage('Keyword must be 2-100 characters'),
    query('targetUrl').isURL().withMessage('Target URL must be a valid URL'),
    query('location').optional().isLength({ min: 2, max: 50 }).withMessage('Location must be 2-50 characters')
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { keyword } = req.params;
      const { targetUrl, location = 'United States' } = req.query;

      logger.info(`Analyzing schema gaps for keyword: ${keyword}, target: ${targetUrl}`);

      // Get SERP analysis first
      const serpAnalysis = await serpAnalysisService.analyzeKeyword(keyword, {
        location: location as string
      });

      // Analyze schema gaps
      const schemaGaps = await serpAnalysisService.analyzeSchemaGaps(
        keyword,
        targetUrl as string,
        serpAnalysis.results
      );

      res.json({
        success: true,
        data: {
          serpAnalysis,
          schemaGaps,
          summary: {
            competitorsAnalyzed: serpAnalysis.results.length,
            missingSchemas: schemaGaps.missingSchemas.length,
            opportunityScore: schemaGaps.opportunityScore
          }
        }
      });

    } catch (error: any) {
      logger.error('Schema gap analysis error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to analyze schema gaps',
        error: error.message
      });
    }
  }
);

/**
 * POST /api/competitor-analysis/generate
 * Generate interconnected schema based on competitor analysis
 */
router.post('/generate',
  authenticateToken,
  [
    body('keyword').isLength({ min: 2, max: 100 }).withMessage('Keyword must be 2-100 characters'),
    body('targetUrl').isURL().withMessage('Target URL must be a valid URL'),
    body('brandVoice').optional().isLength({ min: 10, max: 500 }).withMessage('Brand voice must be 10-500 characters'),
    body('keyFeatures').optional().isArray().withMessage('Key features must be an array'),
    body('location').optional().isLength({ min: 2, max: 50 }).withMessage('Location must be 2-50 characters')
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        keyword,
        targetUrl,
        brandVoice,
        keyFeatures,
        location = 'United States'
      } = req.body;

      logger.info(`Generating interconnected schema for keyword: ${keyword}`);

      // Get competitor analysis
      const serpAnalysis = await serpAnalysisService.analyzeKeyword(keyword, { location });
      const schemaGaps = await serpAnalysisService.analyzeSchemaGaps(keyword, targetUrl, serpAnalysis.results);

      // Generate enhanced schema
      const generationResult = await enhancedAIService.generateInterconnectedSchema({
        keyword,
        targetUrl,
        brandVoice,
        keyFeatures,
        competitors: serpAnalysis.results,
        schemaGaps
      });

      res.json({
        success: true,
        data: {
          ...generationResult,
          competitorAnalysis: {
            competitorsFound: serpAnalysis.results.length,
            schemaGaps: schemaGaps.missingSchemas,
            opportunityScore: schemaGaps.opportunityScore
          }
        },
        message: `Generated interconnected schema with ${generationResult.individualSchemas.length} entities`
      });

    } catch (error: any) {
      logger.error('Enhanced schema generation error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate interconnected schema',
        error: error.message
      });
    }
  }
);

/**
 * GET /api/competitor-analysis/report/:keyword
 * Get comprehensive competitor analysis report
 */
router.get('/report/:keyword',
  authenticateToken,
  [
    param('keyword').isLength({ min: 2, max: 100 }).withMessage('Keyword must be 2-100 characters'),
    query('targetUrl').isURL().withMessage('Target URL must be a valid URL'),
    query('location').optional().isLength({ min: 2, max: 50 }).withMessage('Location must be 2-50 characters')
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { keyword } = req.params;
      const { targetUrl, location = 'United States' } = req.query;

      logger.info(`Generating comprehensive competitor report for: ${keyword}`);

      const report = await serpAnalysisService.getCompetitorAnalysisReport(
        keyword,
        targetUrl as string
      );

      res.json({
        success: true,
        data: report,
        message: 'Competitor analysis report generated successfully'
      });

    } catch (error: any) {
      logger.error('Competitor report generation error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate competitor report',
        error: error.message
      });
    }
  }
);

/**
 * GET /api/competitor-analysis/schemas/essential
 * Get list of essential schema types for SEO
 */
router.get('/schemas/essential',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const essentialSchemas = [
        {
          type: 'Organization',
          description: 'Basic business/brand information',
          seoBenefit: 'Knowledge panel eligibility',
          priority: 'High'
        },
        {
          type: 'WebSite',
          description: 'Website structure and navigation',
          seoBenefit: 'Sitelink search box',
          priority: 'High'
        },
        {
          type: 'WebPage',
          description: 'Individual page information',
          seoBenefit: 'Enhanced search results',
          priority: 'High'
        },
        {
          type: 'Article',
          description: 'Blog posts and articles',
          seoBenefit: 'Article rich snippets',
          priority: 'High'
        },
        {
          type: 'Product',
          description: 'Product information',
          seoBenefit: 'Product rich snippets',
          priority: 'Medium'
        },
        {
          type: 'Service',
          description: 'Service offerings',
          seoBenefit: 'Service rich snippets',
          priority: 'Medium'
        },
        {
          type: 'LocalBusiness',
          description: 'Local business information',
          seoBenefit: 'Local pack and maps',
          priority: 'Medium'
        },
        {
          type: 'FAQPage',
          description: 'Frequently asked questions',
          seoBenefit: 'FAQ rich snippets',
          priority: 'High'
        },
        {
          type: 'HowTo',
          description: 'Step-by-step instructions',
          seoBenefit: 'How-to rich snippets',
          priority: 'Medium'
        },
        {
          type: 'Review',
          description: 'Customer reviews and ratings',
          seoBenefit: 'Review rich snippets',
          priority: 'Medium'
        }
      ];

      res.json({
        success: true,
        data: essentialSchemas,
        message: 'Essential schema types retrieved successfully'
      });

    } catch (error: any) {
      logger.error('Essential schemas retrieval error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve essential schemas',
        error: error.message
      });
    }
  }
);

export default router;