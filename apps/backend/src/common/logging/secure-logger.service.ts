import { Injectable, Logger, LogLevel } from '@nestjs/common';

/**
 * SecureLoggerService - Logger que NUNCA loga dados sensíveis
 *
 * Protege contra vazamento de:
 * - CPF, CNPJ, documentos
 * - Senhas, tokens, API keys
 * - Números de cartão de crédito
 * - Dados bancários
 * - Informações pessoais (PII)
 *
 * Uso:
 * ```typescript
 * constructor(private readonly logger: SecureLoggerService) {}
 *
 * // Loga objeto automaticamente sanitizado
 * this.logger.log('User created', { user });
 *
 * // Força sanitização
 * this.logger.logSanitized('Payment data', paymentData);
 * ```
 */
@Injectable()
export class SecureLoggerService extends Logger {
  /**
   * Lista de campos sensíveis que NUNCA devem ser logados
   * Adicione aqui qualquer campo que contenha PII ou dados sensíveis
   */
  private static readonly SENSITIVE_FIELDS = [
    // Autenticação
    'password',
    'senha',
    'pass',
    'pwd',
    'secret',
    'token',
    'accessToken',
    'refreshToken',
    'apiKey',
    'api_key',
    'privateKey',
    'private_key',
    'authorization',

    // Documentos
    'cpf',
    'cnpj',
    'rg',
    'passport',
    'documento',
    'document',
    'ssn',
    'taxId',
    'tax_id',

    // Dados bancários e pagamento
    'cardNumber',
    'card_number',
    'cvv',
    'cvc',
    'securityCode',
    'security_code',
    'bankAccount',
    'bank_account',
    'accountNumber',
    'account_number',
    'routingNumber',
    'routing_number',
    'iban',
    'swift',
    'pix',
    'creditCard',
    'credit_card',

    // Asaas/Payment Gateway
    'asaasApiKey',
    'asaas_api_key',
    'walletId',
    'wallet_id',

    // Dados pessoais
    'email', // Pode ser descomentado se quiser proteger emails também
    'phone',
    'telefone',
    'celular',
    'mobile',
    'birthDate',
    'birth_date',
    'dateOfBirth',
    'date_of_birth',

    // Criptografia
    'encryptedData',
    'encrypted_data',
    'cipher',
    'hash',
    'salt',
    'iv',
  ];

  /**
   * Padrões regex para detectar dados sensíveis em strings
   */
  private static readonly SENSITIVE_PATTERNS = [
    // CPF: 000.000.000-00 ou 00000000000
    {
      pattern: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g,
      replacement: 'CPF:[REDACTED]',
    },
    // CNPJ: 00.000.000/0000-00 ou 00000000000000
    {
      pattern: /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g,
      replacement: 'CNPJ:[REDACTED]',
    },
    // Cartão de crédito (Luhn-like)
    {
      pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
      replacement: 'CARD:[REDACTED]',
    },
    // Email
    {
      pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      replacement: 'EMAIL:[REDACTED]',
    },
    // Tokens JWT (Bearer eyJ...)
    {
      pattern: /Bearer\s+[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g,
      replacement: 'TOKEN:[REDACTED]',
    },
    // API Keys (formato comum: 32+ caracteres alfanuméricos)
    {
      pattern: /[a-zA-Z0-9]{32,}/g,
      replacement: 'APIKEY:[REDACTED]',
    },
  ];

  constructor(context?: string) {
    super(context ?? 'Application');
  }

  /**
   * Sanitiza um objeto removendo campos sensíveis
   */
  private sanitizeObject(obj: any, depth = 0): any {
    // Previne loops infinitos
    if (depth > 10) {
      return '[MAX_DEPTH_REACHED]';
    }

    if (obj === null || obj === undefined) {
      return obj;
    }

    // Se for string, aplica regex patterns
    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }

    // Se não for objeto, retorna como está
    if (typeof obj !== 'object') {
      return obj;
    }

    // Se for array
    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item, depth + 1));
    }

    // Se for objeto
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Verifica se a chave é sensível
      const lowerKey = key.toLowerCase();
      if (SecureLoggerService.SENSITIVE_FIELDS.some((field) => lowerKey.includes(field.toLowerCase()))) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = this.sanitizeObject(value, depth + 1);
      }
    }

    return sanitized;
  }

  /**
   * Sanitiza uma string aplicando regex patterns
   */
  private sanitizeString(str: string): string {
    let sanitized = str;

    for (const { pattern, replacement } of SecureLoggerService.SENSITIVE_PATTERNS) {
      sanitized = sanitized.replace(pattern, replacement);
    }

    return sanitized;
  }

  /**
   * Sanitiza argumentos do log
   */
  private sanitizeArgs(args: any[]): any[] {
    return args.map((arg) => {
      if (typeof arg === 'object') {
        return this.sanitizeObject(arg);
      }
      if (typeof arg === 'string') {
        return this.sanitizeString(arg);
      }
      return arg;
    });
  }

  /**
   * Override do método log para sanitizar automaticamente
   */
  override log(message: any, ...optionalParams: any[]): void {
    const sanitizedParams = this.sanitizeArgs(optionalParams);
    super.log(message, ...sanitizedParams);
  }

  /**
   * Override do método error para sanitizar automaticamente
   */
  override error(message: any, ...optionalParams: any[]): void {
    const sanitizedParams = this.sanitizeArgs(optionalParams);
    super.error(message, ...sanitizedParams);
  }

  /**
   * Override do método warn para sanitizar automaticamente
   */
  override warn(message: any, ...optionalParams: any[]): void {
    const sanitizedParams = this.sanitizeArgs(optionalParams);
    super.warn(message, ...sanitizedParams);
  }

  /**
   * Override do método debug para sanitizar automaticamente
   */
  override debug(message: any, ...optionalParams: any[]): void {
    const sanitizedParams = this.sanitizeArgs(optionalParams);
    super.debug(message, ...sanitizedParams);
  }

  /**
   * Override do método verbose para sanitizar automaticamente
   */
  override verbose(message: any, ...optionalParams: any[]): void {
    const sanitizedParams = this.sanitizeArgs(optionalParams);
    super.verbose(message, ...sanitizedParams);
  }

  /**
   * Loga dados já sanitizados (força sanitização explícita)
   */
  logSanitized(message: string, data: any, level: LogLevel = 'log'): void {
    const sanitized = this.sanitizeObject(data);

    switch (level) {
      case 'error':
        this.error(message, sanitized);
        break;
      case 'warn':
        this.warn(message, sanitized);
        break;
      case 'debug':
        this.debug(message, sanitized);
        break;
      case 'verbose':
        this.verbose(message, sanitized);
        break;
      default:
        this.log(message, sanitized);
    }
  }

  /**
   * Loga erro com stack trace sanitizado
   */
  logError(message: string, error: Error, context?: any): void {
    const sanitizedContext = context ? this.sanitizeObject(context) : undefined;

    this.error(
      message,
      {
        error: error.message,
        stack: error.stack,
        context: sanitizedContext,
      },
    );
  }

  /**
   * Método utilitário para adicionar campos sensíveis customizados
   * Útil para projetos específicos
   */
  static addSensitiveField(field: string): void {
    if (!SecureLoggerService.SENSITIVE_FIELDS.includes(field)) {
      SecureLoggerService.SENSITIVE_FIELDS.push(field);
    }
  }

  /**
   * Método utilitário para adicionar patterns customizados
   */
  static addSensitivePattern(pattern: RegExp, replacement: string): void {
    SecureLoggerService.SENSITIVE_PATTERNS.push({ pattern, replacement });
  }
}
