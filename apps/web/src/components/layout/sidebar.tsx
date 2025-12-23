'use client';

/**
 * Sidebar - Menu lateral da aplicação
 *
 * Contém:
 * - Logo
 * - Menu de navegação principal
 * - Indicador de rota ativa
 */

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/i18n';
import {
  LayoutDashboard,
  Users,
  FileText,
  Wrench,
  CreditCard,
  BarChart3,
  Calendar,
  Package,
  ChevronLeft,
  ChevronRight,
  Building2,
  Receipt,
  Warehouse,
  Rocket,
} from 'lucide-react';

interface NavItem {
  labelKey: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    labelKey: 'dashboard',
    href: '/dashboard',
    icon: <LayoutDashboard className="h-5 w-5" />,
  },
  {
    labelKey: 'schedule',
    href: '/schedule',
    icon: <Calendar className="h-5 w-5" />,
  },
  {
    labelKey: 'clients',
    href: '/clients',
    icon: <Users className="h-5 w-5" />,
  },
  {
    labelKey: 'quotes',
    href: '/quotes',
    icon: <FileText className="h-5 w-5" />,
  },
  {
    labelKey: 'workOrders',
    href: '/work-orders',
    icon: <Wrench className="h-5 w-5" />,
  },
  {
    labelKey: 'catalog',
    href: '/catalog',
    icon: <Package className="h-5 w-5" />,
  },
  {
    labelKey: 'inventory',
    href: '/inventory',
    icon: <Warehouse className="h-5 w-5" />,
  },
  {
    labelKey: 'billing',
    href: '/billing/charges',
    icon: <CreditCard className="h-5 w-5" />,
  },
  {
    labelKey: 'suppliers',
    href: '/suppliers',
    icon: <Building2 className="h-5 w-5" />,
  },
  {
    labelKey: 'expenses',
    href: '/expenses',
    icon: <Receipt className="h-5 w-5" />,
  },
  {
    labelKey: 'reports',
    href: '/reports',
    icon: <BarChart3 className="h-5 w-5" />,
  },
];

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { t } = useTranslations('navigation');

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  };

  return (
    <aside
      role="navigation"
      aria-label="Menu principal"
      className={cn(
        'flex flex-col h-screen bg-white dark:bg-black border-r border-gray-200 dark:border-neutral-800 transition-all duration-300',
        collapsed ? 'w-16' : 'w-64',
        className
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-neutral-800">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="text-2xl font-bold text-gradient-auvo">Auvo</span>
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-neutral-900 text-gray-500 dark:text-gray-400"
          title={collapsed ? t('expandMenu') : t('collapseMenu')}
        >
          {collapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <ChevronLeft className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Navegação */}
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-2">
          {navItems.map((item) => {
            const active = isActive(item.href);
            const label = t(item.labelKey);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                    active
                      ? 'bg-primary text-white shadow-auvo hover:bg-primary-600'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-900 hover:text-gray-900 dark:hover:text-gray-100'
                  )}
                  title={collapsed ? label : undefined}
                >
                  <span className={cn(
                    'transition-colors duration-200',
                    active ? 'text-white' : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100'
                  )}>
                    {item.icon}
                  </span>
                  {!collapsed && (
                    <span className="font-medium">{label}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Comece Aqui - Item fixo no rodapé */}
      <div className="px-2 pb-2">
        <Link
          href="/getting-started"
          className={cn(
            'group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
            pathname === '/getting-started'
              ? 'bg-gradient-to-r from-primary to-primary-600 text-white shadow-auvo'
              : 'bg-gradient-to-r from-primary-50 to-primary-100 text-primary hover:from-primary-100 hover:to-primary-200'
          )}
          title={collapsed ? t('gettingStarted') : undefined}
        >
          <span className={cn(
            'transition-colors duration-200',
            pathname === '/getting-started' ? 'text-white' : 'text-primary'
          )}>
            <Rocket className="h-5 w-5" />
          </span>
          {!collapsed && (
            <span className="font-medium">{t('gettingStarted')}</span>
          )}
        </Link>
      </div>

      {/* Footer */}
      {!collapsed && (
        <div className="p-4 border-t border-gray-200 dark:border-neutral-800">
          <p className="text-xs text-gray-400 text-center">
            &copy; {new Date().getFullYear()} Auvo
          </p>
        </div>
      )}
    </aside>
  );
}

export default Sidebar;
