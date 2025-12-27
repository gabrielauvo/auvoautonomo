'use client';

/**
 * AttachmentsSection - Seção de anexos/fotos da OS
 *
 * Exibe e permite gerenciar anexos:
 * - Upload de arquivos
 * - Visualização de imagens
 * - Download de arquivos
 * - Exclusão (quando editável)
 */

import { useState, useRef } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Skeleton,
  Alert,
} from '@/components/ui';
import {
  Paperclip,
  Upload,
  Download,
  Trash2,
  Image as ImageIcon,
  FileText,
  File,
  X,
  Loader2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { Attachment } from '@/services/work-orders.service';
import { cn } from '@/lib/utils';

interface AttachmentsSectionProps {
  attachments: Attachment[];
  isEditable?: boolean;
  isLoading?: boolean;
  isUploading?: boolean;
  onUpload?: (file: File) => Promise<void>;
  onDelete?: (attachmentId: string) => Promise<void>;
}

// Verificar se é imagem
function isImageFile(mimeType?: string): boolean {
  return mimeType?.startsWith('image/') ?? false;
}

// Verificar se é PDF
function isPdfFile(mimeType?: string): boolean {
  return mimeType === 'application/pdf';
}

// Formatar tamanho do arquivo
function formatFileSize(bytes?: number): string {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Ícone por tipo de arquivo
function getFileIcon(mimeType?: string) {
  if (isImageFile(mimeType)) return ImageIcon;
  if (isPdfFile(mimeType)) return FileText;
  return File;
}

// Obter URL do anexo
function getAttachmentUrl(attachment: Attachment): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // Se tem publicUrl
  if (attachment.publicUrl) {
    // Se é URL absoluta, usar diretamente
    if (attachment.publicUrl.startsWith('http://') || attachment.publicUrl.startsWith('https://')) {
      return attachment.publicUrl;
    }
    // Se é URL relativa, adicionar baseUrl
    return `${baseUrl}${attachment.publicUrl}`;
  }
  // Se tem storagePath, construir URL a partir dele
  if (attachment.storagePath) {
    return `${baseUrl}/uploads/${attachment.storagePath}`;
  }
  // Fallback: buscar via endpoint de download pelo ID
  return `${baseUrl}/attachments/${attachment.id}/download`;
}

// Card de anexo
function AttachmentCard({
  attachment,
  isEditable,
  onDelete,
}: {
  attachment: Attachment;
  isEditable: boolean;
  onDelete?: () => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
    }
  };

  const handleImageError = () => {
    const url = getAttachmentUrl(attachment);
    console.warn(`[AttachmentsSection] Failed to load image:`, {
      id: attachment.id,
      publicUrl: attachment.publicUrl,
      storagePath: attachment.storagePath,
      computedUrl: url,
    });
    setImageError(true);
  };

  const FileIcon = getFileIcon(attachment.mimeType);
  const isImage = isImageFile(attachment.mimeType);
  const attachmentUrl = getAttachmentUrl(attachment);
  const fileName = attachment.fileNameOriginal || 'arquivo';

  return (
    <>
      <div className="relative group border rounded-lg overflow-hidden bg-gray-50">
        {/* Preview de imagem */}
        {isImage && !imageError ? (
          <div
            className="aspect-square cursor-pointer"
            onClick={() => setShowPreview(true)}
          >
            <img
              src={attachmentUrl}
              alt={fileName}
              className="w-full h-full object-cover"
              onError={handleImageError}
            />
          </div>
        ) : isImage && imageError ? (
          <div className="aspect-square flex flex-col items-center justify-center p-4 bg-red-50">
            <AlertCircle className="h-10 w-10 text-red-400 mb-2" />
            <p className="text-xs text-red-600 text-center">
              Erro ao carregar
            </p>
            <p className="text-xs text-red-400 mt-1 truncate w-full text-center px-2">
              {fileName}
            </p>
          </div>
        ) : (
          <div className="aspect-square flex flex-col items-center justify-center p-4">
            <FileIcon className="h-10 w-10 text-gray-400 mb-2" />
            <p className="text-xs text-gray-600 text-center truncate w-full px-2">
              {fileName}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {formatFileSize(attachment.fileSize)}
            </p>
          </div>
        )}

        {/* Overlay com ações */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <a
            href={attachmentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors"
            title="Abrir"
          >
            <ExternalLink className="h-4 w-4 text-gray-700" />
          </a>
          <a
            href={attachmentUrl}
            download={fileName}
            className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors"
            title="Download"
          >
            <Download className="h-4 w-4 text-gray-700" />
          </a>
          {isEditable && onDelete && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="p-2 bg-white rounded-full hover:bg-error-50 transition-colors"
              title="Excluir"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 text-error animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 text-error" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Modal de preview */}
      {showPreview && isImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setShowPreview(false)}
        >
          <button
            className="absolute top-4 right-4 p-2 bg-white rounded-full"
            onClick={() => setShowPreview(false)}
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={attachmentUrl}
            alt={fileName}
            className="max-w-[90vw] max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

export function AttachmentsSection({
  attachments,
  isEditable = false,
  isLoading = false,
  isUploading = false,
  onUpload,
  onDelete,
}: AttachmentsSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUpload) return;

    setError(null);

    // Validar tamanho (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Arquivo muito grande. Máximo 10MB.');
      return;
    }

    try {
      await onUpload(file);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer upload');
    }

    // Limpar input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Paperclip className="h-5 w-5" />
            Anexos e Fotos
            {attachments.length > 0 && (
              <span className="text-sm font-normal text-gray-500">
                ({attachments.length})
              </span>
            )}
          </CardTitle>

          {isEditable && onUpload && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                onChange={handleFileSelect}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                leftIcon={
                  isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )
                }
              >
                {isUploading ? 'Enviando...' : 'Adicionar'}
              </Button>
            </>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {error && (
          <Alert variant="error" className="mb-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          </Alert>
        )}

        {attachments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Paperclip className="h-10 w-10 text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">Nenhum anexo</p>
            {isEditable && (
              <p className="text-xs text-gray-400 mt-1">
                Adicione fotos ou documentos
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {attachments.map((attachment) => (
              <AttachmentCard
                key={attachment.id}
                attachment={attachment}
                isEditable={isEditable}
                onDelete={onDelete ? () => onDelete(attachment.id) : undefined}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default AttachmentsSection;
