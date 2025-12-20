'use client';

/**
 * Plan Settings Page
 *
 * Gerenciamento de plano e assinatura:
 * - Plano atual e uso
 * - Comparação de planos (apenas FREE e PRO)
 * - Upgrade via checkout inline (PIX ou Cartão)
 */

import { useState } from 'react';
import { useTranslations } from '@/i18n';
import {
  CreditCard,
  Check,
  Sparkles,
  Users,
  AlertCircle,
  Calendar,
  Zap,
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
import { PlanUsageBar } from '@/components/settings';
import { CheckoutModal } from '@/components/billing';
import {
  useSubscription,
  useCancelSubscription,
} from '@/hooks/use-settings';
import {
  formatPlanPrice,
} from '@/services/settings.service';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';

// Configuração de planos (apenas FREE e PRO)
const PLANS = {
  FREE: {
    type: 'FREE' as const,
    name: 'Gratuito',
    price: 0,
    features: [
      'Até 10 clientes',
      'Até 10 orçamentos',
      'Até 10 OS',
      'Até 5 cobranças',
    ],
    limits: {
      maxClients: 10,
      maxQuotes: 10,
      maxWorkOrders: 10,
      maxPayments: 5,
    },
  },
  PRO: {
    type: 'PRO' as const,
    name: 'Profissional',
    price: 39.90,
    features: [
      'Clientes ilimitados',
      'Orçamentos ilimitados',
      'OS ilimitadas',
      'Cobranças ilimitadas',
      'Templates personalizados',
      'Relatórios avançados',
      'Suporte prioritário',
    ],
    limits: {
      maxClients: -1,
      maxQuotes: -1,
      maxWorkOrders: -1,
      maxPayments: -1,
    },
  },
};

type PlanType = 'FREE' | 'PRO';

export default function PlanSettingsPage() {
  const { t } = useTranslations('plan');
  const { data: subscription, isLoading, refetch } = useSubscription();
  const cancelSubscription = useCancelSubscription();
  const queryClient = useQueryClient();

  const [showCheckout, setShowCheckout] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const currentPlan = (subscription?.plan?.type as PlanType) || 'FREE';
  const isFreePlan = currentPlan === 'FREE';

  const handleUpgradeClick = () => {
    setShowCheckout(true);
  };

  const handleCheckoutSuccess = () => {
    setShowCheckout(false);
    // Recarregar dados da assinatura
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
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const usage = subscription?.usage || {
    clientsCount: 0,
    quotesCount: 0,
    workOrdersCount: 0,
    paymentsCount: 0,
  };

  const limits = PLANS[currentPlan].limits;

  return (
    <div className="space-y-6">
      {/* Plano atual */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {t('currentPlan')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  'p-3 rounded-lg',
                  isFreePlan ? 'bg-gray-100' : 'bg-primary-100'
                )}
              >
                {isFreePlan ? (
                  <Users className="h-8 w-8 text-gray-600" />
                ) : (
                  <Sparkles className="h-8 w-8 text-primary" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-gray-900">
                    {t('planLabel')} {PLANS[currentPlan].name}
                  </h3>
                  <Badge variant={isFreePlan ? 'gray' : 'primary'}>
                    {currentPlan}
                  </Badge>
                </div>
                <p className="text-gray-500">
                  {formatPlanPrice(PLANS[currentPlan].price)}
                  {!isFreePlan && t('perMonth')}
                </p>
              </div>
            </div>

            {!isFreePlan && subscription && (
              <div className="text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {t('nextBilling')}{' '}
                    {subscription.currentPeriodEnd
                      ? new Date(subscription.currentPeriodEnd).toLocaleDateString('pt-BR')
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

          {!isFreePlan && !subscription?.cancelAtPeriodEnd && (
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

      {/* Uso atual */}
      <Card>
        <CardHeader>
          <CardTitle>{t('planUsage')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <PlanUsageBar
              label={t('clients')}
              current={usage.clientsCount}
              max={limits.maxClients}
            />
            <PlanUsageBar
              label={t('quotes')}
              current={usage.quotesCount}
              max={limits.maxQuotes}
            />
            <PlanUsageBar
              label={t('workOrders')}
              current={usage.workOrdersCount}
              max={limits.maxWorkOrders}
            />
            <PlanUsageBar
              label={t('charges')}
              current={usage.paymentsCount}
              max={limits.maxPayments}
            />
          </div>

          {isFreePlan && (
            <Alert variant="warning" className="mt-4">
              <div className="flex items-start gap-3">
                <Zap className="h-5 w-5 mt-0.5" />
                <div>
                  <p className="font-medium">{t('unlockUnlimited')}</p>
                  <p className="text-sm mt-1">
                    {t('unlockUnlimitedDescription')}
                  </p>
                </div>
              </div>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Comparação de planos - apenas FREE e PRO */}
      <Card>
        <CardHeader>
          <CardTitle>{t('comparePlans')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {(Object.entries(PLANS) as [PlanType, typeof PLANS.FREE][]).map(
              ([planKey, plan]) => {
                const isCurrentPlan = planKey === currentPlan;
                const isPopular = planKey === 'PRO';

                return (
                  <div
                    key={planKey}
                    className={cn(
                      'relative border rounded-xl p-6 transition-all',
                      isCurrentPlan && 'border-primary ring-2 ring-primary ring-offset-2',
                      !isCurrentPlan && 'hover:border-gray-300'
                    )}
                  >
                    {isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge variant="primary" className="shadow">
                          {t('mostPopular')}
                        </Badge>
                      </div>
                    )}

                    <div className="text-center mb-6">
                      <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                      <div className="mt-2">
                        <span className="text-4xl font-bold text-gray-900">
                          {plan.price === 0 ? 'Grátis' : `R$ ${plan.price.toFixed(2).replace('.', ',')}`}
                        </span>
                        {plan.price > 0 && (
                          <span className="text-gray-500">{t('perMonth')}</span>
                        )}
                      </div>
                    </div>

                    <ul className="space-y-3 mb-6">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                          <span className="text-gray-600">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {isCurrentPlan ? (
                      <Button variant="outline" className="w-full" disabled>
                        {t('currentPlanButton')}
                      </Button>
                    ) : planKey === 'FREE' && currentPlan === 'PRO' ? (
                      <Button
                        variant="ghost"
                        className="w-full text-error hover:text-error"
                        onClick={() => setShowCancelConfirm(true)}
                      >
                        {t('downgrade')}
                      </Button>
                    ) : planKey === 'FREE' ? (
                      <Button variant="ghost" className="w-full" disabled>
                        {t('available')}
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        variant="default"
                        onClick={handleUpgradeClick}
                        leftIcon={<Sparkles className="h-4 w-4" />}
                      >
                        {t('upgrade')}
                      </Button>
                    )}
                  </div>
                );
              }
            )}
          </div>

          <p className="text-xs text-center text-gray-500 mt-6">
            Pagamento seguro via PIX ou Cartão de Crédito
          </p>
        </CardContent>
      </Card>

      {/* Modal de Checkout */}
      <CheckoutModal
        isOpen={showCheckout}
        onClose={() => setShowCheckout(false)}
        onSuccess={handleCheckoutSuccess}
        planName="Profissional"
        planPrice={PLANS.PRO.price}
      />

      {/* Modal de cancelamento */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="text-error">{t('cancelSubscription')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="warning">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium">{t('attention')}</p>
                    <p>
                      {t('cancelWarning')}
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
