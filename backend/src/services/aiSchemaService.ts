import { deepSeekService } from './deepseekService';
import { firecrawlService } from './firecrawlService';
import { logger } from '../utils/logger';

export interface SchemaGenerationRequest {
  url?: string;
  content?: string;
  targetKeywords?: string[];
  schemaType?: string;
  optimize?: boolean;
}

export interface SchemaGenerationResponse {
  success: boolean;
  schema?: any;
  metadata?: {
    source: string;
    url?: string;
    keywords?: string[];
    generationTime: number;
    tokensUsed?: number;
    model?: string;
  };
  error?: string;
}

export interface ContentAnalysisResult {
  title: string;
  description: string;
  content: string;
  keywords: string[];
  images: string[];
  links: string[];
  structuredData?: any;
  analysis: {
    wordCount: number;
    readingTime: number;
    sentiment: 'positive' | 'neutral' | 'negative';
    topics: string[];
    entities: string[];
  };
}

export class AISchemaService {
  async generateSchema(request: SchemaGenerationRequest): Promise<SchemaGenerationResponse> {
    const startTime = Date.now();

    try {
      let content = request.content;
      let extractedKeywords: string[] = [];
      let url = request.url;

      // If URL is provided, scrape content first
      if (request.url && !request.content) {
        logger.info('Scraping content from URL', { url: request.url });

        const scrapedContent = await firecrawlService.extractContentForSchema(request.url);
        content = scrapedContent.content;
        extractedKeywords = scrapedContent.keywords;

        // Merge with provided keywords
        const allKeywords = [...new Set([...extractedKeywords, ...(request.targetKeywords || [])])];

        logger.info('Content scraped successfully', {
          url: request.url,
          contentLength: content.length,
          keywordsFound: extractedKeywords.length
        });
      }

      if (!content) {
        throw new Error('No content provided for schema generation');
      }

      // Use provided keywords or extracted ones
      const keywords = request.targetKeywords || extractedKeywords;

      logger.info('Generating schema with AI', {
        contentLength: content.length,
        keywordsCount: keywords.length,
        optimize: request.optimize
      });

      // Generate schema using DeepSeek
      const result = await deepSeekService.generateSchema(content, keywords);

      // Optionally optimize the generated schema
      let finalSchema = result.schema;
      if (request.optimize) {
        logger.info('Optimizing generated schema');
        const optimization = await deepSeekService.optimizeSchema(finalSchema, content);
        finalSchema = optimization.schema;
      }

      const generationTime = Date.now() - startTime;

      logger.info('Schema generation completed', {
        generationTime,
        tokensUsed: result.metadata.tokens,
        schemaType: finalSchema['@type']
      });

      return {
        success: true,
        schema: finalSchema,
        metadata: {
          source: 'ai-generated',
          url,
          keywords,
          generationTime,
          tokensUsed: result.metadata.tokens.total_tokens,
          model: result.metadata.model
        }
      };

    } catch (error: any) {
      logger.error('AI schema generation error:', error);

      return {
        success: false,
        error: error.message,
        metadata: {
          source: 'error',
          url: request.url,
          generationTime: Date.now() - startTime
        }
      };
    }
  }

  async analyzeContent(url: string): Promise<ContentAnalysisResult> {
    try {
      logger.info('Analyzing content for schema generation', { url });

      const scrapedContent = await firecrawlService.extractContentForSchema(url);

      // Perform basic content analysis
      const analysis = this.performContentAnalysis(scrapedContent.content);

      const result: ContentAnalysisResult = {
        ...scrapedContent,
        analysis
      };

      logger.info('Content analysis completed', {
        url,
        wordCount: analysis.wordCount,
        topicsCount: analysis.topics.length
      });

      return result;

    } catch (error: any) {
      logger.error('Content analysis error:', error);
      throw new Error(`Failed to analyze content: ${error.message}`);
    }
  }

  async optimizeExistingSchema(schema: any, content: string): Promise<SchemaGenerationResponse> {
    const startTime = Date.now();

    try {
      logger.info('Optimizing existing schema');

      const result = await deepSeekService.optimizeSchema(schema, content);

      const generationTime = Date.now() - startTime;

      logger.info('Schema optimization completed', {
        generationTime,
        tokensUsed: result.metadata.tokens.total_tokens
      });

      return {
        success: true,
        schema: result.schema,
        metadata: {
          source: 'ai-optimized',
          generationTime,
          tokensUsed: result.metadata.tokens.total_tokens,
          model: result.metadata.model
        }
      };

    } catch (error: any) {
      logger.error('Schema optimization error:', error);

      return {
        success: false,
        error: error.message,
        metadata: {
          source: 'optimization-error',
          generationTime: Date.now() - startTime
        }
      };
    }
  }

  async batchGenerateSchemas(urls: string[], options?: {
    targetKeywords?: string[];
    optimize?: boolean;
    concurrency?: number;
  }): Promise<SchemaGenerationResponse[]> {
    const concurrency = options?.concurrency || 3;
    const results: SchemaGenerationResponse[] = [];

    logger.info('Starting batch schema generation', {
      urlsCount: urls.length,
      concurrency
    });

    // Process URLs in batches to respect rate limits
    for (let i = 0; i < urls.length; i += concurrency) {
      const batch = urls.slice(i, i + concurrency);

      const batchPromises = batch.map(url =>
        this.generateSchema({
          url,
          targetKeywords: options?.targetKeywords,
          optimize: options?.optimize
        })
      );

      const batchResults = await Promise.allSettled(batchPromises);

      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            success: false,
            error: result.reason.message,
            metadata: {
              source: 'batch-error',
              url: batch[index],
              generationTime: 0
            }
          });
        }
      });

      // Small delay between batches to be respectful to APIs
      if (i + concurrency < urls.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const successCount = results.filter(r => r.success).length;
    logger.info('Batch schema generation completed', {
      total: urls.length,
      successful: successCount,
      failed: urls.length - successCount
    });

    return results;
  }

  private performContentAnalysis(content: string): ContentAnalysisResult['analysis'] {
    // Basic content analysis - in production, you'd use NLP libraries
    const words = content.split(/\s+/).filter(word => word.length > 0);
    const wordCount = words.length;

    // Estimate reading time (average 200 words per minute)
    const readingTime = Math.ceil(wordCount / 200);

    // Simple sentiment analysis (very basic)
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'best'];
    const negativeWords = ['bad', 'terrible', 'awful', 'worst', 'horrible', 'poor'];

    const positiveCount = words.filter(word =>
      positiveWords.includes(word.toLowerCase())
    ).length;

    const negativeCount = words.filter(word =>
      negativeWords.includes(word.toLowerCase())
    ).length;

    let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
    if (positiveCount > negativeCount) sentiment = 'positive';
    if (negativeCount > positiveCount) sentiment = 'negative';

    // Extract potential topics (simple approach)
    const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    const topics = words
      .filter(word => word.length > 4 && !commonWords.includes(word.toLowerCase()))
      .map(word => word.toLowerCase())
      .filter((word, index, arr) => arr.indexOf(word) === index)
      .slice(0, 10);

    // Extract entities (basic approach - capitalize words)
    const entities = words
      .filter(word => word.length > 1 && word[0] === word[0].toUpperCase())
      .filter((word, index, arr) => arr.indexOf(word) === index)
      .slice(0, 10);

    return {
      wordCount,
      readingTime,
      sentiment,
      topics,
      entities
    };
  }

  async getServiceStatus(): Promise<{
    deepseek: any;
    firecrawl: any;
    overall: 'healthy' | 'degraded' | 'unhealthy';
  }> {
    try {
      const [deepseekStats, firecrawlStats] = await Promise.allSettled([
        deepSeekService.getUsageStats(),
        firecrawlService.getUsageStats()
      ]);

      const deepseekStatus = deepseekStats.status === 'fulfilled' ? deepseekStats.value : null;
      const firecrawlStatus = firecrawlStats.status === 'fulfilled' ? firecrawlStats.value : null;

      let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

      if (!deepseekStatus || !firecrawlStatus) {
        overall = 'unhealthy';
      } else if (deepseekStatus.remainingQuota < 1000 || firecrawlStatus.remainingCredits < 100) {
        overall = 'degraded';
      }

      return {
        deepseek: deepseekStatus,
        firecrawl: firecrawlStatus,
        overall
      };

    } catch (error) {
      logger.error('Service status check error:', error);
      return {
        deepseek: null,
        firecrawl: null,
        overall: 'unhealthy'
      };
    }
  }
}

export const aiSchemaService = new AISchemaService();