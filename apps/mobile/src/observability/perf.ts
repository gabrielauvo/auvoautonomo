/**
 * Performance Instrumentation
 *
 * Utilitários para medir e instrumentar performance do app.
 * Suporta marks, measures, e logs estruturados.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface PerfMark {
  name: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface PerfMeasure {
  name: string;
  startTime: number;
  endTime: number;
  duration: number;
  metadata?: Record<string, unknown>;
}

export interface PerfLog {
  event: string;
  duration?: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface PerfStats {
  count: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
}

// =============================================================================
// PERFORMANCE MONITOR
// =============================================================================

class PerformanceMonitor {
  private marks: Map<string, PerfMark> = new Map();
  private measures: PerfMeasure[] = [];
  private measuresByName: Map<string, number[]> = new Map();
  private listeners: Set<(log: PerfLog) => void> = new Set();
  private enabled: boolean = __DEV__;
  private maxMeasures: number = 1000;

  // =============================================================================
  // MARKS
  // =============================================================================

  /**
   * Create a performance mark
   */
  mark(name: string, metadata?: Record<string, unknown>): void {
    if (!this.enabled) return;

    this.marks.set(name, {
      name,
      timestamp: performance.now(),
      metadata,
    });
  }

  /**
   * Get a mark by name
   */
  getMark(name: string): PerfMark | undefined {
    return this.marks.get(name);
  }

  /**
   * Clear a mark
   */
  clearMark(name: string): void {
    this.marks.delete(name);
  }

  /**
   * Clear all marks
   */
  clearMarks(): void {
    this.marks.clear();
  }

  // =============================================================================
  // MEASURES
  // =============================================================================

  /**
   * Measure time between two marks or from a mark to now
   */
  measure(
    name: string,
    startMark: string,
    endMark?: string,
    metadata?: Record<string, unknown>
  ): PerfMeasure | null {
    if (!this.enabled) return null;

    const start = this.marks.get(startMark);
    if (!start) {
      console.warn(`[Perf] Start mark "${startMark}" not found`);
      return null;
    }

    const end = endMark ? this.marks.get(endMark) : null;
    const endTime = end ? end.timestamp : performance.now();

    const measure: PerfMeasure = {
      name,
      startTime: start.timestamp,
      endTime,
      duration: endTime - start.timestamp,
      metadata: { ...start.metadata, ...metadata },
    };

    this.recordMeasure(measure);
    return measure;
  }

  /**
   * Measure duration of an async operation
   */
  async measureAsync<T>(
    name: string,
    operation: () => Promise<T>,
    metadata?: Record<string, unknown>
  ): Promise<{ result: T; duration: number }> {
    const startTime = performance.now();

    try {
      const result = await operation();
      const duration = performance.now() - startTime;

      if (this.enabled) {
        const measure: PerfMeasure = {
          name,
          startTime,
          endTime: performance.now(),
          duration,
          metadata,
        };
        this.recordMeasure(measure);
      }

      return { result, duration };
    } catch (error) {
      const duration = performance.now() - startTime;

      if (this.enabled) {
        const measure: PerfMeasure = {
          name: `${name}_error`,
          startTime,
          endTime: performance.now(),
          duration,
          metadata: { ...metadata, error: String(error) },
        };
        this.recordMeasure(measure);
      }

      throw error;
    }
  }

  /**
   * Measure duration of a sync operation
   */
  measureSync<T>(
    name: string,
    operation: () => T,
    metadata?: Record<string, unknown>
  ): { result: T; duration: number } {
    const startTime = performance.now();

    try {
      const result = operation();
      const duration = performance.now() - startTime;

      if (this.enabled) {
        const measure: PerfMeasure = {
          name,
          startTime,
          endTime: performance.now(),
          duration,
          metadata,
        };
        this.recordMeasure(measure);
      }

      return { result, duration };
    } catch (error) {
      const duration = performance.now() - startTime;

      if (this.enabled) {
        const measure: PerfMeasure = {
          name: `${name}_error`,
          startTime,
          endTime: performance.now(),
          duration,
          metadata: { ...metadata, error: String(error) },
        };
        this.recordMeasure(measure);
      }

      throw error;
    }
  }

  /**
   * Start a timer and return a stop function
   * Returns an object with stop() method for convenience
   */
  startTimer(
    name: string,
    metadata?: Record<string, unknown>
  ): { stop: () => number; stopAndGetMeasure: () => PerfMeasure } {
    const startTime = performance.now();
    let stopped = false;
    let finalDuration = 0;

    const stopFn = (): PerfMeasure => {
      if (stopped) {
        return {
          name,
          startTime,
          endTime: startTime + finalDuration,
          duration: finalDuration,
          metadata,
        };
      }

      stopped = true;
      const endTime = performance.now();
      finalDuration = endTime - startTime;

      const measure: PerfMeasure = {
        name,
        startTime,
        endTime,
        duration: finalDuration,
        metadata,
      };

      if (this.enabled) {
        this.recordMeasure(measure);
      }

      return measure;
    };

    return {
      stop: () => {
        const measure = stopFn();
        return measure.duration;
      },
      stopAndGetMeasure: stopFn,
    };
  }

  private recordMeasure(measure: PerfMeasure): void {
    // Store measure
    this.measures.push(measure);

    // Keep measures bounded
    if (this.measures.length > this.maxMeasures) {
      this.measures.shift();
    }

    // Track by name for stats
    const durations = this.measuresByName.get(measure.name) || [];
    durations.push(measure.duration);
    if (durations.length > 100) {
      durations.shift();
    }
    this.measuresByName.set(measure.name, durations);

    // Emit log
    this.emitLog({
      event: measure.name,
      duration: measure.duration,
      timestamp: new Date().toISOString(),
      metadata: measure.metadata,
    });
  }

  // =============================================================================
  // STATISTICS
  // =============================================================================

  /**
   * Get statistics for a measure name
   */
  getStats(name: string): PerfStats | null {
    const durations = this.measuresByName.get(name);
    if (!durations || durations.length === 0) return null;

    const sorted = [...durations].sort((a, b) => a - b);
    const count = sorted.length;

    return {
      count,
      min: sorted[0],
      max: sorted[count - 1],
      avg: sorted.reduce((a, b) => a + b, 0) / count,
      p50: sorted[Math.floor(count * 0.5)],
      p95: sorted[Math.floor(count * 0.95)],
      p99: sorted[Math.floor(count * 0.99)],
    };
  }

  /**
   * Get all stats
   */
  getAllStats(): Record<string, PerfStats> {
    const stats: Record<string, PerfStats> = {};

    for (const name of this.measuresByName.keys()) {
      const stat = this.getStats(name);
      if (stat) {
        stats[name] = stat;
      }
    }

    return stats;
  }

  /**
   * Get recent measures
   */
  getRecentMeasures(limit: number = 100): PerfMeasure[] {
    return this.measures.slice(-limit);
  }

  // =============================================================================
  // LOGGING
  // =============================================================================

  /**
   * Log a performance event
   */
  logPerf(
    event: string,
    duration?: number,
    metadata?: Record<string, unknown>
  ): void {
    if (!this.enabled) return;

    const log: PerfLog = {
      event,
      duration,
      timestamp: new Date().toISOString(),
      metadata,
    };

    this.emitLog(log);
  }

  private emitLog(log: PerfLog): void {
    // Console log in dev
    if (__DEV__) {
      const durationStr = log.duration !== undefined
        ? ` (${log.duration.toFixed(2)}ms)`
        : '';
      console.log(`[Perf] ${log.event}${durationStr}`, log.metadata || '');
    }

    // Notify listeners
    this.listeners.forEach((listener) => {
      try {
        listener(log);
      } catch (error) {
        console.error('[Perf] Listener error:', error);
      }
    });
  }

  /**
   * Subscribe to performance logs
   */
  subscribe(listener: (log: PerfLog) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // =============================================================================
  // CONFIGURATION
  // =============================================================================

  /**
   * Enable/disable performance monitoring
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.marks.clear();
    this.measures = [];
    this.measuresByName.clear();
  }

  // =============================================================================
  // EXPORT
  // =============================================================================

  /**
   * Export all performance data
   */
  exportData(): {
    marks: Array<{ name: string; timestamp: number }>;
    measures: PerfMeasure[];
    stats: Record<string, PerfStats>;
  } {
    return {
      marks: Array.from(this.marks.values()).map((m) => ({
        name: m.name,
        timestamp: m.timestamp,
      })),
      measures: [...this.measures],
      stats: this.getAllStats(),
    };
  }

  /**
   * Export as JSON string
   */
  exportJSON(): string {
    return JSON.stringify(this.exportData(), null, 2);
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

export const perf = new PerformanceMonitor();

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

export const mark = perf.mark.bind(perf);
export const measure = perf.measure.bind(perf);
export const measureAsync = perf.measureAsync.bind(perf);
export const measureSync = perf.measureSync.bind(perf);
export const startTimer = perf.startTimer.bind(perf);
export const logPerf = perf.logPerf.bind(perf);
export const getStats = perf.getStats.bind(perf);
export const getAllStats = perf.getAllStats.bind(perf);
export const clearStats = perf.clear.bind(perf);

/**
 * Get all measurements organized by name
 */
export function getAllMeasurements(): Record<string, number[]> {
  // Access internal data through export
  const data = perf.exportData();
  const measurements: Record<string, number[]> = {};

  for (const measure of data.measures) {
    if (!measurements[measure.name]) {
      measurements[measure.name] = [];
    }
    measurements[measure.name].push(measure.duration);
  }

  return measurements;
}

// =============================================================================
// DECORATORS (for class methods)
// =============================================================================

/**
 * Decorator to measure method execution time
 */
export function Measured(name?: string) {
  return function (
    _target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const measureName = name || propertyKey;

    descriptor.value = async function (...args: unknown[]) {
      const timer = perf.startTimer(measureName);
      try {
        const result = await originalMethod.apply(this, args);
        timer.stop();
        return result;
      } catch (error) {
        timer.stop();
        throw error;
      }
    };

    return descriptor;
  };
}

export default perf;
