'use client';

/**
 * ProFeatureOverlay Component
 *
 * Overlay para features bloqueadas no plano FREE
 * Exibe blur e CTA de upgrade
 */

import { Lock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

interface ProFeatureOverlayProps {
  title?: string;
  description?: string;
  showContent?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function ProFeatureOverlay({
  title = 'Recurso PRO',
  description = 'Faça upgrade para acessar relatórios detalhados e análises avançadas.',
  showContent = true,
  className,
  children,
}: ProFeatureOverlayProps) {
  return (
    <div className={cn('relative overflow-hidden rounded-lg', className)}>
      {/* Content with blur */}
      <div
        className={cn(
          'select-none pointer-events-none',
          showContent ? 'filter blur-sm opacity-60' : 'hidden'
        )}
        aria-hidden="true"
      >
        {children}
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-[2px] rounded-lg z-10">
        <div className="text-center p-6 max-w-sm bg-white/90 rounded-xl shadow-lg">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-50 rounded-full mb-4">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {title}
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            {description}
          </p>
          <a href="/settings/plan">
            <Button leftIcon={<Sparkles className="h-4 w-4" />}>
              Fazer Upgrade
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}

export default ProFeatureOverlay;
