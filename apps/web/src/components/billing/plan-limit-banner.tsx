'use client';

/**
 * Plan Limit Banner - Banner de uso do plano
 *
 * Exibe progresso de uso de recursos do plano
 * e link para upgrade quando próximo do limite
 */

import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { Card, CardContent, Badge, Button } from '@/components/ui';
import { AlertCircle, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlanLimitBannerProps {
  resource: 'clients' | 'quotes' | 'workOrders' | 'payments' | 'suppliers' | 'expenses';
  className?: string;
}

const resourceLabels: Record<string, { singular: string; plural: string }> = {
  clients: { singular: 'cliente', plural: 'clientes' },
  quotes: { singular: 'orçamento', plural: 'orçamentos' },
  workOrders: { singular: 'ordem de serviço', plural: 'ordens de serviço' },
  payments: { singular: 'pagamento', plural: 'pagamentos' },
  suppliers: { singular: 'fornecedor', plural: 'fornecedores' },
  expenses: { singular: 'despesa', plural: 'despesas' },
};

export function PlanLimitBanner({ resource, className }: PlanLimitBannerProps) {
  const { billing } = useAuth();

  if (!billing || billing.planKey !== 'FREE') {
    return null;
  }

  const usage = billing.usage;
  const limits = billing.limits;

  // Se não tem dados de uso ou limites, não mostra banner
  if (!usage || !limits) {
    return null;
  }

  // Mapeia resource para o campo correspondente
  const usageMap: Record<string, number> = {
    clients: usage.clientsCount || 0,
    quotes: usage.quotesCount || 0,
    workOrders: usage.workOrdersCount || 0,
    payments: usage.paymentsCount || 0,
    suppliers: 0, // TODO: Add suppliersCount to CurrentUsage when backend supports it
    expenses: 0, // TODO: Add expensesCount to CurrentUsage when backend supports it
  };

  const limitMap: Record<string, number> = {
    clients: limits.maxClients ?? 0,
    quotes: limits.maxQuotes ?? 0,
    workOrders: limits.maxWorkOrders ?? 0,
    payments: limits.maxPayments ?? 0,
    suppliers: limits.maxSuppliers ?? 0,
    expenses: limits.maxExpenses ?? 0,
  };

  const current = usageMap[resource] || 0;
  const max = limitMap[resource] || 0;

  // Se limite é -1 (ilimitado), não mostra banner
  if (max === -1) {
    return null;
  }

  const percentage = Math.min((current / max) * 100, 100);
  const isNearLimit = percentage >= 80;
  const isAtLimit = current >= max;
  const label = resourceLabels[resource];

  return (
    <Card
      className={cn(
        'border',
        isAtLimit
          ? 'border-error-200 bg-error-50'
          : isNearLimit
          ? 'border-warning-200 bg-warning-50'
          : 'border-gray-200 bg-gray-50',
        className
      )}
    >
      <CardContent className="py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            {isAtLimit ? (
              <AlertCircle className="h-5 w-5 text-error flex-shrink-0" />
            ) : isNearLimit ? (
              <AlertCircle className="h-5 w-5 text-warning flex-shrink-0" />
            ) : null}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-gray-900">
                  {current} de {max} {label.plural}
                </span>
                <Badge
                  variant={isAtLimit ? 'error' : isNearLimit ? 'warning' : 'gray'}
                  size="xs"
                >
                  Plano FREE
                </Badge>
              </div>

              {/* Barra de progresso */}
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    isAtLimit
                      ? 'bg-error'
                      : isNearLimit
                      ? 'bg-warning'
                      : 'bg-primary'
                  )}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          </div>

          <Link href="/settings/billing">
            <Button variant="soft" size="sm" leftIcon={<Zap className="h-4 w-4" />}>
              Fazer upgrade
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default PlanLimitBanner;
