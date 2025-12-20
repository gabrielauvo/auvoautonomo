import { IsString, IsEnum, IsNotEmpty } from 'class-validator';
import { AsaasEnvironment } from '@prisma/client';

export class ConnectAsaasDto {
  @IsString()
  @IsNotEmpty()
  apiKey: string;

  @IsEnum(AsaasEnvironment)
  @IsNotEmpty()
  environment: AsaasEnvironment;
}
