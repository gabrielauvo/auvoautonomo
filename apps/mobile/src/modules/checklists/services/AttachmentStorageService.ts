/**
 * AttachmentStorageService
 *
 * Serviço para armazenamento de anexos no filesystem em vez do SQLite.
 * Resolve o problema de OOM ao armazenar base64Data grandes no banco.
 *
 * Funcionalidades:
 * - Salvar base64 como arquivo no filesystem
 * - Ler arquivo e retornar base64 para upload
 * - Calcular hash SHA256 para verificação de integridade (opcional)
 * - Migrar registros antigos com base64Data para filesystem
 * - Limpar arquivos após upload bem sucedido
 *
 * Estrutura de diretório:
 * {documentDirectory}/attachments/{attachmentId}.{ext}
 *
 * Metadados salvos no DB:
 * - filePath: caminho completo do arquivo
 * - fileSize: tamanho em bytes
 * - sha256: hash para verificação (opcional)
 */

import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { SYNC_FLAGS } from '../../../config/syncFlags';
import { rawQuery, getDatabase } from '../../../db/database';
import type { ChecklistAttachment } from '../../../db/schema';

// =============================================================================
// TYPES
// =============================================================================

export interface SaveResult {
  filePath: string;
  sizeBytes: number;
  sha256?: string;
  mimeType: string;
}

export interface MigrationResult {
  migrated: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

export interface MigrationProgress {
  processed: number;
  total: number;
  currentId: string;
}

export type MigrationProgressListener = (progress: MigrationProgress) => void;

// =============================================================================
// CONSTANTS
// =============================================================================

const ATTACHMENTS_DIR = SYNC_FLAGS.FS_ATTACHMENTS_DIR;
const MIGRATION_CHUNK_SIZE = SYNC_FLAGS.FS_MIGRATION_CHUNK_SIZE;
const MIGRATION_CHUNK_DELAY = SYNC_FLAGS.FS_MIGRATION_CHUNK_DELAY_MS;
const VERIFY_HASH = SYNC_FLAGS.FS_ATTACHMENTS_VERIFY_HASH;

// =============================================================================
// SERVICE
// =============================================================================

class AttachmentStorageServiceClass {
  private baseDir: string | null = null;
  private isInitialized = false;
  private isMigrating = false;

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  /**
   * Inicializar o serviço e garantir que o diretório existe
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    if (!FileSystem.documentDirectory) {
      throw new Error('FileSystem.documentDirectory not available');
    }

    this.baseDir = `${FileSystem.documentDirectory}${ATTACHMENTS_DIR}/`;

    // Criar diretório se não existir
    const dirInfo = await FileSystem.getInfoAsync(this.baseDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(this.baseDir, { intermediates: true });
      console.log(`[AttachmentStorageService] Created directory: ${this.baseDir}`);
    }

    this.isInitialized = true;
    console.log('[AttachmentStorageService] Initialized');
  }

  /**
   * Garantir que o serviço está inicializado
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  // ==========================================================================
  // FILE OPERATIONS
  // ==========================================================================

  /**
   * Salvar base64Data como arquivo no filesystem
   *
   * @param attachmentId ID do anexo (usado como nome do arquivo)
   * @param base64Data Dados em base64
   * @param mimeType Tipo MIME do arquivo
   * @returns Metadados do arquivo salvo
   */
  async saveFromBase64(
    attachmentId: string,
    base64Data: string,
    mimeType: string
  ): Promise<SaveResult> {
    await this.ensureInitialized();

    const ext = this.getExtensionFromMimeType(mimeType);
    const filePath = `${this.baseDir}${attachmentId}.${ext}`;

    // Salvar arquivo
    await FileSystem.writeAsStringAsync(filePath, base64Data, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Obter informações do arquivo
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    const sizeBytes = (fileInfo as any).size || Math.round(base64Data.length * 0.75);

    // Calcular hash se habilitado
    let sha256: string | undefined;
    if (VERIFY_HASH) {
      sha256 = await this.calculateHash(filePath);
    }

    console.log(`[AttachmentStorageService] Saved ${attachmentId}: ${sizeBytes} bytes`);

    return {
      filePath,
      sizeBytes,
      sha256,
      mimeType,
    };
  }

  /**
   * Ler arquivo e retornar como base64
   *
   * @param filePath Caminho do arquivo
   * @returns Dados em base64
   */
  async readAsBase64(filePath: string): Promise<string> {
    await this.ensureInitialized();

    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (!fileInfo.exists) {
      throw new Error(`File not found: ${filePath}`);
    }

    return FileSystem.readAsStringAsync(filePath, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }

  /**
   * Verificar se arquivo existe
   */
  async exists(filePath: string): Promise<boolean> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      return fileInfo.exists;
    } catch {
      return false;
    }
  }

  /**
   * Deletar arquivo do filesystem
   */
  async deleteFile(filePath: string): Promise<boolean> {
    try {
      await FileSystem.deleteAsync(filePath, { idempotent: true });
      console.log(`[AttachmentStorageService] Deleted: ${filePath}`);
      return true;
    } catch (error) {
      console.warn(`[AttachmentStorageService] Failed to delete: ${filePath}`, error);
      return false;
    }
  }

  /**
   * Obter tamanho do arquivo
   */
  async getFileSize(filePath: string): Promise<number> {
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    return (fileInfo as any).size || 0;
  }

  /**
   * Calcular hash SHA256 do arquivo
   */
  async calculateHash(filePath: string): Promise<string> {
    const base64 = await this.readAsBase64(filePath);
    return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, base64);
  }

  /**
   * Verificar integridade do arquivo usando hash
   */
  async verifyIntegrity(filePath: string, expectedHash: string): Promise<boolean> {
    try {
      const actualHash = await this.calculateHash(filePath);
      return actualHash === expectedHash;
    } catch {
      return false;
    }
  }

  // ==========================================================================
  // MIGRATION
  // ==========================================================================

  /**
   * Migrar registros antigos com base64Data para filesystem
   * Processa em chunks para não bloquear a UI
   *
   * @param progressCallback Callback para reportar progresso
   * @returns Resultado da migração
   */
  async migrateBase64ToFilesystem(
    progressCallback?: MigrationProgressListener
  ): Promise<MigrationResult> {
    if (this.isMigrating) {
      console.log('[AttachmentStorageService] Migration already in progress');
      return { migrated: 0, failed: 0, errors: [] };
    }

    await this.ensureInitialized();
    this.isMigrating = true;

    const result: MigrationResult = {
      migrated: 0,
      failed: 0,
      errors: [],
    };

    try {
      // Contar total de registros a migrar
      const countResult = await rawQuery<{ count: number }>(
        `SELECT COUNT(*) as count FROM checklist_attachments
         WHERE base64Data IS NOT NULL AND base64Data != ''
         AND (localPath IS NULL OR localPath = '')`
      );
      const total = countResult[0]?.count || 0;

      if (total === 0) {
        console.log('[AttachmentStorageService] No records to migrate');
        return result;
      }

      console.log(`[AttachmentStorageService] Starting migration of ${total} records`);

      let processed = 0;

      while (true) {
        // Buscar próximo chunk
        const records = await rawQuery<{
          id: string;
          base64Data: string;
          mimeType: string;
          type: string;
        }>(
          `SELECT id, base64Data, mimeType, type FROM checklist_attachments
           WHERE base64Data IS NOT NULL AND base64Data != ''
           AND (localPath IS NULL OR localPath = '')
           LIMIT ?`,
          [MIGRATION_CHUNK_SIZE]
        );

        if (records.length === 0) {
          break;
        }

        // Processar chunk
        for (const record of records) {
          processed++;

          try {
            // Determinar mimeType
            const mimeType = record.mimeType ||
              (record.type === 'SIGNATURE' ? 'image/png' : 'image/jpeg');

            // Salvar no filesystem
            const saveResult = await this.saveFromBase64(
              record.id,
              record.base64Data,
              mimeType
            );

            // Atualizar registro no DB: limpar base64Data, definir localPath
            const db = await getDatabase();
            await db.runAsync(
              `UPDATE checklist_attachments
               SET localPath = ?, fileSize = ?, base64Data = NULL, updatedAt = ?
               WHERE id = ?`,
              [saveResult.filePath, saveResult.sizeBytes, new Date().toISOString(), record.id]
            );

            result.migrated++;

            // Reportar progresso
            if (progressCallback) {
              progressCallback({
                processed,
                total,
                currentId: record.id,
              });
            }
          } catch (error) {
            result.failed++;
            result.errors.push({
              id: record.id,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
            console.error(`[AttachmentStorageService] Migration failed for ${record.id}:`, error);
          }
        }

        // Yield para event loop entre chunks
        await this.delay(MIGRATION_CHUNK_DELAY);
      }

      console.log(
        `[AttachmentStorageService] Migration complete: ${result.migrated} migrated, ${result.failed} failed`
      );
    } finally {
      this.isMigrating = false;
    }

    return result;
  }

  /**
   * Verificar se há registros pendentes de migração
   */
  async hasPendingMigration(): Promise<boolean> {
    const countResult = await rawQuery<{ count: number }>(
      `SELECT COUNT(*) as count FROM checklist_attachments
       WHERE base64Data IS NOT NULL AND base64Data != ''
       AND (localPath IS NULL OR localPath = '')`
    );
    return (countResult[0]?.count || 0) > 0;
  }

  /**
   * Contar registros pendentes de migração
   */
  async countPendingMigration(): Promise<number> {
    const countResult = await rawQuery<{ count: number }>(
      `SELECT COUNT(*) as count FROM checklist_attachments
       WHERE base64Data IS NOT NULL AND base64Data != ''
       AND (localPath IS NULL OR localPath = '')`
    );
    return countResult[0]?.count || 0;
  }

  // ==========================================================================
  // CLEANUP
  // ==========================================================================

  /**
   * Limpar arquivos de anexos já sincronizados
   * Chamado após upload bem sucedido se FS_ATTACHMENTS_DELETE_AFTER_SYNC = true
   */
  async cleanupSyncedAttachments(): Promise<number> {
    await this.ensureInitialized();

    // Buscar anexos sincronizados com localPath
    const synced = await rawQuery<{ id: string; localPath: string }>(
      `SELECT id, localPath FROM checklist_attachments
       WHERE syncStatus = 'SYNCED' AND localPath IS NOT NULL AND localPath != ''`
    );

    let deleted = 0;
    for (const record of synced) {
      if (await this.deleteFile(record.localPath)) {
        // Limpar localPath no DB
        const db = await getDatabase();
        await db.runAsync(
          `UPDATE checklist_attachments SET localPath = NULL, updatedAt = ? WHERE id = ?`,
          [new Date().toISOString(), record.id]
        );
        deleted++;
      }
    }

    console.log(`[AttachmentStorageService] Cleaned up ${deleted} synced attachments`);
    return deleted;
  }

  /**
   * Limpar arquivos órfãos (existem no filesystem mas não no DB)
   */
  async cleanupOrphanedFiles(): Promise<number> {
    await this.ensureInitialized();

    if (!this.baseDir) return 0;

    try {
      const files = await FileSystem.readDirectoryAsync(this.baseDir);
      let deleted = 0;

      for (const file of files) {
        const filePath = `${this.baseDir}${file}`;

        // Extrair ID do nome do arquivo
        const id = file.replace(/\.[^.]+$/, '');

        // Verificar se existe no DB
        const exists = await rawQuery<{ count: number }>(
          `SELECT COUNT(*) as count FROM checklist_attachments WHERE id = ?`,
          [id]
        );

        if ((exists[0]?.count || 0) === 0) {
          // Arquivo órfão - deletar
          if (await this.deleteFile(filePath)) {
            deleted++;
          }
        }
      }

      if (deleted > 0) {
        console.log(`[AttachmentStorageService] Cleaned up ${deleted} orphaned files`);
      }

      return deleted;
    } catch (error) {
      console.error('[AttachmentStorageService] Error cleaning orphaned files:', error);
      return 0;
    }
  }

  /**
   * Obter estatísticas de uso de disco
   */
  async getStorageStats(): Promise<{
    totalFiles: number;
    totalSizeBytes: number;
    pendingUpload: number;
    synced: number;
  }> {
    await this.ensureInitialized();

    const stats = {
      totalFiles: 0,
      totalSizeBytes: 0,
      pendingUpload: 0,
      synced: 0,
    };

    if (!this.baseDir) return stats;

    try {
      const files = await FileSystem.readDirectoryAsync(this.baseDir);
      stats.totalFiles = files.length;

      for (const file of files) {
        const filePath = `${this.baseDir}${file}`;
        stats.totalSizeBytes += await this.getFileSize(filePath);
      }

      // Contar por status do DB
      const pending = await rawQuery<{ count: number }>(
        `SELECT COUNT(*) as count FROM checklist_attachments
         WHERE syncStatus IN ('PENDING', 'FAILED', 'UPLOADING')
         AND localPath IS NOT NULL AND localPath != ''`
      );
      stats.pendingUpload = pending[0]?.count || 0;

      const synced = await rawQuery<{ count: number }>(
        `SELECT COUNT(*) as count FROM checklist_attachments
         WHERE syncStatus = 'SYNCED'
         AND localPath IS NOT NULL AND localPath != ''`
      );
      stats.synced = synced[0]?.count || 0;
    } catch (error) {
      console.error('[AttachmentStorageService] Error getting stats:', error);
    }

    return stats;
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  /**
   * Obter extensão de arquivo a partir do MIME type
   */
  private getExtensionFromMimeType(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'application/pdf': 'pdf',
    };
    return mimeToExt[mimeType] || 'bin';
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Obter diretório base
   */
  getBaseDir(): string | null {
    return this.baseDir;
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const AttachmentStorageService = new AttachmentStorageServiceClass();

export default AttachmentStorageService;
