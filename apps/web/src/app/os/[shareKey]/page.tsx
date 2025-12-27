'use client';

/**
 * Página pública de visualização da Ordem de Serviço
 * Acessível via link compartilhável sem autenticação
 *
 * Layout profissional estilo documento comercial
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from '@/i18n';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  MapPin,
  Phone,
  Mail,
  User,
  Wrench,
  Package,
  ClipboardCheck,
  Image as ImageIcon,
  PenTool,
  X,
  ZoomIn,
  ChevronLeft,
  ChevronRight,
  Check,
  Play,
  Timer,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface WorkOrderData {
  id: string;
  title: string;
  description: string | null;
  status: string;
  scheduledDate: string | null;
  scheduledStartTime: string | null;
  scheduledEndTime: string | null;
  executionStart: string | null;
  executionEnd: string | null;
  address: string | null;
  notes: string | null;
  totalValue: number | null;
  createdAt: string;
  company: {
    name: string;
    email: string | null;
    phone: string | null;
    document: string | null;
    address: string | null;
    logoUrl: string | null;
    technicianName: string | null;
  };
  client: {
    name: string;
    taxId: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    contactName: string | null;
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
  checklists: Array<{
    name: string;
    answers: Array<{
      questionId: string;
      type: string;
      valueText: string | null;
      valueNumber: number | null;
      valueBoolean: boolean | null;
      valueDate: string | null;
      valueJson: any;
      attachments: Array<{ id: string; url: string }>;
    }>;
    templateSnapshot: any;
  }>;
  attachments: Array<{
    id: string;
    url: string;
    type: string;
    mimeType: string;
    createdAt: string;
  }>;
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
  SCHEDULED: { label: 'Agendada', color: 'text-blue-700', bgColor: 'bg-blue-100', icon: Calendar },
  IN_PROGRESS: { label: 'Em Andamento', color: 'text-yellow-700', bgColor: 'bg-yellow-100', icon: Clock },
  DONE: { label: 'Concluída', color: 'text-green-700', bgColor: 'bg-green-100', icon: CheckCircle2 },
  CANCELED: { label: 'Cancelada', color: 'text-red-700', bgColor: 'bg-red-100', icon: AlertCircle },
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

function formatTime(dateString: string | null): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function calculateDuration(start: string | null, end: string | null): string {
  if (!start || !end) return '-';
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffMs = endDate.getTime() - startDate.getTime();
  const diffMins = Math.round(diffMs / 60000);
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;
}

function getChecklistAnswerDisplay(answer: any, questions: any[]): string | { type: 'signature'; data: string } {
  const question = questions.find((q) => q.id === answer.questionId);
  if (!question) return '-';

  switch (answer.type) {
    case 'TEXT_SHORT':
    case 'TEXT_LONG':
      return answer.valueText || '-';
    case 'NUMBER':
      return answer.valueNumber != null ? answer.valueNumber.toString() : '-';
    case 'CHECKBOX':
      return answer.valueBoolean != null ? (answer.valueBoolean ? 'Sim' : 'Não') : '-';
    case 'SELECT':
      return answer.valueJson || answer.valueText || '-';
    case 'MULTI_SELECT':
      return Array.isArray(answer.valueJson) ? answer.valueJson.join(', ') : '-';
    case 'DATE':
      return formatDate(answer.valueDate);
    case 'TIME':
      return formatTime(answer.valueDate);
    case 'DATETIME':
      return formatDateTime(answer.valueDate);
    case 'RATING':
      const rating = answer.valueNumber ?? answer.valueJson;
      return rating != null ? `${rating}/5` : '-';
    case 'PHOTO_REQUIRED':
    case 'PHOTO_OPTIONAL':
      return answer.attachments?.length > 0 ? `${answer.attachments.length} foto(s)` : '-';
    case 'SIGNATURE_TECHNICIAN':
    case 'SIGNATURE_CLIENT':
      const signatureData = answer.valueText || answer.valueJson?.data || answer.valueJson;
      if (signatureData && typeof signatureData === 'string' && signatureData.length > 50) {
        return { type: 'signature', data: signatureData };
      }
      if (answer.attachments?.length > 0 && answer.attachments[0].url) {
        return { type: 'signature', data: answer.attachments[0].url };
      }
      return '-';
    case 'SCALE':
      const scaleValue = answer.valueNumber ?? answer.valueJson;
      return scaleValue != null ? scaleValue.toString() : '-';
    default:
      return answer.valueText || answer.valueNumber?.toString() || '-';
  }
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
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 text-white hover:text-gray-300 transition-colors z-10"
        aria-label="Fechar"
      >
        <X className="h-8 w-8" />
      </button>

      <div className="absolute top-4 left-4 text-white text-sm bg-black/50 px-3 py-1 rounded-full">
        {currentIndex + 1} / {images.length}
      </div>

      {images.length > 1 && (
        <button
          onClick={onPrev}
          className="absolute left-4 p-2 text-white hover:text-gray-300 transition-colors"
          aria-label="Anterior"
        >
          <ChevronLeft className="h-10 w-10" />
        </button>
      )}

      <div className="max-w-[90vw] max-h-[90vh] flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={currentImage.url}
          alt={currentImage.caption || 'Foto'}
          className="max-w-full max-h-[85vh] object-contain"
        />
      </div>

      {images.length > 1 && (
        <button
          onClick={onNext}
          className="absolute right-4 p-2 text-white hover:text-gray-300 transition-colors"
          aria-label="Próximo"
        >
          <ChevronRight className="h-10 w-10" />
        </button>
      )}

      {currentImage.caption && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-center bg-black/50 px-4 py-2 rounded-lg max-w-lg">
          {currentImage.caption}
        </div>
      )}
    </div>
  );
}

export default function PublicWorkOrderPage() {
  const params = useParams();
  const shareKey = params.shareKey as string;
  const { t } = useTranslations('common');

  const [workOrder, setWorkOrder] = useState<WorkOrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estado do lightbox
  const [lightboxImages, setLightboxImages] = useState<{ url: string; caption?: string }[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

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

  useEffect(() => {
    async function fetchWorkOrder() {
      try {
        const response = await fetch(`${API_URL}/public/work-orders/${shareKey}`);

        if (!response.ok) {
          if (response.status === 404) {
            setError('Ordem de serviço não encontrada ou link inválido.');
          } else {
            setError('Erro ao carregar ordem de serviço.');
          }
          return;
        }

        const data = await response.json();
        setWorkOrder(data);
      } catch (err) {
        console.error('Error fetching work order:', err);
        setError('Erro ao conectar com o servidor.');
      } finally {
        setLoading(false);
      }
    }

    if (shareKey) {
      fetchWorkOrder();
    }
  }, [shareKey]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (error || !workOrder) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Link Inválido</h2>
          <p className="text-gray-600">{error || 'Ordem de serviço não encontrada.'}</p>
        </div>
      </div>
    );
  }

  const status = statusConfig[workOrder.status] || statusConfig.SCHEDULED;
  const StatusIcon = status.icon;

  // Cor primária (azul para OS)
  const primaryColor = '#2563eb';

  // Calcular subtotal dos itens
  const subtotal = workOrder.items.reduce((sum, item) => sum + item.totalPrice, 0);

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
                  {workOrder.company.logoUrl ? (
                    <div className="w-20 h-20 rounded-lg overflow-hidden border bg-white flex items-center justify-center flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={workOrder.company.logoUrl}
                        alt={workOrder.company.name}
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
                    <h1 className="text-2xl font-bold text-gray-900">{workOrder.company.name}</h1>
                    {workOrder.company.phone && (
                      <p className="text-sm text-gray-600 flex items-center gap-2 mt-1">
                        <Phone className="h-4 w-4" />
                        {workOrder.company.phone}
                      </p>
                    )}
                    {workOrder.company.email && (
                      <p className="text-sm text-gray-600 flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        {workOrder.company.email}
                      </p>
                    )}
                  </div>
                </div>

                {/* Número e data da OS */}
                <div className="text-left md:text-right">
                  <div className="inline-block">
                    <p className="text-sm text-gray-500 uppercase tracking-wide">Ordem de Serviço</p>
                    <p className="text-2xl font-bold text-gray-900">
                      #{workOrder.id.substring(0, 8).toUpperCase()}
                    </p>
                    <div className="mt-2 space-y-1">
                      <p className="text-sm text-gray-600 flex items-center gap-2 md:justify-end">
                        <Calendar className="h-4 w-4" />
                        {formatDate(workOrder.scheduledDate || workOrder.createdAt)}
                      </p>
                    </div>
                    <Badge className={`mt-3 ${status.bgColor} ${status.color}`}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {status.label}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Título do serviço */}
          <div className="px-6 py-4 md:px-8 bg-gray-50 border-b">
            <div className="flex items-center gap-3">
              <Wrench className="h-5 w-5 text-gray-400" />
              <h2 className="text-lg font-semibold text-gray-900">{workOrder.title}</h2>
            </div>
          </div>

          {/* Informações do cliente e técnico */}
          <div className="px-6 py-4 md:px-8 border-b">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Cliente */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Cliente</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="font-medium text-gray-900">{workOrder.client.name}</span>
                  </div>
                  {workOrder.client.phone && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Phone className="h-4 w-4 text-gray-400" />
                      {workOrder.client.phone}
                    </div>
                  )}
                  {workOrder.client.email && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Mail className="h-4 w-4 text-gray-400" />
                      {workOrder.client.email}
                    </div>
                  )}
                  {(workOrder.address || workOrder.client.address) && (
                    <div className="flex items-start gap-2 text-sm text-gray-600">
                      <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                      <span>{workOrder.address || workOrder.client.address}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Técnico e Execução */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Execução</h3>
                <div className="space-y-2">
                  {workOrder.company.technicianName && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-700">Técnico: <span className="font-medium text-gray-900">{workOrder.company.technicianName}</span></span>
                    </div>
                  )}
                  {workOrder.executionStart && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Play className="h-4 w-4 text-green-500" />
                      <span>Início: {formatDateTime(workOrder.executionStart)}</span>
                    </div>
                  )}
                  {workOrder.executionEnd && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <CheckCircle2 className="h-4 w-4 text-blue-500" />
                      <span>Término: {formatDateTime(workOrder.executionEnd)}</span>
                    </div>
                  )}
                  {workOrder.executionStart && workOrder.executionEnd && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Timer className="h-4 w-4 text-gray-400" />
                      <span>Duração: <span className="font-medium">{calculateDuration(workOrder.executionStart, workOrder.executionEnd)}</span></span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Descrição/Orientação */}
          {workOrder.description && (
            <div className="px-6 py-4 md:px-8 border-b">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Descrição do Serviço</h3>
              <p className="text-gray-700 whitespace-pre-wrap">{workOrder.description}</p>
            </div>
          )}

          {/* Relato de Execução */}
          {workOrder.notes && (
            <div className="px-6 py-4 md:px-8 bg-blue-50 border-b">
              <h3 className="text-sm font-semibold text-blue-800 uppercase tracking-wide mb-2">Relato de Execução</h3>
              <p className="text-blue-900 whitespace-pre-wrap">{workOrder.notes}</p>
            </div>
          )}

          {/* Itens/Serviços */}
          {workOrder.items.length > 0 && (
            <div className="px-6 py-6 md:px-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Itens e Serviços</h2>

              {/* Tabela desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2" style={{ borderColor: primaryColor }}>
                      <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700 w-8"></th>
                      <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700">Descrição</th>
                      <th className="text-center py-3 px-2 text-sm font-semibold text-gray-700 w-20">Qtd</th>
                      <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700 w-28">Valor Un.</th>
                      <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700 w-28">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {workOrder.items.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="py-4 px-2">
                          <div
                            className="w-5 h-5 rounded border-2 flex items-center justify-center"
                            style={{ borderColor: primaryColor }}
                          >
                            <Check className="w-3 h-3" style={{ color: primaryColor }} />
                          </div>
                        </td>
                        <td className="py-4 px-2">
                          <div>
                            <p className="font-medium text-gray-900">{item.name}</p>
                            <p className="text-xs text-gray-500">
                              {item.type === 'SERVICE' ? 'Serviço' : 'Produto'} • {item.unit}
                            </p>
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
                {workOrder.items.map((item, index) => (
                  <div key={index} className="border rounded-lg p-4 bg-white">
                    <div className="flex items-start gap-3">
                      <div
                        className="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-1"
                        style={{ borderColor: primaryColor }}
                      >
                        <Check className="w-3 h-3" style={{ color: primaryColor }} />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{item.name}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {item.type === 'SERVICE' ? 'Serviço' : 'Produto'} • {item.unit}
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
                      <span className="text-gray-600">Subtotal:</span>
                      <span className="text-gray-900">{formatCurrency(subtotal)}</span>
                    </div>
                    <div
                      className="flex justify-between pt-3 border-t-2 font-bold text-lg"
                      style={{ borderColor: primaryColor }}
                    >
                      <span className="text-gray-900">Total:</span>
                      <span style={{ color: primaryColor }}>{formatCurrency(workOrder.totalValue || subtotal)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Checklists */}
          {workOrder.checklists.map((checklist, idx) => (
            <div key={idx} className="px-6 py-6 md:px-8 border-t">
              <div className="flex items-center gap-2 mb-4">
                <ClipboardCheck className="h-5 w-5" style={{ color: primaryColor }} />
                <h2 className="text-lg font-semibold text-gray-900">{checklist.name}</h2>
              </div>

              <div className="space-y-3">
                {checklist.templateSnapshot?.questions?.map((question: any) => {
                  if (question.type === 'SECTION_TITLE') {
                    return (
                      <div key={question.id} className="pt-4 pb-2">
                        <h4 className="font-semibold text-gray-800 border-b pb-1" style={{ borderColor: `${primaryColor}40` }}>
                          {question.title}
                        </h4>
                      </div>
                    );
                  }

                  const answer = checklist.answers.find((a) => a.questionId === question.id);
                  const displayValue = answer
                    ? getChecklistAnswerDisplay(answer, checklist.templateSnapshot?.questions || [])
                    : '-';
                  const hasPhotos = answer?.attachments && answer.attachments.length > 0 &&
                    answer.type !== 'SIGNATURE_TECHNICIAN' && answer.type !== 'SIGNATURE_CLIENT';
                  const isSignature = typeof displayValue === 'object' && displayValue?.type === 'signature';

                  return (
                    <div key={question.id} className="py-3 border-b border-gray-100">
                      <div className="flex justify-between items-start">
                        <span className="text-gray-700">{question.title}</span>
                        {isSignature ? (
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span className="text-sm text-green-600">Assinatura registrada</span>
                          </div>
                        ) : (
                          <span className="font-medium text-gray-900 text-right">{displayValue as string}</span>
                        )}
                      </div>

                      {/* Assinatura */}
                      {isSignature && (
                        <div className="mt-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                          <div className="bg-white border rounded p-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={displayValue.data.startsWith('data:') ? displayValue.data : `data:image/png;base64,${displayValue.data}`}
                              alt={question.title}
                              className="max-h-24 mx-auto object-contain"
                            />
                          </div>
                        </div>
                      )}

                      {/* Fotos do checklist */}
                      {hasPhotos && (
                        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
                          {answer.attachments.map((att: { id: string; url: string }, attIndex: number) => (
                            <button
                              key={att.id}
                              className="relative aspect-square rounded overflow-hidden border bg-gray-100 cursor-pointer group"
                              onClick={() => {
                                const images = answer.attachments
                                  .filter((a: { url: string }) => a.url)
                                  .map((a: { url: string }) => ({ url: a.url, caption: question.title }));
                                openLightbox(images, attIndex);
                              }}
                            >
                              {att.url ? (
                                <>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={att.url}
                                    alt="Foto"
                                    className="w-full h-full object-cover"
                                  />
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                    <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </div>
                                </>
                              ) : (
                                <div className="flex items-center justify-center h-full">
                                  <ImageIcon className="h-6 w-6 text-gray-400" />
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Fotos/Anexos */}
          {workOrder.attachments.length > 0 && (
            <div className="px-6 py-6 md:px-8 border-t">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Anexos ({workOrder.attachments.length})
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {workOrder.attachments.map((attachment) => {
                  const isImage = attachment.mimeType?.startsWith('image/');
                  const hasUrl = !!attachment.url;

                  if (isImage && hasUrl) {
                    return (
                      <button
                        key={attachment.id}
                        className="relative aspect-square rounded-lg overflow-hidden border bg-gray-100 cursor-pointer group"
                        onClick={() => {
                          const images = workOrder.attachments
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
                        {attachment.mimeType === 'application/pdf' ? 'PDF' : 'Documento'}
                      </span>
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Área de assinatura */}
          {workOrder.signature && (
            <div className="px-6 py-6 md:px-8 border-t bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Assinatura do Cliente</h2>
              <div className="flex flex-col md:flex-row md:items-end gap-6">
                <div className="flex-1">
                  {workOrder.signature.imageUrl && (
                    <div className="border-b-2 border-gray-400 pb-2 mb-2 max-w-xs">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={workOrder.signature.imageUrl}
                        alt="Assinatura"
                        className="h-16 object-contain"
                      />
                    </div>
                  )}
                  <p className="font-medium text-gray-900">{workOrder.signature.signerName}</p>
                  {workOrder.signature.signerDocument && (
                    <p className="text-sm text-gray-500">CPF/RG: {workOrder.signature.signerDocument}</p>
                  )}
                </div>
                <div className="text-sm text-gray-500">
                  <p>Assinado em:</p>
                  <p className="font-medium text-gray-700">{formatDateTime(workOrder.signature.signedAt)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Rodapé */}
          <div className="px-6 py-4 md:px-8 border-t bg-white text-center text-sm text-gray-500">
            <p>{workOrder.company.name}</p>
            {workOrder.company.address && (
              <p className="mt-1">{workOrder.company.address}</p>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <ImageLightbox
          images={lightboxImages}
          currentIndex={lightboxIndex}
          onClose={closeLightbox}
          onPrev={prevImage}
          onNext={nextImage}
        />
      )}
    </div>
  );
}
