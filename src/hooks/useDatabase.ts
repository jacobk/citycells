/**
 * React hook for database access.
 *
 * Handles lazy initialization of the IndexedDB database and provides
 * loading/error states for UI feedback.
 *
 * See ADR 026 for the IndexedDB migration.
 * See docs/features/data-persistence.md for implementation details.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  initDatabase,
  closeDatabase,
  exportDatabase,
  importDatabase,
} from '@/lib/db';
import { isDatabaseOpen } from '@/lib/idb';

interface UseDatabaseReturn {
  /** True once the database has been initialized successfully */
  ready: boolean;
  /** True while the database is being initialized */
  loading: boolean;
  /** Error message if initialization failed */
  error: string | null;
  /** Export the database as a downloadable file */
  exportDb: () => Promise<void>;
  /** Import a database from a file */
  importDb: (file: File) => Promise<void>;
}

export function useDatabase(): UseDatabaseReturn {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      setLoading(true);
      setError(null);

      try {
        await initDatabase();
        if (!cancelled) {
          setReady(true);
          setLoading(false);
        }
      } catch (e) {
        console.error('[useDatabase] Initialization failed:', e);
        if (!cancelled) {
          setReady(false);
          setError(e instanceof Error ? e.message : 'Failed to initialize database');
          setLoading(false);
        }
      }
    }

    initialize();

    // WHY: Close database on unmount to release IndexedDB connection
    return () => {
      cancelled = true;
      closeDatabase();
      setReady(false);
    };
  }, []);

  const exportDb = useCallback(async () => {
    if (!isDatabaseOpen()) {
      console.error('[useDatabase] Cannot export: database not initialized');
      return;
    }

    const blob = await exportDatabase();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `citycells-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const importDb = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);

    try {
      await importDatabase(file);
      // Re-initialize to ensure connection is fresh
      await initDatabase();
      setReady(true);
    } catch (e) {
      console.error('[useDatabase] Import failed:', e);
      setError(e instanceof Error ? e.message : 'Failed to import database');
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    ready,
    loading,
    error,
    exportDb,
    importDb,
  };
}
