import { Test, TestingModule } from '@nestjs/testing';
import { EncryptionService } from './encryption.service';

describe('EncryptionService', () => {
  let service: EncryptionService;
  const originalEnv = process.env;

  beforeAll(() => {
    process.env = {
      ...originalEnv,
      ENCRYPTION_KEY: EncryptionService.generateKey(),
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EncryptionService],
    }).compile();

    service = module.get<EncryptionService>(EncryptionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt a simple string', () => {
      const plainText = 'my-secret-api-key';
      const encrypted = service.encrypt(plainText);
      const decrypted = service.decrypt(encrypted);

      expect(encrypted).not.toBe(plainText);
      expect(encrypted).toContain(':');
      expect(decrypted).toBe(plainText);
    });

    it('should encrypt and decrypt a complex string', () => {
      const plainText = '$aak_test_9kXlBq3w@7Z#mN4pR8vT2hG6cY1dF5sJ0uK!';
      const encrypted = service.encrypt(plainText);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plainText);
    });

    it('should produce different encrypted values for the same input', () => {
      const plainText = 'my-secret-api-key';
      const encrypted1 = service.encrypt(plainText);
      const encrypted2 = service.encrypt(plainText);

      expect(encrypted1).not.toBe(encrypted2);

      const decrypted1 = service.decrypt(encrypted1);
      const decrypted2 = service.decrypt(encrypted2);

      expect(decrypted1).toBe(plainText);
      expect(decrypted2).toBe(plainText);
    });

    it('should throw error for empty string', () => {
      expect(() => service.encrypt('')).toThrow('Cannot encrypt empty text');
    });

    it('should handle special characters', () => {
      const plainText = 'Test@#$%^&*()_+{}|:"<>?';
      const encrypted = service.encrypt(plainText);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plainText);
    });

    it('should handle unicode characters', () => {
      const plainText = 'Olá, こんにちは, 你好, مرحبا';
      const encrypted = service.encrypt(plainText);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plainText);
    });

    it('should throw error for invalid encrypted format', () => {
      expect(() => service.decrypt('invalid-format')).toThrow('Invalid encrypted text format');
    });

    it('should throw error for malformed encrypted data', () => {
      expect(() => service.decrypt('abc123:def456')).toThrow();
    });
  });

  describe('generateKey', () => {
    it('should generate a 64-character hexadecimal string', () => {
      const key = EncryptionService.generateKey();

      expect(key).toHaveLength(64);
      expect(key).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should generate unique keys', () => {
      const key1 = EncryptionService.generateKey();
      const key2 = EncryptionService.generateKey();

      expect(key1).not.toBe(key2);
    });
  });

  describe('constructor validation', () => {
    it('should throw error if ENCRYPTION_KEY is not set', () => {
      const envBackup = process.env.ENCRYPTION_KEY;
      delete process.env.ENCRYPTION_KEY;

      expect(() => new EncryptionService()).toThrow('ENCRYPTION_KEY environment variable is required');

      process.env.ENCRYPTION_KEY = envBackup;
    });

    it('should throw error if ENCRYPTION_KEY has wrong length', () => {
      const envBackup = process.env.ENCRYPTION_KEY;
      process.env.ENCRYPTION_KEY = 'short';

      expect(() => new EncryptionService()).toThrow('Encryption key must be 64 hexadecimal characters (32 bytes)');

      process.env.ENCRYPTION_KEY = envBackup;
    });
  });
});
