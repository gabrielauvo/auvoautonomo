import { IsString, IsEnum, IsOptional, Matches } from 'class-validator';
import { StripeEnvironment } from '@prisma/client';

export class ConnectStripeDto {
  @IsString()
  @Matches(/^sk_(test|live)_[a-zA-Z0-9]+$/, {
    message: 'Invalid Stripe Secret Key format. It should start with sk_test_ or sk_live_',
  })
  secretKey: string;

  @IsOptional()
  @IsString()
  @Matches(/^pk_(test|live)_[a-zA-Z0-9]+$/, {
    message: 'Invalid Stripe Publishable Key format. It should start with pk_test_ or pk_live_',
  })
  publishableKey?: string;

  @IsOptional()
  @IsString()
  @Matches(/^whsec_[a-zA-Z0-9]+$/, {
    message: 'Invalid Stripe Webhook Secret format. It should start with whsec_',
  })
  webhookSecret?: string;

  @IsEnum(StripeEnvironment)
  environment: StripeEnvironment;
}
