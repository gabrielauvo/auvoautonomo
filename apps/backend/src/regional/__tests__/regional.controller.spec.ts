import { Test, TestingModule } from '@nestjs/testing';
import { RegionalController } from '../regional.controller';
import { RegionalService } from '../regional.service';
import { RegionalDataService } from '../regional-data.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

describe('RegionalController', () => {
  let controller: RegionalController;

  const mockUserId = 'user-123';

  const mockRegionalService = {
    getCompanySettings: jest.fn(),
    updateCompanySettings: jest.fn(),
  };

  const mockRegionalDataService = {
    getAllCountries: jest.fn(),
    getCountriesByRegion: jest.fn(),
    getTimezonesByCountry: jest.fn(),
    getAllCurrencies: jest.fn(),
  };

  const mockRequest = {
    user: { userId: mockUserId },
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RegionalController],
      providers: [
        { provide: RegionalService, useValue: mockRegionalService },
        { provide: RegionalDataService, useValue: mockRegionalDataService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<RegionalController>(RegionalController);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getRegionalSettings', () => {
    it('should return current regional settings', async () => {
      const expectedSettings = {
        country: 'BR',
        currency: 'BRL',
        timezone: 'America/Sao_Paulo',
        countryInfo: {
          code: 'BR',
          name: 'Brazil',
          localName: 'Brasil',
        },
      };

      mockRegionalService.getCompanySettings.mockResolvedValue(expectedSettings);

      const result = await controller.getRegionalSettings(mockRequest);

      expect(result).toEqual(expectedSettings);
      expect(mockRegionalService.getCompanySettings).toHaveBeenCalledWith(
        mockUserId,
      );
    });
  });

  describe('updateRegionalSettings', () => {
    it('should update regional settings', async () => {
      const updateDto = {
        country: 'US',
        currency: 'USD',
        timezone: 'America/New_York',
      };

      const expectedResult = {
        country: 'US',
        currency: 'USD',
        timezone: 'America/New_York',
        countryInfo: {
          code: 'US',
          name: 'United States',
        },
      };

      mockRegionalService.updateCompanySettings.mockResolvedValue(expectedResult);

      const result = await controller.updateRegionalSettings(
        mockRequest,
        updateDto,
      );

      expect(result).toEqual(expectedResult);
      expect(mockRegionalService.updateCompanySettings).toHaveBeenCalledWith(
        mockUserId,
        updateDto,
      );
    });

    it('should update only country', async () => {
      const updateDto = { country: 'MX' };

      mockRegionalService.updateCompanySettings.mockResolvedValue({
        country: 'MX',
        currency: 'MXN',
        timezone: 'America/Mexico_City',
      });

      await controller.updateRegionalSettings(mockRequest, updateDto);

      expect(mockRegionalService.updateCompanySettings).toHaveBeenCalledWith(
        mockUserId,
        { country: 'MX' },
      );
    });
  });

  describe('getAllCountries', () => {
    it('should return list of all countries', () => {
      const mockCountries = [
        {
          code: 'BR',
          name: 'Brazil',
          localName: 'Brasil',
          currency: 'BRL',
          currencySymbol: 'R$',
          timezone: 'America/Sao_Paulo',
          flag: 'BR',
          region: 'south_america',
        },
        {
          code: 'US',
          name: 'United States',
          localName: 'United States',
          currency: 'USD',
          currencySymbol: '$',
          timezone: 'America/New_York',
          flag: 'US',
          region: 'north_america',
        },
      ];

      mockRegionalDataService.getAllCountries.mockReturnValue(mockCountries);

      const result = controller.getAllCountries();

      expect(result).toHaveLength(2);
      expect(result[0].code).toBe('BR');
      expect(result[1].code).toBe('US');
    });
  });

  describe('getCountriesByRegion', () => {
    it('should return countries grouped by region', () => {
      const mockGrouped = {
        north_america: [
          { code: 'US', name: 'United States', region: 'north_america' },
          { code: 'CA', name: 'Canada', region: 'north_america' },
        ],
        central_america: [
          { code: 'MX', name: 'Mexico', region: 'central_america' },
        ],
        caribbean: [
          { code: 'CU', name: 'Cuba', region: 'caribbean' },
        ],
        south_america: [
          { code: 'BR', name: 'Brazil', region: 'south_america' },
          { code: 'AR', name: 'Argentina', region: 'south_america' },
        ],
      };

      mockRegionalDataService.getCountriesByRegion.mockReturnValue(mockGrouped);

      const result = controller.getCountriesByRegion();

      expect(result.north_america).toHaveLength(2);
      expect(result.central_america).toHaveLength(1);
      expect(result.caribbean).toHaveLength(1);
      expect(result.south_america).toHaveLength(2);
    });
  });

  describe('getTimezonesByCountry', () => {
    it('should return timezones for Brazil', () => {
      const mockTimezones = [
        'America/Sao_Paulo',
        'America/Manaus',
        'America/Cuiaba',
        'America/Fortaleza',
      ];

      mockRegionalDataService.getTimezonesByCountry.mockReturnValue(
        mockTimezones,
      );

      const result = controller.getTimezonesByCountry('BR');

      expect(result.countryCode).toBe('BR');
      expect(result.timezones).toEqual(mockTimezones);
    });

    it('should return timezones for US', () => {
      const mockTimezones = [
        'America/New_York',
        'America/Chicago',
        'America/Denver',
        'America/Los_Angeles',
      ];

      mockRegionalDataService.getTimezonesByCountry.mockReturnValue(
        mockTimezones,
      );

      const result = controller.getTimezonesByCountry('us');

      expect(result.countryCode).toBe('US');
      expect(result.timezones).toEqual(mockTimezones);
    });

    it('should return empty array for unknown country', () => {
      mockRegionalDataService.getTimezonesByCountry.mockReturnValue([]);

      const result = controller.getTimezonesByCountry('XX');

      expect(result.countryCode).toBe('XX');
      expect(result.timezones).toEqual([]);
    });
  });

  describe('getAllCurrencies', () => {
    it('should return all available currencies', () => {
      const mockCurrencies = [
        { code: 'ARS', symbol: '$', name: 'Argentine Peso' },
        { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
        { code: 'CAD', symbol: '$', name: 'Canadian Dollar' },
        { code: 'USD', symbol: '$', name: 'US Dollar' },
      ];

      mockRegionalDataService.getAllCurrencies.mockReturnValue(mockCurrencies);

      const result = controller.getAllCurrencies();

      expect(result).toHaveLength(4);
      expect(result.find((c) => c.code === 'BRL')).toBeDefined();
      expect(result.find((c) => c.code === 'USD')).toBeDefined();
    });
  });
});
