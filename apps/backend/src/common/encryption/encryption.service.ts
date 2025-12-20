import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * EncryptionService com suporte a Key Rotation
 *
 * Key Rotation permite trocar chaves de criptografia sem perder dados antigos.
 * Útil para:
 * - Compliance (PCI-DSS, GDPR requerem rotação periódica)
 * - Segurança (limita janela de exposição se chave vazar)
 * - Zero-downtime migration
 *
 * Como usar:
 * 1. ENCRYPTION_KEY = chave atual (sempre usada para encrypt)
 * 2. ENCRYPTION_KEY_PREVIOUS = chave(s) anterior(es) separadas por vírgula
 * 3. Decrypt tenta todas as chaves automaticamente
 *
 * Exemplo de rotação:
 * 1. Gera nova chave: EncryptionService.generateKey()
 * 2. Move ENCRYPTION_KEY atual para ENCRYPTION_KEY_PREVIOUS
 * 3. Define nova chave como ENCRYPTION_KEY
 * 4. Re-encrypt dados gradualmente (opcional, mas recomendado)
 */
@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-cbc';
  private readonly ivLength = 16;
  private readonly logger = new Logger(EncryptionService.name);

  // Chave atual - sempre usada para criptografar
  private readonly currentKey: Buffer;

  // Chaves anteriores - usadas apenas para descriptografar dados antigos
  private readonly previousKeys: Buffer[] = [];

  // Todas as chaves (current + previous) para decrypt
  private readonly allKeys: Buffer[];

  constructor() {
    const encryptionKey = process.env.ENCRYPTION_KEY;

    if (!encryptionKey) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }

    this.validateKey(encryptionKey);
    this.currentKey = Buffer.from(encryptionKey, 'hex');

    // Carrega chaves anteriores (se houver)
    const previousKeysStr = process.env.ENCRYPTION_KEY_PREVIOUS;
    if (previousKeysStr) {
      const keys = previousKeysStr.split(',').map((k) => k.trim());
      for (const key of keys) {
        try {
          this.validateKey(key);
          this.previousKeys.push(Buffer.from(key, 'hex'));
        } catch (error) {
          this.logger.warn(`Invalid previous encryption key: ${error.message}`);
        }
      }

      if (this.previousKeys.length > 0) {
        this.logger.log(
          `Key rotation enabled: 1 current key + ${this.previousKeys.length} previous key(s)`,
        );
      }
    }

    // Monta lista de todas as chaves (current primeiro)
    this.allKeys = [this.currentKey, ...this.previousKeys];
  }

  /**
   * Valida formato de chave
   */
  private validateKey(key: string): void {
    if (key.length !== 64) {
      throw new Error('Encryption key must be 64 hexadecimal characters (32 bytes)');
    }

    if (!/^[0-9a-fA-F]{64}$/.test(key)) {
      throw new Error('Encryption key must contain only hexadecimal characters');
    }
  }

  /**
   * Encrypts a string value
   * SEMPRE usa a chave atual (currentKey)
   *
   * @param text - Plain text to encrypt
   * @returns Encrypted text in format: version:iv:encryptedData
   */
  encrypt(text: string): string {
    if (!text) {
      throw new Error('Cannot encrypt empty text');
    }

    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, this.currentKey, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Formato: v1:iv:data
    // Versão permite mudanças futuras no algoritmo
    return `v1:${iv.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypts an encrypted string
   * Tenta TODAS as chaves disponíveis (current + previous)
   *
   * @param encryptedText - Encrypted text in format: version:iv:encryptedData (ou iv:encryptedData para backward compatibility)
   * @returns Decrypted plain text
   */
  decrypt(encryptedText: string): string {
    if (!encryptedText) {
      throw new Error('Cannot decrypt empty text');
    }

    let version = 'v0'; // backward compatibility
    let parts = encryptedText.split(':');

    // Formato novo: v1:iv:data
    if (parts[0].startsWith('v')) {
      version = parts[0];
      parts = parts.slice(1);
    }

    // Formato antigo ou novo sem versão: iv:data
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted text format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const encryptedData = parts[1];

    // Tenta descriptografar com cada chave disponível
    const errors: Error[] = [];

    for (let i = 0; i < this.allKeys.length; i++) {
      const key = this.allKeys[i];
      const isCurrentKey = i === 0;

      try {
        const decipher = crypto.createDecipheriv(this.algorithm, key, iv);

        let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        // Log se usou chave antiga (pode indicar necessidade de re-encrypt)
        if (!isCurrentKey) {
          this.logger.warn(
            `Decrypted with previous key #${i}. Consider re-encrypting this data.`,
          );
        }

        return decrypted;
      } catch (error) {
        errors.push(error);
        // Continua tentando próxima chave
      }
    }

    // Se nenhuma chave funcionou, lança erro
    this.logger.error(
      `Failed to decrypt with ${this.allKeys.length} available key(s)`,
    );
    throw new Error(
      `Decryption failed with all available keys. This data may be corrupted or encrypted with a different key.`,
    );
  }

  /**
   * Re-encrypts data with current key
   * Útil para migrar dados criptografados com chaves antigas
   *
   * @param encryptedText - Data encrypted with old key
   * @returns Data re-encrypted with current key
   */
  reEncrypt(encryptedText: string): string {
    const decrypted = this.decrypt(encryptedText);
    return this.encrypt(decrypted);
  }

  /**
   * Verifica se dados estão criptografados com a chave atual
   * Útil para identificar dados que precisam de re-encryption
   *
   * @param encryptedText - Encrypted text to check
   * @returns true se está usando chave atual, false se está usando chave antiga
   */
  isUsingCurrentKey(encryptedText: string): boolean {
    if (!encryptedText) {
      return false;
    }

    let parts = encryptedText.split(':');

    // Remove versão se houver
    if (parts[0].startsWith('v')) {
      parts = parts.slice(1);
    }

    if (parts.length !== 2) {
      return false;
    }

    const iv = Buffer.from(parts[0], 'hex');
    const encryptedData = parts[1];

    try {
      const decipher = crypto.createDecipheriv(this.algorithm, this.currentKey, iv);
      decipher.update(encryptedData, 'hex', 'utf8');
      decipher.final('utf8');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Retorna número de chaves disponíveis
   */
  getKeysCount(): { current: number; previous: number; total: number } {
    return {
      current: 1,
      previous: this.previousKeys.length,
      total: this.allKeys.length,
    };
  }

  /**
   * Generates a random encryption key (for initial setup or rotation)
   * @returns 64-character hexadecimal string (32 bytes)
   */
  static generateKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Gera múltiplas chaves para rotação
   * Útil para setup inicial com key rotation
   */
  static generateKeyPair(): { current: string; previous: string } {
    return {
      current: EncryptionService.generateKey(),
      previous: EncryptionService.generateKey(),
    };
  }
}
