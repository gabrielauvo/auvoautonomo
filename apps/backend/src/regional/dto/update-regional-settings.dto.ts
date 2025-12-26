import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

/**
 * DTO for updating regional settings
 */
export class UpdateRegionalSettingsDto {
  @ApiPropertyOptional({
    description: 'ISO 3166-1 alpha-2 country code',
    example: 'BR',
    minLength: 2,
    maxLength: 2,
  })
  @IsOptional()
  @IsString()
  @Length(2, 2, { message: 'Country code must be exactly 2 characters' })
  country?: string;

  @ApiPropertyOptional({
    description: 'ISO 4217 currency code',
    example: 'BRL',
    minLength: 3,
    maxLength: 3,
  })
  @IsOptional()
  @IsString()
  @Length(3, 3, { message: 'Currency code must be exactly 3 characters' })
  currency?: string;

  @ApiPropertyOptional({
    description: 'IANA timezone identifier',
    example: 'America/Sao_Paulo',
  })
  @IsOptional()
  @IsString()
  timezone?: string;
}
