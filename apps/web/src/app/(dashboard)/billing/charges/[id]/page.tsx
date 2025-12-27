'use client';

/**
 * Página de Detalhes da Cobrança
 *
 * Exibe:
 * - Informações da cobrança (status, cliente, valor)
 * - URLs de pagamento (boleto, PIX, cartão)
 * - Ações (copiar PIX, baixar boleto, enviar WhatsApp)
 * - Pagamento manual
 * - Cancelamento
 * - Timeline de eventos
 */

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft,
  Edit,
  MoreVertical,
  Copy,
  Download,
  ExternalLink,
  QrCode,
  MessageSquare,
  DollarSign,
  XCircle,
  Calendar,
  User,
  FileText,
  History,
  AlertCircle,
  Check,
  Mail,
  Clock,
} from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Skeleton,
  Alert,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui';
import {
  ChargeStatusBadge,
  BillingTypeBadge,
  ChargeTimeline,
  PixQRCodeModal,
  ManualPaymentModal,
  CancelChargeModal,
  WhatsAppShareButton,
} from '@/components/billing';
import { AppLayout } from '@/components/layout';
import {
  useCharge,
  useChargeEvents,
  useRegisterManualPayment,
  useCancelCharge,
  useResendChargeEmail,
} from '@/hooks/use-charges';
import {
  canEditCharge,
  canCancelCharge,
  canRegisterManualPayment,
  isChargePaid,
  getPublicPaymentUrl,
} from '@/services/charges.service';
import { formatDocument } from '@/lib/utils';
import { Link2 } from 'lucide-react';
import { useTranslations } from '@/i18n';
import { useFormatting } from '@/hooks/use-formatting';

export default function ChargeDetailsPage() {
  const { t } = useTranslations('billing');
  const { formatCurrency, formatDate, formatDateTime } = useFormatting();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  // Queries
  const { data: charge, isLoading, error, refetch } = useCharge(id);
  const { data: events, isLoading: isLoadingEvents } = useChargeEvents(id);

  // Mutations
  const registerManualPayment = useRegisterManualPayment();
  const cancelCharge = useCancelCharge();
  const resendEmail = useResendChargeEmail();

  // Estados
  const [showPixModal, setShowPixModal] = useState(false);
  const [showManualPaymentModal, setShowManualPaymentModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [copiedPix, setCopiedPix] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeTab, setActiveTab] = useState('info');

  // Handlers
  const handleCopyPix = async () => {
    if (!charge?.urls.pixCopiaECola) return;

    try {
      await navigator.clipboard.writeText(charge.urls.pixCopiaECola);
      setCopiedPix(true);
      setTimeout(() => setCopiedPix(false), 2000);
    } catch (err) {
      console.error('Erro ao copiar:', err);
    }
  };

  const handleCopyPaymentLink = async () => {
    if (!charge) return;
    const publicUrl = getPublicPaymentUrl(charge);
    if (!publicUrl) return;

    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      console.error('Erro ao copiar link:', err);
    }
  };

  const handleManualPayment = async (data: Parameters<typeof registerManualPayment.mutateAsync>[0]['data']) => {
    if (!charge) return;
    await registerManualPayment.mutateAsync({ id: charge.id, data });
    setShowManualPaymentModal(false);
    refetch();
  };

  const handleCancelCharge = async (reason: string) => {
    if (!charge) return;
    await cancelCharge.mutateAsync({ id: charge.id, data: { reason } });
    setShowCancelModal(false);
    refetch();
  };

  const handleResendEmail = async () => {
    if (!charge) return;
    await resendEmail.mutateAsync(charge.id);
    refetch();
  };

  // Loading state
  if (isLoading) {
    return (
      <AppLayout>
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
      </AppLayout>
    );
  }

  // Error state
  if (error || !charge) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Link href="/billing/charges">
            <Button variant="ghost" size="sm" leftIcon={<ChevronLeft className="h-4 w-4" />}>
              {t('back')}
            </Button>
          </Link>
          <Alert variant="error">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {t('chargeNotFound')}
            </div>
          </Alert>
        </div>
      </AppLayout>
    );
  }

  // Permissões
  const canEdit = canEditCharge(charge);
  const canCancel = canCancelCharge(charge);
  const canManualPayment = canRegisterManualPayment(charge);
  const isPaid = isChargePaid(charge);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/billing/charges">
              <Button variant="ghost" size="sm" leftIcon={<ChevronLeft className="h-4 w-4" />}>
                {t('back')}
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">
                  {t('charge')}
                </h1>
                <ChargeStatusBadge status={charge.status} />
              </div>
              <p className="text-sm text-gray-500">
                {charge.description || `#${charge.asaasId || charge.id.slice(0, 8)}`}
              </p>
            </div>
          </div>

          {/* Ações principais */}
          <div className="flex items-center gap-2">
            {/* Copiar Link de Pagamento */}
            {charge.publicToken && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyPaymentLink}
                leftIcon={
                  copiedLink ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <Link2 className="h-4 w-4" />
                  )
                }
              >
                {copiedLink ? t('linkCopied') : t('copyLink')}
              </Button>
            )}

            {/* WhatsApp */}
            <WhatsAppShareButton charge={charge} />

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
                      <Link href={`/billing/charges/${charge.id}/edit`}>
                        <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          <Edit className="h-4 w-4" />
                          {t('edit')}
                        </button>
                      </Link>
                    )}
                    {charge.client?.email && (
                      <button
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => {
                          setShowActionsMenu(false);
                          handleResendEmail();
                        }}
                      >
                        <Mail className="h-4 w-4" />
                        {t('resendEmail')}
                      </button>
                    )}
                    {canManualPayment && (
                      <button
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => {
                          setShowActionsMenu(false);
                          setShowManualPaymentModal(true);
                        }}
                      >
                        <DollarSign className="h-4 w-4" />
                        {t('registerPayment')}
                      </button>
                    )}
                    {canCancel && (
                      <button
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-error hover:bg-gray-50"
                        onClick={() => {
                          setShowActionsMenu(false);
                          setShowCancelModal(true);
                        }}
                      >
                        <XCircle className="h-4 w-4" />
                        {t('cancelCharge')}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="info">
              <FileText className="h-4 w-4 mr-2" />
              {t('information')}
            </TabsTrigger>
            <TabsTrigger value="timeline">
              <History className="h-4 w-4 mr-2" />
              {t('timeline')}
            </TabsTrigger>
          </TabsList>

          {/* Tab: Informações */}
          <TabsContent value="info">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Coluna principal */}
              <div className="lg:col-span-2 space-y-6">
                {/* Valor e status */}
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">{t('chargeValue')}</p>
                        <p className="text-3xl font-bold text-gray-900">
                          {formatCurrency(charge.value)}
                        </p>
                        {charge.netValue && charge.netValue !== charge.value && (
                          <p className="text-sm text-gray-500 mt-1">
                            {t('netValue')}: {formatCurrency(charge.netValue)}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <BillingTypeBadge type={charge.billingType} size="lg" />
                        <p className="text-sm text-gray-500 mt-2">
                          {t('dueDate')}: {formatDate(new Date(charge.dueDate))}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Ações de pagamento */}
                {!isPaid && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5" />
                        {t('paymentOptions')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* PIX */}
                        {charge.billingType === 'PIX' && charge.urls.pixCopiaECola && (
                          <>
                            <Button
                              variant="outline"
                              onClick={() => setShowPixModal(true)}
                              leftIcon={<QrCode className="h-4 w-4" />}
                              className="justify-start"
                            >
                              {t('viewPixQrCode')}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={handleCopyPix}
                              leftIcon={
                                copiedPix ? (
                                  <Check className="h-4 w-4 text-success" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )
                              }
                              className="justify-start"
                            >
                              {copiedPix ? t('copied') : t('copyPix')}
                            </Button>
                          </>
                        )}

                        {/* Boleto */}
                        {charge.urls.bankSlipUrl && (
                          <a
                            href={charge.urls.bankSlipUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button
                              variant="outline"
                              leftIcon={<Download className="h-4 w-4" />}
                              className="justify-start w-full"
                            >
                              {t('downloadBoleto')}
                            </Button>
                          </a>
                        )}

                        {/* Link de pagamento interno */}
                        {charge.publicToken && (
                          <a
                            href={getPublicPaymentUrl(charge) || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button
                              variant="outline"
                              leftIcon={<ExternalLink className="h-4 w-4" />}
                              className="justify-start w-full"
                            >
                              {t('openPaymentPage')}
                            </Button>
                          </a>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Pagamento confirmado */}
                {isPaid && (
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4 text-success">
                        <div className="p-3 bg-success-100 rounded-full">
                          <Check className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="font-semibold text-lg">{t('paymentConfirmed')}</p>
                          {charge.paymentDate && (
                            <p className="text-sm text-success-700">
                              {t('paidOn')} {formatDateTime(new Date(charge.paymentDate))}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Comprovante */}
                      {charge.urls.transactionReceiptUrl && (
                        <div className="mt-4 pt-4 border-t">
                          <a
                            href={charge.urls.transactionReceiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button
                              variant="outline"
                              leftIcon={<Download className="h-4 w-4" />}
                            >
                              {t('downloadReceipt')}
                            </Button>
                          </a>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Desconto, Multa e Juros */}
                {(charge.discount || charge.fine || charge.interest) && (
                  <Card>
                    <CardHeader>
                      <CardTitle>{t('paymentConditions')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {charge.discount && (
                        <div className="flex justify-between p-3 bg-success-50 rounded-lg">
                          <span className="text-success-700">{t('discountLabel')}</span>
                          <span className="font-medium text-success-900">
                            {charge.discount.type === 'PERCENTAGE'
                              ? `${charge.discount.value}%`
                              : formatCurrency(charge.discount.value)}
                          </span>
                        </div>
                      )}
                      {charge.fine && (
                        <div className="flex justify-between p-3 bg-warning-50 rounded-lg">
                          <span className="text-warning-700">{t('lateFine')}</span>
                          <span className="font-medium text-warning-900">
                            {charge.fine.value}%
                          </span>
                        </div>
                      )}
                      {charge.interest && (
                        <div className="flex justify-between p-3 bg-error-50 rounded-lg">
                          <span className="text-error-700">{t('monthlyInterest')}</span>
                          <span className="font-medium text-error-900">
                            {charge.interest.value}%
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
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
                    {charge.client ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary-100 text-primary font-medium">
                            {charge.client.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <Link
                              href={`/clients/${charge.client.id}`}
                              className="font-medium text-gray-900 hover:text-primary"
                            >
                              {charge.client.name}
                            </Link>
                            {charge.client.phone && (
                              <p className="text-sm text-gray-500">
                                <a href={`tel:${charge.client.phone}`} className="hover:underline">
                                  {charge.client.phone}
                                </a>
                              </p>
                            )}
                          </div>
                        </div>
                        {charge.client.email && (
                          <a
                            href={`mailto:${charge.client.email}`}
                            className="text-sm text-primary hover:underline block"
                          >
                            {charge.client.email}
                          </a>
                        )}
                        {charge.client.taxId && (
                          <p className="text-sm text-gray-500">
                            {t('taxId')}: {formatDocument(charge.client.taxId)}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">{t('clientNotInformed')}</p>
                    )}
                  </CardContent>
                </Card>

                {/* Datas */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      {t('dates')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{t('createdAt')}:</span>
                      <span className="text-gray-900">{formatDate(new Date(charge.createdAt))}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{t('dueDate')}:</span>
                      <span className="text-gray-900">{formatDate(new Date(charge.dueDate))}</span>
                    </div>
                    {charge.paymentDate && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">{t('paidAt')}:</span>
                        <span className="text-success font-medium">
                          {formatDate(new Date(charge.paymentDate))}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{t('updatedAt')}:</span>
                      <span className="text-gray-900">{formatDateTime(new Date(charge.updatedAt))}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* IDs */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      {t('identifiers')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="text-xs">
                      <span className="text-gray-500">{t('internalId')}:</span>
                      <p className="font-mono text-gray-700 break-all">{charge.id}</p>
                    </div>
                    {charge.asaasId && (
                      <div className="text-xs">
                        <span className="text-gray-500">{t('asaasId')}:</span>
                        <p className="font-mono text-gray-700">{charge.asaasId}</p>
                      </div>
                    )}
                    {charge.externalReference && (
                      <div className="text-xs">
                        <span className="text-gray-500">{t('externalReference')}:</span>
                        <p className="font-mono text-gray-700">{charge.externalReference}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
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
                <ChargeTimeline events={events || []} isLoading={isLoadingEvents} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modais */}
      <PixQRCodeModal
        isOpen={showPixModal}
        onClose={() => setShowPixModal(false)}
        pixQrCodeUrl={charge.urls.pixQrCodeUrl}
        pixCopiaECola={charge.urls.pixCopiaECola}
        value={charge.value}
      />

      <ManualPaymentModal
        isOpen={showManualPaymentModal}
        onClose={() => setShowManualPaymentModal(false)}
        onConfirm={handleManualPayment}
        isLoading={registerManualPayment.isPending}
        chargeValue={charge.value}
      />

      <CancelChargeModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleCancelCharge}
        isLoading={cancelCharge.isPending}
      />
    </AppLayout>
  );
}
