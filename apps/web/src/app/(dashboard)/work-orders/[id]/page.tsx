'use client';

/**
 * Página de Detalhes da Ordem de Serviço
 *
 * Exibe:
 * - Informações da OS (status, cliente, agendamento)
 * - Itens da OS
 * - Ações de status (Iniciar, Pausar, Retomar, Concluir, Cancelar)
 * - Checklists (pré e pós-execução)
 * - Anexos e fotos
 * - Timeline de eventos
 */

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from '@/i18n';
import {
  ChevronLeft,
  Edit,
  MoreVertical,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  Clock,
  User,
  MapPin,
  Calendar,
  FileText,
  Package,
  Camera,
  ClipboardList,
  History,
  RefreshCw,
  Trash2,
  AlertCircle,
  PenLine,
  Share2,
  Loader2,
  Link as LinkIcon,
  Copy,
  Check,
  Tag,
  Receipt,
} from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Skeleton,
  Alert,
  Modal,
  FormField,
  Input,
  Textarea,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui';
import { AppLayout } from '@/components/layout';
import {
  WorkOrderStatusBadge,
  WorkOrderItemsTable,
  WorkOrderTimeline,
  ChecklistsContainer,
  AttachmentsContainer,
  SignatureSection,
} from '@/components/work-orders';
import { PdfButton } from '@/components/pdf';
import {
  useWorkOrder,
  useUpdateWorkOrderStatus,
  useCompleteWorkOrder,
  useDeleteWorkOrder,
  useClientTimelineFlow,
} from '@/hooks/use-work-orders';
import {
  WorkOrderStatus,
  canEditWorkOrder,
  canStartWorkOrder,
  canCompleteWorkOrder,
  canCancelWorkOrder,
  getWorkOrderShareLink,
  shareWorkOrderViaWhatsApp,
} from '@/services/work-orders.service';
import { useAuth } from '@/context/auth-context';

// Formatar valor em moeda
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

// Formatar data
function formatDate(date: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date));
}

// Formatar hora
function formatTime(datetime: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(datetime));
}

// Modal de Pausar OS
function PauseModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isLoading: boolean;
}) {
  const { t } = useTranslations('workOrders');
  const { t: tCommon } = useTranslations('common');
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    onConfirm(reason);
    setReason('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('pauseOrder')}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          {t('pauseOrderMessage')}
        </p>

        <FormField label={t('pauseReason')}>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('pauseReasonPlaceholder')}
            rows={3}
          />
        </FormField>

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            {tCommon('cancel')}
          </Button>
          <Button
            variant="warning"
            onClick={handleConfirm}
            loading={isLoading}
            leftIcon={<Pause className="h-4 w-4" />}
          >
            {t('pauseOrder')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// Modal de Concluir OS
function CompleteModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (signature?: string) => void;
  isLoading: boolean;
}) {
  const { t } = useTranslations('workOrders');
  const { t: tCommon } = useTranslations('common');
  const [signature, setSignature] = useState('');
  const [collectSignature, setCollectSignature] = useState(false);

  const handleConfirm = () => {
    onConfirm(collectSignature ? signature : undefined);
    setSignature('');
    setCollectSignature(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('completeOrder')}>
      <div className="space-y-4">
        <Alert variant="success">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            {t('completeOrderMessage')}
          </div>
        </Alert>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="collect-signature"
            checked={collectSignature}
            onChange={(e) => setCollectSignature(e.target.checked)}
            className="rounded border-gray-300"
          />
          <label htmlFor="collect-signature" className="text-sm text-gray-600">
            {t('collectSignature')}
          </label>
        </div>

        {collectSignature && (
          <FormField label={t('responsibleName')}>
            <Input
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder={t('responsibleNamePlaceholder')}
              leftIcon={<PenLine className="h-4 w-4" />}
            />
          </FormField>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            {tCommon('cancel')}
          </Button>
          <Button
            variant="success"
            onClick={handleConfirm}
            loading={isLoading}
            leftIcon={<CheckCircle className="h-4 w-4" />}
          >
            {t('completeOrder')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// Modal de Cancelar OS
function CancelModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isLoading: boolean;
}) {
  const { t } = useTranslations('workOrders');
  const { t: tCommon } = useTranslations('common');
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    if (reason.trim()) {
      onConfirm(reason);
      setReason('');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('cancelOrder')}>
      <div className="space-y-4">
        <Alert variant="error">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {t('cancelOrderWarning')}
          </div>
        </Alert>

        <FormField label={t('cancellationReason') + ' *'}>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('cancellationReasonPlaceholder')}
            rows={3}
          />
        </FormField>

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            {tCommon('back')}
          </Button>
          <Button
            variant="error"
            onClick={handleConfirm}
            loading={isLoading}
            disabled={!reason.trim()}
            leftIcon={<XCircle className="h-4 w-4" />}
          >
            {t('cancelOrder')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// Modal de Deletar OS
function DeleteModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
}) {
  const { t } = useTranslations('workOrders');
  const { t: tCommon } = useTranslations('common');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('deleteOrder')}>
      <div className="space-y-4">
        <Alert variant="error">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {t('deleteOrderWarning')}
          </div>
        </Alert>

        <p className="text-sm text-gray-600">
          {t('deleteOrderConfirm')}
        </p>

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            {tCommon('cancel')}
          </Button>
          <Button
            variant="error"
            onClick={onConfirm}
            loading={isLoading}
            leftIcon={<Trash2 className="h-4 w-4" />}
          >
            {t('deleteOrder')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default function WorkOrderDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { t } = useTranslations('workOrders');
  const { t: tCommon } = useTranslations('common');

  // Queries
  const { data: workOrder, isLoading, error, refetch } = useWorkOrder(id);
  const { data: timeline } = useClientTimelineFlow(workOrder?.clientId);

  // Mutations
  const updateStatus = useUpdateWorkOrderStatus();
  const completeWorkOrder = useCompleteWorkOrder();
  const deleteWorkOrder = useDeleteWorkOrder();

  // Modal states
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [activeTab, setActiveTab] = useState('info');
  const [isSharing, setIsSharing] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [publicLinkCopied, setPublicLinkCopied] = useState(false);

  // Auth context para nome da empresa
  const { user } = useAuth();

  // Handlers
  const handleStartWorkOrder = async () => {
    if (!workOrder) return;
    await updateStatus.mutateAsync({ id: workOrder.id, status: 'IN_PROGRESS' as WorkOrderStatus });
    refetch();
  };

  const handlePauseWorkOrder = async (reason: string) => {
    if (!workOrder) return;
    await updateStatus.mutateAsync({
      id: workOrder.id,
      status: 'SCHEDULED' as WorkOrderStatus,
      reason,
    });
    setShowPauseModal(false);
    refetch();
  };

  const handleResumeWorkOrder = async () => {
    if (!workOrder) return;
    await updateStatus.mutateAsync({ id: workOrder.id, status: 'IN_PROGRESS' as WorkOrderStatus });
    refetch();
  };

  const handleCompleteWorkOrder = async (signature?: string) => {
    if (!workOrder) return;
    await completeWorkOrder.mutateAsync(workOrder.id);
    setShowCompleteModal(false);
    refetch();
  };

  const handleCancelWorkOrder = async (reason: string) => {
    if (!workOrder) return;
    await updateStatus.mutateAsync({
      id: workOrder.id,
      status: 'CANCELED' as WorkOrderStatus,
      reason,
    });
    setShowCancelModal(false);
    refetch();
  };

  const handleReopenWorkOrder = async () => {
    if (!workOrder) return;
    await updateStatus.mutateAsync({ id: workOrder.id, status: 'IN_PROGRESS' as WorkOrderStatus });
    refetch();
  };

  const handleShareViaWhatsApp = async () => {
    if (!workOrder) return;
    setIsSharing(true);
    try {
      const { shareKey } = await getWorkOrderShareLink(workOrder.id);
      const companyName = user?.companyName || user?.name || 'Empresa';
      shareWorkOrderViaWhatsApp(
        shareKey,
        workOrder.client?.phone,
        workOrder.title,
        companyName
      );
    } catch (error) {
      console.error('Erro ao gerar link de compartilhamento:', error);
      alert('Erro ao gerar link de compartilhamento. Tente novamente.');
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopyPublicLink = async () => {
    if (!workOrder) return;
    setIsGeneratingLink(true);
    try {
      const { shareKey } = await getWorkOrderShareLink(workOrder.id);
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const publicUrl = `${baseUrl}/os/${shareKey}`;

      await navigator.clipboard.writeText(publicUrl);
      setPublicLinkCopied(true);
      setTimeout(() => setPublicLinkCopied(false), 2000);
    } catch (error) {
      console.error('Erro ao copiar link:', error);
      alert('Erro ao copiar link. Tente novamente.');
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const handleDeleteWorkOrder = async () => {
    if (!workOrder) return;
    await deleteWorkOrder.mutateAsync(workOrder.id);
    router.push('/work-orders');
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !workOrder) {
    return (
      <div className="space-y-6">
        <Link href="/work-orders">
          <Button variant="ghost" size="sm" leftIcon={<ChevronLeft className="h-4 w-4" />}>
            {tCommon('back')}
          </Button>
        </Link>
        <Alert variant="error">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {t('orderNotFound')}
          </div>
        </Alert>
      </div>
    );
  }

  // Permissões
  const canEdit = canEditWorkOrder(workOrder);
  const canStart = canStartWorkOrder(workOrder);
  const canComplete = canCompleteWorkOrder(workOrder);
  const canCancel = canCancelWorkOrder(workOrder);
  const isInProgress = workOrder.status === 'IN_PROGRESS';
  const isScheduled = workOrder.status === 'SCHEDULED';

  // Filtrar timeline para esta OS
  const workOrderTimeline = timeline?.filter(
    (event) => event.workOrderId === workOrder.id
  ) || [];

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/work-orders">
              <Button variant="ghost" size="sm" leftIcon={<ChevronLeft className="h-4 w-4" />}>
                {tCommon('back')}
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">
                  {t('orderNumber', { number: workOrder.number })}
                </h1>
                <WorkOrderStatusBadge status={workOrder.status} />
              </div>
              <p className="text-sm text-gray-500">
                {t('createdAt', { date: formatDate(workOrder.createdAt) })}
              </p>
            </div>
          </div>

          {/* Ações */}
          <div className="flex items-center gap-2">
            {/* Botão principal baseado no status */}
            {canStart && (
              <Button
                onClick={handleStartWorkOrder}
                loading={updateStatus.isPending}
                leftIcon={<Play className="h-4 w-4" />}
              >
                {t('startOrder')}
              </Button>
            )}

            {isInProgress && (
              <>
                <Button
                  variant="warning"
                  onClick={() => setShowPauseModal(true)}
                  leftIcon={<Pause className="h-4 w-4" />}
                >
                  {t('pause')}
                </Button>
                <Button
                  variant="success"
                  onClick={() => setShowCompleteModal(true)}
                  leftIcon={<CheckCircle className="h-4 w-4" />}
                >
                  {t('complete')}
                </Button>
              </>
            )}

            {/* Se estava pausada (voltou para SCHEDULED após IN_PROGRESS) */}
            {isScheduled && workOrder.startedAt && (
              <Button
                onClick={handleResumeWorkOrder}
                loading={updateStatus.isPending}
                leftIcon={<RefreshCw className="h-4 w-4" />}
              >
                {t('resumeOrder')}
              </Button>
            )}

            {/* Botão Copiar Link Público */}
            <Button
              variant="outline"
              onClick={handleCopyPublicLink}
              disabled={isGeneratingLink}
              leftIcon={
                isGeneratingLink ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : publicLinkCopied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <LinkIcon className="h-4 w-4" />
                )
              }
              className={publicLinkCopied ? 'text-green-600 border-green-600' : ''}
            >
              {isGeneratingLink ? 'Gerando...' : publicLinkCopied ? 'Copiado!' : 'OS Digital'}
            </Button>

            {/* Botões para OS concluída */}
            {workOrder.status === 'DONE' && (
              <>
                <Button
                  variant="outline"
                  onClick={handleReopenWorkOrder}
                  loading={updateStatus.isPending}
                  leftIcon={<RefreshCw className="h-4 w-4" />}
                >
                  Reabrir OS
                </Button>

                {/* Botão Criar Cobrança - só aparece se OS tem valor */}
                {workOrder.totalValue && workOrder.totalValue > 0 && (
                  <Link href={`/billing/charges/new?clientId=${workOrder.clientId}&workOrderId=${workOrder.id}`}>
                    <Button
                      variant="default"
                      leftIcon={<Receipt className="h-4 w-4" />}
                    >
                      Criar Cobrança
                    </Button>
                  </Link>
                )}
              </>
            )}

            {/* Botão PDF */}
            <PdfButton
              entityType="WORK_ORDER"
              entityId={workOrder.id}
              variant="outline"
              size="default"
              showLabel={true}
            />

            {/* Botão Compartilhar via WhatsApp */}
            <Button
              variant="outline"
              onClick={handleShareViaWhatsApp}
              disabled={isSharing}
              leftIcon={isSharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
              className="text-green-600 border-green-600 hover:bg-green-50"
            >
              {isSharing ? 'Gerando...' : 'WhatsApp'}
            </Button>

            {/* Menu de mais ações */}
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowActionsMenu(!showActionsMenu)}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>

              {showActionsMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowActionsMenu(false)}
                  />
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border z-20">
                    {canEdit && (
                      <Link href={`/work-orders/${workOrder.id}/edit`}>
                        <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          <Edit className="h-4 w-4" />
                          {tCommon('edit')}
                        </button>
                      </Link>
                    )}
                    <Link href={`/expenses/new?workOrderId=${workOrder.id}`}>
                      <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                        <Receipt className="h-4 w-4" />
                        Adicionar Despesa
                      </button>
                    </Link>
                    {canCancel && (
                      <button
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-error hover:bg-gray-50"
                        onClick={() => {
                          setShowActionsMenu(false);
                          setShowCancelModal(true);
                        }}
                      >
                        <XCircle className="h-4 w-4" />
                        {t('cancelOrder')}
                      </button>
                    )}
                    <button
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-error hover:bg-gray-50"
                      onClick={() => {
                        setShowActionsMenu(false);
                        setShowDeleteModal(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                      {tCommon('delete')}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <TabsList>
              <TabsTrigger value="info">
                <FileText className="h-4 w-4 mr-2" />
                {t('information')}
              </TabsTrigger>
              <TabsTrigger value="checklists">
                <ClipboardList className="h-4 w-4 mr-2" />
                {t('checklists')}
              </TabsTrigger>
              <TabsTrigger value="attachments">
                <Camera className="h-4 w-4 mr-2" />
                {t('attachments')}
              </TabsTrigger>
              <TabsTrigger value="signature">
                <PenLine className="h-4 w-4 mr-2" />
                Assinatura
              </TabsTrigger>
              <TabsTrigger value="timeline">
                <History className="h-4 w-4 mr-2" />
                {t('timeline')}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab: Informações */}
          <TabsContent value="info">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Coluna principal */}
              <div className="lg:col-span-2 space-y-6">
                {/* Detalhes da OS */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      {t('details')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">{t('titleLabel')}</label>
                      <p className="text-gray-900">{workOrder.title}</p>
                    </div>

                    {/* Tipo de OS */}
                    {workOrder.workOrderType && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Tipo de OS</label>
                        <div className="flex items-center gap-2 mt-1">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: workOrder.workOrderType.color || '#6B7280' }}
                          />
                          <span className="text-gray-900">{workOrder.workOrderType.name}</span>
                        </div>
                      </div>
                    )}

                    {workOrder.description && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">{t('description')}</label>
                        <p className="text-gray-900 whitespace-pre-wrap">
                          {workOrder.description}
                        </p>
                      </div>
                    )}

                    {workOrder.notes && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">{t('notes')}</label>
                        <p className="text-gray-900 whitespace-pre-wrap">{workOrder.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Itens da OS */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      {t('items')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <WorkOrderItemsTable items={workOrder.items || []} />

                    {/* Resumo financeiro */}
                    {workOrder.totalValue !== undefined && (
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">{t('subtotal')}:</span>
                          <span className="text-gray-900">
                            {formatCurrency(
                              (workOrder.items || []).reduce(
                                (sum, item) => sum + item.quantity * item.unitPrice,
                                0
                              )
                            )}
                          </span>
                        </div>
                        {workOrder.discountValue && workOrder.discountValue > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">{t('discount')}:</span>
                            <span className="text-error">
                              -{formatCurrency(workOrder.discountValue)}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between text-lg font-semibold border-t pt-2">
                          <span className="text-gray-700">{t('total')}:</span>
                          <span className="text-gray-900">
                            {formatCurrency(workOrder.totalValue)}
                          </span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Coluna lateral */}
              <div className="space-y-6">
                {/* Cliente */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      {t('client')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {workOrder.client ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary-100 text-primary font-medium">
                            {workOrder.client.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <Link
                              href={`/clients/${workOrder.client.id}`}
                              className="font-medium text-gray-900 hover:text-primary"
                            >
                              {workOrder.client.name}
                            </Link>
                            {workOrder.client.phone && (
                              <p className="text-sm text-gray-500">
                                <a href={`tel:${workOrder.client.phone}`} className="hover:underline">
                                  {workOrder.client.phone}
                                </a>
                              </p>
                            )}
                          </div>
                        </div>
                        {workOrder.client.email && (
                          <a
                            href={`mailto:${workOrder.client.email}`}
                            className="text-sm text-primary hover:underline"
                          >
                            {workOrder.client.email}
                          </a>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">{t('clientNotProvided')}</p>
                    )}
                  </CardContent>
                </Card>

                {/* Agendamento */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      {t('scheduling')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {workOrder.scheduledDate ? (
                      <>
                        <div className="flex items-center gap-2 text-gray-900">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          {formatDate(workOrder.scheduledDate)}
                        </div>

                        {(workOrder.scheduledStartTime || workOrder.scheduledEndTime) && (
                          <div className="flex items-center gap-2 text-gray-900">
                            <Clock className="h-4 w-4 text-gray-400" />
                            {workOrder.scheduledStartTime &&
                              formatTime(workOrder.scheduledStartTime)}
                            {workOrder.scheduledStartTime && workOrder.scheduledEndTime && ' - '}
                            {workOrder.scheduledEndTime && formatTime(workOrder.scheduledEndTime)}
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-gray-500">{t('notScheduled')}</p>
                    )}

                    {workOrder.address && (
                      <div className="flex items-start gap-2 text-gray-900">
                        <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                        <span className="text-sm">{workOrder.address}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Execução */}
                {(workOrder.startedAt || workOrder.completedAt) && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        {t('execution')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {workOrder.startedAt && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">{t('startedAt')}:</span>
                          <span className="text-gray-900">
                            {formatDate(workOrder.startedAt)} {formatTime(workOrder.startedAt)}
                          </span>
                        </div>
                      )}
                      {workOrder.completedAt && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">{t('completedAt')}:</span>
                          <span className="text-gray-900">
                            {formatDate(workOrder.completedAt)} {formatTime(workOrder.completedAt)}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Orçamento relacionado */}
                {workOrder.quote && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        {t('quote')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Link
                        href={`/quotes/${workOrder.quote.id}`}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div>
                          <p className="font-medium text-gray-900">
                            {t('quoteNumber', { number: workOrder.quote.number })}
                          </p>
                          <p className="text-sm text-gray-500">
                            {formatCurrency(workOrder.quote.totalValue)}
                          </p>
                        </div>
                        <ChevronLeft className="h-4 w-4 rotate-180 text-gray-400" />
                      </Link>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Tab: Checklists */}
          <TabsContent value="checklists">
            <ChecklistsContainer workOrderId={workOrder.id} workOrderStatus={workOrder.status} />
          </TabsContent>

          {/* Tab: Anexos */}
          <TabsContent value="attachments">
            <AttachmentsContainer
              workOrderId={workOrder.id}
              canUpload={workOrder.status !== 'DONE' && workOrder.status !== 'CANCELED'}
            />
          </TabsContent>

          {/* Tab: Assinatura */}
          <TabsContent value="signature">
            <SignatureSection
              workOrderId={workOrder.id}
              workOrderStatus={workOrder.status}
            />
          </TabsContent>

          {/* Tab: Timeline */}
          <TabsContent value="timeline">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  {t('eventHistory')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <WorkOrderTimeline events={workOrderTimeline} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modais */}
      <PauseModal
        isOpen={showPauseModal}
        onClose={() => setShowPauseModal(false)}
        onConfirm={handlePauseWorkOrder}
        isLoading={updateStatus.isPending}
      />

      <CompleteModal
        isOpen={showCompleteModal}
        onClose={() => setShowCompleteModal(false)}
        onConfirm={handleCompleteWorkOrder}
        isLoading={completeWorkOrder.isPending}
      />

      <CancelModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleCancelWorkOrder}
        isLoading={updateStatus.isPending}
      />

      <DeleteModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteWorkOrder}
        isLoading={deleteWorkOrder.isPending}
      />
    </AppLayout>
  );
}
