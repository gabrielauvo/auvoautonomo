'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Loader2, Download, Share2, ExternalLink } from 'lucide-react';
import { usePdfGeneration } from '@/hooks/use-pdf-generation';
import { PdfEntityType, getPublicPdfUrl } from '@/services/pdf-jobs.service';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface PdfButtonProps {
  entityType: PdfEntityType;
  entityId: string;
  existingPdfToken?: string | null;
  existingAttachmentId?: string | null;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'sm' | 'default' | 'lg' | 'icon';
  showLabel?: boolean;
}

export function PdfButton({
  entityType,
  entityId,
  existingPdfToken,
  variant = 'outline',
  size = 'sm',
  showLabel = true,
}: PdfButtonProps) {
  const { generateAndDownload, generateAndShare, isGenerating, progress } = usePdfGeneration();
  const [isOpen, setIsOpen] = useState(false);

  const hasPdf = !!existingPdfToken;

  const handleDownload = async () => {
    setIsOpen(false);
    if (existingPdfToken) {
      window.open(getPublicPdfUrl(existingPdfToken), '_blank');
    } else {
      await generateAndDownload(entityType, entityId);
    }
  };

  const handleShare = async () => {
    setIsOpen(false);
    if (existingPdfToken) {
      const url = getPublicPdfUrl(existingPdfToken);
      await navigator.clipboard.writeText(url);
    } else {
      await generateAndShare(entityType, entityId);
    }
  };

  const handleView = () => {
    setIsOpen(false);
    if (existingPdfToken) {
      window.open(getPublicPdfUrl(existingPdfToken), '_blank');
    }
  };

  const handleGenerate = async () => {
    setIsOpen(false);
    await generateAndDownload(entityType, entityId);
  };

  if (isGenerating) {
    return (
      <Button variant={variant} size={size} disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
        {showLabel && <span className="ml-2">{progress || 'Gerando...'}</span>}
      </Button>
    );
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size}>
          <FileText className="h-4 w-4" />
          {showLabel && <span className="ml-2">PDF</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {hasPdf && (
          <>
            <DropdownMenuItem onClick={handleView}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Visualizar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" />
              Baixar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleShare}>
              <Share2 className="mr-2 h-4 w-4" />
              Copiar link
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuItem onClick={handleGenerate}>
          <FileText className="mr-2 h-4 w-4" />
          {hasPdf ? 'Gerar novo PDF' : 'Gerar PDF'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PdfDownloadButton({
  entityType,
  entityId,
  variant = 'outline',
  size = 'sm',
}: Omit<PdfButtonProps, 'existingPdfToken' | 'existingAttachmentId' | 'showLabel'>) {
  const { generateAndDownload, isGenerating, progress } = usePdfGeneration();

  const handleClick = async () => {
    await generateAndDownload(entityType, entityId);
  };

  return (
    <Button variant={variant} size={size} onClick={handleClick} disabled={isGenerating}>
      {isGenerating ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {progress || 'Gerando...'}
        </>
      ) : (
        <>
          <FileText className="mr-2 h-4 w-4" />
          Gerar PDF
        </>
      )}
    </Button>
  );
}

export function PdfShareButton({
  entityType,
  entityId,
  variant = 'outline',
  size = 'sm',
}: Omit<PdfButtonProps, 'existingPdfToken' | 'existingAttachmentId' | 'showLabel'>) {
  const { generateAndShare, isGenerating, progress } = usePdfGeneration();

  const handleClick = async () => {
    await generateAndShare(entityType, entityId);
  };

  return (
    <Button variant={variant} size={size} onClick={handleClick} disabled={isGenerating}>
      {isGenerating ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {progress || 'Gerando...'}
        </>
      ) : (
        <>
          <Share2 className="mr-2 h-4 w-4" />
          Compartilhar PDF
        </>
      )}
    </Button>
  );
}

export default PdfButton;
