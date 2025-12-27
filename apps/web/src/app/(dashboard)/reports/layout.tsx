'use client';

/**
 * Reports Layout
 *
 * Layout compartilhado para todas as páginas de relatórios
 * Inclui navegação lateral com links para cada relatório
 */

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout';
import { useTranslations } from '@/i18n';
import {
  BarChart3,
  DollarSign,
  FileText,
  Wrench,
  Users,
  Tag,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReportsLayoutProps {
  children: React.ReactNode;
}

export default function ReportsLayout({ children }: ReportsLayoutProps) {
  const pathname = usePathname();
  const { t, locale } = useTranslations('reports');

  const REPORT_LINKS = useMemo(() => [
    {
      href: '/reports',
      label: t('overview'),
      icon: BarChart3,
    },
    {
      href: '/reports/finance',
      label: t('finance'),
      icon: DollarSign,
    },
    {
      href: '/reports/sales',
      label: t('sales'),
      icon: FileText,
    },
    {
      href: '/reports/operations',
      label: t('operations'),
      icon: Wrench,
    },
    {
      href: '/reports/services',
      label: t('services'),
      icon: Tag,
    },
    {
      href: '/reports/clients',
      label: t('clients'),
      icon: Users,
    },
  ], [t, locale]);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="page-header">
          <h1 className="page-title">{t('title')}</h1>
          <p className="page-subtitle">
            {t('subtitle')}
          </p>
        </div>

        {/* Navigation Tabs */}
        <nav className="border-b border-gray-200">
          <div className="flex gap-1 -mb-px">
            {REPORT_LINKS.map((link) => {
              const isActive = pathname === link.href;
              const Icon = link.icon;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                    isActive
                      ? 'text-primary border-primary'
                      : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Content */}
        {children}
      </div>
    </AppLayout>
  );
}
