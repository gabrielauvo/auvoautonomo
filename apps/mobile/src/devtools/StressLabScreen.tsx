/**
 * StressLabScreen.tsx
 * Dev-only screen for stress testing the app with large datasets
 *
 * Allows:
 * - Populating DB with N clients/work orders (1k/10k/50k/100k)
 * - Running benchmarks (query pagination, search, render lists)
 * - Exporting performance reports
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { generateAbsoluteBatch, type GeneratedBatch } from './StressDataGenerator';
import { perf, getStats, clearStats, getAllMeasurements } from '../observability/perf';
import { logger } from '../observability/Logger';
import { queryCache } from '../observability/QueryCache';
import * as FileSystem from 'expo-file-system';

// Only enable in dev mode
const IS_DEV = __DEV__;

interface BenchmarkResult {
  name: string;
  duration: number;
  itemsProcessed: number;
  itemsPerSecond: number;
}

interface StressTestState {
  isGenerating: boolean;
  isBenchmarking: boolean;
  progress: string;
  results: BenchmarkResult[];
  dbStats: {
    clients: number;
    workOrders: number;
    quotes: number;
    invoices: number;
    checklistTemplates: number;
  } | null;
}

const PRESETS = [
  { label: '1K', clients: 1000, workOrders: 1000, quotes: 500, invoices: 500 },
  { label: '10K', clients: 10000, workOrders: 10000, quotes: 5000, invoices: 5000 },
  { label: '50K', clients: 50000, workOrders: 50000, quotes: 25000, invoices: 25000 },
  { label: '100K', clients: 100000, workOrders: 100000, quotes: 50000, invoices: 50000 },
];

export function StressLabScreen() {
  // Use SQLite context - may be null if not wrapped in provider
  let db: any = null;
  try {
    db = useSQLiteContext();
  } catch {
    // Not in SQLite provider context
  }
  const [state, setState] = useState<StressTestState>({
    isGenerating: false,
    isBenchmarking: false,
    progress: '',
    results: [],
    dbStats: null,
  });
  const abortRef = useRef(false);

  // Get current DB stats
  const refreshDbStats = useCallback(async () => {
    if (!db) return;

    const timer = perf.startTimer('stresslab_refresh_stats');
    try {
      const [clients, workOrders, quotes, invoices, checklistTemplates] = await Promise.all([
        db.getFirstAsync('SELECT COUNT(*) as count FROM clients') as Promise<{ count: number } | null>,
        db.getFirstAsync('SELECT COUNT(*) as count FROM work_orders') as Promise<{ count: number } | null>,
        db.getFirstAsync('SELECT COUNT(*) as count FROM quotes') as Promise<{ count: number } | null>,
        db.getFirstAsync('SELECT COUNT(*) as count FROM invoices') as Promise<{ count: number } | null>,
        db.getFirstAsync('SELECT COUNT(*) as count FROM checklist_templates') as Promise<{ count: number } | null>,
      ]);

      setState(prev => ({
        ...prev,
        dbStats: {
          clients: clients?.count ?? 0,
          workOrders: workOrders?.count ?? 0,
          quotes: quotes?.count ?? 0,
          invoices: invoices?.count ?? 0,
          checklistTemplates: checklistTemplates?.count ?? 0,
        },
      }));
    } finally {
      timer.stop();
    }
  }, [db]);

  // Generate stress test data
  const generateData = useCallback(async (preset: typeof PRESETS[0]) => {
    if (!db) return;

    abortRef.current = false;
    setState(prev => ({ ...prev, isGenerating: true, progress: 'Iniciando geração...' }));
    logger.info('StressLab: Starting data generation', { preset: preset.label });

    const overallTimer = perf.startTimer('stresslab_generate_total');

    try {
      // Use a fake technician ID for stress test data
      const technicianId = 'stress-test-technician-' + Date.now();

      // Generate data in batches to avoid memory issues
      const BATCH_SIZE = 1000;
      let totalGenerated = { clients: 0, workOrders: 0, quotes: 0, invoices: 0, checklistTemplates: 0 };

      // Generate checklist templates first (only need a few)
      setState(prev => ({ ...prev, progress: 'Gerando templates de checklist...' }));
      const templateBatch = generateAbsoluteBatch(technicianId, {
        clients: 0,
        workOrders: 0,
        quotes: 0,
        invoices: 0,
        checklistTemplates: 10, // Large templates with 200+ questions
        questionsPerTemplate: 200,
      });

      // Insert templates
      await insertBatch(db, 'checklist_templates', templateBatch.checklistTemplates);
      totalGenerated.checklistTemplates = templateBatch.checklistTemplates.length;

      // Generate clients in batches
      const clientBatches = Math.ceil(preset.clients / BATCH_SIZE);
      for (let i = 0; i < clientBatches && !abortRef.current; i++) {
        const batchSize = Math.min(BATCH_SIZE, preset.clients - (i * BATCH_SIZE));
        setState(prev => ({
          ...prev,
          progress: `Gerando clientes... ${i * BATCH_SIZE + batchSize}/${preset.clients}`,
        }));

        const batch = generateAbsoluteBatch(technicianId, {
          clients: batchSize,
          workOrders: 0,
          quotes: 0,
          invoices: 0,
          checklistTemplates: 0,
        });

        await insertBatch(db, 'clients', batch.clients);
        totalGenerated.clients += batch.clients.length;
      }

      // Generate work orders in batches
      const woBatches = Math.ceil(preset.workOrders / BATCH_SIZE);
      for (let i = 0; i < woBatches && !abortRef.current; i++) {
        const batchSize = Math.min(BATCH_SIZE, preset.workOrders - (i * BATCH_SIZE));
        setState(prev => ({
          ...prev,
          progress: `Gerando ordens de serviço... ${i * BATCH_SIZE + batchSize}/${preset.workOrders}`,
        }));

        const batch = generateAbsoluteBatch(technicianId, {
          clients: 0,
          workOrders: batchSize,
          quotes: 0,
          invoices: 0,
          checklistTemplates: 0,
        });

        await insertBatch(db, 'work_orders', batch.workOrders);
        totalGenerated.workOrders += batch.workOrders.length;
      }

      // Generate quotes in batches
      const quoteBatches = Math.ceil(preset.quotes / BATCH_SIZE);
      for (let i = 0; i < quoteBatches && !abortRef.current; i++) {
        const batchSize = Math.min(BATCH_SIZE, preset.quotes - (i * BATCH_SIZE));
        setState(prev => ({
          ...prev,
          progress: `Gerando orçamentos... ${i * BATCH_SIZE + batchSize}/${preset.quotes}`,
        }));

        const batch = generateAbsoluteBatch(technicianId, {
          clients: 0,
          workOrders: 0,
          quotes: batchSize,
          invoices: 0,
          checklistTemplates: 0,
        });

        await insertBatch(db, 'quotes', batch.quotes);
        totalGenerated.quotes += batch.quotes.length;
      }

      // Generate invoices in batches
      const invoiceBatches = Math.ceil(preset.invoices / BATCH_SIZE);
      for (let i = 0; i < invoiceBatches && !abortRef.current; i++) {
        const batchSize = Math.min(BATCH_SIZE, preset.invoices - (i * BATCH_SIZE));
        setState(prev => ({
          ...prev,
          progress: `Gerando faturas... ${i * BATCH_SIZE + batchSize}/${preset.invoices}`,
        }));

        const batch = generateAbsoluteBatch(technicianId, {
          clients: 0,
          workOrders: 0,
          quotes: 0,
          invoices: batchSize,
          checklistTemplates: 0,
        });

        await insertBatch(db, 'invoices', batch.invoices);
        totalGenerated.invoices += batch.invoices.length;
      }

      logger.info('StressLab: Data generation complete', totalGenerated);
      setState(prev => ({
        ...prev,
        progress: abortRef.current ? 'Geração cancelada' : 'Geração concluída!',
      }));

      await refreshDbStats();
    } catch (error) {
      logger.error('StressLab: Data generation failed', { error: String(error) });
      Alert.alert('Erro', 'Falha ao gerar dados: ' + String(error));
    } finally {
      overallTimer.stop();
      setState(prev => ({ ...prev, isGenerating: false }));
    }
  }, [db, refreshDbStats]);

  // Insert batch of records
  async function insertBatch(database: any, table: string, records: any[]) {
    if (records.length === 0) return;

    const timer = perf.startTimer(`stresslab_insert_${table}`);
    try {
      // Get column names from first record
      const columns = Object.keys(records[0]);
      const placeholders = columns.map(() => '?').join(', ');
      const sql = `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;

      // Use transaction for batch insert
      await database.withTransactionAsync(async () => {
        for (const record of records) {
          const values = columns.map(col => {
            const val = record[col];
            // Convert objects to JSON strings
            if (typeof val === 'object' && val !== null) {
              return JSON.stringify(val);
            }
            return val;
          });
          await database.runAsync(sql, values);
        }
      });
    } finally {
      timer.stop();
    }
  }

  // Run benchmarks
  const runBenchmarks = useCallback(async () => {
    if (!db) return;

    setState(prev => ({ ...prev, isBenchmarking: true, progress: 'Iniciando benchmarks...', results: [] }));
    logger.info('StressLab: Starting benchmarks');
    clearStats();

    const results: BenchmarkResult[] = [];

    try {
      // Benchmark 1: Query clients with pagination
      setState(prev => ({ ...prev, progress: 'Benchmark: Paginação de clientes...' }));
      const paginationResult = await benchmarkPagination(db, 'clients', 50);
      results.push(paginationResult);

      // Benchmark 2: Search clients by name
      setState(prev => ({ ...prev, progress: 'Benchmark: Busca por nome...' }));
      const searchResult = await benchmarkSearch(db, 'clients', 'name', 'Silva');
      results.push(searchResult);

      // Benchmark 3: Query work orders by status
      setState(prev => ({ ...prev, progress: 'Benchmark: Filtro por status...' }));
      const statusResult = await benchmarkFilter(db, 'work_orders', 'status', 'PENDING');
      results.push(statusResult);

      // Benchmark 4: Count aggregation
      setState(prev => ({ ...prev, progress: 'Benchmark: Agregação COUNT...' }));
      const countResult = await benchmarkCount(db);
      results.push(countResult);

      // Benchmark 5: JOIN query
      setState(prev => ({ ...prev, progress: 'Benchmark: Query com JOIN...' }));
      const joinResult = await benchmarkJoin(db);
      results.push(joinResult);

      // Benchmark 6: Full table scan
      setState(prev => ({ ...prev, progress: 'Benchmark: Full table scan...' }));
      const scanResult = await benchmarkFullScan(db, 'clients');
      results.push(scanResult);

      // Benchmark 7: Index performance
      setState(prev => ({ ...prev, progress: 'Benchmark: Performance de índice...' }));
      const indexResult = await benchmarkIndexedQuery(db);
      results.push(indexResult);

      // Benchmark 8: Cache performance
      setState(prev => ({ ...prev, progress: 'Benchmark: Performance de cache...' }));
      const cacheResult = await benchmarkCache(db);
      results.push(cacheResult);

      setState(prev => ({
        ...prev,
        progress: 'Benchmarks concluídos!',
        results,
      }));

      logger.info('StressLab: Benchmarks complete', { resultsCount: results.length });
    } catch (error) {
      logger.error('StressLab: Benchmark failed', { error: String(error) });
      Alert.alert('Erro', 'Falha nos benchmarks: ' + String(error));
    } finally {
      setState(prev => ({ ...prev, isBenchmarking: false }));
    }
  }, [db]);

  // Benchmark: Pagination
  async function benchmarkPagination(database: any, table: string, pageSize: number): Promise<BenchmarkResult> {
    const timer = perf.startTimer('benchmark_pagination');
    let totalItems = 0;
    let page = 0;
    const maxPages = 100; // Limit to avoid infinite loop

    while (page < maxPages) {
      const offset = page * pageSize;
      const rows = await database.getAllAsync(
        `SELECT * FROM ${table} LIMIT ? OFFSET ?`,
        [pageSize, offset]
      );

      if (rows.length === 0) break;
      totalItems += rows.length;
      page++;
    }

    const duration = timer.stop();
    return {
      name: `Paginação ${table} (${pageSize}/página)`,
      duration,
      itemsProcessed: totalItems,
      itemsPerSecond: totalItems / (duration / 1000),
    };
  }

  // Benchmark: Search
  async function benchmarkSearch(database: any, table: string, column: string, term: string): Promise<BenchmarkResult> {
    const timer = perf.startTimer('benchmark_search');

    const rows = await database.getAllAsync(
      `SELECT * FROM ${table} WHERE ${column} LIKE ?`,
      [`%${term}%`]
    );

    const duration = timer.stop();
    return {
      name: `Busca em ${table}.${column}`,
      duration,
      itemsProcessed: rows.length,
      itemsPerSecond: rows.length / (duration / 1000),
    };
  }

  // Benchmark: Filter by status
  async function benchmarkFilter(database: any, table: string, column: string, value: string): Promise<BenchmarkResult> {
    const timer = perf.startTimer('benchmark_filter');

    const rows = await database.getAllAsync(
      `SELECT * FROM ${table} WHERE ${column} = ?`,
      [value]
    );

    const duration = timer.stop();
    return {
      name: `Filtro ${table}.${column}=${value}`,
      duration,
      itemsProcessed: rows.length,
      itemsPerSecond: rows.length / (duration / 1000),
    };
  }

  // Benchmark: Count aggregation
  async function benchmarkCount(database: any): Promise<BenchmarkResult> {
    const timer = perf.startTimer('benchmark_count');

    const tables = ['clients', 'work_orders', 'quotes', 'invoices'];
    let totalQueries = 0;

    for (const table of tables) {
      await database.getFirstAsync(`SELECT COUNT(*) as count FROM ${table}`);
      totalQueries++;
    }

    const duration = timer.stop();
    return {
      name: 'COUNT em todas tabelas',
      duration,
      itemsProcessed: totalQueries,
      itemsPerSecond: totalQueries / (duration / 1000),
    };
  }

  // Benchmark: JOIN query
  async function benchmarkJoin(database: any): Promise<BenchmarkResult> {
    const timer = perf.startTimer('benchmark_join');

    const rows = await database.getAllAsync(`
      SELECT wo.*, c.name as client_name
      FROM work_orders wo
      LEFT JOIN clients c ON wo.client_id = c.id
      LIMIT 1000
    `);

    const duration = timer.stop();
    return {
      name: 'JOIN work_orders + clients',
      duration,
      itemsProcessed: rows.length,
      itemsPerSecond: rows.length / (duration / 1000),
    };
  }

  // Benchmark: Full table scan
  async function benchmarkFullScan(database: any, table: string): Promise<BenchmarkResult> {
    const timer = perf.startTimer('benchmark_full_scan');

    const rows = await database.getAllAsync(`SELECT * FROM ${table}`);

    const duration = timer.stop();
    return {
      name: `Full scan ${table}`,
      duration,
      itemsProcessed: rows.length,
      itemsPerSecond: rows.length / (duration / 1000),
    };
  }

  // Benchmark: Indexed query
  async function benchmarkIndexedQuery(database: any): Promise<BenchmarkResult> {
    const timer = perf.startTimer('benchmark_indexed');

    // Query using indexed column (technician_id)
    const rows = await database.getAllAsync(
      `SELECT * FROM clients WHERE technician_id = ? LIMIT 1000`,
      ['stress-test-technician-' + Date.now()]
    );

    const duration = timer.stop();
    return {
      name: 'Query por índice (technician_id)',
      duration,
      itemsProcessed: rows.length,
      itemsPerSecond: rows.length > 0 ? rows.length / (duration / 1000) : 0,
    };
  }

  // Benchmark: Cache performance
  async function benchmarkCache(database: any): Promise<BenchmarkResult> {
    const cacheKey = 'benchmark_cache_test';

    // Clear cache first
    queryCache.clear();

    // First query (cache miss)
    const timer1 = perf.startTimer('benchmark_cache_miss');
    await queryCache.getOrSet(cacheKey, async () => {
      return database.getFirstAsync(`SELECT COUNT(*) as count FROM clients`);
    }, { ttl: 60000 });
    const missDuration = timer1.stop();

    // Second query (cache hit)
    const timer2 = perf.startTimer('benchmark_cache_hit');
    await queryCache.getOrSet(cacheKey, async () => {
      return database.getFirstAsync(`SELECT COUNT(*) as count FROM clients`);
    }, { ttl: 60000 });
    const hitDuration = timer2.stop();

    return {
      name: `Cache (miss: ${missDuration.toFixed(2)}ms, hit: ${hitDuration.toFixed(2)}ms)`,
      duration: missDuration + hitDuration,
      itemsProcessed: 2,
      itemsPerSecond: 2 / ((missDuration + hitDuration) / 1000),
    };
  }

  // Export report
  const exportReport = useCallback(async () => {
    const stats = getAllMeasurements();
    const report = {
      timestamp: new Date().toISOString(),
      dbStats: state.dbStats,
      benchmarkResults: state.results,
      performanceStats: Object.fromEntries(
        Object.entries(stats).map(([key, values]) => [key, getStats(key)])
      ),
    };

    const reportJson = JSON.stringify(report, null, 2);

    // Log to console
    console.log('=== STRESS LAB REPORT ===');
    console.log(reportJson);
    console.log('=========================');

    // Save to file
    try {
      const fileName = `stress-report-${Date.now()}.json`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(filePath, reportJson);

      Alert.alert(
        'Relatório Exportado',
        `Salvo em: ${fileName}\n\nTambém impresso no console.`
      );

      logger.info('StressLab: Report exported', { filePath });
    } catch (error) {
      Alert.alert('Aviso', 'Relatório impresso no console (falha ao salvar arquivo)');
    }
  }, [state.dbStats, state.results]);

  // Clear all stress test data
  const clearData = useCallback(async () => {
    if (!db) return;

    Alert.alert(
      'Limpar Dados',
      'Isso irá remover TODOS os dados de stress test. Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpar',
          style: 'destructive',
          onPress: async () => {
            setState(prev => ({ ...prev, isGenerating: true, progress: 'Limpando dados...' }));

            try {
              await db.withTransactionAsync(async () => {
                // Delete in correct order due to foreign keys
                await db.runAsync('DELETE FROM checklist_answers');
                await db.runAsync('DELETE FROM checklist_instances');
                await db.runAsync('DELETE FROM checklist_template_items');
                await db.runAsync('DELETE FROM checklist_templates');
                await db.runAsync('DELETE FROM signatures');
                await db.runAsync('DELETE FROM invoices');
                await db.runAsync('DELETE FROM quotes');
                await db.runAsync('DELETE FROM work_orders');
                await db.runAsync('DELETE FROM clients');
              });

              queryCache.clear();
              clearStats();

              setState(prev => ({
                ...prev,
                progress: 'Dados limpos!',
                results: [],
              }));

              await refreshDbStats();
              logger.info('StressLab: All data cleared');
            } catch (error) {
              logger.error('StressLab: Clear data failed', { error: String(error) });
              Alert.alert('Erro', 'Falha ao limpar dados: ' + String(error));
            } finally {
              setState(prev => ({ ...prev, isGenerating: false }));
            }
          },
        },
      ]
    );
  }, [db, refreshDbStats]);

  // Cancel generation
  const cancelGeneration = useCallback(() => {
    abortRef.current = true;
  }, []);

  // Initial load
  React.useEffect(() => {
    refreshDbStats();
  }, [refreshDbStats]);

  if (!IS_DEV) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>StressLab não disponível</Text>
        <Text style={styles.subtitle}>Disponível apenas em modo de desenvolvimento</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>🧪 StressLab</Text>
        <Text style={styles.subtitle}>Teste de performance com grandes volumes</Text>

        {/* DB Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Estado do Banco</Text>
          {state.dbStats ? (
            <View style={styles.statsGrid}>
              <StatItem label="Clientes" value={state.dbStats.clients} />
              <StatItem label="Ordens" value={state.dbStats.workOrders} />
              <StatItem label="Orçamentos" value={state.dbStats.quotes} />
              <StatItem label="Faturas" value={state.dbStats.invoices} />
              <StatItem label="Templates" value={state.dbStats.checklistTemplates} />
            </View>
          ) : (
            <ActivityIndicator />
          )}
          <TouchableOpacity style={styles.buttonSmall} onPress={refreshDbStats}>
            <Text style={styles.buttonTextSmall}>Atualizar</Text>
          </TouchableOpacity>
        </View>

        {/* Generate Data */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏭 Gerar Dados</Text>
          <View style={styles.presetGrid}>
            {PRESETS.map(preset => (
              <TouchableOpacity
                key={preset.label}
                style={[styles.presetButton, state.isGenerating && styles.buttonDisabled]}
                onPress={() => generateData(preset)}
                disabled={state.isGenerating || state.isBenchmarking}
              >
                <Text style={styles.presetLabel}>{preset.label}</Text>
                <Text style={styles.presetDetail}>{preset.clients.toLocaleString()} clientes</Text>
              </TouchableOpacity>
            ))}
          </View>
          {state.isGenerating && (
            <View style={styles.progressContainer}>
              <ActivityIndicator />
              <Text style={styles.progressText}>{state.progress}</Text>
              <TouchableOpacity style={styles.cancelButton} onPress={cancelGeneration}>
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Benchmarks */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚡ Benchmarks</Text>
          <TouchableOpacity
            style={[styles.button, (state.isGenerating || state.isBenchmarking) && styles.buttonDisabled]}
            onPress={runBenchmarks}
            disabled={state.isGenerating || state.isBenchmarking}
          >
            {state.isBenchmarking ? (
              <>
                <ActivityIndicator color="#fff" />
                <Text style={styles.buttonText}> {state.progress}</Text>
              </>
            ) : (
              <Text style={styles.buttonText}>Executar Benchmarks</Text>
            )}
          </TouchableOpacity>

          {state.results.length > 0 && (
            <View style={styles.resultsContainer}>
              {state.results.map((result, index) => (
                <View key={index} style={styles.resultItem}>
                  <Text style={styles.resultName}>{result.name}</Text>
                  <Text style={styles.resultDetail}>
                    {result.duration.toFixed(2)}ms | {result.itemsProcessed.toLocaleString()} items | {result.itemsPerSecond.toFixed(0)}/s
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🛠 Ações</Text>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.actionExport]}
              onPress={exportReport}
              disabled={state.isGenerating || state.isBenchmarking}
            >
              <Text style={styles.actionButtonText}>📄 Exportar Relatório</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.actionClear]}
              onPress={clearData}
              disabled={state.isGenerating || state.isBenchmarking}
            >
              <Text style={styles.actionButtonText}>🗑 Limpar Dados</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Stat item component
function StatItem({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{value.toLocaleString()}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 24,
  },
  section: {
    backgroundColor: '#252542',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
    minWidth: 80,
    marginVertical: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4ade80',
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  buttonSmall: {
    backgroundColor: '#3b82f6',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'center',
  },
  buttonTextSmall: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  presetButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    padding: 12,
    width: '48%',
    marginBottom: 8,
    alignItems: 'center',
  },
  presetLabel: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  presetDetail: {
    fontSize: 12,
    color: '#ddd',
    marginTop: 4,
  },
  button: {
    backgroundColor: '#8b5cf6',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    flexWrap: 'wrap',
  },
  progressText: {
    color: '#888',
    marginLeft: 8,
    fontSize: 14,
  },
  cancelButton: {
    marginLeft: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#ef4444',
    borderRadius: 6,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  resultsContainer: {
    marginTop: 16,
  },
  resultItem: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  resultName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  resultDetail: {
    color: '#4ade80',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  actionExport: {
    backgroundColor: '#059669',
  },
  actionClear: {
    backgroundColor: '#dc2626',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default StressLabScreen;
