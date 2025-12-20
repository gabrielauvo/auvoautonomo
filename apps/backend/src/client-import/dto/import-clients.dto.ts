import { ApiProperty } from '@nestjs/swagger';

export class ImportJobResponseDto {
  @ApiProperty({ description: 'ID do job de importação' })
  id: string;

  @ApiProperty({ description: 'Status do job' })
  status: string;

  @ApiProperty({ description: 'Nome do arquivo' })
  fileName: string;

  @ApiProperty({ description: 'Tamanho do arquivo em bytes' })
  fileSize: number;

  @ApiProperty({ description: 'Total de linhas no arquivo' })
  totalRows: number;

  @ApiProperty({ description: 'Linhas processadas' })
  processedRows: number;

  @ApiProperty({ description: 'Linhas importadas com sucesso' })
  successCount: number;

  @ApiProperty({ description: 'Linhas com erro' })
  errorCount: number;

  @ApiProperty({ description: 'Detalhes dos erros', required: false })
  errorDetails?: ErrorDetail[];

  @ApiProperty({ description: 'Data de criação' })
  createdAt: Date;

  @ApiProperty({ description: 'Data de início do processamento', required: false })
  startedAt?: Date;

  @ApiProperty({ description: 'Data de conclusão', required: false })
  completedAt?: Date;
}

export class ErrorDetail {
  @ApiProperty({ description: 'Número da linha com erro' })
  row: number;

  @ApiProperty({ description: 'Campo com erro' })
  field: string;

  @ApiProperty({ description: 'Valor que causou o erro' })
  value: string;

  @ApiProperty({ description: 'Mensagem de erro' })
  message: string;
}

export class UploadResponseDto {
  @ApiProperty({ description: 'ID do job criado' })
  jobId: string;

  @ApiProperty({ description: 'Status inicial' })
  status: string;

  @ApiProperty({ description: 'Total de linhas detectadas' })
  totalRows: number;

  @ApiProperty({ description: 'Mensagem' })
  message: string;
}

export class ImportJobListResponseDto {
  @ApiProperty({ type: [ImportJobResponseDto] })
  data: ImportJobResponseDto[];

  @ApiProperty({ description: 'Total de registros' })
  total: number;
}
