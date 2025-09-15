import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { Project } from '../models/Project';
import { AutosaveState } from '../models/AutosaveState';
import { logger } from '../utils/logger';

interface AuthenticatedSocket extends Socket {
  user?: any;
  projectId?: string;
}

export const setupSocketHandlers = (io: SocketServer): void => {
  // Authentication middleware for Socket.IO
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      const user = await User.findById(decoded.userId).select('-passwordHash');
      
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    logger.info(`User ${socket.user?.email} connected via WebSocket`);

    // Join project room for real-time updates
    socket.on('join-project', async (projectId: string) => {
      try {
        // Verify user has access to this project
        const project = await Project.findOne({
          _id: projectId,
          ownerID: socket.user._id
        });

        if (!project) {
          socket.emit('error', { message: 'Project not found or access denied' });
          return;
        }

        socket.projectId = projectId;
        socket.join(`project:${projectId}`);
        
        logger.info(`User ${socket.user.email} joined project room: ${projectId}`);
        socket.emit('joined-project', { projectId, projectName: project.projectName });
      } catch (error) {
        logger.error('Error joining project room:', error);
        socket.emit('error', { message: 'Failed to join project' });
      }
    });

    // Real-time autosave status updates
    socket.on('autosave-status', async (data: { projectId: string; status: string }) => {
      try {
        const { projectId, status } = data;
        
        // Broadcast to all users in the project room
        socket.to(`project:${projectId}`).emit('autosave-status-update', {
          status,
          userId: socket.user._id,
          userName: socket.user.email,
          timestamp: new Date()
        });

        logger.debug(`Autosave status update for project ${projectId}: ${status}`);
      } catch (error) {
        logger.error('Error broadcasting autosave status:', error);
      }
    });

    // Real-time collaboration - cursor position
    socket.on('cursor-move', (data: { projectId: string; position: any }) => {
      const { projectId, position } = data;
      
      // Broadcast to other users in the same project
      socket.to(`project:${projectId}`).emit('user-cursor-move', {
        userId: socket.user._id,
        userName: socket.user.email,
        position,
        timestamp: new Date()
      });
    });

    // Real-time collaboration - text selection
    socket.on('text-select', (data: { projectId: string; selection: any }) => {
      const { projectId, selection } = data;
      
      socket.to(`project:${projectId}`).emit('user-text-select', {
        userId: socket.user._id,
        userName: socket.user.email,
        selection,
        timestamp: new Date()
      });
    });

    // Real-time autosave trigger from client
    socket.on('trigger-autosave', async (data: { projectId: string; content: any }) => {
      try {
        const { projectId, content } = data;
        
        // Save to database
        const autosaveState = await AutosaveState.findOneAndUpdate(
          { projectID: projectId, ownerID: socket.user._id },
          {
            draftContent: content,
            lastSavedAt: new Date(),
            $inc: { version: 1 }
          },
          { new: true, upsert: true }
        );

        // Broadcast autosave confirmation
        socket.emit('autosave-complete', {
          success: true,
          version: autosaveState.version,
          savedAt: autosaveState.lastSavedAt
        });

        // Notify other collaborators
        socket.to(`project:${projectId}`).emit('collaborator-saved', {
          userId: socket.user._id,
          userName: socket.user.email,
          timestamp: new Date()
        });

      } catch (error) {
        logger.error('Error in trigger-autosave:', error);
        socket.emit('autosave-complete', {
          success: false,
          error: 'Failed to autosave'
        });
      }
    });

    // Get current autosave status
    socket.on('get-autosave-status', async (projectId: string) => {
      try {
        const autosaveState = await AutosaveState.findOne({
          projectID: projectId,
          ownerID: socket.user._id
        });

        if (autosaveState) {
          socket.emit('autosave-status-response', {
            hasAutosave: true,
            lastSavedAt: autosaveState.lastSavedAt,
            version: autosaveState.version,
            isStale: (autosaveState as any).isStale()
          });
        } else {
          socket.emit('autosave-status-response', {
            hasAutosave: false
          });
        }
      } catch (error) {
        logger.error('Error getting autosave status:', error);
        socket.emit('autosave-status-response', {
          hasAutosave: false,
          error: 'Failed to get autosave status'
        });
      }
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      logger.info(`User ${socket.user?.email} disconnected: ${reason}`);
      
      if (socket.projectId) {
        socket.to(`project:${socket.projectId}`).emit('user-left', {
          userId: socket.user._id,
          userName: socket.user.email,
          timestamp: new Date()
        });
      }
    });

    // Error handling
    socket.on('error', (error) => {
      logger.error('Socket error:', error);
    });
  });

  // Periodic cleanup of stale autosave states
  setInterval(async () => {
    try {
      const deletedCount = await (AutosaveState as any).cleanupStaleStates();
      if (deletedCount > 0) {
        logger.info(`Cleaned up ${deletedCount} stale autosave states`);
      }
    } catch (error) {
      logger.error('Error cleaning up stale autosave states:', error);
    }
  }, 3600000); // Run every hour

  logger.info('Socket.IO autosave handlers initialized');
};