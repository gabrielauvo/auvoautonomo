/**
 * SignatureSyncConfig
 *
 * Configuração de sincronização para Assinaturas Digitais.
 * Assinaturas são capturadas offline e sincronizadas com o servidor.
 * Inclui hash SHA256 para garantir integridade.
 */

import { SyncEntityConfig } from '../../sync/types';
import { Signature } from '../../db/schema';

// =============================================================================
// SERVER RESPONSE TYPES
// =============================================================================

interface ServerSignature {
  id: string;
  technicianId: string;
  workOrderId?: string;
  quoteId?: string;
  clientId: string;
  attachmentId?: string;
  signerName: string;
  signerDocument?: string;
  signerRole: string;
  signedAt: string;
  hash?: string;
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: string;
  localId?: string;
  deletedAt?: string;
  syncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// SYNC CONFIG
// =============================================================================

export const SignatureSyncConfig: SyncEntityConfig<Signature> = {
  name: 'signatures',
  tableName: 'signatures',
  apiEndpoint: '/signatures/sync',
  apiMutationEndpoint: '/signatures', // POST para criar assinatura
  cursorField: 'updatedAt',
  primaryKeys: ['id'],
  scopeField: 'technicianId',
  batchSize: 50,
  conflictResolution: 'server_wins', // Assinaturas são imutáveis após criação

  /**
   * Transform server response to local format
   */
  transformFromServer: (data: unknown): Signature => {
    const serverItem = data as ServerSignature;

    return {
      id: serverItem.id,
      workOrderId: serverItem.workOrderId,
      quoteId: serverItem.quoteId,
      clientId: serverItem.clientId,
      attachmentId: serverItem.attachmentId,
      signerName: serverItem.signerName,
      signerDocument: serverItem.signerDocument,
      signerRole: serverItem.signerRole,
      signedAt: serverItem.signedAt,
      hash: serverItem.hash,
      ipAddress: serverItem.ipAddress,
      userAgent: serverItem.userAgent,
      deviceInfo: serverItem.deviceInfo,
      localId: serverItem.localId,
      syncedAt: serverItem.syncedAt,
      createdAt: serverItem.createdAt,
      updatedAt: serverItem.updatedAt,
      technicianId: serverItem.technicianId,
      // Dados locais não vêm do servidor
      signatureBase64: undefined,
      signatureFilePath: undefined,
    };
  },

  /**
   * Transform local item to server mutation format
   * Backend espera formato específico do CreateSignatureDto
   */
  transformToServer: (localItem: Signature): unknown => {
    return {
      workOrderId: localItem.workOrderId,
      quoteId: localItem.quoteId,
      signerName: localItem.signerName,
      signerDocument: localItem.signerDocument,
      signerRole: localItem.signerRole,
      signedAt: localItem.signedAt,
      deviceInfo: localItem.deviceInfo,
      localId: localItem.localId || localItem.id, // Para idempotência
      // signatureBase64 é enviado como arquivo separado
    };
  },
};

// =============================================================================
// SIGNER ROLES
// =============================================================================

export const SIGNER_ROLES = {
  CLIENT: 'Cliente',
  TECHNICIAN: 'Técnico',
  RESPONSIBLE: 'Responsável',
  WITNESS: 'Testemunha',
} as const;

export type SignerRole = typeof SIGNER_ROLES[keyof typeof SIGNER_ROLES];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate SHA256 hash for signature integrity
 * Uses expo-crypto on mobile
 */
export async function generateSignatureHash(signatureData: string): Promise<string> {
  try {
    // Usa expo-crypto se disponível
    const Crypto = require('expo-crypto');
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      signatureData,
    );
    return hash;
  } catch {
    // Fallback: simple hash for development
    let hash = 0;
    for (let i = 0; i < signatureData.length; i++) {
      const char = signatureData.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(64, '0');
  }
}

/**
 * Verify signature integrity using hash
 */
export async function verifySignatureIntegrity(
  signatureData: string,
  expectedHash: string,
): Promise<boolean> {
  const computedHash = await generateSignatureHash(signatureData);
  return computedHash === expectedHash;
}

/**
 * Create signature payload for upload
 */
export function createSignaturePayload(params: {
  workOrderId?: string;
  quoteId?: string;
  clientId: string;
  signerName: string;
  signerDocument?: string;
  signerRole: SignerRole;
  signatureBase64: string;
  deviceInfo?: string;
  technicianId: string;
}): Omit<Signature, 'id' | 'createdAt' | 'updatedAt'> {
  const now = new Date().toISOString();
  const localId = `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  return {
    workOrderId: params.workOrderId,
    quoteId: params.quoteId,
    clientId: params.clientId,
    signerName: params.signerName,
    signerDocument: params.signerDocument,
    signerRole: params.signerRole,
    signedAt: now,
    deviceInfo: params.deviceInfo,
    technicianId: params.technicianId,
    localId,
    signatureBase64: params.signatureBase64,
    signatureFilePath: undefined,
    attachmentId: undefined,
    hash: undefined, // Será calculado após upload
    ipAddress: undefined,
    userAgent: undefined,
    syncedAt: undefined,
  };
}

/**
 * Validate signature data
 */
export function validateSignature(signature: Partial<Signature>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!signature.signerName || signature.signerName.trim().length < 2) {
    errors.push('Nome do assinante é obrigatório (mínimo 2 caracteres)');
  }

  if (!signature.signerRole) {
    errors.push('Papel do assinante é obrigatório');
  }

  if (!signature.signatureBase64 && !signature.signatureFilePath) {
    errors.push('Dados da assinatura são obrigatórios');
  }

  if (!signature.workOrderId && !signature.quoteId) {
    errors.push('Assinatura deve estar vinculada a uma OS ou Orçamento');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export default SignatureSyncConfig;
