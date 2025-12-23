'use client';

/**
 * Sidebar - Menu lateral da aplicação
 *
 * Contém:
 * - Logo
 * - Menu de navegação com grupos e submenus
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

// Item simples do menu
interface NavItem {
  labelKey: string;
  href: string;
}

// Grupo com subitens
interface NavGroup {
  labelKey: string;
  items: NavItem[];
}

// Tipo união para itens do menu
type MenuItem = NavItem | NavGroup;

// Verifica se é um grupo
const isNavGroup = (item: MenuItem): item is NavGroup => {
  return 'items' in item;
};

// Estrutura do menu conforme a imagem
const menuStructure: MenuItem[] = [
  { labelKey: 'dashboard', href: '/dashboard' },
  { labelKey: 'schedule', href: '/schedule' },
  { labelKey: 'workOrders', href: '/work-orders' },
  {
    labelKey: 'cadastros',
    items: [
      { labelKey: 'clients', href: '/clients' },
      { labelKey: 'catalog', href: '/catalog' },
      { labelKey: 'inventory', href: '/inventory' },
      { labelKey: 'suppliers', href: '/suppliers' },
    ],
  },
  {
    labelKey: 'financeiro',
    items: [
      { labelKey: 'quotes', href: '/quotes' },
      { labelKey: 'expenses', href: '/expenses' },
      { labelKey: 'billing', href: '/billing/charges' },
    ],
  },
  { labelKey: 'reports', href: '/reports' },
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

  // Verifica se algum item do grupo está ativo
  const isGroupActive = (group: NavGroup) => {
    return group.items.some((item) => isActive(item.href));
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
        <div className="space-y-1 px-3">
          {menuStructure.map((item, index) => {
            if (isNavGroup(item)) {
              // Renderiza grupo com subitens
              const groupActive = isGroupActive(item);
              return (
                <div key={item.labelKey} className="pt-4 first:pt-0">
                  {/* Label do grupo */}
                  {!collapsed && (
                    <div className="px-3 mb-2">
                      <span className={cn(
                        'text-[13px] font-semibold uppercase tracking-wider',
                        groupActive ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'
                      )}>
                        {t(item.labelKey)}
                      </span>
                    </div>
                  )}
                  {/* Subitens */}
                  <ul className="space-y-0.5">
                    {item.items.map((subItem) => {
                      const active = isActive(subItem.href);
                      const label = t(subItem.labelKey);
                      return (
                        <li key={subItem.href}>
                          <Link
                            href={subItem.href}
                            className={cn(
                              'group flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition-all duration-200',
                              active
                                ? 'text-primary font-medium'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                            )}
                            title={collapsed ? label : undefined}
                          >
                            {!collapsed && (
                              <>
                                <span className="text-gray-300 dark:text-gray-600">-</span>
                                <span className="text-[14px]">{label}</span>
                              </>
                            )}
                            {collapsed && (
                              <span className="w-2 h-2 rounded-full bg-current mx-auto" />
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            } else {
              // Renderiza item simples
              const active = isActive(item.href);
              const label = t(item.labelKey);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'group flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200',
                    active
                      ? 'text-primary font-semibold'
                      : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                  )}
                  title={collapsed ? label : undefined}
                >
                  {!collapsed && (
                    <span className="text-[14px] font-medium">{label}</span>
                  )}
                  {collapsed && (
                    <span className={cn(
                      'w-2 h-2 rounded-full mx-auto',
                      active ? 'bg-primary' : 'bg-gray-400'
                    )} />
                  )}
                </Link>
              );
            }
          })}
        </div>
      </nav>

      {/* Relatórios com destaque */}
      {!collapsed && (
        <div className="px-3 pb-2">
          <div className="border-t border-dashed border-primary/30 pt-2">
            <span className="text-[13px] text-primary font-medium tracking-wide flex items-center gap-1">
              <span className="flex gap-0.5">
                {[...Array(12)].map((_, i) => (
                  <span key={i} className="w-1 h-1 rounded-full bg-primary/60" />
                ))}
              </span>
            </span>
          </div>
        </div>
      )}

      {/* Comece Aqui - Item fixo no rodapé */}
      <div className="px-3 pb-2">
        <Link
          href="/getting-started"
          className={cn(
            'group flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200',
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
            <Rocket className="h-[18px] w-[18px]" />
          </span>
          {!collapsed && (
            <span className="text-[14px] font-medium">{t('gettingStarted')}</span>
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
