'use client';

/**
 * Settings Layout
 *
 * Layout com sidebar de navegação para as páginas de configurações
 */

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  User,
  Building2,
  CreditCard,
  FileText,
  Bell,
  Shield,
  ClipboardCheck,
  Plug,
  Warehouse,
  Folder,
} from 'lucide-react';
import { AppLayout } from '@/components/layout';
import { Card } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/i18n';

interface SettingsLayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  href: string;
  labelKey: string;
  descriptionKey: string;
  icon: typeof User;
}

const SETTINGS_NAV: NavItem[] = [
  {
    href: '/settings/account',
    labelKey: 'account',
    descriptionKey: 'accountDescription',
    icon: User,
  },
  {
    href: '/settings/company',
    labelKey: 'company',
    descriptionKey: 'companyDescription',
    icon: Building2,
  },
  {
    href: '/settings/plan',
    labelKey: 'plan',
    descriptionKey: 'planDescription',
    icon: CreditCard,
  },
  {
    href: '/settings/templates',
    labelKey: 'templates',
    descriptionKey: 'templatesDescription',
    icon: FileText,
  },
  {
    href: '/checklists',
    labelKey: 'checklists',
    descriptionKey: 'checklistsDescription',
    icon: ClipboardCheck,
  },
  {
    href: '/settings/integrations',
    labelKey: 'integrations',
    descriptionKey: 'integrationsDescription',
    icon: Plug,
  },
  {
    href: '/settings/inventory',
    labelKey: 'inventory',
    descriptionKey: 'inventoryDescription',
    icon: Warehouse,
  },
  {
    href: '/expense-categories',
    labelKey: 'expenseCategories',
    descriptionKey: 'expenseCategoriesDescription',
    icon: Folder,
  },
  {
    href: '/settings/notifications',
    labelKey: 'notifications',
    descriptionKey: 'notificationsDescription',
    icon: Bell,
  },
  {
    href: '/settings/security',
    labelKey: 'security',
    descriptionKey: 'securityDescription',
    icon: Shield,
  },
];

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  const pathname = usePathname();
  const { t } = useTranslations('settings');

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

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <Card className="lg:col-span-1 h-fit">
            <nav className="p-2">
              {SETTINGS_NAV.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                      'hover:bg-gray-50',
                      isActive && 'bg-primary-50 text-primary hover:bg-primary-50'
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-5 w-5 flex-shrink-0',
                        isActive ? 'text-primary' : 'text-gray-400'
                      )}
                    />
                    <div className="min-w-0">
                      <p
                        className={cn(
                          'text-sm font-medium truncate',
                          isActive ? 'text-primary' : 'text-gray-700'
                        )}
                      >
                        {t(item.labelKey)}
                      </p>
                      <p className="text-xs text-gray-500 truncate hidden sm:block lg:hidden xl:block">
                        {t(item.descriptionKey)}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </nav>
          </Card>

          {/* Content */}
          <div className="lg:col-span-3">{children}</div>
        </div>
      </div>
    </AppLayout>
  );
}
