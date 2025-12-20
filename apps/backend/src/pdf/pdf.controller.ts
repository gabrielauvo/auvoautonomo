import {
  Controller,
  Post,
  Param,
  UseGuards,
  ParseUUIDPipe,
  Res,
  Query,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PdfService } from './pdf.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class PdfController {
  private readonly logger = new Logger(PdfController.name);

  constructor(private readonly pdfService: PdfService) {}

  /**
   * Generate PDF for a Quote
   * POST /quotes/:id/generate-pdf
   */
  @Post('quotes/:id/generate-pdf')
  async generateQuotePdf(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) quoteId: string,
    @Query('download') download: string | undefined,
    @Res() res: Response,
  ) {
    this.logger.log(`[PDF] generateQuotePdf called: quoteId=${quoteId}, userId=${userId}, download=${download}`);
    try {
      const result = await this.pdfService.generateQuotePdf(userId, quoteId);
      this.logger.log(`[PDF] PDF generated successfully: quoteId=${quoteId}, attachmentId=${result.attachmentId}, bufferSize=${result.buffer?.length}`);

      // Validate buffer before proceeding
      if (!result?.buffer || result.buffer.length === 0) {
        this.logger.error(`[PDF] ERROR: Buffer is null or empty!`);
        throw new BadRequestException('PDF generation failed: empty buffer');
      }

      // If download query param is set, return the file directly
      if (download === 'true' && res) {
        this.logger.log(`[PDF] Returning PDF as download stream`);
        res.set({
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="orcamento_${quoteId.substring(0, 8).toUpperCase()}.pdf"`,
          'Content-Length': result.buffer.length.toString(),
        });
        res.end(result.buffer);
        return;
      }

      // Otherwise return attachment info as JSON
      this.logger.log(`[PDF] Returning attachment info`);
      res.json({
        attachmentId: result.attachmentId,
        message: 'PDF generated successfully',
      });
    } catch (error: any) {
      this.logger.error(`[PDF] ERROR generating quote PDF for ${quoteId}: ${error.message}`);
      this.logger.error(`[PDF] Stack trace: ${error.stack}`);

      // Send proper error response
      if (!res.headersSent) {
        res.status(400).json({
          statusCode: 400,
          message: error.message || 'Erro ao gerar PDF do orçamento',
          error: 'Bad Request',
        });
      }
    }
  }

  /**
   * Generate PDF for a Work Order
   * POST /work-orders/:id/generate-pdf
   */
  @Post('work-orders/:id/generate-pdf')
  async generateWorkOrderPdf(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) workOrderId: string,
    @Query('download') download: string | undefined,
    @Res() res: Response,
  ) {
    this.logger.log(`[PDF] generateWorkOrderPdf called: workOrderId=${workOrderId}, userId=${userId}, download=${download}`);
    try {
      const result = await this.pdfService.generateWorkOrderPdf(userId, workOrderId);
      this.logger.log(`[PDF] PDF generated successfully: workOrderId=${workOrderId}, attachmentId=${result.attachmentId}, bufferSize=${result.buffer?.length}`);

      // Validate buffer before proceeding
      if (!result?.buffer || result.buffer.length === 0) {
        this.logger.error(`[PDF] ERROR: Buffer is null or empty!`);
        throw new BadRequestException('PDF generation failed: empty buffer');
      }

      // If download query param is set, return the file directly
      if (download === 'true' && res) {
        this.logger.log(`[PDF] Returning PDF as download stream`);
        res.set({
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="os_${workOrderId.substring(0, 8).toUpperCase()}.pdf"`,
          'Content-Length': result.buffer.length.toString(),
        });
        res.end(result.buffer);
        return;
      }

      // Otherwise return attachment info as JSON
      this.logger.log(`[PDF] Returning attachment info`);
      res.json({
        attachmentId: result.attachmentId,
        message: 'PDF generated successfully',
      });
    } catch (error: any) {
      this.logger.error(`[PDF] ERROR generating work order PDF for ${workOrderId}: ${error.message}`);
      this.logger.error(`[PDF] Stack trace: ${error.stack}`);

      // Send proper error response
      if (!res.headersSent) {
        res.status(400).json({
          statusCode: 400,
          message: error.message || 'Erro ao gerar PDF da ordem de serviço',
          error: 'Bad Request',
        });
      }
    }
  }

  /**
   * Generate PDF for an Invoice/Charge
   * POST /invoices/:id/generate-pdf
   */
  @Post('invoices/:id/generate-pdf')
  async generateInvoicePdf(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) invoiceId: string,
    @Query('download') download: string | undefined,
    @Res() res: Response,
  ) {
    this.logger.log(`[PDF] generateInvoicePdf called: invoiceId=${invoiceId}, userId=${userId}, download=${download}`);
    try {
      const result = await this.pdfService.generateInvoicePdf(userId, invoiceId);
      this.logger.log(`[PDF] PDF generated successfully: invoiceId=${invoiceId}, attachmentId=${result.attachmentId}, bufferSize=${result.buffer?.length}`);

      // Validate buffer before proceeding
      if (!result?.buffer || result.buffer.length === 0) {
        this.logger.error(`[PDF] ERROR: Buffer is null or empty!`);
        throw new BadRequestException('PDF generation failed: empty buffer');
      }

      // If download query param is set, return the file directly
      if (download === 'true' && res) {
        this.logger.log(`[PDF] Returning PDF as download stream`);
        res.set({
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="fatura_${invoiceId.substring(0, 8).toUpperCase()}.pdf"`,
          'Content-Length': result.buffer.length.toString(),
        });
        res.end(result.buffer);
        return;
      }

      // Otherwise return attachment info as JSON
      this.logger.log(`[PDF] Returning attachment info`);
      res.json({
        attachmentId: result.attachmentId,
        message: 'PDF generated successfully',
      });
    } catch (error: any) {
      this.logger.error(`[PDF] ERROR generating invoice PDF for ${invoiceId}: ${error.message}`);
      this.logger.error(`[PDF] Stack trace: ${error.stack}`);

      // Send proper error response
      if (!res.headersSent) {
        res.status(400).json({
          statusCode: 400,
          message: error.message || 'Erro ao gerar PDF da fatura',
          error: 'Bad Request',
        });
      }
    }
  }
}
