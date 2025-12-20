'use client';

/**
 * AttachmentsContainer - Container de anexos da OS
 *
 * Gerencia:
 * - Listagem de anexos
 * - Upload de novos arquivos
 * - Exclusão de anexos
 */

import {
  Card,
  CardContent,
  Skeleton,
  Alert,
  EmptyState,
} from '@/components/ui';
import { AttachmentsSection } from './attachments-section';
import { Camera, AlertCircle } from 'lucide-react';
import {
  useWorkOrderAttachments,
  useUploadWorkOrderAttachment,
  useDeleteAttachment,
} from '@/hooks/use-work-orders';

interface AttachmentsContainerProps {
  workOrderId: string;
  canUpload: boolean;
}

export function AttachmentsContainer({
  workOrderId,
  canUpload,
}: AttachmentsContainerProps) {
  // Queries
  const { data: attachments, isLoading, error, refetch } = useWorkOrderAttachments(workOrderId);

  // Mutations
  const uploadAttachment = useUploadWorkOrderAttachment();
  const deleteAttachment = useDeleteAttachment();

  // Upload de arquivo
  const handleUpload = async (file: File) => {
    await uploadAttachment.mutateAsync({ workOrderId, file });
    refetch();
  };

  // Deletar anexo
  const handleDelete = async (attachmentId: string) => {
    await deleteAttachment.mutateAsync({ attachmentId, workOrderId });
    refetch();
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Alert variant="error">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          Erro ao carregar anexos
        </div>
      </Alert>
    );
  }

  // Se não há anexos e não pode fazer upload
  if (!attachments?.length && !canUpload) {
    return (
      <Card>
        <CardContent className="py-8">
          <EmptyState
            icon={Camera}
            title="Nenhum anexo"
            description="Esta OS não possui anexos ou fotos"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <AttachmentsSection
      attachments={attachments || []}
      isEditable={canUpload}
      isLoading={deleteAttachment.isPending}
      isUploading={uploadAttachment.isPending}
      onUpload={handleUpload}
      onDelete={handleDelete}
    />
  );
}

export default AttachmentsContainer;
