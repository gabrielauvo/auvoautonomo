'use client';

/**
 * Integrations Settings Page
 *
 * Configuracoes de integracoes com servicos externos:
 * - Asaas (gateway de pagamento)
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
  Loader2,
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
} from '@/hooks/use-integrations';
import { AsaasEnvironment } from '@/services/integrations.service';
import { GoogleBusinessIntegration } from '@/components/settings/google-business-integration';

export default function IntegrationsSettingsPage() {
  const { t } = useTranslations('integrations');
  const { data: asaasStatus, isLoading } = useAsaasStatus();
  const connectAsaas = useConnectAsaas();
  const disconnectAsaas = useDisconnectAsaas();

  // Form state
  const [apiKey, setApiKey] = useState('');
  const [environment, setEnvironment] = useState<AsaasEnvironment>('SANDBOX');
  const [showApiKey, setShowApiKey] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Disconnect confirmation
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  const handleConnect = async () => {
    setError(null);

    if (!apiKey.trim()) {
      setError(t('apiKeyRequired'));
      return;
    }

    if (apiKey.length < 20) {
      setError(t('apiKeyInvalid'));
      return;
    }

    try {
      await connectAsaas.mutateAsync({ apiKey, environment });
      setApiKey('');
    } catch (err) {
      // Error already handled by mutation
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectAsaas.mutateAsync();
      setShowDisconnectConfirm(false);
    } catch (err) {
      // Error already handled by mutation
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const isConnected = asaasStatus?.connected && asaasStatus?.isActive;

  return (
    <div className="space-y-6">
      {/* Asaas Integration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <svg
                  className="h-6 w-6 text-green-600"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                </svg>
              </div>
              <div>
                <CardTitle>Asaas</CardTitle>
                <p className="text-sm text-gray-500">
                  {t('asaasDescription')}
                </p>
              </div>
            </div>
            {isConnected ? (
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
          {isConnected ? (
            // Connected state
            <div className="space-y-4">
              <Alert variant="success">
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 mt-0.5" />
                  <div>
                    <p className="font-medium">{t('integrationActive')}</p>
                    <p className="text-sm">
                      {t('integrationActiveDescription')}
                    </p>
                  </div>
                </div>
              </Alert>

              <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">{t('environment')}</span>
                  <Badge
                    variant={asaasStatus.environment === 'PRODUCTION' ? 'success' : 'warning'}
                  >
                    {asaasStatus.environment === 'PRODUCTION' ? t('production') : t('sandbox')}
                  </Badge>
                </div>

                {asaasStatus.accountInfo && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">{t('name')}</span>
                      <span className="text-sm font-medium">
                        {asaasStatus.accountInfo.name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">{t('email')}</span>
                      <span className="text-sm font-medium">
                        {asaasStatus.accountInfo.email}
                      </span>
                    </div>
                    {asaasStatus.accountInfo.cpfCnpj && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">{t('cpfCnpj')}</span>
                        <span className="text-sm font-medium">
                          {asaasStatus.accountInfo.cpfCnpj}
                        </span>
                      </div>
                    )}
                  </>
                )}

                {asaasStatus.connectedAt && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">{t('connectedAt')}</span>
                    <span className="text-sm font-medium">
                      {new Date(asaasStatus.connectedAt).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button
                  variant="outline"
                  className="text-error border-error hover:bg-error/5"
                  onClick={() => setShowDisconnectConfirm(true)}
                  leftIcon={<Unplug className="h-4 w-4" />}
                >
                  {t('disconnect')}
                </Button>
              </div>
            </div>
          ) : (
            // Disconnected state - show connection form
            <div className="space-y-4">
              <Alert>
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5" />
                  <div>
                    <p className="font-medium">{t('configureIntegration')}</p>
                    <p className="text-sm">
                      {t('configureIntegrationDescription')}
                    </p>
                  </div>
                </div>
              </Alert>

              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">{t('howToGetApiKey')}</h4>
                <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                  <li>
                    {t('step1')}{' '}
                    <a
                      href="https://www.asaas.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline inline-flex items-center gap-1"
                    >
                      asaas.com
                      <ExternalLink className="h-3 w-3" />
                    </a>{' '}
                    {t('step1Continue')}
                  </li>
                  <li>{t('step2')}</li>
                  <li>{t('step3')}</li>
                  <li>{t('step4')}</li>
                </ol>
              </div>

              <FormField label={t('environment')}>
                <Select
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value as AsaasEnvironment)}
                >
                  <option value="SANDBOX">{t('sandbox')}</option>
                  <option value="PRODUCTION">{t('production')}</option>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  {t('sandboxDescription')}
                </p>
              </FormField>

              <FormField label={t('apiKey')}>
                <div className="relative">
                  <Input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="$aact_YourApiKeyHere..."
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {t('apiKeyStorageInfo')}
                </p>
              </FormField>

              {error && (
                <Alert variant="error">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                  </div>
                </Alert>
              )}

              <div className="flex justify-end">
                <Button
                  onClick={handleConnect}
                  loading={connectAsaas.isPending}
                  disabled={!apiKey.trim()}
                  leftIcon={<Plug className="h-4 w-4" />}
                >
                  {t('connect')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Google Business Integration */}
      <GoogleBusinessIntegration />

      {/* Disconnect confirmation modal */}
      {showDisconnectConfirm && (
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
                    <p>
                      {t('disconnectWarning')}
                    </p>
                  </div>
                </div>
              </Alert>

              <div className="flex justify-end gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setShowDisconnectConfirm(false)}
                >
                  {t('cancel')}
                </Button>
                <Button
                  variant="error"
                  onClick={handleDisconnect}
                  loading={disconnectAsaas.isPending}
                  leftIcon={<Unplug className="h-4 w-4" />}
                >
                  {t('disconnect')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
