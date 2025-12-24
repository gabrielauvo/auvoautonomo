'use client';

/**
 * App Layout - Layout principal da aplicação (WCAG 2.1 AA)
 *
 * Combina:
 * - SkipLink para acessibilidade
 * - Sidebar (menu lateral) com role="navigation"
 * - Header (barra superior) com role="banner"
 * - Trial Banner (faixa de período de teste)
 * - Onboarding Banner (faixa de progresso)
 * - Área de conteúdo com role="main" e id para skip link
 */

import { ProtectedRoute } from '@/components/auth';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { OnboardingBanner } from './onboarding-banner';
import { TrialBanner } from './trial-banner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';

interface AppLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function AppLayout({ children, className }: AppLayoutProps) {
  const { billing } = useAuth();

  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-background overflow-hidden">
        {/* Sidebar - Navegação */}
        <Sidebar />

        {/* Main content */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Trial Banner - Aviso de período de teste */}
          <TrialBanner billing={billing} />

          {/* Header */}
          <Header />

          {/* Onboarding Banner */}
          <OnboardingBanner />

          {/* Page content - Main landmark */}
          <main
            id="main-content"
            className={cn(
              'flex-1 overflow-y-auto p-6',
              className
            )}
            role="main"
            aria-label="Conteúdo principal"
          >
            {children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}

export default AppLayout;
