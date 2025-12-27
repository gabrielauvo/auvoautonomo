/**
 * BulkInsertService
 *
 * Serviço para inserções em lote otimizadas com:
 * - Chunks menores para reduzir tempo de lock
 * - Transações separadas por chunk
 * - Bisect para isolar registros inválidos
 * - Métricas detalhadas
 *
 * OTIMIZAÇÃO (Item 6):
 * Substitui o INSERT único gigante por chunks menores, permitindo
 * recuperação parcial em caso de erro e métricas por operação.
 */

import type { SQLiteDatabase, SQLiteBindValue } from 'expo-sqlite';
import { SYNC_FLAGS } from '../config/syncFlags';

// =============================================================================
// TYPES
// =============================================================================

export interface BulkInsertOptions {
  /** Nome da tabela */
  tableName: string;

  /** Colunas a inserir */
  columns: string[];

  /** Tamanho do chunk (override do flag) */
  chunkSize?: number;

  /** Continuar após erro em chunk? */
  continueOnError?: boolean;

  /** Tamanho mínimo para bisect */
  bisectMinSize?: number;

  /** Callback de progresso */
  onProgress?: (progress: BulkInsertProgress) => void;

  /** Callback quando registro inválido é encontrado */
  onInvalidRecord?: (record: unknown, error: Error, index: number) => void;
}

export interface BulkInsertProgress {
  /** Chunk atual (0-indexed) */
  currentChunk: number;

  /** Total de chunks */
  totalChunks: number;

  /** Registros processados até agora */
  processedRecords: number;

  /** Total de registros */
  totalRecords: number;

  /** Porcentagem de progresso */
  percentComplete: number;
}

export interface BulkInsertResult {
  /** Total de registros recebidos */
  totalRecords: number;

  /** Registros inseridos com sucesso */
  insertedRecords: number;

  /** Registros que falharam */
  failedRecords: number;

  /** IDs dos registros que falharam */
  failedIds: string[];

  /** Detalhes dos erros */
  errors: Array<{
    recordId: string;
    recordIndex: number;
    error: string;
  }>;

  /** Métricas de performance */
  metrics: BulkInsertMetrics;
}

export interface BulkInsertMetrics {
  /** Tempo total em ms */
  totalDurationMs: number;

  /** Número de chunks processados */
  chunksProcessed: number;

  /** Chunks com sucesso */
  chunksSucceeded: number;

  /** Chunks que precisaram de bisect */
  chunksBisected: number;

  /** Tempo médio por chunk */
  avgChunkDurationMs: number;

  /** Tempo máximo de um chunk */
  maxChunkDurationMs: number;

  /** Rows por segundo */
  rowsPerSecond: number;

  /** Detalhes por chunk */
  chunkDetails: Array<{
    index: number;
    size: number;
    durationMs: number;
    success: boolean;
    bisected: boolean;
  }>;
}

// =============================================================================
// SERVICE
// =============================================================================

/**
 * Executar bulk insert com chunks e bisect em erro
 */
export async function bulkInsert<T extends Record<string, unknown>>(
  db: SQLiteDatabase,
  records: T[],
  options: BulkInsertOptions
): Promise<BulkInsertResult> {
  const startTime = performance.now();

  const chunkSize = options.chunkSize ?? SYNC_FLAGS.BULK_INSERT_CHUNK_SIZE;
  const continueOnError = options.continueOnError ?? SYNC_FLAGS.BULK_INSERT_CONTINUE_ON_ERROR;
  const bisectMinSize = options.bisectMinSize ?? SYNC_FLAGS.BULK_INSERT_BISECT_MIN_SIZE;

  const result: BulkInsertResult = {
    totalRecords: records.length,
    insertedRecords: 0,
    failedRecords: 0,
    failedIds: [],
    errors: [],
    metrics: {
      totalDurationMs: 0,
      chunksProcessed: 0,
      chunksSucceeded: 0,
      chunksBisected: 0,
      avgChunkDurationMs: 0,
      maxChunkDurationMs: 0,
      rowsPerSecond: 0,
      chunkDetails: [],
    },
  };

  if (records.length === 0) {
    result.metrics.totalDurationMs = performance.now() - startTime;
    return result;
  }

  // Dividir em chunks
  const chunks: T[][] = [];
  for (let i = 0; i < records.length; i += chunkSize) {
    chunks.push(records.slice(i, i + chunkSize));
  }

  let maxChunkDuration = 0;
  let totalChunkDuration = 0;

  // Processar cada chunk
  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    const chunk = chunks[chunkIndex];
    const chunkStartTime = performance.now();
    let chunkSuccess = false;
    let chunkBisected = false;

    // Reportar progresso
    if (options.onProgress) {
      options.onProgress({
        currentChunk: chunkIndex,
        totalChunks: chunks.length,
        processedRecords: result.insertedRecords + result.failedRecords,
        totalRecords: records.length,
        percentComplete: Math.round(((chunkIndex) / chunks.length) * 100),
      });
    }

    try {
      // Tentar inserir chunk inteiro
      await insertChunk(db, chunk, options);
      result.insertedRecords += chunk.length;
      chunkSuccess = true;
    } catch (chunkError) {
      // Chunk falhou - usar bisect para isolar registro(s) inválido(s)
      console.warn(
        `[BulkInsertService] Chunk ${chunkIndex + 1}/${chunks.length} failed, bisecting...`,
        chunkError
      );

      chunkBisected = true;
      const bisectResult = await bisectAndInsert(
        db,
        chunk,
        options,
        bisectMinSize,
        chunkIndex * chunkSize // offset para índice global
      );

      result.insertedRecords += bisectResult.inserted;
      result.failedRecords += bisectResult.failed;
      result.failedIds.push(...bisectResult.failedIds);
      result.errors.push(...bisectResult.errors);

      if (!continueOnError && bisectResult.failed > 0) {
        // Parar no primeiro erro se configurado
        console.error('[BulkInsertService] Stopping due to error (continueOnError=false)');
        break;
      }
    }

    const chunkDuration = performance.now() - chunkStartTime;
    totalChunkDuration += chunkDuration;
    maxChunkDuration = Math.max(maxChunkDuration, chunkDuration);

    result.metrics.chunkDetails.push({
      index: chunkIndex,
      size: chunk.length,
      durationMs: chunkDuration,
      success: chunkSuccess,
      bisected: chunkBisected,
    });

    result.metrics.chunksProcessed++;
    if (chunkSuccess) {
      result.metrics.chunksSucceeded++;
    }
    if (chunkBisected) {
      result.metrics.chunksBisected++;
    }
  }

  // Calcular métricas finais
  const totalDuration = performance.now() - startTime;
  result.metrics.totalDurationMs = totalDuration;
  result.metrics.avgChunkDurationMs = result.metrics.chunksProcessed > 0
    ? totalChunkDuration / result.metrics.chunksProcessed
    : 0;
  result.metrics.maxChunkDurationMs = maxChunkDuration;
  result.metrics.rowsPerSecond = totalDuration > 0
    ? (result.insertedRecords / totalDuration) * 1000
    : 0;

  // Log final
  console.log(
    `[BulkInsertService] Complete: ${result.insertedRecords}/${result.totalRecords} inserted, ` +
    `${result.failedRecords} failed, ${result.metrics.chunksProcessed} chunks, ` +
    `${result.metrics.totalDurationMs.toFixed(0)}ms, ` +
    `${result.metrics.rowsPerSecond.toFixed(0)} rows/s`
  );

  return result;
}

/**
 * Inserir um chunk de registros em uma transação
 */
async function insertChunk<T extends Record<string, unknown>>(
  db: SQLiteDatabase,
  records: T[],
  options: BulkInsertOptions
): Promise<void> {
  if (records.length === 0) return;

  const { tableName, columns } = options;

  // Construir SQL com multi-row INSERT
  const placeholders = records
    .map(() => `(${columns.map(() => '?').join(', ')})`)
    .join(', ');

  const sql = `INSERT OR REPLACE INTO ${tableName} (${columns.join(', ')}) VALUES ${placeholders}`;

  // Construir array de valores
  const values: SQLiteBindValue[] = [];
  for (const record of records) {
    for (const col of columns) {
      const value = record[col];
      if (value === undefined) {
        values.push(null);
      } else if (typeof value === 'boolean') {
        values.push(value ? 1 : 0);
      } else if (typeof value === 'object' && value !== null) {
        values.push(JSON.stringify(value));
      } else {
        values.push(value as SQLiteBindValue);
      }
    }
  }

  // Executar em transação
  await db.withTransactionAsync(async () => {
    await db.runAsync(sql, values);
  });
}

/**
 * Usar bisect para isolar registros inválidos e inserir os válidos
 */
async function bisectAndInsert<T extends Record<string, unknown>>(
  db: SQLiteDatabase,
  records: T[],
  options: BulkInsertOptions,
  minSize: number,
  globalOffset: number
): Promise<{
  inserted: number;
  failed: number;
  failedIds: string[];
  errors: Array<{ recordId: string; recordIndex: number; error: string }>;
}> {
  const result = {
    inserted: 0,
    failed: 0,
    failedIds: [] as string[],
    errors: [] as Array<{ recordId: string; recordIndex: number; error: string }>,
  };

  // Se chunk é pequeno o suficiente, testar um por um
  if (records.length <= minSize) {
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const recordId = (record.id as string) || `index-${globalOffset + i}`;

      try {
        await insertChunk(db, [record], options);
        result.inserted++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.failed++;
        result.failedIds.push(recordId);
        result.errors.push({
          recordId,
          recordIndex: globalOffset + i,
          error: errorMessage,
        });

        if (SYNC_FLAGS.BULK_INSERT_LOG_INVALID_RECORDS) {
          console.error(
            `[BulkInsertService] Invalid record at index ${globalOffset + i}:`,
            recordId,
            errorMessage
          );
        }

        if (options.onInvalidRecord) {
          options.onInvalidRecord(record, error as Error, globalOffset + i);
        }
      }
    }
    return result;
  }

  // Dividir em duas metades e tentar cada uma
  const mid = Math.floor(records.length / 2);
  const firstHalf = records.slice(0, mid);
  const secondHalf = records.slice(mid);

  // Tentar primeira metade
  try {
    await insertChunk(db, firstHalf, options);
    result.inserted += firstHalf.length;
  } catch {
    // Primeira metade falhou - recursão
    const firstResult = await bisectAndInsert(db, firstHalf, options, minSize, globalOffset);
    result.inserted += firstResult.inserted;
    result.failed += firstResult.failed;
    result.failedIds.push(...firstResult.failedIds);
    result.errors.push(...firstResult.errors);
  }

  // Tentar segunda metade
  try {
    await insertChunk(db, secondHalf, options);
    result.inserted += secondHalf.length;
  } catch {
    // Segunda metade falhou - recursão
    const secondResult = await bisectAndInsert(
      db,
      secondHalf,
      options,
      minSize,
      globalOffset + mid
    );
    result.inserted += secondResult.inserted;
    result.failed += secondResult.failed;
    result.failedIds.push(...secondResult.failedIds);
    result.errors.push(...secondResult.errors);
  }

  return result;
}

/**
 * Versão simplificada para uso direto sem todas as opções
 */
export async function simpleBulkInsert<T extends Record<string, unknown>>(
  db: SQLiteDatabase,
  tableName: string,
  records: T[]
): Promise<BulkInsertResult> {
  if (records.length === 0) {
    return {
      totalRecords: 0,
      insertedRecords: 0,
      failedRecords: 0,
      failedIds: [],
      errors: [],
      metrics: {
        totalDurationMs: 0,
        chunksProcessed: 0,
        chunksSucceeded: 0,
        chunksBisected: 0,
        avgChunkDurationMs: 0,
        maxChunkDurationMs: 0,
        rowsPerSecond: 0,
        chunkDetails: [],
      },
    };
  }

  const columns = Object.keys(records[0]);

  return bulkInsert(db, records, {
    tableName,
    columns,
  });
}

/**
 * Versão com streaming para processar registros sem carregar tudo na memória
 *
 * OTIMIZAÇÃO DE MEMÓRIA:
 * - Processa registros em chunks sob demanda
 * - Permite GC liberar memória entre chunks
 * - Ideal para sync de grandes volumes (10k+ registros)
 *
 * Uso:
 * ```typescript
 * async function* fetchRecordsInChunks() {
 *   for (let page = 0; page < totalPages; page++) {
 *     const records = await api.fetchPage(page);
 *     yield records;
 *   }
 * }
 *
 * await bulkInsertStream(db, fetchRecordsInChunks(), options);
 * ```
 */
export async function bulkInsertStream<T extends Record<string, unknown>>(
  db: SQLiteDatabase,
  source: AsyncIterable<T[]>,
  options: BulkInsertOptions
): Promise<BulkInsertResult> {
  const startTime = performance.now();
  const chunkSize = options.chunkSize ?? SYNC_FLAGS.BULK_INSERT_CHUNK_SIZE;
  const continueOnError = options.continueOnError ?? SYNC_FLAGS.BULK_INSERT_CONTINUE_ON_ERROR;
  const bisectMinSize = options.bisectMinSize ?? SYNC_FLAGS.BULK_INSERT_BISECT_MIN_SIZE;

  const result: BulkInsertResult = {
    totalRecords: 0,
    insertedRecords: 0,
    failedRecords: 0,
    failedIds: [],
    errors: [],
    metrics: {
      totalDurationMs: 0,
      chunksProcessed: 0,
      chunksSucceeded: 0,
      chunksBisected: 0,
      avgChunkDurationMs: 0,
      maxChunkDurationMs: 0,
      rowsPerSecond: 0,
      chunkDetails: [],
    },
  };

  let maxChunkDuration = 0;
  let totalChunkDuration = 0;
  let globalOffset = 0;
  let batchBuffer: T[] = [];

  // Processar registros conforme chegam do stream
  for await (const batch of source) {
    batchBuffer.push(...batch);
    result.totalRecords += batch.length;

    // Processar quando buffer atinge tamanho do chunk
    while (batchBuffer.length >= chunkSize) {
      const chunk = batchBuffer.slice(0, chunkSize);
      batchBuffer = batchBuffer.slice(chunkSize);

      const chunkStartTime = performance.now();
      let chunkSuccess = false;
      let chunkBisected = false;

      // Reportar progresso
      if (options.onProgress) {
        options.onProgress({
          currentChunk: result.metrics.chunksProcessed,
          totalChunks: -1, // Desconhecido em streaming
          processedRecords: result.insertedRecords + result.failedRecords,
          totalRecords: result.totalRecords,
          percentComplete: -1, // Desconhecido em streaming
        });
      }

      try {
        await insertChunk(db, chunk, options);
        result.insertedRecords += chunk.length;
        chunkSuccess = true;
      } catch (chunkError) {
        console.warn(
          `[BulkInsertService] Stream chunk failed, bisecting...`,
          chunkError
        );

        chunkBisected = true;
        const bisectResult = await bisectAndInsert(
          db,
          chunk,
          options,
          bisectMinSize,
          globalOffset
        );

        result.insertedRecords += bisectResult.inserted;
        result.failedRecords += bisectResult.failed;
        result.failedIds.push(...bisectResult.failedIds);
        result.errors.push(...bisectResult.errors);

        if (!continueOnError && bisectResult.failed > 0) {
          console.error('[BulkInsertService] Stopping stream due to error');
          break;
        }
      }

      const chunkDuration = performance.now() - chunkStartTime;
      totalChunkDuration += chunkDuration;
      maxChunkDuration = Math.max(maxChunkDuration, chunkDuration);
      globalOffset += chunk.length;

      result.metrics.chunkDetails.push({
        index: result.metrics.chunksProcessed,
        size: chunk.length,
        durationMs: chunkDuration,
        success: chunkSuccess,
        bisected: chunkBisected,
      });

      result.metrics.chunksProcessed++;
      if (chunkSuccess) result.metrics.chunksSucceeded++;
      if (chunkBisected) result.metrics.chunksBisected++;

      // Yield para event loop após cada chunk (permite GC e UI updates)
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  // Processar registros restantes no buffer
  if (batchBuffer.length > 0) {
    const chunkStartTime = performance.now();
    let chunkSuccess = false;
    let chunkBisected = false;

    try {
      await insertChunk(db, batchBuffer, options);
      result.insertedRecords += batchBuffer.length;
      chunkSuccess = true;
    } catch (chunkError) {
      chunkBisected = true;
      const bisectResult = await bisectAndInsert(
        db,
        batchBuffer,
        options,
        bisectMinSize,
        globalOffset
      );

      result.insertedRecords += bisectResult.inserted;
      result.failedRecords += bisectResult.failed;
      result.failedIds.push(...bisectResult.failedIds);
      result.errors.push(...bisectResult.errors);
    }

    const chunkDuration = performance.now() - chunkStartTime;
    totalChunkDuration += chunkDuration;
    maxChunkDuration = Math.max(maxChunkDuration, chunkDuration);

    result.metrics.chunkDetails.push({
      index: result.metrics.chunksProcessed,
      size: batchBuffer.length,
      durationMs: chunkDuration,
      success: chunkSuccess,
      bisected: chunkBisected,
    });

    result.metrics.chunksProcessed++;
    if (chunkSuccess) result.metrics.chunksSucceeded++;
    if (chunkBisected) result.metrics.chunksBisected++;
  }

  // Calcular métricas finais
  const totalDuration = performance.now() - startTime;
  result.metrics.totalDurationMs = totalDuration;
  result.metrics.avgChunkDurationMs = result.metrics.chunksProcessed > 0
    ? totalChunkDuration / result.metrics.chunksProcessed
    : 0;
  result.metrics.maxChunkDurationMs = maxChunkDuration;
  result.metrics.rowsPerSecond = totalDuration > 0
    ? (result.insertedRecords / totalDuration) * 1000
    : 0;

  console.log(
    `[BulkInsertService] Stream complete: ${result.insertedRecords}/${result.totalRecords} inserted, ` +
    `${result.failedRecords} failed, ${result.metrics.chunksProcessed} chunks, ` +
    `${result.metrics.totalDurationMs.toFixed(0)}ms, ` +
    `${result.metrics.rowsPerSecond.toFixed(0)} rows/s`
  );

  return result;
}

export default {
  bulkInsert,
  simpleBulkInsert,
  bulkInsertStream,
};
