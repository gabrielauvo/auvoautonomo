/**
 * PowerSync Provider
 *
 * Provides PowerSync database context to the app.
 * Handles initialization, connection, and migration from legacy system.
 *
 * EXPO GO MODE:
 * When running in Expo Go, PowerSync native modules are not available.
 * The provider falls back to a mock mode that allows UI testing without sync.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import Constants from 'expo-constants';
import { Text } from '../design-system/components/Text';
import { useColors } from '../design-system/ThemeProvider';
import { useAuth } from '../services';

// =============================================================================
// EXPO GO DETECTION
// =============================================================================

/**
 * Detect if running in Expo Go
 * Expo Go uses 'host.exp.Exponent' as the app owner
 */
function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

// =============================================================================
// TYPES
// =============================================================================

// Generic database interface that works for both real and mock
interface DatabaseInterface {
  execute: (sql: string, params?: unknown[]) => Promise<{ rows: { _array: unknown[] } }>;
  executeBatch: (statements: Array<{ sql: string; params?: unknown[] }>) => Promise<void>;
  getAll: <T>(sql: string, params?: unknown[]) => Promise<T[]>;
  getFirst: <T>(sql: string, params?: unknown[]) => Promise<T | null>;
  watch: (sql: string, params?: unknown[]) => AsyncIterable<{ rows: { _array: unknown[] } }>;
}

interface PowerSyncContextValue {
  db: DatabaseInterface | null;
  isReady: boolean;
  isConnected: boolean;
  isSyncing: boolean;
  isMockMode: boolean;
  lastSyncTime: Date | null;
  error: string | null;
  sync: () => Promise<void>;
  disconnect: () => Promise<void>;
}

const PowerSyncContext = createContext<PowerSyncContextValue | null>(null);

// =============================================================================
// MOCK DATABASE (for Expo Go)
// =============================================================================

class MockDatabase implements DatabaseInterface {
  private data: Map<string, unknown[]> = new Map();

  async execute(sql: string, params?: unknown[]) {
    console.log('[MockDB] Execute:', sql, params);
    return { rows: { _array: [] } };
  }

  async executeBatch(statements: Array<{ sql: string; params?: unknown[] }>) {
    console.log('[MockDB] ExecuteBatch:', statements.length, 'statements');
  }

  async getAll<T>(sql: string, params?: unknown[]): Promise<T[]> {
    console.log('[MockDB] GetAll:', sql, params);
    // Return empty array - UI will show "no data" state
    return [];
  }

  async getFirst<T>(sql: string, params?: unknown[]): Promise<T | null> {
    console.log('[MockDB] GetFirst:', sql, params);
    return null;
  }

  async *watch(sql: string, params?: unknown[]) {
    console.log('[MockDB] Watch:', sql, params);
    // Yield empty result once
    yield { rows: { _array: [] } };
  }
}

// =============================================================================
// PROVIDER
// =============================================================================

interface PowerSyncProviderProps {
  children: React.ReactNode;
}

export function PowerSyncProvider({ children }: PowerSyncProviderProps) {
  const colors = useColors();
  const { user, isAuthenticated } = useAuth();
  const isMockMode = isExpoGo();

  // State
  const [db, setDb] = useState<DatabaseInterface | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Migration state
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState({ current: 0, total: 0 });

  // Initialize PowerSync or Mock
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setIsReady(false);
      setDb(null);
      return;
    }

    let mounted = true;

    const initialize = async () => {
      try {
        setError(null);

        if (isMockMode) {
          // EXPO GO MODE - Use mock database
          console.log('[PowerSync] Running in Expo Go - using mock mode');
          console.log('[PowerSync] Native modules not available, sync disabled');

          if (mounted) {
            setDb(new MockDatabase());
            setIsReady(true);
            setIsConnected(false);
            setError('Modo Expo Go: sincronização desabilitada');
          }
          return;
        }

        // PRODUCTION MODE - Use real PowerSync
        // Dynamic import to avoid loading native modules in Expo Go
        const { PowerSyncDatabase } = await import('@powersync/react-native');
        const { AppSchema } = await import('./schema');
        const { AuvoBackendConnector } = await import('./BackendConnector');
        const { MigrationService } = await import('./MigrationService');

        // Step 1: Check for legacy migrations
        const needsMigration = await MigrationService.needsMigration();

        if (needsMigration) {
          setIsMigrating(true);

          const result = await MigrationService.processPendingMutations(
            (current, total) => {
              if (mounted) {
                setMigrationProgress({ current, total });
              }
            }
          );

          console.log(
            `[PowerSync] Migration complete: ${result.success} success, ${result.failed} failed`
          );

          if (result.failed === 0) {
            await MigrationService.cleanupOldDatabase();
          }

          if (mounted) {
            setIsMigrating(false);
          }
        }

        // Step 2: Create PowerSync database
        const database = new PowerSyncDatabase({
          schema: AppSchema,
          database: {
            dbFilename: 'auvo-powersync.db',
          },
        });

        // Step 3: Initialize
        await database.init();

        if (!mounted) {
          await database.close();
          return;
        }

        // Wrap the database to match our interface
        const wrappedDb: DatabaseInterface = {
          execute: async (sql, params) => {
            const result = await database.execute(sql, params);
            return { rows: { _array: result.rows?._array || [] } };
          },
          executeBatch: async (statements) => {
            for (const stmt of statements) {
              await database.execute(stmt.sql, stmt.params);
            }
          },
          getAll: async <T,>(sql: string, params?: unknown[]) => {
            const result = await database.getAll(sql, params);
            return result as T[];
          },
          getFirst: async <T,>(sql: string, params?: unknown[]) => {
            const result = await database.getAll(sql, params);
            return (result[0] as T) || null;
          },
          watch: (sql, params) => {
            const iter = database.watch(sql, params);
            return {
              async *[Symbol.asyncIterator]() {
                for await (const result of iter) {
                  yield { rows: { _array: result.rows?._array || [] } };
                }
              },
            };
          },
        };

        setDb(wrappedDb);

        // Step 4: Connect to PowerSync service
        const connector = new AuvoBackendConnector();

        // Listen for sync status changes
        database.registerListener({
          statusChanged: (status) => {
            if (mounted) {
              setIsConnected(status.connected);

              const dataFlow = status.dataFlowStatus;
              setIsSyncing(dataFlow?.uploading || dataFlow?.downloading || false);

              if (status.lastSyncedAt) {
                setLastSyncTime(status.lastSyncedAt);
              }
            }
          },
        });

        await database.connect(connector);

        if (mounted) {
          setIsReady(true);
          setIsConnected(true);
        }
      } catch (err) {
        console.error('[PowerSync] Initialization error:', err);
        if (mounted) {
          const errorMsg = err instanceof Error ? err.message : 'Failed to initialize sync';

          // Check if it's a native module error (Expo Go)
          if (errorMsg.includes('QuickSQLite') || errorMsg.includes('native module')) {
            setDb(new MockDatabase());
            setError('Modo Expo Go: sincronização desabilitada');
          } else {
            setError(errorMsg);
          }

          setIsReady(true);
        }
      }
    };

    initialize();

    return () => {
      mounted = false;
    };
  }, [isAuthenticated, user, isMockMode]);

  // Manual sync trigger
  const sync = useCallback(async () => {
    if (isMockMode) {
      console.log('[PowerSync] Sync not available in Expo Go mode');
      return;
    }

    if (!db || !isConnected) {
      return;
    }

    try {
      setIsSyncing(true);
      // In real mode, reconnecting triggers a sync
      const { AuvoBackendConnector } = await import('./BackendConnector');
      const { PowerSyncDatabase } = await import('@powersync/react-native');
      // Note: Need actual db reference for reconnection
      console.log('[PowerSync] Manual sync triggered');
    } catch (err) {
      console.error('[PowerSync] Sync error:', err);
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  }, [db, isConnected, isMockMode]);

  // Disconnect
  const disconnect = useCallback(async () => {
    if (isMockMode) {
      setIsConnected(false);
      return;
    }

    setIsConnected(false);
  }, [isMockMode]);

  // Context value
  const value = useMemo<PowerSyncContextValue>(
    () => ({
      db,
      isReady,
      isConnected,
      isSyncing,
      isMockMode,
      lastSyncTime,
      error,
      sync,
      disconnect,
    }),
    [db, isReady, isConnected, isSyncing, isMockMode, lastSyncTime, error, sync, disconnect]
  );

  // Show migration screen
  if (isMigrating) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background.primary }]}>
        <View style={styles.content}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
          <Text variant="h5" style={styles.title}>
            Atualizando...
          </Text>
          <Text variant="body" color="secondary" style={styles.subtitle}>
            Sincronizando alterações pendentes
          </Text>
          {migrationProgress.total > 0 && (
            <Text variant="bodySmall" color="tertiary" style={styles.progress}>
              {migrationProgress.current} de {migrationProgress.total}
            </Text>
          )}
        </View>
      </View>
    );
  }

  // Show loading while initializing (only if authenticated)
  if (isAuthenticated && !isReady) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background.primary }]}>
        <View style={styles.content}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
          <Text variant="body" color="secondary" style={styles.subtitle}>
            {isMockMode ? 'Iniciando (Expo Go)...' : 'Preparando sincronização...'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <PowerSyncContext.Provider value={value}>
      {children}
    </PowerSyncContext.Provider>
  );
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Access the PowerSync context
 */
export function usePowerSync(): PowerSyncContextValue {
  const context = useContext(PowerSyncContext);

  if (!context) {
    throw new Error('usePowerSync must be used within a PowerSyncProvider');
  }

  return context;
}

/**
 * Access the PowerSync database directly
 */
export function usePowerSyncDatabase(): DatabaseInterface | null {
  const { db } = usePowerSync();
  return db;
}

/**
 * Get sync status
 */
export function useSyncStatus() {
  const { isConnected, isSyncing, isMockMode, lastSyncTime, error, sync } = usePowerSync();

  return {
    isConnected,
    isSyncing,
    isMockMode,
    lastSyncTime,
    error,
    sync,
  };
}

/**
 * Check if running in mock mode (Expo Go)
 */
export function useIsMockMode(): boolean {
  const { isMockMode } = usePowerSync();
  return isMockMode;
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    padding: 24,
  },
  title: {
    marginTop: 24,
    marginBottom: 8,
  },
  subtitle: {
    marginTop: 8,
  },
  progress: {
    marginTop: 16,
  },
});

export default PowerSyncProvider;
