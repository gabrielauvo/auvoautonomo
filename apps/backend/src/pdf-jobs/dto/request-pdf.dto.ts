import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsInt, Min, Max, IsString } from 'class-validator';

export class RequestPdfDto {
  @ApiProperty({
    description: 'Prioridade do job (0 = normal, maior = mais prioritário)',
    example: 0,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  priority?: number;

  @ApiProperty({
    description: 'Incluir assinaturas no PDF',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  includeSignatures?: boolean;

  @ApiProperty({
    description: 'Incluir checklists no PDF',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  includeChecklists?: boolean;

  @ApiProperty({
    description: 'Incluir fotos no PDF',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  includePhotos?: boolean;

  @ApiProperty({
    description: 'Cabeçalho customizado',
    example: 'Nome da Empresa',
    required: false,
  })
  @IsOptional()
  @IsString()
  customHeader?: string;

  @ApiProperty({
    description: 'Marca d\'água',
    example: 'CONFIDENCIAL',
    required: false,
  })
  @IsOptional()
  @IsString()
  watermark?: string;
}
