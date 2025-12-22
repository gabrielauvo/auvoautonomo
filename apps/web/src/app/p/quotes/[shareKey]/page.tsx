'use client';

/**
 * Página pública de visualização do Orçamento
 * Acessível via link compartilhável sem autenticação
 * Permite aprovar (com assinatura) ou rejeitar o orçamento
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
  Package,
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

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  DRAFT: { label: 'Rascunho', color: 'bg-gray-100 text-gray-800', icon: FileText },
  SENT: { label: 'Enviado', color: 'bg-blue-100 text-blue-800', icon: Send },
  APPROVED: { label: 'Aprovado', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  REJECTED: { label: 'Recusado', color: 'bg-red-100 text-red-800', icon: XCircle },
  EXPIRED: { label: 'Expirado', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('pt-BR');
}

function formatDateTime(dateString: string | null): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('pt-BR');
}

// Componente para seção com título
function Section({ title, icon: Icon, children, primaryColor }: { title: string; icon: any; children: React.ReactNode; primaryColor?: string }) {
  const color = primaryColor || '#7C3AED';
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b-2" style={{ borderColor: color }}>
        <Icon className="h-5 w-5" style={{ color }} />
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}

// Componente para campo de informação
function InfoField({ label, value }: { label: string; value: string | React.ReactNode }) {
  return (
    <div className="py-2 border-b border-gray-100 last:border-0">
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900">{value || '-'}</dd>
    </div>
  );
}

// Componente de Canvas para assinatura
function SignaturePad({
  onSignatureChange,
}: {
  onSignatureChange: (dataUrl: string | null) => void;
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
            <span className="text-gray-400 text-sm">Assine aqui</span>
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
          Limpar Assinatura
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
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: { imageBase64: string; signerName: string; signerDocument?: string }) => void;
  isSubmitting: boolean;
  clientName: string;
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
      setError('Por favor, informe seu nome');
      return;
    }
    if (!signatureDataUrl) {
      setError('Por favor, assine no campo acima');
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
              <PenTool className="h-5 w-5 text-primary" />
              Assinar e Aprovar
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
                Nome Completo *
              </label>
              <Input
                id="signerName"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Seu nome completo"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="signerDocument" className="block text-sm font-medium text-gray-700 mb-1">
                CPF/RG (opcional)
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
                Assinatura *
              </label>
              <SignaturePad onSignatureChange={setSignatureDataUrl} />
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
                Cancelar
              </Button>
              <Button
                onClick={handleConfirm}
                className="flex-1 bg-green-600 hover:bg-green-700"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Aprovando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Aprovar Orçamento
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
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => void;
  isSubmitting: boolean;
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
              Recusar Orçamento
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
              Tem certeza que deseja recusar este orçamento? Esta ação não pode ser desfeita.
            </p>

            <div>
              <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">
                Motivo da recusa (opcional)
              </label>
              <textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Informe o motivo da recusa..."
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
                Cancelar
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
                    Recusando...
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    Recusar Orçamento
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
}: {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
  termsContent: string | null;
  version: number;
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
              Termos de Aceite
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Leia atentamente os termos abaixo. Voce deve rolar ate o final para poder aceitar.
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
              <span className="text-sm">Role para ler todos os termos</span>
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
              Li e aceito os termos e condicoes apresentados acima
            </span>
          </label>

          {version > 0 && (
            <p className="text-xs text-gray-500">Versao: {version}</p>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={onAccept}
              className="flex-1 bg-green-600 hover:bg-green-700"
              disabled={!canAccept}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Aceitar e Continuar
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
        throw new Error(errorData.message || 'Erro ao aprovar orçamento');
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
      alert(err.message || 'Erro ao aprovar orçamento. Tente novamente.');
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
        throw new Error(errorData.message || 'Erro ao recusar orçamento');
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
      alert(err.message || 'Erro ao recusar orçamento. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    async function fetchQuote() {
      try {
        const response = await fetch(`${API_URL}/public/quotes/${shareKey}`);

        if (!response.ok) {
          if (response.status === 404) {
            setError('Orçamento não encontrado ou link inválido.');
          } else {
            setError('Erro ao carregar orçamento.');
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
        setError('Erro ao conectar com o servidor.');
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
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-600">Carregando orçamento...</p>
        </div>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Link Inválido</h2>
            <p className="text-gray-600">{error || 'Orçamento não encontrado.'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const status = statusConfig[quote.status] || statusConfig.DRAFT;
  const StatusIcon = status.icon;

  // Cores do template (fallback para roxo padrão)
  const primaryColor = quote.template?.primaryColor || '#7C3AED';
  const secondaryColor = quote.template?.secondaryColor || primaryColor;

  // Calcular subtotal dos itens
  const subtotal = quote.items.reduce((sum, item) => sum + item.totalPrice, 0);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header com logo da empresa */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {quote.company.logoUrl ? (
                <div className="relative w-16 h-16 rounded-lg overflow-hidden border bg-white flex items-center justify-center">
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
                    <Building2 className="h-8 w-8" style={{ color: primaryColor }} />
                  </div>
                </div>
              ) : (
                <div
                  className="w-16 h-16 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${primaryColor}1A` }}
                >
                  <Building2 className="h-8 w-8" style={{ color: primaryColor }} />
                </div>
              )}
              <div>
                <h1 className="text-xl font-bold text-gray-900">{quote.company.name}</h1>
                {quote.company.phone && (
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {quote.company.phone}
                  </p>
                )}
                {quote.company.email && (
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {quote.company.email}
                  </p>
                )}
              </div>
            </div>
            <Badge className={status.color}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {status.label}
            </Badge>
          </div>
        </div>
      </header>

      {/* Conteúdo principal */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Título do Orçamento */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Orçamento</p>
                <CardTitle className="text-2xl">
                  #{quote.id.substring(0, 8).toUpperCase()}
                </CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  Criado em {formatDate(quote.createdAt)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Valor Total</p>
                <p className="text-2xl font-bold" style={{ color: primaryColor }}>
                  {formatCurrency(quote.totalValue)}
                </p>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Grid de informações */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Informações do Cliente */}
          <Card>
            <CardContent className="pt-6">
              <Section title="Informações do Cliente" icon={User} primaryColor={primaryColor}>
                <dl className="space-y-1">
                  <InfoField label="Nome" value={quote.client.name} />
                  <InfoField label="CPF/CNPJ" value={quote.client.taxId} />
                  <InfoField label="E-mail" value={quote.client.email} />
                  <InfoField label="Telefone" value={quote.client.phone} />
                  <InfoField label="Endereço" value={quote.client.address} />
                  {quote.client.notes && (
                    <InfoField label="Observação" value={quote.client.notes} />
                  )}
                </dl>
              </Section>
            </CardContent>
          </Card>

          {/* Informações do Orçamento */}
          <Card>
            <CardContent className="pt-6">
              <Section title="Detalhes do Orçamento" icon={FileText} primaryColor={primaryColor}>
                <dl className="space-y-1">
                  <InfoField label="Status" value={
                    <Badge className={status.color}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {status.label}
                    </Badge>
                  } />
                  <InfoField label="Data de Criação" value={formatDate(quote.createdAt)} />
                  {quote.sentAt && (
                    <InfoField label="Enviado em" value={formatDateTime(quote.sentAt)} />
                  )}
                  {quote.visitScheduledAt && (
                    <InfoField label="Visita Agendada" value={formatDateTime(quote.visitScheduledAt)} />
                  )}
                </dl>
              </Section>
            </CardContent>
          </Card>
        </div>

        {/* Observações */}
        {quote.notes && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <Section title="Observações" icon={FileText} primaryColor={primaryColor}>
                <p className="text-gray-700 whitespace-pre-wrap">{quote.notes}</p>
              </Section>
            </CardContent>
          </Card>
        )}

        {/* Itens/Serviços */}
        {quote.items.length > 0 && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <Section title="Itens" icon={Package} primaryColor={primaryColor}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left">
                        <th className="px-3 py-2 font-medium text-gray-600">Item</th>
                        <th className="px-3 py-2 font-medium text-gray-600 text-center">Qtd</th>
                        <th className="px-3 py-2 font-medium text-gray-600 text-center">Unidade</th>
                        <th className="px-3 py-2 font-medium text-gray-600 text-right">Preço Un.</th>
                        <th className="px-3 py-2 font-medium text-gray-600 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {quote.items.map((item, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <div>
                              <span className="font-medium">{item.name}</span>
                              <span className="text-xs text-gray-500 ml-2">
                                ({item.type === 'SERVICE' ? 'Serviço' : 'Produto'})
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center">{item.quantity.toFixed(2)}</td>
                          <td className="px-3 py-2 text-center">{item.unit}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                          <td className="px-3 py-2 text-right font-medium">{formatCurrency(item.totalPrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50">
                        <td colSpan={4} className="px-3 py-2 text-right font-medium">Subtotal:</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(subtotal)}</td>
                      </tr>
                      {quote.discountValue > 0 && (
                        <tr className="bg-gray-50">
                          <td colSpan={4} className="px-3 py-2 text-right font-medium text-red-600">Desconto:</td>
                          <td className="px-3 py-2 text-right text-red-600">-{formatCurrency(quote.discountValue)}</td>
                        </tr>
                      )}
                      <tr className="font-semibold" style={{ backgroundColor: `${primaryColor}0D` }}>
                        <td colSpan={4} className="px-3 py-2 text-right">TOTAL:</td>
                        <td className="px-3 py-2 text-right text-lg" style={{ color: primaryColor }}>
                          {formatCurrency(quote.totalValue)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Section>
            </CardContent>
          </Card>
        )}

        {/* Fotos/Anexos */}
        {quote.attachments.length > 0 && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <Section title={`Anexos (${quote.attachments.length} arquivo${quote.attachments.length > 1 ? 's' : ''})`} icon={ImageIcon} primaryColor={primaryColor}>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {quote.attachments.map((attachment, index) => {
                    const isImage = attachment.mimeType?.startsWith('image/');
                    const hasUrl = !!attachment.url;

                    // Para imagens, usar o lightbox
                    if (isImage && hasUrl) {
                      return (
                        <button
                          key={attachment.id}
                          className="relative aspect-video rounded-lg overflow-hidden border bg-gray-100 cursor-pointer group"
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
                          {/* Overlay com ícone de zoom */}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                            <ZoomIn className="h-10 w-10 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-2 py-1">
                            {formatDateTime(attachment.createdAt)}
                          </div>
                        </button>
                      );
                    }

                    // Para PDFs e outros documentos, abrir em nova aba
                    return (
                      <a
                        key={attachment.id}
                        href={attachment.url || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative aspect-video rounded-lg overflow-hidden border bg-gray-100 cursor-pointer group hover:bg-gray-200 transition-colors flex flex-col items-center justify-center"
                      >
                        <FileText className="h-12 w-12 text-gray-400 group-hover:text-primary transition-colors" />
                        <span className="text-xs text-gray-500 mt-2">
                          {attachment.mimeType === 'application/pdf' ? 'PDF' : 'Documento'}
                        </span>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-2 py-1 text-center">
                          {formatDateTime(attachment.createdAt)}
                        </div>
                      </a>
                    );
                  })}
                </div>
              </Section>
            </CardContent>
          </Card>
        )}

        {/* Assinatura */}
        {quote.signature && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <Section title="Assinatura do Cliente" icon={FileText} primaryColor={primaryColor}>
                <div className="text-center">
                  {quote.signature.imageUrl && (
                    <div className="relative w-64 h-24 mx-auto mb-4 border-b-2 border-gray-300">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={quote.signature.imageUrl}
                        alt="Assinatura"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}
                  <div className="border-t border-gray-300 pt-2 max-w-xs mx-auto">
                    {quote.signature.signerName && (
                      <p className="font-semibold text-gray-900">{quote.signature.signerName}</p>
                    )}
                    {quote.signature.signerDocument && (
                      <p className="text-sm text-gray-500">CPF/RG: {quote.signature.signerDocument}</p>
                    )}
                    {quote.signature.signedAt && (
                      <p className="text-sm text-gray-500">
                        Assinado em: {formatDateTime(quote.signature.signedAt)}
                      </p>
                    )}
                  </div>
                </div>
              </Section>
            </CardContent>
          </Card>
        )}

        {/* Mensagem de sucesso após ação */}
        {actionSuccess && (
          <Card className={`mb-6 ${actionSuccess === 'approved' ? 'border-green-500' : 'border-red-500'}`}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center gap-3">
                {actionSuccess === 'approved' ? (
                  <>
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                    <div className="text-center">
                      <h3 className="text-lg font-semibold text-green-600">Orçamento Aprovado!</h3>
                      <p className="text-gray-600">Obrigado por aprovar este orçamento.</p>
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle className="h-8 w-8 text-red-600" />
                    <div className="text-center">
                      <h3 className="text-lg font-semibold text-red-600">Orçamento Recusado</h3>
                      <p className="text-gray-600">Este orçamento foi recusado.</p>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Card de Termos de Aceite - mostrar quando ha termos obrigatorios */}
        {quote.status === 'SENT' && acceptanceTerms?.required && !actionSuccess && (
          <Card className={`mb-6 ${termsAccepted ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
            <CardContent className="pt-6">
              <div
                className="flex items-start gap-4 cursor-pointer"
                onClick={() => setTermsModalOpen(true)}
              >
                {termsAccepted ? (
                  <CheckCircle2 className="h-8 w-8 text-green-600 flex-shrink-0" />
                ) : (
                  <ScrollText className="h-8 w-8 text-amber-600 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <h3 className={`text-lg font-semibold ${termsAccepted ? 'text-green-800' : 'text-amber-800'}`}>
                    Termos de Aceite
                  </h3>
                  <p className={`text-sm ${termsAccepted ? 'text-green-600' : 'text-amber-600'}`}>
                    {termsAccepted
                      ? 'Termos lidos e aceitos. Voce pode prosseguir com a assinatura.'
                      : 'Antes de assinar, voce precisa ler e aceitar os termos obrigatorios.'}
                  </p>
                </div>
                <ChevronRight className={`h-6 w-6 ${termsAccepted ? 'text-green-400' : 'text-amber-400'}`} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Botões de ação para orçamentos com status SENT */}
        {quote.status === 'SENT' && !actionSuccess && (
          <Card className="mb-6" style={{ borderColor: `${primaryColor}33`, backgroundColor: `${primaryColor}0D` }}>
            <CardContent className="pt-6">
              <div className="text-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">O que deseja fazer?</h3>
                <p className="text-sm text-gray-600">Voce pode aprovar ou recusar este orcamento</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  onClick={() => {
                    // Se tem termos obrigatorios e nao foram aceitos, mostrar modal de termos
                    if (acceptanceTerms?.required && !termsAccepted) {
                      setTermsModalOpen(true);
                    } else {
                      setSignatureModalOpen(true);
                    }
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white px-8 py-3"
                  size="lg"
                >
                  <PenTool className="h-5 w-5 mr-2" />
                  Assinar e Aprovar
                </Button>
                <Button
                  onClick={() => setRejectModalOpen(true)}
                  variant="outline"
                  className="border-red-300 text-red-600 hover:bg-red-50 px-8 py-3"
                  size="lg"
                >
                  <XCircle className="h-5 w-5 mr-2" />
                  Recusar Orcamento
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Rodapé */}
        <footer className="text-center text-sm text-gray-500 py-6 border-t">
          <p>Documento gerado em {formatDateTime(new Date().toISOString())}</p>
          <p className="mt-1">{quote.company.name}</p>
        </footer>
      </main>

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
      />

      {/* Modal de rejeição */}
      <RejectModal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        onConfirm={handleReject}
        isSubmitting={isSubmitting}
      />

      {/* Modal de Termos de Aceite */}
      <AcceptanceTermsModal
        isOpen={termsModalOpen}
        onClose={() => setTermsModalOpen(false)}
        onAccept={() => {
          setTermsAccepted(true);
          setTermsModalOpen(false);
          // Abrir modal de assinatura apos aceitar termos
          setSignatureModalOpen(true);
        }}
        termsContent={acceptanceTerms?.termsContent || null}
        version={acceptanceTerms?.version || 0}
      />
    </div>
  );
}
