/**
 * Structured Logger
 *
 * Logger com contexto estruturado, breadcrumbs para sync,
 * e sanitização de dados sensíveis (PII).
 */

import * as Device from 'expo-device';
import Constants from 'expo-constants';

// =============================================================================
// TYPES
// =============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  userId?: string;
  appVersion?: string;
  deviceModel?: string;
  osVersion?: string;
  entity?: string;
  syncRunId?: string;
  screen?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context: LogContext;
  data?: Record<string, unknown>;
  error?: {
    message: string;
    stack?: string;
    name?: string;
  };
}

export interface Breadcrumb {
  category: string;
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

// =============================================================================
// SENSITIVE DATA PATTERNS
// =============================================================================

const SENSITIVE_PATTERNS: Array<{ regex: RegExp; replacement: string }> = [
  // CPF: 123.456.789-00
  { regex: /\d{3}\.\d{3}\.\d{3}-\d{2}/g, replacement: '***.***.***-**' },
  // CPF sem pontuação: 12345678900
  { regex: /\b\d{11}\b/g, replacement: '***********' },
  // CNPJ: 12.345.678/0001-00
  { regex: /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g, replacement: '**.***.***\/****-**' },
  // CNPJ sem pontuação: 12345678000100
  { regex: /\b\d{14}\b/g, replacement: '**************' },
  // Email
  { regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '***@***.***' },
  // Phone: (11) 99999-9999 or 11999999999
  { regex: /\(?\d{2}\)?[\s.-]?\d{4,5}[\s.-]?\d{4}/g, replacement: '(**) *****-****' },
  // Credit card: 4 groups of 4 digits
  { regex: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, replacement: '**** **** **** ****' },
  // Bearer token
  { regex: /Bearer\s+[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_.+\/=]*/g, replacement: 'Bearer ***' },
  // JWT token (standalone)
  { regex: /\beyJ[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_.+\/=]*\b/g, replacement: '***JWT***' },
  // API Keys
  { regex: /\b(api[_-]?key|apikey|secret|password|token)[=:]\s*[^\s,;]+/gi, replacement: '$1=***' },
  // Values with currency (R$ 1.234,56)
  { regex: /R\$\s*[\d.,]+/g, replacement: 'R$ ***,**' },
];

const SENSITIVE_KEYS = [
  'password',
  'senha',
  'token',
  'apiKey',
  'api_key',
  'secret',
  'authorization',
  'cpf',
  'cnpj',
  'document',
  'taxId',
  'creditCard',
  'cardNumber',
  'cvv',
  'pin',
  'ssn',
  'socialSecurity',
];

// =============================================================================
// SANITIZATION
// =============================================================================

/**
 * Sanitize a string value
 */
function sanitizeString(value: string): string {
  let sanitized = value;

  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern.regex, pattern.replacement);
  }

  return sanitized;
}

/**
 * Sanitize an object recursively
 */
function sanitizeObject(obj: unknown, depth: number = 0): unknown {
  if (depth > 10) return '[MAX_DEPTH]';

  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item, depth + 1));
  }

  if (typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();

      // Check if key is sensitive
      if (SENSITIVE_KEYS.some((sk) => lowerKey.includes(sk.toLowerCase()))) {
        sanitized[key] = '***REDACTED***';
      } else {
        sanitized[key] = sanitizeObject(value, depth + 1);
      }
    }

    return sanitized;
  }

  return String(obj);
}

// =============================================================================
// LOGGER CLASS
// =============================================================================

class StructuredLogger {
  private context: LogContext = {};
  private logs: LogEntry[] = [];
  private breadcrumbs: Breadcrumb[] = [];
  private maxLogs: number = 500;
  private maxBreadcrumbs: number = 100;
  private listeners: Set<(entry: LogEntry) => void> = new Set();
  private minLevel: LogLevel = __DEV__ ? 'debug' : 'info';

  private levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor() {
    this.initContext();
  }

  private initContext(): void {
    this.context = {
      appVersion: Constants.expoConfig?.version || 'unknown',
      deviceModel: Device.modelName || 'unknown',
      osVersion: `${Device.osName || 'unknown'} ${Device.osVersion || ''}`.trim(),
    };
  }

  // =============================================================================
  // CONTEXT
  // =============================================================================

  /**
   * Set user context (hashed/anonymized)
   */
  setUser(userId: string): void {
    // Hash the userId for privacy
    this.context.userId = this.hashUserId(userId);
  }

  /**
   * Set additional context
   */
  setContext(ctx: Partial<LogContext>): void {
    this.context = { ...this.context, ...ctx };
  }

  /**
   * Clear user context
   */
  clearUser(): void {
    delete this.context.userId;
  }

  private hashUserId(userId: string): string {
    // Simple hash for anonymization - first 8 chars of a basic hash
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `user_${Math.abs(hash).toString(16).substring(0, 8)}`;
  }

  // =============================================================================
  // LOGGING
  // =============================================================================

  /**
   * Log debug message
   */
  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data);
  }

  /**
   * Log info message
   */
  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data);
  }

  /**
   * Log warning message
   */
  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error | unknown, data?: Record<string, unknown>): void {
    const errorObj = error instanceof Error
      ? {
          message: error.message,
          stack: error.stack,
          name: error.name,
        }
      : error
        ? { message: String(error) }
        : undefined;

    this.log('error', message, data, errorObj);
  }

  private log(
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>,
    error?: { message: string; stack?: string; name?: string }
  ): void {
    // Check minimum level
    if (this.levelPriority[level] < this.levelPriority[this.minLevel]) {
      return;
    }

    const entry: LogEntry = {
      level,
      message: sanitizeString(message),
      timestamp: new Date().toISOString(),
      context: { ...this.context },
      data: data ? (sanitizeObject(data) as Record<string, unknown>) : undefined,
      error: error
        ? {
            message: sanitizeString(error.message),
            stack: error.stack ? sanitizeString(error.stack) : undefined,
            name: error.name,
          }
        : undefined,
    };

    // Store log
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Console output in dev
    if (__DEV__) {
      const prefix = `[${level.toUpperCase()}]`;
      const contextStr = entry.context.entity ? ` [${entry.context.entity}]` : '';

      switch (level) {
        case 'debug':
          console.debug(`${prefix}${contextStr}`, message, data || '');
          break;
        case 'info':
          console.info(`${prefix}${contextStr}`, message, data || '');
          break;
        case 'warn':
          console.warn(`${prefix}${contextStr}`, message, data || '');
          break;
        case 'error':
          console.error(`${prefix}${contextStr}`, message, error || '', data || '');
          break;
      }
    }

    // Notify listeners
    this.listeners.forEach((listener) => {
      try {
        listener(entry);
      } catch (e) {
        console.error('[Logger] Listener error:', e);
      }
    });
  }

  // =============================================================================
  // BREADCRUMBS
  // =============================================================================

  /**
   * Add a breadcrumb
   */
  addBreadcrumb(category: string, message: string, data?: Record<string, unknown>): void {
    const breadcrumb: Breadcrumb = {
      category,
      message: sanitizeString(message),
      timestamp: new Date().toISOString(),
      data: data ? (sanitizeObject(data) as Record<string, unknown>) : undefined,
    };

    this.breadcrumbs.push(breadcrumb);
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs.shift();
    }
  }

  /**
   * Get recent breadcrumbs
   */
  getBreadcrumbs(limit?: number): Breadcrumb[] {
    return this.breadcrumbs.slice(-(limit || this.maxBreadcrumbs));
  }

  /**
   * Clear breadcrumbs
   */
  clearBreadcrumbs(): void {
    this.breadcrumbs = [];
  }

  // =============================================================================
  // SYNC BREADCRUMBS
  // =============================================================================

  /**
   * Log sync start
   */
  syncStart(entity: string, syncRunId: string): void {
    this.setContext({ entity, syncRunId });
    this.addBreadcrumb('sync', `Sync started: ${entity}`, { syncRunId });
    this.info(`Sync started for ${entity}`, { syncRunId });
  }

  /**
   * Log sync pull
   */
  syncPull(entity: string, count: number, page: number): void {
    this.addBreadcrumb('sync', `Pull: ${entity} page ${page}`, { count });
    this.debug(`Pulled ${count} items from ${entity} (page ${page})`);
  }

  /**
   * Log sync push
   */
  syncPush(entity: string, count: number): void {
    this.addBreadcrumb('sync', `Push: ${entity}`, { count });
    this.debug(`Pushed ${count} mutations to ${entity}`);
  }

  /**
   * Log sync complete
   */
  syncComplete(entity: string, duration: number, stats: { pulled: number; pushed: number }): void {
    this.addBreadcrumb('sync', `Sync complete: ${entity}`, { duration, ...stats });
    this.info(`Sync complete for ${entity}`, { duration, ...stats });
    this.setContext({ entity: undefined, syncRunId: undefined });
  }

  /**
   * Log sync error
   */
  syncError(entity: string, error: Error | unknown): void {
    this.addBreadcrumb('sync', `Sync error: ${entity}`, {
      error: error instanceof Error ? error.message : String(error),
    });
    this.error(`Sync failed for ${entity}`, error);
  }

  // =============================================================================
  // DB BREADCRUMBS
  // =============================================================================

  /**
   * Log DB operation
   */
  dbOperation(operation: string, table: string, count?: number, duration?: number): void {
    this.addBreadcrumb('db', `${operation}: ${table}`, { count, duration });
    this.debug(`DB ${operation} on ${table}`, { count, duration });
  }

  /**
   * Log DB error
   */
  dbError(operation: string, table: string, error: Error | unknown): void {
    this.addBreadcrumb('db', `DB error: ${operation} ${table}`, {
      error: error instanceof Error ? error.message : String(error),
    });
    this.error(`DB ${operation} failed on ${table}`, error);
  }

  // =============================================================================
  // EXPORT
  // =============================================================================

  /**
   * Get recent logs
   */
  getLogs(limit?: number): LogEntry[] {
    return this.logs.slice(-(limit || 200));
  }

  /**
   * Export logs as JSON
   */
  exportLogs(): string {
    return JSON.stringify(
      {
        context: this.context,
        logs: this.logs,
        breadcrumbs: this.breadcrumbs,
        exportedAt: new Date().toISOString(),
      },
      null,
      2
    );
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
    this.breadcrumbs = [];
  }

  // =============================================================================
  // LISTENERS
  // =============================================================================

  /**
   * Subscribe to log entries
   */
  subscribe(listener: (entry: LogEntry) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // =============================================================================
  // CONFIGURATION
  // =============================================================================

  /**
   * Set minimum log level
   */
  setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /**
   * Set max logs to keep
   */
  setMaxLogs(max: number): void {
    this.maxLogs = max;
    while (this.logs.length > max) {
      this.logs.shift();
    }
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

export const logger = new StructuredLogger();

// =============================================================================
// TEST HELPERS
// =============================================================================

/**
 * Test that sanitization works correctly
 */
export function testSanitization(): Record<string, { input: string; output: string }> {
  const testCases = [
    { input: 'CPF: 123.456.789-00', expected: 'CPF: ***.***.***-**' },
    { input: 'Email: test@example.com', expected: 'Email: ***@***.***' },
    { input: 'Phone: (11) 99999-9999', expected: 'Phone: (**) *****-****' },
    { input: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.sig', expected: 'Bearer ***' },
    { input: 'Value: R$ 1.234,56', expected: 'Value: R$ ***,**' },
  ];

  const results: Record<string, { input: string; output: string }> = {};

  for (const tc of testCases) {
    results[tc.input.substring(0, 20)] = {
      input: tc.input,
      output: sanitizeString(tc.input),
    };
  }

  return results;
}

export default logger;
