import { Test, TestingModule } from '@nestjs/testing';
import { EmailChannelService } from './email-channel.service';
import { NotificationChannel } from '@prisma/client';

describe('EmailChannelService', () => {
  let service: EmailChannelService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailChannelService],
    }).compile();

    service = module.get<EmailChannelService>(EmailChannelService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should have EMAIL channel', () => {
    expect(service.channel).toBe(NotificationChannel.EMAIL);
  });

  describe('validateRecipient', () => {
    it('should return true for valid emails', () => {
      expect(service.validateRecipient('test@example.com')).toBe(true);
      expect(service.validateRecipient('user.name@domain.co')).toBe(true);
      expect(service.validateRecipient('user+tag@example.org')).toBe(true);
    });

    it('should return false for invalid emails', () => {
      expect(service.validateRecipient('')).toBe(false);
      expect(service.validateRecipient('invalid')).toBe(false);
      expect(service.validateRecipient('invalid@')).toBe(false);
      expect(service.validateRecipient('@domain.com')).toBe(false);
      expect(service.validateRecipient('test@.com')).toBe(false);
    });
  });

  describe('send', () => {
    it('should return success for valid message', async () => {
      const result = await service.send({
        to: 'client@test.com',
        subject: 'Test Subject',
        body: 'Test body',
        htmlBody: '<p>Test body</p>',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(result.messageId).toMatch(/^email_/);
    });

    it('should return error for invalid email', async () => {
      const result = await service.send({
        to: 'invalid-email',
        subject: 'Test Subject',
        body: 'Test body',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid email');
    });

    it('should handle missing subject', async () => {
      const result = await service.send({
        to: 'client@test.com',
        body: 'Test body',
      });

      expect(result.success).toBe(true);
    });
  });
});
