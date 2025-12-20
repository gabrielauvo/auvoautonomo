/**
 * SyncFlags Tests
 *
 * Testes para as feature flags de sincronização.
 */

import { SYNC_FLAGS, isSyncFlagEnabled, getSyncFlagValue } from '../../src/config/syncFlags';

describe('SYNC_FLAGS', () => {
  describe('default values', () => {
    it('should have SYNC_OPT_CHUNK_PROCESSING enabled by default', () => {
      expect(SYNC_FLAGS.SYNC_OPT_CHUNK_PROCESSING).toBe(true);
    });

    it('should have CHUNK_SIZE set to 100', () => {
      expect(SYNC_FLAGS.CHUNK_SIZE).toBe(100);
    });

    it('should have CHUNK_YIELD_DELAY_MS set to 0', () => {
      expect(SYNC_FLAGS.CHUNK_YIELD_DELAY_MS).toBe(0);
    });
  });

  describe('type safety', () => {
    it('should be readonly', () => {
      // TypeScript should prevent this at compile time
      // This test just documents the expected behavior
      expect(typeof SYNC_FLAGS).toBe('object');
      expect(Object.isFrozen(SYNC_FLAGS)).toBe(false); // as const doesn't freeze
    });
  });
});

describe('isSyncFlagEnabled', () => {
  it('should return true for enabled flags', () => {
    expect(isSyncFlagEnabled('SYNC_OPT_CHUNK_PROCESSING')).toBe(true);
  });

  it('should return true for non-zero numeric flags', () => {
    expect(isSyncFlagEnabled('CHUNK_SIZE')).toBe(true); // 100 is truthy
  });

  it('should return false for zero numeric flags', () => {
    expect(isSyncFlagEnabled('CHUNK_YIELD_DELAY_MS')).toBe(false); // 0 is falsy
  });
});

describe('getSyncFlagValue', () => {
  it('should return the correct value for boolean flags', () => {
    expect(getSyncFlagValue('SYNC_OPT_CHUNK_PROCESSING')).toBe(true);
  });

  it('should return the correct value for numeric flags', () => {
    expect(getSyncFlagValue('CHUNK_SIZE')).toBe(100);
    expect(getSyncFlagValue('CHUNK_YIELD_DELAY_MS')).toBe(0);
  });
});
