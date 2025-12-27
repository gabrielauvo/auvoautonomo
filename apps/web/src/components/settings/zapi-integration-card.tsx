'use client';

/**
 * Z-API WhatsApp Integration Card
 *
 * Allows users to configure their own Z-API credentials for WhatsApp messaging.
 * Each user brings their own Z-API account (BYOC model).
 */

import { useState } from 'react';
import { useTranslations } from '@/i18n';
import {
  MessageCircle,
  Check,
  X,
  Eye,
  EyeOff,
  ExternalLink,
  AlertCircle,
  Unplug,
  AlertTriangle,
  QrCode,
  Send,
  RefreshCw,
  Smartphone,
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
} from '@/components/ui';
import {
  useZApiStatus,
  useZApiConnectionStatus,
  useZApiQrCode,
  useConnectZApi,
  useDisconnectZApi,
  useTestZApiMessage,
} from '@/hooks/use-integrations';

// WhatsApp Icon SVG
const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

export function ZApiIntegrationCard() {
  const { t } = useTranslations('integrations');

  // Hooks
  const { data: zapiStatus, isLoading: statusLoading } = useZApiStatus();
  const connectZApi = useConnectZApi();
  const disconnectZApi = useDisconnectZApi();
  const testMessage = useTestZApiMessage();

  // Form state
  const [instanceId, setInstanceId] = useState('');
  const [token, setToken] = useState('');
  const [clientToken, setClientToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [showClientToken, setShowClientToken] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // UI state
  const [showDisconnect, setShowDisconnect] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [showTestForm, setShowTestForm] = useState(false);

  // QR Code query (only when needed)
  const { data: qrCodeData, isLoading: qrLoading, refetch: refetchQr } = useZApiQrCode(showQrCode && zapiStatus?.configured);

  // Connection status polling (only when configured)
  const { data: connectionStatus } = useZApiConnectionStatus(zapiStatus?.configured ?? false);

  const handleConnect = async () => {
    setFormError(null);

    if (!instanceId.trim() || !token.trim() || !clientToken.trim()) {
      setFormError(t('zapiAllFieldsRequired') || 'Preencha todos os campos');
      return;
    }

    try {
      await connectZApi.mutateAsync({
        instanceId: instanceId.trim(),
        token: token.trim(),
        clientToken: clientToken.trim(),
        enabled: true,
      });
      setInstanceId('');
      setToken('');
      setClientToken('');
    } catch {
      setFormError(t('zapiConnectionFailed') || 'Falha ao conectar. Verifique suas credenciais.');
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectZApi.mutateAsync();
      setShowDisconnect(false);
    } catch {
      // Error handled by mutation
    }
  };

  const handleTestMessage = async () => {
    if (!testPhone.trim()) return;

    try {
      await testMessage.mutateAsync({ phone: testPhone.trim() });
      setTestPhone('');
      setShowTestForm(false);
    } catch {
      // Error handled by mutation
    }
  };

  if (statusLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  const isConfigured = zapiStatus?.configured;
  const isConnected = connectionStatus?.connected || zapiStatus?.connectionStatus === 'connected';

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <WhatsAppIcon className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  Z-API WhatsApp
                  <Badge variant="outline" className="text-xs font-normal">
                    BYOC
                  </Badge>
                </CardTitle>
                <p className="text-sm text-gray-500">
                  {t('zapiDescription') || 'Integre seu WhatsApp via Z-API para enviar mensagens automáticas'}
                </p>
              </div>
            </div>
            {isConfigured ? (
              isConnected ? (
                <Badge variant="success" className="flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  {t('connected')}
                </Badge>
              ) : (
                <Badge variant="warning" className="flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {t('zapiNeedsScan') || 'Escanear QR'}
                </Badge>
              )
            ) : (
              <Badge variant="default" className="flex items-center gap-1">
                <X className="h-3 w-3" />
                {t('disconnected')}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isConfigured ? (
            <div className="space-y-4">
              {isConnected ? (
                <>
                  <Alert variant="success">
                    <div className="flex items-start gap-2">
                      <Check className="h-4 w-4 mt-0.5" />
                      <div>
                        <p className="font-medium">{t('zapiConnected') || 'WhatsApp conectado'}</p>
                        <p className="text-sm">
                          {connectionStatus?.phoneNumber
                            ? `${t('zapiPhoneNumber') || 'Número'}: ${connectionStatus.phoneNumber}`
                            : t('zapiReadyToSend') || 'Pronto para enviar mensagens'}
                        </p>
                      </div>
                    </div>
                  </Alert>

                  <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Instance ID</span>
                      <span className="text-sm font-medium font-mono">{zapiStatus?.instanceId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">{t('status')}</span>
                      <Badge variant="success">
                        <Smartphone className="h-3 w-3 mr-1" />
                        {t('connected')}
                      </Badge>
                    </div>
                    {zapiStatus?.connectedAt && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">{t('zapiConnectedAt') || 'Conectado em'}</span>
                        <span className="text-sm">
                          {new Date(zapiStatus.connectedAt).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Test Message */}
                  {showTestForm ? (
                    <div className="p-4 border rounded-lg space-y-3">
                      <FormField label={t('zapiTestPhone') || 'Número para teste'}>
                        <Input
                          value={testPhone}
                          onChange={(e) => setTestPhone(e.target.value)}
                          placeholder="5511999999999"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          {t('zapiTestPhoneHint') || 'Formato: código do país + DDD + número'}
                        </p>
                      </FormField>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleTestMessage}
                          loading={testMessage.isPending}
                          disabled={!testPhone.trim()}
                          leftIcon={<Send className="h-4 w-4" />}
                        >
                          {t('zapiSendTest') || 'Enviar teste'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setShowTestForm(false)}
                        >
                          {t('cancel')}
                        </Button>
                      </div>
                      {testMessage.isSuccess && (
                        <Alert variant="success">
                          <Check className="h-4 w-4" />
                          {t('zapiTestSuccess') || 'Mensagem de teste enviada!'}
                        </Alert>
                      )}
                      {testMessage.isError && (
                        <Alert variant="error">
                          <AlertCircle className="h-4 w-4" />
                          {t('zapiTestFailed') || 'Falha ao enviar mensagem de teste'}
                        </Alert>
                      )}
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowTestForm(true)}
                      leftIcon={<Send className="h-4 w-4" />}
                    >
                      {t('zapiTestMessage') || 'Testar envio'}
                    </Button>
                  )}

                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      className="text-error border-error hover:bg-error/5"
                      onClick={() => setShowDisconnect(true)}
                      leftIcon={<Unplug className="h-4 w-4" />}
                    >
                      {t('disconnect')}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {/* Show QR Code for connection */}
                  <Alert variant="warning">
                    <div className="flex items-start gap-2">
                      <QrCode className="h-4 w-4 mt-0.5" />
                      <div>
                        <p className="font-medium">{t('zapiScanQrCode') || 'Escaneie o QR Code'}</p>
                        <p className="text-sm">
                          {t('zapiScanQrCodeDescription') || 'Abra o WhatsApp no celular e escaneie o código'}
                        </p>
                      </div>
                    </div>
                  </Alert>

                  {showQrCode ? (
                    <div className="flex flex-col items-center p-6 bg-white border rounded-lg">
                      {qrLoading ? (
                        <div className="w-64 h-64 flex items-center justify-center">
                          <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
                        </div>
                      ) : qrCodeData?.qrCode ? (
                        <>
                          <img
                            src={qrCodeData.qrCode}
                            alt="QR Code"
                            className="w-64 h-64"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => refetchQr()}
                            className="mt-2"
                            leftIcon={<RefreshCw className="h-4 w-4" />}
                          >
                            {t('zapiRefreshQr') || 'Atualizar QR Code'}
                          </Button>
                        </>
                      ) : (
                        <div className="w-64 h-64 flex items-center justify-center text-gray-400">
                          <p className="text-center">
                            {t('zapiQrCodeError') || 'Erro ao carregar QR Code'}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Button
                      onClick={() => setShowQrCode(true)}
                      leftIcon={<QrCode className="h-4 w-4" />}
                    >
                      {t('zapiShowQrCode') || 'Mostrar QR Code'}
                    </Button>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      className="text-error border-error hover:bg-error/5"
                      onClick={() => setShowDisconnect(true)}
                      leftIcon={<Unplug className="h-4 w-4" />}
                    >
                      {t('zapiRemoveCredentials') || 'Remover credenciais'}
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <Alert>
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5" />
                  <div>
                    <p className="font-medium">{t('zapiConfigureIntegration') || 'Configure sua integração Z-API'}</p>
                    <p className="text-sm">
                      {t('zapiByocDescription') || 'Você precisa ter uma conta Z-API. Cada usuário configura suas próprias credenciais.'}
                    </p>
                  </div>
                </div>
              </Alert>

              <div className="p-4 bg-green-50 rounded-lg">
                <h4 className="font-medium text-green-900 mb-2">
                  {t('zapiHowToGetCredentials') || 'Como obter suas credenciais'}
                </h4>
                <ol className="text-sm text-green-800 space-y-1 list-decimal list-inside">
                  <li>
                    {t('zapiStep1') || 'Acesse'}{' '}
                    <a
                      href="https://z-api.io"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline inline-flex items-center gap-1"
                    >
                      z-api.io
                      <ExternalLink className="h-3 w-3" />
                    </a>{' '}
                    {t('zapiStep1Continue') || 'e crie sua conta'}
                  </li>
                  <li>{t('zapiStep2') || 'Crie uma nova instância WhatsApp'}</li>
                  <li>{t('zapiStep3') || 'Copie o Instance ID, Token e Client Token'}</li>
                  <li>{t('zapiStep4') || 'Cole as credenciais abaixo'}</li>
                </ol>
              </div>

              <FormField label="Instance ID" required>
                <Input
                  value={instanceId}
                  onChange={(e) => setInstanceId(e.target.value)}
                  placeholder="3D8A9B2C..."
                />
              </FormField>

              <FormField label="Token" required>
                <div className="relative">
                  <Input
                    type={showToken ? 'text' : 'password'}
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Seu token Z-API"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowToken(!showToken)}
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </FormField>

              <FormField label="Client Token" required>
                <div className="relative">
                  <Input
                    type={showClientToken ? 'text' : 'password'}
                    value={clientToken}
                    onChange={(e) => setClientToken(e.target.value)}
                    placeholder="Seu client token Z-API"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowClientToken(!showClientToken)}
                  >
                    {showClientToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {t('zapiClientTokenHint') || 'Encontre em Configurações > Segurança no painel Z-API'}
                </p>
              </FormField>

              {formError && (
                <Alert variant="error">
                  <AlertCircle className="h-4 w-4" />
                  {formError}
                </Alert>
              )}

              {connectZApi.isError && (
                <Alert variant="error">
                  <AlertCircle className="h-4 w-4" />
                  {t('zapiConnectionFailed') || 'Falha ao conectar. Verifique suas credenciais.'}
                </Alert>
              )}

              <div className="flex justify-end">
                <Button
                  onClick={handleConnect}
                  loading={connectZApi.isPending}
                  disabled={!instanceId.trim() || !token.trim() || !clientToken.trim()}
                  leftIcon={<MessageCircle className="h-4 w-4" />}
                >
                  {t('zapiConnect') || 'Conectar Z-API'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Disconnect Modal */}
      {showDisconnect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-error">
                <Unplug className="h-5 w-5" />
                {t('zapiDisconnectTitle') || 'Desconectar Z-API'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="warning">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium">{t('warning')}</p>
                    <p>
                      {t('zapiDisconnectWarning') ||
                        'Ao desconectar, as mensagens automáticas via WhatsApp serão desativadas.'}
                    </p>
                  </div>
                </div>
              </Alert>
              <div className="flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setShowDisconnect(false)}>
                  {t('cancel')}
                </Button>
                <Button
                  variant="error"
                  onClick={handleDisconnect}
                  loading={disconnectZApi.isPending}
                  leftIcon={<Unplug className="h-4 w-4" />}
                >
                  {t('disconnect')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
