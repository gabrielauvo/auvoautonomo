import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { PdfJobsService, PDF_QUEUE_NAME, PDF_JOB_TYPES } from './pdf-jobs.service';
import { PrismaService } from '../prisma/prisma.service';
import { PdfEntityType, PdfJobStatus } from '@prisma/client';

describe('PdfJobsService', () => {
  let service: PdfJobsService;
  let prisma: PrismaService;

  const mockQueue = {
    add: jest.fn(),
    getJob: jest.fn(),
  };

  const mockPrismaService = {
    quote: {
      findFirst: jest.fn(),
    },
    workOrder: {
      findFirst: jest.fn(),
    },
    invoice: {
      findFirst: jest.fn(),
    },
    pdfJob: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PdfJobsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: getQueueToken(PDF_QUEUE_NAME),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<PdfJobsService>(PdfJobsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('requestQuotePdf', () => {
    const userId = 'user-123';
    const quoteId = 'quote-456';

    it('should create a PDF job for an existing quote', async () => {
      const mockQuote = { id: quoteId, userId, status: 'SENT' };
      const mockPdfJob = {
        id: 'job-789',
        userId,
        entityType: PdfEntityType.QUOTE,
        entityId: quoteId,
        status: PdfJobStatus.PENDING,
        priority: 0,
        requestedAt: new Date(),
      };

      mockPrismaService.quote.findFirst.mockResolvedValue(mockQuote);
      mockPrismaService.pdfJob.findFirst.mockResolvedValue(null);
      mockPrismaService.pdfJob.create.mockResolvedValue(mockPdfJob);
      mockQueue.add.mockResolvedValue({ id: 'bull-job-123' });
      mockPrismaService.pdfJob.update.mockResolvedValue({
        ...mockPdfJob,
        bullJobId: 'bull-job-123',
      });

      const result = await service.requestQuotePdf(userId, quoteId);

      expect(result).toMatchObject({
        id: 'job-789',
        entityType: PdfEntityType.QUOTE,
        entityId: quoteId,
        status: PdfJobStatus.PENDING,
      });
      expect(prisma.quote.findFirst).toHaveBeenCalledWith({
        where: { id: quoteId, userId },
      });
      expect(mockQueue.add).toHaveBeenCalledWith(
        PDF_JOB_TYPES.QUOTE,
        expect.objectContaining({
          jobId: 'job-789',
          userId,
          entityType: PdfEntityType.QUOTE,
          entityId: quoteId,
        }),
        expect.any(Object),
      );
    });

    it('should return existing pending job instead of creating new one', async () => {
      const mockQuote = { id: quoteId, userId };
      const existingJob = {
        id: 'existing-job',
        userId,
        entityType: PdfEntityType.QUOTE,
        entityId: quoteId,
        status: PdfJobStatus.PENDING,
        requestedAt: new Date(),
      };

      mockPrismaService.quote.findFirst.mockResolvedValue(mockQuote);
      mockPrismaService.pdfJob.findFirst.mockResolvedValue(existingJob);

      const result = await service.requestQuotePdf(userId, quoteId);

      expect(result.id).toBe('existing-job');
      expect(mockPrismaService.pdfJob.create).not.toHaveBeenCalled();
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when quote does not exist', async () => {
      mockPrismaService.quote.findFirst.mockResolvedValue(null);

      await expect(service.requestQuotePdf(userId, quoteId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.requestQuotePdf(userId, quoteId)).rejects.toThrow(
        `Orçamento ${quoteId} não encontrado`,
      );
    });

    it('should pass options to job creation', async () => {
      const mockQuote = { id: quoteId, userId };
      const mockPdfJob = {
        id: 'job-with-options',
        userId,
        entityType: PdfEntityType.QUOTE,
        entityId: quoteId,
        status: PdfJobStatus.PENDING,
        priority: 5,
        requestedAt: new Date(),
      };
      const options = { priority: 5, includeSignatures: true };

      mockPrismaService.quote.findFirst.mockResolvedValue(mockQuote);
      mockPrismaService.pdfJob.findFirst.mockResolvedValue(null);
      mockPrismaService.pdfJob.create.mockResolvedValue(mockPdfJob);
      mockQueue.add.mockResolvedValue({ id: 'bull-job' });
      mockPrismaService.pdfJob.update.mockResolvedValue(mockPdfJob);

      await service.requestQuotePdf(userId, quoteId, options);

      expect(mockPrismaService.pdfJob.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          priority: 5,
          metadata: options,
        }),
      });
    });
  });

  describe('requestWorkOrderPdf', () => {
    const userId = 'user-123';
    const workOrderId = 'wo-456';

    it('should create a PDF job for an existing work order', async () => {
      const mockWorkOrder = { id: workOrderId, userId };
      const mockPdfJob = {
        id: 'job-789',
        userId,
        entityType: PdfEntityType.WORK_ORDER,
        entityId: workOrderId,
        status: PdfJobStatus.PENDING,
        requestedAt: new Date(),
      };

      mockPrismaService.workOrder.findFirst.mockResolvedValue(mockWorkOrder);
      mockPrismaService.pdfJob.findFirst.mockResolvedValue(null);
      mockPrismaService.pdfJob.create.mockResolvedValue(mockPdfJob);
      mockQueue.add.mockResolvedValue({ id: 'bull-job' });
      mockPrismaService.pdfJob.update.mockResolvedValue(mockPdfJob);

      const result = await service.requestWorkOrderPdf(userId, workOrderId);

      expect(result.entityType).toBe(PdfEntityType.WORK_ORDER);
      expect(mockQueue.add).toHaveBeenCalledWith(
        PDF_JOB_TYPES.WORK_ORDER,
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('should throw NotFoundException when work order does not exist', async () => {
      mockPrismaService.workOrder.findFirst.mockResolvedValue(null);

      await expect(
        service.requestWorkOrderPdf(userId, workOrderId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('requestInvoicePdf', () => {
    const userId = 'user-123';
    const invoiceId = 'inv-456';

    it('should create a PDF job for an existing invoice', async () => {
      const mockInvoice = { id: invoiceId, userId };
      const mockPdfJob = {
        id: 'job-789',
        userId,
        entityType: PdfEntityType.INVOICE,
        entityId: invoiceId,
        status: PdfJobStatus.PENDING,
        requestedAt: new Date(),
      };

      mockPrismaService.invoice.findFirst.mockResolvedValue(mockInvoice);
      mockPrismaService.pdfJob.findFirst.mockResolvedValue(null);
      mockPrismaService.pdfJob.create.mockResolvedValue(mockPdfJob);
      mockQueue.add.mockResolvedValue({ id: 'bull-job' });
      mockPrismaService.pdfJob.update.mockResolvedValue(mockPdfJob);

      const result = await service.requestInvoicePdf(userId, invoiceId);

      expect(result.entityType).toBe(PdfEntityType.INVOICE);
      expect(mockQueue.add).toHaveBeenCalledWith(
        PDF_JOB_TYPES.INVOICE,
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('should throw NotFoundException when invoice does not exist', async () => {
      mockPrismaService.invoice.findFirst.mockResolvedValue(null);

      await expect(
        service.requestInvoicePdf(userId, invoiceId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getJobStatus', () => {
    const userId = 'user-123';
    const jobId = 'job-789';

    it('should return job status with attachment info', async () => {
      const mockJob = {
        id: jobId,
        userId,
        entityType: PdfEntityType.QUOTE,
        entityId: 'quote-456',
        status: PdfJobStatus.COMPLETED,
        attachmentId: 'att-123',
        requestedAt: new Date(),
        completedAt: new Date(),
        processingTime: 5000,
        fileSize: 102400,
        attachment: {
          id: 'att-123',
          storagePath: '/storage/pdfs/file.pdf',
          fileSize: 102400,
          publicLinks: [
            { id: 'link-1', token: 'abc123', expiresAt: null },
          ],
        },
      };

      mockPrismaService.pdfJob.findFirst.mockResolvedValue(mockJob);

      const result = await service.getJobStatus(userId, jobId);

      expect(result).toMatchObject({
        id: jobId,
        status: PdfJobStatus.COMPLETED,
        attachmentId: 'att-123',
        publicLinkToken: 'abc123',
      });
    });

    it('should throw NotFoundException when job does not exist', async () => {
      mockPrismaService.pdfJob.findFirst.mockResolvedValue(null);

      await expect(service.getJobStatus(userId, jobId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return null for publicLinkToken when no public links exist', async () => {
      const mockJob = {
        id: jobId,
        userId,
        entityType: PdfEntityType.QUOTE,
        entityId: 'quote-456',
        status: PdfJobStatus.COMPLETED,
        requestedAt: new Date(),
        attachment: {
          id: 'att-123',
          publicLinks: [],
        },
      };

      mockPrismaService.pdfJob.findFirst.mockResolvedValue(mockJob);

      const result = await service.getJobStatus(userId, jobId);

      expect(result.publicLinkToken).toBeNull();
    });
  });

  describe('cancelJob', () => {
    const userId = 'user-123';
    const jobId = 'job-789';

    it('should cancel a pending job', async () => {
      const mockJob = {
        id: jobId,
        userId,
        status: PdfJobStatus.PENDING,
        bullJobId: 'bull-123',
      };
      const mockBullJob = { remove: jest.fn() };

      mockPrismaService.pdfJob.findFirst.mockResolvedValue(mockJob);
      mockQueue.getJob.mockResolvedValue(mockBullJob);
      mockPrismaService.pdfJob.update.mockResolvedValue({
        ...mockJob,
        status: PdfJobStatus.CANCELLED,
      });

      const result = await service.cancelJob(userId, jobId);

      expect(result).toEqual({ success: true });
      expect(mockBullJob.remove).toHaveBeenCalled();
      expect(mockPrismaService.pdfJob.update).toHaveBeenCalledWith({
        where: { id: jobId },
        data: { status: PdfJobStatus.CANCELLED },
      });
    });

    it('should throw NotFoundException when job is not pending', async () => {
      mockPrismaService.pdfJob.findFirst.mockResolvedValue(null);

      await expect(service.cancelJob(userId, jobId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle case when bull job is already removed', async () => {
      const mockJob = {
        id: jobId,
        userId,
        status: PdfJobStatus.PENDING,
        bullJobId: 'bull-123',
      };

      mockPrismaService.pdfJob.findFirst.mockResolvedValue(mockJob);
      mockQueue.getJob.mockResolvedValue(null);
      mockPrismaService.pdfJob.update.mockResolvedValue({
        ...mockJob,
        status: PdfJobStatus.CANCELLED,
      });

      const result = await service.cancelJob(userId, jobId);

      expect(result).toEqual({ success: true });
    });
  });

  describe('listUserJobs', () => {
    const userId = 'user-123';

    it('should return all jobs for user', async () => {
      const mockJobs = [
        {
          id: 'job-1',
          userId,
          entityType: PdfEntityType.QUOTE,
          entityId: 'quote-1',
          status: PdfJobStatus.COMPLETED,
          requestedAt: new Date(),
          attachment: { id: 'att-1', publicLinks: [] },
        },
        {
          id: 'job-2',
          userId,
          entityType: PdfEntityType.WORK_ORDER,
          entityId: 'wo-1',
          status: PdfJobStatus.PENDING,
          requestedAt: new Date(),
          attachment: null,
        },
      ];

      mockPrismaService.pdfJob.findMany.mockResolvedValue(mockJobs);

      const result = await service.listUserJobs(userId);

      expect(result).toHaveLength(2);
      expect(mockPrismaService.pdfJob.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { requestedAt: 'desc' },
        take: 50,
        include: expect.any(Object),
      });
    });

    it('should filter by entity type', async () => {
      mockPrismaService.pdfJob.findMany.mockResolvedValue([]);

      await service.listUserJobs(userId, { entityType: PdfEntityType.QUOTE });

      expect(mockPrismaService.pdfJob.findMany).toHaveBeenCalledWith({
        where: { userId, entityType: PdfEntityType.QUOTE },
        orderBy: { requestedAt: 'desc' },
        take: 50,
        include: expect.any(Object),
      });
    });

    it('should respect limit parameter', async () => {
      mockPrismaService.pdfJob.findMany.mockResolvedValue([]);

      await service.listUserJobs(userId, { limit: 10 });

      expect(mockPrismaService.pdfJob.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { requestedAt: 'desc' },
        take: 10,
        include: expect.any(Object),
      });
    });
  });

  describe('getLatestJobForEntity', () => {
    const userId = 'user-123';

    it('should return latest job for a specific entity', async () => {
      const mockJob = {
        id: 'job-1',
        userId,
        entityType: PdfEntityType.QUOTE,
        entityId: 'quote-456',
        status: PdfJobStatus.COMPLETED,
        requestedAt: new Date(),
        attachment: { id: 'att-1', publicLinks: [] },
      };

      mockPrismaService.pdfJob.findFirst.mockResolvedValue(mockJob);

      const result = await service.getLatestJobForEntity(
        userId,
        PdfEntityType.QUOTE,
        'quote-456',
      );

      expect(result).toMatchObject({
        id: 'job-1',
        entityType: PdfEntityType.QUOTE,
        entityId: 'quote-456',
      });
      expect(mockPrismaService.pdfJob.findFirst).toHaveBeenCalledWith({
        where: {
          userId,
          entityType: PdfEntityType.QUOTE,
          entityId: 'quote-456',
        },
        orderBy: { requestedAt: 'desc' },
        include: expect.any(Object),
      });
    });

    it('should return null when no job exists for entity', async () => {
      mockPrismaService.pdfJob.findFirst.mockResolvedValue(null);

      const result = await service.getLatestJobForEntity(
        userId,
        PdfEntityType.WORK_ORDER,
        'wo-999',
      );

      expect(result).toBeNull();
    });
  });
});
