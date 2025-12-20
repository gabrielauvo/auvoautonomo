'use client';

/**
 * UploadLogo Component
 *
 * Upload e preview de logo da empresa
 */

import { useState, useRef } from 'react';
import { Upload, X, ImageIcon, AlertCircle } from 'lucide-react';
import { Button, Alert, Spinner } from '@/components/ui';
import { cn } from '@/lib/utils';
import { getUploadUrl } from '@/services/api';

interface UploadLogoProps {
  currentLogoUrl?: string;
  onUpload: (file: File) => Promise<void>;
  onRemove?: () => Promise<void>;
  isUploading?: boolean;
  maxSizeMB?: number;
  acceptedFormats?: string[];
}

const DEFAULT_ACCEPTED_FORMATS = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const DEFAULT_MAX_SIZE_MB = 2;

export function UploadLogo({
  currentLogoUrl,
  onUpload,
  onRemove,
  isUploading = false,
  maxSizeMB = DEFAULT_MAX_SIZE_MB,
  acceptedFormats = DEFAULT_ACCEPTED_FORMATS,
}: UploadLogoProps) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  const validateFile = (file: File): string | null => {
    if (!acceptedFormats.includes(file.type)) {
      return `Formato não suportado. Use: ${acceptedFormats.map((f) => f.split('/')[1].toUpperCase()).join(', ')}`;
    }
    if (file.size > maxSizeBytes) {
      return `Arquivo muito grande. Máximo: ${maxSizeMB}MB`;
    }
    return null;
  };

  const handleFile = async (file: File) => {
    setError(null);

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    // Criar preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    try {
      await onUpload(file);
      setPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer upload');
      setPreview(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
    // Reset input
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    if (onRemove) {
      try {
        await onRemove();
        setPreview(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao remover logo');
      }
    }
  };

  // Para preview local (data URL), usar diretamente
  // Para URL do servidor, prefixar com URL base do backend
  // Garantir que strings vazias sejam tratadas como null
  const serverUrl = currentLogoUrl && currentLogoUrl.trim() ? getUploadUrl(currentLogoUrl) : null;
  const displayUrl = preview || serverUrl;

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Logo da Empresa
      </label>

      {error && (
        <Alert variant="error" className="py-2">
          <div className="flex items-center gap-2 text-sm">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        </Alert>
      )}

      <div className="flex items-start gap-4">
        {/* Preview */}
        <div
          className={cn(
            'relative w-32 h-32 border-2 border-dashed rounded-lg overflow-hidden',
            'flex items-center justify-center bg-gray-50',
            dragOver && 'border-primary bg-primary-50'
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          {isUploading ? (
            <Spinner size="lg" />
          ) : displayUrl ? (
            <img
              src={displayUrl}
              alt="Logo"
              className="w-full h-full object-contain p-2"
            />
          ) : (
            <div className="text-center p-4">
              <ImageIcon className="h-8 w-8 mx-auto text-gray-300 mb-1" />
              <p className="text-xs text-gray-400">Sem logo</p>
            </div>
          )}

          {/* Remove button */}
          {displayUrl && !isUploading && onRemove && (
            <button
              type="button"
              onClick={handleRemove}
              className="absolute -top-2 -right-2 p-1 bg-error text-white rounded-full shadow hover:bg-error-600 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Upload area */}
        <div className="flex-1 space-y-3">
          <div
            className={cn(
              'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
              dragOver ? 'border-primary bg-primary-50' : 'border-gray-200 hover:border-gray-300'
            )}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
            <p className="text-sm text-gray-600">
              Arraste uma imagem ou{' '}
              <span className="text-primary font-medium">clique para selecionar</span>
            </p>
            <p className="text-xs text-gray-400 mt-1">
              PNG, JPG ou WebP (máx. {maxSizeMB}MB)
            </p>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept={acceptedFormats.join(',')}
            onChange={handleInputChange}
            className="hidden"
          />

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={isUploading}
              leftIcon={<Upload className="h-4 w-4" />}
            >
              Selecionar arquivo
            </Button>
            {displayUrl && onRemove && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemove}
                disabled={isUploading}
                className="text-error"
              >
                Remover
              </Button>
            )}
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-500">
        Recomendamos uma imagem quadrada com pelo menos 200x200 pixels.
        A logo será usada em orçamentos, OS e cobranças.
      </p>
    </div>
  );
}

export default UploadLogo;
