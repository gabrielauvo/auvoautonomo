import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsUrl, IsOptional, IsBoolean, MaxLength } from 'class-validator';
import { AttributionLinkType } from '@prisma/client';

export class CreateAttributionLinkDto {
  @ApiProperty({ enum: AttributionLinkType })
  @IsEnum(AttributionLinkType)
  type: AttributionLinkType;

  @ApiProperty({
    description: 'Target URL (WhatsApp number or website URL)',
    example: 'https://wa.me/5511999999999',
  })
  @IsString()
  @MaxLength(500)
  targetUrl: string;

  @ApiPropertyOptional({
    description: 'Custom slug (will be auto-generated if not provided)',
    example: 'meu-negocio',
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  customSlug?: string;
}

export class UpdateAttributionLinkDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(500)
  targetUrl?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class AttributionLinkDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  slug: string;

  @ApiProperty({ enum: AttributionLinkType })
  type: AttributionLinkType;

  @ApiProperty()
  targetUrl: string;

  @ApiProperty()
  clickCount: number;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ description: 'Full tracking URL' })
  trackingUrl: string;
}

export class TrackClickQueryDto {
  @ApiPropertyOptional({ description: 'UTM source parameter' })
  @IsString()
  @IsOptional()
  utm_source?: string;

  @ApiPropertyOptional({ description: 'UTM medium parameter' })
  @IsString()
  @IsOptional()
  utm_medium?: string;

  @ApiPropertyOptional({ description: 'UTM campaign parameter' })
  @IsString()
  @IsOptional()
  utm_campaign?: string;
}

export class AttributionLinkStatsDto {
  @ApiProperty()
  totalClicks: number;

  @ApiProperty()
  clicksToday: number;

  @ApiProperty()
  clicksThisWeek: number;

  @ApiProperty()
  clicksThisMonth: number;

  @ApiProperty({ type: [Object] })
  dailyClicks: Array<{
    date: string;
    count: number;
  }>;
}
