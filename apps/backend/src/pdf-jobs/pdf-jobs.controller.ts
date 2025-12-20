import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PdfJobsService } from './pdf-jobs.service';
import { RequestPdfDto } from './dto/request-pdf.dto';
import { PdfEntityType } from '@prisma/client';

@ApiTags('PDF Jobs')
@ApiBearerAuth('JWT-auth')
@Controller()
@UseGuards(JwtAuthGuard)
export class PdfJobsController {
  constructor(private pdfJobsService: PdfJobsService) {}

  @Post('quotes/:id/generate-pdf-async')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Solicitar geração assíncrona de PDF do orçamento' })
  @ApiResponse({ status: 202, description: 'Job criado com sucesso' })
  async requestQuotePdf(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) quoteId: string,
    @Body() dto?: RequestPdfDto,
  ) {
    return this.pdfJobsService.requestQuotePdf(userId, quoteId, dto);
  }

  @Post('work-orders/:id/generate-pdf-async')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Solicitar geração assíncrona de PDF da OS' })
  @ApiResponse({ status: 202, description: 'Job criado com sucesso' })
  async requestWorkOrderPdf(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) workOrderId: string,
    @Body() dto?: RequestPdfDto,
  ) {
    return this.pdfJobsService.requestWorkOrderPdf(userId, workOrderId, dto);
  }

  @Post('invoices/:id/generate-pdf-async')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Solicitar geração assíncrona de PDF da fatura' })
  @ApiResponse({ status: 202, description: 'Job criado com sucesso' })
  async requestInvoicePdf(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) invoiceId: string,
    @Body() dto?: RequestPdfDto,
  ) {
    return this.pdfJobsService.requestInvoicePdf(userId, invoiceId, dto);
  }

  @Get('pdf-jobs/:id')
  @ApiOperation({ summary: 'Verificar status do job de PDF' })
  @ApiResponse({ status: 200, description: 'Status do job' })
  async getJobStatus(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) jobId: string,
  ) {
    return this.pdfJobsService.getJobStatus(userId, jobId);
  }

  @Delete('pdf-jobs/:id')
  @ApiOperation({ summary: 'Cancelar job de PDF pendente' })
  @ApiResponse({ status: 200, description: 'Job cancelado com sucesso' })
  async cancelJob(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) jobId: string,
  ) {
    return this.pdfJobsService.cancelJob(userId, jobId);
  }

  @Get('pdf-jobs')
  @ApiOperation({ summary: 'Listar jobs de PDF do usuário' })
  @ApiQuery({ name: 'entityType', required: false, enum: PdfEntityType })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Lista de jobs' })
  async listJobs(
    @CurrentUser('id') userId: string,
    @Query('entityType') entityType?: PdfEntityType,
    @Query('limit') limit?: number,
  ) {
    return this.pdfJobsService.listUserJobs(userId, {
      entityType,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('quotes/:id/pdf-status')
  @ApiOperation({ summary: 'Verificar último PDF do orçamento' })
  async getQuotePdfStatus(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) quoteId: string,
  ) {
    return this.pdfJobsService.getLatestJobForEntity(
      userId,
      PdfEntityType.QUOTE,
      quoteId,
    );
  }

  @Get('work-orders/:id/pdf-status')
  @ApiOperation({ summary: 'Verificar último PDF da OS' })
  async getWorkOrderPdfStatus(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) workOrderId: string,
  ) {
    return this.pdfJobsService.getLatestJobForEntity(
      userId,
      PdfEntityType.WORK_ORDER,
      workOrderId,
    );
  }

  @Get('invoices/:id/pdf-status')
  @ApiOperation({ summary: 'Verificar último PDF da fatura' })
  async getInvoicePdfStatus(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) invoiceId: string,
  ) {
    return this.pdfJobsService.getLatestJobForEntity(
      userId,
      PdfEntityType.INVOICE,
      invoiceId,
    );
  }
}
