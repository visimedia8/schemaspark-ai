import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface AutosaveState {
  isSaving: boolean;
  lastSaved: Date | null;
  version: number;
  hasUnsavedChanges: boolean;
  error: string | null;
}

interface AutosaveOptions {
  projectId: string;
  saveInterval?: number; // milliseconds
  onSaveSuccess?: (data: any) => void;
  onSaveError?: (error: string) => void;
  onRecoveryAvailable?: (data: any) => void;
}

export const useAutosave = (options: AutosaveOptions) => {
  const { projectId, saveInterval = 30000, onSaveSuccess, onSaveError, onRecoveryAvailable } = options;

  const [state, setState] = useState<AutosaveState>({
    isSaving: false,
    lastSaved: null,
    version: 0,
    hasUnsavedChanges: false,
    error: null
  });

  const socketRef = useRef<Socket | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const contentRef = useRef<any>(null);

  // Initialize Socket.IO connection
  useEffect(() => {
    const socket = io('http://localhost:3001', {
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('Connected to autosave server');
      socket.emit('join-project', projectId);
    });

    socket.on('joined-project', (data) => {
      console.log('Joined project:', data);
    });

    socket.on('autosave-complete', (data) => {
      setState(prev => ({
        ...prev,
        isSaving: false,
        lastSaved: new Date(data.savedAt),
        version: data.version,
        hasUnsavedChanges: false,
        error: null
      }));
      onSaveSuccess?.(data);
    });

    socket.on('autosave-status-update', (data) => {
      console.log('Autosave status update:', data);
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
      setState(prev => ({ ...prev, error: error.message }));
      onSaveError?.(error.message);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [projectId, onSaveSuccess, onSaveError]);

  // Auto-save function
  const saveContent = useCallback(async (content: any) => {
    if (!socketRef.current) return;

    setState(prev => ({ ...prev, isSaving: true, error: null }));

    try {
      socketRef.current.emit('trigger-autosave', {
        projectId,
        content
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Save failed';
      setState(prev => ({
        ...prev,
        isSaving: false,
        error: errorMessage
      }));
      onSaveError?.(errorMessage);
    }
  }, [projectId, onSaveError]);

  // Manual save function
  const manualSave = useCallback(async (content: any) => {
    try {
      const response = await fetch(`http://localhost:3001/api/autosave/project/${projectId}/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Add auth token here when available
        },
        body: JSON.stringify({ draftContent: content })
      });

      const data = await response.json();

      if (data.success) {
        setState(prev => ({
          ...prev,
          lastSaved: new Date(),
          version: data.data.autosaveState.version,
          hasUnsavedChanges: false,
          error: null
        }));
        onSaveSuccess?.(data);
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Manual save failed';
      setState(prev => ({ ...prev, error: errorMessage }));
      onSaveError?.(errorMessage);
    }
  }, [projectId, onSaveSuccess, onSaveError]);

  // Check for recovery data
  const checkRecovery = useCallback(async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/autosave/project/${projectId}/recover`, {
        headers: {
          // Add auth token here when available
        }
      });

      const data = await response.json();

      if (data.success) {
        onRecoveryAvailable?.(data.data);
      }
    } catch (error) {
      console.error('Recovery check failed:', error);
    }
  }, [projectId, onRecoveryAvailable]);

  // Auto-save timer
  const scheduleAutosave = useCallback((content: any) => {
    contentRef.current = content;
    setState(prev => ({ ...prev, hasUnsavedChanges: true }));

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveContent(content);
    }, saveInterval);
  }, [saveContent, saveInterval]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    ...state,
    saveContent,
    manualSave,
    scheduleAutosave,
    checkRecovery
  };
};