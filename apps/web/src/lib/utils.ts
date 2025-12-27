import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================
// CPF/CNPJ Utilities
// ============================================

/**
 * Remove todos os caracteres não numéricos
 */
export function cleanDocument(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Aplica máscara de CPF: 000.000.000-00
 */
export function maskCPF(value: string): string {
  const cleaned = cleanDocument(value);
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}.${cleaned.slice(3)}`;
  if (cleaned.length <= 9) return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6)}`;
  return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9, 11)}`;
}

/**
 * Aplica máscara de CNPJ: 00.000.000/0000-00
 */
export function maskCNPJ(value: string): string {
  const cleaned = cleanDocument(value);
  if (cleaned.length <= 2) return cleaned;
  if (cleaned.length <= 5) return `${cleaned.slice(0, 2)}.${cleaned.slice(2)}`;
  if (cleaned.length <= 8) return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5)}`;
  if (cleaned.length <= 12) return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5, 8)}/${cleaned.slice(8)}`;
  return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5, 8)}/${cleaned.slice(8, 12)}-${cleaned.slice(12, 14)}`;
}

/**
 * Aplica máscara de CPF ou CNPJ baseado no tamanho
 * CPF: 11 dígitos, CNPJ: 14 dígitos
 */
export function maskCPFCNPJ(value: string): string {
  const cleaned = cleanDocument(value);
  if (cleaned.length <= 11) {
    return maskCPF(cleaned);
  }
  return maskCNPJ(cleaned);
}

/**
 * Valida CPF
 */
export function isValidCPF(cpf: string): boolean {
  const cleaned = cleanDocument(cpf);

  if (cleaned.length !== 11) return false;

  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1+$/.test(cleaned)) return false;

  // Validação do primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned[9])) return false;

  // Validação do segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned[10])) return false;

  return true;
}

/**
 * Valida CNPJ
 */
export function isValidCNPJ(cnpj: string): boolean {
  const cleaned = cleanDocument(cnpj);

  if (cleaned.length !== 14) return false;

  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1+$/.test(cleaned)) return false;

  // Validação do primeiro dígito verificador
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleaned[i]) * weights1[i];
  }
  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;
  if (digit1 !== parseInt(cleaned[12])) return false;

  // Validação do segundo dígito verificador
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleaned[i]) * weights2[i];
  }
  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;
  if (digit2 !== parseInt(cleaned[13])) return false;

  return true;
}

/**
 * Valida CPF ou CNPJ baseado no tamanho
 */
export function isValidCPFCNPJ(value: string): boolean {
  const cleaned = cleanDocument(value);
  if (cleaned.length === 11) return isValidCPF(cleaned);
  if (cleaned.length === 14) return isValidCNPJ(cleaned);
  return false;
}

/**
 * Formata documento para exibição (com máscara)
 */
export function formatDocument(value: string | null | undefined): string {
  if (!value) return '';
  return maskCPFCNPJ(value);
}

// ============================================
// International Tax ID Utilities (USA, Mexico)
// ============================================

export type TaxIdLocale = 'pt-BR' | 'en-US' | 'es';

export interface TaxIdConfig {
  label: string;
  labelBusiness?: string;
  placeholder: string;
  placeholderBusiness?: string;
  mask: (value: string) => string;
  maxLength: number;
  validate?: (value: string) => boolean;
  required: boolean;
  showCnpjLookup: boolean;
}

/**
 * Get tax ID configuration based on locale
 */
export function getTaxIdConfig(locale: TaxIdLocale): TaxIdConfig {
  switch (locale) {
    case 'en-US':
      return {
        label: 'Tax ID (SSN/EIN)',
        labelBusiness: 'EIN (Employer ID)',
        placeholder: 'XXX-XX-XXXX or XX-XXXXXXX',
        placeholderBusiness: 'XX-XXXXXXX',
        mask: maskUSATaxId,
        maxLength: 11, // XX-XXXXXXX format
        validate: isValidUSATaxId,
        required: false, // Not strictly required in USA forms
        showCnpjLookup: false,
      };
    case 'es':
      return {
        label: 'RFC',
        labelBusiness: 'RFC (Registro Federal)',
        placeholder: 'XXXX000000XXX',
        placeholderBusiness: 'XXX000000XXX',
        mask: maskMexicoRFC,
        maxLength: 13, // 13 chars for individuals, 12 for businesses
        validate: isValidMexicoRFC,
        required: false, // Optional for our app
        showCnpjLookup: false,
      };
    case 'pt-BR':
    default:
      return {
        label: 'CPF / CNPJ',
        labelBusiness: 'CNPJ',
        placeholder: '000.000.000-00 ou 00.000.000/0000-00',
        placeholderBusiness: '00.000.000/0000-00',
        mask: maskCPFCNPJ,
        maxLength: 18,
        validate: isValidCPFCNPJ,
        required: true,
        showCnpjLookup: true,
      };
  }
}

/**
 * Check if locale uses Brazilian document system (CPF/CNPJ)
 */
export function usesBrazilianTaxId(locale: TaxIdLocale): boolean {
  return locale === 'pt-BR';
}

/**
 * Check if PIX payment should be available for this locale
 */
export function isPIXAvailable(locale: TaxIdLocale): boolean {
  return locale === 'pt-BR';
}

// ============================================
// USA Tax ID (EIN/SSN)
// ============================================

/**
 * Mask for USA Tax ID (SSN or EIN)
 * SSN: XXX-XX-XXXX (9 digits)
 * EIN: XX-XXXXXXX (9 digits)
 */
export function maskUSATaxId(value: string): string {
  const cleaned = value.replace(/[^0-9]/g, '');

  // Determine if it's SSN (starts with valid SSN pattern) or EIN
  // For simplicity, we'll use EIN format for business (XX-XXXXXXX)
  if (cleaned.length <= 2) return cleaned;
  if (cleaned.length <= 9) return `${cleaned.slice(0, 2)}-${cleaned.slice(2)}`;
  return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 9)}`;
}

/**
 * Mask for SSN specifically: XXX-XX-XXXX
 */
export function maskSSN(value: string): string {
  const cleaned = value.replace(/[^0-9]/g, '');
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 5) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 5)}-${cleaned.slice(5, 9)}`;
}

/**
 * Mask for EIN: XX-XXXXXXX
 */
export function maskEIN(value: string): string {
  const cleaned = value.replace(/[^0-9]/g, '');
  if (cleaned.length <= 2) return cleaned;
  return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 9)}`;
}

/**
 * Validate USA Tax ID (basic format check)
 */
export function isValidUSATaxId(value: string): boolean {
  const cleaned = value.replace(/[^0-9]/g, '');
  // EIN and SSN are both 9 digits
  return cleaned.length === 9;
}

// ============================================
// Mexico RFC
// ============================================

/**
 * Mask for Mexico RFC
 * Individual: 13 characters (XXXX000000XXX)
 * Business: 12 characters (XXX000000XXX)
 */
export function maskMexicoRFC(value: string): string {
  // RFC allows letters and numbers, keep alphanumeric only
  const cleaned = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return cleaned.slice(0, 13);
}

/**
 * Validate Mexico RFC (basic format check)
 * Individual: 13 chars, Business: 12 chars
 */
export function isValidMexicoRFC(value: string): boolean {
  const cleaned = value.replace(/[^A-Za-z0-9]/g, '');
  // RFC can be 12 (business) or 13 (individual) characters
  return cleaned.length === 12 || cleaned.length === 13;
}

// ============================================
// Phone Utilities
// ============================================

/**
 * Aplica máscara de telefone fixo: (00) 0000-0000
 */
export function maskPhoneFixed(value: string): string {
  const cleaned = cleanDocument(value);
  if (cleaned.length <= 2) return cleaned;
  if (cleaned.length <= 6) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
  return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6, 10)}`;
}

/**
 * Aplica máscara de celular: (00) 00000-0000
 */
export function maskPhoneMobile(value: string): string {
  const cleaned = cleanDocument(value);
  if (cleaned.length <= 2) return cleaned;
  if (cleaned.length <= 7) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
  return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7, 11)}`;
}

/**
 * Aplica máscara de telefone (fixo ou celular) baseado no tamanho
 * Fixo: 10 dígitos (00) 0000-0000
 * Celular: 11 dígitos (00) 00000-0000
 */
export function maskPhone(value: string): string {
  const cleaned = cleanDocument(value);
  if (cleaned.length <= 10) {
    return maskPhoneFixed(cleaned);
  }
  return maskPhoneMobile(cleaned);
}

/**
 * Formata telefone para exibição
 */
export function formatPhone(value: string | null | undefined): string {
  if (!value) return '';
  return maskPhone(value);
}
