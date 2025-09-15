import axios, { AxiosResponse } from 'axios';
import { logger } from '../utils/logger';

export interface FirecrawlScrapeRequest {
  url: string;
  formats?: string[];
  onlyMainContent?: boolean;
  includeTags?: string[];
  excludeTags?: string[];
  waitFor?: number;
}

export interface FirecrawlScrapeResponse {
  success: boolean;
  data?: {
    url: string;
    markdown?: string;
    html?: string;
    title?: string;
    description?: string;
    language?: string;
    sourceURL?: string;
    statusCode?: number;
  };
  error?: string;
}

export interface FirecrawlCrawlRequest {
  url: string;
  maxPages?: number;
  allowBackwardLinks?: boolean;
  allowExternalLinks?: boolean;
  limit?: number;
  formats?: string[];
  onlyMainContent?: boolean;
  includeTags?: string[];
  excludeTags?: string[];
}

export interface FirecrawlCrawlResponse {
  success: boolean;
  id?: string;
  url?: string;
  error?: string;
}

export interface FirecrawlCrawlStatus {
  success: boolean;
  status?: string;
  total?: number;
  completed?: number;
  creditsUsed?: number;
  expiresAt?: string;
  data?: Array<{
    url: string;
    markdown?: string;
    html?: string;
    title?: string;
    description?: string;
    language?: string;
  }>;
  error?: string;
}

export class FirecrawlService {
  private apiKey: string;
  private baseURL: string;

  constructor() {
    this.apiKey = process.env.FIRECRAWL_API_KEY || '';
    this.baseURL = 'https://api.firecrawl.dev';

    if (!this.apiKey) {
      logger.warn('Firecrawl API key not configured');
    }
  }

  async scrapeURL(url: string, options?: {
    formats?: string[];
    onlyMainContent?: boolean;
    includeTags?: string[];
    excludeTags?: string[];
    waitFor?: number;
  }): Promise<FirecrawlScrapeResponse> {
    try {
      const requestData: FirecrawlScrapeRequest = {
        url,
        formats: options?.formats || ['markdown', 'html'],
        onlyMainContent: options?.onlyMainContent ?? true,
        includeTags: options?.includeTags,
        excludeTags: options?.excludeTags,
        waitFor: options?.waitFor || 0
      };

      const response: AxiosResponse<FirecrawlScrapeResponse> = await axios.post(
        `${this.baseURL}/v1/scrape`,
        requestData,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 60000 // 60 seconds for scraping
        }
      );

      if (response.data.success && response.data.data) {
        logger.info('URL scraped successfully', {
          url,
          title: response.data.data.title,
          contentLength: response.data.data.markdown?.length || 0
        });
      }

      return response.data;

    } catch (error: any) {
      logger.error('Firecrawl scrape error:', error);

      if (error.response?.status === 401) {
        throw new Error('Invalid Firecrawl API key');
      } else if (error.response?.status === 402) {
        throw new Error('Firecrawl credits exhausted');
      } else if (error.response?.status === 429) {
        throw new Error('Firecrawl rate limit exceeded');
      } else if (error.response?.status === 400) {
        throw new Error('Invalid URL or request parameters');
      } else {
        throw new Error(`Firecrawl scrape error: ${error.message}`);
      }
    }
  }

  async startCrawl(url: string, options?: {
    maxPages?: number;
    allowBackwardLinks?: boolean;
    allowExternalLinks?: boolean;
    limit?: number;
    formats?: string[];
    onlyMainContent?: boolean;
    includeTags?: string[];
    excludeTags?: string[];
  }): Promise<FirecrawlCrawlResponse> {
    try {
      const requestData: FirecrawlCrawlRequest = {
        url,
        maxPages: options?.maxPages || 10,
        allowBackwardLinks: options?.allowBackwardLinks ?? false,
        allowExternalLinks: options?.allowExternalLinks ?? false,
        limit: options?.limit || 100,
        formats: options?.formats || ['markdown'],
        onlyMainContent: options?.onlyMainContent ?? true,
        includeTags: options?.includeTags,
        excludeTags: options?.excludeTags
      };

      const response: AxiosResponse<FirecrawlCrawlResponse> = await axios.post(
        `${this.baseURL}/v1/crawl`,
        requestData,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      if (response.data.success && response.data.id) {
        logger.info('Crawl started successfully', {
          url,
          crawlId: response.data.id,
          maxPages: requestData.maxPages
        });
      }

      return response.data;

    } catch (error: any) {
      logger.error('Firecrawl crawl start error:', error);
      throw new Error(`Failed to start crawl: ${error.message}`);
    }
  }

  async getCrawlStatus(crawlId: string): Promise<FirecrawlCrawlStatus> {
    try {
      const response: AxiosResponse<FirecrawlCrawlStatus> = await axios.get(
        `${this.baseURL}/v1/crawl/${crawlId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      return response.data;

    } catch (error: any) {
      logger.error('Firecrawl crawl status error:', error);
      throw new Error(`Failed to get crawl status: ${error.message}`);
    }
  }

  async extractContentForSchema(url: string): Promise<{
    title: string;
    description: string;
    content: string;
    keywords: string[];
    images: string[];
    links: string[];
    structuredData?: any;
  }> {
    try {
      const scrapeResult = await this.scrapeURL(url, {
        formats: ['markdown', 'html'],
        onlyMainContent: true
      });

      if (!scrapeResult.success || !scrapeResult.data) {
        throw new Error(scrapeResult.error || 'Failed to scrape content');
      }

      const { title, description, markdown, html } = scrapeResult.data;

      // Extract keywords from content
      const keywords = this.extractKeywords(markdown || '');

      // Extract images and links from HTML
      const images = this.extractImages(html || '');
      const links = this.extractLinks(html || '');

      // Try to extract existing structured data
      const structuredData = this.extractStructuredData(html || '');

      return {
        title: title || '',
        description: description || '',
        content: markdown || '',
        keywords,
        images,
        links,
        structuredData
      };

    } catch (error: any) {
      logger.error('Content extraction error:', error);
      throw new Error(`Failed to extract content: ${error.message}`);
    }
  }

  private extractKeywords(content: string): string[] {
    // Simple keyword extraction - in production, you'd use NLP libraries
    const words = content.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);

    const wordCount: { [key: string]: number } = {};
    words.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });

    return Object.entries(wordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 20)
      .map(([word]) => word);
  }

  private extractImages(html: string): string[] {
    const imgRegex = /<img[^>]+src="([^"]+)"/gi;
    const images: string[] = [];
    let match;

    while ((match = imgRegex.exec(html)) !== null) {
      images.push(match[1]);
    }

    return images;
  }

  private extractLinks(html: string): string[] {
    const linkRegex = /<a[^>]+href="([^"]+)"/gi;
    const links: string[] = [];
    let match;

    while ((match = linkRegex.exec(html)) !== null) {
      links.push(match[1]);
    }

    return links;
  }

  private extractStructuredData(html: string): any {
    try {
      // Look for JSON-LD scripts
      const jsonLdRegex = /<script[^>]*type="application\/ld\+json"[^>]*>([^<]*)<\/script>/gi;
      const structuredData: any[] = [];
      let match;

      while ((match = jsonLdRegex.exec(html)) !== null) {
        try {
          const data = JSON.parse(match[1]);
          structuredData.push(data);
        } catch (e) {
          // Skip invalid JSON
        }
      }

      return structuredData.length > 0 ? structuredData : undefined;
    } catch (error) {
      return undefined;
    }
  }

  async getUsageStats(): Promise<any> {
    // This would typically come from Firecrawl's usage API
    // For now, return a placeholder
    return {
      dailyUsage: 0,
      monthlyUsage: 0,
      remainingCredits: 1000,
      resetDate: new Date(Date.now() + 24 * 60 * 60 * 1000)
    };
  }
}

export const firecrawlService = new FirecrawlService();