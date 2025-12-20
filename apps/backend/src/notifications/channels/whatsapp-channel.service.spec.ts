import { Test, TestingModule } from '@nestjs/testing';
import { WhatsAppChannelService } from './whatsapp-channel.service';
import { NotificationChannel } from '@prisma/client';

describe('WhatsAppChannelService', () => {
  let service: WhatsAppChannelService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WhatsAppChannelService],
    }).compile();

    service = module.get<WhatsAppChannelService>(WhatsAppChannelService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should have WHATSAPP channel', () => {
    expect(service.channel).toBe(NotificationChannel.WHATSAPP);
  });

  describe('validateRecipient', () => {
    it('should return true for valid phone numbers', () => {
      expect(service.validateRecipient('11999999999')).toBe(true); // Brazilian
      expect(service.validateRecipient('5511999999999')).toBe(true); // Brazilian with country code
      expect(service.validateRecipient('+5511999999999')).toBe(true); // With +
      expect(service.validateRecipient('(11) 99999-9999')).toBe(true); // Formatted
      expect(service.validateRecipient('14155551234')).toBe(true); // US number
    });

    it('should return false for invalid phone numbers', () => {
      expect(service.validateRecipient('')).toBe(false);
      expect(service.validateRecipient('123')).toBe(false); // Too short
      expect(service.validateRecipient('1234567890123456')).toBe(false); // Too long
    });
  });

  describe('normalizePhoneNumber', () => {
    it('should normalize Brazilian numbers without country code', () => {
      expect(service.normalizePhoneNumber('11999999999')).toBe('+5511999999999');
      expect(service.normalizePhoneNumber('1199999999')).toBe('+551199999999');
    });

    it('should normalize numbers with country code', () => {
      expect(service.normalizePhoneNumber('5511999999999')).toBe('+5511999999999');
      expect(service.normalizePhoneNumber('+5511999999999')).toBe('+5511999999999');
    });

    it('should strip non-digit characters', () => {
      expect(service.normalizePhoneNumber('(11) 99999-9999')).toBe('+5511999999999');
      expect(service.normalizePhoneNumber('+55 (11) 99999-9999')).toBe('+5511999999999');
    });
  });

  describe('send', () => {
    it('should return success for valid message', async () => {
      const result = await service.send({
        to: '11999999999',
        body: 'Test message',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(result.messageId).toMatch(/^whatsapp_/);
    });

    it('should return error for invalid phone number', async () => {
      const result = await service.send({
        to: '123',
        body: 'Test message',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid phone number');
    });

    it('should handle formatted phone numbers', async () => {
      const result = await service.send({
        to: '(11) 99999-9999',
        body: 'Test message',
      });

      expect(result.success).toBe(true);
    });
  });
});
