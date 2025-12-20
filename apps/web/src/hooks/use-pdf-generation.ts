'use client';

import { useState, useCallback } from 'react';
import { useToast } from './use-toast';
import {
  PdfJob,
  PdfEntityType,
  PdfJobStatus,
  RequestPdfOptions,
  requestQuotePdf,
  requestWorkOrderPdf,
  requestInvoicePdf,
  waitForPdfCompletion,
  getPublicPdfUrl,
  getDownloadPdfUrl,
} from '@/services/pdf-jobs.service';

interface UsePdfGenerationReturn {
  generatePdf: (
    entityType: PdfEntityType,
    entityId: string,
    options?: RequestPdfOptions,
  ) => Promise<PdfJob | null>;
  generateAndDownload: (
    entityType: PdfEntityType,
    entityId: string,
    options?: RequestPdfOptions,
  ) => Promise<void>;
  generateAndShare: (
    entityType: PdfEntityType,
    entityId: string,
    options?: RequestPdfOptions,
  ) => Promise<{ job: PdfJob; shareUrl: string } | null>;
  isGenerating: boolean;
  progress: string | null;
  currentJob: PdfJob | null;
}

export function usePdfGeneration(): UsePdfGenerationReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [currentJob, setCurrentJob] = useState<PdfJob | null>(null);
  const { toast } = useToast();

  const generatePdf = useCallback(
    async (
      entityType: PdfEntityType,
      entityId: string,
      options?: RequestPdfOptions,
    ): Promise<PdfJob | null> => {
      setIsGenerating(true);
      setProgress('Solicitando geração...');

      try {
        let job: PdfJob;
        switch (entityType) {
          case 'QUOTE':
            job = await requestQuotePdf(entityId, options);
            break;
          case 'WORK_ORDER':
            job = await requestWorkOrderPdf(entityId, options);
            break;
          case 'INVOICE':
            job = await requestInvoicePdf(entityId, options);
            break;
        }
        setCurrentJob(job);

        const completedJob = await waitForPdfCompletion(job.id, (status) => {
          switch (status) {
            case 'PENDING':
              setProgress('Na fila de processamento...');
              break;
            case 'PROCESSING':
              setProgress('Gerando PDF...');
              break;
          }
        });

        setCurrentJob(completedJob);

        if (completedJob.status === 'COMPLETED') {
          setProgress('PDF gerado com sucesso!');
          toast({
            title: 'PDF gerado',
            description: 'O documento foi gerado com sucesso.',
          });
          return completedJob;
        } else {
          throw new Error(completedJob.errorMessage || 'Falha ao gerar PDF');
        }
      } catch (error) {
        toast({
          title: 'Erro ao gerar PDF',
          description: error instanceof Error ? error.message : 'Erro desconhecido',
          variant: 'destructive',
        });
        return null;
      } finally {
        setIsGenerating(false);
        setProgress(null);
      }
    },
    [toast],
  );

  const generateAndDownload = useCallback(
    async (
      entityType: PdfEntityType,
      entityId: string,
      options?: RequestPdfOptions,
    ): Promise<void> => {
      const job = await generatePdf(entityType, entityId, options);

      // Use public link (no authentication required) to open in new tab
      if (job?.publicLinkToken) {
        const url = getPublicPdfUrl(job.publicLinkToken);
        window.open(url, '_blank');
      }
    },
    [generatePdf],
  );

  const generateAndShare = useCallback(
    async (
      entityType: PdfEntityType,
      entityId: string,
      options?: RequestPdfOptions,
    ): Promise<{ job: PdfJob; shareUrl: string } | null> => {
      const job = await generatePdf(entityType, entityId, options);

      if (job?.publicLinkToken) {
        const shareUrl = getPublicPdfUrl(job.publicLinkToken);

        // Copy to clipboard
        try {
          await navigator.clipboard.writeText(shareUrl);
          toast({
            title: 'Link copiado!',
            description: 'O link do PDF foi copiado para a área de transferência.',
          });
        } catch {
          // Clipboard not available
        }

        return { job, shareUrl };
      }

      return null;
    },
    [generatePdf, toast],
  );

  return {
    generatePdf,
    generateAndDownload,
    generateAndShare,
    isGenerating,
    progress,
    currentJob,
  };
}

export default usePdfGeneration;
