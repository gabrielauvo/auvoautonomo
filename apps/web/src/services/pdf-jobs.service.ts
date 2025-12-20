import api from './api';

export type PdfEntityType = 'QUOTE' | 'WORK_ORDER' | 'INVOICE';
export type PdfJobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface PdfJob {
  id: string;
  entityType: PdfEntityType;
  entityId: string;
  status: PdfJobStatus;
  attachmentId?: string;
  errorMessage?: string;
  processingTime?: number;
  fileSize?: number;
  requestedAt: string;
  completedAt?: string;
  publicLinkToken?: string;
  publicLinkExpiresAt?: string;
}

export interface RequestPdfOptions {
  priority?: number;
  includeSignatures?: boolean;
  includeChecklists?: boolean;
  includePhotos?: boolean;
  customHeader?: string;
  watermark?: string;
}

export async function requestQuotePdf(quoteId: string, options?: RequestPdfOptions): Promise<PdfJob> {
  const response = await api.post<PdfJob>(`/quotes/${quoteId}/generate-pdf-async`, options || {});
  return response.data;
}

export async function requestWorkOrderPdf(workOrderId: string, options?: RequestPdfOptions): Promise<PdfJob> {
  const response = await api.post<PdfJob>(`/work-orders/${workOrderId}/generate-pdf-async`, options || {});
  return response.data;
}

export async function requestInvoicePdf(invoiceId: string, options?: RequestPdfOptions): Promise<PdfJob> {
  const response = await api.post<PdfJob>(`/invoices/${invoiceId}/generate-pdf-async`, options || {});
  return response.data;
}

export async function getPdfJobStatus(jobId: string): Promise<PdfJob> {
  const response = await api.get<PdfJob>(`/pdf-jobs/${jobId}`);
  return response.data;
}

export async function cancelPdfJob(jobId: string): Promise<void> {
  await api.delete(`/pdf-jobs/${jobId}`);
}

export async function listPdfJobs(entityType?: PdfEntityType, limit?: number): Promise<PdfJob[]> {
  const response = await api.get<PdfJob[]>('/pdf-jobs', {
    params: { entityType, limit },
  });
  return response.data;
}

export async function getQuotePdfStatus(quoteId: string): Promise<PdfJob | null> {
  const response = await api.get<PdfJob | null>(`/quotes/${quoteId}/pdf-status`);
  return response.data;
}

export async function getWorkOrderPdfStatus(workOrderId: string): Promise<PdfJob | null> {
  const response = await api.get<PdfJob | null>(`/work-orders/${workOrderId}/pdf-status`);
  return response.data;
}

export async function getInvoicePdfStatus(invoiceId: string): Promise<PdfJob | null> {
  const response = await api.get<PdfJob | null>(`/invoices/${invoiceId}/pdf-status`);
  return response.data;
}

export async function waitForPdfCompletion(
  jobId: string,
  onProgress?: (status: PdfJobStatus) => void,
  maxWaitMs: number = 120000,
): Promise<PdfJob> {
  const startTime = Date.now();
  let delay = 500;
  const maxDelay = 5000;

  while (Date.now() - startTime < maxWaitMs) {
    const job = await getPdfJobStatus(jobId);
    onProgress?.(job.status);

    if (job.status === 'COMPLETED' || job.status === 'FAILED' || job.status === 'CANCELLED') {
      return job;
    }

    await new Promise((resolve) => setTimeout(resolve, delay));
    delay = Math.min(delay * 1.5, maxDelay);
  }

  throw new Error('Timeout aguardando geração do PDF');
}

export function getPublicPdfUrl(token: string): string {
  // Public routes don't use /api prefix - remove it from base URL
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
  const baseUrl = apiUrl.replace(/\/api\/?$/, '');
  return `${baseUrl}/public/files/${token}`;
}

export function getDownloadPdfUrl(attachmentId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
  return `${baseUrl}/attachments/${attachmentId}/download`;
}
