'use client';

/**
 * SkipLink Component - Acessibilidade
 *
 * Link "Pular para conteúdo principal" visível apenas ao receber foco via teclado.
 * Essencial para navegação por teclado segundo WCAG 2.1 AA.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SkipLinkProps {
  href?: string;
  children?: React.ReactNode;
  className?: string;
}

export function SkipLink({
  href = '#main-content',
  children = 'Pular para conteúdo principal',
  className
}: SkipLinkProps) {
  return (
    <a
      href={href}
      className={cn(
        // Escondido por padrão
        'sr-only',
        // Visível quando focado
        'focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50',
        // Estilo visual
        'focus:bg-primary focus:text-white focus:px-4 focus:py-2 focus:rounded-lg',
        'focus:font-medium focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary-400',
        // Transição suave
        'transition-all duration-200',
        className
      )}
    >
      {children}
    </a>
  );
}

SkipLink.displayName = 'SkipLink';
