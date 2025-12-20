/**
 * Logger Tests
 *
 * Testes para o logger estruturado com sanitização de PII.
 */

// Mock expo modules
jest.mock('expo-device', () => ({
  modelName: 'Test Device',
  osName: 'iOS',
  osVersion: '17.0',
}));

jest.mock('expo-constants', () => ({
  expoConfig: {
    version: '1.0.0',
  },
}));

import { logger, testSanitization } from '../../src/observability/Logger';

describe('Logger', () => {
  beforeEach(() => {
    logger.clearLogs();
    logger.clearBreadcrumbs();
    logger.setMinLevel('debug');
  });

  describe('logging', () => {
    it('should log debug messages', () => {
      logger.debug('Test debug message');
      const logs = logger.getLogs();
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[logs.length - 1].level).toBe('debug');
      expect(logs[logs.length - 1].message).toBe('Test debug message');
    });

    it('should log info messages', () => {
      logger.info('Test info message');
      const logs = logger.getLogs();
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[logs.length - 1].level).toBe('info');
    });

    it('should log warn messages', () => {
      logger.warn('Test warning message');
      const logs = logger.getLogs();
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[logs.length - 1].level).toBe('warn');
    });

    it('should log error messages with Error objects', () => {
      const error = new Error('Test error');
      logger.error('Test error message', error);
      const logs = logger.getLogs();
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[logs.length - 1].level).toBe('error');
      expect(logs[logs.length - 1].error?.message).toBe('Test error');
    });

    it('should log error messages with string errors', () => {
      logger.error('Test error message', 'String error');
      const logs = logger.getLogs();
      expect(logs[logs.length - 1].error?.message).toBe('String error');
    });

    it('should include data in logs', () => {
      logger.info('Test message', { key: 'value' });
      const logs = logger.getLogs();
      expect(logs[logs.length - 1].data).toEqual({ key: 'value' });
    });
  });

  describe('context', () => {
    it('should set user context', () => {
      logger.setUser('user-123');
      logger.info('Test message');
      const logs = logger.getLogs();
      expect(logs[logs.length - 1].context.userId).toMatch(/^user_/);
    });

    it('should set additional context', () => {
      logger.setContext({ screen: 'HomeScreen' });
      logger.info('Test message');
      const logs = logger.getLogs();
      expect(logs[logs.length - 1].context.screen).toBe('HomeScreen');
    });

    it('should clear user context', () => {
      logger.setUser('user-123');
      logger.clearUser();
      logger.info('Test message');
      const logs = logger.getLogs();
      expect(logs[logs.length - 1].context.userId).toBeUndefined();
    });
  });

  describe('breadcrumbs', () => {
    it('should add breadcrumbs', () => {
      logger.addBreadcrumb('navigation', 'Navigated to home');
      const breadcrumbs = logger.getBreadcrumbs();
      expect(breadcrumbs.length).toBe(1);
      expect(breadcrumbs[0].category).toBe('navigation');
      expect(breadcrumbs[0].message).toBe('Navigated to home');
    });

    it('should add breadcrumbs with data', () => {
      logger.addBreadcrumb('api', 'API call', { endpoint: '/users' });
      const breadcrumbs = logger.getBreadcrumbs();
      expect(breadcrumbs[0].data?.endpoint).toBe('/users');
    });

    it('should clear breadcrumbs', () => {
      logger.addBreadcrumb('test', 'Test breadcrumb');
      logger.clearBreadcrumbs();
      const breadcrumbs = logger.getBreadcrumbs();
      expect(breadcrumbs.length).toBe(0);
    });
  });

  describe('sync breadcrumbs', () => {
    it('should log sync start', () => {
      logger.syncStart('clients', 'sync-run-1');
      const logs = logger.getLogs();
      const breadcrumbs = logger.getBreadcrumbs();
      expect(logs.some(l => l.message.includes('Sync started'))).toBe(true);
      expect(breadcrumbs.some(b => b.category === 'sync')).toBe(true);
    });

    it('should log sync pull', () => {
      logger.syncPull('clients', 50, 1);
      const breadcrumbs = logger.getBreadcrumbs();
      expect(breadcrumbs[0].data?.count).toBe(50);
    });

    it('should log sync push', () => {
      logger.syncPush('clients', 10);
      const breadcrumbs = logger.getBreadcrumbs();
      expect(breadcrumbs[0].data?.count).toBe(10);
    });

    it('should log sync complete', () => {
      logger.syncComplete('clients', 1500, { pulled: 50, pushed: 10 });
      const logs = logger.getLogs();
      expect(logs.some(l => l.message.includes('Sync complete'))).toBe(true);
    });

    it('should log sync error', () => {
      const error = new Error('Sync failed');
      logger.syncError('clients', error);
      const logs = logger.getLogs();
      expect(logs.some(l => l.level === 'error')).toBe(true);
    });
  });

  describe('db breadcrumbs', () => {
    it('should log db operation', () => {
      logger.dbOperation('SELECT', 'clients', 50, 100);
      const breadcrumbs = logger.getBreadcrumbs();
      expect(breadcrumbs[0].category).toBe('db');
      expect(breadcrumbs[0].data?.count).toBe(50);
    });

    it('should log db error', () => {
      const error = new Error('DB error');
      logger.dbError('INSERT', 'clients', error);
      const logs = logger.getLogs();
      expect(logs.some(l => l.level === 'error')).toBe(true);
    });
  });

  describe('sanitization', () => {
    it('should sanitize CPF in messages', () => {
      logger.info('User CPF: 123.456.789-00');
      const logs = logger.getLogs();
      expect(logs[logs.length - 1].message).toContain('***.***.***-**');
    });

    it('should sanitize email in messages', () => {
      logger.info('User email: test@example.com');
      const logs = logger.getLogs();
      expect(logs[logs.length - 1].message).toContain('***@***.***');
    });

    it('should sanitize phone in messages', () => {
      logger.info('User phone: (11) 99999-9999');
      const logs = logger.getLogs();
      expect(logs[logs.length - 1].message).toContain('(**) *****-****');
    });

    it('should sanitize Bearer token in messages', () => {
      logger.info('Auth: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature');
      const logs = logger.getLogs();
      expect(logs[logs.length - 1].message).toContain('Bearer ***');
    });

    it('should sanitize sensitive keys in data', () => {
      logger.info('User data', { password: 'secret123', name: 'John' });
      const logs = logger.getLogs();
      expect(logs[logs.length - 1].data?.password).toBe('***REDACTED***');
      expect(logs[logs.length - 1].data?.name).toBe('John');
    });

    it('should sanitize CPF key in data', () => {
      logger.info('User data', { cpf: '12345678901' });
      const logs = logger.getLogs();
      expect(logs[logs.length - 1].data?.cpf).toBe('***REDACTED***');
    });

    it('should sanitize email in nested data', () => {
      logger.info('User data', { user: { email: 'test@example.com' } });
      const logs = logger.getLogs();
      const userData = logs[logs.length - 1].data?.user as { email: string };
      expect(userData.email).toBe('***@***.***');
    });
  });

  describe('export', () => {
    it('should export logs as JSON', () => {
      logger.info('Test message');
      const exported = logger.exportLogs();
      const parsed = JSON.parse(exported);
      expect(parsed.logs).toBeDefined();
      expect(parsed.breadcrumbs).toBeDefined();
      expect(parsed.context).toBeDefined();
      expect(parsed.exportedAt).toBeDefined();
    });

    it('should get recent logs with limit', () => {
      for (let i = 0; i < 10; i++) {
        logger.info(`Message ${i}`);
      }
      const logs = logger.getLogs(5);
      expect(logs.length).toBe(5);
    });
  });

  describe('listeners', () => {
    it('should notify listeners on log', () => {
      const listener = jest.fn();
      const unsubscribe = logger.subscribe(listener);

      logger.info('Test message');

      expect(listener).toHaveBeenCalled();
      expect(listener.mock.calls[0][0].message).toBe('Test message');

      unsubscribe();
    });

    it('should unsubscribe listener', () => {
      const listener = jest.fn();
      const unsubscribe = logger.subscribe(listener);
      unsubscribe();

      logger.info('Test message');

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('configuration', () => {
    it('should set minimum log level', () => {
      logger.clearLogs();
      logger.setMinLevel('warn');
      logger.info('Info message');
      logger.warn('Warn message');

      const logs = logger.getLogs();
      expect(logs.some(l => l.message === 'Info message')).toBe(false);
      expect(logs.some(l => l.message === 'Warn message')).toBe(true);
    });

    it('should set max logs', () => {
      logger.setMaxLogs(5);
      for (let i = 0; i < 10; i++) {
        logger.info(`Message ${i}`);
      }
      const logs = logger.getLogs();
      expect(logs.length).toBeLessThanOrEqual(5);
    });
  });

  describe('testSanitization', () => {
    it('should return sanitization test results', () => {
      const results = testSanitization();
      expect(Object.keys(results).length).toBeGreaterThan(0);
      for (const key of Object.keys(results)) {
        expect(results[key].input).toBeDefined();
        expect(results[key].output).toBeDefined();
      }
    });
  });
});
