import axios from 'axios';
import { logger } from '../utils/logger';

export interface SERPResult {
  position: number;
  title: string;
  url: string;
  domain: string;
  snippet: string;
}

export interface CompetitorAnalysis {
  keyword: string;
  location: string;
  results: SERPResult[];
  analyzedAt: Date;
}

export interface SchemaGapAnalysis {
  keyword: string;
  targetUrl: string;
  competitors: SERPResult[];
  missingSchemas: string[];
  competitorSchemas: { [url: string]: string[] };
  recommendedSchemas: string[];
  opportunityScore: number;
}

export class SERPAnalysisService {
  private serpApiKey: string;
  private scraperApiKey: string;

  constructor() {
    this.serpApiKey = process.env.SERP_API_KEY || '';
    this.scraperApiKey = process.env.SCRAPERAPI_KEY || '';
  }

  /**
   * Analyze SERP for a given keyword and extract competitor URLs
   */
  async analyzeKeyword(keyword: string, options: {
    location?: string;
    num?: number;
    device?: 'desktop' | 'mobile';
  } = {}): Promise<CompetitorAnalysis> {
    try {
      const { location = 'United States', num = 10, device = 'desktop' } = options;

      logger.info(`Analyzing SERP for keyword: ${keyword}, location: ${location}`);

      // For now, return mock data since we don't have SERP API key
      // In production, this would call a SERP API like SerpAPI or BrightData
      const mockResults: SERPResult[] = [
        {
          position: 1,
          title: 'Best SEO Services 2024 | Top Rated SEO Company',
          url: 'https://competitor1.com/seo-services',
          domain: 'competitor1.com',
          snippet: 'Professional SEO services with guaranteed results...'
        },
        {
          position: 2,
          title: 'SEO Services - Digital Marketing Agency',
          url: 'https://competitor2.com/digital-marketing',
          domain: 'competitor2.com',
          snippet: 'Complete SEO solutions for businesses...'
        },
        {
          position: 3,
          title: 'Professional SEO Company | SEO Services',
          url: 'https://competitor3.com/seo-company',
          domain: 'competitor3.com',
          snippet: 'Expert SEO services and consulting...'
        },
        // Add more mock results...
      ];

      const analysis: CompetitorAnalysis = {
        keyword,
        location,
        results: mockResults.slice(0, num),
        analyzedAt: new Date()
      };

      logger.info(`SERP analysis complete for ${keyword}: ${mockResults.length} results`);
      return analysis;

    } catch (error) {
      logger.error('Error analyzing SERP:', error);
      throw new Error('Failed to analyze SERP results');
    }
  }

  /**
   * Analyze schema gaps between target URL and competitors
   */
  async analyzeSchemaGaps(
    keyword: string,
    targetUrl: string,
    competitors: SERPResult[]
  ): Promise<SchemaGapAnalysis> {
    try {
      logger.info(`Analyzing schema gaps for keyword: ${keyword}`);

      // Extract schemas from competitor pages
      const competitorSchemas = await this.extractSchemasFromCompetitors(competitors);

      // Analyze gaps and opportunities
      const gaps = this.identifySchemaGaps(competitorSchemas, targetUrl);

      const analysis: SchemaGapAnalysis = {
        keyword,
        targetUrl,
        competitors,
        missingSchemas: gaps.missingSchemas,
        competitorSchemas,
        recommendedSchemas: gaps.recommendedSchemas,
        opportunityScore: gaps.opportunityScore
      };

      logger.info(`Schema gap analysis complete: ${gaps.missingSchemas.length} gaps identified`);
      return analysis;

    } catch (error) {
      logger.error('Error analyzing schema gaps:', error);
      throw new Error('Failed to analyze schema gaps');
    }
  }

  /**
   * Extract existing schemas from competitor pages
   */
  private async extractSchemasFromCompetitors(competitors: SERPResult[]): Promise<{ [url: string]: string[] }> {
    const schemas: { [url: string]: string[] } = {};

    for (const competitor of competitors.slice(0, 5)) { // Analyze top 5 competitors
      try {
        // In production, this would scrape the actual page
        // For now, return mock schema types based on the page
        schemas[competitor.url] = this.mockSchemaExtraction(competitor.url);
      } catch (error) {
        logger.warn(`Failed to extract schemas from ${competitor.url}:`, error);
        schemas[competitor.url] = [];
      }
    }

    return schemas;
  }

  /**
   * Mock schema extraction (replace with real scraping in production)
   */
  private mockSchemaExtraction(url: string): string[] {
    // Mock different schema types based on URL patterns
    const mockSchemas = {
      'competitor1.com': ['Organization', 'WebSite', 'Service', 'Review', 'FAQPage'],
      'competitor2.com': ['Organization', 'WebSite', 'LocalBusiness', 'Service'],
      'competitor3.com': ['Organization', 'WebSite', 'Article', 'BreadcrumbList'],
      'competitor4.com': ['Organization', 'WebSite', 'Product', 'Review'],
      'competitor5.com': ['Organization', 'WebSite', 'VideoObject', 'HowTo']
    };

    // Return mock schemas or default set
    return mockSchemas[url as keyof typeof mockSchemas] || ['Organization', 'WebSite'];
  }

  /**
   * Identify schema gaps and opportunities
   */
  private identifySchemaGaps(
    competitorSchemas: { [url: string]: string[] },
    targetUrl: string
  ): {
    missingSchemas: string[];
    recommendedSchemas: string[];
    opportunityScore: number;
  } {
    // Essential schema types for SEO
    const essentialSchemas = [
      'Organization', 'WebSite', 'WebPage', 'Article', 'Product',
      'Service', 'LocalBusiness', 'FAQPage', 'HowTo', 'Review',
      'VideoObject', 'BreadcrumbList', 'SearchAction'
    ];

    // Collect all schemas used by competitors
    const competitorSchemaSet = new Set<string>();
    Object.values(competitorSchemas).forEach(schemas => {
      schemas.forEach(schema => competitorSchemaSet.add(schema));
    });

    // Assume target has basic schemas (in production, this would be scraped)
    const targetSchemas = ['Organization', 'WebSite']; // Mock target schemas

    // Find missing schemas
    const missingSchemas = Array.from(competitorSchemaSet).filter(
      schema => !targetSchemas.includes(schema) && essentialSchemas.includes(schema)
    );

    // Calculate opportunity score (0-100)
    const opportunityScore = Math.min(100, missingSchemas.length * 15 + 20);

    // Recommend top missing schemas
    const recommendedSchemas = missingSchemas.slice(0, 5);

    return {
      missingSchemas,
      recommendedSchemas,
      opportunityScore
    };
  }

  /**
   * Get comprehensive competitor analysis report
   */
  async getCompetitorAnalysisReport(keyword: string, targetUrl: string): Promise<{
    serpAnalysis: CompetitorAnalysis;
    schemaGaps: SchemaGapAnalysis;
    recommendations: string[];
  }> {
    try {
      // Get SERP analysis
      const serpAnalysis = await this.analyzeKeyword(keyword);

      // Get schema gap analysis
      const schemaGaps = await this.analyzeSchemaGaps(keyword, targetUrl, serpAnalysis.results);

      // Generate recommendations
      const recommendations = this.generateRecommendations(schemaGaps);

      return {
        serpAnalysis,
        schemaGaps,
        recommendations
      };

    } catch (error) {
      logger.error('Error generating competitor analysis report:', error);
      throw new Error('Failed to generate competitor analysis report');
    }
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(schemaGaps: SchemaGapAnalysis): string[] {
    const recommendations: string[] = [];

    if (schemaGaps.missingSchemas.includes('FAQPage')) {
      recommendations.push('Add FAQPage schema - competitors are using it for rich snippets');
    }

    if (schemaGaps.missingSchemas.includes('HowTo')) {
      recommendations.push('Implement HowTo schema for step-by-step content');
    }

    if (schemaGaps.missingSchemas.includes('Review')) {
      recommendations.push('Add Review schema to build trust and credibility');
    }

    if (schemaGaps.missingSchemas.includes('VideoObject')) {
      recommendations.push('Include VideoObject schema for video content');
    }

    if (schemaGaps.opportunityScore > 70) {
      recommendations.push('High opportunity score! Implement multiple missing schemas for significant SEO boost');
    }

    return recommendations;
  }
}

export const serpAnalysisService = new SERPAnalysisService();