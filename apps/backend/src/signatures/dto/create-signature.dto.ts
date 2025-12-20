import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateSignatureDto {
  /**
   * Base64 encoded signature image
   * Can include data URL prefix (data:image/png;base64,...)
   */
  @IsString()
  @IsNotEmpty()
  imageBase64: string;

  /**
   * Name of the person signing
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  signerName: string;

  /**
   * Document number (CPF/CNPJ) - optional
   */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  signerDocument?: string;

  /**
   * Role of the signer (e.g., "Cliente", "Responsável Técnico")
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  signerRole?: string;

  /**
   * Local ID for offline sync idempotency
   */
  @IsOptional()
  @IsString()
  localId?: string;
}
