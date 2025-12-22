// @ts-nocheck
/**
 * Quote Signature Service
 *
 * Gerencia assinaturas de orçamentos offline-first.
 * - Salva assinatura localmente
 * - Enfileira upload para sync
 * - Atualiza status do orçamento para APPROVED
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabase, rawQuery } from '../../db';
import { MutationQueue } from '../../queue/MutationQueue';
import { QuoteRepository } from './QuoteRepository';
import { syncEngine } from '../../sync';

// =============================================================================
// TYPES
// =============================================================================

export interface QuoteSignature {
  id: string;
  quoteId: string;
  signerName: string;
  signerDocument?: string;
  signerRole: string;
  signatureBase64: string;
  localPath?: string;
  remotePath?: string;
  syncStatus: 'PENDING' | 'UPLOADING' | 'SYNCED' | 'FAILED';
  uploadAttempts: number;
  lastUploadError?: string;
  signedAt: string;
  createdAt: string;
  updatedAt: string;
  technicianId: string;
}

export interface CreateQuoteSignatureInput {
  quoteId: string;
  signerName: string;
  signerDocument?: string;
  signerRole: string;
  signatureBase64: string;
  // Acceptance terms audit fields
  termsAcceptedAt?: string;
  termsHash?: string;
  termsVersion?: number;
}

export interface AcceptanceTermsData {
  required: boolean;
  termsContent: string | null;
  version: number;
  termsHash: string | null;
}

// =============================================================================
// QUOTE SIGNATURE SERVICE
// =============================================================================

class QuoteSignatureServiceClass {
  private technicianId: string | null = null;

  /**
   * Configurar o serviço com o ID do técnico
   */
  configure(technicianId: string): void {
    this.technicianId = technicianId;
  }

  /**
   * Criar assinatura para um orçamento
   * - Salva assinatura localmente
   * - Atualiza status do orçamento para APPROVED
   * - Enfileira upload para sync
   */
  async createSignature(input: CreateQuoteSignatureInput): Promise<QuoteSignature> {
    if (!this.technicianId) {
      throw new Error('QuoteSignatureService not configured. Call configure() first.');
    }

    // Verificar se orçamento existe
    const quote = await QuoteRepository.getById(input.quoteId);
    if (!quote) {
      throw new Error(`Quote ${input.quoteId} not found`);
    }

    // Verificar se orçamento está no status correto (DRAFT ou SENT)
    if (quote.status !== 'DRAFT' && quote.status !== 'SENT') {
      throw new Error(`Quote must be in DRAFT or SENT status to be signed. Current: ${quote.status}`);
    }

    // Verificar se já tem assinatura
    const existingSignature = await this.getByQuoteId(input.quoteId);
    if (existingSignature) {
      throw new Error(`Quote ${input.quoteId} already has a signature`);
    }

    const now = new Date().toISOString();
    const id = uuidv4();

    const signature: QuoteSignature = {
      id,
      quoteId: input.quoteId,
      signerName: input.signerName,
      signerDocument: input.signerDocument || undefined,
      signerRole: input.signerRole,
      signatureBase64: input.signatureBase64,
      syncStatus: 'PENDING',
      uploadAttempts: 0,
      signedAt: now,
      createdAt: now,
      updatedAt: now,
      technicianId: this.technicianId,
    };

    const db = await getDatabase();

    // 1. Salvar assinatura localmente
    await db.runAsync(
      `INSERT INTO quote_signatures (
        id, quoteId, signerName, signerDocument, signerRole,
        signatureBase64, localPath, remotePath, syncStatus,
        uploadAttempts, lastUploadError, signedAt, createdAt, updatedAt, technicianId
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        signature.id,
        signature.quoteId,
        signature.signerName,
        signature.signerDocument || null,
        signature.signerRole,
        signature.signatureBase64,
        signature.localPath || null,
        signature.remotePath || null,
        signature.syncStatus,
        signature.uploadAttempts,
        signature.lastUploadError || null,
        signature.signedAt,
        signature.createdAt,
        signature.updatedAt,
        signature.technicianId,
      ]
    );

    // 2. Atualizar status do orçamento para APPROVED
    await QuoteRepository.updateStatus(input.quoteId, 'APPROVED');

    // 3. Enfileirar update do status do orçamento
    await MutationQueue.enqueue('quotes', input.quoteId, 'update', {
      id: input.quoteId,
      clientId: quote.clientId,
      status: 'APPROVED',
    });

    console.log(`[QuoteSignatureService] Signature ${id} created for quote ${input.quoteId}`);

    // 5. Tentar sincronizar imediatamente se online
    if (syncEngine.isNetworkOnline()) {
      console.log('[QuoteSignatureService] Online - triggering immediate sync');
      this.uploadSignature(signature).catch((err) => {
        console.error('[QuoteSignatureService] Immediate upload failed:', err);
      });
    }

    return signature;
  }

  /**
   * Buscar assinatura por ID do orçamento
   */
  async getByQuoteId(quoteId: string): Promise<QuoteSignature | null> {
    const results = await rawQuery<QuoteSignature>(
      'SELECT * FROM quote_signatures WHERE quoteId = ?',
      [quoteId]
    );
    return results[0] || null;
  }

  /**
   * Buscar assinatura por ID
   */
  async getById(id: string): Promise<QuoteSignature | null> {
    const results = await rawQuery<QuoteSignature>(
      'SELECT * FROM quote_signatures WHERE id = ?',
      [id]
    );
    return results[0] || null;
  }

  /**
   * Listar assinaturas pendentes de upload
   */
  async getPendingUploads(): Promise<QuoteSignature[]> {
    if (!this.technicianId) {
      return [];
    }

    return rawQuery<QuoteSignature>(
      `SELECT * FROM quote_signatures
       WHERE technicianId = ? AND syncStatus IN ('PENDING', 'FAILED')
       ORDER BY createdAt ASC`,
      [this.technicianId]
    );
  }

  /**
   * Fazer upload da assinatura para o backend
   */
  async uploadSignature(signature: QuoteSignature): Promise<void> {
    const db = await getDatabase();
    const baseUrl = (syncEngine as any).baseUrl;
    const authToken = (syncEngine as any).authToken;

    if (!baseUrl || !authToken) {
      throw new Error('SyncEngine not configured');
    }

    // Verificar se o orçamento já foi sincronizado com o servidor
    // Se não, não podemos enviar a assinatura ainda (o orçamento não existe no servidor)
    const quoteResult = await rawQuery<{ syncedAt: string | null }>(
      'SELECT syncedAt FROM quotes WHERE id = ?',
      [signature.quoteId]
    );

    if (!quoteResult[0]?.syncedAt) {
      console.log(`[QuoteSignatureService] Quote ${signature.quoteId} not synced yet, skipping signature upload`);
      // Não é erro - apenas ainda não está pronto para upload
      // A assinatura será tentada novamente na próxima sincronização
      return;
    }

    try {
      // Marcar como uploading
      await db.runAsync(
        `UPDATE quote_signatures SET syncStatus = 'UPLOADING', updatedAt = ? WHERE id = ?`,
        [new Date().toISOString(), signature.id]
      );

      // Fazer upload para o backend
      const response = await fetch(`${baseUrl}/quotes/${signature.quoteId}/signature`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signerName: signature.signerName,
          signerDocument: signature.signerDocument,
          signerRole: signature.signerRole,
          imageBase64: signature.signatureBase64,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();

        // Se o servidor diz que já tem assinatura, marcar como synced
        if (response.status === 400 && errorText.includes('already has a signature')) {
          console.log(`[QuoteSignatureService] Quote ${signature.quoteId} already has signature on server - marking as synced`);
          await db.runAsync(
            `UPDATE quote_signatures SET syncStatus = 'SYNCED', updatedAt = ? WHERE id = ?`,
            [new Date().toISOString(), signature.id]
          );
          return;
        }

        throw new Error(`Upload failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      // Marcar como synced
      await db.runAsync(
        `UPDATE quote_signatures
         SET syncStatus = 'SYNCED', remotePath = ?, updatedAt = ?
         WHERE id = ?`,
        [result.attachmentId || result.id, new Date().toISOString(), signature.id]
      );

      console.log(`[QuoteSignatureService] Signature ${signature.id} uploaded successfully`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      // Incrementar tentativas e marcar erro
      await db.runAsync(
        `UPDATE quote_signatures
         SET syncStatus = 'FAILED', uploadAttempts = uploadAttempts + 1,
             lastUploadError = ?, updatedAt = ?
         WHERE id = ?`,
        [message, new Date().toISOString(), signature.id]
      );

      console.error(`[QuoteSignatureService] Upload failed for ${signature.id}:`, message);
      throw error;
    }
  }

  /**
   * Processar todos os uploads pendentes
   */
  async processAllPendingUploads(): Promise<{ success: number; failed: number }> {
    const pending = await this.getPendingUploads();
    let success = 0;
    let failed = 0;

    for (const signature of pending) {
      try {
        await this.uploadSignature(signature);
        success++;
      } catch (error) {
        failed++;
        console.error(`[QuoteSignatureService] Failed to upload ${signature.id}`);
      }
    }

    return { success, failed };
  }

  /**
   * Verificar se orçamento tem assinatura
   */
  async hasSignature(quoteId: string): Promise<boolean> {
    const signature = await this.getByQuoteId(quoteId);
    return signature !== null;
  }

  /**
   * Obter status do sync da assinatura
   */
  async getSignatureSyncStatus(quoteId: string): Promise<string | null> {
    const signature = await this.getByQuoteId(quoteId);
    return signature?.syncStatus || null;
  }

  /**
   * Buscar termos de aceite do backend para um orcamento
   * Usa o userId do orcamento para buscar os termos configurados
   */
  async getAcceptanceTerms(quoteId: string): Promise<AcceptanceTermsData | null> {
    const baseUrl = (syncEngine as any).baseUrl;
    const authToken = (syncEngine as any).authToken;

    if (!baseUrl || !authToken) {
      console.log('[QuoteSignatureService] SyncEngine not configured, returning null for acceptance terms');
      return null;
    }

    // Buscar o quote para obter o userId
    const quote = await QuoteRepository.getById(quoteId);
    if (!quote) {
      console.log(`[QuoteSignatureService] Quote ${quoteId} not found`);
      return null;
    }

    try {
      // Buscar termos de aceite do backend
      // O endpoint publico usa o userId do tecnico (dono do orcamento)
      const response = await fetch(`${baseUrl}/quotes/${quoteId}/acceptance-terms`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.log(`[QuoteSignatureService] Failed to fetch acceptance terms: ${response.status}`);
        return null;
      }

      const data = await response.json();
      return {
        required: data.required || false,
        termsContent: data.termsContent || null,
        version: data.version || 0,
        termsHash: data.termsHash || null,
      };
    } catch (error) {
      console.error('[QuoteSignatureService] Error fetching acceptance terms:', error);
      return null;
    }
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

export const QuoteSignatureService = new QuoteSignatureServiceClass();

export default QuoteSignatureService;
