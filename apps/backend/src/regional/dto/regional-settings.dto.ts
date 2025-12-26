import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CountryInfo } from '../regional-data.service';

/**
 * Response DTO for regional settings
 */
export class RegionalSettingsDto {
  @ApiProperty({
    description: 'ISO 3166-1 alpha-2 country code',
    example: 'BR',
  })
  country: string;

  @ApiProperty({
    description: 'ISO 4217 currency code',
    example: 'BRL',
  })
  currency: string;

  @ApiProperty({
    description: 'IANA timezone identifier',
    example: 'America/Sao_Paulo',
  })
  timezone: string;

  @ApiPropertyOptional({
    description: 'Full country information',
  })
  countryInfo?: CountryInfo;
}

/**
 * Response DTO for country list
 */
export class CountryListItemDto {
  @ApiProperty({
    description: 'ISO 3166-1 alpha-2 country code',
    example: 'BR',
  })
  code: string;

  @ApiProperty({
    description: 'Country name in English',
    example: 'Brazil',
  })
  name: string;

  @ApiProperty({
    description: 'Country name in native language',
    example: 'Brasil',
  })
  localName: string;

  @ApiProperty({
    description: 'Default currency for this country',
    example: 'BRL',
  })
  currency: string;

  @ApiProperty({
    description: 'Currency symbol',
    example: 'R$',
  })
  currencySymbol: string;

  @ApiProperty({
    description: 'Default timezone for this country',
    example: 'America/Sao_Paulo',
  })
  timezone: string;

  @ApiProperty({
    description: 'Country code for flag emoji',
    example: 'BR',
  })
  flag: string;

  @ApiProperty({
    description: 'Region of the Americas',
    example: 'south_america',
    enum: ['north_america', 'central_america', 'caribbean', 'south_america'],
  })
  region: string;
}

/**
 * Response DTO for countries grouped by region
 */
export class CountriesByRegionDto {
  @ApiProperty({
    description: 'North American countries',
    type: [CountryListItemDto],
  })
  north_america: CountryListItemDto[];

  @ApiProperty({
    description: 'Central American countries',
    type: [CountryListItemDto],
  })
  central_america: CountryListItemDto[];

  @ApiProperty({
    description: 'Caribbean countries',
    type: [CountryListItemDto],
  })
  caribbean: CountryListItemDto[];

  @ApiProperty({
    description: 'South American countries',
    type: [CountryListItemDto],
  })
  south_america: CountryListItemDto[];
}

/**
 * Response DTO for timezone list
 */
export class TimezoneListDto {
  @ApiProperty({
    description: 'Country code',
    example: 'BR',
  })
  countryCode: string;

  @ApiProperty({
    description: 'Available timezones for this country',
    example: ['America/Sao_Paulo', 'America/Manaus', 'America/Fortaleza'],
    type: [String],
  })
  timezones: string[];
}

/**
 * Response DTO for currency list
 */
export class CurrencyListItemDto {
  @ApiProperty({
    description: 'ISO 4217 currency code',
    example: 'BRL',
  })
  code: string;

  @ApiProperty({
    description: 'Currency symbol',
    example: 'R$',
  })
  symbol: string;

  @ApiProperty({
    description: 'Currency name',
    example: 'Brazilian Real',
  })
  name: string;
}
