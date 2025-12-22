/**
 * PowerSync Hooks
 *
 * Custom hooks for working with PowerSync in React components.
 * These hooks are compatible with both Expo Go (mock mode) and production builds.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { usePowerSyncDatabase, usePowerSync } from './PowerSyncProvider';

// =============================================================================
// QUERY HOOKS
// =============================================================================

/**
 * Execute a one-time query
 */
export function useQuery<T>(
  sql: string,
  parameters?: (string | number | null)[]
): {
  data: T[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
} {
  const db = usePowerSyncDatabase();
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!db) {
      setData([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const result = await db.getAll<T>(sql, parameters);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, [db, sql, JSON.stringify(parameters)]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}

/**
 * Execute a query that returns a single row
 */
export function useQueryFirst<T>(
  sql: string,
  parameters?: (string | number | null)[]
): {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
} {
  const db = usePowerSyncDatabase();
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!db) {
      setData(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const result = await db.getFirst<T>(sql, parameters);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [db, sql, JSON.stringify(parameters)]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}

/**
 * Watch a query for real-time updates
 * In mock mode (Expo Go), this just executes the query once
 */
export function usePowerSyncWatchedQuery<T>(
  sql: string,
  parameters?: (string | number | null)[]
): {
  data: T[];
  isLoading: boolean;
  error: Error | null;
} {
  const db = usePowerSyncDatabase();
  const { isMockMode } = usePowerSync();
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!db) {
      setData([]);
      setIsLoading(false);
      return;
    }

    // Cancel previous watcher
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    const watchQuery = async () => {
      try {
        setIsLoading(true);
        setError(null);

        if (isMockMode) {
          // In mock mode, just execute once
          const result = await db.getAll<T>(sql, parameters);
          setData(result);
          setIsLoading(false);
          return;
        }

        // In production mode, use the async iterator
        const watcher = db.watch(sql, parameters);

        for await (const result of watcher) {
          if (abortControllerRef.current?.signal.aborted) {
            break;
          }

          const rows = result.rows?._array || [];
          setData(rows as T[]);
          setIsLoading(false);
        }
      } catch (err) {
        if (abortControllerRef.current?.signal.aborted) {
          return;
        }

        console.error('[PowerSync] Watch query error:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setData([]);
        setIsLoading(false);
      }
    };

    watchQuery();

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [db, sql, JSON.stringify(parameters), isMockMode]);

  return { data, isLoading, error };
}

// =============================================================================
// MUTATION HOOKS
// =============================================================================

/**
 * Hook for executing database mutations (INSERT, UPDATE, DELETE)
 */
export function useMutation() {
  const db = usePowerSyncDatabase();
  const { isMockMode } = usePowerSync();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(
    async (sql: string, parameters?: (string | number | null)[]): Promise<void> => {
      if (!db) {
        if (isMockMode) {
          console.log('[MockDB] Execute mutation:', sql, parameters);
          return;
        }
        throw new Error('Database not initialized');
      }

      try {
        setIsLoading(true);
        setError(null);

        await db.execute(sql, parameters);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [db, isMockMode]
  );

  const executeBatch = useCallback(
    async (
      statements: Array<{ sql: string; params?: (string | number | null)[] }>
    ): Promise<void> => {
      if (!db) {
        if (isMockMode) {
          console.log('[MockDB] Execute batch:', statements.length, 'statements');
          return;
        }
        throw new Error('Database not initialized');
      }

      try {
        setIsLoading(true);
        setError(null);

        await db.executeBatch(statements);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [db, isMockMode]
  );

  return {
    execute,
    executeBatch,
    isLoading,
    error,
  };
}

// =============================================================================
// ENTITY HOOKS
// =============================================================================

/**
 * Hook for managing a single entity (CRUD operations)
 */
export function useEntity<T extends { id: string }>(tableName: string) {
  const db = usePowerSyncDatabase();
  const { isMockMode } = usePowerSync();

  const getById = useCallback(
    async (id: string): Promise<T | null> => {
      if (!db) {
        if (isMockMode) {
          console.log('[MockDB] GetById:', tableName, id);
          return null;
        }
        return null;
      }

      return db.getFirst<T>(`SELECT * FROM ${tableName} WHERE id = ?`, [id]);
    },
    [db, tableName, isMockMode]
  );

  const getAll = useCallback(
    async (where?: string, params?: (string | number | null)[]): Promise<T[]> => {
      if (!db) {
        if (isMockMode) {
          console.log('[MockDB] GetAll:', tableName, where, params);
          return [];
        }
        return [];
      }

      const sql = where
        ? `SELECT * FROM ${tableName} WHERE ${where}`
        : `SELECT * FROM ${tableName}`;

      return db.getAll<T>(sql, params);
    },
    [db, tableName, isMockMode]
  );

  const create = useCallback(
    async (data: Omit<T, 'id'> & { id: string }): Promise<void> => {
      if (!db) {
        if (isMockMode) {
          console.log('[MockDB] Create:', tableName, data);
          return;
        }
        throw new Error('Database not initialized');
      }

      const keys = Object.keys(data);
      const values = Object.values(data);
      const placeholders = keys.map(() => '?').join(', ');

      await db.execute(
        `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders})`,
        values as (string | number | null)[]
      );
    },
    [db, tableName, isMockMode]
  );

  const update = useCallback(
    async (id: string, data: Partial<T>): Promise<void> => {
      if (!db) {
        if (isMockMode) {
          console.log('[MockDB] Update:', tableName, id, data);
          return;
        }
        throw new Error('Database not initialized');
      }

      const keys = Object.keys(data);
      const values = Object.values(data);
      const setClause = keys.map((key) => `${key} = ?`).join(', ');

      await db.execute(
        `UPDATE ${tableName} SET ${setClause} WHERE id = ?`,
        [...values, id] as (string | number | null)[]
      );
    },
    [db, tableName, isMockMode]
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      if (!db) {
        if (isMockMode) {
          console.log('[MockDB] Remove:', tableName, id);
          return;
        }
        throw new Error('Database not initialized');
      }

      await db.execute(`DELETE FROM ${tableName} WHERE id = ?`, [id]);
    },
    [db, tableName, isMockMode]
  );

  return {
    getById,
    getAll,
    create,
    update,
    remove,
  };
}
