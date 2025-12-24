'use client';

/**
 * Trial Banner - Faixa fixa de aviso do período de teste
 *
 * Exibe uma faixa no topo da aplicação informando quantos dias
 * restam do período de teste gratuito de 14 dias.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Clock, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui';
import { useAuth } from '@/context/auth-context';
import { cn } from '@/lib/utils';
import {
  BillingStatus,
  calculateTrialDaysRemaining,
  PRO_PLAN_PRICING,
} from '@/services/billing.service';

interface TrialBannerProps {
  billing?: BillingStatus | null;
  className?: string;
}

export function TrialBanner({ billing, className }: TrialBannerProps) {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);

  useEffect(() => {
    // Prioridade: usar trialDaysRemaining do backend se disponível
    if (typeof billing?.trialDaysRemaining === 'number') {
      setDaysRemaining(billing.trialDaysRemaining);
    } else if (billing?.trialEndAt) {
      setDaysRemaining(calculateTrialDaysRemaining(billing.trialEndAt));
    } else if (billing?.subscriptionStatus === 'TRIALING' && user?.createdAt) {
      // Fallback: calcular baseado na data de criação + 14 dias
      const trialEnd = new Date(user.createdAt);
      trialEnd.setDate(trialEnd.getDate() + 14);
      setDaysRemaining(calculateTrialDaysRemaining(trialEnd.toISOString()));
    } else {
      // Se nenhum dado disponível, não mostrar
      setDaysRemaining(null);
    }
  }, [billing, user]);

  // Não mostrar se:
  // - Usuário não está logado
  // - Não está em trial (já é PRO ativo ou expirou)
  // - Banner foi dispensado
  if (!user) return null;
  if (!billing) return null;
  if (billing.subscriptionStatus !== 'TRIALING') return null;
  if (dismissed) return null;
  if (daysRemaining === null) return null;

  // Determinar urgência baseada nos dias restantes
  const isUrgent = daysRemaining <= 3;
  const isWarning = daysRemaining <= 7 && daysRemaining > 3;

  return (
    <div
      className={cn(
        'relative w-full py-2.5 px-4 text-sm font-medium transition-colors',
        isUrgent && 'bg-error text-white',
        isWarning && 'bg-warning text-warning-900',
        !isUrgent && !isWarning && 'bg-primary text-white',
        className
      )}
    >
      <div className="container mx-auto flex items-center justify-center gap-3">
        <Clock className="h-4 w-4 flex-shrink-0" />

        <span>
          {daysRemaining === 0 ? (
            'Seu período de teste termina hoje!'
          ) : daysRemaining === 1 ? (
            'Seu período de teste termina amanhã!'
          ) : (
            <>
              Seu período de teste termina em{' '}
              <strong>{daysRemaining} dias</strong>
            </>
          )}
          {' • '}
          <span className="hidden sm:inline">
            Assine por apenas{' '}
            <strong>
              R$ {PRO_PLAN_PRICING.YEARLY.toFixed(2).replace('.', ',')}/mês
            </strong>{' '}
            no plano anual
          </span>
        </span>

        <Link href="/settings/plan" className="flex-shrink-0">
          <Button
            size="sm"
            variant={isUrgent || isWarning ? 'outline' : 'secondary'}
            className={cn(
              'h-7 text-xs font-semibold',
              isUrgent && 'border-white text-white hover:bg-white/10',
              isWarning && 'border-warning-900 text-warning-900 hover:bg-warning-900/10',
              !isUrgent && !isWarning && 'bg-white text-primary hover:bg-white/90'
            )}
            leftIcon={<Sparkles className="h-3 w-3" />}
          >
            Assinar agora
          </Button>
        </Link>

        <button
          onClick={() => setDismissed(true)}
          className={cn(
            'absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full transition-colors',
            isUrgent && 'hover:bg-white/10',
            isWarning && 'hover:bg-warning-900/10',
            !isUrgent && !isWarning && 'hover:bg-white/10'
          )}
          aria-label="Fechar banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default TrialBanner;
