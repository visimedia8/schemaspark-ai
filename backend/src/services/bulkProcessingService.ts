import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { aiSchemaService } from './aiSchemaService';

export interface BulkProcessingJob {
  id: string;
  userId: string;
  urls: string[];
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: {
    total: number;
    completed: number;
    failed: number;
    current: number;
  };
  results: BulkProcessingResult[];
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  options: BulkProcessingOptions;
}

export interface BulkProcessingResult {
  url: string;
  status: 'success' | 'failed' | 'skipped';
  schema?: any;
  error?: string;
  processingTime: number;
  schemaType?: string;
}

export interface BulkProcessingOptions {
  maxConcurrency: number;
  delayBetweenRequests: number;
  skipDuplicates: boolean;
  targetKeywords?: string[];
  schemaTypes?: string[];
  timeout: number;
}

export interface BulkProcessingStats {
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageProcessingTime: number;
}

export class BulkProcessingService extends EventEmitter {
  private static instance: BulkProcessingService;
  private jobs: Map<string, BulkProcessingJob> = new Map();
  private activeJobs: Set<string> = new Set();
  private maxConcurrentJobs: number = 5; // Maximum concurrent bulk jobs
  private maxUrlsPerJob: number = 100; // Maximum URLs per job

  public static getInstance(): BulkProcessingService {
    if (!BulkProcessingService.instance) {
      BulkProcessingService.instance = new BulkProcessingService();
    }
    return BulkProcessingService.instance;
  }

  constructor() {
    super();
    this.setupEventHandlers();
  }

  /**
   * Create a new bulk processing job
   */
  createJob(userId: string, urls: string[], options: Partial<BulkProcessingOptions> = {}): BulkProcessingJob {
    // Validate URLs
    const validUrls = this.validateAndFilterUrls(urls);
    if (validUrls.length === 0) {
      throw new Error('No valid URLs provided');
    }

    if (validUrls.length > this.maxUrlsPerJob) {
      throw new Error(`Too many URLs. Maximum allowed: ${this.maxUrlsPerJob}`);
    }

    // Check user job limits
    const userJobs = Array.from(this.jobs.values()).filter(job => job.userId === userId);
    const activeUserJobs = userJobs.filter(job => ['pending', 'processing'].includes(job.status));

    if (activeUserJobs.length >= 3) {
      throw new Error('Too many active jobs. Please wait for current jobs to complete.');
    }

    const defaultOptions: BulkProcessingOptions = {
      maxConcurrency: 3,
      delayBetweenRequests: 1000,
      skipDuplicates: true,
      timeout: 30000
    };

    const jobOptions = { ...defaultOptions, ...options };

    const job: BulkProcessingJob = {
      id: this.generateJobId(),
      userId,
      urls: validUrls,
      status: 'pending',
      progress: {
        total: validUrls.length,
        completed: 0,
        failed: 0,
        current: 0
      },
      results: [],
      createdAt: new Date(),
      options: jobOptions
    };

    this.jobs.set(job.id, job);
    logger.info('Bulk processing job created', {
      jobId: job.id,
      userId,
      urlCount: validUrls.length
    });

    return job;
  }

  /**
   * Start processing a job
   */
  async startJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    if (job.status !== 'pending') {
      throw new Error('Job is not in pending status');
    }

    // Check if we can start more jobs
    if (this.activeJobs.size >= this.maxConcurrentJobs) {
      throw new Error('Server is at maximum capacity. Please try again later.');
    }

    job.status = 'processing';
    job.startedAt = new Date();
    this.activeJobs.add(jobId);

    logger.info('Bulk processing job started', {
      jobId,
      userId: job.userId,
      urlCount: job.urls.length
    });

    // Start processing in background
    this.processJob(job).catch(error => {
      logger.error('Bulk processing job failed', { jobId, error: error.message });
      this.failJob(jobId, error.message);
    });
  }

  /**
   * Cancel a job
   */
  cancelJob(jobId: string, userId: string): void {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    if (job.userId !== userId) {
      throw new Error('Unauthorized to cancel this job');
    }

    if (job.status === 'completed' || job.status === 'failed') {
      throw new Error('Cannot cancel a completed or failed job');
    }

    job.status = 'cancelled';
    job.completedAt = new Date();

    if (this.activeJobs.has(jobId)) {
      this.activeJobs.delete(jobId);
    }

    this.emit('jobCancelled', job);
    logger.info('Bulk processing job cancelled', { jobId, userId });
  }

  /**
   * Get job status
   */
  getJob(jobId: string, userId: string): BulkProcessingJob | null {
    const job = this.jobs.get(jobId);
    if (!job || job.userId !== userId) {
      return null;
    }
    return job;
  }

  /**
   * Get user's jobs
   */
  getUserJobs(userId: string, limit: number = 10): BulkProcessingJob[] {
    return Array.from(this.jobs.values())
      .filter(job => job.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  /**
   * Get processing statistics
   */
  getStats(): BulkProcessingStats {
    const allJobs = Array.from(this.jobs.values());
    const completedJobs = allJobs.filter(job => job.status === 'completed');
    const failedJobs = allJobs.filter(job => job.status === 'failed');

    const totalProcessingTime = completedJobs.reduce((sum, job) => {
      if (job.startedAt && job.completedAt) {
        return sum + (job.completedAt.getTime() - job.startedAt.getTime());
      }
      return sum;
    }, 0);

    const averageProcessingTime = completedJobs.length > 0
      ? totalProcessingTime / completedJobs.length
      : 0;

    return {
      totalJobs: allJobs.length,
      activeJobs: this.activeJobs.size,
      completedJobs: completedJobs.length,
      failedJobs: failedJobs.length,
      averageProcessingTime
    };
  }

  /**
   * Clean up old jobs (older than 7 days)
   */
  cleanupOldJobs(): void {
    const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    let cleanedCount = 0;

    for (const [jobId, job] of this.jobs.entries()) {
      if (job.createdAt < cutoffDate && job.status !== 'processing') {
        this.jobs.delete(jobId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info('Cleaned up old bulk processing jobs', { count: cleanedCount });
    }
  }

  /**
   * Process a job with concurrency control
   */
  private async processJob(job: BulkProcessingJob): Promise<void> {
    const { urls, options } = job;
    const aiService = aiSchemaService;

    // Process URLs in batches with concurrency control
    const batches = this.chunkArray(urls, options.maxConcurrency);

    for (const batch of batches) {
      if (job.status === 'cancelled') {
        break;
      }

      const promises = batch.map(async (url, index) => {
        const batchIndex = job.progress.current + index;
        job.progress.current = batchIndex;

        try {
          // Check for cancellation
          if (job.status === 'cancelled') {
            return;
          }

          const startTime = Date.now();

          // Process URL - generate schema
          const result = await aiService.generateSchema({
            url,
            targetKeywords: options.targetKeywords,
            optimize: true
          });

          const processingTime = Date.now() - startTime;

          // Store result
          const processingResult: BulkProcessingResult = {
            url,
            status: 'success',
            schema: result.schema,
            processingTime,
            schemaType: result.schema?.['@type']
          };

          job.results.push(processingResult);
          job.progress.completed++;

          this.emit('urlProcessed', { jobId: job.id, result: processingResult });

        } catch (error: any) {
          const processingTime = Date.now() - Date.now();

          const processingResult: BulkProcessingResult = {
            url,
            status: 'failed',
            error: error.message,
            processingTime
          };

          job.results.push(processingResult);
          job.progress.failed++;

          this.emit('urlFailed', { jobId: job.id, result: processingResult });
        }
      });

      // Wait for batch to complete
      await Promise.all(promises);

      // Add delay between batches
      if (options.delayBetweenRequests > 0 && batches.indexOf(batch) < batches.length - 1) {
        await this.delay(options.delayBetweenRequests);
      }
    }

    // Mark job as completed
    job.status = job.progress.failed > 0 && job.progress.completed === 0 ? 'failed' : 'completed';
    job.completedAt = new Date();

    this.activeJobs.delete(job.id);
    this.emit('jobCompleted', job);

    logger.info('Bulk processing job completed', {
      jobId: job.id,
      userId: job.userId,
      completed: job.progress.completed,
      failed: job.progress.failed,
      total: job.progress.total
    });
  }

  /**
   * Mark job as failed
   */
  private failJob(jobId: string, error: string): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = 'failed';
    job.completedAt = new Date();

    if (this.activeJobs.has(jobId)) {
      this.activeJobs.delete(jobId);
    }

    this.emit('jobFailed', { job, error });
  }

  /**
   * Validate and filter URLs
   */
  private validateAndFilterUrls(urls: string[]): string[] {
    const validUrls: string[] = [];

    for (const url of urls) {
      try {
        const urlObj = new URL(url);
        if (['http:', 'https:'].includes(urlObj.protocol)) {
          validUrls.push(url);
        }
      } catch {
        // Invalid URL, skip
        continue;
      }
    }

    return validUrls;
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    return `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Split array into chunks
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.on('jobCompleted', (job: BulkProcessingJob) => {
      logger.info('Bulk processing job completed', {
        jobId: job.id,
        userId: job.userId,
        stats: job.progress
      });
    });

    this.on('jobFailed', ({ job, error }: { job: BulkProcessingJob; error: string }) => {
      logger.error('Bulk processing job failed', {
        jobId: job.id,
        userId: job.userId,
        error
      });
    });

    this.on('urlProcessed', ({ jobId, result }: { jobId: string; result: BulkProcessingResult }) => {
      logger.debug('URL processed in bulk job', {
        jobId,
        url: result.url,
        status: result.status,
        schemaType: result.schemaType
      });
    });

    this.on('urlFailed', ({ jobId, result }: { jobId: string; result: BulkProcessingResult }) => {
      logger.warn('URL failed in bulk job', {
        jobId,
        url: result.url,
        error: result.error
      });
    });
  }
}

export const bulkProcessingService = BulkProcessingService.getInstance();