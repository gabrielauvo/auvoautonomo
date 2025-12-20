'use client';

/**
 * App Layout - Layout principal da aplicação (WCAG 2.1 AA)
 *
 * Combina:
 * - SkipLink para acessibilidade
 * - Sidebar (menu lateral) com role="navigation"
 * - Header (barra superior) com role="banner"
 * - Área de conteúdo com role="main" e id para skip link
 */

import { ProtectedRoute } from '@/components/auth';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function AppLayout({ children, className }: AppLayoutProps) {
  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-background overflow-hidden">
        {/* Sidebar - Navegação */}
        <Sidebar />

        {/* Main content */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Header */}
          <Header />

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
