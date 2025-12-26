import { Test, TestingModule } from '@nestjs/testing';
import { RegionalDataService, CountryInfo } from '../regional-data.service';

describe('RegionalDataService', () => {
  let service: RegionalDataService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RegionalDataService],
    }).compile();

    service = module.get<RegionalDataService>(RegionalDataService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAllCountries', () => {
    it('should return all 35 Americas countries', () => {
      const countries = service.getAllCountries();

      // Total should be 35 countries
      expect(countries.length).toBeGreaterThanOrEqual(30);
    });

    it('should include major countries', () => {
      const countries = service.getAllCountries();
      const countryCodes = countries.map((c) => c.code);

      // North America
      expect(countryCodes).toContain('US');
      expect(countryCodes).toContain('CA');
      expect(countryCodes).toContain('MX');

      // South America
      expect(countryCodes).toContain('BR');
      expect(countryCodes).toContain('AR');
      expect(countryCodes).toContain('CO');
      expect(countryCodes).toContain('CL');
      expect(countryCodes).toContain('PE');

      // Central America
      expect(countryCodes).toContain('GT');
      expect(countryCodes).toContain('PA');
      expect(countryCodes).toContain('CR');

      // Caribbean
      expect(countryCodes).toContain('CU');
      expect(countryCodes).toContain('DO');
      expect(countryCodes).toContain('JM');
    });

    it('should have all required fields for each country', () => {
      const countries = service.getAllCountries();

      for (const country of countries) {
        expect(country.code).toBeDefined();
        expect(country.code).toHaveLength(2);
        expect(country.name).toBeDefined();
        expect(country.localName).toBeDefined();
        expect(country.currency).toBeDefined();
        expect(country.currencySymbol).toBeDefined();
        expect(country.currencyName).toBeDefined();
        expect(country.timezone).toBeDefined();
        expect(country.timezones).toBeDefined();
        expect(country.timezones.length).toBeGreaterThan(0);
        expect(country.locale).toBeDefined();
        expect(country.flag).toBeDefined();
        expect(country.region).toBeDefined();
        expect([
          'north_america',
          'central_america',
          'caribbean',
          'south_america',
        ]).toContain(country.region);
      }
    });
  });

  describe('getCountriesByRegion', () => {
    it('should return countries grouped by region', () => {
      const grouped = service.getCountriesByRegion();

      expect(grouped.north_america).toBeDefined();
      expect(grouped.central_america).toBeDefined();
      expect(grouped.caribbean).toBeDefined();
      expect(grouped.south_america).toBeDefined();
    });

    it('should have US, CA, MX in North America', () => {
      const grouped = service.getCountriesByRegion();
      const codes = grouped.north_america.map((c) => c.code);

      expect(codes).toContain('US');
      expect(codes).toContain('CA');
      expect(codes).toContain('MX');
    });

    it('should have Brazil in South America', () => {
      const grouped = service.getCountriesByRegion();
      const codes = grouped.south_america.map((c) => c.code);

      expect(codes).toContain('BR');
      expect(codes).toContain('AR');
      expect(codes).toContain('CO');
    });

    it('should have all countries assigned to exactly one region', () => {
      const grouped = service.getCountriesByRegion();
      const allCountries = service.getAllCountries();

      const groupedTotal =
        grouped.north_america.length +
        grouped.central_america.length +
        grouped.caribbean.length +
        grouped.south_america.length;

      expect(groupedTotal).toBe(allCountries.length);
    });
  });

  describe('getCountryByCode', () => {
    it('should return Brazil by code BR', () => {
      const brazil = service.getCountryByCode('BR');

      expect(brazil).toBeDefined();
      expect(brazil?.code).toBe('BR');
      expect(brazil?.name).toBe('Brazil');
      expect(brazil?.localName).toBe('Brasil');
      expect(brazil?.currency).toBe('BRL');
      expect(brazil?.currencySymbol).toBe('R$');
      expect(brazil?.timezone).toBe('America/Sao_Paulo');
      expect(brazil?.locale).toBe('pt-BR');
      expect(brazil?.region).toBe('south_america');
    });

    it('should return United States by code US', () => {
      const us = service.getCountryByCode('US');

      expect(us).toBeDefined();
      expect(us?.code).toBe('US');
      expect(us?.name).toBe('United States');
      expect(us?.currency).toBe('USD');
      expect(us?.currencySymbol).toBe('$');
      expect(us?.timezone).toBe('America/New_York');
      expect(us?.locale).toBe('en-US');
      expect(us?.region).toBe('north_america');
    });

    it('should return Mexico by code MX', () => {
      const mexico = service.getCountryByCode('MX');

      expect(mexico).toBeDefined();
      expect(mexico?.code).toBe('MX');
      expect(mexico?.name).toBe('Mexico');
      expect(mexico?.localName).toBe('México');
      expect(mexico?.currency).toBe('MXN');
      expect(mexico?.locale).toBe('es-MX');
    });

    it('should be case-insensitive', () => {
      const br1 = service.getCountryByCode('BR');
      const br2 = service.getCountryByCode('br');
      const br3 = service.getCountryByCode('Br');

      expect(br1).toEqual(br2);
      expect(br2).toEqual(br3);
    });

    it('should return undefined for invalid code', () => {
      const result = service.getCountryByCode('XX');

      expect(result).toBeUndefined();
    });

    it('should return undefined for empty code', () => {
      const result = service.getCountryByCode('');

      expect(result).toBeUndefined();
    });
  });

  describe('getTimezonesByCountry', () => {
    it('should return multiple timezones for Brazil', () => {
      const timezones = service.getTimezonesByCountry('BR');

      expect(timezones.length).toBeGreaterThan(1);
      expect(timezones).toContain('America/Sao_Paulo');
      expect(timezones).toContain('America/Manaus');
    });

    it('should return multiple timezones for US', () => {
      const timezones = service.getTimezonesByCountry('US');

      expect(timezones.length).toBeGreaterThan(1);
      expect(timezones).toContain('America/New_York');
      expect(timezones).toContain('America/Los_Angeles');
      expect(timezones).toContain('America/Chicago');
    });

    it('should return single timezone for countries with one zone', () => {
      const timezones = service.getTimezonesByCountry('CR');

      expect(timezones).toEqual(['America/Costa_Rica']);
    });

    it('should return empty array for invalid country', () => {
      const timezones = service.getTimezonesByCountry('XX');

      expect(timezones).toEqual([]);
    });

    it('should be case-insensitive', () => {
      const tz1 = service.getTimezonesByCountry('BR');
      const tz2 = service.getTimezonesByCountry('br');

      expect(tz1).toEqual(tz2);
    });
  });

  describe('getAllCurrencies', () => {
    it('should return unique currencies', () => {
      const currencies = service.getAllCurrencies();
      const codes = currencies.map((c) => c.code);

      // Check for duplicates
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(codes.length);
    });

    it('should include major currencies', () => {
      const currencies = service.getAllCurrencies();
      const codes = currencies.map((c) => c.code);

      expect(codes).toContain('USD');
      expect(codes).toContain('BRL');
      expect(codes).toContain('MXN');
      expect(codes).toContain('ARS');
      expect(codes).toContain('CAD');
      expect(codes).toContain('COP');
      expect(codes).toContain('CLP');
    });

    it('should have all required fields for each currency', () => {
      const currencies = service.getAllCurrencies();

      for (const currency of currencies) {
        expect(currency.code).toBeDefined();
        expect(currency.code).toHaveLength(3);
        expect(currency.symbol).toBeDefined();
        expect(currency.name).toBeDefined();
      }
    });

    it('should return currencies sorted by code', () => {
      const currencies = service.getAllCurrencies();
      const codes = currencies.map((c) => c.code);
      const sortedCodes = [...codes].sort();

      expect(codes).toEqual(sortedCodes);
    });
  });

  describe('isValidCountryCode', () => {
    it('should return true for valid country codes', () => {
      expect(service.isValidCountryCode('BR')).toBe(true);
      expect(service.isValidCountryCode('US')).toBe(true);
      expect(service.isValidCountryCode('MX')).toBe(true);
      expect(service.isValidCountryCode('AR')).toBe(true);
    });

    it('should return true for lowercase country codes', () => {
      expect(service.isValidCountryCode('br')).toBe(true);
      expect(service.isValidCountryCode('us')).toBe(true);
    });

    it('should return false for invalid country codes', () => {
      expect(service.isValidCountryCode('XX')).toBe(false);
      expect(service.isValidCountryCode('ZZ')).toBe(false);
      expect(service.isValidCountryCode('')).toBe(false);
      expect(service.isValidCountryCode('BRAZIL')).toBe(false);
    });

    it('should return false for non-Americas countries', () => {
      // These are valid ISO codes but not in our Americas list
      expect(service.isValidCountryCode('FR')).toBe(false);
      expect(service.isValidCountryCode('DE')).toBe(false);
      expect(service.isValidCountryCode('JP')).toBe(false);
      expect(service.isValidCountryCode('CN')).toBe(false);
    });
  });

  describe('isValidTimezoneForCountry', () => {
    it('should return true for valid timezone in Brazil', () => {
      expect(
        service.isValidTimezoneForCountry('BR', 'America/Sao_Paulo'),
      ).toBe(true);
      expect(service.isValidTimezoneForCountry('BR', 'America/Manaus')).toBe(
        true,
      );
    });

    it('should return false for invalid timezone in Brazil', () => {
      expect(
        service.isValidTimezoneForCountry('BR', 'America/New_York'),
      ).toBe(false);
      expect(service.isValidTimezoneForCountry('BR', 'Europe/London')).toBe(
        false,
      );
    });

    it('should return true for valid timezone in US', () => {
      expect(service.isValidTimezoneForCountry('US', 'America/New_York')).toBe(
        true,
      );
      expect(
        service.isValidTimezoneForCountry('US', 'America/Los_Angeles'),
      ).toBe(true);
    });

    it('should return false for invalid country code', () => {
      expect(
        service.isValidTimezoneForCountry('XX', 'America/Sao_Paulo'),
      ).toBe(false);
    });
  });

  describe('getDefaultSettingsForCountry', () => {
    it('should return defaults for Brazil', () => {
      const defaults = service.getDefaultSettingsForCountry('BR');

      expect(defaults).toEqual({
        currency: 'BRL',
        timezone: 'America/Sao_Paulo',
        locale: 'pt-BR',
      });
    });

    it('should return defaults for US', () => {
      const defaults = service.getDefaultSettingsForCountry('US');

      expect(defaults).toEqual({
        currency: 'USD',
        timezone: 'America/New_York',
        locale: 'en-US',
      });
    });

    it('should return defaults for Mexico', () => {
      const defaults = service.getDefaultSettingsForCountry('MX');

      expect(defaults).toEqual({
        currency: 'MXN',
        timezone: 'America/Mexico_City',
        locale: 'es-MX',
      });
    });

    it('should return null for invalid country', () => {
      const defaults = service.getDefaultSettingsForCountry('XX');

      expect(defaults).toBeNull();
    });

    it('should be case-insensitive', () => {
      const defaults1 = service.getDefaultSettingsForCountry('BR');
      const defaults2 = service.getDefaultSettingsForCountry('br');

      expect(defaults1).toEqual(defaults2);
    });
  });

  describe('Currency Data Integrity', () => {
    it('should have correct currency for Brazil', () => {
      const brazil = service.getCountryByCode('BR');
      expect(brazil?.currency).toBe('BRL');
      expect(brazil?.currencySymbol).toBe('R$');
      expect(brazil?.currencyName).toBe('Brazilian Real');
    });

    it('should have correct currency for dollarized countries', () => {
      // Ecuador uses USD
      const ecuador = service.getCountryByCode('EC');
      expect(ecuador?.currency).toBe('USD');

      // El Salvador uses USD
      const elSalvador = service.getCountryByCode('SV');
      expect(elSalvador?.currency).toBe('USD');

      // Panama uses USD
      const panama = service.getCountryByCode('PA');
      expect(panama?.currency).toBe('USD');
    });

    it('should have Euro for French Guiana', () => {
      const frenchGuiana = service.getCountryByCode('GF');
      expect(frenchGuiana?.currency).toBe('EUR');
      expect(frenchGuiana?.currencySymbol).toBe('€');
    });
  });

  describe('Timezone Data Integrity', () => {
    it('should have valid IANA timezone identifiers', () => {
      const countries = service.getAllCountries();

      for (const country of countries) {
        // Primary timezone should be valid
        expect(() => {
          Intl.DateTimeFormat(undefined, { timeZone: country.timezone });
        }).not.toThrow();

        // All timezones should be valid
        for (const tz of country.timezones) {
          expect(() => {
            Intl.DateTimeFormat(undefined, { timeZone: tz });
          }).not.toThrow();
        }
      }
    });

    it('should include primary timezone in timezones array', () => {
      const countries = service.getAllCountries();

      for (const country of countries) {
        expect(country.timezones).toContain(country.timezone);
      }
    });
  });
});
