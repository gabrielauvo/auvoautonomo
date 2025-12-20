import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PdfJobsController } from './pdf-jobs.controller';
import { PdfJobsService } from './pdf-jobs.service';
import { PdfEntityType, PdfJobStatus } from '@prisma/client';

describe('PdfJobsController', () => {
  let controller: PdfJobsController;
  let service: PdfJobsService;

  const mockPdfJobsService = {
    requestQuotePdf: jest.fn(),
    requestWorkOrderPdf: jest.fn(),
    requestInvoicePdf: jest.fn(),
    getJobStatus: jest.fn(),
    cancelJob: jest.fn(),
    listUserJobs: jest.fn(),
    getLatestJobForEntity: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PdfJobsController],
      providers: [
        {
          provide: PdfJobsService,
          useValue: mockPdfJobsService,
        },
      ],
    }).compile();

    controller = module.get<PdfJobsController>(PdfJobsController);
    service = module.get<PdfJobsService>(PdfJobsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('requestQuotePdf', () => {
    const userId = 'user-123';
    const quoteId = 'quote-456';

    it('should request PDF generation for a quote', async () => {
      const mockJob = {
        id: 'job-789',
        entityType: PdfEntityType.QUOTE,
        entityId: quoteId,
        status: PdfJobStatus.PENDING,
        requestedAt: new Date(),
      };

      mockPdfJobsService.requestQuotePdf.mockResolvedValue(mockJob);

      const result = await controller.requestQuotePdf(userId, quoteId);

      expect(result).toEqual(mockJob);
      expect(service.requestQuotePdf).toHaveBeenCalledWith(
        userId,
        quoteId,
        undefined,
      );
    });

    it('should pass options to service', async () => {
      const options = { priority: 5, includeSignatures: true };
      mockPdfJobsService.requestQuotePdf.mockResolvedValue({});

      await controller.requestQuotePdf(userId, quoteId, options);

      expect(service.requestQuotePdf).toHaveBeenCalledWith(
        userId,
        quoteId,
        options,
      );
    });
  });

  describe('requestWorkOrderPdf', () => {
    const userId = 'user-123';
    const workOrderId = 'wo-456';

    it('should request PDF generation for a work order', async () => {
      const mockJob = {
        id: 'job-789',
        entityType: PdfEntityType.WORK_ORDER,
        entityId: workOrderId,
        status: PdfJobStatus.PENDING,
      };

      mockPdfJobsService.requestWorkOrderPdf.mockResolvedValue(mockJob);

      const result = await controller.requestWorkOrderPdf(userId, workOrderId);

      expect(result).toEqual(mockJob);
      expect(service.requestWorkOrderPdf).toHaveBeenCalledWith(
        userId,
        workOrderId,
        undefined,
      );
    });
  });

  describe('requestInvoicePdf', () => {
    const userId = 'user-123';
    const invoiceId = 'inv-456';

    it('should request PDF generation for an invoice', async () => {
      const mockJob = {
        id: 'job-789',
        entityType: PdfEntityType.INVOICE,
        entityId: invoiceId,
        status: PdfJobStatus.PENDING,
      };

      mockPdfJobsService.requestInvoicePdf.mockResolvedValue(mockJob);

      const result = await controller.requestInvoicePdf(userId, invoiceId);

      expect(result).toEqual(mockJob);
      expect(service.requestInvoicePdf).toHaveBeenCalledWith(
        userId,
        invoiceId,
        undefined,
      );
    });
  });

  describe('getJobStatus', () => {
    const userId = 'user-123';
    const jobId = 'job-789';

    it('should return job status', async () => {
      const mockJob = {
        id: jobId,
        entityType: PdfEntityType.QUOTE,
        status: PdfJobStatus.COMPLETED,
        attachmentId: 'att-123',
        publicLinkToken: 'token-abc',
      };

      mockPdfJobsService.getJobStatus.mockResolvedValue(mockJob);

      const result = await controller.getJobStatus(userId, jobId);

      expect(result).toEqual(mockJob);
      expect(service.getJobStatus).toHaveBeenCalledWith(userId, jobId);
    });

    it('should throw NotFoundException when job does not exist', async () => {
      mockPdfJobsService.getJobStatus.mockRejectedValue(
        new NotFoundException('Job not found'),
      );

      await expect(controller.getJobStatus(userId, jobId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('cancelJob', () => {
    const userId = 'user-123';
    const jobId = 'job-789';

    it('should cancel a pending job', async () => {
      mockPdfJobsService.cancelJob.mockResolvedValue({ success: true });

      const result = await controller.cancelJob(userId, jobId);

      expect(result).toEqual({ success: true });
      expect(service.cancelJob).toHaveBeenCalledWith(userId, jobId);
    });

    it('should throw NotFoundException when job cannot be cancelled', async () => {
      mockPdfJobsService.cancelJob.mockRejectedValue(
        new NotFoundException('Job pendente não encontrado'),
      );

      await expect(controller.cancelJob(userId, jobId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('listJobs', () => {
    const userId = 'user-123';

    it('should return all jobs for user', async () => {
      const mockJobs = [
        { id: 'job-1', entityType: PdfEntityType.QUOTE, status: PdfJobStatus.COMPLETED },
        { id: 'job-2', entityType: PdfEntityType.WORK_ORDER, status: PdfJobStatus.PENDING },
      ];

      mockPdfJobsService.listUserJobs.mockResolvedValue(mockJobs);

      const result = await controller.listJobs(userId);

      expect(result).toEqual(mockJobs);
      expect(service.listUserJobs).toHaveBeenCalledWith(userId, {
        entityType: undefined,
        limit: undefined,
      });
    });

    it('should filter by entity type', async () => {
      mockPdfJobsService.listUserJobs.mockResolvedValue([]);

      await controller.listJobs(userId, PdfEntityType.QUOTE);

      expect(service.listUserJobs).toHaveBeenCalledWith(userId, {
        entityType: PdfEntityType.QUOTE,
        limit: undefined,
      });
    });

    it('should apply limit', async () => {
      mockPdfJobsService.listUserJobs.mockResolvedValue([]);

      await controller.listJobs(userId, undefined, 10);

      expect(service.listUserJobs).toHaveBeenCalledWith(userId, {
        entityType: undefined,
        limit: 10,
      });
    });
  });

  describe('getQuotePdfStatus', () => {
    const userId = 'user-123';
    const quoteId = 'quote-456';

    it('should return latest PDF job for quote', async () => {
      const mockJob = {
        id: 'job-1',
        entityType: PdfEntityType.QUOTE,
        entityId: quoteId,
        status: PdfJobStatus.COMPLETED,
      };

      mockPdfJobsService.getLatestJobForEntity.mockResolvedValue(mockJob);

      const result = await controller.getQuotePdfStatus(userId, quoteId);

      expect(result).toEqual(mockJob);
      expect(service.getLatestJobForEntity).toHaveBeenCalledWith(
        userId,
        PdfEntityType.QUOTE,
        quoteId,
      );
    });

    it('should return null when no PDF exists for quote', async () => {
      mockPdfJobsService.getLatestJobForEntity.mockResolvedValue(null);

      const result = await controller.getQuotePdfStatus(userId, quoteId);

      expect(result).toBeNull();
    });
  });

  describe('getWorkOrderPdfStatus', () => {
    const userId = 'user-123';
    const workOrderId = 'wo-456';

    it('should return latest PDF job for work order', async () => {
      const mockJob = {
        id: 'job-1',
        entityType: PdfEntityType.WORK_ORDER,
        entityId: workOrderId,
        status: PdfJobStatus.COMPLETED,
      };

      mockPdfJobsService.getLatestJobForEntity.mockResolvedValue(mockJob);

      const result = await controller.getWorkOrderPdfStatus(userId, workOrderId);

      expect(result).toEqual(mockJob);
      expect(service.getLatestJobForEntity).toHaveBeenCalledWith(
        userId,
        PdfEntityType.WORK_ORDER,
        workOrderId,
      );
    });
  });

  describe('getInvoicePdfStatus', () => {
    const userId = 'user-123';
    const invoiceId = 'inv-456';

    it('should return latest PDF job for invoice', async () => {
      const mockJob = {
        id: 'job-1',
        entityType: PdfEntityType.INVOICE,
        entityId: invoiceId,
        status: PdfJobStatus.COMPLETED,
      };

      mockPdfJobsService.getLatestJobForEntity.mockResolvedValue(mockJob);

      const result = await controller.getInvoicePdfStatus(userId, invoiceId);

      expect(result).toEqual(mockJob);
      expect(service.getLatestJobForEntity).toHaveBeenCalledWith(
        userId,
        PdfEntityType.INVOICE,
        invoiceId,
      );
    });
  });
});
