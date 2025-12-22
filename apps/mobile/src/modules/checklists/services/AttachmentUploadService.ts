// @ts-nocheck
/**
 * AttachmentUploadService
 *
 * Serviço especializado para upload de anexos de checklist (fotos, assinaturas).
 * - Upload via base64 para o endpoint do backend
 * - Fila local com retry exponencial
 * - Compressão de imagens antes do upload
 * - Suporte a múltiplos uploads simultâneos
 */

import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { syncEngine } from '../../../sync';
import { ChecklistAttachmentRepository } from '../repositories/ChecklistAttachmentRepository';
import { AttachmentStorageService } from './AttachmentStorageService';
import {
  ChecklistAttachment,
  ChecklistAttachmentType,
  AttachmentSyncStatus,
} from '../../../db/schema';
import { validateFile, validateFileSize, MAX_FILE_SIZE } from '../../../utils/file-validation';
import { fetchWithTimeout } from '../../../utils/fetch-with-timeout';
import { SYNC_FLAGS } from '../../../config/syncFlags';

// =============================================================================
// TYPES
// =============================================================================

export interface UploadAttachmentInput {
  answerId: string;
  workOrderId: string;
  technicianId: string;
  type: ChecklistAttachmentType;
  localPath: string;
  fileName?: string;
  mimeType?: string;
}

// Tamanho máximo de arquivo (10MB)
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export interface UploadResult {
  success: boolean;
  attachmentId: string;
  remotePath?: string;
  error?: string;
}

export interface BatchUploadResult {
  success: boolean;
  uploaded: number;
  failed: number;
  results: UploadResult[];
}

export interface UploadProgress {
  attachmentId: string;
  progress: number;
  status: AttachmentSyncStatus;
}

export type UploadEventListener = (event: {
  type: 'progress' | 'completed' | 'failed' | 'queue_updated';
  data: UploadProgress | UploadResult | { pending: number };
}) => void;

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_RETRIES = 5;
const RETRY_DELAYS = [1000, 2000, 5000, 10000, 30000]; // Exponential backoff
const MAX_CONCURRENT_UPLOADS = 2;
const MAX_IMAGE_WIDTH = 800;  // Reduzido para evitar erro 413
const MAX_IMAGE_HEIGHT = 800; // Reduzido para evitar erro 413
const COMPRESSION_QUALITY = 0.5; // Reduzido para evitar erro 413

// =============================================================================
// ATTACHMENT UPLOAD SERVICE
// =============================================================================

class AttachmentUploadServiceClass {
  private technicianId: string | null = null;
  private isProcessing = false;
  private processingIds: Set<string> = new Set();
  private listeners: Set<UploadEventListener> = new Set();

  /**
   * Configurar o serviço
   */
  configure(technicianId: string): void {
    this.technicianId = technicianId;
  }

  /**
   * Obter configuração da API
   */
  private getApiConfig(): { baseUrl: string; authToken: string } {
    const engine = syncEngine as any;
    if (!engine.baseUrl || !engine.authToken) {
      throw new Error('SyncEngine não configurado');
    }
    return {
      baseUrl: engine.baseUrl,
      authToken: engine.authToken,
    };
  }

  /**
   * Verificar se está online
   */
  private isOnline(): boolean {
    return syncEngine.isNetworkOnline();
  }

  // =============================================================================
  // PUBLIC API
  // =============================================================================

  /**
   * Adicionar anexo à fila de upload
   */
  async queueUpload(input: UploadAttachmentInput): Promise<ChecklistAttachment> {
    const fileName = input.fileName || input.localPath.split('/').pop() || 'attachment';
    const mimeType = input.mimeType || this.getMimeType(fileName);

    // Validar arquivo antes de adicionar à fila
    const validation = await validateFile(
      {
        uri: input.localPath,
        mimeType,
      },
      {
        maxSizeMB: MAX_FILE_SIZE.IMAGE / (1024 * 1024), // 10MB
        allowedTypes: input.type === 'PHOTO' || input.type === 'SIGNATURE' ? ['image'] : ['any'],
        validateImageContent: input.type === 'PHOTO' || input.type === 'SIGNATURE',
      }
    );

    if (!validation.valid) {
      throw new Error(validation.error || 'Arquivo inválido');
    }

    const fileSize = validation.fileSize || 0;

    // Criar registro no banco local
    const attachment = await ChecklistAttachmentRepository.create({
      answerId: input.answerId,
      workOrderId: input.workOrderId,
      type: input.type,
      fileName,
      fileSize,
      mimeType,
      localPath: input.localPath,
      technicianId: input.technicianId,
    });

    console.log(`[AttachmentUploadService] Queued attachment ${attachment.id} for upload`);

    // Iniciar processamento se online
    if (this.isOnline()) {
      this.processQueue();
    }

    return attachment;
  }

  /**
   * Fazer upload imediato de um anexo (ex: assinatura em base64)
   *
   * OTIMIZAÇÃO (SYNC_OPT_FS_ATTACHMENTS):
   * Quando offline, salva no filesystem em vez do SQLite para evitar OOM.
   */
  async uploadBase64(
    answerId: string,
    base64Data: string,
    type: ChecklistAttachmentType,
    fileName: string = 'attachment'
  ): Promise<UploadResult> {
    const mimeType = type === 'SIGNATURE' ? 'image/png' : 'image/jpeg';

    if (!this.isOnline()) {
      // Salvar localmente para sync posterior
      const useFilesystem = SYNC_FLAGS.SYNC_OPT_FS_ATTACHMENTS;

      let attachmentData: Parameters<typeof ChecklistAttachmentRepository.create>[0];

      if (useFilesystem) {
        // NOVO: Salvar no filesystem
        try {
          await AttachmentStorageService.initialize();

          // Criar registro primeiro para ter o ID
          const tempAttachment = await ChecklistAttachmentRepository.create({
            answerId,
            workOrderId: '', // Será preenchido depois
            type,
            fileName,
            fileSize: Math.round(base64Data.length * 0.75),
            mimeType,
            technicianId: this.technicianId || '',
          });

          // Salvar no filesystem usando o ID
          const saveResult = await AttachmentStorageService.saveFromBase64(
            tempAttachment.id,
            base64Data,
            mimeType
          );

          // Atualizar registro com o caminho do arquivo
          await ChecklistAttachmentRepository.update(tempAttachment.id, {
            localPath: saveResult.filePath,
            fileSize: saveResult.sizeBytes,
          });

          console.log(`[AttachmentUploadService] Saved to filesystem: ${saveResult.filePath}`);

          return {
            success: false,
            attachmentId: tempAttachment.id,
            error: 'Offline - salvo no filesystem',
          };
        } catch (fsError) {
          console.warn('[AttachmentUploadService] Filesystem save failed, falling back to SQLite:', fsError);
          // Fallback para SQLite se filesystem falhar
        }
      }

      // ORIGINAL: Salvar base64Data no SQLite (fallback ou flag desabilitada)
      const attachment = await ChecklistAttachmentRepository.create({
        answerId,
        workOrderId: '', // Será preenchido depois
        type,
        fileName,
        fileSize: Math.round(base64Data.length * 0.75), // Aproximação do tamanho real
        mimeType,
        base64Data,
        technicianId: this.technicianId || '',
      });

      return {
        success: false,
        attachmentId: attachment.id,
        error: 'Offline - salvo localmente',
      };
    }

    try {
      const { baseUrl, authToken } = this.getApiConfig();
      const url = `${baseUrl}/checklist-instances/answers/${answerId}/attachments/base64`;

      const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: base64Data,
          type,
          fileName,
        }),
        timeout: 120000, // 2min timeout para upload de imagem
        retries: 2,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      // Salvar referência local
      const attachment = await ChecklistAttachmentRepository.create({
        answerId,
        workOrderId: '',
        type,
        fileName,
        fileSize: Math.round(base64Data.length * 0.75),
        mimeType: type === 'SIGNATURE' ? 'image/png' : 'image/jpeg',
        remotePath: result.storagePath || result.url,
        technicianId: this.technicianId || '',
      });

      // Marcar como sincronizado
      await ChecklistAttachmentRepository.markSynced(attachment.id, result.storagePath || result.url);

      return {
        success: true,
        attachmentId: attachment.id,
        remotePath: result.storagePath || result.url,
      };
    } catch (error) {
      console.error('[AttachmentUploadService] uploadBase64 error:', error);
      return {
        success: false,
        attachmentId: '',
        error: error instanceof Error ? error.message : 'Erro no upload',
      };
    }
  }

  /**
   * Processar fila de uploads pendentes
   */
  async processQueue(): Promise<BatchUploadResult> {
    if (this.isProcessing) {
      return { success: true, uploaded: 0, failed: 0, results: [] };
    }

    if (!this.isOnline()) {
      console.log('[AttachmentUploadService] Offline, skipping queue processing');
      return { success: false, uploaded: 0, failed: 0, results: [] };
    }

    // Verificar se temos configuração válida
    try {
      const config = this.getApiConfig();
      if (!config.baseUrl || !config.authToken) {
        console.log('[AttachmentUploadService] No valid API config, skipping queue processing');
        return { success: false, uploaded: 0, failed: 0, results: [] };
      }
    } catch (err) {
      console.log('[AttachmentUploadService] API not configured, skipping queue processing');
      return { success: false, uploaded: 0, failed: 0, results: [] };
    }

    this.isProcessing = true;
    const results: UploadResult[] = [];

    try {
      let networkErrorCount = 0;
      const MAX_NETWORK_ERRORS = 2; // Parar após 2 erros de rede consecutivos

      while (true) {
        // Buscar pendentes que não estão sendo processados
        const pending = await ChecklistAttachmentRepository.getPendingUpload(MAX_CONCURRENT_UPLOADS);
        const toProcess = pending.filter((a) => !this.processingIds.has(a.id));

        if (toProcess.length === 0) {
          break;
        }

        // Parar se tiver muitos erros de rede
        if (networkErrorCount >= MAX_NETWORK_ERRORS) {
          console.log('[AttachmentUploadService] Too many network errors, stopping queue processing');
          break;
        }

        // Processar um por um para detectar erros de rede mais cedo
        for (const attachment of toProcess) {
          const uploadResult = await this.uploadAttachment(attachment);
          results.push(uploadResult);

          // Detectar erro de rede
          if (!uploadResult.success && uploadResult.error?.includes('Network request failed')) {
            networkErrorCount++;
            if (networkErrorCount >= MAX_NETWORK_ERRORS) {
              console.log('[AttachmentUploadService] Network error detected, stopping queue');
              break;
            }
          } else if (uploadResult.success) {
            networkErrorCount = 0; // Reset contador se sucesso
          }
        }
      }

      const uploaded = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      this.emit('queue_updated', { pending: await this.countPending() });

      return {
        success: failed === 0,
        uploaded,
        failed,
        results,
      };
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Fazer upload de um anexo específico
   *
   * OTIMIZAÇÃO (SYNC_OPT_FS_ATTACHMENTS):
   * - Prefere localPath (filesystem) sobre base64Data (SQLite)
   * - Limpa arquivo do filesystem após upload bem sucedido
   */
  private async uploadAttachment(attachment: ChecklistAttachment): Promise<UploadResult> {
    this.processingIds.add(attachment.id);

    try {
      // VERIFICAÇÃO: Se a Answer ainda não foi sincronizada com o servidor,
      // não fazer upload separado - será enviado inline via sync de answers
      if (attachment.answerId) {
        // Verificar se a Answer já foi sincronizada
        const answer = await ChecklistAnswerRepository.getById(attachment.answerId);

        // Se a answer existe e não está sincronizada, pular o upload
        // O anexo será enviado junto com a sincronização da answer via pushPendingAnswers
        if (answer && answer.syncStatus !== 'SYNCED') {
          console.log(`[AttachmentUploadService] Skipping attachment ${attachment.id} - answer ${attachment.answerId} not synced yet (status: ${answer.syncStatus}), will sync with answer`);
          this.processingIds.delete(attachment.id);
          return {
            success: false,
            attachmentId: attachment.id,
            error: 'Answer ainda não sincronizada - aguardando sync de answers',
          };
        }

        // Se a answer não existe localmente (foi deletada ou corrompida), também pular
        if (!answer) {
          console.log(`[AttachmentUploadService] Skipping attachment ${attachment.id} - answer ${attachment.answerId} not found locally`);
          this.processingIds.delete(attachment.id);
          return {
            success: false,
            attachmentId: attachment.id,
            error: 'Answer não encontrada localmente',
          };
        }
      }

      // Marcar como uploading
      await ChecklistAttachmentRepository.markUploading(attachment.id);
      this.emit('progress', {
        attachmentId: attachment.id,
        progress: 0,
        status: 'UPLOADING',
      });

      // Obter dados base64
      // ORDEM DE PREFERÊNCIA:
      // 1. localPath (filesystem) - mais eficiente, lê sob demanda
      // 2. base64Data (SQLite) - fallback para registros antigos
      let base64Data: string;
      let usedFilesystem = false;

      if (attachment.localPath) {
        // PREFERIDO: Ler do filesystem
        const fileExists = await AttachmentStorageService.exists(attachment.localPath);
        if (fileExists) {
          // Comprimir imagem se for foto
          if (attachment.type === 'PHOTO' && this.isImage(attachment.mimeType || '')) {
            const compressed = await this.compressImage(attachment.localPath);
            base64Data = compressed.base64;
          } else {
            base64Data = await FileSystem.readAsStringAsync(attachment.localPath, {
              encoding: FileSystem.EncodingType.Base64,
            });
          }
          usedFilesystem = true;
        } else if (attachment.base64Data) {
          // Arquivo não existe, mas tem base64Data - usar fallback
          console.warn(`[AttachmentUploadService] File not found: ${attachment.localPath}, using base64Data`);
          base64Data = attachment.base64Data;
        } else {
          throw new Error(`Arquivo não encontrado: ${attachment.localPath}`);
        }
      } else if (attachment.base64Data) {
        // FALLBACK: Usar base64Data do SQLite (registros antigos)
        base64Data = attachment.base64Data;
      } else {
        throw new Error('Sem dados para upload');
      }

      // Escolher endpoint baseado em se tem answerId ou não
      const { baseUrl, authToken } = this.getApiConfig();
      let url: string;
      let body: any;

      if (attachment.answerId) {
        // Anexo de checklist - usa endpoint de answers
        url = `${baseUrl}/checklist-instances/answers/${attachment.answerId}/attachments/base64`;
        body = {
          data: base64Data,
          type: attachment.type,
          fileName: attachment.fileName,
        };
      } else if (attachment.workOrderId) {
        // Anexo direto de OS - usa endpoint /attachments/base64
        url = `${baseUrl}/attachments/base64`;
        body = {
          data: `data:${attachment.mimeType || 'image/jpeg'};base64,${base64Data}`,
          type: 'PHOTO',
          workOrderId: attachment.workOrderId,
        };
      } else {
        throw new Error('Anexo sem answerId nem workOrderId');
      }

      const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        timeout: 120000, // 2min timeout para uploads grandes
        retries: 2,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      const remotePath = result.storagePath || result.publicUrl || result.url || result.id;

      // Marcar como sincronizado
      await ChecklistAttachmentRepository.markSynced(attachment.id, remotePath);

      // LIMPEZA: Deletar arquivo do filesystem após upload bem sucedido
      if (usedFilesystem && attachment.localPath && SYNC_FLAGS.FS_ATTACHMENTS_DELETE_AFTER_SYNC) {
        try {
          await AttachmentStorageService.deleteFile(attachment.localPath);
          // Limpar referência do localPath no DB
          await ChecklistAttachmentRepository.update(attachment.id, { localPath: undefined });
          console.log(`[AttachmentUploadService] Cleaned up file after sync: ${attachment.localPath}`);
        } catch (cleanupError) {
          // Não falhar o upload por erro de limpeza
          console.warn(`[AttachmentUploadService] Cleanup failed:`, cleanupError);
        }
      }

      this.emit('completed', {
        success: true,
        attachmentId: attachment.id,
        remotePath,
      });

      return {
        success: true,
        attachmentId: attachment.id,
        remotePath,
      };
    } catch (error) {
      console.error(`[AttachmentUploadService] Upload error for ${attachment.id}:`, error);

      // Incrementar tentativas
      await ChecklistAttachmentRepository.incrementUploadAttempts(
        attachment.id,
        error instanceof Error ? error.message : 'Erro desconhecido'
      );

      this.emit('failed', {
        success: false,
        attachmentId: attachment.id,
        error: error instanceof Error ? error.message : 'Erro no upload',
      });

      return {
        success: false,
        attachmentId: attachment.id,
        error: error instanceof Error ? error.message : 'Erro no upload',
      };
    } finally {
      this.processingIds.delete(attachment.id);
    }
  }

  /**
   * Retry de um upload específico
   */
  async retryUpload(attachmentId: string): Promise<UploadResult> {
    const attachment = await ChecklistAttachmentRepository.getById(attachmentId);
    if (!attachment) {
      return {
        success: false,
        attachmentId,
        error: 'Anexo não encontrado',
      };
    }

    // Reset attempts
    await ChecklistAttachmentRepository.update(attachmentId, {
      uploadAttempts: 0,
      syncStatus: 'PENDING',
      lastUploadError: undefined,
    });

    return this.uploadAttachment(attachment);
  }

  /**
   * Retry de todos os uploads falhos
   */
  async retryAllFailed(): Promise<BatchUploadResult> {
    const failed = await ChecklistAttachmentRepository.getBySyncStatus('FAILED');

    for (const attachment of failed) {
      await ChecklistAttachmentRepository.update(attachment.id, {
        uploadAttempts: 0,
        syncStatus: 'PENDING',
        lastUploadError: undefined,
      });
    }

    return this.processQueue();
  }

  // =============================================================================
  // HELPERS
  // =============================================================================

  /**
   * Comprimir imagem antes do upload
   */
  private async compressImage(
    uri: string
  ): Promise<{ uri: string; base64: string }> {
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [
          {
            resize: {
              width: MAX_IMAGE_WIDTH,
              height: MAX_IMAGE_HEIGHT,
            },
          },
        ],
        {
          compress: COMPRESSION_QUALITY,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );

      return {
        uri: result.uri,
        base64: result.base64 || '',
      };
    } catch (error) {
      console.warn('[AttachmentUploadService] Image compression failed, using original:', error);
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return { uri, base64 };
    }
  }

  /**
   * Verificar se é uma imagem
   */
  private isImage(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  /**
   * Obter MIME type a partir do nome do arquivo
   */
  private getMimeType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  }

  // =============================================================================
  // STATISTICS
  // =============================================================================

  /**
   * Contar uploads pendentes
   */
  async countPending(): Promise<number> {
    return ChecklistAttachmentRepository.countPendingUpload(this.technicianId || undefined);
  }

  /**
   * Obter tamanho total pendente (em bytes)
   */
  async getPendingSize(): Promise<number> {
    return ChecklistAttachmentRepository.getPendingUploadSize(this.technicianId || undefined);
  }

  /**
   * Obter estatísticas de sync
   */
  async getStats(): Promise<{
    pending: number;
    uploading: number;
    synced: number;
    failed: number;
  }> {
    const counts = await ChecklistAttachmentRepository.countBySyncStatus();
    return {
      pending: counts.PENDING,
      uploading: counts.UPLOADING,
      synced: counts.SYNCED,
      failed: counts.FAILED,
    };
  }

  // =============================================================================
  // EVENT HANDLING
  // =============================================================================

  /**
   * Registrar listener de eventos
   */
  subscribe(listener: UploadEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Emitir evento
   */
  private emit(
    type: 'progress' | 'completed' | 'failed' | 'queue_updated',
    data: UploadProgress | UploadResult | { pending: number }
  ): void {
    for (const listener of this.listeners) {
      try {
        listener({ type, data });
      } catch (error) {
        console.error('[AttachmentUploadService] Event listener error:', error);
      }
    }
  }

  // =============================================================================
  // CLEANUP
  // =============================================================================

  /**
   * Limpar dados base64 de anexos já sincronizados
   */
  async clearSyncedBase64(): Promise<number> {
    return ChecklistAttachmentRepository.clearSyncedBase64();
  }

  /**
   * Executar migração de base64Data para filesystem
   * Deve ser chamado durante inicialização do app
   */
  async runMigration(): Promise<{ migrated: number; failed: number }> {
    if (!SYNC_FLAGS.SYNC_OPT_FS_ATTACHMENTS) {
      console.log('[AttachmentUploadService] Filesystem storage disabled, skipping migration');
      return { migrated: 0, failed: 0 };
    }

    try {
      const result = await AttachmentStorageService.migrateBase64ToFilesystem((progress) => {
        console.log(
          `[AttachmentUploadService] Migration progress: ${progress.processed}/${progress.total}`
        );
      });

      if (result.migrated > 0) {
        console.log(
          `[AttachmentUploadService] Migration complete: ${result.migrated} migrated, ${result.failed} failed`
        );
      }

      return { migrated: result.migrated, failed: result.failed };
    } catch (error) {
      console.error('[AttachmentUploadService] Migration error:', error);
      return { migrated: 0, failed: 0 };
    }
  }

  /**
   * Verificar se há migração pendente
   */
  async hasPendingMigration(): Promise<boolean> {
    if (!SYNC_FLAGS.SYNC_OPT_FS_ATTACHMENTS) {
      return false;
    }
    return AttachmentStorageService.hasPendingMigration();
  }

  /**
   * Limpar arquivos órfãos e anexos sincronizados
   */
  async runCleanup(): Promise<{ orphanedFiles: number; syncedFiles: number }> {
    if (!SYNC_FLAGS.SYNC_OPT_FS_ATTACHMENTS) {
      return { orphanedFiles: 0, syncedFiles: 0 };
    }

    const orphanedFiles = await AttachmentStorageService.cleanupOrphanedFiles();
    const syncedFiles = SYNC_FLAGS.FS_ATTACHMENTS_DELETE_AFTER_SYNC
      ? await AttachmentStorageService.cleanupSyncedAttachments()
      : 0;

    return { orphanedFiles, syncedFiles };
  }

  /**
   * Obter estatísticas de armazenamento
   */
  async getStorageStats(): Promise<{
    pendingCount: number;
    totalSizeBytes: number;
    filesystemFiles: number;
    filesystemSizeBytes: number;
  }> {
    const pendingCount = await this.countPending();
    const totalSizeBytes = await this.getPendingSize();

    if (SYNC_FLAGS.SYNC_OPT_FS_ATTACHMENTS) {
      const fsStats = await AttachmentStorageService.getStorageStats();
      return {
        pendingCount,
        totalSizeBytes,
        filesystemFiles: fsStats.totalFiles,
        filesystemSizeBytes: fsStats.totalSizeBytes,
      };
    }

    return {
      pendingCount,
      totalSizeBytes,
      filesystemFiles: 0,
      filesystemSizeBytes: 0,
    };
  }

  /**
   * Deletar arquivo local após sync bem sucedido
   */
  async deleteLocalFile(attachmentId: string): Promise<boolean> {
    const attachment = await ChecklistAttachmentRepository.getById(attachmentId);
    if (!attachment || !attachment.localPath) {
      return false;
    }

    if (attachment.syncStatus !== 'SYNCED') {
      console.warn('[AttachmentUploadService] Cannot delete non-synced attachment file');
      return false;
    }

    try {
      await FileSystem.deleteAsync(attachment.localPath, { idempotent: true });
      await ChecklistAttachmentRepository.update(attachmentId, { localPath: undefined });
      return true;
    } catch (error) {
      console.error('[AttachmentUploadService] Failed to delete local file:', error);
      return false;
    }
  }

  /**
   * Limpar arquivos temporários antigos (> 7 dias)
   */
  async cleanupOldTemporaryFiles(): Promise<number> {
    try {
      const tempDir = FileSystem.cacheDirectory;
      if (!tempDir) return 0;

      const dirInfo = await FileSystem.getInfoAsync(tempDir);
      if (!dirInfo.exists) return 0;

      const files = await FileSystem.readDirectoryAsync(tempDir);
      const now = Date.now();
      const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
      let deletedCount = 0;

      for (const file of files) {
        try {
          const filePath = `${tempDir}${file}`;
          const fileInfo = await FileSystem.getInfoAsync(filePath);

          if (fileInfo.exists && (fileInfo as any).modificationTime) {
            const fileAge = now - (fileInfo as any).modificationTime * 1000;

            if (fileAge > SEVEN_DAYS_MS) {
              await FileSystem.deleteAsync(filePath, { idempotent: true });
              deletedCount++;
            }
          }
        } catch (error) {
          console.warn('[AttachmentUploadService] Failed to delete temp file:', file, error);
        }
      }

      console.log(`[AttachmentUploadService] Cleaned up ${deletedCount} old temporary files`);
      return deletedCount;
    } catch (error) {
      console.error('[AttachmentUploadService] Cleanup error:', error);
      return 0;
    }
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

export const AttachmentUploadService = new AttachmentUploadServiceClass();

export default AttachmentUploadService;
