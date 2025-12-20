import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  IsInt,
  Min,
  Max,
} from 'class-validator';

export enum AttachmentType {
  PHOTO = 'PHOTO',
  DOCUMENT = 'DOCUMENT',
  SIGNATURE = 'SIGNATURE',
}

export class UploadFileDto {
  @IsEnum(AttachmentType)
  type: AttachmentType;

  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsUUID()
  quoteId?: string;

  @IsOptional()
  @IsUUID()
  workOrderId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;
}

export class CreatePublicLinkDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  expiresInDays?: number;
}
