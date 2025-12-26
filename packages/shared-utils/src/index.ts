/**
 * Formata uma data para string ISO (YYYY-MM-DD)
 * @param date - A data a ser formatada
 * @returns String de data no formato ISO em UTC
 * @throws {Error} Se a data for inválida
 */
export function formatDate(date: Date): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error('Invalid date provided');
  }
  return date.toISOString().split('T')[0];
}

/**
 * Capitaliza a primeira letra de uma string
 * @param str - A string a ser capitalizada
 * @returns String com primeira letra maiúscula
 */
export function capitalize(str: string): string {
  if (!str || typeof str !== 'string') {
    return '';
  }
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Converte texto para formato slug (URL-friendly)
 * Trata caracteres acentuados convertendo para ASCII
 * @param text - O texto a ser convertido
 * @returns String no formato slug
 */
export function slugify(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    .normalize('NFD') // Normaliza para decompor acentos
    .replace(/[\u0300-\u036f]/g, '') // Remove diacríticos
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove caracteres especiais
    .replace(/\s+/g, '-') // Substitui espaços por hífens
    .replace(/--+/g, '-') // Remove hífens duplicados
    .replace(/^-+|-+$/g, ''); // Remove hífens nas pontas
}

/**
 * Valida se uma string é um email válido
 * @param email - O email a ser validado
 * @returns true se o email for válido
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // RFC 5322 compliant regex (mais robusto)
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

  return emailRegex.test(email.trim());
}

/**
 * Atrasa a execução por um tempo especificado
 * @param ms - Tempo em milissegundos (deve ser positivo e finito)
 * @param signal - AbortSignal opcional para cancelar o delay
 * @returns Promise que resolve após o tempo especificado
 * @throws {Error} Se ms não for um número positivo finito
 * @throws {Error} Se o delay for abortado
 */
export function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (!Number.isFinite(ms) || ms < 0) {
    throw new Error('Delay must be a positive finite number');
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, ms);

    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(timeout);
        reject(new Error('Delay aborted'));
      });
    }
  });
}

/**
 * Sanitiza uma string removendo caracteres potencialmente perigosos
 * @param input - A string a ser sanitizada
 * @returns String sanitizada
 */
export function sanitizeString(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input
    .replace(/[<>]/g, '') // Remove < e >
    .replace(/javascript:/gi, '') // Remove javascript:
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Valida se uma string é um CPF válido
 * @param cpf - O CPF a ser validado (apenas números)
 * @returns true se o CPF for válido
 */
export function isValidCpf(cpf: string): boolean {
  if (!cpf || typeof cpf !== 'string') {
    return false;
  }

  // Remove caracteres não numéricos
  const cleanCpf = cpf.replace(/\D/g, '');

  if (cleanCpf.length !== 11) {
    return false;
  }

  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1{10}$/.test(cleanCpf)) {
    return false;
  }

  // Calcula dígitos verificadores
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCpf.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCpf.charAt(9))) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCpf.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCpf.charAt(10))) return false;

  return true;
}

/**
 * Valida se uma string é um CNPJ válido
 * @param cnpj - O CNPJ a ser validado (apenas números)
 * @returns true se o CNPJ for válido
 */
export function isValidCnpj(cnpj: string): boolean {
  if (!cnpj || typeof cnpj !== 'string') {
    return false;
  }

  // Remove caracteres não numéricos
  const cleanCnpj = cnpj.replace(/\D/g, '');

  if (cleanCnpj.length !== 14) {
    return false;
  }

  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1{13}$/.test(cleanCnpj)) {
    return false;
  }

  // Calcula primeiro dígito verificador
  let size = cleanCnpj.length - 2;
  let numbers = cleanCnpj.substring(0, size);
  const digits = cleanCnpj.substring(size);
  let sum = 0;
  let pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) return false;

  // Calcula segundo dígito verificador
  size = size + 1;
  numbers = cleanCnpj.substring(0, size);
  sum = 0;
  pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1))) return false;

  return true;
}

/**
 * Formata um valor monetário para exibição
 * @param value - O valor numérico
 * @param currency - A moeda (padrão: BRL)
 * @param locale - O locale (padrão: pt-BR)
 * @returns String formatada
 */
export function formatCurrency(
  value: number,
  currency: string = 'BRL',
  locale: string = 'pt-BR',
): string {
  if (!Number.isFinite(value)) {
    return '';
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(value);
}

/**
 * Retorna o símbolo da moeda
 * @param currency - O código ISO 4217 da moeda (ex: BRL, USD, EUR)
 * @param locale - O locale para formatação (padrão: en)
 * @returns O símbolo da moeda
 */
export function getCurrencySymbol(
  currency: string,
  locale: string = 'en',
): string {
  try {
    const parts = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).formatToParts(0);
    const symbolPart = parts.find((part) => part.type === 'currency');
    return symbolPart?.value || currency;
  } catch {
    return currency;
  }
}

/**
 * Mapeia código de país para locale padrão
 */
const countryToLocale: Record<string, string> = {
  BR: 'pt-BR',
  US: 'en-US',
  MX: 'es-MX',
  AR: 'es-AR',
  CO: 'es-CO',
  CL: 'es-CL',
  PE: 'es-PE',
  CA: 'en-CA',
};

/**
 * Retorna o locale padrão para um país
 * @param countryCode - Código ISO 3166-1 alpha-2 do país
 * @returns O locale padrão
 */
export function getLocaleForCountry(countryCode: string): string {
  return countryToLocale[countryCode.toUpperCase()] || 'en-US';
}

// ============================================================================
// Timezone Utilities
// ============================================================================

/**
 * Formata uma data em um timezone específico
 * @param date - A data a ser formatada
 * @param timezone - O identificador IANA do timezone (ex: America/Sao_Paulo)
 * @param options - Opções de formatação do Intl.DateTimeFormat
 * @param locale - O locale para formatação (padrão: pt-BR)
 * @returns A data formatada
 */
export function formatDateInTimezone(
  date: Date | string,
  timezone: string,
  options: Intl.DateTimeFormatOptions = {},
  locale: string = 'pt-BR',
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    return '';
  }

  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      ...options,
    }).format(dateObj);
  } catch {
    // Fallback to UTC if timezone is invalid
    return new Intl.DateTimeFormat(locale, options).format(dateObj);
  }
}

/**
 * Formata uma data para exibição (DD/MM/YYYY)
 * @param date - A data a ser formatada
 * @param timezone - O identificador IANA do timezone
 * @param locale - O locale para formatação (padrão: pt-BR)
 * @returns A data formatada
 */
export function formatShortDate(
  date: Date | string,
  timezone: string,
  locale: string = 'pt-BR',
): string {
  return formatDateInTimezone(
    date,
    timezone,
    { year: 'numeric', month: '2-digit', day: '2-digit' },
    locale,
  );
}

/**
 * Formata uma data com hora para exibição (DD/MM/YYYY HH:mm)
 * @param date - A data a ser formatada
 * @param timezone - O identificador IANA do timezone
 * @param locale - O locale para formatação (padrão: pt-BR)
 * @returns A data e hora formatadas
 */
export function formatDateTime(
  date: Date | string,
  timezone: string,
  locale: string = 'pt-BR',
): string {
  return formatDateInTimezone(
    date,
    timezone,
    {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    },
    locale,
  );
}

/**
 * Formata apenas a hora (HH:mm)
 * @param date - A data a ser formatada
 * @param timezone - O identificador IANA do timezone
 * @param locale - O locale para formatação (padrão: pt-BR)
 * @returns A hora formatada
 */
export function formatTime(
  date: Date | string,
  timezone: string,
  locale: string = 'pt-BR',
): string {
  return formatDateInTimezone(
    date,
    timezone,
    { hour: '2-digit', minute: '2-digit' },
    locale,
  );
}

/**
 * Extrai a data (YYYY-MM-DD) em um timezone específico
 * @param date - A data UTC
 * @param timezone - O identificador IANA do timezone
 * @returns String da data no formato YYYY-MM-DD
 */
export function getDateStringInTimezone(
  date: Date | string,
  timezone: string,
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    return '';
  }

  try {
    // Use en-CA locale as it formats dates as YYYY-MM-DD
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(dateObj);
  } catch {
    return dateObj.toISOString().split('T')[0];
  }
}

/**
 * Verifica se um timezone é válido
 * @param timezone - O identificador IANA do timezone
 * @returns true se o timezone for válido
 */
export function isValidTimezone(timezone: string): boolean {
  if (!timezone || typeof timezone !== 'string') {
    return false;
  }

  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Retorna a abreviação do timezone (ex: BRT, EST, PST)
 * @param timezone - O identificador IANA do timezone
 * @param date - A data de referência (padrão: agora)
 * @returns A abreviação do timezone
 */
export function getTimezoneAbbreviation(
  timezone: string,
  date: Date = new Date(),
): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short',
    });
    const parts = formatter.formatToParts(date);
    const tzPart = parts.find((part) => part.type === 'timeZoneName');
    return tzPart?.value || timezone;
  } catch {
    return timezone;
  }
}

/**
 * Retorna o offset do timezone em formato legível (ex: -03:00, +05:30)
 * @param timezone - O identificador IANA do timezone
 * @param date - A data de referência (padrão: agora)
 * @returns O offset do timezone
 */
export function getTimezoneOffset(
  timezone: string,
  date: Date = new Date(),
): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'longOffset',
    });
    const parts = formatter.formatToParts(date);
    const tzPart = parts.find((part) => part.type === 'timeZoneName');
    // Returns something like "GMT-03:00", extract just the offset
    const offset = tzPart?.value?.replace('GMT', '') || '+00:00';
    return offset || '+00:00';
  } catch {
    return '+00:00';
  }
}
