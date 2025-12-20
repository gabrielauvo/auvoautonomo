import { IsBoolean, IsString, IsOptional, IsIn } from 'class-validator';

export class UpdateQuoteTemplateDto {
  @IsOptional()
  @IsBoolean()
  showLogo?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['left', 'center', 'right'])
  logoPosition?: string;

  @IsOptional()
  @IsString()
  primaryColor?: string;

  @IsOptional()
  @IsString()
  secondaryColor?: string;

  @IsOptional()
  @IsString()
  headerText?: string | null;

  @IsOptional()
  @IsString()
  footerText?: string;

  @IsOptional()
  @IsString()
  defaultMessage?: string;

  @IsOptional()
  @IsString()
  termsAndConditions?: string | null;

  @IsOptional()
  @IsBoolean()
  showSignature?: boolean;
}

export class UpdateWorkOrderTemplateDto {
  @IsOptional()
  @IsBoolean()
  showLogo?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['left', 'center', 'right'])
  logoPosition?: string;

  @IsOptional()
  @IsString()
  primaryColor?: string;

  @IsOptional()
  @IsString()
  @IsIn(['compact', 'detailed'])
  layout?: string;

  @IsOptional()
  @IsBoolean()
  showChecklist?: boolean;

  @IsOptional()
  @IsString()
  footerText?: string | null;

  @IsOptional()
  @IsBoolean()
  showSignatureField?: boolean;

  @IsOptional()
  @IsString()
  signatureLabel?: string;
}

export class UpdateChargeTemplateDto {
  @IsOptional()
  @IsString()
  whatsappMessage?: string;

  @IsOptional()
  @IsString()
  emailSubject?: string;

  @IsOptional()
  @IsString()
  emailBody?: string | null;

  @IsOptional()
  @IsString()
  reminderMessage?: string;
}
