import { Injectable } from '@nestjs/common';

/**
 * Information about a country including regional settings
 */
export interface CountryInfo {
  code: string; // ISO 3166-1 alpha-2
  name: string; // English name
  localName: string; // Native name
  currency: string; // ISO 4217 currency code
  currencySymbol: string;
  currencyName: string;
  timezone: string; // Primary IANA timezone
  timezones: string[]; // All timezones in country
  locale: string; // Default locale for formatting
  flag: string; // ISO country code for flag emoji
  region: 'north_america' | 'central_america' | 'caribbean' | 'south_america';
}

/**
 * Static data service for all 35 Americas countries
 * Provides country, currency, and timezone information
 */
@Injectable()
export class RegionalDataService {
  private readonly countries: CountryInfo[] = [
    // =========================================================================
    // NORTH AMERICA
    // =========================================================================
    {
      code: 'US',
      name: 'United States',
      localName: 'United States',
      currency: 'USD',
      currencySymbol: '$',
      currencyName: 'US Dollar',
      timezone: 'America/New_York',
      timezones: [
        'America/New_York',
        'America/Chicago',
        'America/Denver',
        'America/Los_Angeles',
        'America/Anchorage',
        'Pacific/Honolulu',
      ],
      locale: 'en-US',
      flag: 'US',
      region: 'north_america',
    },
    {
      code: 'CA',
      name: 'Canada',
      localName: 'Canada',
      currency: 'CAD',
      currencySymbol: '$',
      currencyName: 'Canadian Dollar',
      timezone: 'America/Toronto',
      timezones: [
        'America/Toronto',
        'America/Vancouver',
        'America/Edmonton',
        'America/Winnipeg',
        'America/Halifax',
        'America/St_Johns',
      ],
      locale: 'en-CA',
      flag: 'CA',
      region: 'north_america',
    },
    {
      code: 'MX',
      name: 'Mexico',
      localName: 'México',
      currency: 'MXN',
      currencySymbol: '$',
      currencyName: 'Mexican Peso',
      timezone: 'America/Mexico_City',
      timezones: [
        'America/Mexico_City',
        'America/Cancun',
        'America/Tijuana',
        'America/Chihuahua',
        'America/Hermosillo',
      ],
      locale: 'es-MX',
      flag: 'MX',
      region: 'north_america',
    },

    // =========================================================================
    // CENTRAL AMERICA
    // =========================================================================
    {
      code: 'GT',
      name: 'Guatemala',
      localName: 'Guatemala',
      currency: 'GTQ',
      currencySymbol: 'Q',
      currencyName: 'Guatemalan Quetzal',
      timezone: 'America/Guatemala',
      timezones: ['America/Guatemala'],
      locale: 'es-GT',
      flag: 'GT',
      region: 'central_america',
    },
    {
      code: 'BZ',
      name: 'Belize',
      localName: 'Belize',
      currency: 'BZD',
      currencySymbol: '$',
      currencyName: 'Belize Dollar',
      timezone: 'America/Belize',
      timezones: ['America/Belize'],
      locale: 'en-BZ',
      flag: 'BZ',
      region: 'central_america',
    },
    {
      code: 'HN',
      name: 'Honduras',
      localName: 'Honduras',
      currency: 'HNL',
      currencySymbol: 'L',
      currencyName: 'Honduran Lempira',
      timezone: 'America/Tegucigalpa',
      timezones: ['America/Tegucigalpa'],
      locale: 'es-HN',
      flag: 'HN',
      region: 'central_america',
    },
    {
      code: 'SV',
      name: 'El Salvador',
      localName: 'El Salvador',
      currency: 'USD',
      currencySymbol: '$',
      currencyName: 'US Dollar',
      timezone: 'America/El_Salvador',
      timezones: ['America/El_Salvador'],
      locale: 'es-SV',
      flag: 'SV',
      region: 'central_america',
    },
    {
      code: 'NI',
      name: 'Nicaragua',
      localName: 'Nicaragua',
      currency: 'NIO',
      currencySymbol: 'C$',
      currencyName: 'Nicaraguan Córdoba',
      timezone: 'America/Managua',
      timezones: ['America/Managua'],
      locale: 'es-NI',
      flag: 'NI',
      region: 'central_america',
    },
    {
      code: 'CR',
      name: 'Costa Rica',
      localName: 'Costa Rica',
      currency: 'CRC',
      currencySymbol: '₡',
      currencyName: 'Costa Rican Colón',
      timezone: 'America/Costa_Rica',
      timezones: ['America/Costa_Rica'],
      locale: 'es-CR',
      flag: 'CR',
      region: 'central_america',
    },
    {
      code: 'PA',
      name: 'Panama',
      localName: 'Panamá',
      currency: 'USD',
      currencySymbol: '$',
      currencyName: 'US Dollar',
      timezone: 'America/Panama',
      timezones: ['America/Panama'],
      locale: 'es-PA',
      flag: 'PA',
      region: 'central_america',
    },

    // =========================================================================
    // CARIBBEAN
    // =========================================================================
    {
      code: 'CU',
      name: 'Cuba',
      localName: 'Cuba',
      currency: 'CUP',
      currencySymbol: '$',
      currencyName: 'Cuban Peso',
      timezone: 'America/Havana',
      timezones: ['America/Havana'],
      locale: 'es-CU',
      flag: 'CU',
      region: 'caribbean',
    },
    {
      code: 'DO',
      name: 'Dominican Republic',
      localName: 'República Dominicana',
      currency: 'DOP',
      currencySymbol: '$',
      currencyName: 'Dominican Peso',
      timezone: 'America/Santo_Domingo',
      timezones: ['America/Santo_Domingo'],
      locale: 'es-DO',
      flag: 'DO',
      region: 'caribbean',
    },
    {
      code: 'HT',
      name: 'Haiti',
      localName: 'Haïti',
      currency: 'HTG',
      currencySymbol: 'G',
      currencyName: 'Haitian Gourde',
      timezone: 'America/Port-au-Prince',
      timezones: ['America/Port-au-Prince'],
      locale: 'fr-HT',
      flag: 'HT',
      region: 'caribbean',
    },
    {
      code: 'JM',
      name: 'Jamaica',
      localName: 'Jamaica',
      currency: 'JMD',
      currencySymbol: '$',
      currencyName: 'Jamaican Dollar',
      timezone: 'America/Jamaica',
      timezones: ['America/Jamaica'],
      locale: 'en-JM',
      flag: 'JM',
      region: 'caribbean',
    },
    {
      code: 'PR',
      name: 'Puerto Rico',
      localName: 'Puerto Rico',
      currency: 'USD',
      currencySymbol: '$',
      currencyName: 'US Dollar',
      timezone: 'America/Puerto_Rico',
      timezones: ['America/Puerto_Rico'],
      locale: 'es-PR',
      flag: 'PR',
      region: 'caribbean',
    },
    {
      code: 'TT',
      name: 'Trinidad and Tobago',
      localName: 'Trinidad and Tobago',
      currency: 'TTD',
      currencySymbol: '$',
      currencyName: 'Trinidad and Tobago Dollar',
      timezone: 'America/Port_of_Spain',
      timezones: ['America/Port_of_Spain'],
      locale: 'en-TT',
      flag: 'TT',
      region: 'caribbean',
    },
    {
      code: 'BS',
      name: 'Bahamas',
      localName: 'Bahamas',
      currency: 'BSD',
      currencySymbol: '$',
      currencyName: 'Bahamian Dollar',
      timezone: 'America/Nassau',
      timezones: ['America/Nassau'],
      locale: 'en-BS',
      flag: 'BS',
      region: 'caribbean',
    },
    {
      code: 'BB',
      name: 'Barbados',
      localName: 'Barbados',
      currency: 'BBD',
      currencySymbol: '$',
      currencyName: 'Barbadian Dollar',
      timezone: 'America/Barbados',
      timezones: ['America/Barbados'],
      locale: 'en-BB',
      flag: 'BB',
      region: 'caribbean',
    },

    // =========================================================================
    // SOUTH AMERICA
    // =========================================================================
    {
      code: 'BR',
      name: 'Brazil',
      localName: 'Brasil',
      currency: 'BRL',
      currencySymbol: 'R$',
      currencyName: 'Brazilian Real',
      timezone: 'America/Sao_Paulo',
      timezones: [
        'America/Sao_Paulo',
        'America/Manaus',
        'America/Cuiaba',
        'America/Fortaleza',
        'America/Recife',
        'America/Belem',
        'America/Rio_Branco',
        'America/Porto_Velho',
        'America/Boa_Vista',
        'America/Campo_Grande',
      ],
      locale: 'pt-BR',
      flag: 'BR',
      region: 'south_america',
    },
    {
      code: 'AR',
      name: 'Argentina',
      localName: 'Argentina',
      currency: 'ARS',
      currencySymbol: '$',
      currencyName: 'Argentine Peso',
      timezone: 'America/Argentina/Buenos_Aires',
      timezones: [
        'America/Argentina/Buenos_Aires',
        'America/Argentina/Cordoba',
        'America/Argentina/Mendoza',
      ],
      locale: 'es-AR',
      flag: 'AR',
      region: 'south_america',
    },
    {
      code: 'CO',
      name: 'Colombia',
      localName: 'Colombia',
      currency: 'COP',
      currencySymbol: '$',
      currencyName: 'Colombian Peso',
      timezone: 'America/Bogota',
      timezones: ['America/Bogota'],
      locale: 'es-CO',
      flag: 'CO',
      region: 'south_america',
    },
    {
      code: 'PE',
      name: 'Peru',
      localName: 'Perú',
      currency: 'PEN',
      currencySymbol: 'S/',
      currencyName: 'Peruvian Sol',
      timezone: 'America/Lima',
      timezones: ['America/Lima'],
      locale: 'es-PE',
      flag: 'PE',
      region: 'south_america',
    },
    {
      code: 'VE',
      name: 'Venezuela',
      localName: 'Venezuela',
      currency: 'VES',
      currencySymbol: 'Bs',
      currencyName: 'Venezuelan Bolívar',
      timezone: 'America/Caracas',
      timezones: ['America/Caracas'],
      locale: 'es-VE',
      flag: 'VE',
      region: 'south_america',
    },
    {
      code: 'CL',
      name: 'Chile',
      localName: 'Chile',
      currency: 'CLP',
      currencySymbol: '$',
      currencyName: 'Chilean Peso',
      timezone: 'America/Santiago',
      timezones: ['America/Santiago', 'Pacific/Easter'],
      locale: 'es-CL',
      flag: 'CL',
      region: 'south_america',
    },
    {
      code: 'EC',
      name: 'Ecuador',
      localName: 'Ecuador',
      currency: 'USD',
      currencySymbol: '$',
      currencyName: 'US Dollar',
      timezone: 'America/Guayaquil',
      timezones: ['America/Guayaquil', 'Pacific/Galapagos'],
      locale: 'es-EC',
      flag: 'EC',
      region: 'south_america',
    },
    {
      code: 'BO',
      name: 'Bolivia',
      localName: 'Bolivia',
      currency: 'BOB',
      currencySymbol: 'Bs',
      currencyName: 'Bolivian Boliviano',
      timezone: 'America/La_Paz',
      timezones: ['America/La_Paz'],
      locale: 'es-BO',
      flag: 'BO',
      region: 'south_america',
    },
    {
      code: 'PY',
      name: 'Paraguay',
      localName: 'Paraguay',
      currency: 'PYG',
      currencySymbol: '₲',
      currencyName: 'Paraguayan Guaraní',
      timezone: 'America/Asuncion',
      timezones: ['America/Asuncion'],
      locale: 'es-PY',
      flag: 'PY',
      region: 'south_america',
    },
    {
      code: 'UY',
      name: 'Uruguay',
      localName: 'Uruguay',
      currency: 'UYU',
      currencySymbol: '$',
      currencyName: 'Uruguayan Peso',
      timezone: 'America/Montevideo',
      timezones: ['America/Montevideo'],
      locale: 'es-UY',
      flag: 'UY',
      region: 'south_america',
    },
    {
      code: 'GY',
      name: 'Guyana',
      localName: 'Guyana',
      currency: 'GYD',
      currencySymbol: '$',
      currencyName: 'Guyanese Dollar',
      timezone: 'America/Guyana',
      timezones: ['America/Guyana'],
      locale: 'en-GY',
      flag: 'GY',
      region: 'south_america',
    },
    {
      code: 'SR',
      name: 'Suriname',
      localName: 'Suriname',
      currency: 'SRD',
      currencySymbol: '$',
      currencyName: 'Surinamese Dollar',
      timezone: 'America/Paramaribo',
      timezones: ['America/Paramaribo'],
      locale: 'nl-SR',
      flag: 'SR',
      region: 'south_america',
    },
    {
      code: 'GF',
      name: 'French Guiana',
      localName: 'Guyane française',
      currency: 'EUR',
      currencySymbol: '€',
      currencyName: 'Euro',
      timezone: 'America/Cayenne',
      timezones: ['America/Cayenne'],
      locale: 'fr-GF',
      flag: 'GF',
      region: 'south_america',
    },
  ];

  /**
   * Get all available countries
   */
  getAllCountries(): CountryInfo[] {
    return this.countries;
  }

  /**
   * Get countries grouped by region
   */
  getCountriesByRegion(): Record<string, CountryInfo[]> {
    return {
      north_america: this.countries.filter((c) => c.region === 'north_america'),
      central_america: this.countries.filter(
        (c) => c.region === 'central_america',
      ),
      caribbean: this.countries.filter((c) => c.region === 'caribbean'),
      south_america: this.countries.filter((c) => c.region === 'south_america'),
    };
  }

  /**
   * Get country information by code
   */
  getCountryByCode(code: string): CountryInfo | undefined {
    return this.countries.find(
      (c) => c.code.toUpperCase() === code.toUpperCase(),
    );
  }

  /**
   * Get timezones for a specific country
   */
  getTimezonesByCountry(countryCode: string): string[] {
    const country = this.getCountryByCode(countryCode);
    return country?.timezones || [];
  }

  /**
   * Get all unique currencies from Americas countries
   */
  getAllCurrencies(): { code: string; symbol: string; name: string }[] {
    const currencyMap = new Map<
      string,
      { code: string; symbol: string; name: string }
    >();

    for (const country of this.countries) {
      if (!currencyMap.has(country.currency)) {
        currencyMap.set(country.currency, {
          code: country.currency,
          symbol: country.currencySymbol,
          name: country.currencyName,
        });
      }
    }

    return Array.from(currencyMap.values()).sort((a, b) =>
      a.code.localeCompare(b.code),
    );
  }

  /**
   * Validate if a country code is valid
   */
  isValidCountryCode(code: string): boolean {
    return this.countries.some(
      (c) => c.code.toUpperCase() === code.toUpperCase(),
    );
  }

  /**
   * Validate if a timezone is valid for a country
   */
  isValidTimezoneForCountry(countryCode: string, timezone: string): boolean {
    const country = this.getCountryByCode(countryCode);
    if (!country) return false;
    return country.timezones.includes(timezone);
  }

  /**
   * Get default settings for a country
   */
  getDefaultSettingsForCountry(countryCode: string): {
    currency: string;
    timezone: string;
    locale: string;
  } | null {
    const country = this.getCountryByCode(countryCode);
    if (!country) return null;

    return {
      currency: country.currency,
      timezone: country.timezone,
      locale: country.locale,
    };
  }
}
