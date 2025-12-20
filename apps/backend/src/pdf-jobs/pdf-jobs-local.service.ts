import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PdfService } from '../pdf/pdf.service';
import { PdfEntityType, PdfJobStatus } from '@prisma/client';
import { RequestPdfDto } from './dto/request-pdf.dto';

/**
 * Local PDF Jobs Service - Processes PDFs synchronously without Redis
 * Use this for development/testing when Redis is not available
 */
@Injectable()
export class PdfJobsLocalService {
  private readonly logger = new Logger(PdfJobsLocalService.name);

  constructor(
    private prisma: PrismaService,
    private pdfService: PdfService,
  ) {}

  async requestQuotePdf(userId: string, quoteId: string, options?: RequestPdfDto) {
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, userId },
    });
    if (!quote) {
      throw new NotFoundException(`Orçamento ${quoteId} não encontrado`);
    }

    return this.processLocalPdf(userId, PdfEntityType.QUOTE, quoteId, options);
  }

  async requestWorkOrderPdf(userId: string, workOrderId: string, options?: RequestPdfDto) {
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, userId },
    });
    if (!workOrder) {
      throw new NotFoundException(`Ordem de Serviço ${workOrderId} não encontrada`);
    }

    return this.processLocalPdf(userId, PdfEntityType.WORK_ORDER, workOrderId, options);
  }

  async requestInvoicePdf(userId: string, invoiceId: string, options?: RequestPdfDto) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, userId },
    });
    if (!invoice) {
      throw new NotFoundException(`Fatura ${invoiceId} não encontrada`);
    }

    return this.processLocalPdf(userId, PdfEntityType.INVOICE, invoiceId, options);
  }

  private async processLocalPdf(
    userId: string,
    entityType: PdfEntityType,
    entityId: string,
    options?: RequestPdfDto,
  ) {
    const startTime = Date.now();

    // Create job record
    const pdfJob = await this.prisma.pdfJob.create({
      data: {
        userId,
        entityType,
        entityId,
        status: PdfJobStatus.PROCESSING,
        priority: options?.priority || 0,
        metadata: options ? JSON.parse(JSON.stringify(options)) : {},
        startedAt: new Date(),
      },
    });

    this.logger.log(`Processing PDF locally: ${entityType}:${entityId} (Job: ${pdfJob.id})`);

    try {
      // Generate PDF based on entity type - PdfService already creates the attachment
      let result: { attachmentId: string; buffer: Buffer };

      switch (entityType) {
        case PdfEntityType.QUOTE:
          result = await this.pdfService.generateQuotePdf(userId, entityId);
          break;
        case PdfEntityType.WORK_ORDER:
          result = await this.pdfService.generateWorkOrderPdf(userId, entityId);
          break;
        case PdfEntityType.INVOICE:
          result = await this.generateInvoicePdf(userId, entityId);
          break;
      }

      // Create public link for the attachment
      const publicLink = await this.prisma.publicLink.create({
        data: {
          attachmentId: result.attachmentId,
          token: this.generateToken(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });

      const processingTime = Date.now() - startTime;

      // Update job as completed
      const completedJob = await this.prisma.pdfJob.update({
        where: { id: pdfJob.id },
        data: {
          status: PdfJobStatus.COMPLETED,
          attachmentId: result.attachmentId,
          processingTime,
          fileSize: result.buffer.length,
          completedAt: new Date(),
        },
      });

      this.logger.log(`PDF generated successfully: ${pdfJob.id} (${processingTime}ms)`);

      return this.formatJobResponse({
        ...completedJob,
        attachment: {
          id: result.attachmentId,
          publicLinks: [publicLink],
        },
      });
    } catch (error) {
      // Update job as failed
      await this.prisma.pdfJob.update({
        where: { id: pdfJob.id },
        data: {
          status: PdfJobStatus.FAILED,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          failedAt: new Date(),
        },
      });

      this.logger.error(`PDF generation failed: ${pdfJob.id}`, error);
      throw error;
    }
  }

  private async generateInvoicePdf(
    userId: string,
    invoiceId: string,
  ): Promise<{ attachmentId: string; buffer: Buffer }> {
    // Get invoice with related data
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, userId },
      include: {
        workOrder: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Fatura ${invoiceId} não encontrada`);
    }

    // Use work order PDF as base for invoice
    if (invoice.workOrderId) {
      return this.pdfService.generateWorkOrderPdf(userId, invoice.workOrderId);
    }

    throw new Error('Invoice must be associated with a work order');
  }

  async getJobStatus(userId: string, jobId: string) {
    const job = await this.prisma.pdfJob.findFirst({
      where: { id: jobId, userId },
      include: {
        attachment: {
          select: {
            id: true,
            storagePath: true,
            fileSize: true,
            publicLinks: {
              select: { id: true, token: true, expiresAt: true },
              where: {
                OR: [
                  { expiresAt: null },
                  { expiresAt: { gt: new Date() } },
                ],
              },
              take: 1,
            },
          },
        },
      },
    });

    if (!job) {
      throw new NotFoundException(`Job ${jobId} não encontrado`);
    }

    return this.formatJobResponse(job);
  }

  async cancelJob(userId: string, jobId: string) {
    const job = await this.prisma.pdfJob.findFirst({
      where: { id: jobId, userId, status: PdfJobStatus.PENDING },
    });

    if (!job) {
      throw new NotFoundException(`Job pendente ${jobId} não encontrado`);
    }

    await this.prisma.pdfJob.update({
      where: { id: jobId },
      data: { status: PdfJobStatus.CANCELLED },
    });

    return { success: true };
  }

  async listUserJobs(userId: string, params?: { entityType?: PdfEntityType; limit?: number }) {
    const jobs = await this.prisma.pdfJob.findMany({
      where: {
        userId,
        ...(params?.entityType && { entityType: params.entityType }),
      },
      orderBy: { requestedAt: 'desc' },
      take: params?.limit || 50,
      include: {
        attachment: {
          select: {
            id: true,
            publicLinks: {
              select: { id: true, token: true, expiresAt: true },
              where: {
                OR: [
                  { expiresAt: null },
                  { expiresAt: { gt: new Date() } },
                ],
              },
              take: 1,
            },
          },
        },
      },
    });

    return jobs.map((job) => this.formatJobResponse(job));
  }

  async getLatestJobForEntity(userId: string, entityType: PdfEntityType, entityId: string) {
    const job = await this.prisma.pdfJob.findFirst({
      where: {
        userId,
        entityType,
        entityId,
      },
      orderBy: { requestedAt: 'desc' },
      include: {
        attachment: {
          select: {
            id: true,
            publicLinks: {
              select: { id: true, token: true, expiresAt: true },
              where: {
                OR: [
                  { expiresAt: null },
                  { expiresAt: { gt: new Date() } },
                ],
              },
              take: 1,
            },
          },
        },
      },
    });

    if (!job) {
      return null;
    }

    return this.formatJobResponse(job);
  }

  private generateToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }

  private formatJobResponse(job: any) {
    const publicLink = job.attachment?.publicLinks?.[0];

    return {
      id: job.id,
      entityType: job.entityType,
      entityId: job.entityId,
      status: job.status,
      attachmentId: job.attachmentId,
      errorMessage: job.errorMessage,
      processingTime: job.processingTime,
      fileSize: job.fileSize,
      requestedAt: job.requestedAt,
      completedAt: job.completedAt,
      publicLinkToken: publicLink?.token || null,
      publicLinkExpiresAt: publicLink?.expiresAt || null,
    };
  }
}
