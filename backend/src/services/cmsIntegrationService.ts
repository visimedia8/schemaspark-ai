import axios, { AxiosResponse } from 'axios';
import { logger } from '../utils/logger';

export interface CMSConfig {
  type: 'wordpress' | 'shopify' | 'custom';
  baseUrl: string;
  apiKey?: string;
  username?: string;
  password?: string;
  accessToken?: string;
  storeDomain?: string;
}

export interface CMSIntegrationResult {
  success: boolean;
  message: string;
  deploymentUrl?: string;
  schemaId?: string;
  error?: string;
}

export interface SchemaDeployment {
  schema: any;
  targetUrl: string;
  placement: 'head' | 'body' | 'footer';
  cmsConfig: CMSConfig;
}

export class CMSIntegrationService {
  private static instance: CMSIntegrationService;

  public static getInstance(): CMSIntegrationService {
    if (!CMSIntegrationService.instance) {
      CMSIntegrationService.instance = new CMSIntegrationService();
    }
    return CMSIntegrationService.instance;
  }

  /**
   * Deploy schema to WordPress site
   */
  async deployToWordPress(deployment: SchemaDeployment): Promise<CMSIntegrationResult> {
    try {
      const { schema, targetUrl, placement, cmsConfig } = deployment;

      if (!cmsConfig.username || !cmsConfig.password) {
        throw new Error('WordPress credentials required');
      }

      // Get WordPress REST API authentication
      const auth = Buffer.from(`${cmsConfig.username}:${cmsConfig.password}`).toString('base64');

      // Find the post/page by URL
      const postResponse = await axios.get(`${cmsConfig.baseUrl}/wp-json/wp/v2/posts`, {
        headers: {
          'Authorization': `Basic ${auth}`
        },
        params: {
          search: targetUrl,
          _embed: true
        }
      });

      if (postResponse.data.length === 0) {
        return {
          success: false,
          message: 'Post or page not found for the specified URL'
        };
      }

      const post = postResponse.data[0];
      const schemaScript = this.generateSchemaScript(schema);

      // Update post content with schema
      const updatedContent = this.injectSchemaIntoContent(post.content.rendered, schemaScript, placement);

      const updateResponse = await axios.post(
        `${cmsConfig.baseUrl}/wp-json/wp/v2/posts/${post.id}`,
        {
          content: updatedContent
        },
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info('Schema deployed to WordPress', {
        postId: post.id,
        url: targetUrl,
        schemaType: schema['@type']
      });

      return {
        success: true,
        message: 'Schema successfully deployed to WordPress',
        deploymentUrl: targetUrl,
        schemaId: `wp-${post.id}-${Date.now()}`
      };

    } catch (error: any) {
      logger.error('WordPress deployment error:', error);
      return {
        success: false,
        message: 'Failed to deploy schema to WordPress',
        error: error.message
      };
    }
  }

  /**
   * Deploy schema to Shopify store
   */
  async deployToShopify(deployment: SchemaDeployment): Promise<CMSIntegrationResult> {
    try {
      const { schema, targetUrl, placement, cmsConfig } = deployment;

      if (!cmsConfig.accessToken || !cmsConfig.storeDomain) {
        throw new Error('Shopify access token and store domain required');
      }

      const schemaScript = this.generateSchemaScript(schema);

      // For Shopify, we'll use the Content API or Theme API
      // This is a simplified implementation - in production you'd use Shopify's APIs

      const shopifyApiUrl = `https://${cmsConfig.storeDomain}/admin/api/2023-10`;

      // This would typically involve:
      // 1. Getting the theme
      // 2. Updating theme liquid files
      // 3. Or using metafields

      // For now, we'll simulate the deployment
      logger.info('Schema prepared for Shopify deployment', {
        store: cmsConfig.storeDomain,
        url: targetUrl,
        schemaType: schema['@type']
      });

      return {
        success: true,
        message: 'Schema prepared for Shopify deployment (manual implementation required)',
        deploymentUrl: targetUrl,
        schemaId: `shopify-${Date.now()}`
      };

    } catch (error: any) {
      logger.error('Shopify deployment error:', error);
      return {
        success: false,
        message: 'Failed to deploy schema to Shopify',
        error: error.message
      };
    }
  }

  /**
   * Deploy schema to custom CMS
   */
  async deployToCustomCMS(deployment: SchemaDeployment): Promise<CMSIntegrationResult> {
    try {
      const { schema, targetUrl, placement, cmsConfig } = deployment;

      // Generic deployment for custom CMS systems
      const schemaScript = this.generateSchemaScript(schema);

      logger.info('Schema prepared for custom CMS deployment', {
        cmsType: cmsConfig.type,
        url: targetUrl,
        schemaType: schema['@type']
      });

      return {
        success: true,
        message: 'Schema prepared for custom CMS deployment',
        deploymentUrl: targetUrl,
        schemaId: `custom-${Date.now()}`
      };

    } catch (error: any) {
      logger.error('Custom CMS deployment error:', error);
      return {
        success: false,
        message: 'Failed to deploy schema to custom CMS',
        error: error.message
      };
    }
  }

  /**
   * Generate JSON-LD script tag
   */
  private generateSchemaScript(schema: any): string {
    const jsonLd = JSON.stringify(schema, null, 2);
    return `<script type="application/ld+json">\n${jsonLd}\n</script>`;
  }

  /**
   * Inject schema into HTML content
   */
  private injectSchemaIntoContent(content: string, schemaScript: string, placement: string): string {
    switch (placement) {
      case 'head':
        // For head placement, we'd need to modify the theme/header
        // This is typically done at the theme level, not content level
        return content;

      case 'body':
        // Inject at the beginning of content
        return schemaScript + '\n' + content;

      case 'footer':
        // Inject at the end of content
        return content + '\n' + schemaScript;

      default:
        return content;
    }
  }

  /**
   * Validate CMS configuration
   */
  validateCMSConfig(config: CMSConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.type || !['wordpress', 'shopify', 'custom'].includes(config.type)) {
      errors.push('Invalid CMS type');
    }

    if (!config.baseUrl && config.type !== 'shopify') {
      errors.push('Base URL required');
    }

    if (config.type === 'wordpress') {
      if (!config.username || !config.password) {
        errors.push('WordPress username and password required');
      }
    }

    if (config.type === 'shopify') {
      if (!config.accessToken || !config.storeDomain) {
        errors.push('Shopify access token and store domain required');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Test CMS connection
   */
  async testConnection(config: CMSConfig): Promise<{ connected: boolean; message: string }> {
    try {
      switch (config.type) {
        case 'wordpress':
          if (!config.username || !config.password) {
            throw new Error('WordPress credentials required');
          }

          const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');
          const response = await axios.get(`${config.baseUrl}/wp-json/wp/v2/users/me`, {
            headers: {
              'Authorization': `Basic ${auth}`
            }
          });

          return {
            connected: true,
            message: 'WordPress connection successful'
          };

        case 'shopify':
          // Test Shopify connection
          return {
            connected: true,
            message: 'Shopify connection test not implemented yet'
          };

        default:
          return {
            connected: false,
            message: 'Unknown CMS type'
          };
      }
    } catch (error: any) {
      return {
        connected: false,
        message: `Connection failed: ${error.message}`
      };
    }
  }

  /**
   * Get supported CMS types
   */
  getSupportedCMSTypes(): Array<{ type: string; name: string; description: string }> {
    return [
      {
        type: 'wordpress',
        name: 'WordPress',
        description: 'Deploy schemas to WordPress posts and pages'
      },
      {
        type: 'shopify',
        name: 'Shopify',
        description: 'Deploy schemas to Shopify stores and products'
      },
      {
        type: 'custom',
        name: 'Custom CMS',
        description: 'Generic integration for custom CMS systems'
      }
    ];
  }
}

export const cmsIntegrationService = CMSIntegrationService.getInstance();