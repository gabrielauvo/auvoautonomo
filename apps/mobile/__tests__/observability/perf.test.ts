/**
 * Performance Instrumentation Tests
 */

import {
  perf,
  mark,
  measure,
  measureAsync,
  measureSync,
  startTimer,
  getStats,
  getAllMeasurements,
  clearStats,
} from '../../src/observability/perf';

describe('Performance Instrumentation', () => {
  beforeEach(() => {
    clearStats();
  });

  describe('mark and measure', () => {
    it('should create and retrieve marks', () => {
      mark('test-start');
      const retrievedMark = perf.getMark('test-start');

      expect(retrievedMark).toBeDefined();
      expect(retrievedMark?.name).toBe('test-start');
      expect(retrievedMark?.timestamp).toBeGreaterThan(0);
    });

    it('should measure time between marks', () => {
      mark('measure-start');

      // Small delay to ensure time passes
      const start = Date.now();
      while (Date.now() - start < 10) {
        // busy wait
      }

      mark('measure-end');
      const result = measure('test-measure', 'measure-start', 'measure-end');

      expect(result).toBeDefined();
      expect(result?.name).toBe('test-measure');
      expect(result?.duration).toBeGreaterThanOrEqual(0);
    });

    it('should measure to current time if no end mark', () => {
      mark('single-mark');

      // Small delay
      const start = Date.now();
      while (Date.now() - start < 5) {
        // busy wait
      }

      const result = measure('single-measure', 'single-mark');

      expect(result).toBeDefined();
      expect(result?.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('startTimer', () => {
    it('should return an object with stop method', () => {
      const timer = startTimer('timer-test');

      expect(timer).toBeDefined();
      expect(typeof timer.stop).toBe('function');
      expect(typeof timer.stopAndGetMeasure).toBe('function');
    });

    it('should measure duration when stopped', () => {
      const timer = startTimer('timer-test');

      // Small delay
      const start = Date.now();
      while (Date.now() - start < 5) {
        // busy wait
      }

      const duration = timer.stop();

      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it('should return measure object from stopAndGetMeasure', () => {
      const timer = startTimer('timer-measure-test');
      const measureResult = timer.stopAndGetMeasure();

      expect(measureResult).toBeDefined();
      expect(measureResult.name).toBe('timer-measure-test');
      expect(measureResult.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('measureAsync', () => {
    it('should measure async operation duration', async () => {
      const { result, duration } = await measureAsync(
        'async-test',
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return 'done';
        }
      );

      expect(result).toBe('done');
      expect(duration).toBeGreaterThanOrEqual(10);
    });

    it('should record error duration on failure', async () => {
      await expect(
        measureAsync('async-error-test', async () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');

      // Check that error measure was recorded
      const stats = getStats('async-error-test_error');
      expect(stats).toBeDefined();
    });
  });

  describe('measureSync', () => {
    it('should measure sync operation duration', () => {
      const { result, duration } = measureSync('sync-test', () => {
        let sum = 0;
        for (let i = 0; i < 10000; i++) {
          sum += i;
        }
        return sum;
      });

      expect(result).toBe(49995000);
      expect(duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('statistics', () => {
    it('should calculate statistics correctly', () => {
      // Add several measurements
      for (let i = 0; i < 10; i++) {
        const timer = startTimer('stats-test');
        // Simulate varying durations
        const start = Date.now();
        while (Date.now() - start < (i + 1)) {
          // busy wait
        }
        timer.stop();
      }

      const stats = getStats('stats-test');

      expect(stats).toBeDefined();
      expect(stats?.count).toBe(10);
      expect(stats?.min).toBeGreaterThanOrEqual(0);
      expect(stats?.max).toBeGreaterThanOrEqual(stats?.min ?? 0);
      expect(stats?.avg).toBeGreaterThanOrEqual(0);
    });

    it('should return null for unknown measure', () => {
      const stats = getStats('unknown-measure');
      expect(stats).toBeNull();
    });
  });

  describe('getAllMeasurements', () => {
    it('should return all measurements organized by name', () => {
      startTimer('group-a').stop();
      startTimer('group-a').stop();
      startTimer('group-b').stop();

      const measurements = getAllMeasurements();

      expect(measurements['group-a']).toBeDefined();
      expect(measurements['group-a'].length).toBe(2);
      expect(measurements['group-b']).toBeDefined();
      expect(measurements['group-b'].length).toBe(1);
    });
  });

  describe('clear', () => {
    it('should clear all measurements', () => {
      startTimer('clear-test').stop();
      startTimer('clear-test').stop();

      expect(getStats('clear-test')?.count).toBe(2);

      clearStats();

      // After clear, getAllMeasurements should return empty
      const measurements = getAllMeasurements();
      expect(Object.keys(measurements).length).toBe(0);
    });
  });
});
