import axios, { AxiosResponse } from 'axios';
import { logger } from '../utils/logger';

export interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface DeepSeekResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class DeepSeekService {
  private apiKey: string;
  private baseURL: string;
  private model: string;

  constructor() {
    this.apiKey = process.env.DEEPSEEK_API_KEY || '';
    this.baseURL = 'https://api.deepseek.com/v1';
    this.model = 'deepseek-chat';

    if (!this.apiKey) {
      logger.warn('DeepSeek API key not configured');
    }
  }

  async generateSchema(content: string, targetKeywords?: string[]): Promise<any> {
    try {
      const prompt = this.buildSchemaPrompt(content, targetKeywords);

      const messages: DeepSeekMessage[] = [
        {
          role: 'system',
          content: `You are an expert SEO schema markup generator. Generate valid JSON-LD structured data that follows schema.org standards. Focus on creating comprehensive, accurate schemas that will improve search engine understanding and rich snippet eligibility.`
        },
        {
          role: 'user',
          content: prompt
        }
      ];

      const response: AxiosResponse<DeepSeekResponse> = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: this.model,
          messages,
          temperature: 0.3,
          max_tokens: 2000,
          top_p: 0.9
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      const generatedContent = response.data.choices[0]?.message?.content;

      if (!generatedContent) {
        throw new Error('No content generated from DeepSeek API');
      }

      // Parse and validate the generated JSON-LD
      const schema = this.parseAndValidateSchema(generatedContent);

      logger.info('Schema generated successfully', {
        tokens: response.data.usage,
        model: response.data.model
      });

      return {
        schema,
        metadata: {
          model: response.data.model,
          tokens: response.data.usage,
          generatedAt: new Date(),
          source: 'deepseek'
        }
      };

    } catch (error: any) {
      logger.error('DeepSeek API error:', error);

      if (error.response?.status === 401) {
        throw new Error('Invalid DeepSeek API key');
      } else if (error.response?.status === 429) {
        throw new Error('DeepSeek API rate limit exceeded');
      } else if (error.response?.status === 400) {
        throw new Error('Invalid request to DeepSeek API');
      } else {
        throw new Error(`DeepSeek API error: ${error.message}`);
      }
    }
  }

  async optimizeSchema(existingSchema: any, content: string): Promise<any> {
    try {
      const prompt = `Optimize the following JSON-LD schema for better SEO performance:

Existing Schema:
${JSON.stringify(existingSchema, null, 2)}

Content Context:
${content}

Please provide an optimized version that:
1. Includes all relevant schema.org properties
2. Improves rich snippet eligibility
3. Follows best practices for structured data
4. Is valid JSON-LD format

Return only the optimized JSON-LD schema without any explanation.`;

      const messages: DeepSeekMessage[] = [
        {
          role: 'system',
          content: 'You are an expert at optimizing JSON-LD structured data for SEO. Return only valid JSON-LD without any additional text or explanation.'
        },
        {
          role: 'user',
          content: prompt
        }
      ];

      const response: AxiosResponse<DeepSeekResponse> = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: this.model,
          messages,
          temperature: 0.2,
          max_tokens: 1500
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 25000
        }
      );

      const optimizedContent = response.data.choices[0]?.message?.content;
      const optimizedSchema = this.parseAndValidateSchema(optimizedContent);

      return {
        schema: optimizedSchema,
        metadata: {
          model: response.data.model,
          tokens: response.data.usage,
          generatedAt: new Date(),
          source: 'deepseek-optimization'
        }
      };

    } catch (error: any) {
      logger.error('DeepSeek optimization error:', error);
      throw new Error(`Schema optimization failed: ${error.message}`);
    }
  }

  private buildSchemaPrompt(content: string, targetKeywords?: string[]): string {
    let prompt = `Generate comprehensive JSON-LD structured data for the following content:

Content:
${content}

`;

    if (targetKeywords && targetKeywords.length > 0) {
      prompt += `Target Keywords: ${targetKeywords.join(', ')}

`;
    }

    prompt += `Requirements:
1. Use appropriate schema.org types (Article, Product, Organization, etc.)
2. Include all relevant properties for rich snippets
3. Ensure valid JSON-LD format
4. Focus on SEO benefits
5. Include meta information like dates, authors if available
6. Add breadcrumb navigation if applicable
7. Include social media links if mentioned
8. Add review/rating data if available

Return only the JSON-LD schema without any explanation or additional text.`;

    return prompt;
  }

  private parseAndValidateSchema(content: string): any {
    try {
      // Remove any markdown code blocks if present
      let cleanContent = content.replace(/```json\s*/g, '').replace(/```\s*$/g, '');

      // Find JSON-LD content (look for @context and @type)
      const jsonStart = cleanContent.indexOf('{');
      const jsonEnd = cleanContent.lastIndexOf('}') + 1;

      if (jsonStart === -1 || jsonEnd === 0) {
        throw new Error('No valid JSON-LD found in response');
      }

      const jsonContent = cleanContent.substring(jsonStart, jsonEnd);
      const schema = JSON.parse(jsonContent);

      // Basic validation
      if (!schema['@context'] || !schema['@type']) {
        throw new Error('Invalid JSON-LD: missing @context or @type');
      }

      return schema;

    } catch (error: any) {
      logger.error('Schema parsing error:', error);
      throw new Error(`Failed to parse generated schema: ${error.message}`);
    }
  }

  async getUsageStats(): Promise<any> {
    // This would typically come from DeepSeek's usage API
    // For now, return a placeholder
    return {
      dailyUsage: 0,
      monthlyUsage: 0,
      remainingQuota: 1000000,
      resetDate: new Date(Date.now() + 24 * 60 * 60 * 1000)
    };
  }
}

export const deepSeekService = new DeepSeekService();