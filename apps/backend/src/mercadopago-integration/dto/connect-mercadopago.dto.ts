import { IsString, IsEnum, IsOptional, Matches, IsIn } from 'class-validator';
import { MercadoPagoEnvironment } from '@prisma/client';

export class ConnectMercadoPagoDto {
  @IsString()
  @Matches(/^(APP_USR-|TEST-)[a-zA-Z0-9-]+$/, {
    message: 'Invalid Mercado Pago Access Token format. It should start with APP_USR- or TEST-',
  })
  accessToken: string;

  @IsOptional()
  @IsString()
  @Matches(/^(APP_USR-|TEST-)[a-zA-Z0-9-]+$/, {
    message: 'Invalid Mercado Pago Public Key format',
  })
  publicKey?: string;

  @IsOptional()
  @IsString()
  webhookSecret?: string;

  @IsEnum(MercadoPagoEnvironment)
  environment: MercadoPagoEnvironment;

  @IsOptional()
  @IsString()
  @IsIn(['AR', 'CL', 'CO', 'PE', 'UY', 'MX', 'BR'], {
    message: 'Country must be one of: AR, CL, CO, PE, UY, MX, BR',
  })
  country?: string;
}
