'use client';

/**
 * Inventory Settings Page
 *
 * Configuracoes de estoque:
 * - Toggle para ativar/desativar controle
 * - Status da OS para baixa automatica
 * - Permitir estoque negativo
 * - Baixar apenas uma vez por OS
 */

import { useState, useEffect } from 'react';
import { useTranslations } from '@/i18n';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Package,
  Settings,
  Check,
  AlertCircle,
  Loader2,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Alert,
  Skeleton,
} from '@/components/ui';
import {
  getInventorySettings,
  updateInventorySettings,
  InventorySettings,
  UpdateInventorySettingsDto,
} from '@/services/inventory.service';

const STATUS_OPTIONS = [
  { value: 'IN_PROGRESS', labelKey: 'statusInProgress', descriptionKey: 'statusInProgressDescription' },
  { value: 'DONE', labelKey: 'statusDone', descriptionKey: 'statusDoneDescription' },
] as const;

export default function InventorySettingsPage() {
  const { t } = useTranslations('inventory');
  const queryClient = useQueryClient();

  // Fetch settings
  const { data: settings, isLoading, error } = useQuery<InventorySettings>({
    queryKey: ['inventorySettings'],
    queryFn: getInventorySettings,
  });

  // Local state
  const [isEnabled, setIsEnabled] = useState(false);
  const [deductOnStatus, setDeductOnStatus] = useState<'IN_PROGRESS' | 'DONE'>('DONE');
  const [allowNegativeStock, setAllowNegativeStock] = useState(false);
  const [deductOnlyOnce, setDeductOnlyOnce] = useState(true);
  const [saved, setSaved] = useState(false);

  // Initialize from server data
  useEffect(() => {
    if (settings) {
      setIsEnabled(settings.isEnabled);
      setDeductOnStatus(settings.deductOnStatus === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'DONE');
      setAllowNegativeStock(settings.allowNegativeStock);
      setDeductOnlyOnce(settings.deductOnlyOncePerWorkOrder);
    }
  }, [settings]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: UpdateInventorySettingsDto) => updateInventorySettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventorySettings'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const handleSave = async () => {
    await updateMutation.mutateAsync({
      isEnabled,
      deductOnStatus,
      allowNegativeStock,
      deductOnlyOncePerWorkOrder: deductOnlyOnce,
    });
  };

  // Feature not available in plan
  if (settings && !settings.featureEnabled) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {t('title')}
              </h3>
              <p className="text-gray-500 max-w-md mx-auto">
                {t('settings.featureDisabled')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="error">
        <AlertCircle className="h-4 w-4" />
        <span>{t('settings.loadError')}</span>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Package className="h-6 w-6" />
          {t('settings.title')}
        </h1>
        <p className="text-gray-500 mt-1">{t('settings.description')}</p>
      </div>

      {/* Main toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              {t('settings.enabled')}
            </div>
            <button
              type="button"
              onClick={() => setIsEnabled(!isEnabled)}
              className="flex items-center gap-2 text-sm font-normal"
            >
              {isEnabled ? (
                <>
                  <ToggleRight className="h-8 w-8 text-green-500" />
                  <span className="text-green-600 font-medium">{t('settings.activated')}</span>
                </>
              ) : (
                <>
                  <ToggleLeft className="h-8 w-8 text-gray-400" />
                  <span className="text-gray-500">{t('settings.deactivated')}</span>
                </>
              )}
            </button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">
            {t('settings.enabledDescription')}
          </p>
        </CardContent>
      </Card>

      {/* Detailed settings - only show when enabled */}
      {isEnabled && (
        <>
          {/* Deduct on status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('settings.deductOnStatus')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-500 mb-4">
                {t('settings.deductOnStatusDescription')}
              </p>
              <div className="flex flex-col gap-3">
                {STATUS_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                      deductOnStatus === option.value
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="deductOnStatus"
                      value={option.value}
                      checked={deductOnStatus === option.value}
                      onChange={() => setDeductOnStatus(option.value)}
                      className="h-4 w-4 text-primary"
                    />
                    <div>
                      <span className="font-medium">{t(`settings.${option.labelKey}`)}</span>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {t(`settings.${option.descriptionKey}`)}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Allow negative stock */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span>{t('settings.allowNegativeStock')}</span>
                <button
                  type="button"
                  onClick={() => setAllowNegativeStock(!allowNegativeStock)}
                  className="flex items-center gap-2 text-sm font-normal"
                >
                  {allowNegativeStock ? (
                    <ToggleRight className="h-6 w-6 text-orange-500" />
                  ) : (
                    <ToggleLeft className="h-6 w-6 text-gray-400" />
                  )}
                </button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">
                {t('settings.allowNegativeStockDescription')}
              </p>
              {allowNegativeStock && (
                <Alert variant="warning" className="mt-4">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm">
                    {t('settings.negativeStockWarning')}
                  </span>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Deduct only once */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span>{t('settings.deductOnlyOnce')}</span>
                <button
                  type="button"
                  onClick={() => setDeductOnlyOnce(!deductOnlyOnce)}
                  className="flex items-center gap-2 text-sm font-normal"
                >
                  {deductOnlyOnce ? (
                    <ToggleRight className="h-6 w-6 text-green-500" />
                  ) : (
                    <ToggleLeft className="h-6 w-6 text-gray-400" />
                  )}
                </button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">
                {t('settings.deductOnlyOnceDescription')}
              </p>
            </CardContent>
          </Card>
        </>
      )}

      {/* Alerts */}
      {saved && (
        <Alert variant="success">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4" />
            {t('settings.saved')}
          </div>
        </Alert>
      )}

      {updateMutation.error && (
        <Alert variant="error">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {t('settings.saveError')}
          </div>
        </Alert>
      )}

      {/* Save button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          loading={updateMutation.isPending}
          leftIcon={<Check className="h-4 w-4" />}
        >
          {t('settings.saveSettings')}
        </Button>
      </div>
    </div>
  );
}
