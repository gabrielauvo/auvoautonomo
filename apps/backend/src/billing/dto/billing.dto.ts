import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export enum BillingTypeDto {
  BOLETO = 'BOLETO',
  CREDIT_CARD = 'CREDIT_CARD',
  PIX = 'PIX',
}

export enum BillingPeriodDto {
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}

export class UpgradeToPlanDto {
  @IsEnum(BillingTypeDto)
  @IsNotEmpty()
  billingType: BillingTypeDto;

  @IsEnum(BillingPeriodDto)
  @IsNotEmpty()
  billingPeriod: BillingPeriodDto;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{11}$|^\d{14}$/, {
    message: 'cpfCnpj must be 11 digits (CPF) or 14 digits (CNPJ)',
  })
  cpfCnpj: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  postalCode?: string;
}

export class CancelSubscriptionDto {
  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  cancelImmediately?: boolean;
}
