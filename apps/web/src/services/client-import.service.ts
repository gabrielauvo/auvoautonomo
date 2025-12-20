import api from './api';

export interface ImportJob {
  id: string;
  status: 'PENDING' | 'VALIDATING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  fileName: string;
  fileSize: number;
  totalRows: number;
  processedRows: number;
  successCount: number;
  errorCount: number;
  errorDetails?: ErrorDetail[];
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface ErrorDetail {
  row: number;
  field: string;
  value: string;
  message: string;
}

export interface UploadResponse {
  jobId: string;
  status: string;
  totalRows: number;
  message: string;
}

export interface ImportJobListResponse {
  data: ImportJob[];
  total: number;
}

/**
 * Download the Excel template for client import
 */
export async function downloadTemplate(): Promise<void> {
  const response = await api.get('/client-import/template', {
    responseType: 'blob',
  });

  const blob = new Blob([response.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'clientes-modelo.xlsx';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Upload an Excel file for client import
 */
export async function uploadFile(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post<UploadResponse>('/client-import/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
}

/**
 * List import jobs for the current user
 */
export async function listJobs(page = 1, limit = 10): Promise<ImportJobListResponse> {
  const response = await api.get<ImportJobListResponse>('/client-import/jobs', {
    params: { page, limit },
  });
  return response.data;
}

/**
 * Get details of a specific import job
 */
export async function getJob(jobId: string): Promise<ImportJob> {
  const response = await api.get<ImportJob>(`/client-import/jobs/${jobId}`);
  return response.data;
}

/**
 * Cancel a pending import job
 */
export async function cancelJob(jobId: string): Promise<void> {
  await api.delete(`/client-import/jobs/${jobId}`);
}

/**
 * Poll for job status until completion
 */
export async function pollJobStatus(
  jobId: string,
  onUpdate: (job: ImportJob) => void,
  intervalMs = 2000,
  maxAttempts = 150, // 5 minutes
): Promise<ImportJob> {
  let attempts = 0;

  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        attempts++;
        const job = await getJob(jobId);
        onUpdate(job);

        if (job.status === 'COMPLETED' || job.status === 'FAILED') {
          resolve(job);
          return;
        }

        if (attempts >= maxAttempts) {
          reject(new Error('Tempo limite excedido. A importação ainda está em andamento.'));
          return;
        }

        setTimeout(poll, intervalMs);
      } catch (error) {
        reject(error);
      }
    };

    poll();
  });
}
