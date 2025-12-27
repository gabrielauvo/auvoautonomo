'use client';

/**
 * Quote Details Page - Página de detalhes do orçamento
 *
 * Exibe:
 * - Dados do cliente
 * - Itens do orçamento
 * - Ações: Editar, PDF, WhatsApp, Aprovar, Rejeitar
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout';
import { QuoteStatusBadge, QuoteItemsTable } from '@/components/quotes';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Skeleton,
  Alert,
  Textarea,
  FormField,
} from '@/components/ui';
import {
  ArrowLeft,
  Edit,
  FileText,
  Download,
  Send,
  Check,
  X,
  User,
  Phone,
  Mail,
  Calendar,
  AlertCircle,
  Loader2,
  ExternalLink,
  Wrench,
  Copy,
  Link2,
} from 'lucide-react';
import {
  useQuote,
  useUpdateQuoteStatus,
  useGenerateQuotePdf,
  useDownloadQuotePdf,
  useSendWhatsApp,
  useQuoteAttachments,
  useSendQuoteEmail,
} from '@/hooks/use-quotes';
import { useTemplateSettings } from '@/hooks/use-settings';
import { DEFAULT_QUOTE_TEMPLATE } from '@/services/settings.service';
import {
  canEditQuote,
  canSendQuote,
  canApproveRejectQuote,
  canConvertToWorkOrder,
  getQuoteShareLink,
} from '@/services/quotes.service';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/i18n';

// WhatsApp icon (não existe no lucide-react)
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

interface QuoteDetailsPageProps {
  params: { id: string };
}

// Formatar valor em moeda
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

// Formatar data
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function QuoteDetailsPage({ params }: QuoteDetailsPageProps) {
  const { id } = params;
  const router = useRouter();
  const { t } = useTranslations('quotes');
  const { t: tCommon } = useTranslations('common');

  // Queries
  const { data: quote, isLoading, error, refetch } = useQuote(id);
  const { data: attachments } = useQuoteAttachments(id);
  const { data: templateSettings } = useTemplateSettings();

  // Get template colors (fallback to defaults)
  const quoteTemplate = templateSettings?.quote || DEFAULT_QUOTE_TEMPLATE;
  const primaryColor = quoteTemplate.primaryColor;
  const secondaryColor = quoteTemplate.secondaryColor || primaryColor;

  // Mutations
  const updateStatus = useUpdateQuoteStatus();
  const generatePdf = useGenerateQuotePdf();
  const downloadPdf = useDownloadQuotePdf();
  const sendWhatsApp = useSendWhatsApp();
  const sendEmail = useSendQuoteEmail();

  // Local state
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);

  // Handlers
  const handleGeneratePdf = async () => {
    if (!quote) return;
    setActionLoading('pdf');
    try {
      await generatePdf.mutateAsync(id);
      refetch();
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownloadPdf = async () => {
    if (!quote || !id) {
      console.error('Quote ou ID não disponível para download do PDF');
      return;
    }
    setActionLoading('download');
    try {
      console.log('Iniciando download do PDF para quote:', id);
      await downloadPdf.mutateAsync(id);
      console.log('Download do PDF concluído com sucesso');
    } catch (error) {
      console.error('Erro ao baixar PDF:', error);
      alert(error instanceof Error ? error.message : 'Erro ao gerar PDF. Tente novamente.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!quote) return;

    setActionLoading('whatsapp');
    try {
      // Primeiro gera o PDF se não existir
      let attachmentId = attachments?.[0]?.id;

      if (!attachmentId) {
        const result = await generatePdf.mutateAsync(id);
        attachmentId = result.attachmentId;
      }

      // Envia pelo WhatsApp
      await sendWhatsApp.mutateAsync({
        quote,
        attachmentId,
      });

      // Se estava em DRAFT, muda para SENT
      if (quote.status === 'DRAFT') {
        await updateStatus.mutateAsync({ id, status: 'SENT' });
        refetch();
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendEmail = async () => {
    if (!quote) return;

    // Verifica se o cliente tem email
    if (!quote.client?.email) {
      toast.error(t('clientHasNoEmail'));
      return;
    }

    setActionLoading('email');
    try {
      await sendEmail.mutateAsync(id);
      refetch();
      toast.success(t('emailSentSuccessfully'), {
        description: t('emailSentToClient', { email: quote.client.email }),
      });
    } catch (error) {
      toast.error(t('emailSendError'), {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSend = async () => {
    if (!quote) return;
    setActionLoading('send');
    try {
      await updateStatus.mutateAsync({ id, status: 'SENT' });
      refetch();
    } finally {
      setActionLoading(null);
    }
  };

  const handleApprove = async () => {
    if (!quote) return;
    setActionLoading('approve');
    try {
      await updateStatus.mutateAsync({ id, status: 'APPROVED' });
      refetch();
      setShowApproveConfirm(false);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!quote) return;
    setActionLoading('reject');
    try {
      await updateStatus.mutateAsync({ id, status: 'REJECTED', reason: rejectReason || undefined });
      refetch();
      setShowRejectConfirm(false);
      setRejectReason('');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCopyLink = async () => {
    if (!quote) return;
    setIsGeneratingLink(true);
    try {
      const { shareKey } = await getQuoteShareLink(id);
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const publicUrl = `${baseUrl}/p/quotes/${shareKey}`;

      await navigator.clipboard.writeText(publicUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.error('Erro ao copiar link:', err);
      alert('Erro ao gerar link. Tente novamente.');
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const handleConvertToWorkOrder = () => {
    // TODO: Implementar conversão para OS
    router.push(`/work-orders/new?quoteId=${id}`);
  };

  // Loading state
  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <Skeleton className="h-10 w-10 rounded" />
            <div>
              <Skeleton className="h-8 w-64 mb-2" />
              <Skeleton className="h-4 w-40" />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Skeleton className="h-96 w-full" />
            </div>
            <div>
              <Skeleton className="h-64 w-full" />
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Error state
  if (error || !quote) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Alert variant="error">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {t('quoteNotFound')}
            </div>
          </Alert>
          <Link href="/quotes">
            <Button variant="outline" leftIcon={<ArrowLeft className="h-4 w-4" />}>
              {tCommon('backToList')}
            </Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  // Permissions
  const canEdit = canEditQuote(quote);
  const canSend = canSendQuote(quote);
  const canApproveReject = canApproveRejectQuote(quote);
  const canConvert = canConvertToWorkOrder(quote);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <Link href="/quotes">
              <Button variant="ghost" size="icon-sm">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">
                  {t('quote')}
                </h1>
                <QuoteStatusBadge status={quote.status} />
              </div>
              <p className="text-gray-500 mt-1 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {t('createdOn', { date: formatDate(quote.createdAt) })}
              </p>
            </div>
          </div>

          {/* Ações principais */}
          <div className="flex flex-wrap items-center gap-2">
            {canEdit && (
              <Link href={`/quotes/${id}/edit`}>
                <Button variant="outline" leftIcon={<Edit className="h-4 w-4" />}>
                  {tCommon('edit')}
                </Button>
              </Link>
            )}

            {/* PDF */}
            <Button
              variant="outline"
              leftIcon={
                actionLoading === 'download' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )
              }
              onClick={handleDownloadPdf}
              disabled={!!actionLoading}
            >
              {t('generatePdf')}
            </Button>

            {/* Copiar Link */}
            <Button
              variant="outline"
              leftIcon={
                isGeneratingLink ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : linkCopied ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <Link2 className="h-4 w-4" />
                )
              }
              onClick={handleCopyLink}
              disabled={!!actionLoading || isGeneratingLink}
              className={linkCopied ? 'text-green-600 border-green-600' : ''}
            >
              {isGeneratingLink ? 'Gerando...' : linkCopied ? t('copied') : t('copyLink')}
            </Button>

            {/* WhatsApp */}
            <Button
              variant="soft"
              leftIcon={
                actionLoading === 'whatsapp' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <WhatsAppIcon className="h-4 w-4" />
                )
              }
              onClick={handleSendWhatsApp}
              disabled={!!actionLoading}
              className="bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20"
            >
              WhatsApp
            </Button>

            {/* Email */}
            <Button
              variant="soft"
              leftIcon={
                actionLoading === 'email' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4" />
                )
              }
              onClick={handleSendEmail}
              disabled={!!actionLoading || !quote.client?.email}
              className="bg-blue-50 text-blue-600 hover:bg-blue-100"
              title={!quote.client?.email ? t('clientHasNoEmail') : undefined}
            >
              Email
            </Button>

            {/* Enviar */}
            {canSend && (
              <Button
                leftIcon={
                  actionLoading === 'send' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )
                }
                onClick={handleSend}
                disabled={!!actionLoading}
              >
                {t('markAsSent')}
              </Button>
            )}

            {/* Aprovar/Rejeitar */}
            {canApproveReject && (
              <>
                <Button
                  variant="soft"
                  leftIcon={<Check className="h-4 w-4" />}
                  onClick={() => setShowApproveConfirm(true)}
                  disabled={!!actionLoading}
                  className="bg-success-100 text-success hover:bg-success-200"
                >
                  {t('approve')}
                </Button>
                <Button
                  variant="soft"
                  leftIcon={<X className="h-4 w-4" />}
                  onClick={() => setShowRejectConfirm(true)}
                  disabled={!!actionLoading}
                  className="bg-error-100 text-error hover:bg-error-200"
                >
                  {t('reject')}
                </Button>
              </>
            )}

            {/* Converter para OS */}
            {canConvert && (
              <Button
                leftIcon={<Wrench className="h-4 w-4" />}
                onClick={handleConvertToWorkOrder}
              >
                {t('convertToOrder')}
              </Button>
            )}
          </div>
        </div>

        {/* Conteúdo */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna principal - Itens */}
          <div className="lg:col-span-2 space-y-6">
            {/* Itens do orçamento */}
            <Card>
              <CardHeader>
                <CardTitle>{t('items')}</CardTitle>
              </CardHeader>
              <CardContent>
                <QuoteItemsTable
                  items={quote.items || []}
                  isEditable={false}
                />
              </CardContent>
            </Card>

            {/* Observações */}
            {quote.notes && (
              <Card>
                <CardHeader>
                  <CardTitle>{t('notes')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">
                    {quote.notes}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Coluna lateral */}
          <div className="space-y-6">
            {/* Dados do cliente */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('client')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Link
                  href={`/clients/${quote.clientId}`}
                  className="flex items-center gap-3 hover:bg-gray-50 rounded-lg -mx-2 px-2 py-2 transition-colors"
                >
                  <div
                    className="flex items-center justify-center w-10 h-10 rounded-full font-medium"
                    style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}
                  >
                    {quote.client?.name?.charAt(0).toUpperCase() || 'C'}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{quote.client?.name}</p>
                    <p className="text-xs text-gray-500">{t('viewProfile')}</p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-gray-400" />
                </Link>

                {quote.client?.phone && (
                  <a
                    href={`tel:${quote.client.phone.replace(/\D/g, '')}`}
                    className="flex items-center gap-3 hover:bg-gray-50 rounded-lg -mx-2 px-2 py-1 transition-colors"
                  >
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <Phone className="h-4 w-4 text-gray-500" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">{t('phone')}</p>
                      <p
                        className="text-sm font-medium hover:underline"
                        style={{ color: primaryColor }}
                      >
                        {quote.client.phone}
                      </p>
                    </div>
                  </a>
                )}

                {quote.client?.email && (
                  <a
                    href={`mailto:${quote.client.email}`}
                    className="flex items-center gap-3 hover:bg-gray-50 rounded-lg -mx-2 px-2 py-1 transition-colors"
                  >
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <Mail className="h-4 w-4 text-gray-500" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">{t('email')}</p>
                      <p
                        className="text-sm font-medium hover:underline break-all"
                        style={{ color: primaryColor }}
                      >
                        {quote.client.email}
                      </p>
                    </div>
                  </a>
                )}
              </CardContent>
            </Card>

            {/* Resumo financeiro */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('summary')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t('subtotal')}:</span>
                  <span className="text-gray-700">{formatCurrency((quote.items || []).reduce((sum, item) => sum + Number(item.totalPrice || 0), 0))}</span>
                </div>
                {quote.discountValue > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">{t('discount')}:</span>
                    <span className="text-error">
                      -{formatCurrency(quote.discountValue)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-semibold pt-3 border-t">
                  <span className="text-gray-700">{t('total')}:</span>
                  <span className="text-gray-900">
                    {formatCurrency(quote.totalValue)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Histórico de status */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('history')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-gray-400 mt-1.5" />
                  <div>
                    <p className="text-sm text-gray-700">{t('created')}</p>
                    <p className="text-xs text-gray-500">
                      {formatDateTime(quote.createdAt)}
                    </p>
                  </div>
                </div>

                {quote.sentAt && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-info mt-1.5" />
                    <div>
                      <p className="text-sm text-gray-700">{t('sent')}</p>
                      <p className="text-xs text-gray-500">
                        {formatDateTime(quote.sentAt)}
                      </p>
                    </div>
                  </div>
                )}

                {quote.approvedAt && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-success mt-1.5" />
                    <div>
                      <p className="text-sm text-gray-700">{t('approved')}</p>
                      <p className="text-xs text-gray-500">
                        {formatDateTime(quote.approvedAt)}
                      </p>
                    </div>
                  </div>
                )}

                {quote.rejectedAt && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-error mt-1.5" />
                    <div>
                      <p className="text-sm text-gray-700">{t('rejected')}</p>
                      <p className="text-xs text-gray-500">
                        {formatDateTime(quote.rejectedAt)}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Modal de confirmação - Aprovar */}
      {showApproveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowApproveConfirm(false)}
          />
          <div className="relative bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-success-100">
                <Check className="h-5 w-5 text-success" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {t('approveQuoteQuestion')}
                </h3>
                <p className="text-sm text-gray-500">
                  {t('clientWillBeNotified')}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="ghost"
                onClick={() => setShowApproveConfirm(false)}
                disabled={actionLoading === 'approve'}
              >
                {tCommon('cancel')}
              </Button>
              <Button
                onClick={handleApprove}
                loading={actionLoading === 'approve'}
                className="bg-success hover:bg-success-600"
              >
                {t('confirmApproval')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmação - Rejeitar */}
      {showRejectConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              setShowRejectConfirm(false);
              setRejectReason('');
            }}
          />
          <div className="relative bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-error-100">
                <X className="h-5 w-5 text-error" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {t('rejectQuoteQuestion')}
                </h3>
                <p className="text-sm text-gray-500">
                  {t('actionCannotBeUndone')}
                </p>
              </div>
            </div>

            <FormField label={t('rejectionReasonOptional')}>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={t('rejectionReasonPlaceholder')}
                rows={3}
              />
            </FormField>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowRejectConfirm(false);
                  setRejectReason('');
                }}
                disabled={actionLoading === 'reject'}
              >
                {tCommon('cancel')}
              </Button>
              <Button
                variant="soft"
                onClick={handleReject}
                loading={actionLoading === 'reject'}
                className="bg-error-100 text-error hover:bg-error-200"
              >
                {t('confirmRejection')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
