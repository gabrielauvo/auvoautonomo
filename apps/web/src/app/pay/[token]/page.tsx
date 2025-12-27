'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  FileText,
  Loader2,
  QrCode,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface PaymentData {
  id: string;
  status: string;
  value: number;
  billingType: string;
  dueDate: string;
  description: string | null;
  paidAt: string | null;
  createdAt: string;
  invoiceUrl: string | null;
  pixQrCodeUrl: string | null;
  pixCode: string | null;
  client: {
    name: string;
    email: string | null;
    phone: string | null;
    taxId: string | null;
    location: string | null;
  };
  company: {
    name: string;
    logoUrl: string | null;
    phone: string | null;
    email: string | null;
  };
  reference: {
    type: 'workOrder' | 'quote';
    id: string;
    title?: string;
  } | null;
}

interface PixData {
  pixCode: string;
  qrCodeUrl: string | null;
  qrCodeBase64: string | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  PENDING: { label: 'Aguardando Pagamento', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  OVERDUE: { label: 'Vencido', color: 'bg-red-100 text-red-800', icon: AlertCircle },
  CONFIRMED: { label: 'Pagamento Confirmado', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  RECEIVED: { label: 'Pagamento Recebido', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  RECEIVED_IN_CASH: { label: 'Pago em Dinheiro', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  DELETED: { label: 'Cancelado', color: 'bg-gray-100 text-gray-800', icon: XCircle },
  REFUNDED: { label: 'Estornado', color: 'bg-gray-100 text-gray-800', icon: XCircle },
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR');
}

function isToday(dateString: string): boolean {
  const date = new Date(dateString);
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

export default function PublicPaymentPage() {
  const params = useParams();
  const token = params.token as string;
  const t = useTranslations('common');

  const [payment, setPayment] = useState<PaymentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [loadingPix, setLoadingPix] = useState(false);
  const [loadingBoleto, setLoadingBoleto] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetchPayment() {
      try {
        const response = await fetch(`${API_URL}/public/payments/${token}`);
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Cobranca nao encontrada');
          }
          throw new Error('Erro ao carregar cobranca');
        }
        const data = await response.json();
        setPayment(data);

        // Se ja tem PIX data, usar
        if (data.pixCode) {
          setPixData({
            pixCode: data.pixCode,
            qrCodeUrl: data.pixQrCodeUrl,
            qrCodeBase64: null,
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      fetchPayment();
    }
  }, [token]);

  const handleGetPix = async () => {
    if (!payment) return;

    setLoadingPix(true);
    try {
      const response = await fetch(`${API_URL}/public/payments/${token}/pix`, {
        method: 'POST',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Erro ao gerar PIX');
      }
      const data = await response.json();
      setPixData(data);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao gerar PIX');
    } finally {
      setLoadingPix(false);
    }
  };

  const handleGetBoleto = async () => {
    if (!payment) return;

    setLoadingBoleto(true);
    try {
      const response = await fetch(`${API_URL}/public/payments/${token}/boleto`, {
        method: 'POST',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Erro ao gerar boleto');
      }
      const data = await response.json();
      if (data.invoiceUrl) {
        window.open(data.invoiceUrl, '_blank');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao gerar boleto');
    } finally {
      setLoadingBoleto(false);
    }
  };

  const handleCopyPix = async () => {
    if (!pixData?.pixCode) return;

    try {
      await navigator.clipboard.writeText(pixData.pixCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert('Erro ao copiar codigo PIX');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-gray-600">{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <XCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Cobranca nao encontrada
            </h2>
            <p className="text-gray-600">
              {error || 'O link de pagamento pode ter expirado ou ser invalido.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const status = statusConfig[payment.status] || statusConfig.PENDING;
  const StatusIcon = status.icon;
  const isPaid = ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'].includes(payment.status);
  const isCanceled = ['DELETED', 'REFUNDED'].includes(payment.status);
  const canPay = !isPaid && !isCanceled;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header com logo da empresa */}
        <div className="text-center">
          {payment.company.logoUrl ? (
            <img
              src={payment.company.logoUrl.startsWith('/') ? `${API_URL}${payment.company.logoUrl}` : payment.company.logoUrl}
              alt={payment.company.name}
              className="mx-auto mb-4 object-contain max-h-16"
            />
          ) : (
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {payment.company.name}
            </h1>
          )}
        </div>

        {/* Status e Valor */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <Badge className={cn('px-3 py-1', status.color)}>
                <StatusIcon className="h-4 w-4 mr-1" />
                {status.label}
              </Badge>
              {isToday(payment.dueDate) && canPay && (
                <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                  Vence hoje
                </Badge>
              )}
            </div>

            <div className="text-center py-4">
              <p className="text-sm text-gray-500 mb-1">Valor</p>
              <p className="text-4xl font-bold text-gray-900">
                {formatCurrency(payment.value)}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Vencimento: {formatDate(payment.dueDate)}
              </p>
            </div>

            {payment.description && (
              <div className="bg-gray-50 rounded-lg p-3 mt-4">
                <p className="text-sm text-gray-600">{payment.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Informacoes do Pagador */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Dados do Pagador</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Nome</span>
              <span className="text-sm font-medium">{payment.client.name}</span>
            </div>
            {payment.client.taxId && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">CPF/CNPJ</span>
                <span className="text-sm font-medium">{payment.client.taxId}</span>
              </div>
            )}
            {payment.client.email && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Email</span>
                <span className="text-sm font-medium">{payment.client.email}</span>
              </div>
            )}
            {payment.client.location && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Local</span>
                <span className="text-sm font-medium">{payment.client.location}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Opcoes de Pagamento */}
        {canPay && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Formas de Pagamento</CardTitle>
              <CardDescription>
                Escolha a forma de pagamento mais conveniente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="pix" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="pix" className="flex items-center gap-2">
                    <QrCode className="h-4 w-4" />
                    PIX
                  </TabsTrigger>
                  <TabsTrigger value="boleto" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Boleto
                  </TabsTrigger>
                  <TabsTrigger value="cartao" className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Cartão
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="pix" className="mt-4">
                  {pixData ? (
                    <div className="space-y-4">
                      {/* QR Code */}
                      {(pixData.qrCodeBase64 || pixData.qrCodeUrl) && (
                        <div className="flex justify-center">
                          <div className="bg-white p-4 rounded-lg border">
                            <img
                              src={
                                pixData.qrCodeBase64
                                  ? `data:image/png;base64,${pixData.qrCodeBase64}`
                                  : pixData.qrCodeUrl || ''
                              }
                              alt="QR Code PIX"
                              className="w-48 h-48"
                            />
                          </div>
                        </div>
                      )}

                      {/* Codigo Copia e Cola */}
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-center">
                          Ou copie o codigo PIX:
                        </p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={pixData.pixCode}
                            readOnly
                            className="flex-1 px-3 py-2 text-sm bg-gray-50 border rounded-md truncate"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCopyPix}
                            className="shrink-0"
                          >
                            {copied ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-sm text-gray-600 mb-4">
                        Gere o QR Code para pagar via PIX
                      </p>
                      <Button
                        onClick={handleGetPix}
                        disabled={loadingPix}
                        className="w-full"
                      >
                        {loadingPix ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <QrCode className="h-4 w-4 mr-2" />
                        )}
                        Gerar QR Code PIX
                      </Button>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="boleto" className="mt-4">
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-600 mb-4">
                      Visualize e imprima o boleto bancario
                    </p>
                    <Button
                      onClick={handleGetBoleto}
                      disabled={loadingBoleto}
                      variant="outline"
                      className="w-full"
                    >
                      {loadingBoleto ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <FileText className="h-4 w-4 mr-2" />
                      )}
                      Visualizar Boleto
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="cartao" className="mt-4">
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-600 mb-4">
                      Pague com cartão de crédito de forma segura
                    </p>
                    <Button
                      onClick={() => {
                        if (payment.invoiceUrl) {
                          window.open(payment.invoiceUrl, '_blank');
                        }
                      }}
                      disabled={!payment.invoiceUrl}
                      className="w-full"
                    >
                      <CreditCard className="h-4 w-4 mr-2" />
                      Pagar com Cartão
                    </Button>
                    <p className="text-xs text-gray-500 mt-3">
                      Você será redirecionado para um ambiente seguro de pagamento
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {/* Mensagem de Pago */}
        {isPaid && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-6 text-center">
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-600 mb-4" />
              <h2 className="text-xl font-semibold text-green-800 mb-2">
                Pagamento Confirmado
              </h2>
              {payment.paidAt && (
                <p className="text-green-600">
                  Pago em {formatDate(payment.paidAt)}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-gray-500 space-y-1">
          <p>
            Esta cobranca e de responsabilidade unica e exclusiva de{' '}
            <strong>{payment.company.name}</strong>
          </p>
          <p>
            Duvidas? Entre em contato:{' '}
            {payment.company.email && (
              <a href={`mailto:${payment.company.email}`} className="text-primary hover:underline">
                {payment.company.email}
              </a>
            )}
            {payment.company.phone && payment.company.email && ' | '}
            {payment.company.phone && (
              <a href={`tel:${payment.company.phone}`} className="text-primary hover:underline">
                {payment.company.phone}
              </a>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
