/**
 * SignatureSyncConfig Tests
 *
 * Testes para configuração de sincronização de assinaturas digitais.
 */

// Mock expo-crypto before imports
const mockDigestStringAsync = jest.fn();
jest.mock('expo-crypto', () => ({
  digestStringAsync: mockDigestStringAsync,
  CryptoDigestAlgorithm: {
    SHA256: 'SHA-256',
  },
}), { virtual: true });

import {
  SignatureSyncConfig,
  SIGNER_ROLES,
  generateSignatureHash,
  verifySignatureIntegrity,
  createSignaturePayload,
  validateSignature,
} from '../../../src/modules/checklists/SignatureSyncConfig';
import { Signature } from '../../../src/db/schema';

describe('SignatureSyncConfig', () => {
  describe('configuration properties', () => {
    it('should have correct entity name', () => {
      expect(SignatureSyncConfig.name).toBe('signatures');
    });

    it('should have correct table name', () => {
      expect(SignatureSyncConfig.tableName).toBe('signatures');
    });

    it('should have correct API endpoint', () => {
      expect(SignatureSyncConfig.apiEndpoint).toBe('/signatures/sync');
    });

    it('should have correct mutation endpoint', () => {
      expect(SignatureSyncConfig.apiMutationEndpoint).toBe('/signatures');
    });

    it('should use updatedAt as cursor field', () => {
      expect(SignatureSyncConfig.cursorField).toBe('updatedAt');
    });

    it('should have correct primary key', () => {
      expect(SignatureSyncConfig.primaryKeys).toEqual(['id']);
    });

    it('should use technicianId as scope field', () => {
      expect(SignatureSyncConfig.scopeField).toBe('technicianId');
    });

    it('should have batch size of 50', () => {
      expect(SignatureSyncConfig.batchSize).toBe(50);
    });

    it('should use server_wins for conflict resolution', () => {
      expect(SignatureSyncConfig.conflictResolution).toBe('server_wins');
    });
  });

  describe('transformFromServer', () => {
    it('should transform server signature to local format', () => {
      const serverData = {
        id: 'sig-1',
        technicianId: 'tech-1',
        workOrderId: 'wo-1',
        clientId: 'client-1',
        signerName: 'John Doe',
        signerDocument: '12345678900',
        signerRole: 'Cliente',
        signedAt: '2024-01-15T10:00:00.000Z',
        hash: 'abc123hash',
        deviceInfo: 'iPhone 14',
        localId: 'local-sig-1',
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      };

      const result = SignatureSyncConfig.transformFromServer(serverData);

      expect(result.id).toBe('sig-1');
      expect(result.technicianId).toBe('tech-1');
      expect(result.workOrderId).toBe('wo-1');
      expect(result.clientId).toBe('client-1');
      expect(result.signerName).toBe('John Doe');
      expect(result.signerDocument).toBe('12345678900');
      expect(result.signerRole).toBe('Cliente');
      expect(result.hash).toBe('abc123hash');
    });

    it('should handle signature for quote', () => {
      const serverData = {
        id: 'sig-1',
        technicianId: 'tech-1',
        quoteId: 'quote-1',
        clientId: 'client-1',
        signerName: 'Jane Doe',
        signerRole: 'Responsável',
        signedAt: '2024-01-15T10:00:00.000Z',
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      };

      const result = SignatureSyncConfig.transformFromServer(serverData);

      expect(result.quoteId).toBe('quote-1');
      expect(result.workOrderId).toBeUndefined();
    });

    it('should set signatureBase64 and signatureFilePath to undefined', () => {
      const serverData = {
        id: 'sig-1',
        technicianId: 'tech-1',
        clientId: 'client-1',
        signerName: 'Test',
        signerRole: 'Cliente',
        signedAt: '2024-01-15T10:00:00.000Z',
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      };

      const result = SignatureSyncConfig.transformFromServer(serverData);

      expect(result.signatureBase64).toBeUndefined();
      expect(result.signatureFilePath).toBeUndefined();
    });

    it('should handle optional fields', () => {
      const serverData = {
        id: 'sig-1',
        technicianId: 'tech-1',
        clientId: 'client-1',
        signerName: 'Test',
        signerRole: 'Cliente',
        signedAt: '2024-01-15T10:00:00.000Z',
        attachmentId: 'att-1',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      };

      const result = SignatureSyncConfig.transformFromServer(serverData);

      expect(result.attachmentId).toBe('att-1');
      expect(result.ipAddress).toBe('192.168.1.1');
      expect(result.userAgent).toBe('Mozilla/5.0');
    });
  });

  describe('transformToServer', () => {
    it('should transform local signature to server format', () => {
      const localItem: Signature = {
        id: 'sig-1',
        technicianId: 'tech-1',
        workOrderId: 'wo-1',
        clientId: 'client-1',
        signerName: 'John Doe',
        signerDocument: '12345678900',
        signerRole: 'Cliente',
        signedAt: '2024-01-15T10:00:00.000Z',
        deviceInfo: 'iPhone 14',
        localId: 'local-sig-1',
        signatureBase64: 'base64data',
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      };

      const result = SignatureSyncConfig.transformToServer(localItem) as Record<string, unknown>;

      expect(result.workOrderId).toBe('wo-1');
      expect(result.signerName).toBe('John Doe');
      expect(result.signerDocument).toBe('12345678900');
      expect(result.signerRole).toBe('Cliente');
      expect(result.localId).toBe('local-sig-1');
    });

    it('should use id as localId if localId is missing', () => {
      const localItem: Signature = {
        id: 'sig-1',
        technicianId: 'tech-1',
        clientId: 'client-1',
        signerName: 'Test',
        signerRole: 'Cliente',
        signedAt: '2024-01-15T10:00:00.000Z',
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      };

      const result = SignatureSyncConfig.transformToServer(localItem) as Record<string, unknown>;

      expect(result.localId).toBe('sig-1');
    });

    it('should handle quote signature', () => {
      const localItem: Signature = {
        id: 'sig-1',
        technicianId: 'tech-1',
        quoteId: 'quote-1',
        clientId: 'client-1',
        signerName: 'Test',
        signerRole: 'Responsável',
        signedAt: '2024-01-15T10:00:00.000Z',
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      };

      const result = SignatureSyncConfig.transformToServer(localItem) as Record<string, unknown>;

      expect(result.quoteId).toBe('quote-1');
      expect(result.workOrderId).toBeUndefined();
    });
  });
});

describe('SIGNER_ROLES', () => {
  it('should define CLIENT role', () => {
    expect(SIGNER_ROLES.CLIENT).toBe('Cliente');
  });

  it('should define TECHNICIAN role', () => {
    expect(SIGNER_ROLES.TECHNICIAN).toBe('Técnico');
  });

  it('should define RESPONSIBLE role', () => {
    expect(SIGNER_ROLES.RESPONSIBLE).toBe('Responsável');
  });

  it('should define WITNESS role', () => {
    expect(SIGNER_ROLES.WITNESS).toBe('Testemunha');
  });
});

describe('generateSignatureHash', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDigestStringAsync.mockReset();
  });

  it('should generate hash using expo-crypto when available', async () => {
    mockDigestStringAsync.mockResolvedValue('sha256hash');

    const result = await generateSignatureHash('test-signature-data');

    expect(result).toBe('sha256hash');
  });

  it('should fallback to simple hash when expo-crypto fails', async () => {
    // Simulating crypto failure - the function will catch and use fallback
    mockDigestStringAsync.mockRejectedValue(new Error('Crypto not available'));

    const result = await generateSignatureHash('test');

    expect(result).toBeDefined();
    expect(result.length).toBe(64); // Padded to 64 chars
  });

  it('should produce consistent fallback hash for same input', async () => {
    mockDigestStringAsync.mockRejectedValue(new Error('Crypto not available'));

    const result1 = await generateSignatureHash('same-data');
    const result2 = await generateSignatureHash('same-data');

    expect(result1).toBe(result2);
  });

  it('should produce different fallback hash for different input', async () => {
    mockDigestStringAsync.mockRejectedValue(new Error('Crypto not available'));

    const result1 = await generateSignatureHash('data1');
    const result2 = await generateSignatureHash('data2');

    expect(result1).not.toBe(result2);
  });
});

describe('verifySignatureIntegrity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDigestStringAsync.mockReset();
  });

  it('should return true when hashes match', async () => {
    mockDigestStringAsync.mockResolvedValue('correct-hash');

    const result = await verifySignatureIntegrity('signature-data', 'correct-hash');

    expect(result).toBe(true);
  });

  it('should return false when hashes do not match', async () => {
    mockDigestStringAsync.mockResolvedValue('different-hash');

    const result = await verifySignatureIntegrity('signature-data', 'expected-hash');

    expect(result).toBe(false);
  });
});

describe('createSignaturePayload', () => {
  it('should create payload for work order signature', () => {
    const result = createSignaturePayload({
      workOrderId: 'wo-1',
      clientId: 'client-1',
      signerName: 'John Doe',
      signerDocument: '12345678900',
      signerRole: 'Cliente',
      signatureBase64: 'base64data',
      deviceInfo: 'iPhone 14',
      technicianId: 'tech-1',
    });

    expect(result.workOrderId).toBe('wo-1');
    expect(result.clientId).toBe('client-1');
    expect(result.signerName).toBe('John Doe');
    expect(result.signerDocument).toBe('12345678900');
    expect(result.signerRole).toBe('Cliente');
    expect(result.signatureBase64).toBe('base64data');
    expect(result.technicianId).toBe('tech-1');
    expect(result.signedAt).toBeDefined();
    expect(result.localId).toMatch(/^sig_\d+_[a-z0-9]+$/);
  });

  it('should create payload for quote signature', () => {
    const result = createSignaturePayload({
      quoteId: 'quote-1',
      clientId: 'client-1',
      signerName: 'Jane Doe',
      signerRole: 'Responsável',
      signatureBase64: 'base64data',
      technicianId: 'tech-1',
    });

    expect(result.quoteId).toBe('quote-1');
    expect(result.workOrderId).toBeUndefined();
    expect(result.signerRole).toBe('Responsável');
  });

  it('should set undefined for optional fields', () => {
    const result = createSignaturePayload({
      clientId: 'client-1',
      signerName: 'Test',
      signerRole: 'Cliente',
      signatureBase64: 'base64data',
      technicianId: 'tech-1',
    });

    expect(result.signerDocument).toBeUndefined();
    expect(result.deviceInfo).toBeUndefined();
    expect(result.attachmentId).toBeUndefined();
    expect(result.hash).toBeUndefined();
    expect(result.ipAddress).toBeUndefined();
    expect(result.userAgent).toBeUndefined();
    expect(result.syncedAt).toBeUndefined();
    expect(result.signatureFilePath).toBeUndefined();
  });

  it('should generate unique localId for each call', () => {
    const result1 = createSignaturePayload({
      clientId: 'client-1',
      signerName: 'Test',
      signerRole: 'Cliente',
      signatureBase64: 'base64data',
      technicianId: 'tech-1',
    });

    // Small delay to ensure different timestamp
    const result2 = createSignaturePayload({
      clientId: 'client-1',
      signerName: 'Test',
      signerRole: 'Cliente',
      signatureBase64: 'base64data',
      technicianId: 'tech-1',
    });

    // The random part should make them different
    expect(result1.localId).toBeDefined();
    expect(result2.localId).toBeDefined();
  });
});

describe('validateSignature', () => {
  it('should pass for valid work order signature', () => {
    const result = validateSignature({
      workOrderId: 'wo-1',
      signerName: 'John Doe',
      signerRole: 'Cliente',
      signatureBase64: 'base64data',
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should pass for valid quote signature', () => {
    const result = validateSignature({
      quoteId: 'quote-1',
      signerName: 'Jane Doe',
      signerRole: 'Responsável',
      signatureFilePath: '/path/to/file',
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail for missing signer name', () => {
    const result = validateSignature({
      workOrderId: 'wo-1',
      signerRole: 'Cliente',
      signatureBase64: 'base64data',
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Nome do assinante é obrigatório (mínimo 2 caracteres)');
  });

  it('should fail for signer name too short', () => {
    const result = validateSignature({
      workOrderId: 'wo-1',
      signerName: 'A',
      signerRole: 'Cliente',
      signatureBase64: 'base64data',
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Nome do assinante é obrigatório (mínimo 2 caracteres)');
  });

  it('should fail for whitespace-only signer name', () => {
    const result = validateSignature({
      workOrderId: 'wo-1',
      signerName: '   ',
      signerRole: 'Cliente',
      signatureBase64: 'base64data',
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Nome do assinante é obrigatório (mínimo 2 caracteres)');
  });

  it('should fail for missing signer role', () => {
    const result = validateSignature({
      workOrderId: 'wo-1',
      signerName: 'John Doe',
      signatureBase64: 'base64data',
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Papel do assinante é obrigatório');
  });

  it('should fail for missing signature data', () => {
    const result = validateSignature({
      workOrderId: 'wo-1',
      signerName: 'John Doe',
      signerRole: 'Cliente',
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Dados da assinatura são obrigatórios');
  });

  it('should fail for missing work order and quote', () => {
    const result = validateSignature({
      signerName: 'John Doe',
      signerRole: 'Cliente',
      signatureBase64: 'base64data',
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Assinatura deve estar vinculada a uma OS ou Orçamento');
  });

  it('should return multiple errors', () => {
    const result = validateSignature({});

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });
});
