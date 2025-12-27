'use client';

/**
 * Página pública de visualização da Ordem de Serviço
 * Acessível via link compartilhável sem autenticação
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from '@/i18n';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  SCHEDULED: { label: 'Agendada', color: 'bg-blue-100 text-blue-800', icon: Calendar },
  IN_PROGRESS: { label: 'Em Andamento', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  DONE: { label: 'Concluída', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  CANCELED: { label: 'Cancelada', color: 'bg-red-100 text-red-800', icon: AlertCircle },
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
      // Assinaturas podem estar em valueText (base64) ou attachments
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

// Componente para seção com título
function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b-2 border-primary">
        <Icon className="h-5 w-5 text-primary" />
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
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-600">{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (error || !workOrder) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Link Inválido</h2>
            <p className="text-gray-600">{error || 'Ordem de serviço não encontrada.'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const status = statusConfig[workOrder.status] || statusConfig.SCHEDULED;
  const StatusIcon = status.icon;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header com logo da empresa */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {workOrder.company.logoUrl ? (
                <div className="relative w-16 h-16 rounded-lg overflow-hidden border bg-white flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={workOrder.company.logoUrl}
                    alt={workOrder.company.name}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      // Se a imagem falhar, esconde e mostra o fallback
                      e.currentTarget.style.display = 'none';
                      const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                  <div className="hidden w-full h-full items-center justify-center">
                    <Building2 className="h-8 w-8 text-primary" />
                  </div>
                </div>
              ) : (
                <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-8 w-8 text-primary" />
                </div>
              )}
              <div>
                <h1 className="text-xl font-bold text-gray-900">{workOrder.company.name}</h1>
                {workOrder.company.phone && (
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {workOrder.company.phone}
                  </p>
                )}
                {workOrder.company.email && (
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {workOrder.company.email}
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
        {/* Título da OS */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Ordem de Serviço</p>
                <CardTitle className="text-2xl">
                  {workOrder.title}
                </CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  #{workOrder.id.substring(0, 8).toUpperCase()}
                </p>
              </div>
              {workOrder.totalValue && (
                <div className="text-right">
                  <p className="text-sm text-gray-500">Valor Total</p>
                  <p className="text-2xl font-bold text-primary">
                    {formatCurrency(workOrder.totalValue)}
                  </p>
                </div>
              )}
            </div>
          </CardHeader>
        </Card>

        {/* Grid de informações */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Informações do Cliente */}
          <Card>
            <CardContent className="pt-6">
              <Section title="Informações do Cliente" icon={User}>
                <dl className="space-y-1">
                  <InfoField label="Nome do cliente" value={workOrder.client.name} />
                  <InfoField label="CPF/CNPJ" value={workOrder.client.taxId} />
                  <InfoField label="E-mail" value={workOrder.client.email} />
                  <InfoField label="Endereço" value={workOrder.client.address} />
                  <InfoField label="Telefone" value={workOrder.client.phone} />
                  <InfoField label="Falar com" value={workOrder.client.contactName || workOrder.client.name} />
                  {workOrder.client.notes && (
                    <InfoField label="Observação" value={workOrder.client.notes} />
                  )}
                </dl>
              </Section>
            </CardContent>
          </Card>

          {/* Informações da Tarefa */}
          <Card>
            <CardContent className="pt-6">
              <Section title="Detalhes da Tarefa" icon={Wrench}>
                <dl className="space-y-1">
                  <InfoField label="Técnico" value={workOrder.company.technicianName} />
                  <InfoField label="Data/Hora" value={formatDateTime(workOrder.scheduledDate)} />
                  <InfoField label="Serviço" value={workOrder.title} />
                  <InfoField label="Chegada" value={formatDateTime(workOrder.executionStart)} />
                  <InfoField label="Saída" value={formatDateTime(workOrder.executionEnd)} />
                  <InfoField
                    label="Duração"
                    value={calculateDuration(workOrder.executionStart, workOrder.executionEnd)}
                  />
                  {workOrder.address && (
                    <InfoField
                      label="Endereço"
                      value={
                        <span className="flex items-start gap-1">
                          <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          {workOrder.address}
                        </span>
                      }
                    />
                  )}
                </dl>
              </Section>
            </CardContent>
          </Card>
        </div>

        {/* Orientação / Descrição */}
        {workOrder.description && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <Section title="Orientação" icon={FileText}>
                <p className="text-gray-700 whitespace-pre-wrap">{workOrder.description}</p>
              </Section>
            </CardContent>
          </Card>
        )}

        {/* Relato de Execução / Notas */}
        {workOrder.notes && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <Section title="Relato de Execução" icon={FileText}>
                <p className="text-gray-700 whitespace-pre-wrap">{workOrder.notes}</p>
              </Section>
            </CardContent>
          </Card>
        )}

        {/* Itens/Serviços */}
        {workOrder.items.length > 0 && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <Section title="Itens/Serviços" icon={Package}>
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
                      {workOrder.items.map((item, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-3 py-2">{item.name}</td>
                          <td className="px-3 py-2 text-center">{item.quantity.toFixed(2)}</td>
                          <td className="px-3 py-2 text-center">{item.unit}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                          <td className="px-3 py-2 text-right font-medium">{formatCurrency(item.totalPrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-primary/5 font-semibold">
                        <td colSpan={4} className="px-3 py-2 text-right">TOTAL:</td>
                        <td className="px-3 py-2 text-right text-primary">
                          {formatCurrency(workOrder.totalValue || 0)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Section>
            </CardContent>
          </Card>
        )}

        {/* Checklists */}
        {workOrder.checklists.map((checklist, idx) => (
          <Card key={idx} className="mb-6">
            <CardContent className="pt-6">
              <Section title={checklist.name} icon={ClipboardCheck}>
                <div className="space-y-2">
                  {checklist.templateSnapshot?.questions?.map((question: any) => {
                    if (question.type === 'SECTION_TITLE') {
                      return (
                        <div key={question.id} className="pt-4 pb-2">
                          <h4 className="font-semibold text-gray-800 border-b pb-1">
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
                      <div key={question.id} className="py-2 border-b border-gray-100">
                        <div className="flex justify-between items-start">
                          <span className="text-gray-700">{question.title}</span>
                          {isSignature ? (
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                              <span className="text-sm text-green-600">Assinatura registrada</span>
                            </div>
                          ) : (
                            <span className="font-medium text-gray-900">{displayValue as string}</span>
                          )}
                        </div>
                        {/* Assinatura */}
                        {isSignature && (
                          <div className="mt-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <CheckCircle2 className="h-5 w-5 text-green-500" />
                              <span className="text-sm font-medium text-green-700">Assinatura registrada</span>
                            </div>
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
                          <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
                            {answer.attachments.map((att: { id: string; url: string }, attIndex: number) => (
                              <button
                                key={att.id}
                                className="relative aspect-video rounded overflow-hidden border bg-gray-100 cursor-pointer group"
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
                                      alt="Foto do checklist"
                                      className="w-full h-full object-cover"
                                    />
                                    {/* Overlay com ícone de zoom */}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                      <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
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
              </Section>
            </CardContent>
          </Card>
        ))}

        {/* Fotos/Anexos */}
        {workOrder.attachments.length > 0 && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <Section title={`Anexos (${workOrder.attachments.length} foto${workOrder.attachments.length > 1 ? 's' : ''})`} icon={ImageIcon}>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {workOrder.attachments.map((attachment, index) => (
                    <button
                      key={attachment.id}
                      className="relative aspect-video rounded-lg overflow-hidden border bg-gray-100 cursor-pointer group"
                      onClick={() => {
                        const images = workOrder.attachments
                          .filter((att) => att.mimeType?.startsWith('image/') && att.url)
                          .map((att) => ({ url: att.url!, caption: formatDateTime(att.createdAt) }));
                        const imageIndex = images.findIndex((img) => img.url === attachment.url);
                        openLightbox(images, imageIndex >= 0 ? imageIndex : 0);
                      }}
                      disabled={!attachment.mimeType?.startsWith('image/') || !attachment.url}
                    >
                      {attachment.mimeType?.startsWith('image/') && attachment.url ? (
                        <>
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
                        </>
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <FileText className="h-8 w-8 text-gray-400" />
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-2 py-1">
                        {formatDateTime(attachment.createdAt)}
                      </div>
                    </button>
                  ))}
                </div>
              </Section>
            </CardContent>
          </Card>
        )}

        {/* Assinatura */}
        {workOrder.signature && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <Section title="Assinatura do Cliente" icon={PenTool}>
                <div className="text-center">
                  {workOrder.signature.imageUrl && (
                    <div className="relative w-64 h-24 mx-auto mb-4 border-b-2 border-gray-300">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={workOrder.signature.imageUrl}
                        alt="Assinatura"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}
                  <div className="border-t border-gray-300 pt-2 max-w-xs mx-auto">
                    {workOrder.signature.signerName && (
                      <p className="font-semibold text-gray-900">{workOrder.signature.signerName}</p>
                    )}
                    {workOrder.signature.signerDocument && (
                      <p className="text-sm text-gray-500">CPF/RG: {workOrder.signature.signerDocument}</p>
                    )}
                    {workOrder.signature.signedAt && (
                      <p className="text-sm text-gray-500">
                        Assinado em: {formatDateTime(workOrder.signature.signedAt)}
                      </p>
                    )}
                  </div>
                </div>
              </Section>
            </CardContent>
          </Card>
        )}

        {/* Rodapé */}
        <footer className="text-center text-sm text-gray-500 py-6 border-t">
          <p>Documento gerado em {formatDateTime(new Date().toISOString())}</p>
          <p className="mt-1">
            {workOrder.company.name}
            {workOrder.company.address && ` | ${workOrder.company.address}`}
          </p>
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
    </div>
  );
}
