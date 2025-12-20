/**
 * File Validation
 *
 * Validação robusta de arquivos antes de upload.
 * Crítico para apps com 1M+ usuários para evitar:
 * - Uploads falhados por arquivos muito grandes
 * - Arquivos corrompidos ou inválidos
 * - Tipos de arquivo não suportados
 * - Consumo excessivo de dados móveis
 *
 * Features:
 * - Validação de tamanho
 * - Validação de tipo/extensão
 * - Validação de imagens (magic bytes)
 * - Mensagens de erro amigáveis
 */

import * as FileSystem from 'expo-file-system';

// =============================================================================
// TYPES
// =============================================================================

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  fileSize?: number;
  mimeType?: string;
}

export interface FileInfo {
  uri: string;
  size?: number;
  mimeType?: string;
}

export type AllowedFileType = 'image' | 'pdf' | 'document' | 'any';

// =============================================================================
// CONSTANTS
// =============================================================================

// Tamanhos máximos padrão (em bytes)
export const MAX_FILE_SIZE = {
  IMAGE: 10 * 1024 * 1024, // 10MB
  DOCUMENT: 20 * 1024 * 1024, // 20MB
  PDF: 15 * 1024 * 1024, // 15MB
  ANY: 25 * 1024 * 1024, // 25MB
};

// MIME types permitidos por categoria
export const ALLOWED_MIME_TYPES = {
  image: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif',
  ],
  pdf: ['application/pdf'],
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
  ],
  any: [], // Permite todos
};

// Extensões permitidas por categoria
export const ALLOWED_EXTENSIONS = {
  image: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif'],
  pdf: ['.pdf'],
  document: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt'],
  any: [], // Permite todas
};

// Magic bytes para validação de tipo de arquivo real
const FILE_SIGNATURES = {
  // Imagens
  jpeg: [0xff, 0xd8, 0xff],
  png: [0x89, 0x50, 0x4e, 0x47],
  gif: [0x47, 0x49, 0x46, 0x38],
  webp: [0x52, 0x49, 0x46, 0x46], // RIFF (WebP é RIFF)
  // Documentos
  pdf: [0x25, 0x50, 0x44, 0x46], // %PDF
};

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

/**
 * Validar tamanho do arquivo
 *
 * @param file - Informações do arquivo
 * @param maxSizeMB - Tamanho máximo em MB
 * @returns Resultado da validação
 */
export async function validateFileSize(
  file: FileInfo,
  maxSizeMB: number
): Promise<FileValidationResult> {
  try {
    // Se o tamanho já foi informado, usar ele
    let fileSize = file.size;

    // Se não, buscar do sistema de arquivos
    if (!fileSize) {
      const fileInfo = await FileSystem.getInfoAsync(file.uri);

      if (!fileInfo.exists) {
        return {
          valid: false,
          error: 'Arquivo não encontrado',
        };
      }

      fileSize = (fileInfo as any).size || 0;
    }

    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    if (fileSize > maxSizeBytes) {
      const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);
      return {
        valid: false,
        error: `Arquivo muito grande: ${fileSizeMB}MB. Máximo permitido: ${maxSizeMB}MB`,
        fileSize,
      };
    }

    return {
      valid: true,
      fileSize,
    };
  } catch (error) {
    return {
      valid: false,
      error: `Erro ao validar tamanho do arquivo: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Validar tipo/extensão do arquivo
 *
 * @param file - Informações do arquivo
 * @param allowedTypes - Tipos permitidos ('image', 'pdf', 'document', 'any')
 * @returns Resultado da validação
 */
export function validateFileType(
  file: FileInfo,
  allowedTypes: AllowedFileType[] = ['any']
): FileValidationResult {
  try {
    // Se permite qualquer tipo, validar apenas se é válido
    if (allowedTypes.includes('any')) {
      return { valid: true };
    }

    // Extrair extensão do URI
    const extension = getFileExtension(file.uri).toLowerCase();

    // Verificar se a extensão está nas permitidas
    let extensionValid = false;
    for (const type of allowedTypes) {
      const allowed = ALLOWED_EXTENSIONS[type] || [];
      if (allowed.length === 0 || allowed.includes(extension)) {
        extensionValid = true;
        break;
      }
    }

    if (!extensionValid) {
      return {
        valid: false,
        error: `Tipo de arquivo não permitido: ${extension}. Permitidos: ${allowedTypes.join(', ')}`,
      };
    }

    // Verificar MIME type se fornecido
    if (file.mimeType) {
      let mimeValid = false;
      for (const type of allowedTypes) {
        const allowed = ALLOWED_MIME_TYPES[type] || [];
        if (allowed.length === 0 || allowed.includes(file.mimeType)) {
          mimeValid = true;
          break;
        }
      }

      if (!mimeValid) {
        return {
          valid: false,
          error: `Tipo MIME não permitido: ${file.mimeType}`,
          mimeType: file.mimeType,
        };
      }
    }

    return {
      valid: true,
      mimeType: file.mimeType || getMimeTypeFromExtension(extension),
    };
  } catch (error) {
    return {
      valid: false,
      error: `Erro ao validar tipo do arquivo: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Validar se o arquivo é uma imagem válida
 * Verifica magic bytes (assinatura do arquivo) para prevenir uploads de arquivos corrompidos
 *
 * @param file - Informações do arquivo
 * @returns Resultado da validação
 */
export async function validateImage(file: FileInfo): Promise<FileValidationResult> {
  try {
    // Primeiro validar extensão/tipo
    const typeValidation = validateFileType(file, ['image']);
    if (!typeValidation.valid) {
      return typeValidation;
    }

    // Ler os primeiros bytes do arquivo para verificar assinatura
    const firstBytes = await readFileHeader(file.uri, 12);

    if (!firstBytes) {
      return {
        valid: false,
        error: 'Não foi possível ler o arquivo',
      };
    }

    // Verificar assinatura do arquivo
    const isValidImage =
      matchesSignature(firstBytes, FILE_SIGNATURES.jpeg) ||
      matchesSignature(firstBytes, FILE_SIGNATURES.png) ||
      matchesSignature(firstBytes, FILE_SIGNATURES.gif) ||
      matchesSignature(firstBytes, FILE_SIGNATURES.webp);

    if (!isValidImage) {
      return {
        valid: false,
        error: 'Arquivo não é uma imagem válida ou está corrompido',
      };
    }

    return {
      valid: true,
      mimeType: file.mimeType || getMimeTypeFromExtension(getFileExtension(file.uri)),
    };
  } catch (error) {
    return {
      valid: false,
      error: `Erro ao validar imagem: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Validação completa de arquivo
 * Combina validação de tamanho, tipo e conteúdo
 *
 * @param file - Informações do arquivo
 * @param options - Opções de validação
 * @returns Resultado da validação
 */
export async function validateFile(
  file: FileInfo,
  options: {
    maxSizeMB?: number;
    allowedTypes?: AllowedFileType[];
    validateImageContent?: boolean;
  } = {}
): Promise<FileValidationResult> {
  const {
    maxSizeMB = MAX_FILE_SIZE.ANY / (1024 * 1024),
    allowedTypes = ['any'],
    validateImageContent = true,
  } = options;

  // 1. Validar tamanho
  const sizeValidation = await validateFileSize(file, maxSizeMB);
  if (!sizeValidation.valid) {
    return sizeValidation;
  }

  // 2. Validar tipo/extensão
  const typeValidation = validateFileType(file, allowedTypes);
  if (!typeValidation.valid) {
    return typeValidation;
  }

  // 3. Se é imagem e deve validar conteúdo, fazer validação profunda
  if (validateImageContent && allowedTypes.includes('image')) {
    const imageValidation = await validateImage(file);
    if (!imageValidation.valid) {
      return imageValidation;
    }
  }

  return {
    valid: true,
    fileSize: sizeValidation.fileSize,
    mimeType: typeValidation.mimeType,
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Extrair extensão do arquivo
 */
function getFileExtension(uri: string): string {
  const match = uri.match(/\.([^./?#]+)(\?.*)?$/);
  return match ? `.${match[1]}` : '';
}

/**
 * Obter MIME type baseado na extensão
 */
function getMimeTypeFromExtension(extension: string): string {
  const ext = extension.toLowerCase().replace('.', '');

  const mimeTypes: Record<string, string> = {
    // Imagens
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    heic: 'image/heic',
    heif: 'image/heif',
    // Documentos
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    txt: 'text/plain',
  };

  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Ler os primeiros bytes do arquivo
 */
async function readFileHeader(uri: string, length: number): Promise<number[] | null> {
  try {
    // Ler arquivo como base64
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
      length,
    });

    // Converter base64 para bytes
    const bytes: number[] = [];
    const binaryString = atob(base64);

    for (let i = 0; i < Math.min(binaryString.length, length); i++) {
      bytes.push(binaryString.charCodeAt(i));
    }

    return bytes;
  } catch (error) {
    console.error('Error reading file header:', error);
    return null;
  }
}

/**
 * Verificar se os bytes correspondem a uma assinatura
 */
function matchesSignature(bytes: number[], signature: number[]): boolean {
  if (bytes.length < signature.length) {
    return false;
  }

  for (let i = 0; i < signature.length; i++) {
    if (bytes[i] !== signature[i]) {
      return false;
    }
  }

  return true;
}

/**
 * Formatar tamanho de arquivo para exibição
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  validateFileSize,
  validateFileType,
  validateImage,
  validateFile,
  formatFileSize,
};
