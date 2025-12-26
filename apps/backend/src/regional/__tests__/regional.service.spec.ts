import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { RegionalService } from '../regional.service';
import { RegionalDataService } from '../regional-data.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('RegionalService', () => {
  let service: RegionalService;
  let regionalDataService: RegionalDataService;

  const mockUserId = 'user-123';

  const mockPrisma = {
    userSubscription: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockRegionalDataService = {
    getCountryByCode: jest.fn(),
    isValidCountryCode: jest.fn(),
    getDefaultSettingsForCountry: jest.fn(),
    getAllCountries: jest.fn(),
    getTimezonesByCountry: jest.fn(),
    getAllCurrencies: jest.fn(),
    getCountriesByRegion: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegionalService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RegionalDataService, useValue: mockRegionalDataService },
      ],
    }).compile();

    service = module.get<RegionalService>(RegionalService);
    regionalDataService = module.get<RegionalDataService>(RegionalDataService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCompanySettings', () => {
    it('should return default Brazil settings when no subscription exists', async () => {
      mockPrisma.userSubscription.findUnique.mockResolvedValue(null);
      mockRegionalDataService.getCountryByCode.mockReturnValue({
        code: 'BR',
        name: 'Brazil',
        currency: 'BRL',
        timezone: 'America/Sao_Paulo',
      });

      const result = await service.getCompanySettings(mockUserId);

      expect(result.country).toBe('BR');
      expect(result.currency).toBe('BRL');
      expect(result.timezone).toBe('America/Sao_Paulo');
    });

    it('should return user configured settings', async () => {
      mockPrisma.userSubscription.findUnique.mockResolvedValue({
        country: 'US',
        currency: 'USD',
        timezone: 'America/New_York',
      });
      mockRegionalDataService.getCountryByCode.mockReturnValue({
        code: 'US',
        name: 'United States',
        currency: 'USD',
        timezone: 'America/New_York',
      });

      const result = await service.getCompanySettings(mockUserId);

      expect(result.country).toBe('US');
      expect(result.currency).toBe('USD');
      expect(result.timezone).toBe('America/New_York');
      expect(result.countryInfo?.code).toBe('US');
    });

    it('should return country info when available', async () => {
      const countryInfo = {
        code: 'MX',
        name: 'Mexico',
        localName: 'México',
        currency: 'MXN',
        currencySymbol: '$',
        timezone: 'America/Mexico_City',
      };

      mockPrisma.userSubscription.findUnique.mockResolvedValue({
        country: 'MX',
        currency: 'MXN',
        timezone: 'America/Mexico_City',
      });
      mockRegionalDataService.getCountryByCode.mockReturnValue(countryInfo);

      const result = await service.getCompanySettings(mockUserId);

      expect(result.countryInfo).toEqual(countryInfo);
    });

    it('should fallback to defaults when subscription has null values', async () => {
      mockPrisma.userSubscription.findUnique.mockResolvedValue({
        country: null,
        currency: null,
        timezone: null,
      });
      mockRegionalDataService.getCountryByCode.mockReturnValue({
        code: 'BR',
        currency: 'BRL',
        timezone: 'America/Sao_Paulo',
      });

      const result = await service.getCompanySettings(mockUserId);

      expect(result.country).toBe('BR');
      expect(result.currency).toBe('BRL');
      expect(result.timezone).toBe('America/Sao_Paulo');
    });
  });

  describe('updateCompanySettings', () => {
    beforeEach(() => {
      // Default setup for update tests
      mockPrisma.userSubscription.findUnique.mockResolvedValue({
        country: 'BR',
        currency: 'BRL',
        timezone: 'America/Sao_Paulo',
      });
      mockRegionalDataService.getCountryByCode.mockReturnValue({
        code: 'BR',
        currency: 'BRL',
        timezone: 'America/Sao_Paulo',
      });
    });

    it('should throw BadRequestException for invalid country code', async () => {
      mockRegionalDataService.isValidCountryCode.mockReturnValue(false);

      await expect(
        service.updateCompanySettings(mockUserId, { country: 'XX' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid timezone', async () => {
      mockRegionalDataService.isValidCountryCode.mockReturnValue(true);
      mockRegionalDataService.getDefaultSettingsForCountry.mockReturnValue({
        currency: 'BRL',
        timezone: 'America/Sao_Paulo',
        locale: 'pt-BR',
      });

      await expect(
        service.updateCompanySettings(mockUserId, {
          timezone: 'Invalid/Timezone',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update country and auto-fill currency/timezone from defaults', async () => {
      mockRegionalDataService.isValidCountryCode.mockReturnValue(true);
      mockRegionalDataService.getDefaultSettingsForCountry.mockReturnValue({
        currency: 'USD',
        timezone: 'America/New_York',
        locale: 'en-US',
      });
      mockPrisma.userSubscription.update.mockResolvedValue({});

      // After update, return new settings
      mockPrisma.userSubscription.findUnique
        .mockResolvedValueOnce({
          country: 'BR',
          currency: 'BRL',
          timezone: 'America/Sao_Paulo',
        })
        .mockResolvedValueOnce({
          country: 'US',
          currency: 'USD',
          timezone: 'America/New_York',
        });
      mockRegionalDataService.getCountryByCode.mockReturnValue({
        code: 'US',
        currency: 'USD',
        timezone: 'America/New_York',
      });

      await service.updateCompanySettings(mockUserId, { country: 'US' });

      expect(mockPrisma.userSubscription.update).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        data: {
          country: 'US',
          currency: 'USD',
          timezone: 'America/New_York',
        },
      });
    });

    it('should allow overriding auto-filled currency when changing country', async () => {
      mockRegionalDataService.isValidCountryCode.mockReturnValue(true);
      mockRegionalDataService.getDefaultSettingsForCountry.mockReturnValue({
        currency: 'MXN',
        timezone: 'America/Mexico_City',
        locale: 'es-MX',
      });
      mockPrisma.userSubscription.update.mockResolvedValue({});

      mockPrisma.userSubscription.findUnique
        .mockResolvedValueOnce({
          country: 'BR',
          currency: 'BRL',
          timezone: 'America/Sao_Paulo',
        })
        .mockResolvedValueOnce({
          country: 'MX',
          currency: 'USD',
          timezone: 'America/Mexico_City',
        });
      mockRegionalDataService.getCountryByCode.mockReturnValue({
        code: 'MX',
        currency: 'MXN',
        timezone: 'America/Mexico_City',
      });

      await service.updateCompanySettings(mockUserId, {
        country: 'MX',
        currency: 'USD', // Override default MXN
      });

      expect(mockPrisma.userSubscription.update).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        data: {
          country: 'MX',
          currency: 'USD',
          timezone: 'America/Mexico_City',
        },
      });
    });

    it('should update only currency without changing country', async () => {
      mockPrisma.userSubscription.update.mockResolvedValue({});
      mockPrisma.userSubscription.findUnique
        .mockResolvedValueOnce({
          country: 'BR',
          currency: 'BRL',
          timezone: 'America/Sao_Paulo',
        })
        .mockResolvedValueOnce({
          country: 'BR',
          currency: 'USD',
          timezone: 'America/Sao_Paulo',
        });

      await service.updateCompanySettings(mockUserId, { currency: 'USD' });

      expect(mockPrisma.userSubscription.update).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        data: {
          country: 'BR',
          currency: 'USD',
          timezone: 'America/Sao_Paulo',
        },
      });
    });

    it('should update only timezone without changing country', async () => {
      mockPrisma.userSubscription.update.mockResolvedValue({});
      mockPrisma.userSubscription.findUnique
        .mockResolvedValueOnce({
          country: 'BR',
          currency: 'BRL',
          timezone: 'America/Sao_Paulo',
        })
        .mockResolvedValueOnce({
          country: 'BR',
          currency: 'BRL',
          timezone: 'America/Manaus',
        });

      await service.updateCompanySettings(mockUserId, {
        timezone: 'America/Manaus',
      });

      expect(mockPrisma.userSubscription.update).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        data: {
          country: 'BR',
          currency: 'BRL',
          timezone: 'America/Manaus',
        },
      });
    });
  });

  describe('getCompanyCurrency', () => {
    it('should return the configured currency', async () => {
      mockPrisma.userSubscription.findUnique.mockResolvedValue({
        country: 'US',
        currency: 'USD',
        timezone: 'America/New_York',
      });
      mockRegionalDataService.getCountryByCode.mockReturnValue({
        code: 'US',
        currency: 'USD',
        timezone: 'America/New_York',
      });

      const result = await service.getCompanyCurrency(mockUserId);

      expect(result).toBe('USD');
    });

    it('should return default BRL when no settings', async () => {
      mockPrisma.userSubscription.findUnique.mockResolvedValue(null);
      mockRegionalDataService.getCountryByCode.mockReturnValue({
        code: 'BR',
        currency: 'BRL',
        timezone: 'America/Sao_Paulo',
      });

      const result = await service.getCompanyCurrency(mockUserId);

      expect(result).toBe('BRL');
    });
  });

  describe('getCompanyTimezone', () => {
    it('should return the configured timezone', async () => {
      mockPrisma.userSubscription.findUnique.mockResolvedValue({
        country: 'US',
        currency: 'USD',
        timezone: 'America/Los_Angeles',
      });
      mockRegionalDataService.getCountryByCode.mockReturnValue({
        code: 'US',
        currency: 'USD',
        timezone: 'America/New_York',
      });

      const result = await service.getCompanyTimezone(mockUserId);

      expect(result).toBe('America/Los_Angeles');
    });

    it('should return default timezone when no settings', async () => {
      mockPrisma.userSubscription.findUnique.mockResolvedValue(null);
      mockRegionalDataService.getCountryByCode.mockReturnValue({
        code: 'BR',
        currency: 'BRL',
        timezone: 'America/Sao_Paulo',
      });

      const result = await service.getCompanyTimezone(mockUserId);

      expect(result).toBe('America/Sao_Paulo');
    });
  });

  describe('getCompanyCountryInfo', () => {
    it('should return country info', async () => {
      const countryInfo = {
        code: 'AR',
        name: 'Argentina',
        localName: 'Argentina',
        currency: 'ARS',
        currencySymbol: '$',
        timezone: 'America/Argentina/Buenos_Aires',
      };

      mockPrisma.userSubscription.findUnique.mockResolvedValue({
        country: 'AR',
        currency: 'ARS',
        timezone: 'America/Argentina/Buenos_Aires',
      });
      mockRegionalDataService.getCountryByCode.mockReturnValue(countryInfo);

      const result = await service.getCompanyCountryInfo(mockUserId);

      expect(result).toEqual(countryInfo);
    });

    it('should return undefined when country not found', async () => {
      mockPrisma.userSubscription.findUnique.mockResolvedValue({
        country: 'XX',
        currency: 'USD',
        timezone: 'UTC',
      });
      mockRegionalDataService.getCountryByCode.mockReturnValue(undefined);

      const result = await service.getCompanyCountryInfo(mockUserId);

      expect(result).toBeUndefined();
    });
  });
});
