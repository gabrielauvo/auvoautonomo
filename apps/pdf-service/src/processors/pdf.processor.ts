import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { PdfGenerator } from '../generators/pdf.generator';
import { PdfJobStatus } from '@prisma/client';

export const PDF_QUEUE_NAME = 'pdf-generation';

export const PDF_JOB_TYPES = {
  QUOTE: 'generate-quote-pdf',
  WORK_ORDER: 'generate-work-order-pdf',
  INVOICE: 'generate-invoice-pdf',
} as const;

interface PdfJobPayload {
  jobId: string;
  userId: string;
  entityType: 'QUOTE' | 'WORK_ORDER' | 'INVOICE';
  entityId: string;
  options?: any;
}

interface PdfJobResult {
  jobId: string;
  attachmentId: string;
  fileSize: number;
  processingTime: number;
}

@Processor(PDF_QUEUE_NAME)
export class PdfProcessor extends WorkerHost {
  private readonly logger = new Logger(PdfProcessor.name);

  constructor(
    private prisma: PrismaService,
    private pdfGenerator: PdfGenerator,
  ) {
    super();
  }

  async process(job: Job<PdfJobPayload>): Promise<PdfJobResult> {
    const { jobId, userId, entityType, entityId } = job.data;
    const startTime = Date.now();

    this.logger.log(`Processando job ${jobId} para ${entityType}:${entityId}`);

    // Update job status to PROCESSING
    await this.prisma.pdfJob.update({
      where: { id: jobId },
      data: {
        status: PdfJobStatus.PROCESSING,
        startedAt: new Date(),
      },
    });

    try {
      let result: any;

      switch (job.name) {
        case PDF_JOB_TYPES.QUOTE:
          result = await this.pdfGenerator.generateQuotePdf(userId, entityId);
          break;

        case PDF_JOB_TYPES.WORK_ORDER:
          result = await this.pdfGenerator.generateWorkOrderPdf(userId, entityId);
          break;

        case PDF_JOB_TYPES.INVOICE:
          result = await this.pdfGenerator.generateInvoicePdf(userId, entityId);
          break;

        default:
          throw new Error(`Tipo de job desconhecido: ${job.name}`);
      }

      const processingTime = Date.now() - startTime;

      // Update job as completed
      await this.prisma.pdfJob.update({
        where: { id: jobId },
        data: {
          status: PdfJobStatus.COMPLETED,
          attachmentId: result.attachmentId,
          fileSize: result.fileSize,
          processingTime,
          completedAt: new Date(),
        },
      });

      this.logger.log(`Job ${jobId} concluído em ${processingTime}ms`);

      return {
        jobId,
        attachmentId: result.attachmentId,
        fileSize: result.fileSize,
        processingTime,
      };
    } catch (error) {
      this.logger.error(`Job ${jobId} falhou: ${error.message}`);

      await this.prisma.pdfJob.update({
        where: { id: jobId },
        data: {
          status: PdfJobStatus.FAILED,
          errorMessage: error.message,
          failedAt: new Date(),
          attempts: { increment: 1 },
        },
      });

      throw error;
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} falhou após ${job.attemptsMade} tentativas: ${error.message}`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Job ${job.id} completado com sucesso`);
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.log(`Job ${job.id} iniciado`);
  }
}
