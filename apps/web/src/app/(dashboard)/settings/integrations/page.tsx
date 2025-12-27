'use client';

/**
 * Integrations Settings Page
 *
 * Configuracoes de integracoes com servicos externos:
 * - Asaas (gateway de pagamento - Brasil)
 * - Stripe (gateway de pagamento - Internacional)
 * - Mercado Pago (gateway de pagamento - LATAM)
 */

import { useState } from 'react';
import { useTranslations } from '@/i18n';
import {
  Plug,
  Check,
  X,
  Eye,
  EyeOff,
  ExternalLink,
  AlertCircle,
  Unplug,
  AlertTriangle,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  FormField,
  Alert,
  Skeleton,
  Badge,
  Select,
} from '@/components/ui';
import {
  useAsaasStatus,
  useConnectAsaas,
  useDisconnectAsaas,
  useStripeStatus,
  useConnectStripe,
  useDisconnectStripe,
  useMercadoPagoStatus,
  useConnectMercadoPago,
  useDisconnectMercadoPago,
} from '@/hooks/use-integrations';
import { ZApiIntegrationCard } from '@/components/settings/zapi-integration-card';
import {
  AsaasEnvironment,
  StripeEnvironment,
  MercadoPagoEnvironment,
} from '@/services/integrations.service';
import { useCompanySettings } from '@/context/company-settings-context';

// Countries where WhatsApp is NOT commonly used for business messaging
const NON_WHATSAPP_COUNTRIES = ['US', 'CA'];

// Stripe Icon SVG Component
const StripeIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
  </svg>
);

// Mercado Pago Icon SVG Component
const MercadoPagoIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 17.08c-.74.74-1.75 1.15-2.84 1.15H8.946c-1.09 0-2.1-.41-2.84-1.15-.74-.74-1.15-1.75-1.15-2.84V9.76c0-1.09.41-2.1 1.15-2.84.74-.74 1.75-1.15 2.84-1.15h6.108c1.09 0 2.1.41 2.84 1.15.74.74 1.15 1.75 1.15 2.84v4.48c0 1.09-.41 2.1-1.15 2.84zm-2.34-8.32h-7.11c-.55 0-1 .45-1 1v4.48c0 .55.45 1 1 1h7.11c.55 0 1-.45 1-1V9.76c0-.55-.45-1-1-1zm-5.11 4.24c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
  </svg>
);

export default function IntegrationsSettingsPage() {
  const { t } = useTranslations('integrations');
  const { settings: companySettings } = useCompanySettings();

  // Show WhatsApp by default, only hide for US/CA where it's not common for business
  const userCountry = companySettings?.country?.toUpperCase() || '';
  const showWhatsApp = !NON_WHATSAPP_COUNTRIES.includes(userCountry);

  // Asaas hooks
  const { data: asaasStatus, isLoading: asaasLoading } = useAsaasStatus();
  const connectAsaas = useConnectAsaas();
  const disconnectAsaas = useDisconnectAsaas();

  // Stripe hooks
  const { data: stripeStatus, isLoading: stripeLoading } = useStripeStatus();
  const connectStripe = useConnectStripe();
  const disconnectStripe = useDisconnectStripe();

  // Mercado Pago hooks
  const { data: mercadoPagoStatus, isLoading: mercadoPagoLoading } = useMercadoPagoStatus();
  const connectMercadoPago = useConnectMercadoPago();
  const disconnectMercadoPago = useDisconnectMercadoPago();

  // Asaas form state
  const [asaasApiKey, setAsaasApiKey] = useState('');
  const [asaasEnvironment, setAsaasEnvironment] = useState<AsaasEnvironment>('SANDBOX');
  const [showAsaasApiKey, setShowAsaasApiKey] = useState(false);
  const [asaasError, setAsaasError] = useState<string | null>(null);
  const [showAsaasDisconnect, setShowAsaasDisconnect] = useState(false);

  // Stripe form state
  const [stripeSecretKey, setStripeSecretKey] = useState('');
  const [stripePublishableKey, setStripePublishableKey] = useState('');
  const [stripeEnvironment, setStripeEnvironment] = useState<StripeEnvironment>('TEST');
  const [showStripeSecretKey, setShowStripeSecretKey] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [showStripeDisconnect, setShowStripeDisconnect] = useState(false);

  // Mercado Pago form state
  const [mpAccessToken, setMpAccessToken] = useState('');
  const [mpPublicKey, setMpPublicKey] = useState('');
  const [mpEnvironment, setMpEnvironment] = useState<MercadoPagoEnvironment>('SANDBOX');
  const [mpCountry, setMpCountry] = useState('AR');
  const [showMpAccessToken, setShowMpAccessToken] = useState(false);
  const [mpError, setMpError] = useState<string | null>(null);
  const [showMpDisconnect, setShowMpDisconnect] = useState(false);

  // Asaas handlers
  const handleAsaasConnect = async () => {
    setAsaasError(null);
    if (!asaasApiKey.trim()) {
      setAsaasError(t('apiKeyRequired'));
      return;
    }
    if (asaasApiKey.length < 20) {
      setAsaasError(t('apiKeyInvalid'));
      return;
    }
    try {
      await connectAsaas.mutateAsync({ apiKey: asaasApiKey, environment: asaasEnvironment });
      setAsaasApiKey('');
    } catch (err) {
      // Error handled by mutation
    }
  };

  const handleAsaasDisconnect = async () => {
    try {
      await disconnectAsaas.mutateAsync();
      setShowAsaasDisconnect(false);
    } catch (err) {
      // Error handled by mutation
    }
  };

  // Stripe handlers
  const handleStripeConnect = async () => {
    setStripeError(null);
    if (!stripeSecretKey.trim()) {
      setStripeError(t('secretKeyRequired'));
      return;
    }
    const isTestKey = stripeSecretKey.startsWith('sk_test_');
    const isLiveKey = stripeSecretKey.startsWith('sk_live_');
    if (!isTestKey && !isLiveKey) {
      setStripeError(t('stripeKeyInvalid'));
      return;
    }
    if (stripeEnvironment === 'TEST' && !isTestKey) {
      setStripeError(t('stripeTestKeyRequired'));
      return;
    }
    if (stripeEnvironment === 'LIVE' && !isLiveKey) {
      setStripeError(t('stripeLiveKeyRequired'));
      return;
    }
    try {
      await connectStripe.mutateAsync({
        secretKey: stripeSecretKey,
        publishableKey: stripePublishableKey || undefined,
        environment: stripeEnvironment,
      });
      setStripeSecretKey('');
      setStripePublishableKey('');
    } catch (err) {
      // Error handled by mutation
    }
  };

  const handleStripeDisconnect = async () => {
    try {
      await disconnectStripe.mutateAsync();
      setShowStripeDisconnect(false);
    } catch (err) {
      // Error handled by mutation
    }
  };

  // Mercado Pago handlers
  const handleMpConnect = async () => {
    setMpError(null);
    if (!mpAccessToken.trim()) {
      setMpError(t('accessTokenRequired'));
      return;
    }
    const isTestToken = mpAccessToken.startsWith('TEST-');
    const isProdToken = mpAccessToken.startsWith('APP_USR-');
    if (!isTestToken && !isProdToken) {
      setMpError(t('mpTokenInvalid'));
      return;
    }
    if (mpEnvironment === 'SANDBOX' && !isTestToken) {
      setMpError(t('mpTestTokenRequired'));
      return;
    }
    if (mpEnvironment === 'PRODUCTION' && !isProdToken) {
      setMpError(t('mpProdTokenRequired'));
      return;
    }
    try {
      await connectMercadoPago.mutateAsync({
        accessToken: mpAccessToken,
        publicKey: mpPublicKey || undefined,
        environment: mpEnvironment,
        country: mpCountry,
      });
      setMpAccessToken('');
      setMpPublicKey('');
    } catch (err) {
      // Error handled by mutation
    }
  };

  const handleMpDisconnect = async () => {
    try {
      await disconnectMercadoPago.mutateAsync();
      setShowMpDisconnect(false);
    } catch (err) {
      // Error handled by mutation
    }
  };

  const isLoading = asaasLoading || stripeLoading || mercadoPagoLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const isAsaasConnected = asaasStatus?.connected && asaasStatus?.isActive;
  const isStripeConnected = stripeStatus?.connected && stripeStatus?.isActive;
  const isMpConnected = mercadoPagoStatus?.connected && mercadoPagoStatus?.isActive;

  return (
    <div className="space-y-6">
      {/* Asaas Integration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <svg className="h-6 w-6 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                </svg>
              </div>
              <div>
                <CardTitle>Asaas</CardTitle>
                <p className="text-sm text-gray-500">{t('asaasDescription')}</p>
              </div>
            </div>
            {isAsaasConnected ? (
              <Badge variant="success" className="flex items-center gap-1">
                <Check className="h-3 w-3" />
                {t('connected')}
              </Badge>
            ) : (
              <Badge variant="default" className="flex items-center gap-1">
                <X className="h-3 w-3" />
                {t('disconnected')}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isAsaasConnected ? (
            <div className="space-y-4">
              <Alert variant="success">
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 mt-0.5" />
                  <div>
                    <p className="font-medium">{t('integrationActive')}</p>
                    <p className="text-sm">{t('integrationActiveDescription')}</p>
                  </div>
                </div>
              </Alert>
              <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">{t('environment')}</span>
                  <Badge variant={asaasStatus.environment === 'PRODUCTION' ? 'success' : 'warning'}>
                    {asaasStatus.environment === 'PRODUCTION' ? t('production') : t('sandbox')}
                  </Badge>
                </div>
                {asaasStatus.accountInfo && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">{t('name')}</span>
                      <span className="text-sm font-medium">{asaasStatus.accountInfo.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">{t('email')}</span>
                      <span className="text-sm font-medium">{asaasStatus.accountInfo.email}</span>
                    </div>
                  </>
                )}
              </div>
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  className="text-error border-error hover:bg-error/5"
                  onClick={() => setShowAsaasDisconnect(true)}
                  leftIcon={<Unplug className="h-4 w-4" />}
                >
                  {t('disconnect')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Alert>
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5" />
                  <div>
                    <p className="font-medium">{t('configureIntegration')}</p>
                    <p className="text-sm">{t('configureIntegrationDescription')}</p>
                  </div>
                </div>
              </Alert>
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">{t('howToGetApiKey')}</h4>
                <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                  <li>{t('step1')} <a href="https://www.asaas.com" target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-1">asaas.com<ExternalLink className="h-3 w-3" /></a> {t('step1Continue')}</li>
                  <li>{t('step2')}</li>
                  <li>{t('step3')}</li>
                  <li>{t('step4')}</li>
                </ol>
              </div>
              <FormField label={t('environment')}>
                <Select value={asaasEnvironment} onChange={(e) => setAsaasEnvironment(e.target.value as AsaasEnvironment)}>
                  <option value="SANDBOX">{t('sandbox')}</option>
                  <option value="PRODUCTION">{t('production')}</option>
                </Select>
              </FormField>
              <FormField label={t('apiKey')}>
                <div className="relative">
                  <Input
                    type={showAsaasApiKey ? 'text' : 'password'}
                    value={asaasApiKey}
                    onChange={(e) => setAsaasApiKey(e.target.value)}
                    placeholder="$aact_YourApiKeyHere..."
                    className="pr-10"
                  />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" onClick={() => setShowAsaasApiKey(!showAsaasApiKey)}>
                    {showAsaasApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </FormField>
              {asaasError && <Alert variant="error"><AlertCircle className="h-4 w-4" />{asaasError}</Alert>}
              <div className="flex justify-end">
                <Button onClick={handleAsaasConnect} loading={connectAsaas.isPending} disabled={!asaasApiKey.trim()} leftIcon={<Plug className="h-4 w-4" />}>{t('connect')}</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stripe Integration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <StripeIcon className="h-6 w-6 text-indigo-600" />
              </div>
              <div>
                <CardTitle>Stripe</CardTitle>
                <p className="text-sm text-gray-500">{t('stripeDescription')}</p>
              </div>
            </div>
            {isStripeConnected ? (
              <Badge variant="success" className="flex items-center gap-1">
                <Check className="h-3 w-3" />
                {t('connected')}
              </Badge>
            ) : (
              <Badge variant="default" className="flex items-center gap-1">
                <X className="h-3 w-3" />
                {t('disconnected')}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isStripeConnected ? (
            <div className="space-y-4">
              <Alert variant="success">
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 mt-0.5" />
                  <div>
                    <p className="font-medium">{t('integrationActive')}</p>
                    <p className="text-sm">{t('stripeActiveDescription')}</p>
                  </div>
                </div>
              </Alert>
              <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">{t('environment')}</span>
                  <Badge variant={stripeStatus.environment === 'LIVE' ? 'success' : 'warning'}>
                    {stripeStatus.environment === 'LIVE' ? t('live') : t('test')}
                  </Badge>
                </div>
                {stripeStatus.accountInfo && (
                  <>
                    {stripeStatus.accountInfo.name && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">{t('name')}</span>
                        <span className="text-sm font-medium">{stripeStatus.accountInfo.name}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">{t('email')}</span>
                      <span className="text-sm font-medium">{stripeStatus.accountInfo.email}</span>
                    </div>
                    {stripeStatus.accountInfo.country && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">{t('country')}</span>
                        <span className="text-sm font-medium">{stripeStatus.accountInfo.country}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  className="text-error border-error hover:bg-error/5"
                  onClick={() => setShowStripeDisconnect(true)}
                  leftIcon={<Unplug className="h-4 w-4" />}
                >
                  {t('disconnect')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Alert>
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5" />
                  <div>
                    <p className="font-medium">{t('configureStripeIntegration')}</p>
                    <p className="text-sm">{t('configureStripeDescription')}</p>
                  </div>
                </div>
              </Alert>
              <div className="p-4 bg-indigo-50 rounded-lg">
                <h4 className="font-medium text-indigo-900 mb-2">{t('howToGetStripeKey')}</h4>
                <ol className="text-sm text-indigo-800 space-y-1 list-decimal list-inside">
                  <li>{t('stripeStep1')} <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-1">dashboard.stripe.com<ExternalLink className="h-3 w-3" /></a></li>
                  <li>{t('stripeStep2')}</li>
                  <li>{t('stripeStep3')}</li>
                  <li>{t('stripeStep4')}</li>
                </ol>
              </div>
              <FormField label={t('environment')}>
                <Select value={stripeEnvironment} onChange={(e) => setStripeEnvironment(e.target.value as StripeEnvironment)}>
                  <option value="TEST">{t('test')}</option>
                  <option value="LIVE">{t('live')}</option>
                </Select>
              </FormField>
              <FormField label={t('secretKey')} required>
                <div className="relative">
                  <Input
                    type={showStripeSecretKey ? 'text' : 'password'}
                    value={stripeSecretKey}
                    onChange={(e) => setStripeSecretKey(e.target.value)}
                    placeholder="sk_test_xxx ou sk_live_xxx"
                    className="pr-10"
                  />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" onClick={() => setShowStripeSecretKey(!showStripeSecretKey)}>
                    {showStripeSecretKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </FormField>
              <FormField label={t('publishableKey')}>
                <Input
                  value={stripePublishableKey}
                  onChange={(e) => setStripePublishableKey(e.target.value)}
                  placeholder="pk_test_xxx ou pk_live_xxx"
                />
                <p className="text-xs text-gray-500 mt-1">{t('publishableKeyOptional')}</p>
              </FormField>
              {stripeError && <Alert variant="error"><AlertCircle className="h-4 w-4" />{stripeError}</Alert>}
              <div className="flex justify-end">
                <Button onClick={handleStripeConnect} loading={connectStripe.isPending} disabled={!stripeSecretKey.trim()} leftIcon={<Plug className="h-4 w-4" />}>{t('connect')}</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mercado Pago Integration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-sky-100 rounded-lg">
                <MercadoPagoIcon className="h-6 w-6 text-sky-500" />
              </div>
              <div>
                <CardTitle>Mercado Pago</CardTitle>
                <p className="text-sm text-gray-500">{t('mercadoPagoDescription')}</p>
              </div>
            </div>
            {isMpConnected ? (
              <Badge variant="success" className="flex items-center gap-1">
                <Check className="h-3 w-3" />
                {t('connected')}
              </Badge>
            ) : (
              <Badge variant="default" className="flex items-center gap-1">
                <X className="h-3 w-3" />
                {t('disconnected')}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isMpConnected ? (
            <div className="space-y-4">
              <Alert variant="success">
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 mt-0.5" />
                  <div>
                    <p className="font-medium">{t('integrationActive')}</p>
                    <p className="text-sm">{t('mpActiveDescription')}</p>
                  </div>
                </div>
              </Alert>
              <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">{t('environment')}</span>
                  <Badge variant={mercadoPagoStatus.environment === 'PRODUCTION' ? 'success' : 'warning'}>
                    {mercadoPagoStatus.environment === 'PRODUCTION' ? t('production') : t('sandbox')}
                  </Badge>
                </div>
                {mercadoPagoStatus.country && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">{t('country')}</span>
                    <span className="text-sm font-medium">{mercadoPagoStatus.country}</span>
                  </div>
                )}
                {mercadoPagoStatus.accountInfo && (
                  <>
                    {mercadoPagoStatus.accountInfo.name && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">{t('name')}</span>
                        <span className="text-sm font-medium">{mercadoPagoStatus.accountInfo.name}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">{t('email')}</span>
                      <span className="text-sm font-medium">{mercadoPagoStatus.accountInfo.email}</span>
                    </div>
                  </>
                )}
              </div>
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  className="text-error border-error hover:bg-error/5"
                  onClick={() => setShowMpDisconnect(true)}
                  leftIcon={<Unplug className="h-4 w-4" />}
                >
                  {t('disconnect')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Alert>
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5" />
                  <div>
                    <p className="font-medium">{t('configureMpIntegration')}</p>
                    <p className="text-sm">{t('configureMpDescription')}</p>
                  </div>
                </div>
              </Alert>
              <div className="p-4 bg-sky-50 rounded-lg">
                <h4 className="font-medium text-sky-900 mb-2">{t('howToGetMpToken')}</h4>
                <ol className="text-sm text-sky-800 space-y-1 list-decimal list-inside">
                  <li>{t('mpStep1')} <a href="https://www.mercadopago.com/developers/panel" target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-1">developers.mercadopago.com<ExternalLink className="h-3 w-3" /></a></li>
                  <li>{t('mpStep2')}</li>
                  <li>{t('mpStep3')}</li>
                  <li>{t('mpStep4')}</li>
                </ol>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField label={t('environment')}>
                  <Select value={mpEnvironment} onChange={(e) => setMpEnvironment(e.target.value as MercadoPagoEnvironment)}>
                    <option value="SANDBOX">{t('sandbox')}</option>
                    <option value="PRODUCTION">{t('production')}</option>
                  </Select>
                </FormField>
                <FormField label={t('country')}>
                  <Select value={mpCountry} onChange={(e) => setMpCountry(e.target.value)}>
                    <option value="AR">Argentina</option>
                    <option value="BR">Brasil</option>
                    <option value="CL">Chile</option>
                    <option value="CO">Colombia</option>
                    <option value="MX">Mexico</option>
                    <option value="PE">Peru</option>
                    <option value="UY">Uruguay</option>
                  </Select>
                </FormField>
              </div>
              <FormField label={t('accessToken')} required>
                <div className="relative">
                  <Input
                    type={showMpAccessToken ? 'text' : 'password'}
                    value={mpAccessToken}
                    onChange={(e) => setMpAccessToken(e.target.value)}
                    placeholder="TEST-xxx ou APP_USR-xxx"
                    className="pr-10"
                  />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" onClick={() => setShowMpAccessToken(!showMpAccessToken)}>
                    {showMpAccessToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </FormField>
              <FormField label={t('publicKey')}>
                <Input
                  value={mpPublicKey}
                  onChange={(e) => setMpPublicKey(e.target.value)}
                  placeholder="TEST-xxx ou APP_USR-xxx"
                />
                <p className="text-xs text-gray-500 mt-1">{t('publicKeyOptional')}</p>
              </FormField>
              {mpError && <Alert variant="error"><AlertCircle className="h-4 w-4" />{mpError}</Alert>}
              <div className="flex justify-end">
                <Button onClick={handleMpConnect} loading={connectMercadoPago.isPending} disabled={!mpAccessToken.trim()} leftIcon={<Plug className="h-4 w-4" />}>{t('connect')}</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Z-API WhatsApp Integration - Hidden for English locales */}
      {showWhatsApp && <ZApiIntegrationCard />}

      {/* Asaas Disconnect Modal */}
      {showAsaasDisconnect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-error">
                <Unplug className="h-5 w-5" />
                {t('disconnectAsaas')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="warning">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium">{t('warning')}</p>
                    <p>{t('disconnectWarning')}</p>
                  </div>
                </div>
              </Alert>
              <div className="flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setShowAsaasDisconnect(false)}>{t('cancel')}</Button>
                <Button variant="error" onClick={handleAsaasDisconnect} loading={disconnectAsaas.isPending} leftIcon={<Unplug className="h-4 w-4" />}>{t('disconnect')}</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Stripe Disconnect Modal */}
      {showStripeDisconnect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-error">
                <Unplug className="h-5 w-5" />
                {t('disconnectStripe')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="warning">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium">{t('warning')}</p>
                    <p>{t('stripeDisconnectWarning')}</p>
                  </div>
                </div>
              </Alert>
              <div className="flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setShowStripeDisconnect(false)}>{t('cancel')}</Button>
                <Button variant="error" onClick={handleStripeDisconnect} loading={disconnectStripe.isPending} leftIcon={<Unplug className="h-4 w-4" />}>{t('disconnect')}</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Mercado Pago Disconnect Modal */}
      {showMpDisconnect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-error">
                <Unplug className="h-5 w-5" />
                {t('disconnectMercadoPago')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="warning">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium">{t('warning')}</p>
                    <p>{t('mpDisconnectWarning')}</p>
                  </div>
                </div>
              </Alert>
              <div className="flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setShowMpDisconnect(false)}>{t('cancel')}</Button>
                <Button variant="error" onClick={handleMpDisconnect} loading={disconnectMercadoPago.isPending} leftIcon={<Unplug className="h-4 w-4" />}>{t('disconnect')}</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
