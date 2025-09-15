'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Check, Sparkles, Target, FileText, Zap } from 'lucide-react';

interface GuidedStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  required: boolean;
}

interface BusinessInfo {
  companyName: string;
  website: string;
  industry: string;
  brandVoice: string;
  targetAudience: string;
}

interface ContentInfo {
  keywords: string[];
  contentType: string;
  competitors: string[];
  uniqueValueProps: string[];
}

interface SchemaStrategy {
  analysisMode: 'basic' | 'competitor';
  targetKeyword: string;
  focusAreas: string[];
  prioritySchemas: string[];
}

const steps: GuidedStep[] = [
  {
    id: 'business',
    title: 'Business Information',
    description: 'Tell us about your business and brand',
    icon: <Target className="w-5 h-5" />,
    required: true
  },
  {
    id: 'content',
    title: 'Content Analysis',
    description: 'Describe your content and target keywords',
    icon: <FileText className="w-5 h-5" />,
    required: true
  },
  {
    id: 'strategy',
    title: 'Schema Strategy',
    description: 'Choose your analysis approach and focus areas',
    icon: <Sparkles className="w-5 h-5" />,
    required: true
  },
  {
    id: 'generate',
    title: 'Generate Schema',
    description: 'Review and generate your professional schema',
    icon: <Zap className="w-5 h-5" />,
    required: true
  }
];

export default function GuidedInterface() {
  const [currentStep, setCurrentStep] = useState(0);
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>({
    companyName: '',
    website: '',
    industry: '',
    brandVoice: '',
    targetAudience: ''
  });
  const [contentInfo, setContentInfo] = useState<ContentInfo>({
    keywords: [],
    contentType: '',
    competitors: [],
    uniqueValueProps: []
  });
  const [schemaStrategy, setSchemaStrategy] = useState<SchemaStrategy>({
    analysisMode: 'basic',
    targetKeyword: '',
    focusAreas: [],
    prioritySchemas: []
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSchema, setGeneratedSchema] = useState('');

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Generate sample schema based on collected information
      const schema = generateSampleSchema(businessInfo, contentInfo, schemaStrategy);
      setGeneratedSchema(schema);
      setCurrentStep(steps.length - 1); // Move to final step
    } catch (error) {
      console.error('Generation failed:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateSampleSchema = (
    business: BusinessInfo,
    content: ContentInfo,
    strategy: SchemaStrategy
  ): string => {
    const schemas = [];

    // Organization Schema
    schemas.push({
      '@type': 'Organization',
      '@id': `${business.website}#organization`,
      'name': business.companyName,
      'url': business.website,
      'description': business.brandVoice,
      'industry': business.industry
    });

    // WebSite Schema
    schemas.push({
      '@type': 'WebSite',
      '@id': `${business.website}#website`,
      'name': business.companyName,
      'url': business.website,
      'publisher': { '@id': `${business.website}#organization` }
    });

    // Add content-specific schemas
    if (content.contentType === 'blog' || content.contentType === 'article') {
      schemas.push({
        '@type': 'Article',
        '@id': `${business.website}#article`,
        'headline': `${business.companyName} - Professional Services`,
        'author': { '@id': `${business.website}#organization` },
        'publisher': { '@id': `${business.website}#organization` },
        'keywords': content.keywords.join(', ')
      });
    }

    if (strategy.prioritySchemas.includes('FAQPage')) {
      schemas.push({
        '@type': 'FAQPage',
        '@id': `${business.website}#faq`,
        'name': `Frequently Asked Questions - ${business.companyName}`,
        'isPartOf': { '@id': `${business.website}#website` }
      });
    }

    return JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': schemas
    }, null, 2);
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <BusinessInfoStep
            data={businessInfo}
            onChange={setBusinessInfo}
          />
        );
      case 1:
        return (
          <ContentAnalysisStep
            data={contentInfo}
            onChange={setContentInfo}
          />
        );
      case 2:
        return (
          <SchemaStrategyStep
            data={schemaStrategy}
            onChange={setSchemaStrategy}
          />
        );
      case 3:
        return (
          <GenerationStep
            businessInfo={businessInfo}
            contentInfo={contentInfo}
            schemaStrategy={schemaStrategy}
            generatedSchema={generatedSchema}
            isGenerating={isGenerating}
            onGenerate={handleGenerate}
          />
        );
      default:
        return null;
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return businessInfo.companyName && businessInfo.website && businessInfo.industry;
      case 1:
        return contentInfo.keywords.length > 0 && contentInfo.contentType;
      case 2:
        return schemaStrategy.targetKeyword;
      case 3:
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          🎯 Simple Mode - Guided Schema Generation
        </h1>
        <p className="text-gray-600">
          Follow our step-by-step guide to create professional schema markup for your website
        </p>
      </div>

      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                index < currentStep
                  ? 'bg-green-500 border-green-500 text-white'
                  : index === currentStep
                  ? 'bg-blue-500 border-blue-500 text-white'
                  : 'bg-gray-100 border-gray-300 text-gray-400'
              }`}>
                {index < currentStep ? (
                  <Check className="w-5 h-5" />
                ) : (
                  step.icon
                )}
              </div>
              <div className="ml-3 hidden sm:block">
                <div className={`text-sm font-medium ${
                  index <= currentStep ? 'text-gray-900' : 'text-gray-400'
                }`}>
                  {step.title}
                </div>
                <div className="text-xs text-gray-500">
                  {step.description}
                </div>
              </div>
              {index < steps.length - 1 && (
                <div className={`w-12 h-0.5 mx-4 ${
                  index < currentStep ? 'bg-green-500' : 'bg-gray-300'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        {renderStepContent()}
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <button
          onClick={handlePrevious}
          disabled={currentStep === 0}
          className="flex items-center px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Previous
        </button>

        <div className="text-sm text-gray-500">
          Step {currentStep + 1} of {steps.length}
        </div>

        {currentStep < steps.length - 1 ? (
          <button
            onClick={handleNext}
            disabled={!canProceed()}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
            <ChevronRight className="w-4 h-4 ml-2" />
          </button>
        ) : (
          <div className="w-24" /> // Spacer for alignment
        )}
      </div>
    </div>
  );
}

// Step Components
function BusinessInfoStep({
  data,
  onChange
}: {
  data: BusinessInfo;
  onChange: (data: BusinessInfo) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Business Information</h3>
        <p className="text-gray-600 mb-4">
          Tell us about your business so we can create relevant schema markup.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Company Name *
          </label>
          <input
            type="text"
            value={data.companyName}
            onChange={(e) => onChange({ ...data, companyName: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Your Company Name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Website URL *
          </label>
          <input
            type="url"
            value={data.website}
            onChange={(e) => onChange({ ...data, website: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="https://yourwebsite.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Industry *
          </label>
          <select
            value={data.industry}
            onChange={(e) => onChange({ ...data, industry: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select Industry</option>
            <option value="technology">Technology</option>
            <option value="healthcare">Healthcare</option>
            <option value="finance">Finance</option>
            <option value="education">Education</option>
            <option value="ecommerce">E-commerce</option>
            <option value="consulting">Consulting</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Target Audience
          </label>
          <input
            type="text"
            value={data.targetAudience}
            onChange={(e) => onChange({ ...data, targetAudience: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Small businesses, enterprises, consumers..."
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Brand Voice (Optional)
        </label>
        <textarea
          value={data.brandVoice}
          onChange={(e) => onChange({ ...data, brandVoice: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={3}
          placeholder="Describe your brand personality, values, and how you want to be perceived..."
        />
      </div>
    </div>
  );
}

function ContentAnalysisStep({
  data,
  onChange
}: {
  data: ContentInfo;
  onChange: (data: ContentInfo) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Content Analysis</h3>
        <p className="text-gray-600 mb-4">
          Help us understand your content and target keywords for better schema generation.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Content Type *
          </label>
          <select
            value={data.contentType}
            onChange={(e) => onChange({ ...data, contentType: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select Content Type</option>
            <option value="website">Business Website</option>
            <option value="blog">Blog/Article</option>
            <option value="product">Product Page</option>
            <option value="service">Service Page</option>
            <option value="local">Local Business</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Target Keywords *
          </label>
          <input
            type="text"
            value={data.keywords.join(', ')}
            onChange={(e) => onChange({
              ...data,
              keywords: e.target.value.split(',').map(k => k.trim()).filter(k => k)
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="SEO services, digital marketing, web design..."
          />
          <p className="text-xs text-gray-500 mt-1">Separate keywords with commas</p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Unique Value Propositions (Optional)
        </label>
        <textarea
          value={data.uniqueValueProps.join('\n')}
          onChange={(e) => onChange({
            ...data,
            uniqueValueProps: e.target.value.split('\n').filter(v => v.trim())
          })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={3}
          placeholder="What makes your business unique?
- 10+ years experience
- 99% client satisfaction
- Award-winning team"
        />
        <p className="text-xs text-gray-500 mt-1">One value proposition per line</p>
      </div>
    </div>
  );
}

function SchemaStrategyStep({
  data,
  onChange
}: {
  data: SchemaStrategy;
  onChange: (data: SchemaStrategy) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Schema Strategy</h3>
        <p className="text-gray-600 mb-4">
          Choose your analysis approach and focus areas for schema generation.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Analysis Mode *
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              onClick={() => onChange({ ...data, analysisMode: 'basic' })}
              className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                data.analysisMode === 'basic'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center mb-2">
                <div className="w-4 h-4 rounded-full bg-blue-500 mr-2"></div>
                <span className="font-medium">Basic Generation</span>
              </div>
              <p className="text-sm text-gray-600">
                Generate schema based on your content and keywords
              </p>
            </div>

            <div
              onClick={() => onChange({ ...data, analysisMode: 'competitor' })}
              className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                data.analysisMode === 'competitor'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center mb-2">
                <div className="w-4 h-4 rounded-full bg-green-500 mr-2"></div>
                <span className="font-medium">Competitor Analysis</span>
              </div>
              <p className="text-sm text-gray-600">
                Analyze competitors and generate strategic schema
              </p>
            </div>
          </div>
        </div>

        {data.analysisMode === 'competitor' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Keyword for Analysis *
            </label>
            <input
              type="text"
              value={data.targetKeyword}
              onChange={(e) => onChange({ ...data, targetKeyword: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter keyword to analyze competitors"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Focus Areas (Optional)
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {['SEO', 'Local SEO', 'E-commerce', 'Content Marketing', 'Lead Generation'].map((area) => (
              <label key={area} className="flex items-center">
                <input
                  type="checkbox"
                  checked={data.focusAreas.includes(area)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      onChange({ ...data, focusAreas: [...data.focusAreas, area] });
                    } else {
                      onChange({ ...data, focusAreas: data.focusAreas.filter(a => a !== area) });
                    }
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm">{area}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function GenerationStep({
  businessInfo,
  contentInfo,
  schemaStrategy,
  generatedSchema,
  isGenerating,
  onGenerate
}: {
  businessInfo: BusinessInfo;
  contentInfo: ContentInfo;
  schemaStrategy: SchemaStrategy;
  generatedSchema: string;
  isGenerating: boolean;
  onGenerate: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Generate Your Schema</h3>
        <p className="text-gray-600 mb-4">
          Review your information and generate professional schema markup.
        </p>
      </div>

      {/* Summary */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-3">Configuration Summary</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-700">Business:</span> {businessInfo.companyName}
          </div>
          <div>
            <span className="font-medium text-gray-700">Industry:</span> {businessInfo.industry}
          </div>
          <div>
            <span className="font-medium text-gray-700">Content Type:</span> {contentInfo.contentType}
          </div>
          <div>
            <span className="font-medium text-gray-700">Keywords:</span> {contentInfo.keywords.join(', ')}
          </div>
          <div>
            <span className="font-medium text-gray-700">Analysis Mode:</span> {schemaStrategy.analysisMode}
          </div>
          {schemaStrategy.targetKeyword && (
            <div>
              <span className="font-medium text-gray-700">Target Keyword:</span> {schemaStrategy.targetKeyword}
            </div>
          )}
        </div>
      </div>

      {!generatedSchema ? (
        <div className="text-center py-8">
          <button
            onClick={onGenerate}
            disabled={isGenerating}
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white text-lg font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                Generating Schema...
              </>
            ) : (
              <>
                <Zap className="w-5 h-5 mr-2" />
                Generate Professional Schema
              </>
            )}
          </button>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-lg font-medium text-gray-900">Generated Schema</h4>
            <span className="text-sm text-green-600 font-medium">✅ Success</span>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
            <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono overflow-x-auto">
              {generatedSchema}
            </pre>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => navigator.clipboard.writeText(generatedSchema)}
              className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors font-medium text-sm"
            >
              📋 Copy Schema
            </button>
            <button
              onClick={() => {
                const blob = new Blob([generatedSchema], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `schema-${Date.now()}.json`;
                a.click();
              }}
              className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors font-medium text-sm"
            >
              💾 Download JSON
            </button>
          </div>
        </div>
      )}
    </div>
  );
}