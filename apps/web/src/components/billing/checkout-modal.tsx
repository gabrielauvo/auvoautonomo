'use client';

/**
 * Checkout Modal Component
 *
 * Modal de checkout inline para pagamento via PIX ou Cartão de Crédito
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  CreditCard,
  QrCode,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  X,
  Clock,
  ExternalLink,
  Globe,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Alert,
} from '@/components/ui';
import {
  checkoutPix,
  checkPixStatus,
  checkoutCreditCard,
  createStripeCheckout,
  getGatewayInfo,
  isInternationalCountry,
  type CheckoutPixDto,
  type CheckoutCreditCardDto,
  type PixCheckoutResult,
  type BillingPeriod,
  type GatewayInfo,
  PRO_PLAN_PRICING,
} from '@/services/billing.service';
import { cn } from '@/lib/utils';
import { QRCodeSVG } from 'qrcode.react';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  planName: string;
  planPrice: number;
  billingPeriod?: BillingPeriod;
  /** País do usuário (ISO 3166-1 alpha-2). Se internacional, usa Stripe Checkout */
  country?: string;
}

type PaymentMethod = 'pix' | 'credit-card';

export function CheckoutModal({
  isOpen,
  onClose,
  onSuccess,
  planName,
  planPrice,
  billingPeriod = 'MONTHLY',
  country = 'BR',
}: CheckoutModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Gateway info for international countries
  const [gatewayInfo, setGatewayInfo] = useState<GatewayInfo | null>(null);
  const isInternational = isInternationalCountry(country);

  // PIX state
  const [pixResult, setPixResult] = useState<PixCheckoutResult | null>(null);
  const [pixPolling, setPixPolling] = useState(false);

  // Form state - PIX
  const [pixForm, setPixForm] = useState<Omit<CheckoutPixDto, 'billingPeriod'>>({
    cpfCnpj: '',
    phone: '',
    name: '',
  });

  // Form state - Credit Card (dados não sensíveis)
  const [cardForm, setCardForm] = useState({
    cpfCnpj: '',
    phone: '',
    name: '',
    email: '',
    postalCode: '',
    addressNumber: '',
  });

  // Refs para dados sensíveis do cartão (não armazenar em state)
  const cardHolderNameRef = useRef('');
  const cardNumberRef = useRef('');
  const expiryMonthRef = useRef('');
  const expiryYearRef = useRef('');
  const ccvRef = useRef('');

  // Ref para controlar se componente está montado
  const isMountedRef = useRef(true);

  // Limpa flag de montado ao desmontar
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Fetch gateway info for international countries
  useEffect(() => {
    if (isInternational && isOpen) {
      getGatewayInfo(country)
        .then((info) => {
          if (isMountedRef.current) {
            setGatewayInfo(info);
          }
        })
        .catch((err) => {
          console.error('Error fetching gateway info:', err);
        });
    }
  }, [isInternational, country, isOpen]);

  // Poll for PIX payment status
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (pixPolling && pixResult?.paymentId) {
      interval = setInterval(async () => {
        try {
          const status = await checkPixStatus();
          // Verifica se ainda está montado antes de atualizar state
          if (isMountedRef.current && status.paid) {
            setPixPolling(false);
            onSuccess();
          }
        } catch {
          // Ignore errors while polling
        }
      }, 5000); // Check every 5 seconds
    }

    return () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };
  }, [pixPolling, pixResult, onSuccess]);

  const handlePixCheckout = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await checkoutPix({ ...pixForm, billingPeriod });

      if (result.success) {
        setPixResult(result);
        setPixPolling(true);
      } else {
        setError(result.errorMessage || result.message || 'Erro ao processar pagamento');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar pagamento');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreditCardCheckout = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Monta payload com dados do form e refs
      const payload: CheckoutCreditCardDto = {
        ...cardForm,
        cardHolderName: cardHolderNameRef.current,
        cardNumber: cardNumberRef.current.replace(/\s/g, ''),
        expiryMonth: expiryMonthRef.current,
        expiryYear: expiryYearRef.current,
        ccv: ccvRef.current,
        billingPeriod,
      };

      const result = await checkoutCreditCard(payload);

      if (result.success) {
        // Limpa dados sensíveis dos refs após sucesso
        cardHolderNameRef.current = '';
        cardNumberRef.current = '';
        expiryMonthRef.current = '';
        expiryYearRef.current = '';
        ccvRef.current = '';
        onSuccess();
      } else {
        setError(result.errorMessage || result.message || 'Erro ao processar pagamento');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar pagamento');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Stripe Checkout para clientes internacionais
   * Redireciona para página de pagamento hospedada pelo Stripe
   */
  const handleStripeCheckout = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await createStripeCheckout({
        billingPeriod,
        country,
        successUrl: `${window.location.origin}/settings/plan?success=true`,
        cancelUrl: `${window.location.origin}/settings/plan?canceled=true`,
      });

      if (result.success && result.checkoutUrl) {
        // Redireciona para o Stripe Checkout
        window.location.href = result.checkoutUrl;
      } else {
        setError(result.errorMessage || 'Error creating checkout session');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error processing payment');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, []);

  const formatCpfCnpj = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      // CPF: 000.000.000-00
      return numbers
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})/, '$1-$2')
        .replace(/(-\d{2})\d+?$/, '$1');
    } else {
      // CNPJ: 00.000.000/0000-00
      return numbers
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1/$2')
        .replace(/(\d{4})(\d)/, '$1-$2')
        .replace(/(-\d{2})\d+?$/, '$1');
    }
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 10) {
      return numbers
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{4})(\d)/, '$1-$2');
    } else {
      return numbers
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2')
        .replace(/(-\d{4})\d+?$/, '$1');
    }
  };

  const formatCardNumber = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
  };

  const formatCep = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/(\d{5})(\d)/, '$1-$2').replace(/(-\d{3})\d+?$/, '$1');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
      <Card className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Upgrade para {planName}</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Preço - Brasil */}
          {!isInternational && (
            <div className="text-center py-4 bg-primary-50 rounded-lg">
              <p className="text-sm text-gray-600">
                {billingPeriod === 'YEARLY' ? 'Plano Anual' : 'Plano Mensal'}
              </p>
              <p className="text-3xl font-bold text-primary">
                R$ {planPrice.toFixed(2).replace('.', ',')}
              </p>
              {billingPeriod === 'YEARLY' && (
                <p className="text-xs text-gray-500 mt-1">
                  (equivale a R$ {PRO_PLAN_PRICING.YEARLY.toFixed(2).replace('.', ',')}/mês)
                </p>
              )}
            </div>
          )}

          {/* Preço - Internacional */}
          {isInternational && gatewayInfo && (
            <div className="text-center py-4 bg-primary-50 rounded-lg">
              <div className="flex items-center justify-center gap-2 text-sm text-gray-600 mb-1">
                <Globe className="h-4 w-4" />
                <span>{country.toUpperCase()} - {billingPeriod === 'YEARLY' ? 'Annual Plan' : 'Monthly Plan'}</span>
              </div>
              <p className="text-3xl font-bold text-primary">
                {gatewayInfo.pricing.monthlyFormatted || `${gatewayInfo.currencySymbol}${billingPeriod === 'YEARLY' ? gatewayInfo.pricing.yearly.toFixed(2) : gatewayInfo.pricing.monthly.toFixed(2)}`}
              </p>
              {billingPeriod === 'YEARLY' && (
                <p className="text-xs text-gray-500 mt-1">
                  (per month, billed annually)
                </p>
              )}
            </div>
          )}

          {/* Loading gateway info */}
          {isInternational && !gatewayInfo && (
            <div className="text-center py-4 bg-gray-50 rounded-lg">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
              <p className="text-sm text-gray-500 mt-2">Loading payment options...</p>
            </div>
          )}

          {/* Seleção de método - Brasil */}
          {!isInternational && !pixResult && (
            <div className="flex gap-2">
              <Button
                variant={paymentMethod === 'pix' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setPaymentMethod('pix')}
              >
                <QrCode className="h-4 w-4 mr-2" />
                PIX
              </Button>
              <Button
                variant={paymentMethod === 'credit-card' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setPaymentMethod('credit-card')}
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Cartão
              </Button>
            </div>
          )}

          {/* Stripe Checkout - Internacional */}
          {isInternational && gatewayInfo && (
            <div className="space-y-4">
              <div className="text-center text-sm text-gray-600">
                <p>You will be redirected to Stripe for secure payment.</p>
                {gatewayInfo.paymentMethods && (
                  <p className="mt-2 text-xs text-gray-500">
                    Available methods: {gatewayInfo.paymentMethods.card ? 'Card' : ''}
                    {gatewayInfo.paymentMethods.oxxo ? ', OXXO' : ''}
                    {gatewayInfo.paymentMethods.sepaDebit ? ', SEPA Direct Debit' : ''}
                    {gatewayInfo.paymentMethods.ideal ? ', iDEAL' : ''}
                    {gatewayInfo.paymentMethods.bancontact ? ', Bancontact' : ''}
                  </p>
                )}
              </div>

              <Button
                className="w-full"
                onClick={handleStripeCheckout}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Redirecting...
                  </>
                ) : (
                  <>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Continue to Payment
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Erro */}
          {error && (
            <Alert variant="error">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            </Alert>
          )}

          {/* PIX QR Code */}
          {pixResult?.pixQrCode && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="p-4 bg-white rounded-lg border">
                  <QRCodeSVG value={pixResult.pixQrCode} size={200} />
                </div>
              </div>

              <div className="text-center text-sm text-gray-600">
                <div className="flex items-center justify-center gap-2 text-warning">
                  <Clock className="h-4 w-4" />
                  Aguardando pagamento...
                </div>
                {pixResult.pixExpiresAt && (
                  <p className="mt-1">
                    Expira em: {new Date(pixResult.pixExpiresAt).toLocaleTimeString('pt-BR')}
                  </p>
                )}
              </div>

              {pixResult.pixCopyPaste && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Código PIX Copia e Cola:</p>
                  <div className="flex gap-2">
                    <Input
                      value={pixResult.pixCopyPaste}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      onClick={() => copyToClipboard(pixResult.pixCopyPaste!)}
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}

              <Button variant="ghost" className="w-full" onClick={() => setPixResult(null)}>
                Voltar
              </Button>
            </div>
          )}

          {/* Formulário PIX - Brasil apenas */}
          {!isInternational && paymentMethod === 'pix' && !pixResult && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">CPF/CNPJ *</label>
                <Input
                  placeholder="000.000.000-00"
                  value={pixForm.cpfCnpj}
                  onChange={(e) =>
                    setPixForm({ ...pixForm, cpfCnpj: formatCpfCnpj(e.target.value) })
                  }
                  maxLength={18}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Nome (opcional)</label>
                <Input
                  placeholder="Seu nome"
                  value={pixForm.name}
                  onChange={(e) => setPixForm({ ...pixForm, name: e.target.value })}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Telefone (opcional)</label>
                <Input
                  placeholder="(00) 00000-0000"
                  value={pixForm.phone}
                  onChange={(e) =>
                    setPixForm({ ...pixForm, phone: formatPhone(e.target.value) })
                  }
                  maxLength={15}
                />
              </div>

              <Button
                className="w-full"
                onClick={handlePixCheckout}
                disabled={isLoading || !pixForm.cpfCnpj}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Gerando QR Code...
                  </>
                ) : (
                  <>
                    <QrCode className="h-4 w-4 mr-2" />
                    Gerar QR Code PIX
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Formulário Cartão de Crédito - Brasil apenas */}
          {!isInternational && paymentMethod === 'credit-card' && !pixResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-sm font-medium">Nome completo *</label>
                  <Input
                    placeholder="Como no cartão"
                    value={cardForm.name}
                    onChange={(e) => setCardForm({ ...cardForm, name: e.target.value })}
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-sm font-medium">Email *</label>
                  <Input
                    type="email"
                    placeholder="seu@email.com"
                    value={cardForm.email}
                    onChange={(e) => setCardForm({ ...cardForm, email: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">CPF/CNPJ *</label>
                  <Input
                    placeholder="000.000.000-00"
                    value={cardForm.cpfCnpj}
                    onChange={(e) =>
                      setCardForm({ ...cardForm, cpfCnpj: formatCpfCnpj(e.target.value) })
                    }
                    maxLength={18}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Telefone *</label>
                  <Input
                    placeholder="(00) 00000-0000"
                    value={cardForm.phone}
                    onChange={(e) =>
                      setCardForm({ ...cardForm, phone: formatPhone(e.target.value) })
                    }
                    maxLength={15}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">CEP *</label>
                  <Input
                    placeholder="00000-000"
                    value={cardForm.postalCode}
                    onChange={(e) =>
                      setCardForm({ ...cardForm, postalCode: formatCep(e.target.value) })
                    }
                    maxLength={9}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Número *</label>
                  <Input
                    placeholder="123"
                    value={cardForm.addressNumber}
                    onChange={(e) =>
                      setCardForm({ ...cardForm, addressNumber: e.target.value })
                    }
                  />
                </div>
              </div>

              <hr className="my-4" />

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Nome no cartão *</label>
                  <Input
                    placeholder="NOME COMO NO CARTÃO"
                    defaultValue=""
                    onChange={(e) => {
                      cardHolderNameRef.current = e.target.value.toUpperCase();
                    }}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Número do cartão *</label>
                  <Input
                    placeholder="0000 0000 0000 0000"
                    defaultValue=""
                    onChange={(e) => {
                      const formatted = formatCardNumber(e.target.value);
                      e.target.value = formatted;
                      cardNumberRef.current = formatted;
                    }}
                    maxLength={19}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium">Mês *</label>
                    <Input
                      placeholder="MM"
                      defaultValue=""
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 2);
                        e.target.value = val;
                        expiryMonthRef.current = val;
                      }}
                      maxLength={2}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Ano *</label>
                    <Input
                      placeholder="AA"
                      defaultValue=""
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 2);
                        e.target.value = val;
                        expiryYearRef.current = val;
                      }}
                      maxLength={2}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">CVV *</label>
                    <Input
                      placeholder="000"
                      type="password"
                      defaultValue=""
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                        e.target.value = val;
                        ccvRef.current = val;
                      }}
                      maxLength={4}
                    />
                  </div>
                </div>
              </div>

              <Button
                className="w-full"
                onClick={handleCreditCardCheckout}
                disabled={
                  isLoading ||
                  !cardForm.name ||
                  !cardForm.email ||
                  !cardForm.cpfCnpj ||
                  !cardForm.phone ||
                  !cardForm.postalCode ||
                  !cardForm.addressNumber
                }
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Pagar R$ {planPrice.toFixed(2).replace('.', ',')}
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Segurança */}
          <p className="text-xs text-center text-gray-500">
            {isInternational
              ? 'Secure payment processed by Stripe. Your data is protected.'
              : 'Pagamento processado com segurança via Asaas. Seus dados estão protegidos.'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
