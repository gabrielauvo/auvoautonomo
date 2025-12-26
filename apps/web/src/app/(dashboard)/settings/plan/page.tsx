'use client';

/**
 * Plan Settings Page - Página de Assinatura
 *
 * Modelo simplificado:
 * - 14 dias de trial com tudo liberado
 * - Plano PRO: R$ 99,90/mês ou R$ 89,90/mês (anual)
 */

import { useState } from 'react';
import { useTranslations } from '@/i18n';
import {
  CreditCard,
  Check,
  Sparkles,
  Clock,
  Calendar,
  AlertCircle,
  Crown,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  Alert,
  Skeleton,
} from '@/components/ui';
import { CheckoutModal } from '@/components/billing';
import {
  useSubscription,
  useCancelSubscription,
} from '@/hooks/use-settings';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import {
  PRO_PLAN_PRICING,
  TRIAL_DURATION_DAYS,
  calculateTrialDaysRemaining,
  BillingPeriod,
} from '@/services/billing.service';

// Feature keys for PRO plan
const PRO_FEATURE_KEYS = [
  'features.unlimitedClients',
  'features.unlimitedQuotes',
  'features.unlimitedWorkOrders',
  'features.unlimitedCharges',
  'features.productCatalog',
  'features.expenseManagement',
  'features.advancedReports',
  'features.pdfExport',
  'features.whatsappIntegration',
  'features.prioritySupport',
];

export default function PlanSettingsPage() {
  const { t } = useTranslations('plan');
  const { data: subscription, isLoading, refetch } = useSubscription();
  const cancelSubscription = useCancelSubscription();
  const queryClient = useQueryClient();

  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<BillingPeriod>('YEARLY');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Status da assinatura
  const status = subscription?.subscriptionStatus || 'TRIALING';
  const isTrialing = status === 'TRIALING';
  const isActive = status === 'ACTIVE';
  const isExpired = status === 'EXPIRED' || status === 'CANCELED';

  // Dias restantes do trial
  const trialDaysRemaining = subscription?.trialEndAt
    ? calculateTrialDaysRemaining(subscription.trialEndAt)
    : subscription?.trialDaysRemaining || 0;

  // Preço baseado no período selecionado
  const selectedPrice = selectedPeriod === 'YEARLY'
    ? PRO_PLAN_PRICING.YEARLY
    : PRO_PLAN_PRICING.MONTHLY;

  const handleUpgradeClick = (period: BillingPeriod) => {
    setSelectedPeriod(period);
    setShowCheckout(true);
  };

  const handleCheckoutSuccess = () => {
    setShowCheckout(false);
    refetch();
    queryClient.invalidateQueries({ queryKey: ['subscription'] });
    queryClient.invalidateQueries({ queryKey: ['billing'] });
  };

  const handleCancelSubscription = async () => {
    try {
      await cancelSubscription.mutateAsync();
      setShowCancelConfirm(false);
      refetch();
    } catch (error) {
      console.error('Erro ao cancelar:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Status atual */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isActive ? (
              <Crown className="h-5 w-5 text-primary" />
            ) : (
              <Clock className="h-5 w-5" />
            )}
            {isActive ? t('proPlan') : t('trialPeriod')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  'p-3 rounded-xl',
                  isActive ? 'bg-primary-100' : 'bg-gray-100'
                )}
              >
                {isActive ? (
                  <Crown className="h-8 w-8 text-primary" />
                ) : (
                  <Clock className="h-8 w-8 text-gray-600" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-gray-900">
                    {isActive ? t('activeSubscription') : isExpired ? t('trialExpired') : t('trialPeriod')}
                  </h3>
                  <Badge variant={isActive ? 'primary' : isExpired ? 'error' : 'warning'}>
                    {isActive ? 'PRO' : isExpired ? t('expired') : t('daysRemaining', { days: trialDaysRemaining })}
                  </Badge>
                </div>
                <p className="text-gray-500 mt-1">
                  {isActive ? (
                    <>
                      R$ {selectedPrice.toFixed(2).replace('.', ',')}{t('perMonth')}
                      {subscription?.billingPeriod === 'YEARLY' && ` (${t('yearlyPlan')})`}
                    </>
                  ) : isExpired ? (
                    t('subscribeToUse')
                  ) : (
                    t('freeTrialDays', { days: TRIAL_DURATION_DAYS })
                  )}
                </p>
              </div>
            </div>

            {isActive && subscription && (
              <div className="text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {t('nextBilling')}:{' '}
                    {subscription.currentPeriodEnd
                      ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
                      : '-'}
                  </span>
                </div>
                {subscription.cancelAtPeriodEnd && (
                  <p className="text-warning mt-1">
                    {t('subscriptionWillBeCanceled')}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Alerta para trial expirando */}
          {isTrialing && trialDaysRemaining <= 3 && (
            <Alert variant="warning" className="mt-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 mt-0.5" />
                <div>
                  <p className="font-medium">
                    {trialDaysRemaining === 0
                      ? t('trialEndsToday')
                      : t('trialEndsSoon', { days: trialDaysRemaining })}
                  </p>
                  <p className="text-sm mt-1">
                    {t('subscribeNow')}
                  </p>
                </div>
              </div>
            </Alert>
          )}

          {/* Botão de cancelar para assinantes */}
          {isActive && !subscription?.cancelAtPeriodEnd && (
            <div className="mt-4 pt-4 border-t flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="text-error"
                onClick={() => setShowCancelConfirm(true)}
              >
                {t('cancelSubscription')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Planos e preços */}
      {(!isActive || subscription?.cancelAtPeriodEnd) && (
        <Card>
          <CardHeader>
            <CardTitle>{t('choosePlan')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Plano Mensal */}
              <div
                className={cn(
                  'relative border rounded-xl p-6 transition-all cursor-pointer',
                  selectedPeriod === 'MONTHLY'
                    ? 'border-primary ring-2 ring-primary ring-offset-2'
                    : 'hover:border-gray-300'
                )}
                onClick={() => setSelectedPeriod('MONTHLY')}
              >
                <div className="text-center mb-6">
                  <h3 className="text-lg font-bold text-gray-900">{t('monthly')}</h3>
                  <div className="mt-2">
                    <span className="text-4xl font-bold text-gray-900">
                      R$ {PRO_PLAN_PRICING.MONTHLY.toFixed(2).replace('.', ',')}
                    </span>
                    <span className="text-gray-500">{t('perMonth')}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {t('billedMonthly')}
                  </p>
                </div>

                <Button
                  className="w-full"
                  variant={selectedPeriod === 'MONTHLY' ? 'default' : 'outline'}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUpgradeClick('MONTHLY');
                  }}
                  leftIcon={<CreditCard className="h-4 w-4" />}
                >
                  {t('subscribeMonthly')}
                </Button>
              </div>

              {/* Plano Anual */}
              <div
                className={cn(
                  'relative border rounded-xl p-6 transition-all cursor-pointer',
                  selectedPeriod === 'YEARLY'
                    ? 'border-primary ring-2 ring-primary ring-offset-2'
                    : 'hover:border-gray-300'
                )}
                onClick={() => setSelectedPeriod('YEARLY')}
              >
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="primary" className="shadow">
                    {t('mostPopular')}
                  </Badge>
                </div>

                <div className="text-center mb-6">
                  <h3 className="text-lg font-bold text-gray-900">{t('yearly')}</h3>
                  <div className="mt-2">
                    <span className="text-4xl font-bold text-gray-900">
                      R$ {PRO_PLAN_PRICING.YEARLY.toFixed(2).replace('.', ',')}
                    </span>
                    <span className="text-gray-500">{t('perMonth')}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {t('totalPerYear', { amount: `R$ ${PRO_PLAN_PRICING.YEARLY_TOTAL.toFixed(2).replace('.', ',')}` })}
                  </p>
                  <Badge variant="success" className="mt-2">
                    {t('savings', { amount: `R$ ${PRO_PLAN_PRICING.YEARLY_SAVINGS.toFixed(2).replace('.', ',')}` })}
                  </Badge>
                </div>

                <Button
                  className="w-full"
                  variant={selectedPeriod === 'YEARLY' ? 'default' : 'outline'}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUpgradeClick('YEARLY');
                  }}
                  leftIcon={<Sparkles className="h-4 w-4" />}
                >
                  {t('subscribeYearly')}
                </Button>
              </div>
            </div>

            {/* Features incluídas */}
            <div className="mt-8 pt-6 border-t">
              <h4 className="text-sm font-semibold text-gray-900 mb-4">
                {t('includedInPro')}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PRO_FEATURE_KEYS.map((featureKey, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-success flex-shrink-0" />
                    <span className="text-gray-600">{t(featureKey)}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs text-center text-gray-500 mt-6">
              {t('securePayment')}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Features do plano ativo */}
      {isActive && !subscription?.cancelAtPeriodEnd && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-success" />
              {t('includedFeatures')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PRO_FEATURE_KEYS.map((featureKey, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-success flex-shrink-0" />
                  <span className="text-gray-600">{t(featureKey)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal de Checkout */}
      <CheckoutModal
        isOpen={showCheckout}
        onClose={() => setShowCheckout(false)}
        onSuccess={handleCheckoutSuccess}
        planName="PRO"
        planPrice={selectedPeriod === 'YEARLY' ? PRO_PLAN_PRICING.YEARLY_TOTAL : PRO_PLAN_PRICING.MONTHLY}
        billingPeriod={selectedPeriod}
      />

      {/* Modal de cancelamento */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="text-error">{t('cancelSubscriptionTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="warning">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium">{t('cancelAttention')}</p>
                    <p>
                      {t('cancelAttentionMessage')}
                    </p>
                  </div>
                </div>
              </Alert>

              <div className="flex justify-end gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setShowCancelConfirm(false)}
                >
                  {t('keepSubscription')}
                </Button>
                <Button
                  variant="error"
                  onClick={handleCancelSubscription}
                  loading={cancelSubscription.isPending}
                >
                  {t('confirmCancellation')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
