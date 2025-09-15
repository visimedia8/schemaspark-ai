'use client';

import { useState, useEffect } from 'react';
import { useAutosave } from '@/hooks/useAutosave';

interface AutosaveEditorProps {
  projectId: string;
  initialContent?: string;
}

export default function AutosaveEditor({ projectId, initialContent = '' }: AutosaveEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [recoveryData, setRecoveryData] = useState<any>(null);

  const {
    isSaving,
    lastSaved,
    version,
    hasUnsavedChanges,
    error,
    saveContent,
    manualSave,
    scheduleAutosave,
    checkRecovery
  } = useAutosave({
    projectId,
    saveInterval: 30000, // 30 seconds
    onSaveSuccess: (data) => {
      console.log('Save successful:', data);
    },
    onSaveError: (error) => {
      console.error('Save failed:', error);
    },
    onRecoveryAvailable: (data) => {
      setRecoveryData(data);
    }
  });

  // Check for recovery data on mount
  useEffect(() => {
    checkRecovery();
  }, [checkRecovery]);

  // Handle content changes with auto-save
  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    scheduleAutosave({ text: newContent, timestamp: new Date() });
  };

  // Handle manual save
  const handleManualSave = async () => {
    await manualSave({ text: content, timestamp: new Date() });
  };

  // Handle recovery
  const handleRecovery = () => {
    if (recoveryData) {
      setContent(recoveryData.draftContent.text);
      setRecoveryData(null);
    }
  };

  const getSaveStatusText = () => {
    if (error) return `Error: ${error}`;
    if (isSaving) return 'Saving...';
    if (hasUnsavedChanges) return 'Unsaved changes';
    if (lastSaved) return `Saved ${lastSaved.toLocaleTimeString()}`;
    return 'Ready';
  };

  const getSaveStatusColor = () => {
    if (error) return 'text-red-600';
    if (isSaving) return 'text-yellow-600';
    if (hasUnsavedChanges) return 'text-orange-600';
    return 'text-green-600';
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">SchemaSpark Editor</h1>
        <p className="text-gray-600">Real-time autosave enabled</p>
      </div>

      {/* Recovery Banner */}
      {recoveryData && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-yellow-800">Unsaved changes found</h3>
              <p className="text-sm text-yellow-700 mt-1">
                You have unsaved changes from {new Date(recoveryData.lastSavedAt).toLocaleString()}
              </p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={handleRecovery}
                className="px-3 py-1 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700"
              >
                Restore
              </button>
              <button
                onClick={() => setRecoveryData(null)}
                className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Status */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <span className={`text-sm font-medium ${getSaveStatusColor()}`}>
            {getSaveStatusText()}
          </span>
          {version > 0 && (
            <span className="text-sm text-gray-500">Version {version}</span>
          )}
        </div>
        <button
          onClick={handleManualSave}
          disabled={isSaving}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Saving...' : 'Save Now'}
        </button>
      </div>

      {/* Editor */}
      <div className="border border-gray-300 rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-2 border-b border-gray-300">
          <h2 className="text-sm font-medium text-gray-700">Schema Content</h2>
        </div>
        <textarea
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder="Start typing your schema content here..."
          className="w-full h-96 p-4 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{ minHeight: '400px' }}
        />
      </div>

      {/* Keyboard Shortcuts Info */}
      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Keyboard Shortcuts</h3>
        <div className="text-sm text-gray-600 space-y-1">
          <p><kbd className="px-2 py-1 bg-white border rounded text-xs">Ctrl</kbd> + <kbd className="px-2 py-1 bg-white border rounded text-xs">S</kbd> - Manual save</p>
          <p><kbd className="px-2 py-1 bg-white border rounded text-xs">Ctrl</kbd> + <kbd className="px-2 py-1 bg-white border rounded text-xs">Z</kbd> - Undo</p>
          <p><kbd className="px-2 py-1 bg-white border rounded text-xs">Ctrl</kbd> + <kbd className="px-2 py-1 bg-white border rounded text-xs">Y</kbd> - Redo</p>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-4 grid grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-gray-900">{content.length}</div>
          <div className="text-sm text-gray-600">Characters</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-gray-900">{content.split('\n').length}</div>
          <div className="text-sm text-gray-600">Lines</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-gray-900">{version}</div>
          <div className="text-sm text-gray-600">Version</div>
        </div>
      </div>
    </div>
  );
}