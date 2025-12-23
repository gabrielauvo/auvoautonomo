'use client';

/**
 * Onboarding Banner - Faixa de progresso do onboarding
 *
 * Exibe o progresso do usuário no onboarding em todas as páginas.
 * O usuário pode desabilitar a faixa, que fica salva no localStorage.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { X, Rocket, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// Chaves do localStorage
const ONBOARDING_STORAGE_KEY = 'auvo_onboarding_progress';
const ONBOARDING_BANNER_DISMISSED_KEY = 'auvo_onboarding_banner_dismissed';

// IDs dos itens do checklist (sincronizado com getting-started page)
const CHECKLIST_ITEM_IDS = [
  'download-app',
  'setup-company',
  'add-client',
  'create-quote',
  'create-work-order',
  'create-charge',
  'add-expense',
  'setup-asaas',
];

export function OnboardingBanner() {
  const [completedItems, setCompletedItems] = useState<string[]>([]);
  const [isDismissed, setIsDismissed] = useState(true); // Começa oculto até carregar
  const [isLoading, setIsLoading] = useState(true);

  // Carregar estado do localStorage
  useEffect(() => {
    const dismissed = localStorage.getItem(ONBOARDING_BANNER_DISMISSED_KEY);
    const progress = localStorage.getItem(ONBOARDING_STORAGE_KEY);

    setIsDismissed(dismissed === 'true');

    if (progress) {
      try {
        setCompletedItems(JSON.parse(progress));
      } catch {
        setCompletedItems([]);
      }
    }

    setIsLoading(false);

    // Listener para atualizar quando o progresso mudar em outra aba/página
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === ONBOARDING_STORAGE_KEY && e.newValue) {
        try {
          setCompletedItems(JSON.parse(e.newValue));
        } catch {
          // ignore
        }
      }
      if (e.key === ONBOARDING_BANNER_DISMISSED_KEY) {
        setIsDismissed(e.newValue === 'true');
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Dismiss banner
  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem(ONBOARDING_BANNER_DISMISSED_KEY, 'true');
  };

  const completedCount = completedItems.filter((id) =>
    CHECKLIST_ITEM_IDS.includes(id)
  ).length;
  const totalCount = CHECKLIST_ITEM_IDS.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);
  const isComplete = completedCount === totalCount;

  // Não renderizar enquanto carrega, se foi dismissed ou se já completou
  if (isLoading || isDismissed || isComplete) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-primary-50 to-primary-100 border-b border-primary-200">
      <div className="px-4 py-2">
        <div className="flex items-center justify-between gap-4">
          {/* Conteúdo principal */}
          <Link
            href="/getting-started"
            className="flex items-center gap-3 flex-1 min-w-0 group"
          >
            {/* Ícone */}
            <div className="flex-shrink-0 w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Rocket className="h-4 w-4 text-white" />
            </div>

            {/* Texto e progresso */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">
                  Complete seu onboarding
                </span>
                <span className="text-xs text-gray-500">
                  {completedCount} de {totalCount} etapas
                </span>
              </div>

              {/* Barra de progresso */}
              <div className="mt-1 w-full max-w-xs h-1.5 bg-primary-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* CTA */}
            <div className="flex-shrink-0 flex items-center gap-1 text-sm text-primary font-medium group-hover:text-primary-700">
              <span className="hidden sm:inline">Continuar</span>
              <ChevronRight className="h-4 w-4" />
            </div>
          </Link>

          {/* Botão de fechar */}
          <button
            onClick={(e) => {
              e.preventDefault();
              handleDismiss();
            }}
            className="flex-shrink-0 p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-primary-200/50 transition-colors"
            aria-label="Fechar banner de onboarding"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default OnboardingBanner;
