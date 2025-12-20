/**
 * Security Library
 *
 * Utilitários de segurança para proteção contra CSRF, rate limiting,
 * validação de tokens e outras medidas de segurança.
 *
 * SEGURANÇA CRÍTICA: Este módulo é essencial para a segurança da aplicação.
 */

import { randomBytes, createHash } from 'crypto';

/**
 * Gera token CSRF seguro
 *
 * @returns Token CSRF único de 32 bytes em formato hex
 */
export function generateCSRFToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Valida token CSRF
 *
 * @param token - Token recebido do cliente
 * @param expectedToken - Token esperado (armazenado no servidor/sessão)
 * @returns true se tokens são iguais
 */
export function validateCSRFToken(
  token: string | null | undefined,
  expectedToken: string | null | undefined
): boolean {
  if (!token || !expectedToken) return false;

  // Timing-safe comparison para prevenir timing attacks
  if (token.length !== expectedToken.length) return false;

  const bufferA = Buffer.from(token);
  const bufferB = Buffer.from(expectedToken);

  return timingSafeEqual(bufferA, bufferB);
}

/**
 * Comparação timing-safe (previne timing attacks)
 *
 * @param a - Buffer A
 * @param b - Buffer B
 * @returns true se iguais
 */
function timingSafeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

/**
 * Gera hash SHA-256 de uma string
 *
 * @param data - Dados para fazer hash
 * @returns Hash em formato hex
 */
export function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Valida formato de email
 *
 * @param email - Email para validar
 * @returns true se válido
 */
export function isValidEmail(email: string): boolean {
  if (!email) return false;

  // RFC 5322 simplified regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) return false;

  // Verifica tamanho
  if (email.length > 254) return false;

  // Verifica parte local (antes do @)
  const [localPart] = email.split('@');
  if (localPart.length > 64) return false;

  return true;
}

/**
 * Valida formato de UUID
 *
 * @param uuid - UUID para validar
 * @returns true se válido
 */
export function isValidUUID(uuid: string): boolean {
  if (!uuid) return false;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Rate Limiter simples baseado em memória
 *
 * NOTA: Para produção com múltiplas instâncias, use Redis ou similar
 */
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number = 100, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;

    // Limpa registros antigos a cada minuto
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Verifica se request está dentro do rate limit
   *
   * @param key - Identificador (IP, user ID, etc)
   * @returns true se permitido
   */
  check(key: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(key) || [];

    // Remove requests fora da janela
    const validRequests = requests.filter(time => now - time < this.windowMs);

    if (validRequests.length >= this.maxRequests) {
      return false;
    }

    validRequests.push(now);
    this.requests.set(key, validRequests);

    return true;
  }

  /**
   * Reseta contador para uma chave
   *
   * @param key - Identificador
   */
  reset(key: string): void {
    this.requests.delete(key);
  }

  /**
   * Limpa registros antigos
   */
  private cleanup(): void {
    const now = Date.now();

    for (const [key, times] of this.requests.entries()) {
      const validTimes = times.filter(time => now - time < this.windowMs);

      if (validTimes.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, validTimes);
      }
    }
  }
}

/**
 * Rate limiters globais
 */
export const rateLimiters = {
  // API geral: 100 requests/minuto
  api: new RateLimiter(100, 60000),

  // Login: 5 tentativas/minuto
  login: new RateLimiter(5, 60000),

  // Upload: 10 uploads/minuto
  upload: new RateLimiter(10, 60000),

  // CSRF token: 20 requests/minuto
  csrf: new RateLimiter(20, 60000),
};

/**
 * Extrai IP do request (Next.js)
 *
 * @param headers - Headers do request
 * @returns IP do cliente
 */
export function getClientIP(headers: Headers): string {
  // Verifica headers de proxy
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const real = headers.get('x-real-ip');
  if (real) {
    return real.trim();
  }

  return 'unknown';
}

/**
 * Valida origem do request (CORS)
 *
 * @param origin - Origem do request
 * @param allowedOrigins - Origens permitidas
 * @returns true se origem é permitida
 */
export function isValidOrigin(
  origin: string | null,
  allowedOrigins: string[]
): boolean {
  if (!origin) return false;

  return allowedOrigins.some(allowed => {
    // Exact match
    if (origin === allowed) return true;

    // Wildcard subdomain (*.example.com)
    if (allowed.startsWith('*.')) {
      const domain = allowed.substring(2);
      return origin.endsWith(domain) || origin === domain;
    }

    return false;
  });
}

/**
 * Gera nonce para CSP (Content Security Policy)
 *
 * @returns Nonce único em base64
 */
export function generateCSPNonce(): string {
  return randomBytes(16).toString('base64');
}

/**
 * Sanitiza User-Agent para prevenir injection
 *
 * @param userAgent - User-Agent do request
 * @returns User-Agent sanitizado
 */
export function sanitizeUserAgent(userAgent: string | null): string {
  if (!userAgent) return 'unknown';

  // Remove caracteres perigosos e limita tamanho
  const clean = userAgent
    .replace(/[<>'"]/g, '')
    .substring(0, 500);

  return clean || 'unknown';
}

/**
 * Valida senha forte
 *
 * Requisitos:
 * - Mínimo 8 caracteres
 * - Pelo menos 1 letra maiúscula
 * - Pelo menos 1 letra minúscula
 * - Pelo menos 1 número
 * - Pelo menos 1 caractere especial
 *
 * @param password - Senha para validar
 * @returns Objeto com resultado e mensagem
 */
export function validateStrongPassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Senha deve ter no mínimo 8 caracteres');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Senha deve conter pelo menos uma letra maiúscula');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Senha deve conter pelo menos uma letra minúscula');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Senha deve conter pelo menos um número');
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Senha deve conter pelo menos um caractere especial');
  }

  // Verifica senhas comuns
  const commonPasswords = [
    '12345678', 'password', '123456789', '12345', '1234567',
    'password1', 'qwerty', 'abc123', 'senha123', '123mudar'
  ];

  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push('Senha muito comum. Escolha uma senha mais forte');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Gera string aleatória segura
 *
 * @param length - Tamanho da string
 * @param charset - Conjunto de caracteres (padrão: alfanumérico)
 * @returns String aleatória
 */
export function generateRandomString(
  length: number = 32,
  charset: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
): string {
  const bytes = randomBytes(length);
  const chars: string[] = [];

  for (let i = 0; i < length; i++) {
    chars.push(charset[bytes[i] % charset.length]);
  }

  return chars.join('');
}

/**
 * Máscara de dados sensíveis (CPF, email, etc)
 *
 * @param value - Valor para mascarar
 * @param type - Tipo de dado
 * @returns Valor mascarado
 *
 * @example
 * ```ts
 * maskSensitiveData('12345678901', 'cpf'); // '***.***.***-01'
 * maskSensitiveData('user@example.com', 'email'); // 'u***@example.com'
 * ```
 */
export function maskSensitiveData(
  value: string,
  type: 'cpf' | 'cnpj' | 'email' | 'phone' | 'card'
): string {
  if (!value) return '';

  switch (type) {
    case 'cpf':
      if (value.length !== 11) return value;
      return `***.***.*${value.slice(-2)}`;

    case 'cnpj':
      if (value.length !== 14) return value;
      return `**.***.***/****-${value.slice(-2)}`;

    case 'email': {
      const [local, domain] = value.split('@');
      if (!domain) return value;
      const masked = local.length > 1 ? local[0] + '***' : local;
      return `${masked}@${domain}`;
    }

    case 'phone': {
      const cleaned = value.replace(/\D/g, '');
      if (cleaned.length < 4) return value;
      return `(***) ***-**${cleaned.slice(-2)}`;
    }

    case 'card': {
      const cleaned = value.replace(/\s/g, '');
      if (cleaned.length < 4) return value;
      return `**** **** **** ${cleaned.slice(-4)}`;
    }

    default:
      return value;
  }
}

export const security = {
  generateCSRFToken,
  validateCSRFToken,
  sha256,
  isValidEmail,
  isValidUUID,
  rateLimiters,
  getClientIP,
  isValidOrigin,
  generateCSPNonce,
  sanitizeUserAgent,
  validateStrongPassword,
  generateRandomString,
  maskSensitiveData,
};

export default security;
