import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ClientImportService } from './client-import.service';
import {
  ImportJobResponseDto,
  UploadResponseDto,
  ImportJobListResponseDto,
} from './dto/import-clients.dto';

// Configuração do Multer para upload
const multerOptions = {
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
};

@ApiTags('client-import')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('client-import')
export class ClientImportController {
  constructor(private readonly clientImportService: ClientImportService) {}

  @Get('template')
  @ApiOperation({ summary: 'Baixar arquivo modelo Excel para importação' })
  @ApiResponse({
    status: 200,
    description: 'Arquivo modelo Excel',
    content: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {},
    },
  })
  async getTemplate(@Res() res: Response): Promise<void> {
    const buffer = await this.clientImportService.getTemplate();

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition':
        'attachment; filename="clientes-modelo.xlsx"',
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }

  @Post('upload')
  @ApiOperation({ summary: 'Upload de arquivo Excel para importação de clientes' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Arquivo Excel (.xlsx, .xls) ou CSV com dados de clientes',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 201, type: UploadResponseDto })
  @ApiResponse({ status: 400, description: 'Arquivo inválido ou erro de validação' })
  @ApiResponse({ status: 403, description: 'Recurso exclusivo do plano PRO' })
  @UseInterceptors(FileInterceptor('file', multerOptions))
  async uploadFile(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UploadResponseDto> {
    // Verificar acesso PRO
    await this.clientImportService.checkProAccess(userId);

    if (!file) {
      throw new Error('Nenhum arquivo enviado');
    }

    return this.clientImportService.startImport(userId, file);
  }

  @Get('jobs')
  @ApiOperation({ summary: 'Listar jobs de importação do usuário' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({ status: 200, type: ImportJobListResponseDto })
  async listJobs(
    @CurrentUser('id') userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<ImportJobListResponseDto> {
    return this.clientImportService.listJobs(userId, page, limit);
  }

  @Get('jobs/:id')
  @ApiOperation({ summary: 'Obter detalhes de um job de importação' })
  @ApiParam({ name: 'id', description: 'ID do job de importação' })
  @ApiResponse({ status: 200, type: ImportJobResponseDto })
  @ApiResponse({ status: 404, description: 'Job não encontrado' })
  async getJob(
    @CurrentUser('id') userId: string,
    @Param('id') jobId: string,
  ): Promise<ImportJobResponseDto> {
    return this.clientImportService.getJob(userId, jobId);
  }

  @Delete('jobs/:id')
  @ApiOperation({ summary: 'Cancelar um job de importação pendente' })
  @ApiParam({ name: 'id', description: 'ID do job de importação' })
  @ApiResponse({ status: 200, description: 'Job cancelado com sucesso' })
  @ApiResponse({ status: 400, description: 'Job não pode ser cancelado' })
  @ApiResponse({ status: 404, description: 'Job não encontrado' })
  async cancelJob(
    @CurrentUser('id') userId: string,
    @Param('id') jobId: string,
  ): Promise<{ message: string }> {
    await this.clientImportService.cancelJob(userId, jobId);
    return { message: 'Job cancelado com sucesso' };
  }
}
