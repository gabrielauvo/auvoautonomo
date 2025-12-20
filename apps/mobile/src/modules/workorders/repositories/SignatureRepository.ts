/**
 * SignatureRepository
 *
 * Repositório para gerenciar assinaturas de OS localmente.
 * Suporta operações offline-first com sync posterior.
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../../../db/database';
import { Signature } from '../../../db/schema';

// =============================================================================
// TYPES
// =============================================================================

export interface CreateSignatureInput {
  workOrderId: string;
  clientId: string;
  signerName: string;
  signerDocument?: string;
  signerRole: string;
  signatureBase64: string;
  deviceInfo?: string;
  technicianId: string;
}

export type SignatureSyncStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';

// =============================================================================
// REPOSITORY
// =============================================================================

export const SignatureRepository = {
  /**
   * Criar uma nova assinatura
   */
  async create(input: CreateSignatureInput): Promise<Signature> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    const id = uuidv4();
    const localId = `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const signature: Signature = {
      id,
      workOrderId: input.workOrderId,
      quoteId: undefined,
      clientId: input.clientId,
      attachmentId: undefined,
      signerName: input.signerName,
      signerDocument: input.signerDocument,
      signerRole: input.signerRole,
      signedAt: now,
      hash: undefined,
      ipAddress: undefined,
      userAgent: undefined,
      deviceInfo: input.deviceInfo,
      localId,
      syncedAt: undefined,
      createdAt: now,
      updatedAt: now,
      technicianId: input.technicianId,
      signatureBase64: input.signatureBase64,
      signatureFilePath: undefined,
    };

    await db.runAsync(
      `INSERT INTO signatures (
        id, workOrderId, quoteId, clientId, attachmentId,
        signerName, signerDocument, signerRole, signedAt,
        hash, ipAddress, userAgent, deviceInfo, localId,
        syncedAt, createdAt, updatedAt, technicianId,
        signatureBase64, signatureFilePath
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        signature.id,
        signature.workOrderId,
        signature.quoteId || null,
        signature.clientId,
        signature.attachmentId || null,
        signature.signerName,
        signature.signerDocument || null,
        signature.signerRole,
        signature.signedAt,
        signature.hash || null,
        signature.ipAddress || null,
        signature.userAgent || null,
        signature.deviceInfo || null,
        signature.localId,
        signature.syncedAt || null,
        signature.createdAt,
        signature.updatedAt,
        signature.technicianId,
        signature.signatureBase64,
        signature.signatureFilePath || null,
      ]
    );

    console.log('[SignatureRepository] Created signature:', id, 'for WO:', input.workOrderId);
    return signature;
  },

  /**
   * Buscar assinatura por ID
   */
  async getById(id: string): Promise<Signature | null> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<Signature>(
      'SELECT * FROM signatures WHERE id = ?',
      [id]
    );
    return result || null;
  },

  /**
   * Buscar assinatura por Work Order ID
   */
  async getByWorkOrderId(workOrderId: string): Promise<Signature | null> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<Signature>(
      'SELECT * FROM signatures WHERE workOrderId = ? ORDER BY createdAt DESC LIMIT 1',
      [workOrderId]
    );
    return result || null;
  },

  /**
   * Buscar assinaturas pendentes de sync
   */
  async getPendingSync(technicianId: string): Promise<Signature[]> {
    const db = await getDatabase();
    const results = await db.getAllAsync<Signature>(
      `SELECT * FROM signatures
       WHERE technicianId = ? AND syncedAt IS NULL
       ORDER BY createdAt ASC`,
      [technicianId]
    );
    return results;
  },

  /**
   * Marcar assinatura como sincronizada
   */
  async markSynced(id: string, attachmentId?: string): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    await db.runAsync(
      `UPDATE signatures
       SET syncedAt = ?, attachmentId = ?, updatedAt = ?
       WHERE id = ?`,
      [now, attachmentId || null, now, id]
    );

    console.log('[SignatureRepository] Marked signature as synced:', id);
  },

  /**
   * Atualizar hash da assinatura
   */
  async updateHash(id: string, hash: string): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    await db.runAsync(
      'UPDATE signatures SET hash = ?, updatedAt = ? WHERE id = ?',
      [hash, now, id]
    );
  },

  /**
   * Deletar assinatura
   */
  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM signatures WHERE id = ?', [id]);
    console.log('[SignatureRepository] Deleted signature:', id);
  },

  /**
   * Verificar se OS tem assinatura
   */
  async hasSignature(workOrderId: string): Promise<boolean> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM signatures WHERE workOrderId = ?',
      [workOrderId]
    );
    return (result?.count || 0) > 0;
  },
};

export default SignatureRepository;
