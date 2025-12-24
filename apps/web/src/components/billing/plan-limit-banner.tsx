'use client';

/**
 * Plan Limit Banner - Banner de uso do plano
 *
 * DEPRECATED: Com o novo modelo de billing (Trial 14 dias + PRO),
 * não há mais limites de recursos. Este componente é mantido por
 * compatibilidade mas sempre retorna null.
 */

interface PlanLimitBannerProps {
  resource: 'clients' | 'quotes' | 'workOrders' | 'payments' | 'suppliers' | 'expenses';
  className?: string;
}

/**
 * @deprecated O novo modelo de billing não tem limites.
 * Este componente é mantido por compatibilidade mas sempre retorna null.
 */
export function PlanLimitBanner(_props: PlanLimitBannerProps) {
  // Com o novo modelo de billing, não há limites - Trial e PRO têm tudo liberado
  return null;
}

export default PlanLimitBanner;
