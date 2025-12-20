import { IsString, IsEnum, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum DevicePlatformDto {
  IOS = 'IOS',
  ANDROID = 'ANDROID',
}

export class RegisterDeviceDto {
  @ApiProperty({
    description: 'Expo Push Token for the device',
    example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
  })
  @IsString()
  @IsNotEmpty()
  expoPushToken: string;

  @ApiProperty({
    description: 'Device platform',
    enum: DevicePlatformDto,
    example: DevicePlatformDto.ANDROID,
  })
  @IsEnum(DevicePlatformDto)
  platform: DevicePlatformDto;

  @ApiPropertyOptional({
    description: 'App version',
    example: '1.0.0',
  })
  @IsString()
  @IsOptional()
  appVersion?: string;

  @ApiPropertyOptional({
    description: 'Device model',
    example: 'iPhone 15 Pro',
  })
  @IsString()
  @IsOptional()
  deviceModel?: string;

  @ApiPropertyOptional({
    description: 'Operating system version',
    example: '17.2',
  })
  @IsString()
  @IsOptional()
  osVersion?: string;
}
