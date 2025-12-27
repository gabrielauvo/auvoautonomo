import { IsString, IsOptional, IsEnum, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum Platform {
  IOS = 'IOS',
  ANDROID = 'ANDROID',
  WEB = 'WEB',
}

export class AttachReferralDto {
  @ApiPropertyOptional({ description: 'Referral code (e.g., GABRIEL-7K2F)' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: 'Click ID from referral link' })
  @IsOptional()
  @IsString()
  clickId?: string;

  @ApiPropertyOptional({ description: 'Hashed device ID' })
  @IsOptional()
  @IsString()
  deviceIdHash?: string;

  @ApiProperty({ description: 'Platform', enum: Platform })
  @IsEnum(Platform)
  platform: Platform;

  @ApiPropertyOptional({ description: 'Install referrer payload from Play Store (Android only)' })
  @IsOptional()
  installReferrer?: Record<string, any>;
}

export class ResolveDeferredDto {
  @ApiProperty({ description: 'Fingerprint hash for iOS deferred deep link' })
  @IsString()
  fingerprintHash: string;

  @ApiProperty({ description: 'Hashed device ID' })
  @IsString()
  deviceIdHash: string;
}

export class SetCustomCodeDto {
  @ApiProperty({
    description: 'Custom referral code (4-20 alphanumeric characters)',
    example: 'GABRIEL'
  })
  @IsString()
  @MinLength(4)
  @MaxLength(20)
  @Matches(/^[A-Za-z0-9-]+$/, {
    message: 'Custom code can only contain letters, numbers and hyphens'
  })
  customCode: string;
}

export class ValidateCodeDto {
  @ApiProperty({ description: 'Referral code to validate' })
  @IsString()
  code: string;
}

// Response DTOs
export class ReferralCodeResponse {
  code: string;
  customCode?: string | null;
  link: string;
}

export class ReferralStatsResponse {
  totalClicks: number;
  totalSignups: number;
  totalPaid: number;
  monthsEarned: number;
  pendingMonths: number;
}

export class ReferralProgressResponse {
  current: number;
  target: number;
  reward: string;
  percentComplete: number;
}

export class RecentReferralResponse {
  id: string;
  name: string;
  status: string;
  date: Date;
}

export class RewardHistoryResponse {
  id: string;
  months: number;
  reason: string;
  date: Date;
  status: string;
}

export class ReferralStatusResponse {
  code: string;
  customCode?: string;
  link: string;
  stats: ReferralStatsResponse;
  progress: ReferralProgressResponse;
  recentReferrals: RecentReferralResponse[];
  rewardsHistory: RewardHistoryResponse[];
}

export class AttachReferralResponse {
  success: boolean;
  referrerName?: string;
  attributionMethod?: string;
  message?: string;
}

export class ResolveDeferredResponse {
  matched: boolean;
  code?: string;
  referrerName?: string;
}

export class ValidateCodeResponse {
  valid: boolean;
  referrerFirstName?: string;
  locale?: string;
}
