'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Download, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  downloadTemplate,
  uploadFile,
  pollJobStatus,
  ImportJob,
  ErrorDetail,
} from '@/services/client-import.service';
import { cn } from '@/lib/utils';

type WizardStep = 'download' | 'upload' | 'processing' | 'result';

interface ImportWizardProps {
  onComplete?: () => void;
}

export function ImportWizard({ onComplete }: ImportWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>('download');
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [currentJob, setCurrentJob] = useState<ImportJob | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = async () => {
    try {
      await downloadTemplate();
    } catch (error) {
      console.error('Erro ao baixar template:', error);
    }
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const validateFile = (file: File): string | null => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ];
    const allowedExtensions = ['.xlsx', '.xls', '.csv'];

    if (!allowedTypes.includes(file.type)) {
      const ext = file.name.toLowerCase().split('.').pop();
      if (!ext || !allowedExtensions.includes(`.${ext}`)) {
        return 'Formato de arquivo inválido. Use .xlsx, .xls ou .csv';
      }
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return 'Arquivo muito grande. O tamanho máximo é 5MB.';
    }

    return null;
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      const error = validateFile(file);
      if (error) {
        setUploadError(error);
        return;
      }
      setSelectedFile(file);
      setUploadError(null);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      const error = validateFile(file);
      if (error) {
        setUploadError(error);
        return;
      }
      setSelectedFile(file);
      setUploadError(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const response = await uploadFile(selectedFile);
      setStep('processing');

      // Start polling for job status
      const finalJob = await pollJobStatus(response.jobId, (job) => {
        setCurrentJob(job);
      });

      setCurrentJob(finalJob);
      setStep('result');
    } catch (error: any) {
      console.error('Erro no upload:', error);
      const message =
        error.response?.data?.message ||
        error.message ||
        'Erro ao processar o arquivo. Tente novamente.';
      setUploadError(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setStep('download');
    setSelectedFile(null);
    setUploadError(null);
    setCurrentJob(null);
  };

  const handleGoToClients = () => {
    if (onComplete) {
      onComplete();
    }
    router.push('/clients');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getProgressPercentage = (job: ImportJob): number => {
    if (job.totalRows === 0) return 0;
    return Math.round((job.processedRows / job.totalRows) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Steps indicator */}
      <div className="flex items-center justify-center space-x-4">
        {(['download', 'upload', 'processing', 'result'] as WizardStep[]).map(
          (s, index) => (
            <div key={s} className="flex items-center">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                  step === s
                    ? 'bg-indigo-600 text-white'
                    : index <
                      ['download', 'upload', 'processing', 'result'].indexOf(step)
                    ? 'bg-indigo-100 text-indigo-600'
                    : 'bg-gray-100 text-gray-400',
                )}
              >
                {index + 1}
              </div>
              {index < 3 && (
                <div
                  className={cn(
                    'w-12 h-0.5 mx-2',
                    index <
                      ['download', 'upload', 'processing', 'result'].indexOf(step)
                      ? 'bg-indigo-600'
                      : 'bg-gray-200',
                  )}
                />
              )}
            </div>
          ),
        )}
      </div>

      {/* Step 1: Download Template */}
      {step === 'download' && (
        <div className="text-center space-y-6">
          <div className="mx-auto w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
            <Download className="h-8 w-8 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              1. Baixe o arquivo modelo
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Use nosso modelo Excel para preencher os dados dos seus clientes.
              O arquivo contém instruções e exemplos.
            </p>
          </div>
          <div className="flex justify-center space-x-4">
            <Button onClick={handleDownloadTemplate} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Baixar Modelo
            </Button>
            <Button onClick={() => setStep('upload')}>
              Já tenho o arquivo preenchido
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Upload File */}
      {step === 'upload' && (
        <div className="space-y-6">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
              <Upload className="h-8 w-8 text-indigo-600" />
            </div>
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              2. Envie seu arquivo
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Arraste e solte ou clique para selecionar o arquivo Excel
              preenchido.
            </p>
          </div>

          {/* Drop zone */}
          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
              isDragging
                ? 'border-indigo-500 bg-indigo-50'
                : selectedFile
                ? 'border-green-500 bg-green-50'
                : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50',
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileSelect}
              className="hidden"
            />

            {selectedFile ? (
              <div className="flex items-center justify-center space-x-3">
                <FileSpreadsheet className="h-8 w-8 text-green-600" />
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <FileSpreadsheet className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-600">
                  <span className="font-medium text-indigo-600">
                    Clique para selecionar
                  </span>{' '}
                  ou arraste o arquivo aqui
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Arquivos .xlsx, .xls ou .csv até 5MB
                </p>
              </div>
            )}
          </div>

          {uploadError && (
            <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm">{uploadError}</p>
            </div>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep('download')}>
              Voltar
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Importar Clientes
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Processing */}
      {step === 'processing' && currentJob && (
        <div className="text-center space-y-6">
          <div className="mx-auto w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
            <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              3. Processando importação
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {currentJob.status === 'VALIDATING'
                ? 'Validando dados do arquivo...'
                : 'Importando clientes...'}
            </p>
          </div>

          <div className="max-w-md mx-auto space-y-2">
            <Progress value={getProgressPercentage(currentJob)} />
            <p className="text-sm text-gray-600">
              {currentJob.processedRows} de {currentJob.totalRows} linhas
              processadas
            </p>
          </div>
        </div>
      )}

      {/* Step 4: Result */}
      {step === 'result' && currentJob && (
        <div className="space-y-6">
          <div className="text-center">
            <div
              className={cn(
                'mx-auto w-16 h-16 rounded-full flex items-center justify-center',
                currentJob.status === 'COMPLETED' && currentJob.errorCount === 0
                  ? 'bg-green-100'
                  : currentJob.status === 'COMPLETED' && currentJob.errorCount > 0
                  ? 'bg-yellow-100'
                  : 'bg-red-100',
              )}
            >
              {currentJob.status === 'COMPLETED' && currentJob.errorCount === 0 ? (
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              ) : currentJob.status === 'COMPLETED' && currentJob.errorCount > 0 ? (
                <AlertCircle className="h-8 w-8 text-yellow-600" />
              ) : (
                <XCircle className="h-8 w-8 text-red-600" />
              )}
            </div>
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              {currentJob.status === 'COMPLETED' && currentJob.errorCount === 0
                ? 'Importação concluída!'
                : currentJob.status === 'COMPLETED' && currentJob.errorCount > 0
                ? 'Importação concluída com erros'
                : 'Falha na importação'}
            </h3>
          </div>

          {/* Summary */}
          <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {currentJob.totalRows}
              </p>
              <p className="text-sm text-gray-500">Total de linhas</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">
                {currentJob.successCount}
              </p>
              <p className="text-sm text-gray-500">Importados</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">
                {currentJob.errorCount}
              </p>
              <p className="text-sm text-gray-500">Erros</p>
            </div>
          </div>

          {/* Error details */}
          {currentJob.errorDetails && currentJob.errorDetails.length > 0 && (
            <div className="bg-red-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-red-800 mb-2">
                Detalhes dos erros:
              </h4>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {(currentJob.errorDetails as ErrorDetail[]).slice(0, 20).map(
                  (error, index) => (
                    <div
                      key={index}
                      className="text-sm text-red-700 bg-red-100 rounded px-3 py-2"
                    >
                      <span className="font-medium">Linha {error.row}:</span>{' '}
                      {error.message}
                      {error.value && (
                        <span className="text-red-500"> ({error.value})</span>
                      )}
                    </div>
                  ),
                )}
                {currentJob.errorDetails.length > 20 && (
                  <p className="text-sm text-red-600 italic">
                    ... e mais {currentJob.errorDetails.length - 20} erros
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-center space-x-4">
            <Button variant="outline" onClick={handleReset}>
              Nova Importação
            </Button>
            <Button onClick={handleGoToClients}>Ver Clientes</Button>
          </div>
        </div>
      )}
    </div>
  );
}
