import express, { Response } from 'express';
const { body, param, query } = require('express-validator');
import { AutosaveState } from '../models/AutosaveState';
import { Project } from '../models/Project';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { logger } from '../utils/logger';

const router = express.Router();

// Get autosave status for a project
router.get('/project/:projectId/status', 
  authenticateToken,
  [
    param('projectId').isMongoId().withMessage('Invalid project ID')
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { projectId } = req.params;
      const userId = req.user._id;

      const autosaveState = await AutosaveState.findOne({
        projectID: projectId,
        ownerID: userId
      }).populate('projectID', 'projectName targetURL');

      if (!autosaveState) {
        res.status(404).json({
          success: false,
          message: 'No autosave state found for this project'
        });
      }

      return res.json({
        success: true,
        data: {
          hasAutosave: true,
          lastSavedAt: autosaveState!.lastSavedAt,
          version: autosaveState!.version,
          isStale: (autosaveState as any).isStale(),
          project: autosaveState!.projectID
        }
      });
    } catch (error) {
      logger.error('Error fetching autosave status:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

// Save draft content (manual save)
router.post('/project/:projectId/save',
  authenticateToken,
  [
    param('projectId').isMongoId().withMessage('Invalid project ID'),
    body('draftContent').isObject().withMessage('Draft content must be a valid object'),
    body('version').optional().isInt({ min: 1 }).withMessage('Version must be a positive integer')
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { projectId } = req.params;
      const { draftContent, version } = req.body;
      const userId = req.user._id;

      // Verify project exists and user has access
      const project = await Project.findOne({
        _id: projectId,
        ownerID: userId
      });

      if (!project) {
        res.status(404).json({
          success: false,
          message: 'Project not found or access denied'
        });
      }

      // Create or update autosave state
      const autosaveState = await AutosaveState.findOneAndUpdate(
        { projectID: projectId, ownerID: userId },
        {
          draftContent,
          version: version || 1,
          lastSavedAt: new Date(),
          metadata: {
            userAgent: req.get('User-Agent'),
            ipAddress: req.ip,
            deviceType: req.get('Sec-CH-UA-Platform') || 'unknown',
            browser: req.get('Sec-CH-UA') || 'unknown'
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      // Also update project's current draft
      (project as any).addDraftVersion(draftContent);
      await project!.save();

      return res.json({
        success: true,
        data: {
          autosaveState,
          message: 'Draft saved successfully'
        }
      });
    } catch (error) {
      logger.error('Error saving draft:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to save draft'
      });
    }
  }
);

// Auto-save endpoint (called by frontend at intervals)
router.post('/project/:projectId/autosave',
  authenticateToken,
  [
    param('projectId').isMongoId().withMessage('Invalid project ID'),
    body('draftContent').isObject().withMessage('Draft content must be a valid object')
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { projectId } = req.params;
      const { draftContent } = req.body;
      const userId = req.user._id;

      const autosaveState = await AutosaveState.findOneAndUpdate(
        { projectID: projectId, ownerID: userId },
        {
          draftContent,
          lastSavedAt: new Date(),
          $inc: { version: 1 }
        },
        { new: true, upsert: true }
      );

      return res.json({
        success: true,
        data: {
          savedAt: autosaveState.lastSavedAt,
          version: autosaveState.version
        }
      });
    } catch (error) {
      logger.error('Error during autosave:', error);
      return res.status(500).json({
        success: false,
        message: 'Autosave failed'
      });
    }
  }
);

// Recover autosave content
router.get('/project/:projectId/recover',
  authenticateToken,
  [
    param('projectId').isMongoId().withMessage('Invalid project ID')
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { projectId } = req.params;
      const userId = req.user._id;

      const autosaveState = await AutosaveState.findOne({
        projectID: projectId,
        ownerID: userId
      });

      if (!autosaveState) {
        res.status(404).json({
          success: false,
          message: 'No autosave data found to recover'
        });
      }

      if ((autosaveState as any).isStale()) {
        res.status(410).json({
          success: false,
          message: 'Autosave data is too old to recover (older than 24 hours)'
        });
      }

      return res.json({
        success: true,
        data: {
          draftContent: autosaveState!.draftContent,
          version: autosaveState!.version,
          lastSavedAt: autosaveState!.lastSavedAt
        }
      });
    } catch (error) {
      logger.error('Error recovering autosave:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to recover autosave data'
      });
    }
  }
);

// Get recovery status for a project
router.get('/project/:projectId/recovery-status',
  authenticateToken,
  [
    param('projectId').isMongoId().withMessage('Invalid project ID')
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { projectId } = req.params;
      const userId = req.user._id;

      const autosaveState = await AutosaveState.findOne({
        projectID: projectId,
        ownerID: userId
      });

      const project = await Project.findOne({
        _id: projectId,
        ownerID: userId
      });

      const recoveryStatus = {
        hasAutosave: !!autosaveState,
        canRecover: false,
        lastSavedAt: autosaveState?.lastSavedAt || null,
        version: autosaveState?.version || 0,
        isStale: false,
        draftHistoryCount: project?.draftHistory?.length || 0,
        metadata: autosaveState?.metadata || null
      };

      if (autosaveState) {
        recoveryStatus.canRecover = !(autosaveState as any).isStale();
        recoveryStatus.isStale = (autosaveState as any).isStale();
      }

      return res.json({
        success: true,
        data: recoveryStatus
      });
    } catch (error) {
      logger.error('Error getting recovery status:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get recovery status'
      });
    }
  }
);

// Clear autosave data for a project
router.delete('/project/:projectId/autosave',
  authenticateToken,
  [
    param('projectId').isMongoId().withMessage('Invalid project ID')
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { projectId } = req.params;
      const userId = req.user._id;

      const result = await AutosaveState.findOneAndDelete({
        projectID: projectId,
        ownerID: userId
      });

      if (!result) {
        return res.status(404).json({
          success: false,
          message: 'No autosave data found to clear'
        });
      }

      return res.json({
        success: true,
        message: 'Autosave data cleared successfully',
        data: {
          clearedAt: new Date(),
          projectId
        }
      });
    } catch (error) {
      logger.error('Error clearing autosave:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to clear autosave data'
      });
    }
  }
);

// Get autosave history for a project
router.get('/project/:projectId/history',
  authenticateToken,
  [
    param('projectId').isMongoId().withMessage('Invalid project ID'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { projectId } = req.params;
      const { limit = 10 } = req.query;
      const userId = req.user._id;

      const project = await Project.findOne({
        _id: projectId,
        ownerID: userId
      }).populate('draftHistory');

      if (!project) {
        res.status(404).json({
          success: false,
          message: 'Project not found or access denied'
        });
      }

      const history = (project as any).getDraftHistory(Number(limit));

      return res.json({
        success: true,
        data: {
          history,
          total: project!.draftHistory.length,
          currentVersion: project!.currentDraft?.version
        }
      });
    } catch (error) {
      logger.error('Error fetching autosave history:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch autosave history'
      });
    }
  }
);

// Restore specific version
router.post('/project/:projectId/restore/:version',
  authenticateToken,
  [
    param('projectId').isMongoId().withMessage('Invalid project ID'),
    param('version').isInt({ min: 1 }).withMessage('Version must be a positive integer')
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { projectId, version } = req.params;
      const userId = req.user._id;

      const project = await Project.findOne({
        _id: projectId,
        ownerID: userId
      });

      if (!project) {
        res.status(404).json({
          success: false,
          message: 'Project not found or access denied'
        });
      }

      const success = (project as any).restoreDraftVersion(Number(version));
      
      if (!success) {
        res.status(404).json({
          success: false,
          message: 'Version not found in history'
        });
      }

      await project!.save();

      return res.json({
        success: true,
        data: {
          message: `Version ${version} restored successfully`,
          currentDraft: project!.currentDraft
        }
      });
    } catch (error) {
      logger.error('Error restoring version:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to restore version'
      });
    }
  }
);

// Configure autosave settings
router.put('/project/:projectId/settings',
  authenticateToken,
  [
    param('projectId').isMongoId().withMessage('Invalid project ID'),
    body('autosaveEnabled').optional().isBoolean().withMessage('autosaveEnabled must be a boolean'),
    body('saveFrequency').optional().isInt({ min: 5, max: 300 }).withMessage('Save frequency must be between 5 and 300 seconds')
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { projectId } = req.params;
      const { autosaveEnabled, saveFrequency } = req.body;
      const userId = req.user._id;

      const project = await Project.findOne({
        _id: projectId,
        ownerID: userId
      });

      if (!project) {
        res.status(404).json({
          success: false,
          message: 'Project not found or access denied'
        });
      }

      if (autosaveEnabled !== undefined) {
        project!.autosaveEnabled = autosaveEnabled;
      }

      await project!.save();

      // Also update autosave state settings
      await AutosaveState.findOneAndUpdate(
        { projectID: projectId, ownerID: userId },
        { 
          saveFrequency: saveFrequency || 30,
          isRecoverable: autosaveEnabled !== false
        },
        { upsert: true }
      );

      return res.json({
        success: true,
        data: {
          message: 'Autosave settings updated successfully',
          settings: {
            autosaveEnabled: project!.autosaveEnabled,
            saveFrequency: saveFrequency || 30
          }
        }
      });
    } catch (error) {
      logger.error('Error updating autosave settings:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update autosave settings'
      });
    }
  }
);

// Compare two versions
router.get('/project/:projectId/compare/:version1/:version2',
  authenticateToken,
  [
    param('projectId').isMongoId().withMessage('Invalid project ID'),
    param('version1').isInt({ min: 1 }).withMessage('Version1 must be a positive integer'),
    param('version2').isInt({ min: 1 }).withMessage('Version2 must be a positive integer')
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { projectId, version1, version2 } = req.params;
      const userId = req.user._id;

      const project = await Project.findOne({
        _id: projectId,
        ownerID: userId
      });

      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found or access denied'
        });
      }

      const comparison = (project as any).compareVersions(
        Number(version1),
        Number(version2)
      );

      if (!comparison) {
        return res.status(404).json({
          success: false,
          message: 'One or both versions not found'
        });
      }

      return res.json({
        success: true,
        data: comparison
      });
    } catch (error) {
      logger.error('Error comparing versions:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to compare versions'
      });
    }
  }
);

// Tag a version
router.post('/project/:projectId/tag/:version',
  authenticateToken,
  [
    param('projectId').isMongoId().withMessage('Invalid project ID'),
    param('version').isInt({ min: 1 }).withMessage('Version must be a positive integer'),
    body('tags').isArray().withMessage('Tags must be an array'),
    body('tags.*').isString().withMessage('Each tag must be a string')
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { projectId, version } = req.params;
      const { tags } = req.body;
      const userId = req.user._id;

      const project = await Project.findOne({
        _id: projectId,
        ownerID: userId
      });

      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found or access denied'
        });
      }

      const success = (project as any).tagVersion(Number(version), tags);

      if (!success) {
        return res.status(404).json({
          success: false,
          message: 'Version not found'
        });
      }

      await project.save();

      return res.json({
        success: true,
        message: `Version ${version} tagged successfully`,
        data: {
          version: Number(version),
          tags
        }
      });
    } catch (error) {
      logger.error('Error tagging version:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to tag version'
      });
    }
  }
);

// Search versions
router.get('/project/:projectId/search',
  authenticateToken,
  [
    param('projectId').isMongoId().withMessage('Invalid project ID'),
    query('tags').optional().isString().withMessage('Tags must be a string'),
    query('author').optional().isString().withMessage('Author must be a string'),
    query('dateFrom').optional().isISO8601().withMessage('Invalid date format'),
    query('dateTo').optional().isISO8601().withMessage('Invalid date format'),
    query('content').optional().isString().withMessage('Content must be a string')
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { projectId } = req.params;
      const { tags, author, dateFrom, dateTo, content } = req.query;
      const userId = req.user._id;

      const project = await Project.findOne({
        _id: projectId,
        ownerID: userId
      });

      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found or access denied'
        });
      }

      const query: any = {};

      if (tags && typeof tags === 'string') {
        query.tags = tags.split(',').map((tag: string) => tag.trim());
      }

      if (author) {
        query.author = author;
      }

      if (dateFrom && typeof dateFrom === 'string') {
        query.dateFrom = new Date(dateFrom);
      }

      if (dateTo && typeof dateTo === 'string') {
        query.dateTo = new Date(dateTo);
      }

      if (content) {
        query.content = content;
      }

      const results = (project as any).searchVersions(query);

      return res.json({
        success: true,
        data: {
          results,
          count: results.length,
          query
        }
      });
    } catch (error) {
      logger.error('Error searching versions:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to search versions'
      });
    }
  }
);

// Get version statistics
router.get('/project/:projectId/stats',
  authenticateToken,
  [
    param('projectId').isMongoId().withMessage('Invalid project ID')
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { projectId } = req.params;
      const userId = req.user._id;

      const project = await Project.findOne({
        _id: projectId,
        ownerID: userId
      });

      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found or access denied'
        });
      }

      const stats = (project as any).getVersionStats();

      return res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Error getting version stats:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get version statistics'
      });
    }
  }
);

// Export version history
router.get('/project/:projectId/export',
  authenticateToken,
  [
    param('projectId').isMongoId().withMessage('Invalid project ID'),
    query('format').optional().isIn(['json', 'csv']).withMessage('Format must be json or csv'),
    query('versions').optional().isString().withMessage('Versions must be a string'),
    query('includeContent').optional().isBoolean().withMessage('includeContent must be a boolean')
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { projectId } = req.params;
      const { format = 'json', versions, includeContent = false } = req.query;
      const userId = req.user._id;

      const project = await Project.findOne({
        _id: projectId,
        ownerID: userId
      });

      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found or access denied'
        });
      }

      const options: any = {
        format,
        includeContent: includeContent === 'true'
      };

      if (versions && typeof versions === 'string') {
        options.versions = versions.split(',').map((v: string) => parseInt(v.trim()));
      }

      const exportData = (project as any).exportVersions(options);

      if (format === 'csv') {
        const csvContent = [
          'version,createdAt,author,tags,size,content',
          ...exportData.map((row: any) =>
            `"${row.version}","${row.createdAt}","${row.author}","${row.tags}","${row.size}","${row.content}"`
          )
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="project-${projectId}-versions.csv"`);
        return res.send(csvContent);
      }

      return res.json({
        success: true,
        data: exportData
      });
    } catch (error) {
      logger.error('Error exporting versions:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to export versions'
      });
    }
  }
);

export default router;