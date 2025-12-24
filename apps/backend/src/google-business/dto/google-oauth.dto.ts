import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InitiateOAuthDto {
  @ApiPropertyOptional({
    description: 'URL to redirect after OAuth completion',
  })
  @IsString()
  @IsOptional()
  redirectUrl?: string;
}

export class GoogleOAuthCallbackDto {
  @ApiProperty({
    description: 'Authorization code from Google OAuth',
  })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({
    description: 'State parameter for CSRF protection',
  })
  @IsString()
  @IsOptional()
  state?: string;
}

export class SelectLocationDto {
  @ApiProperty({
    description: 'Google Business location ID',
    example: 'locations/12345678901234567890',
  })
  @IsString()
  @IsNotEmpty()
  locationId: string;
}

export class GoogleLocationDto {
  @ApiProperty()
  locationId: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  address?: string;

  @ApiPropertyOptional()
  phoneNumber?: string;
}

export class GoogleIntegrationStatusDto {
  @ApiProperty({
    enum: ['PENDING', 'CONNECTED', 'ERROR', 'DISCONNECTED', 'REVOKED'],
  })
  status: string;

  @ApiPropertyOptional()
  googleLocationName?: string;

  @ApiPropertyOptional()
  lastSyncAt?: Date;

  @ApiPropertyOptional()
  lastSyncError?: string;

  @ApiProperty()
  isConnected: boolean;
}

export class OAuthUrlResponseDto {
  @ApiProperty({
    description: 'URL to redirect user for Google OAuth consent',
  })
  url: string;

  @ApiProperty({
    description: 'State parameter for CSRF protection',
  })
  state: string;
}

export class LocationListResponseDto {
  @ApiProperty({
    type: [GoogleLocationDto],
    description: 'List of Google Business locations available for the account',
  })
  locations: GoogleLocationDto[];
}
