import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { ReferralCodeService } from '../services/referral-code.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ReferralCodeStatus } from '@prisma/client';

describe('ReferralCodeService', () => {
  let service: ReferralCodeService;
  let prisma: PrismaService;

  const mockPrismaService = {
    referralCode: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    // Set environment variable for tests
    process.env.FRONTEND_URL = 'https://auvoautonomo.com';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferralCodeService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ReferralCodeService>(ReferralCodeService);
    prisma = module.get<PrismaService>(PrismaService);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('getOrCreateCode', () => {
    const userId = 'user-123';

    it('should return existing code if user already has one', async () => {
      const existingCode = {
        id: 'code-123',
        userId,
        code: 'JOAO7K2F',
        customCode: null,
        status: ReferralCodeStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.referralCode.findUnique.mockResolvedValue(existingCode);

      const result = await service.getOrCreateCode(userId);

      expect(result).toEqual({
        code: 'JOAO7K2F',
        customCode: null,
        link: 'https://auvoautonomo.com/r/JOAO7K2F',
      });
      expect(mockPrismaService.referralCode.findUnique).toHaveBeenCalledWith({
        where: { userId },
      });
      expect(mockPrismaService.referralCode.create).not.toHaveBeenCalled();
    });

    it('should return link with customCode when available', async () => {
      const existingCode = {
        id: 'code-123',
        userId,
        code: 'JOAO7K2F',
        customCode: 'MEUCODIGO',
        status: ReferralCodeStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.referralCode.findUnique.mockResolvedValue(existingCode);

      const result = await service.getOrCreateCode(userId);

      expect(result).toEqual({
        code: 'JOAO7K2F',
        customCode: 'MEUCODIGO',
        link: 'https://auvoautonomo.com/r/MEUCODIGO',
      });
    });

    it('should create new code if user does not have one', async () => {
      const newCode = {
        id: 'code-456',
        userId,
        code: 'ABCD1234',
        customCode: null,
        status: ReferralCodeStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.referralCode.findUnique.mockResolvedValue(null);
      mockPrismaService.referralCode.findFirst.mockResolvedValue(null); // Code doesn't exist
      mockPrismaService.referralCode.create.mockResolvedValue(newCode);

      const result = await service.getOrCreateCode(userId);

      expect(result).toEqual({
        code: 'ABCD1234',
        customCode: null,
        link: 'https://auvoautonomo.com/r/ABCD1234',
      });
      expect(mockPrismaService.referralCode.create).toHaveBeenCalledWith({
        data: {
          userId,
          code: expect.any(String),
          status: ReferralCodeStatus.ACTIVE,
        },
      });
    });

    it('should retry code generation if generated code already exists', async () => {
      const newCode = {
        id: 'code-456',
        userId,
        code: 'WXYZ5678',
        customCode: null,
        status: ReferralCodeStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.referralCode.findUnique.mockResolvedValue(null);
      mockPrismaService.referralCode.findFirst
        .mockResolvedValueOnce({ code: 'exists' }) // First code exists
        .mockResolvedValueOnce(null); // Second code is unique

      mockPrismaService.referralCode.create.mockResolvedValue(newCode);

      const result = await service.getOrCreateCode(userId);

      expect(result.code).toBe('WXYZ5678');
      expect(mockPrismaService.referralCode.findFirst).toHaveBeenCalledTimes(2);
    });
  });

  describe('validateCode', () => {
    it('should return valid response with referrer info for active code', async () => {
      const referralCode = {
        id: 'code-123',
        code: 'JOAO7K2F',
        customCode: null,
        status: ReferralCodeStatus.ACTIVE,
        userId: 'user-123',
        user: {
          id: 'user-123',
          name: 'João Silva',
        },
      };

      mockPrismaService.referralCode.findFirst.mockResolvedValue(referralCode);

      const result = await service.validateCode('JOAO7K2F');

      expect(result).toEqual({
        valid: true,
        referrerFirstName: 'João',
        referrerUserId: 'user-123',
        codeId: 'code-123',
      });
    });

    it('should find by customCode', async () => {
      const referralCode = {
        id: 'code-123',
        code: 'GABR7K2F',
        customCode: 'GABRIEL',
        status: ReferralCodeStatus.ACTIVE,
        userId: 'user-456',
        user: {
          id: 'user-456',
          name: 'Gabriel Santos',
        },
      };

      mockPrismaService.referralCode.findFirst.mockResolvedValue(referralCode);

      const result = await service.validateCode('GABRIEL');

      expect(result).toEqual({
        valid: true,
        referrerFirstName: 'Gabriel',
        referrerUserId: 'user-456',
        codeId: 'code-123',
      });
    });

    it('should normalize code to uppercase', async () => {
      const referralCode = {
        id: 'code-123',
        code: 'JOAO7K2F',
        customCode: null,
        status: ReferralCodeStatus.ACTIVE,
        userId: 'user-123',
        user: {
          id: 'user-123',
          name: 'João Silva',
        },
      };

      mockPrismaService.referralCode.findFirst.mockResolvedValue(referralCode);

      await service.validateCode('joao7k2f');

      expect(mockPrismaService.referralCode.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [
            { code: 'JOAO7K2F' },
            { customCode: 'JOAO7K2F' },
          ],
          status: ReferralCodeStatus.ACTIVE,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    });

    it('should return invalid if code not found', async () => {
      mockPrismaService.referralCode.findFirst.mockResolvedValue(null);

      const result = await service.validateCode('INVALID');

      expect(result).toEqual({ valid: false });
    });

    it('should use first name only from full name', async () => {
      const referralCode = {
        id: 'code-123',
        code: 'TEST1234',
        customCode: null,
        status: ReferralCodeStatus.ACTIVE,
        userId: 'user-123',
        user: {
          id: 'user-123',
          name: 'Maria Clara Santos',
        },
      };

      mockPrismaService.referralCode.findFirst.mockResolvedValue(referralCode);

      const result = await service.validateCode('TEST1234');

      expect(result.referrerFirstName).toBe('Maria');
    });

    it('should fallback to "Usuário" if name is empty', async () => {
      const referralCode = {
        id: 'code-123',
        code: 'TEST1234',
        customCode: null,
        status: ReferralCodeStatus.ACTIVE,
        userId: 'user-123',
        user: {
          id: 'user-123',
          name: null,
        },
      };

      mockPrismaService.referralCode.findFirst.mockResolvedValue(referralCode);

      const result = await service.validateCode('TEST1234');

      expect(result.referrerFirstName).toBe('Usuário');
    });
  });

  describe('setCustomCode', () => {
    const userId = 'user-123';

    it('should set custom code successfully', async () => {
      const customCode = 'MEUNEGOCIO';
      const existingCode = {
        id: 'code-123',
        userId,
        code: 'JOAO7K2F',
        customCode: null,
        status: ReferralCodeStatus.ACTIVE,
      };

      // Check if customCode is taken - not taken
      mockPrismaService.referralCode.findFirst.mockResolvedValue(null);

      // getOrCreateCode - user already has code
      mockPrismaService.referralCode.findUnique.mockResolvedValue(existingCode);

      // Update with custom code
      mockPrismaService.referralCode.update.mockResolvedValue({
        ...existingCode,
        customCode: 'MEUNEGOCIO',
      });

      const result = await service.setCustomCode(userId, customCode);

      expect(result).toEqual({
        code: 'JOAO7K2F',
        customCode: 'MEUNEGOCIO',
        link: 'https://auvoautonomo.com/r/MEUNEGOCIO',
      });
    });

    it('should throw ConflictException if custom code is already taken', async () => {
      const customCode = 'TAKEN';
      const takenCode = {
        id: 'code-456',
        userId: 'other-user',
        customCode: 'TAKEN',
      };

      mockPrismaService.referralCode.findFirst.mockResolvedValue(takenCode);

      await expect(service.setCustomCode(userId, customCode)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should normalize custom code to uppercase', async () => {
      const existingCode = {
        id: 'code-123',
        userId,
        code: 'JOAO7K2F',
        customCode: null,
        status: ReferralCodeStatus.ACTIVE,
      };

      mockPrismaService.referralCode.findFirst.mockResolvedValue(null);
      mockPrismaService.referralCode.findUnique.mockResolvedValue(existingCode);
      mockPrismaService.referralCode.update.mockResolvedValue({
        ...existingCode,
        customCode: 'MYNEWCODE',
      });

      await service.setCustomCode(userId, 'mynewcode');

      expect(mockPrismaService.referralCode.update).toHaveBeenCalledWith({
        where: { userId },
        data: { customCode: 'MYNEWCODE' },
      });
    });

    it('should trim whitespace from custom code', async () => {
      const existingCode = {
        id: 'code-123',
        userId,
        code: 'JOAO7K2F',
        customCode: null,
        status: ReferralCodeStatus.ACTIVE,
      };

      mockPrismaService.referralCode.findFirst.mockResolvedValue(null);
      mockPrismaService.referralCode.findUnique.mockResolvedValue(existingCode);
      mockPrismaService.referralCode.update.mockResolvedValue({
        ...existingCode,
        customCode: 'MYCODE',
      });

      await service.setCustomCode(userId, '  mycode  ');

      expect(mockPrismaService.referralCode.update).toHaveBeenCalledWith({
        where: { userId },
        data: { customCode: 'MYCODE' },
      });
    });
  });

  describe('findById', () => {
    it('should return code with user info', async () => {
      const code = {
        id: 'code-123',
        code: 'JOAO7K2F',
        customCode: null,
        status: ReferralCodeStatus.ACTIVE,
        userId: 'user-123',
        user: {
          id: 'user-123',
          name: 'João Silva',
          email: 'joao@test.com',
        },
      };

      mockPrismaService.referralCode.findUnique.mockResolvedValue(code);

      const result = await service.findById('code-123');

      expect(result).toEqual(code);
      expect(mockPrismaService.referralCode.findUnique).toHaveBeenCalledWith({
        where: { id: 'code-123' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
    });

    it('should return null if code not found', async () => {
      mockPrismaService.referralCode.findUnique.mockResolvedValue(null);

      const result = await service.findById('nonexistent');

      expect(result).toBeNull();
    });
  });
});
