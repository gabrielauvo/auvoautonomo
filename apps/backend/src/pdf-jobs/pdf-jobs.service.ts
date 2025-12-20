import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { PdfEntityType, PdfJobStatus } from '@prisma/client';
import { RequestPdfDto } from './dto/request-pdf.dto';

export const PDF_QUEUE_NAME = 'pdf-generation';

export const PDF_JOB_TYPES = {
  QUOTE: 'generate-quote-pdf',
  WORK_ORDER: 'generate-work-order-pdf',
  INVOICE: 'generate-invoice-pdf',
} as const;

export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 5000,
  },
  removeOnComplete: {
    age: 24 * 3600,
    count: 1000,
  },
  removeOnFail: {
    age: 7 * 24 * 3600,
  },
};

@Injectable()
export class PdfJobsService {
  private readonly logger = new Logger(PdfJobsService.name);

  constructor(
    @InjectQueue(PDF_QUEUE_NAME) private pdfQueue: Queue,
    private prisma: PrismaService,
  ) {}

  async requestQuotePdf(userId: string, quoteId: string, options?: RequestPdfDto) {
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, userId },
    });
    if (!quote) {
      throw new NotFoundException(`Orçamento ${quoteId} não encontrado`);
    }

    return this.createPdfJob(userId, PdfEntityType.QUOTE, quoteId, options);
  }

  async requestWorkOrderPdf(userId: string, workOrderId: string, options?: RequestPdfDto) {
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, userId },
    });
    if (!workOrder) {
      throw new NotFoundException(`Ordem de Serviço ${workOrderId} não encontrada`);
    }

    return this.createPdfJob(userId, PdfEntityType.WORK_ORDER, workOrderId, options);
  }

  async requestInvoicePdf(userId: string, invoiceId: string, options?: RequestPdfDto) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, userId },
    });
    if (!invoice) {
      throw new NotFoundException(`Fatura ${invoiceId} não encontrada`);
    }

    return this.createPdfJob(userId, PdfEntityType.INVOICE, invoiceId, options);
  }

  private async createPdfJob(
    userId: string,
    entityType: PdfEntityType,
    entityId: string,
    options?: RequestPdfDto,
  ) {
    // Check for existing pending/processing job
    const existingJob = await this.prisma.pdfJob.findFirst({
      where: {
        userId,
        entityType,
        entityId,
        status: { in: [PdfJobStatus.PENDING, PdfJobStatus.PROCESSING] },
      },
    });

    if (existingJob) {
      this.logger.log(`Retornando job existente ${existingJob.id} para ${entityType}:${entityId}`);
      return this.formatJobResponse(existingJob);
    }

    // Create database record
    const pdfJob = await this.prisma.pdfJob.create({
      data: {
        userId,
        entityType,
        entityId,
        priority: options?.priority || 0,
        metadata: options ? JSON.parse(JSON.stringify(options)) : {},
      },
    });

    // Add to BullMQ queue
    const jobName = this.getJobName(entityType);
    const bullJob = await this.pdfQueue.add(
      jobName,
      {
        jobId: pdfJob.id,
        userId,
        entityType,
        entityId,
        options,
      },
      {
        ...DEFAULT_JOB_OPTIONS,
        jobId: pdfJob.id,
        priority: options?.priority || 0,
      },
    );

    // Update with Bull job ID
    await this.prisma.pdfJob.update({
      where: { id: pdfJob.id },
      data: { bullJobId: bullJob.id },
    });

    this.logger.log(`Criado PDF job ${pdfJob.id} para ${entityType}:${entityId}`);

    return this.formatJobResponse(pdfJob);
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

    // Remove from queue
    if (job.bullJobId) {
      const bullJob = await this.pdfQueue.getJob(job.bullJobId);
      if (bullJob) {
        await bullJob.remove();
      }
    }

    // Update status
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

  private getJobName(entityType: PdfEntityType): string {
    switch (entityType) {
      case PdfEntityType.QUOTE:
        return PDF_JOB_TYPES.QUOTE;
      case PdfEntityType.WORK_ORDER:
        return PDF_JOB_TYPES.WORK_ORDER;
      case PdfEntityType.INVOICE:
        return PDF_JOB_TYPES.INVOICE;
    }
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
