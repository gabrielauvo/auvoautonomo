'use client';

/**
 * Página pública de visualização do Orçamento
 * Acessível via link compartilhável sem autenticação
 * Permite aprovar (com assinatura) ou rejeitar o orçamento
 *
 * Layout profissional estilo documento comercial
 */

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from '@/i18n';
import { useFormatting } from '@/hooks/use-formatting';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Phone,
  Mail,
  User,
  MapPin,
  X,
  ZoomIn,
  ChevronLeft,
  ChevronRight,
  XCircle,
  Send,
  Image as ImageIcon,
  PenTool,
  Trash2,
  ScrollText,
  Check,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface QuoteData {
  id: string;
  status: string;
  notes: string | null;
  discountValue: number;
  totalValue: number;
  sentAt: string | null;
  visitScheduledAt: string | null;
  validUntil: string | null;
  createdAt: string;
  company: {
    name: string;
    email: string | null;
    phone: string | null;
    logoUrl: string | null;
  };
  client: {
    name: string;
    taxId: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    notes: string | null;
  };
  items: Array<{
    name: string;
    type: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    discountValue: number;
    totalPrice: number;
    description?: string;
    imageUrl?: string;
    optional?: boolean;
  }>;
  signature: {
    signerName: string | null;
    signerDocument: string | null;
    signedAt: string | null;
    imageUrl: string | null;
  } | null;
  attachments: Array<{
    id: string;
    url: string;
    type: string;
    mimeType: string;
    createdAt: string;
  }>;
  template?: {
    primaryColor: string;
    secondaryColor: string;
    showLogo: boolean;
    logoPosition: string;
    footerText: string | null;
  };
}

const statusStyles: Record<string, { color: string; bgColor: string; icon: any }> = {
  DRAFT: { color: 'text-gray-700', bgColor: 'bg-gray-100', icon: FileText },
  SENT: { color: 'text-blue-700', bgColor: 'bg-blue-100', icon: Send },
  APPROVED: { color: 'text-green-700', bgColor: 'bg-green-100', icon: CheckCircle2 },
  REJECTED: { color: 'text-red-700', bgColor: 'bg-red-100', icon: XCircle },
  EXPIRED: { color: 'text-yellow-700', bgColor: 'bg-yellow-100', icon: Clock },
};

// Componente de Canvas para assinatura
function SignaturePad({
  onSignatureChange,
  t,
}: {
  onSignatureChange: (dataUrl: string | null) => void;
  t: (key: string) => string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const getContext = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.strokeStyle = '#1e3a5f';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
    return ctx;
  }, []);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const ctx = getContext();
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;

    const ctx = getContext();
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    if (isDrawing && hasSignature) {
      const canvas = canvasRef.current;
      if (canvas) {
        onSignatureChange(canvas.toDataURL('image/png'));
      }
    }
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasSignature(false);
      onSignatureChange(null);
    }
  };

  // Setup canvas on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = 400;
      canvas.height = 150;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, []);

  return (
    <div className="space-y-2">
      <div className="relative border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          className="w-full h-[150px] touch-none cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {!hasSignature && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-gray-400 text-sm">{t('signHere')}</span>
          </div>
        )}
      </div>
      {hasSignature && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={clearSignature}
          className="w-full"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          {t('clearSignature')}
        </Button>
      )}
    </div>
  );
}

// Modal de Assinatura e Aprovação
function SignatureModal({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting,
  clientName,
  t,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: { imageBase64: string; signerName: string; signerDocument?: string }) => void;
  isSubmitting: boolean;
  clientName: string;
  t: (key: string) => string;
}) {
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [signerName, setSignerName] = useState(clientName || '');
  const [signerDocument, setSignerDocument] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSignerName(clientName || '');
      setSignerDocument('');
      setSignatureDataUrl(null);
      setError(null);
    }
  }, [isOpen, clientName]);

  const handleConfirm = () => {
    if (!signerName.trim()) {
      setError(t('errorNameRequired'));
      return;
    }
    if (!signatureDataUrl) {
      setError(t('errorSignatureRequired'));
      return;
    }

    onConfirm({
      imageBase64: signatureDataUrl,
      signerName: signerName.trim(),
      signerDocument: signerDocument.trim() || undefined,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <PenTool className="h-5 w-5 text-green-600" />
              {t('signAndApprove')}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              disabled={isSubmitting}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="signerName" className="block text-sm font-medium text-gray-700 mb-1">
                {t('fullName')} *
              </label>
              <Input
                id="signerName"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder={t('fullNamePlaceholder')}
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="signerDocument" className="block text-sm font-medium text-gray-700 mb-1">
                {t('documentOptional')}
              </label>
              <Input
                id="signerDocument"
                value={signerDocument}
                onChange={(e) => setSignerDocument(e.target.value)}
                placeholder="000.000.000-00"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('signature')} *
              </label>
              <SignaturePad onSignatureChange={setSignatureDataUrl} t={t} />
            </div>

            {error && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {error}
              </p>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1"
                disabled={isSubmitting}
              >
                {t('cancel')}
              </Button>
              <Button
                onClick={handleConfirm}
                className="flex-1 bg-green-600 hover:bg-green-700"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('approving')}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    {t('approveQuote')}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Modal de Rejeição
function RejectModal({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting,
  t,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => void;
  isSubmitting: boolean;
  t: (key: string) => string;
}) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (isOpen) {
      setReason('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              {t('rejectQuote')}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              disabled={isSubmitting}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="space-y-4">
            <p className="text-gray-600">
              {t('rejectConfirmation')}
            </p>

            <div>
              <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">
                {t('rejectReasonOptional')}
              </label>
              <textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t('rejectReasonPlaceholder')}
                rows={3}
                disabled={isSubmitting}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1"
                disabled={isSubmitting}
              >
                {t('cancel')}
              </Button>
              <Button
                onClick={() => onConfirm(reason.trim() || undefined)}
                variant="error"
                className="flex-1"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('rejecting')}
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    {t('rejectQuote')}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Modal de Termos de Aceite
function AcceptanceTermsModal({
  isOpen,
  onClose,
  onAccept,
  termsContent,
  version,
  t,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
  termsContent: string | null;
  version: number;
  t: (key: string) => string;
}) {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setHasScrolledToBottom(false);
      setIsChecked(false);
    }
  }, [isOpen]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const isAtBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 50;
    if (isAtBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
    }
  }, [hasScrolledToBottom]);

  const canAccept = hasScrolledToBottom && isChecked;

  if (!isOpen || !termsContent) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <ScrollText className="h-5 w-5 text-primary" />
              {t('acceptanceTerms')}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {t('acceptanceTermsInstructions')}
          </p>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6"
          onScroll={handleScroll}
        >
          <div className="prose prose-sm max-w-none whitespace-pre-wrap">
            {termsContent}
          </div>
          {!hasScrolledToBottom && (
            <div className="flex items-center justify-center gap-2 text-gray-400 mt-4 animate-bounce">
              <ChevronLeft className="h-4 w-4 rotate-[-90deg]" />
              <span className="text-sm">{t('scrollToReadTerms')}</span>
            </div>
          )}
        </div>

        <div className="p-6 border-t space-y-4">
          <label
            className={`flex items-start gap-3 cursor-pointer ${!hasScrolledToBottom ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <input
              type="checkbox"
              checked={isChecked}
              onChange={(e) => hasScrolledToBottom && setIsChecked(e.target.checked)}
              disabled={!hasScrolledToBottom}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-50"
            />
            <span className="text-sm text-gray-700">
              {t('acceptTermsCheckbox')}
            </span>
          </label>

          {version > 0 && (
            <p className="text-xs text-gray-500">{t('version')}: {version}</p>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              {t('cancel')}
            </Button>
            <Button
              onClick={onAccept}
              className="flex-1 bg-green-600 hover:bg-green-700"
              disabled={!canAccept}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {t('acceptAndContinue')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Componente Lightbox para visualização de fotos em tela cheia
function ImageLightbox({
  images,
  currentIndex,
  onClose,
  onPrev,
  onNext,
}: {
  images: { url: string; caption?: string }[];
  currentIndex: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const currentImage = images[currentIndex];

  // Fechar com tecla ESC e navegar com setas
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onPrev, onNext]);

  if (!currentImage) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center">
      {/* Botão fechar */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 text-white hover:text-gray-300 transition-colors z-10"
        aria-label="Fechar"
      >
        <X className="h-8 w-8" />
      </button>

      {/* Contador de imagens */}
      <div className="absolute top-4 left-4 text-white text-sm bg-black/50 px-3 py-1 rounded-full">
        {currentIndex + 1} / {images.length}
      </div>

      {/* Botão anterior */}
      {images.length > 1 && (
        <button
          onClick={onPrev}
          className="absolute left-4 p-2 text-white hover:text-gray-300 transition-colors"
          aria-label="Anterior"
        >
          <ChevronLeft className="h-10 w-10" />
        </button>
      )}

      {/* Imagem */}
      <div className="max-w-[90vw] max-h-[90vh] flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={currentImage.url}
          alt={currentImage.caption || 'Foto'}
          className="max-w-full max-h-[85vh] object-contain"
        />
      </div>

      {/* Botão próximo */}
      {images.length > 1 && (
        <button
          onClick={onNext}
          className="absolute right-4 p-2 text-white hover:text-gray-300 transition-colors"
          aria-label="Próximo"
        >
          <ChevronRight className="h-10 w-10" />
        </button>
      )}

      {/* Legenda */}
      {currentImage.caption && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-center bg-black/50 px-4 py-2 rounded-lg max-w-lg">
          {currentImage.caption}
        </div>
      )}
    </div>
  );
}

export default function PublicQuotePage() {
  const params = useParams();
  const shareKey = params.shareKey as string;
  const { t } = useTranslations('publicQuote');
  const { formatCurrency, formatDate, formatDateTime } = useFormatting();

  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estado dos modais de aprovação/rejeição
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<'approved' | 'rejected' | null>(null);

  // Estado dos termos de aceite
  const [acceptanceTerms, setAcceptanceTerms] = useState<{
    required: boolean;
    termsContent: string | null;
    version: number;
    termsHash: string | null;
  } | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Estado do lightbox
  const [lightboxImages, setLightboxImages] = useState<{ url: string; caption?: string }[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Funções do lightbox
  const openLightbox = (images: { url: string; caption?: string }[], index: number) => {
    setLightboxImages(images);
    setLightboxIndex(index);
    setLightboxOpen(true);
    document.body.style.overflow = 'hidden';
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
    document.body.style.overflow = '';
  };

  const prevImage = () => {
    setLightboxIndex((prev) => (prev > 0 ? prev - 1 : lightboxImages.length - 1));
  };

  const nextImage = () => {
    setLightboxIndex((prev) => (prev < lightboxImages.length - 1 ? prev + 1 : 0));
  };

  // Função para aprovar com assinatura
  const handleSignAndApprove = async (data: { imageBase64: string; signerName: string; signerDocument?: string }) => {
    setIsSubmitting(true);
    try {
      // Incluir dados de aceite dos termos se foram aceitos
      const requestBody: any = { ...data };
      if (acceptanceTerms?.required && termsAccepted) {
        requestBody.termsAcceptedAt = new Date().toISOString();
        requestBody.termsHash = acceptanceTerms.termsHash;
        requestBody.termsVersion = acceptanceTerms.version;
      }

      const response = await fetch(`${API_URL}/public/quotes/${shareKey}/sign-and-approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || t('errorApproving'));
      }

      setActionSuccess('approved');
      setSignatureModalOpen(false);
      // Recarregar dados do orçamento
      const updatedResponse = await fetch(`${API_URL}/public/quotes/${shareKey}`);
      if (updatedResponse.ok) {
        const updatedData = await updatedResponse.json();
        setQuote(updatedData);
      }
    } catch (err: any) {
      console.error('Error approving quote:', err);
      alert(err.message || t('errorApprovingRetry'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Função para rejeitar
  const handleReject = async (reason?: string) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/public/quotes/${shareKey}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || t('errorRejecting'));
      }

      setActionSuccess('rejected');
      setRejectModalOpen(false);
      // Recarregar dados do orçamento
      const updatedResponse = await fetch(`${API_URL}/public/quotes/${shareKey}`);
      if (updatedResponse.ok) {
        const updatedData = await updatedResponse.json();
        setQuote(updatedData);
      }
    } catch (err: any) {
      console.error('Error rejecting quote:', err);
      alert(err.message || t('errorRejectingRetry'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mensagens de erro traduzidas (para uso no useEffect)
  const errorMessages = useMemo(() => ({
    notFound: t('errorNotFoundOrInvalid'),
    loadError: t('errorLoading'),
    connectionError: t('errorConnection'),
  }), [t]);

  useEffect(() => {
    async function fetchQuote() {
      try {
        const response = await fetch(`${API_URL}/public/quotes/${shareKey}`);

        if (!response.ok) {
          if (response.status === 404) {
            setError(errorMessages.notFound);
          } else {
            setError(errorMessages.loadError);
          }
          return;
        }

        const data = await response.json();
        setQuote(data);

        // Buscar termos de aceite
        try {
          const termsResponse = await fetch(`${API_URL}/public/quotes/${shareKey}/acceptance-terms`);
          if (termsResponse.ok) {
            const termsData = await termsResponse.json();
            setAcceptanceTerms(termsData);
            // Se termos nao sao obrigatorios, marcar como aceitos
            if (!termsData.required) {
              setTermsAccepted(true);
            }
          }
        } catch (termsErr) {
          console.error('Error fetching acceptance terms:', termsErr);
          // Se falhar, assumir que nao ha termos obrigatorios
          setTermsAccepted(true);
        }
      } catch (err) {
        console.error('Error fetching quote:', err);
        setError(errorMessages.connectionError);
      } finally {
        setLoading(false);
      }
    }

    if (shareKey) {
      fetchQuote();
    }
  }, [shareKey]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-green-600 mx-auto mb-4" />
          <p className="text-gray-600">{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('invalidLink')}</h2>
          <p className="text-gray-600">{error || t('quoteNotFound')}</p>
        </div>
      </div>
    );
  }

  const statusStyle = statusStyles[quote.status] || statusStyles.DRAFT;
  const StatusIcon = statusStyle.icon;

  // Labels de status localizados
  const statusLabels = useMemo(() => ({
    DRAFT: t('status.draft'),
    SENT: t('status.sent'),
    APPROVED: t('status.approved'),
    REJECTED: t('status.rejected'),
    EXPIRED: t('status.expired'),
  }), [t]);

  // Cores do template (fallback para verde padrão)
  const primaryColor = quote.template?.primaryColor || '#16a34a';

  // Calcular subtotal dos itens
  const subtotal = quote.items.reduce((sum, item) => sum + item.totalPrice, 0);

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      {/* Documento principal - estilo papel A4 */}
      <div className="max-w-4xl mx-auto py-8 px-4 print:p-0">
        <div className="bg-white shadow-lg rounded-lg overflow-hidden print:shadow-none print:rounded-none">

          {/* Header do documento */}
          <div className="border-b-4" style={{ borderColor: primaryColor }}>
            <div className="p-6 md:p-8">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                {/* Logo e info da empresa */}
                <div className="flex items-start gap-4">
                  {quote.company.logoUrl ? (
                    <div className="w-20 h-20 rounded-lg overflow-hidden border bg-white flex items-center justify-center flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={quote.company.logoUrl}
                        alt={quote.company.name}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                      <div className="hidden w-full h-full items-center justify-center">
                        <Building2 className="h-10 w-10" style={{ color: primaryColor }} />
                      </div>
                    </div>
                  ) : (
                    <div
                      className="w-20 h-20 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${primaryColor}1A` }}
                    >
                      <Building2 className="h-10 w-10" style={{ color: primaryColor }} />
                    </div>
                  )}
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">{quote.company.name}</h1>
                    {quote.company.phone && (
                      <p className="text-sm text-gray-600 flex items-center gap-2 mt-1">
                        <Phone className="h-4 w-4" />
                        {quote.company.phone}
                      </p>
                    )}
                    {quote.company.email && (
                      <p className="text-sm text-gray-600 flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        {quote.company.email}
                      </p>
                    )}
                  </div>
                </div>

                {/* Número e data do orçamento */}
                <div className="text-left md:text-right">
                  <div className="inline-block">
                    <p className="text-sm text-gray-500 uppercase tracking-wide">{t('quote')}</p>
                    <p className="text-2xl font-bold text-gray-900">
                      #{quote.id.substring(0, 8).toUpperCase()}
                    </p>
                    <div className="mt-2 space-y-1">
                      <p className="text-sm text-gray-600 flex items-center gap-2 md:justify-end">
                        <Calendar className="h-4 w-4" />
                        {formatDate(quote.createdAt)}
                      </p>
                      {quote.validUntil && (
                        <p className="text-sm text-gray-500">
                          {t('validUntil')}: {formatDate(quote.validUntil)}
                        </p>
                      )}
                    </div>
                    <Badge className={`mt-3 ${statusStyle.bgColor} ${statusStyle.color}`}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {statusLabels[quote.status as keyof typeof statusLabels] || quote.status}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Informações do cliente */}
          <div className="bg-gray-50 border-b px-6 py-4 md:px-8">
            <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-gray-400" />
                <span className="text-gray-500">{t('client')}:</span>
                <span className="font-medium text-gray-900">{quote.client.name}</span>
              </div>
              {quote.client.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-700">{quote.client.phone}</span>
                </div>
              )}
              {quote.client.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-700">{quote.client.email}</span>
                </div>
              )}
              {quote.client.address && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-700">{quote.client.address}</span>
                </div>
              )}
            </div>
          </div>

          {/* Observações (se houver) */}
          {quote.notes && (
            <div className="px-6 py-4 md:px-8 bg-yellow-50 border-b">
              <p className="text-sm text-yellow-800">
                <span className="font-medium">{t('notes')}:</span> {quote.notes}
              </p>
            </div>
          )}

          {/* Tabela de itens */}
          {quote.items.length > 0 && (
            <div className="px-6 py-6 md:px-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('quoteItems')}</h2>

              {/* Tabela desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2" style={{ borderColor: primaryColor }}>
                      <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700 w-8"></th>
                      <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700">{t('description')}</th>
                      <th className="text-center py-3 px-2 text-sm font-semibold text-gray-700 w-20">{t('qty')}</th>
                      <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700 w-28">{t('unitPrice')}</th>
                      <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700 w-28">{t('total')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {quote.items.map((item, index) => (
                      <tr key={index} className={`hover:bg-gray-50 ${item.optional ? 'bg-blue-50/50' : ''}`}>
                        <td className="py-4 px-2">
                          <div
                            className="w-5 h-5 rounded border-2 flex items-center justify-center"
                            style={{ borderColor: primaryColor }}
                          >
                            {!item.optional && (
                              <Check className="w-3 h-3" style={{ color: primaryColor }} />
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-2">
                          <div className="flex items-start gap-3">
                            {item.imageUrl && (
                              <div className="w-12 h-12 rounded overflow-hidden border bg-gray-100 flex-shrink-0">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={item.imageUrl}
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                            <div>
                              <p className="font-medium text-gray-900">
                                {item.name}
                                {item.optional && (
                                  <span className="ml-2 text-xs font-normal text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
                                    {t('optional')}
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-gray-500">
                                {item.type === 'SERVICE' ? t('service') : t('product')} • {item.unit}
                              </p>
                              {item.description && (
                                <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-2 text-center text-gray-700">
                          {item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(2)}
                        </td>
                        <td className="py-4 px-2 text-right text-gray-700">
                          {formatCurrency(item.unitPrice)}
                        </td>
                        <td className="py-4 px-2 text-right font-semibold text-gray-900">
                          {formatCurrency(item.totalPrice)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Cards mobile */}
              <div className="md:hidden space-y-4">
                {quote.items.map((item, index) => (
                  <div
                    key={index}
                    className={`border rounded-lg p-4 ${item.optional ? 'bg-blue-50/50 border-blue-200' : 'bg-white'}`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-1"
                        style={{ borderColor: primaryColor }}
                      >
                        {!item.optional && (
                          <Check className="w-3 h-3" style={{ color: primaryColor }} />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {item.name}
                          {item.optional && (
                            <span className="ml-2 text-xs font-normal text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
                              {t('optional')}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {item.type === 'SERVICE' ? t('service') : t('product')} • {item.unit}
                        </p>
                        <div className="flex justify-between mt-2">
                          <span className="text-sm text-gray-600">
                            {item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(2)} x {formatCurrency(item.unitPrice)}
                          </span>
                          <span className="font-semibold text-gray-900">
                            {formatCurrency(item.totalPrice)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totais */}
              <div className="mt-6 flex justify-end">
                <div className="w-full md:w-72">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">{t('subtotal')}:</span>
                      <span className="text-gray-900">{formatCurrency(subtotal)}</span>
                    </div>
                    {quote.discountValue > 0 && (
                      <div className="flex justify-between text-sm text-red-600">
                        <span>{t('discount')}:</span>
                        <span>-{formatCurrency(quote.discountValue)}</span>
                      </div>
                    )}
                    <div
                      className="flex justify-between pt-3 border-t-2 font-bold text-lg"
                      style={{ borderColor: primaryColor }}
                    >
                      <span className="text-gray-900">{t('total')}:</span>
                      <span style={{ color: primaryColor }}>{formatCurrency(quote.totalValue)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Fotos/Anexos */}
          {quote.attachments.length > 0 && (
            <div className="px-6 py-6 md:px-8 border-t">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {t('attachments')} ({quote.attachments.length})
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {quote.attachments.map((attachment, index) => {
                  const isImage = attachment.mimeType?.startsWith('image/');
                  const hasUrl = !!attachment.url;

                  if (isImage && hasUrl) {
                    return (
                      <button
                        key={attachment.id}
                        className="relative aspect-square rounded-lg overflow-hidden border bg-gray-100 cursor-pointer group"
                        onClick={() => {
                          const images = quote.attachments
                            .filter((att) => att.mimeType?.startsWith('image/') && att.url)
                            .map((att) => ({ url: att.url!, caption: formatDateTime(att.createdAt) }));
                          const imageIndex = images.findIndex((img) => img.url === attachment.url);
                          openLightbox(images, imageIndex >= 0 ? imageIndex : 0);
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={attachment.url}
                          alt="Anexo"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                          <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </button>
                    );
                  }

                  return (
                    <a
                      key={attachment.id}
                      href={attachment.url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="aspect-square rounded-lg overflow-hidden border bg-gray-100 cursor-pointer flex flex-col items-center justify-center hover:bg-gray-200 transition-colors"
                    >
                      <FileText className="h-10 w-10 text-gray-400" />
                      <span className="text-xs text-gray-500 mt-2">
                        {attachment.mimeType === 'application/pdf' ? 'PDF' : t('document')}
                      </span>
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Área de assinatura */}
          <div className="px-6 py-6 md:px-8 border-t bg-gray-50">
            {quote.signature ? (
              // Assinatura existente
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('signature')}</h2>
                <div className="flex flex-col md:flex-row md:items-end gap-6">
                  <div className="flex-1">
                    {quote.signature.imageUrl && (
                      <div className="border-b-2 border-gray-400 pb-2 mb-2 max-w-xs">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={quote.signature.imageUrl}
                          alt={t('signature')}
                          className="h-16 object-contain"
                        />
                      </div>
                    )}
                    <p className="font-medium text-gray-900">{quote.signature.signerName}</p>
                    {quote.signature.signerDocument && (
                      <p className="text-sm text-gray-500">{t('documentId')}: {quote.signature.signerDocument}</p>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">
                    <p>{t('signedAt')}:</p>
                    <p className="font-medium text-gray-700">{formatDateTime(quote.signature.signedAt)}</p>
                  </div>
                </div>
              </div>
            ) : (quote.status === 'SENT' || quote.status === 'DRAFT') && !actionSuccess ? (
              // Área para assinar
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">{t('clientSignature')}</h2>
                <p className="text-sm text-gray-600 mb-4">
                  {t('signatureInstructions')}
                </p>

                {/* Card de Termos de Aceite (se obrigatório) */}
                {acceptanceTerms?.required && (
                  <div
                    className={`mb-4 p-4 rounded-lg border cursor-pointer ${
                      termsAccepted
                        ? 'bg-green-50 border-green-200'
                        : 'bg-yellow-50 border-yellow-200'
                    }`}
                    onClick={() => setTermsModalOpen(true)}
                  >
                    <div className="flex items-center gap-3">
                      {termsAccepted ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <ScrollText className="h-5 w-5 text-yellow-600" />
                      )}
                      <div className="flex-1">
                        <p className={`font-medium ${termsAccepted ? 'text-green-800' : 'text-yellow-800'}`}>
                          {t('acceptanceTerms')}
                        </p>
                        <p className={`text-sm ${termsAccepted ? 'text-green-600' : 'text-yellow-600'}`}>
                          {termsAccepted
                            ? t('termsAcceptedReady')
                            : t('readAndAcceptTerms')}
                        </p>
                      </div>
                      <ChevronRight className={`h-5 w-5 ${termsAccepted ? 'text-green-400' : 'text-yellow-400'}`} />
                    </div>
                  </div>
                )}

                {/* Botões de ação */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={() => {
                      if (acceptanceTerms?.required && !termsAccepted) {
                        setTermsModalOpen(true);
                      } else {
                        setSignatureModalOpen(true);
                      }
                    }}
                    className="flex-1 py-6 text-lg"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <PenTool className="h-5 w-5 mr-2" />
                    {t('signAndApprove')}
                  </Button>
                  <Button
                    onClick={() => setRejectModalOpen(true)}
                    variant="outline"
                    className="sm:w-auto border-gray-300 text-gray-700 hover:bg-gray-100"
                  >
                    <XCircle className="h-5 w-5 mr-2" />
                    {t('reject')}
                  </Button>
                </div>
              </div>
            ) : actionSuccess ? (
              // Mensagem de sucesso
              <div className="text-center py-4">
                {actionSuccess === 'approved' ? (
                  <div className="flex items-center justify-center gap-3">
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                    <div>
                      <h3 className="text-lg font-semibold text-green-600">{t('quoteApproved')}</h3>
                      <p className="text-gray-600">{t('thankYouApproval')}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-3">
                    <XCircle className="h-8 w-8 text-red-600" />
                    <div>
                      <h3 className="text-lg font-semibold text-red-600">{t('quoteRejected')}</h3>
                      <p className="text-gray-600">{t('quoteWasRejected')}</p>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Rodapé */}
          <div className="px-6 py-4 md:px-8 border-t bg-white text-center text-sm text-gray-500">
            <p>{quote.company.name}</p>
            {quote.template?.footerText && (
              <p className="mt-1">{quote.template.footerText}</p>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox para zoom de fotos */}
      {lightboxOpen && (
        <ImageLightbox
          images={lightboxImages}
          currentIndex={lightboxIndex}
          onClose={closeLightbox}
          onPrev={prevImage}
          onNext={nextImage}
        />
      )}

      {/* Modal de assinatura e aprovação */}
      <SignatureModal
        isOpen={signatureModalOpen}
        onClose={() => setSignatureModalOpen(false)}
        onConfirm={handleSignAndApprove}
        isSubmitting={isSubmitting}
        clientName={quote.client.name}
        t={t}
      />

      {/* Modal de rejeição */}
      <RejectModal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        onConfirm={handleReject}
        isSubmitting={isSubmitting}
        t={t}
      />

      {/* Modal de Termos de Aceite */}
      <AcceptanceTermsModal
        isOpen={termsModalOpen}
        onClose={() => setTermsModalOpen(false)}
        onAccept={() => {
          setTermsAccepted(true);
          setTermsModalOpen(false);
          setSignatureModalOpen(true);
        }}
        termsContent={acceptanceTerms?.termsContent || null}
        version={acceptanceTerms?.version || 0}
        t={t}
      />
    </div>
  );
}
