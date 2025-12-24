'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from '@/i18n';
import {
  Plug,
  Check,
  X,
  ExternalLink,
  AlertCircle,
  Unplug,
  AlertTriangle,
  MapPin,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Alert,
  Skeleton,
  Badge,
  Select,
} from '@/components/ui';
import {
  useGoogleBusinessConfigured,
  useGoogleBusinessStatus,
  useGoogleBusinessLocations,
  useConnectGoogleBusiness,
  useSelectGoogleLocation,
  useDisconnectGoogleBusiness,
} from '@/hooks/use-integrations';
import Link from 'next/link';

export function GoogleBusinessIntegration() {
  const { t } = useTranslations('integrations');
  const searchParams = useSearchParams();

  // Queries
  const { data: isConfigured, isLoading: isLoadingConfigured } = useGoogleBusinessConfigured();
  const { data: status, isLoading: isLoadingStatus, refetch: refetchStatus } = useGoogleBusinessStatus();

  // Mutations
  const connectGoogle = useConnectGoogleBusiness();
  const selectLocation = useSelectGoogleLocation();
  const disconnectGoogle = useDisconnectGoogleBusiness();

  // State
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [oauthMessage, setOauthMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Check if we need to load locations (after OAuth, status is PENDING)
  const shouldLoadLocations = status?.status === 'PENDING';
  const { data: locations, isLoading: isLoadingLocations } = useGoogleBusinessLocations(shouldLoadLocations);

  // Handle OAuth callback messages from URL
  useEffect(() => {
    const googleParam = searchParams.get('google');
    const messageParam = searchParams.get('message');

    if (googleParam === 'success') {
      setOauthMessage({ type: 'success', text: t('googleOAuthSuccess') });
      refetchStatus();
      // Clear URL params after showing message
      const url = new URL(window.location.href);
      url.searchParams.delete('google');
      url.searchParams.delete('message');
      window.history.replaceState({}, '', url.toString());
    } else if (googleParam === 'error') {
      setOauthMessage({ type: 'error', text: messageParam || t('googleOAuthError') });
      const url = new URL(window.location.href);
      url.searchParams.delete('google');
      url.searchParams.delete('message');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams, refetchStatus, t]);

  // Auto-dismiss OAuth message
  useEffect(() => {
    if (oauthMessage) {
      const timer = setTimeout(() => setOauthMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [oauthMessage]);

  const handleConnect = async () => {
    try {
      const { url } = await connectGoogle.mutateAsync(window.location.href);
      window.location.href = url;
    } catch (err) {
      // Error handled by mutation
    }
  };

  const handleSelectLocation = async () => {
    if (!selectedLocationId) return;
    try {
      await selectLocation.mutateAsync(selectedLocationId);
    } catch (err) {
      // Error handled by mutation
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectGoogle.mutateAsync();
      setShowDisconnectConfirm(false);
    } catch (err) {
      // Error handled by mutation
    }
  };

  if (isLoadingConfigured || isLoadingStatus) {
    return <Skeleton className="h-64 w-full" />;
  }

  const isConnected = status?.status === 'CONNECTED';
  const isPending = status?.status === 'PENDING';
  const hasError = status?.status === 'ERROR' || status?.status === 'REVOKED';

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg
                  className="h-6 w-6 text-blue-600"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              </div>
              <div>
                <CardTitle>Google Meu Negócio</CardTitle>
                <p className="text-sm text-gray-500">
                  {t('googleBusinessDescription')}
                </p>
              </div>
            </div>
            {isConnected ? (
              <Badge variant="success" className="flex items-center gap-1">
                <Check className="h-3 w-3" />
                {t('connected')}
              </Badge>
            ) : isPending ? (
              <Badge variant="warning" className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {t('selectLocation')}
              </Badge>
            ) : hasError ? (
              <Badge variant="error" className="flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {t('error')}
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
          {/* OAuth callback message */}
          {oauthMessage && (
            <Alert variant={oauthMessage.type === 'success' ? 'success' : 'error'} className="mb-4">
              <div className="flex items-center gap-2">
                {oauthMessage.type === 'success' ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                {oauthMessage.text}
              </div>
            </Alert>
          )}

          {isConnected ? (
            // Connected state
            <div className="space-y-4">
              <Alert variant="success">
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 mt-0.5" />
                  <div>
                    <p className="font-medium">{t('googleConnected')}</p>
                    <p className="text-sm">{t('googleConnectedDescription')}</p>
                  </div>
                </div>
              </Alert>

              <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">{t('location')}</span>
                  <span className="text-sm font-medium">
                    {status.googleLocationName || '-'}
                  </span>
                </div>

                {status.lastSyncAt && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">{t('lastSync')}</span>
                    <span className="text-sm font-medium">
                      {new Date(status.lastSyncAt).toLocaleString('pt-BR')}
                    </span>
                  </div>
                )}

                {status.lastSyncError && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">{t('lastError')}</span>
                    <span className="text-sm text-error">
                      {status.lastSyncError}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <Link href="/growth">
                  <Button variant="outline" leftIcon={<TrendingUp className="h-4 w-4" />}>
                    {t('viewDashboard')}
                  </Button>
                </Link>
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
          ) : isPending ? (
            // Pending state - select location
            <div className="space-y-4">
              <Alert variant="info">
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5" />
                  <div>
                    <p className="font-medium">{t('selectLocationTitle')}</p>
                    <p className="text-sm">{t('selectLocationDescription')}</p>
                  </div>
                </div>
              </Alert>

              {isLoadingLocations ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : locations && locations.length > 0 ? (
                <>
                  <Select
                    value={selectedLocationId}
                    onChange={(e) => setSelectedLocationId(e.target.value)}
                  >
                    <option value="">{t('chooseLocation')}</option>
                    {locations.map((loc) => (
                      <option key={loc.locationId} value={loc.locationId}>
                        {loc.name} {loc.address ? `- ${loc.address}` : ''}
                      </option>
                    ))}
                  </Select>

                  <div className="flex justify-end gap-3">
                    <Button
                      variant="ghost"
                      onClick={() => disconnectGoogle.mutate()}
                      disabled={disconnectGoogle.isPending}
                    >
                      {t('cancel')}
                    </Button>
                    <Button
                      onClick={handleSelectLocation}
                      loading={selectLocation.isPending}
                      disabled={!selectedLocationId}
                      leftIcon={<Check className="h-4 w-4" />}
                    >
                      {t('confirm')}
                    </Button>
                  </div>
                </>
              ) : (
                <Alert variant="warning">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5" />
                    <div>
                      <p className="font-medium">{t('noLocationsFound')}</p>
                      <p className="text-sm">{t('noLocationsFoundDescription')}</p>
                    </div>
                  </div>
                </Alert>
              )}
            </div>
          ) : hasError ? (
            // Error state
            <div className="space-y-4">
              <Alert variant="error">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5" />
                  <div>
                    <p className="font-medium">{t('googleError')}</p>
                    <p className="text-sm">
                      {status?.lastSyncError || t('googleErrorDescription')}
                    </p>
                  </div>
                </div>
              </Alert>

              <div className="flex justify-end gap-3">
                <Button
                  variant="ghost"
                  onClick={() => disconnectGoogle.mutate()}
                  disabled={disconnectGoogle.isPending}
                  leftIcon={<Unplug className="h-4 w-4" />}
                >
                  {t('disconnect')}
                </Button>
                <Button
                  onClick={handleConnect}
                  loading={connectGoogle.isPending}
                  leftIcon={<RefreshCw className="h-4 w-4" />}
                >
                  {t('reconnect')}
                </Button>
              </div>
            </div>
          ) : !isConfigured ? (
            // Not configured on server - show info message
            <div className="space-y-4">
              <Alert variant="warning">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5" />
                  <div>
                    <p className="font-medium">{t('googleNotConfigured')}</p>
                    <p className="text-sm">{t('googleNotConfiguredDescription')}</p>
                  </div>
                </div>
              </Alert>

              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">{t('googleBenefits')}</h4>
                <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                  <li>{t('googleBenefit1')}</li>
                  <li>{t('googleBenefit2')}</li>
                  <li>{t('googleBenefit3')}</li>
                  <li>{t('googleBenefit4')}</li>
                </ul>
              </div>

              <p className="text-xs text-gray-500">
                {t('googleConfigureHint')}
              </p>
            </div>
          ) : (
            // Disconnected state - show connection button
            <div className="space-y-4">
              <Alert>
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5" />
                  <div>
                    <p className="font-medium">{t('connectGoogleBusiness')}</p>
                    <p className="text-sm">{t('connectGoogleBusinessDescription')}</p>
                  </div>
                </div>
              </Alert>

              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">{t('googleBenefits')}</h4>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li>{t('googleBenefit1')}</li>
                  <li>{t('googleBenefit2')}</li>
                  <li>{t('googleBenefit3')}</li>
                  <li>{t('googleBenefit4')}</li>
                </ul>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleConnect}
                  loading={connectGoogle.isPending}
                  leftIcon={
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                  }
                >
                  {t('connectWithGoogle')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Disconnect confirmation modal */}
      {showDisconnectConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-error">
                <Unplug className="h-5 w-5" />
                {t('disconnectGoogle')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="warning">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium">{t('warning')}</p>
                    <p>{t('disconnectGoogleWarning')}</p>
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
                  loading={disconnectGoogle.isPending}
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
