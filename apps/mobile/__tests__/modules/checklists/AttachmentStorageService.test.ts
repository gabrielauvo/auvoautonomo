/**
 * AttachmentStorageService Tests
 *
 * Testes para o serviço de armazenamento de anexos no filesystem.
 * Verifica:
 * 1. Salvar e ler arquivos base64
 * 2. Migração de base64Data para filesystem
 * 3. Verificação de integridade (hash)
 * 4. Limpeza de arquivos órfãos e sincronizados
 */

// Mock expo-file-system
const mockWriteAsStringAsync = jest.fn().mockResolvedValue(undefined);
const mockReadAsStringAsync = jest.fn().mockResolvedValue('base64content');
const mockGetInfoAsync = jest.fn().mockResolvedValue({ exists: true, size: 1000 });
const mockDeleteAsync = jest.fn().mockResolvedValue(undefined);
const mockMakeDirectoryAsync = jest.fn().mockResolvedValue(undefined);
const mockReadDirectoryAsync = jest.fn().mockResolvedValue([]);

jest.mock('expo-file-system', () => ({
  documentDirectory: '/mock/documents/',
  writeAsStringAsync: mockWriteAsStringAsync,
  readAsStringAsync: mockReadAsStringAsync,
  getInfoAsync: mockGetInfoAsync,
  deleteAsync: mockDeleteAsync,
  makeDirectoryAsync: mockMakeDirectoryAsync,
  readDirectoryAsync: mockReadDirectoryAsync,
  EncodingType: {
    Base64: 'base64',
  },
}));

// Mock expo-crypto
const mockDigestStringAsync = jest.fn().mockResolvedValue('sha256hash123');

jest.mock('expo-crypto', () => ({
  digestStringAsync: mockDigestStringAsync,
  CryptoDigestAlgorithm: {
    SHA256: 'SHA-256',
  },
}));

// Mock database
const mockRawQuery = jest.fn();
const mockGetDatabase = jest.fn();
const mockRunAsync = jest.fn();

jest.mock('../../../src/db/database', () => ({
  rawQuery: (...args: unknown[]) => mockRawQuery(...args),
  getDatabase: () => mockGetDatabase(),
}));

// Mock SYNC_FLAGS
const mockSyncFlags = {
  SYNC_OPT_FS_ATTACHMENTS: true,
  FS_ATTACHMENTS_DIR: 'attachments',
  FS_MIGRATION_CHUNK_SIZE: 5,
  FS_MIGRATION_CHUNK_DELAY_MS: 10,
  FS_ATTACHMENTS_VERIFY_HASH: false,
  FS_ATTACHMENTS_DELETE_AFTER_SYNC: true,
};

jest.mock('../../../src/config/syncFlags', () => ({
  SYNC_FLAGS: mockSyncFlags,
}));

import { AttachmentStorageService } from '../../../src/modules/checklists/services/AttachmentStorageService';

describe('AttachmentStorageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockGetDatabase.mockResolvedValue({
      runAsync: mockRunAsync.mockResolvedValue(undefined),
    });

    // Default: directory doesn't exist
    mockGetInfoAsync.mockResolvedValue({ exists: false });
  });

  describe('initialize()', () => {
    it('should create attachments directory if it does not exist', async () => {
      mockGetInfoAsync.mockResolvedValueOnce({ exists: false });

      await AttachmentStorageService.initialize();

      expect(mockMakeDirectoryAsync).toHaveBeenCalledWith(
        '/mock/documents/attachments/',
        { intermediates: true }
      );
    });

    it('should not create directory if it already exists', async () => {
      mockGetInfoAsync.mockResolvedValueOnce({ exists: true });

      await AttachmentStorageService.initialize();

      expect(mockMakeDirectoryAsync).not.toHaveBeenCalled();
    });
  });

  describe('saveFromBase64()', () => {
    beforeEach(async () => {
      mockGetInfoAsync.mockResolvedValue({ exists: true, size: 1500 });
      await AttachmentStorageService.initialize();
    });

    it('should save base64 data as file', async () => {
      const result = await AttachmentStorageService.saveFromBase64(
        'attachment-123',
        'SGVsbG8gV29ybGQ=',
        'image/jpeg'
      );

      expect(mockWriteAsStringAsync).toHaveBeenCalledWith(
        '/mock/documents/attachments/attachment-123.jpg',
        'SGVsbG8gV29ybGQ=',
        { encoding: 'base64' }
      );

      expect(result).toEqual({
        filePath: '/mock/documents/attachments/attachment-123.jpg',
        sizeBytes: 1500,
        mimeType: 'image/jpeg',
        sha256: undefined, // Hash disabled by default
      });
    });

    it('should use correct extension for PNG', async () => {
      await AttachmentStorageService.saveFromBase64(
        'signature-456',
        'base64data',
        'image/png'
      );

      expect(mockWriteAsStringAsync).toHaveBeenCalledWith(
        expect.stringContaining('.png'),
        expect.any(String),
        expect.any(Object)
      );
    });

    it('should calculate hash when FS_ATTACHMENTS_VERIFY_HASH is true', async () => {
      mockSyncFlags.FS_ATTACHMENTS_VERIFY_HASH = true;
      mockReadAsStringAsync.mockResolvedValueOnce('filecontentbase64');

      const result = await AttachmentStorageService.saveFromBase64(
        'attachment-789',
        'data',
        'image/jpeg'
      );

      expect(mockDigestStringAsync).toHaveBeenCalled();
      expect(result.sha256).toBe('sha256hash123');

      // Reset
      mockSyncFlags.FS_ATTACHMENTS_VERIFY_HASH = false;
    });
  });

  describe('readAsBase64()', () => {
    beforeEach(async () => {
      mockGetInfoAsync.mockResolvedValue({ exists: true });
      await AttachmentStorageService.initialize();
    });

    it('should read file and return base64', async () => {
      mockReadAsStringAsync.mockResolvedValueOnce('SGVsbG8gV29ybGQ=');

      const result = await AttachmentStorageService.readAsBase64(
        '/mock/documents/attachments/test.jpg'
      );

      expect(result).toBe('SGVsbG8gV29ybGQ=');
      expect(mockReadAsStringAsync).toHaveBeenCalledWith(
        '/mock/documents/attachments/test.jpg',
        { encoding: 'base64' }
      );
    });

    it('should throw error if file does not exist', async () => {
      mockGetInfoAsync.mockResolvedValueOnce({ exists: false });

      await expect(
        AttachmentStorageService.readAsBase64('/nonexistent/file.jpg')
      ).rejects.toThrow('File not found');
    });
  });

  describe('deleteFile()', () => {
    beforeEach(async () => {
      mockGetInfoAsync.mockResolvedValue({ exists: true });
      await AttachmentStorageService.initialize();
    });

    it('should delete file successfully', async () => {
      const result = await AttachmentStorageService.deleteFile('/path/to/file.jpg');

      expect(mockDeleteAsync).toHaveBeenCalledWith('/path/to/file.jpg', { idempotent: true });
      expect(result).toBe(true);
    });

    it('should return false on error', async () => {
      mockDeleteAsync.mockRejectedValueOnce(new Error('Delete failed'));

      const result = await AttachmentStorageService.deleteFile('/path/to/file.jpg');

      expect(result).toBe(false);
    });
  });

  describe('migrateBase64ToFilesystem()', () => {
    beforeEach(async () => {
      mockGetInfoAsync.mockResolvedValue({ exists: true, size: 1000 });
      await AttachmentStorageService.initialize();
    });

    it('should migrate records with base64Data to filesystem', async () => {
      // First call: count records
      mockRawQuery
        .mockResolvedValueOnce([{ count: 2 }])
        // Second call: get records to migrate
        .mockResolvedValueOnce([
          { id: 'att-1', base64Data: 'data1', mimeType: 'image/jpeg', type: 'PHOTO' },
          { id: 'att-2', base64Data: 'data2', mimeType: 'image/png', type: 'SIGNATURE' },
        ])
        // Third call: no more records
        .mockResolvedValueOnce([]);

      const progressCallback = jest.fn();
      const result = await AttachmentStorageService.migrateBase64ToFilesystem(progressCallback);

      expect(result.migrated).toBe(2);
      expect(result.failed).toBe(0);
      expect(progressCallback).toHaveBeenCalledTimes(2);

      // Should have written 2 files
      expect(mockWriteAsStringAsync).toHaveBeenCalledTimes(2);

      // Should have updated DB for each record
      expect(mockRunAsync).toHaveBeenCalledTimes(2);
    });

    it('should skip if no records to migrate', async () => {
      mockRawQuery.mockResolvedValueOnce([{ count: 0 }]);

      const result = await AttachmentStorageService.migrateBase64ToFilesystem();

      expect(result.migrated).toBe(0);
      expect(result.failed).toBe(0);
      expect(mockWriteAsStringAsync).not.toHaveBeenCalled();
    });

    it('should handle errors for individual records', async () => {
      mockRawQuery
        .mockResolvedValueOnce([{ count: 2 }])
        .mockResolvedValueOnce([
          { id: 'att-1', base64Data: 'data1', mimeType: 'image/jpeg', type: 'PHOTO' },
          { id: 'att-2', base64Data: 'data2', mimeType: 'image/png', type: 'SIGNATURE' },
        ])
        .mockResolvedValueOnce([]);

      // First write succeeds, second fails
      mockWriteAsStringAsync
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Write failed'));

      const result = await AttachmentStorageService.migrateBase64ToFilesystem();

      expect(result.migrated).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].id).toBe('att-2');
    });
  });

  describe('hasPendingMigration()', () => {
    it('should return true if there are records to migrate', async () => {
      mockRawQuery.mockResolvedValueOnce([{ count: 5 }]);

      const result = await AttachmentStorageService.hasPendingMigration();

      expect(result).toBe(true);
    });

    it('should return false if no records to migrate', async () => {
      mockRawQuery.mockResolvedValueOnce([{ count: 0 }]);

      const result = await AttachmentStorageService.hasPendingMigration();

      expect(result).toBe(false);
    });
  });

  describe('cleanupSyncedAttachments()', () => {
    beforeEach(async () => {
      mockGetInfoAsync.mockResolvedValue({ exists: true });
      await AttachmentStorageService.initialize();
    });

    it('should delete files for synced attachments', async () => {
      mockRawQuery.mockResolvedValueOnce([
        { id: 'att-1', localPath: '/path/file1.jpg' },
        { id: 'att-2', localPath: '/path/file2.jpg' },
      ]);

      const result = await AttachmentStorageService.cleanupSyncedAttachments();

      expect(result).toBe(2);
      expect(mockDeleteAsync).toHaveBeenCalledTimes(2);
      expect(mockRunAsync).toHaveBeenCalledTimes(2);
    });

    it('should skip files that fail to delete', async () => {
      mockRawQuery.mockResolvedValueOnce([
        { id: 'att-1', localPath: '/path/file1.jpg' },
        { id: 'att-2', localPath: '/path/file2.jpg' },
      ]);

      mockDeleteAsync
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Delete failed'));

      const result = await AttachmentStorageService.cleanupSyncedAttachments();

      expect(result).toBe(1);
    });
  });

  describe('cleanupOrphanedFiles()', () => {
    beforeEach(async () => {
      mockGetInfoAsync.mockResolvedValue({ exists: true });
      await AttachmentStorageService.initialize();
    });

    it('should delete files not in database', async () => {
      mockReadDirectoryAsync.mockResolvedValueOnce(['att-1.jpg', 'att-2.jpg', 'orphan.jpg']);

      // att-1 and att-2 exist in DB, orphan does not
      mockRawQuery
        .mockResolvedValueOnce([{ count: 1 }]) // att-1 exists
        .mockResolvedValueOnce([{ count: 1 }]) // att-2 exists
        .mockResolvedValueOnce([{ count: 0 }]); // orphan doesn't exist

      const result = await AttachmentStorageService.cleanupOrphanedFiles();

      expect(result).toBe(1);
      expect(mockDeleteAsync).toHaveBeenCalledTimes(1);
      expect(mockDeleteAsync).toHaveBeenCalledWith(
        expect.stringContaining('orphan.jpg'),
        expect.any(Object)
      );
    });
  });

  describe('getStorageStats()', () => {
    beforeEach(async () => {
      mockGetInfoAsync.mockResolvedValue({ exists: true, size: 500 });
      await AttachmentStorageService.initialize();
    });

    it('should return storage statistics', async () => {
      mockReadDirectoryAsync.mockResolvedValueOnce(['file1.jpg', 'file2.jpg']);
      mockGetInfoAsync
        .mockResolvedValueOnce({ exists: true, size: 500 })
        .mockResolvedValueOnce({ exists: true, size: 500 });

      mockRawQuery
        .mockResolvedValueOnce([{ count: 1 }]) // pending
        .mockResolvedValueOnce([{ count: 1 }]); // synced

      const result = await AttachmentStorageService.getStorageStats();

      expect(result).toEqual({
        totalFiles: 2,
        totalSizeBytes: 1000,
        pendingUpload: 1,
        synced: 1,
      });
    });
  });

  describe('verifyIntegrity()', () => {
    beforeEach(async () => {
      mockGetInfoAsync.mockResolvedValue({ exists: true });
      await AttachmentStorageService.initialize();
    });

    it('should return true if hash matches', async () => {
      mockReadAsStringAsync.mockResolvedValueOnce('filecontent');
      mockDigestStringAsync.mockResolvedValueOnce('expectedhash');

      const result = await AttachmentStorageService.verifyIntegrity('/path/file.jpg', 'expectedhash');

      expect(result).toBe(true);
    });

    it('should return false if hash does not match', async () => {
      mockReadAsStringAsync.mockResolvedValueOnce('filecontent');
      mockDigestStringAsync.mockResolvedValueOnce('differenthash');

      const result = await AttachmentStorageService.verifyIntegrity('/path/file.jpg', 'expectedhash');

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockReadAsStringAsync.mockRejectedValueOnce(new Error('Read error'));

      const result = await AttachmentStorageService.verifyIntegrity('/path/file.jpg', 'expectedhash');

      expect(result).toBe(false);
    });
  });
});
