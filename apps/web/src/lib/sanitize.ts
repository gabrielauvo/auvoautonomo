/**
 * Sanitization Library
 *
 * Funções para sanitização e validação de inputs para prevenir XSS,
 * Path Traversal e outras vulnerabilidades de segurança.
 *
 * SEGURANÇA: Todas as entradas de usuário devem passar por sanitização.
 */

import DOMPurify from 'isomorphic-dompurify';

/**
 * Configuração padrão do DOMPurify
 */
const DOMPURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'u', 's', 'a', 'ul', 'ol', 'li',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre'
  ],
  ALLOWED_ATTR: ['href', 'title', 'target', 'rel'],
  ALLOW_DATA_ATTR: false,
};

/**
 * Sanitiza HTML removendo scripts e tags perigosas
 *
 * @param html - HTML bruto para sanitizar
 * @param config - Configuração customizada (opcional)
 * @returns HTML limpo e seguro
 *
 * @example
 * ```ts
 * const userInput = '<script>alert("xss")</script><p>Hello</p>';
 * const safe = sanitizeHtml(userInput); // '<p>Hello</p>'
 * ```
 */
export function sanitizeHtml(
  html: string,
  config: typeof DOMPURIFY_CONFIG = DOMPURIFY_CONFIG
): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, config);
}

/**
 * Valida e sanitiza URLs para prevenir javascript:, data: e outros protocolos perigosos
 *
 * @param url - URL para validar
 * @param allowedProtocols - Protocolos permitidos (padrão: http, https)
 * @returns URL válida ou null se inválida
 *
 * @example
 * ```ts
 * sanitizeUrl('javascript:alert(1)'); // null
 * sanitizeUrl('https://example.com'); // 'https://example.com'
 * ```
 */
export function sanitizeUrl(
  url: string | null | undefined,
  allowedProtocols: string[] = ['http:', 'https:', 'mailto:']
): string | null {
  if (!url) return null;

  try {
    // Remove espaços e caracteres invisíveis
    const cleanUrl = url.trim();

    // Verifica se é URL relativa válida
    if (cleanUrl.startsWith('/') && !cleanUrl.startsWith('//')) {
      // Previne path traversal
      if (cleanUrl.includes('..')) {
        console.warn('Path traversal attempt detected:', cleanUrl);
        return null;
      }
      return cleanUrl;
    }

    // Parse da URL
    const parsed = new URL(cleanUrl);

    // Valida protocolo
    if (!allowedProtocols.includes(parsed.protocol)) {
      console.warn('Invalid protocol detected:', parsed.protocol);
      return null;
    }

    // Previne URLs com credenciais embutidas
    if (parsed.username || parsed.password) {
      console.warn('URL with credentials detected');
      return null;
    }

    return parsed.toString();
  } catch (error) {
    console.warn('Invalid URL:', url);
    return null;
  }
}

/**
 * Valida URL de redirect para prevenir Open Redirect
 *
 * IMPORTANTE: Apenas permite redirects internos ou domínios whitelisted
 *
 * @param redirectUrl - URL de redirect
 * @param allowedDomains - Domínios permitidos para redirect externo
 * @returns URL válida ou null
 *
 * @example
 * ```ts
 * validateRedirectUrl('/dashboard'); // '/dashboard'
 * validateRedirectUrl('https://evil.com'); // null
 * validateRedirectUrl('https://auvo.com', ['auvo.com']); // 'https://auvo.com'
 * ```
 */
export function validateRedirectUrl(
  redirectUrl: string | null | undefined,
  allowedDomains: string[] = []
): string | null {
  if (!redirectUrl) return null;

  try {
    const cleanUrl = redirectUrl.trim();

    // Se é URL relativa, valida
    if (cleanUrl.startsWith('/') && !cleanUrl.startsWith('//')) {
      // Previne path traversal
      if (cleanUrl.includes('..')) {
        console.warn('Path traversal in redirect:', cleanUrl);
        return null;
      }
      return cleanUrl;
    }

    // Se é URL absoluta, valida domínio
    const parsed = new URL(cleanUrl);

    // Apenas HTTP/HTTPS
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      console.warn('Invalid redirect protocol:', parsed.protocol);
      return null;
    }

    // Verifica se domínio está na whitelist
    const hostname = parsed.hostname.toLowerCase();
    const isAllowed = allowedDomains.some(domain =>
      hostname === domain || hostname.endsWith('.' + domain)
    );

    if (!isAllowed) {
      console.warn('Redirect to unauthorized domain:', hostname);
      return null;
    }

    return parsed.toString();
  } catch (error) {
    console.warn('Invalid redirect URL:', redirectUrl);
    return null;
  }
}

/**
 * Sanitiza nome de arquivo para prevenir Path Traversal e caracteres perigosos
 *
 * @param filename - Nome do arquivo
 * @returns Nome limpo e seguro
 *
 * @example
 * ```ts
 * sanitizeFileName('../../etc/passwd'); // 'etc_passwd'
 * sanitizeFileName('<script>.pdf'); // 'script.pdf'
 * ```
 */
export function sanitizeFileName(filename: string): string {
  if (!filename) return 'file';

  // Remove path separators
  let clean = filename.replace(/[\/\\]/g, '');

  // Remove caracteres perigosos
  clean = clean.replace(/[<>:"|?*\x00-\x1F]/g, '');

  // Remove .. (path traversal)
  clean = clean.replace(/\.\./g, '');

  // Remove espaços no início/fim
  clean = clean.trim();

  // Se ficou vazio, usa nome padrão
  if (!clean) return 'file';

  // Limita tamanho
  const maxLength = 255;
  if (clean.length > maxLength) {
    const ext = clean.substring(clean.lastIndexOf('.'));
    clean = clean.substring(0, maxLength - ext.length) + ext;
  }

  return clean;
}

/**
 * Valida extensão de arquivo
 *
 * @param filename - Nome do arquivo
 * @param allowedExtensions - Extensões permitidas (com ou sem ponto)
 * @returns true se extensão é permitida
 *
 * @example
 * ```ts
 * validateFileExtension('doc.pdf', ['pdf', 'jpg']); // true
 * validateFileExtension('malware.exe', ['pdf', 'jpg']); // false
 * ```
 */
export function validateFileExtension(
  filename: string,
  allowedExtensions: string[]
): boolean {
  if (!filename) return false;

  const ext = filename.substring(filename.lastIndexOf('.') + 1).toLowerCase();

  const normalizedAllowed = allowedExtensions.map(e =>
    e.startsWith('.') ? e.substring(1).toLowerCase() : e.toLowerCase()
  );

  return normalizedAllowed.includes(ext);
}

/**
 * Valida tipo MIME de arquivo
 *
 * @param mimeType - Tipo MIME do arquivo
 * @param allowedTypes - Tipos MIME permitidos ou categorias (image/*, video/*)
 * @returns true se tipo é permitido
 *
 * @example
 * ```ts
 * validateMimeType('image/jpeg', ['image/*']); // true
 * validateMimeType('application/exe', ['image/*']); // false
 * ```
 */
export function validateMimeType(
  mimeType: string,
  allowedTypes: string[]
): boolean {
  if (!mimeType) return false;

  const normalizedMime = mimeType.toLowerCase();

  return allowedTypes.some(allowed => {
    const normalizedAllowed = allowed.toLowerCase();

    // Wildcard match (image/*)
    if (normalizedAllowed.endsWith('/*')) {
      const category = normalizedAllowed.substring(0, normalizedAllowed.length - 1);
      return normalizedMime.startsWith(category);
    }

    // Exact match
    return normalizedMime === normalizedAllowed;
  });
}

/**
 * Valida tamanho de arquivo
 *
 * @param fileSize - Tamanho em bytes
 * @param maxSizeMB - Tamanho máximo em MB
 * @returns true se tamanho é válido
 */
export function validateFileSize(fileSize: number, maxSizeMB: number = 10): boolean {
  const maxBytes = maxSizeMB * 1024 * 1024;
  return fileSize > 0 && fileSize <= maxBytes;
}

/**
 * Validação completa de arquivo para upload
 *
 * @param file - Arquivo para validar
 * @param options - Opções de validação
 * @returns Objeto com resultado da validação
 *
 * @example
 * ```ts
 * const result = validateFileUpload(file, {
 *   maxSizeMB: 5,
 *   allowedExtensions: ['jpg', 'png'],
 *   allowedMimeTypes: ['image/*']
 * });
 * if (!result.valid) {
 *   console.error(result.error);
 * }
 * ```
 */
export function validateFileUpload(
  file: File,
  options: {
    maxSizeMB?: number;
    allowedExtensions?: string[];
    allowedMimeTypes?: string[];
  } = {}
): { valid: boolean; error?: string; sanitizedName?: string } {
  const {
    maxSizeMB = 10,
    allowedExtensions = [],
    allowedMimeTypes = []
  } = options;

  // Valida tamanho
  if (!validateFileSize(file.size, maxSizeMB)) {
    return {
      valid: false,
      error: `Arquivo muito grande. Tamanho máximo: ${maxSizeMB}MB`
    };
  }

  // Valida extensão
  if (allowedExtensions.length > 0 && !validateFileExtension(file.name, allowedExtensions)) {
    return {
      valid: false,
      error: `Extensão não permitida. Permitidas: ${allowedExtensions.join(', ')}`
    };
  }

  // Valida MIME type
  if (allowedMimeTypes.length > 0 && !validateMimeType(file.type, allowedMimeTypes)) {
    return {
      valid: false,
      error: `Tipo de arquivo não permitido`
    };
  }

  // Sanitiza nome
  const sanitizedName = sanitizeFileName(file.name);

  return {
    valid: true,
    sanitizedName
  };
}

/**
 * Escapa caracteres especiais para uso em RegExp
 *
 * @param str - String para escapar
 * @returns String escapada
 */
export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Sanitiza string para uso em SQL LIKE
 * (Apenas use se não estiver usando prepared statements!)
 *
 * @param str - String para sanitizar
 * @returns String sanitizada
 */
export function sanitizeSqlLike(str: string): string {
  return str.replace(/[%_]/g, '\\$&');
}

/**
 * Remove caracteres de controle e invisíveis de uma string
 *
 * @param str - String para limpar
 * @returns String limpa
 */
export function removeControlCharacters(str: string): string {
  if (!str) return '';
  // Remove caracteres de controle (0x00-0x1F) exceto \n \r \t
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

export const sanitize = {
  html: sanitizeHtml,
  url: sanitizeUrl,
  redirectUrl: validateRedirectUrl,
  fileName: sanitizeFileName,
  fileExtension: validateFileExtension,
  mimeType: validateMimeType,
  fileSize: validateFileSize,
  fileUpload: validateFileUpload,
  regExp: escapeRegExp,
  sqlLike: sanitizeSqlLike,
  controlChars: removeControlCharacters,
};

export default sanitize;
