'use client';

import { useState } from 'react';
import AutosaveEditor from '../components/AutosaveEditor';
import GuidedInterface from '../components/GuidedInterface';
import ProtectedRoute from '../components/ProtectedRoute';
import { useAuth } from '../contexts/AuthContext';

type ProcessingMode = 'single' | 'bulk';

export default function Home() {
  const { user, logout } = useAuth();
  const [currentView, setCurrentView] = useState<'dashboard' | 'editor'>('dashboard');
  const [interfaceMode, setInterfaceMode] = useState<'guided' | 'advanced'>('guided');
  const [processingMode, setProcessingMode] = useState<ProcessingMode>('single');
  const [analysisMode, setAnalysisMode] = useState<'basic' | 'competitor'>('basic');
  const [url, setUrl] = useState('');
  const [bulkUrls, setBulkUrls] = useState('');
  const [keywords, setKeywords] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [generatedSchema, setGeneratedSchema] = useState('');
  const [competitorAnalysis, setCompetitorAnalysis] = useState<{ results?: Array<{ position: number; domain: string }> } | null>(null);
  const [analysisResults, setAnalysisResults] = useState<{ competitorAnalysis?: { opportunityScore: number }; recommendations?: string[]; interconnectedSchema?: unknown } | null>(null);

  const handleGenerateSchema = async () => {
    const urlsToProcess = processingMode === 'single' ? [url] : bulkUrls.split('\n').filter(u => u.trim());

    if (urlsToProcess.length === 0 || !urlsToProcess[0].trim()) {
      alert('Please enter at least one URL');
      return;
    }

    if (analysisMode === 'competitor' && !keywords.trim()) {
      alert('Please enter keywords for competitor analysis');
      return;
    }

    setIsGenerating(true);
    try {
      if (analysisMode === 'competitor') {
        // Competitor analysis mode
        console.log('Running competitor analysis for:', keywords);

        // Step 1: Analyze SERP
        setIsAnalyzing(true);
        const serpResponse = await fetch(`http://localhost:3001/api/competitor-analysis/keyword/${encodeURIComponent(keywords)}`);
        const serpData = await serpResponse.json();

        if (!serpResponse.ok) {
          throw new Error(serpData.message || 'Failed to analyze SERP');
        }

        setCompetitorAnalysis(serpData.data);

        // Step 2: Generate interconnected schema
        const generateResponse = await fetch('http://localhost:3001/api/competitor-analysis/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            keyword: keywords,
            targetUrl: url,
            brandVoice: 'Professional SEO services that drive results',
            keyFeatures: ['Expert analysis', 'Proven results', 'Advanced techniques']
          })
        });

        const generateData = await generateResponse.json();

        if (!generateResponse.ok) {
          throw new Error(generateData.message || 'Failed to generate schema');
        }

        setAnalysisResults(generateData.data);
        setGeneratedSchema(JSON.stringify(generateData.data.interconnectedSchema, null, 2));
        setIsAnalyzing(false);

      } else {
        // Basic generation mode
        console.log('Processing mode:', processingMode);
        console.log('URLs:', urlsToProcess);
        console.log('Keywords:', keywords);

        // For now, show a sample response
        setTimeout(() => {
          if (processingMode === 'single') {
            setGeneratedSchema(`{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Generated Article Title",
  "author": {
    "@type": "Person",
    "name": "AI Generated"
  },
  "url": "${url}",
  "keywords": "${keywords}",
  "datePublished": "${new Date().toISOString().split('T')[0]}"
}`);
          } else {
            setGeneratedSchema(`{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "Bulk Schema Generation Results",
  "numberOfItems": ${urlsToProcess.length},
  "itemListElement": [
    ${urlsToProcess.map((url, index) => `{
      "@type": "ListItem",
      "position": ${index + 1},
      "url": "${url}",
      "name": "Generated Schema ${index + 1}"
    }`).join(',\n    ')}
  ]
}`);
          }
          setIsGenerating(false);
        }, 2000);
      }

    } catch (error) {
      console.error('Error generating schema:', error);
      setIsGenerating(false);
      setIsAnalyzing(false);
      alert('Error generating schema. Please try again.');
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">🎯 SchemaSpark</h1>
              <span className="ml-2 text-sm text-gray-500">AI-Powered Schema Markup Tool</span>
            </div>
            <div className="flex items-center space-x-4">
              {/* User Info */}
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <span>Welcome, <strong>{user?.email}</strong></span>
                <button
                  onClick={logout}
                  className="text-red-600 hover:text-red-800 font-medium"
                >
                  Logout
                </button>
              </div>

              {/* Interface Mode Toggle */}
              <div className="flex space-x-1 bg-purple-100 p-1 rounded-lg">
                <button
                  onClick={() => setInterfaceMode('guided')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    interfaceMode === 'guided'
                      ? 'bg-white text-purple-900 shadow-sm'
                      : 'text-purple-600 hover:text-purple-900'
                  }`}
                >
                  🎯 Guided Mode
                </button>
                <button
                  onClick={() => setInterfaceMode('advanced')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    interfaceMode === 'advanced'
                      ? 'bg-white text-purple-900 shadow-sm'
                      : 'text-purple-600 hover:text-purple-900'
                  }`}
                >
                  ⚡ Advanced Mode
                </button>
              </div>

              <div className="text-sm text-gray-600">
                Backend: <span className="text-green-600 font-medium">✅ Running</span>
              </div>
              <div className="text-sm text-gray-600">
                API: <span className="text-green-600 font-medium">✅ Connected</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <button
              onClick={() => setCurrentView('dashboard')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                currentView === 'dashboard'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📊 Dashboard
            </button>
            <button
              onClick={() => setCurrentView('editor')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                currentView === 'editor'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              ✏️ Schema Editor
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {currentView === 'dashboard' && (
          <div className="space-y-6">
            {interfaceMode === 'guided' ? (
              <GuidedInterface />
            ) : (
              <>
                {/* Welcome Section */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-xl font-semibold mb-4">Welcome to SchemaSpark</h2>
                  <p className="text-gray-600 mb-6">
                    Generate AI-powered schema markup for your websites. Choose your processing mode below.
                  </p>

                  {/* Analysis Mode Toggle */}
                  <div className="mb-6">
                    <div className="flex space-x-1 bg-blue-100 p-1 rounded-lg w-fit mb-4">
                      <button
                        onClick={() => setAnalysisMode('basic')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                          analysisMode === 'basic'
                            ? 'bg-white text-blue-900 shadow-sm'
                            : 'text-blue-600 hover:text-blue-900'
                        }`}
                      >
                        🚀 Basic Generation
                      </button>
                      <button
                        onClick={() => setAnalysisMode('competitor')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                          analysisMode === 'competitor'
                            ? 'bg-white text-blue-900 shadow-sm'
                            : 'text-blue-600 hover:text-blue-900'
                        }`}
                      >
                        🎯 Competitor Analysis
                      </button>
                    </div>

                    {analysisMode === 'competitor' && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                        <h3 className="text-sm font-medium text-blue-900 mb-2">🎯 Competitor Analysis Mode</h3>
                        <p className="text-sm text-blue-700">
                          This mode analyzes top 10 SERP results for your keyword, identifies schema gaps,
                          and generates strategic interconnected schemas to compete effectively.
                        </p>
                      </div>
                    )}

                    {/* Processing Mode Toggle */}
                    <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
                      <button
                        onClick={() => setProcessingMode('single')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                          processingMode === 'single'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        📄 Single URL
                      </button>
                      <button
                        onClick={() => setProcessingMode('bulk')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                          processingMode === 'bulk'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        ⚡ Bulk URLs
                      </button>
                    </div>
                  </div>

                  {/* URL Input Form */}
                  <div className="space-y-4">
                    {processingMode === 'single' ? (
                      <div>
                        <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-1">
                          Website URL
                        </label>
                        <input
                          type="url"
                          id="url"
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                          placeholder="https://example.com/blog/article"
                          className="w-full px-3 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500 bg-white"
                        />
                      </div>
                    ) : (
                      <div>
                        <label htmlFor="bulkUrls" className="block text-sm font-medium text-gray-700 mb-1">
                          URLs (one per line)
                        </label>
                        <textarea
                          id="bulkUrls"
                          value={bulkUrls}
                          onChange={(e) => setBulkUrls(e.target.value)}
                          placeholder={`https://example.com/blog/article1
https://example.com/blog/article2
https://example.com/blog/article3`}
                          rows={5}
                          className="w-full px-3 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500 bg-white font-mono text-sm"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Enter one URL per line. Maximum 100 URLs per batch.
                        </p>
                      </div>
                    )}

                    <div>
                      <label htmlFor="keywords" className="block text-sm font-medium text-gray-700 mb-1">
                        Target Keywords (optional)
                      </label>
                      <input
                        type="text"
                        id="keywords"
                        value={keywords}
                        onChange={(e) => setKeywords(e.target.value)}
                        placeholder="SEO, digital marketing, optimization"
                        className="w-full px-3 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500 bg-white"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Separate keywords with commas for better AI-generated schemas
                      </p>
                    </div>

                    <button
                      onClick={handleGenerateSchema}
                      disabled={isGenerating}
                      className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                      {isGenerating ? (
                        <span className="flex items-center justify-center">
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          {isAnalyzing ? '🔍 Analyzing Competitors...' :
                           analysisMode === 'competitor' ? '🎯 Generating Strategic Schema...' :
                           processingMode === 'single' ? 'Generating Schema...' : 'Processing URLs...'}
                        </span>
                      ) : (
                        analysisMode === 'competitor' ?
                          '🎯 Analyze & Generate Strategic Schema' :
                          `🚀 ${processingMode === 'single' ? 'Generate Schema' : 'Process URLs'}`
                      )}
                    </button>
                  </div>

                  {/* Competitor Analysis Results */}
                  {competitorAnalysis && analysisMode === 'competitor' && (
                    <div className="mt-6">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-medium text-gray-900">🎯 Competitor Analysis Results</h3>
                        <span className="text-sm text-blue-600 font-medium">📊 Analysis Complete</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                          <h4 className="font-medium text-blue-900 mb-2">📈 SERP Analysis</h4>
                          <p className="text-sm text-blue-700">
                            Found <strong>{competitorAnalysis.results?.length || 0}</strong> competitors for "{keywords}"
                          </p>
                          <div className="mt-2 space-y-1">
                            {competitorAnalysis.results?.slice(0, 3).map((result: { position: number; domain: string }, index: number) => (
                              <div key={index} className="text-xs text-blue-600">
                                {result.position}. {result.domain}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="bg-green-50 border border-green-200 rounded-md p-4">
                          <h4 className="font-medium text-green-900 mb-2">🎯 Schema Opportunities</h4>
                          <p className="text-sm text-green-700">
                            Opportunity Score: <strong>{analysisResults?.competitorAnalysis?.opportunityScore || 0}/100</strong>
                          </p>
                          <p className="text-xs text-green-600 mt-1">
                            Strategic schema recommendations available
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Generated Schema Display */}
                  {generatedSchema && (
                    <div className="mt-6">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-medium text-gray-900">
                          {analysisMode === 'competitor' ? '🎯 Strategic Schema' :
                           processingMode === 'single' ? 'Generated Schema' : 'Bulk Processing Results'}
                        </h3>
                        <span className="text-sm text-green-600 font-medium">✅ Success</span>
                      </div>

                      {analysisMode === 'competitor' && analysisResults?.recommendations && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
                          <h4 className="font-medium text-yellow-900 mb-2">💡 AI Recommendations</h4>
                          <ul className="text-sm text-yellow-700 space-y-1">
                            {analysisResults.recommendations.map((rec: string, index: number) => (
                              <li key={index}>• {rec}</li>
                            ))}
                          </ul>
                        </div>
                      )}

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
                          onClick={() => setCurrentView('editor')}
                          className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors font-medium text-sm"
                        >
                          ✏️ Edit in Editor
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

                {/* Feature Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h3 className="font-medium text-blue-900">📄 Single URL</h3>
                    <p className="text-sm text-blue-700 mt-1">Generate schema from one URL with AI assistance</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <h3 className="font-medium text-green-900">⚡ Bulk Processing</h3>
                    <p className="text-sm text-green-700 mt-1">Process multiple URLs simultaneously</p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                    <h3 className="font-medium text-purple-900">🔄 Complete Workflow</h3>
                    <p className="text-sm text-purple-700 mt-1">Full pipeline: scan → generate → deploy</p>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                    <h3 className="font-medium text-orange-900">🔧 CMS Integration</h3>
                    <p className="text-sm text-orange-700 mt-1">Deploy directly to WordPress, Shopify</p>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {currentView === 'editor' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Schema Editor</h2>
                <button
                  onClick={() => setCurrentView('dashboard')}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  ← Back to Dashboard
                </button>
              </div>
              <p className="text-gray-600 mb-4">
                Edit your schema markup with autosave functionality. Changes are automatically saved to the backend.
              </p>
            </div>

            <AutosaveEditor
              projectId="demo-project-123"
              initialContent={generatedSchema || `{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Your Article Title",
  "author": {
    "@type": "Person",
    "name": "Author Name"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Publisher Name"
  },
  "datePublished": "2024-01-01",
  "dateModified": "2024-01-01"
}`}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <div className="text-center text-sm text-gray-500">
            <p>SchemaSpark - AI-Powered Schema Markup Generation</p>
            <p className="mt-1">Built with Next.js, TypeScript, and AI Integration</p>
          </div>
        </div>
      </footer>
      </div>
    </ProtectedRoute>
  );
}
