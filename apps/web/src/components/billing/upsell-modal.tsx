'use client';

/**
 * Upsell Modal - Modal de upgrade quando limite é atingido
 *
 * Exibido quando o usuário tenta criar um recurso
 * mas atingiu o limite do plano FREE
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@/components/ui';
import { Zap, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UpsellModalProps {
  isOpen: boolean;
  onClose: () => void;
  resource: string;
  currentPlan: string;
  max: number;
  current: number;
}

const resourceLabels: Record<string, string> = {
  CLIENT: 'clientes',
  QUOTE: 'orçamentos',
  WORK_ORDER: 'ordens de serviço',
  PAYMENT: 'pagamentos',
  NOTIFICATION: 'notificações',
};

const proBenefits = [
  'Clientes ilimitados',
  'Orçamentos ilimitados',
  'Ordens de serviço ilimitadas',
  'Analytics avançado',
  'Assinatura digital',
  'Portal do cliente',
  'Suporte prioritário',
];

export function UpsellModal({
  isOpen,
  onClose,
  resource,
  currentPlan,
  max,
  current,
}: UpsellModalProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 200);
  };

  if (!isOpen) {
    return null;
  }

  const label = resourceLabels[resource] || resource.toLowerCase();

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity',
        isVisible ? 'opacity-100' : 'opacity-0'
      )}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
      />

      {/* Modal */}
      <Card
        className={cn(
          'relative w-full max-w-md z-10 transform transition-transform',
          isVisible ? 'scale-100' : 'scale-95'
        )}
        variant="elevated"
        padding="none"
      >
        {/* Header com gradiente */}
        <div className="bg-gradient-to-r from-primary to-primary-700 p-6 rounded-t-lg">
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-white/20 rounded-lg">
              <Zap className="h-6 w-6 text-white" />
            </div>
            <Badge variant="soft" className="bg-white/20 text-white">
              UPGRADE
            </Badge>
          </div>

          <h2 className="text-xl font-bold text-white">
            Limite de {label} atingido
          </h2>
          <p className="text-white/80 text-sm mt-1">
            Você está usando {current} de {max} {label} do plano {currentPlan}.
          </p>
        </div>

        <CardContent className="p-6">
          <h3 className="font-medium text-gray-900 mb-4">
            Faça upgrade para o PRO e tenha:
          </h3>

          <ul className="space-y-3 mb-6">
            {proBenefits.map((benefit) => (
              <li key={benefit} className="flex items-center gap-3">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-success-100 flex items-center justify-center">
                  <Check className="h-3 w-3 text-success" />
                </div>
                <span className="text-sm text-gray-700">{benefit}</span>
              </li>
            ))}
          </ul>

          <div className="flex gap-3">
            <Button variant="ghost" onClick={handleClose} className="flex-1">
              Agora não
            </Button>
            <Link href="/settings/billing" className="flex-1">
              <Button fullWidth leftIcon={<Zap className="h-4 w-4" />}>
                Ver planos
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default UpsellModal;
