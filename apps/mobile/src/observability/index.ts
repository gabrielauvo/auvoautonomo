/**
 * Observability Module
 *
 * Exportação centralizada dos utilitários de observabilidade.
 */

export {
  perf,
  mark,
  measure,
  measureAsync,
  measureSync,
  startTimer,
  logPerf,
  getStats,
  Measured,
} from './perf';
export type {
  PerfMark,
  PerfMeasure,
  PerfLog,
  PerfStats,
} from './perf';

export {
  logger,
  testSanitization,
} from './Logger';
export type {
  LogLevel,
  LogContext,
  LogEntry,
  Breadcrumb,
} from './Logger';

// Re-export cache module (to be implemented)
export * from './QueryCache';
