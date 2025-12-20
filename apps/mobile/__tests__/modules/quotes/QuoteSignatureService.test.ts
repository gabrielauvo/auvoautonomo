/**
 * QuoteSignatureService Tests
 *
 * Testes para o serviço de assinaturas de orçamentos.
 */

// Mock database
const mockRunAsync = jest.fn();
const mockGetDatabase = jest.fn(() => Promise.resolve({
  runAsync: mockRunAsync,
}));
const mockRawQuery = jest.fn();

jest.mock('../../../src/db', () => ({
  getDatabase: () => mockGetDatabase(),
  rawQuery: (...args: unknown[]) => mockRawQuery(...args),
}));

// Mock QuoteRepository
const mockGetById = jest.fn();
const mockUpdateStatus = jest.fn();

jest.mock('../../../src/modules/quotes/QuoteRepository', () => ({
  QuoteRepository: {
    getById: (...args: unknown[]) => mockGetById(...args),
    updateStatus: (...args: unknown[]) => mockUpdateStatus(...args),
  },
}));

// Mock MutationQueue
const mockEnqueue = jest.fn();

jest.mock('../../../src/queue/MutationQueue', () => ({
  MutationQueue: {
    enqueue: (...args: unknown[]) => mockEnqueue(...args),
  },
}));

// Mock syncEngine
const mockIsNetworkOnline = jest.fn(() => true);

jest.mock('../../../src/sync', () => ({
  syncEngine: {
    isNetworkOnline: () => mockIsNetworkOnline(),
    baseUrl: 'https://api.example.com',
    authToken: 'test-token',
  },
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-signature-uuid'),
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

import { QuoteSignatureService } from '../../../src/modules/quotes/QuoteSignatureService';

describe('QuoteSignatureService', () => {
  const technicianId = 'tech-123';
  const quoteId = 'quote-1';

  const mockQuote = {
    id: quoteId,
    clientId: 'client-1',
    clientName: 'João Silva',
    status: 'SENT',
    totalValue: 500,
    technicianId,
  };

  const mockSignatureInput = {
    quoteId,
    signerName: 'João Silva',
    signerDocument: '12345678901',
    signerRole: 'Cliente',
    signatureBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg...',
  };

  const mockSignature = {
    id: 'sig-1',
    quoteId,
    signerName: 'João Silva',
    signerDocument: '12345678901',
    signerRole: 'Cliente',
    signatureBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg...',
    syncStatus: 'PENDING',
    uploadAttempts: 0,
    signedAt: '2024-01-01T00:00:00.000Z',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    technicianId,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsNetworkOnline.mockReturnValue(true);
    QuoteSignatureService.configure(technicianId);
  });

  describe('configure', () => {
    it('should set technician ID', () => {
      QuoteSignatureService.configure('new-tech');
      expect(() => QuoteSignatureService.configure('test')).not.toThrow();
    });
  });

  describe('createSignature', () => {
    it('should throw if not configured', async () => {
      QuoteSignatureService.configure(null as any);

      await expect(
        QuoteSignatureService.createSignature(mockSignatureInput)
      ).rejects.toThrow('QuoteSignatureService not configured');

      QuoteSignatureService.configure(technicianId);
    });

    it('should throw if quote not found', async () => {
      mockGetById.mockResolvedValue(null);

      await expect(
        QuoteSignatureService.createSignature(mockSignatureInput)
      ).rejects.toThrow(`Quote ${quoteId} not found`);
    });

    it('should throw if quote not in SENT status', async () => {
      mockGetById.mockResolvedValue({ ...mockQuote, status: 'DRAFT' });

      await expect(
        QuoteSignatureService.createSignature(mockSignatureInput)
      ).rejects.toThrow('Quote must be in SENT status to be signed');
    });

    it('should throw if quote already has signature', async () => {
      mockGetById.mockResolvedValue(mockQuote);
      mockRawQuery.mockResolvedValueOnce([mockSignature]); // existing signature

      await expect(
        QuoteSignatureService.createSignature(mockSignatureInput)
      ).rejects.toThrow(`Quote ${quoteId} already has a signature`);
    });

    it('should create signature successfully', async () => {
      mockGetById.mockResolvedValue(mockQuote);
      mockRawQuery.mockResolvedValueOnce([]); // no existing signature
      mockRunAsync.mockResolvedValue(undefined);
      mockUpdateStatus.mockResolvedValue(undefined);
      mockEnqueue.mockResolvedValue(1);
      mockIsNetworkOnline.mockReturnValue(false); // offline to skip upload

      const result = await QuoteSignatureService.createSignature(mockSignatureInput);

      expect(result).toBeDefined();
      expect(result.id).toBe('mock-signature-uuid');
      expect(result.quoteId).toBe(quoteId);
      expect(result.signerName).toBe('João Silva');
      expect(result.syncStatus).toBe('PENDING');
    });

    it('should save signature to database', async () => {
      mockGetById.mockResolvedValue(mockQuote);
      mockRawQuery.mockResolvedValueOnce([]);
      mockRunAsync.mockResolvedValue(undefined);
      mockIsNetworkOnline.mockReturnValue(false);

      await QuoteSignatureService.createSignature(mockSignatureInput);

      expect(mockRunAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO quote_signatures'),
        expect.arrayContaining(['mock-signature-uuid', quoteId, 'João Silva'])
      );
    });

    it('should update quote status to APPROVED', async () => {
      mockGetById.mockResolvedValue(mockQuote);
      mockRawQuery.mockResolvedValueOnce([]);
      mockRunAsync.mockResolvedValue(undefined);
      mockIsNetworkOnline.mockReturnValue(false);

      await QuoteSignatureService.createSignature(mockSignatureInput);

      expect(mockUpdateStatus).toHaveBeenCalledWith(quoteId, 'APPROVED');
    });

    it('should enqueue signature for sync', async () => {
      mockGetById.mockResolvedValue(mockQuote);
      mockRawQuery.mockResolvedValueOnce([]);
      mockRunAsync.mockResolvedValue(undefined);
      mockIsNetworkOnline.mockReturnValue(false);

      await QuoteSignatureService.createSignature(mockSignatureInput);

      expect(mockEnqueue).toHaveBeenCalledWith(
        'quoteSignatures',
        'mock-signature-uuid',
        'create',
        expect.objectContaining({
          quoteId,
          signerName: 'João Silva',
          imageBase64: mockSignatureInput.signatureBase64,
        })
      );
    });

    it('should enqueue quote status update', async () => {
      mockGetById.mockResolvedValue(mockQuote);
      mockRawQuery.mockResolvedValueOnce([]);
      mockRunAsync.mockResolvedValue(undefined);
      mockIsNetworkOnline.mockReturnValue(false);

      await QuoteSignatureService.createSignature(mockSignatureInput);

      expect(mockEnqueue).toHaveBeenCalledWith(
        'quotes',
        quoteId,
        'update',
        expect.objectContaining({
          id: quoteId,
          status: 'APPROVED',
        })
      );
    });
  });

  describe('getByQuoteId', () => {
    it('should return signature for quote', async () => {
      mockRawQuery.mockResolvedValue([mockSignature]);

      const result = await QuoteSignatureService.getByQuoteId(quoteId);

      expect(result).toEqual(mockSignature);
      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE quoteId = ?'),
        [quoteId]
      );
    });

    it('should return null if no signature', async () => {
      mockRawQuery.mockResolvedValue([]);

      const result = await QuoteSignatureService.getByQuoteId(quoteId);

      expect(result).toBeNull();
    });
  });

  describe('getById', () => {
    it('should return signature by ID', async () => {
      mockRawQuery.mockResolvedValue([mockSignature]);

      const result = await QuoteSignatureService.getById('sig-1');

      expect(result).toEqual(mockSignature);
      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = ?'),
        ['sig-1']
      );
    });

    it('should return null if not found', async () => {
      mockRawQuery.mockResolvedValue([]);

      const result = await QuoteSignatureService.getById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getPendingUploads', () => {
    it('should return empty array if not configured', async () => {
      QuoteSignatureService.configure(null as any);

      const result = await QuoteSignatureService.getPendingUploads();

      expect(result).toEqual([]);

      QuoteSignatureService.configure(technicianId);
    });

    it('should return pending and failed signatures', async () => {
      const pendingSignatures = [
        { ...mockSignature, syncStatus: 'PENDING' },
        { ...mockSignature, id: 'sig-2', syncStatus: 'FAILED' },
      ];
      mockRawQuery.mockResolvedValue(pendingSignatures);

      const result = await QuoteSignatureService.getPendingUploads();

      expect(result).toHaveLength(2);
      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining("syncStatus IN ('PENDING', 'FAILED')"),
        [technicianId]
      );
    });
  });

  describe('uploadSignature', () => {
    it('should upload signature to backend', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'server-sig-id', attachmentId: 'att-1' }),
      });
      mockRunAsync.mockResolvedValue(undefined);

      await QuoteSignatureService.uploadSignature(mockSignature);

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.example.com/quotes/${quoteId}/signature`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
          body: expect.stringContaining('signerName'),
        })
      );
    });

    it('should update status to UPLOADING then SYNCED', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'server-sig-id' }),
      });
      mockRunAsync.mockResolvedValue(undefined);

      await QuoteSignatureService.uploadSignature(mockSignature);

      // First call: set UPLOADING
      expect(mockRunAsync).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("syncStatus = 'UPLOADING'"),
        expect.any(Array)
      );

      // Second call: set SYNCED
      expect(mockRunAsync).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("syncStatus = 'SYNCED'"),
        expect.any(Array)
      );
    });

    it('should mark as FAILED on upload error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: () => Promise.resolve('Server error'),
      });
      mockRunAsync.mockResolvedValue(undefined);

      await expect(
        QuoteSignatureService.uploadSignature(mockSignature)
      ).rejects.toThrow('Upload failed');

      expect(mockRunAsync).toHaveBeenCalledWith(
        expect.stringContaining("syncStatus = 'FAILED'"),
        expect.any(Array)
      );
    });

    it('should increment upload attempts on failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      mockRunAsync.mockResolvedValue(undefined);

      await expect(
        QuoteSignatureService.uploadSignature(mockSignature)
      ).rejects.toThrow('Network error');

      expect(mockRunAsync).toHaveBeenCalledWith(
        expect.stringContaining('uploadAttempts = uploadAttempts + 1'),
        expect.any(Array)
      );
    });
  });

  describe('processAllPendingUploads', () => {
    it('should process all pending uploads', async () => {
      const pendingSignatures = [
        { ...mockSignature, id: 'sig-1', syncStatus: 'PENDING' },
        { ...mockSignature, id: 'sig-2', syncStatus: 'FAILED' },
      ];
      mockRawQuery.mockResolvedValue(pendingSignatures);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'server-id' }),
      });
      mockRunAsync.mockResolvedValue(undefined);

      const result = await QuoteSignatureService.processAllPendingUploads();

      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('should count failures', async () => {
      const pendingSignatures = [
        { ...mockSignature, id: 'sig-1' },
        { ...mockSignature, id: 'sig-2' },
      ];
      mockRawQuery.mockResolvedValue(pendingSignatures);
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'server-id' }),
        })
        .mockRejectedValueOnce(new Error('Failed'));
      mockRunAsync.mockResolvedValue(undefined);

      const result = await QuoteSignatureService.processAllPendingUploads();

      expect(result.success).toBe(1);
      expect(result.failed).toBe(1);
    });
  });

  describe('hasSignature', () => {
    it('should return true if signature exists', async () => {
      mockRawQuery.mockResolvedValue([mockSignature]);

      const result = await QuoteSignatureService.hasSignature(quoteId);

      expect(result).toBe(true);
    });

    it('should return false if no signature', async () => {
      mockRawQuery.mockResolvedValue([]);

      const result = await QuoteSignatureService.hasSignature(quoteId);

      expect(result).toBe(false);
    });
  });

  describe('getSignatureSyncStatus', () => {
    it('should return sync status', async () => {
      mockRawQuery.mockResolvedValue([{ ...mockSignature, syncStatus: 'SYNCED' }]);

      const result = await QuoteSignatureService.getSignatureSyncStatus(quoteId);

      expect(result).toBe('SYNCED');
    });

    it('should return null if no signature', async () => {
      mockRawQuery.mockResolvedValue([]);

      const result = await QuoteSignatureService.getSignatureSyncStatus(quoteId);

      expect(result).toBeNull();
    });
  });
});
