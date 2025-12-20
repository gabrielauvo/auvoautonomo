/**
 * WorkOrderSignatureService
 *
 * Serviço para gerenciar assinaturas de finalização de OS.
 * Suporta captura offline e sincronização com backend.
 */

import { SignatureRepository, CreateSignatureInput } from '../repositories/SignatureRepository';
import { Signature } from '../../../db/schema';
import { syncEngine } from '../../../sync';
import { generateSignatureHash } from '../../checklists/SignatureSyncConfig';
import { fetchWithTimeout } from '../../../utils/fetch-with-timeout';

// =============================================================================
// TYPES
// =============================================================================

export interface CaptureSignatureInput {
  workOrderId: string;
  clientId: string;
  signerName: string;
  signerDocument?: string;
  signerRole: string;
  signatureBase64: string;
}

export interface SignatureSyncResult {
  success: boolean;
  signatureId?: string;
  attachmentId?: string;
  error?: string;
}

// =============================================================================
// SERVICE CLASS
// =============================================================================

class WorkOrderSignatureServiceClass {
  private technicianId: string | null = null;
  private isOnlineCheck: boolean = true;

  /**
   * Configurar o serviço
   */
  configure(technicianId: string): void {
    this.technicianId = technicianId;
    console.log('[WorkOrderSignatureService] Configured for technician:', technicianId);
  }

  /**
   * Verificar se está online
   */
  private isOnline(): boolean {
    return syncEngine.isConfigured() && this.isOnlineCheck;
  }

  /**
   * Obter configuração da API
   */
  private getApiConfig(): { baseUrl: string; authToken: string } {
    const config = syncEngine.getConfig();
    if (!config) {
      throw new Error('SyncEngine not configured');
    }
    return {
      baseUrl: config.apiUrl,
      authToken: config.authToken,
    };
  }

  /**
   * Capturar e salvar assinatura
   * Salva localmente primeiro, depois tenta sincronizar
   */
  async captureSignature(input: CaptureSignatureInput): Promise<Signature> {
    if (!this.technicianId) {
      throw new Error('Service not configured - technicianId missing');
    }

    console.log('[WorkOrderSignatureService] Capturing signature for WO:', input.workOrderId);

    // Gerar hash para integridade
    const hash = await generateSignatureHash(input.signatureBase64);

    // Criar assinatura localmente
    const signature = await SignatureRepository.create({
      ...input,
      technicianId: this.technicianId,
      deviceInfo: `Mobile App - ${new Date().toISOString()}`,
    });

    // Atualizar hash
    await SignatureRepository.updateHash(signature.id, hash);

    console.log('[WorkOrderSignatureService] Signature saved locally:', signature.id);

    // Tentar sincronizar imediatamente se online
    if (this.isOnline()) {
      try {
        await this.syncSignature(signature.id);
      } catch (error) {
        console.warn('[WorkOrderSignatureService] Immediate sync failed, will retry later:', error);
      }
    }

    return signature;
  }

  /**
   * Sincronizar uma assinatura específica
   */
  async syncSignature(signatureId: string): Promise<SignatureSyncResult> {
    const signature = await SignatureRepository.getById(signatureId);
    if (!signature) {
      return { success: false, error: 'Signature not found' };
    }

    if (signature.syncedAt) {
      return { success: true, signatureId: signature.id };
    }

    if (!signature.workOrderId) {
      return { success: false, error: 'Signature has no workOrderId' };
    }

    if (!signature.signatureBase64) {
      return { success: false, error: 'Signature has no image data' };
    }

    try {
      const { baseUrl, authToken } = this.getApiConfig();
      const url = `${baseUrl}/work-orders/${signature.workOrderId}/signature`;

      console.log('[WorkOrderSignatureService] Syncing signature to:', url);

      const response = await fetchWithTimeout(url, {
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
          localId: signature.localId,
        }),
        timeout: 60000,
        retries: 2,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Sync failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('[WorkOrderSignatureService] Sync result:', result);

      // Marcar como sincronizada
      await SignatureRepository.markSynced(signatureId, result.attachmentId);

      return {
        success: true,
        signatureId: signature.id,
        attachmentId: result.attachmentId,
      };
    } catch (error) {
      console.error('[WorkOrderSignatureService] Sync error:', error);
      return {
        success: false,
        signatureId: signature.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Sincronizar todas as assinaturas pendentes
   */
  async syncAllPending(): Promise<{ synced: number; failed: number }> {
    if (!this.technicianId) {
      return { synced: 0, failed: 0 };
    }

    const pending = await SignatureRepository.getPendingSync(this.technicianId);
    console.log('[WorkOrderSignatureService] Found', pending.length, 'pending signatures');

    let synced = 0;
    let failed = 0;

    for (const signature of pending) {
      const result = await this.syncSignature(signature.id);
      if (result.success) {
        synced++;
      } else {
        failed++;
      }
    }

    console.log('[WorkOrderSignatureService] Sync complete:', { synced, failed });
    return { synced, failed };
  }

  /**
   * Obter assinatura de uma OS
   */
  async getSignature(workOrderId: string): Promise<Signature | null> {
    return SignatureRepository.getByWorkOrderId(workOrderId);
  }

  /**
   * Verificar se OS tem assinatura
   */
  async hasSignature(workOrderId: string): Promise<boolean> {
    return SignatureRepository.hasSignature(workOrderId);
  }

  /**
   * Deletar assinatura (apenas se não sincronizada)
   */
  async deleteSignature(signatureId: string): Promise<boolean> {
    const signature = await SignatureRepository.getById(signatureId);
    if (!signature) {
      return false;
    }

    if (signature.syncedAt) {
      console.warn('[WorkOrderSignatureService] Cannot delete synced signature');
      return false;
    }

    await SignatureRepository.delete(signatureId);
    return true;
  }
}

// Singleton instance
export const WorkOrderSignatureService = new WorkOrderSignatureServiceClass();

export default WorkOrderSignatureService;
