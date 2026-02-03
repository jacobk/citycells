/**
 * React hook for database access.
 * 
 * Handles lazy initialization of the SQLite database and provides
 * loading/error states for UI feedback.
 * 
 * See ADR 004 for storage architecture.
 * See docs/features/data-persistence.md for implementation details.
 */

import { useState, useEffect, useCallback } from 'react';
import { Database } from 'sql.js';
import { 
  initDatabase, 
  closeDatabase, 
  exportDatabase, 
  importDatabase,
  getAllAreas,
  getUserProgress,
  type AreaRow,
  type UserProgressRow
} from '@/lib/db';

interface UseDatabaseReturn {
  /** The database instance, null if not yet initialized */
  db: Database | null;
  /** True while the database is being initialized */
  loading: boolean;
  /** Error message if initialization failed */
  error: string | null;
  /** Re-initialize the database (e.g., after import) */
  refresh: () => Promise<void>;
  /** Export the database as a downloadable file */
  exportDb: () => void;
  /** Import a database from a file */
  importDb: (file: File) => Promise<void>;
  /** Get all areas from the database */
  getAreas: () => AreaRow[];
  /** Get user progress summary */
  getProgress: (userId: number) => UserProgressRow | null;
}

export function useDatabase(): UseDatabaseReturn {
  const [db, setDb] = useState<Database | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const initialize = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const database = await initDatabase();
      setDb(database);
    } catch (e) {
      console.error('[useDatabase] Initialization failed:', e);
      setError(e instanceof Error ? e.message : 'Failed to initialize database');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initialize();

    // WHY: Close database on unmount to free WebAssembly memory
    return () => {
      closeDatabase();
    };
  }, [initialize]);

  const exportDb = useCallback(() => {
    if (!db) {
      console.error('[useDatabase] Cannot export: database not initialized');
      return;
    }

    const blob = exportDatabase();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `citycells-backup-${new Date().toISOString().split('T')[0]}.db`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [db]);

  const importDb = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    
    try {
      await importDatabase(file);
      // Re-initialize to get the new database instance
      const database = await initDatabase();
      setDb(database);
    } catch (e) {
      console.error('[useDatabase] Import failed:', e);
      setError(e instanceof Error ? e.message : 'Failed to import database');
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const getAreas = useCallback((): AreaRow[] => {
    if (!db) return [];
    return getAllAreas();
  }, [db]);

  const getProgress = useCallback((userId: number): UserProgressRow | null => {
    if (!db) return null;
    return getUserProgress(userId);
  }, [db]);

  return {
    db,
    loading,
    error,
    refresh: initialize,
    exportDb,
    importDb,
    getAreas,
    getProgress,
  };
}
