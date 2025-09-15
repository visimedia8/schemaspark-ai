import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';

// Import routes
import authRoutes from './routes/auth';
import projectRoutes from './routes/projects';
import autosaveRoutes from './routes/autosave';
import aiRoutes from './routes/ai';
import schemaRoutes from './routes/schema';
import integrationRoutes from './routes/integrations';
import cmsRoutes from './routes/cms';
import bulkRoutes from './routes/bulk';
import singlePageWorkflowRoutes from './routes/singlePageWorkflow';
import competitorAnalysisRoutes from './routes/competitorAnalysis';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';

// Import socket handlers
import { setupSocketHandlers } from './sockets/autosave';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const io = new SocketServer(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Constants
const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/schemaspark';

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Too many requests from this IP, please try again later.'
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(limiter);
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  credentials: true
}));
app.use(express.json({ limit: process.env.MAX_FILE_SIZE || '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files
app.use('/uploads', express.static('uploads'));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/autosave', autosaveRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/schema', schemaRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/cms', cmsRoutes);
app.use('/api/bulk', bulkRoutes);
app.use('/api/workflow', singlePageWorkflowRoutes);
app.use('/api/competitor-analysis', competitorAnalysisRoutes);

// Setup socket handlers for real-time autosave
setupSocketHandlers(io);

// Error handling middleware (must be last)
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `The requested route ${req.originalUrl} does not exist.`
  });
});

// Database connection with fallback to in-memory MongoDB
const connectDatabase = async (): Promise<void> => {
  try {
    // First try to connect to the configured MongoDB URI
    await mongoose.connect(MONGODB_URI);
    logger.info('Connected to MongoDB successfully');
  } catch (error) {
    logger.warn('Local MongoDB not available, using in-memory database for development');
    
    try {
      // Fallback to in-memory MongoDB
      const mongod = await MongoMemoryServer.create();
      const memoryUri = mongod.getUri();
      await mongoose.connect(memoryUri);
      logger.info('Connected to in-memory MongoDB successfully');
    } catch (memoryError) {
      logger.error('Failed to connect to any MongoDB instance:', memoryError);
      process.exit(1);
    }
  }
};

// Start the server
connectDatabase()
  .then(() => {
    server.listen(PORT, () => {
      logger.info(`SchemaSpark API server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
      
      // Start background jobs
      require('./jobs/performanceMonitoring').start();
      require('./jobs/driftDetection').start();
    });
  })
  .catch((error) => {
    logger.error('Failed to start server:', error);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT. Starting graceful shutdown...');
  
  try {
    await mongoose.connection.close();
    server.close(() => {
      logger.info('HTTP server closed.');
      process.exit(0);
    });
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM. Starting graceful shutdown...');
  
  try {
    await mongoose.connection.close();
    server.close(() => {
      logger.info('HTTP server closed.');
      process.exit(0);
    });
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
});

export { app, io };