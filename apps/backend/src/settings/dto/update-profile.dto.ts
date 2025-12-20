import { IsOptional, IsString, MinLength, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({ description: 'User full name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Language code (e.g., pt-BR)' })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({ description: 'Timezone (e.g., America/Sao_Paulo)' })
  @IsOptional()
  @IsString()
  timezone?: string;
}

export class ChangePasswordDto {
  @ApiPropertyOptional({ description: 'Current password' })
  @IsString()
  @MinLength(1, { message: 'Informe a senha atual' })
  currentPassword: string;

  @ApiPropertyOptional({ description: 'New password' })
  @IsString()
  @MinLength(8, { message: 'A nova senha deve ter pelo menos 8 caracteres' })
  newPassword: string;

  @ApiPropertyOptional({ description: 'Confirm new password' })
  @IsString()
  @MinLength(8)
  confirmPassword: string;
}
