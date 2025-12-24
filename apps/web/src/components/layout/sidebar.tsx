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
  Gift,
  TrendingUp,
} from 'lucide-react';

// Mapeamento de ícones por labelKey
const iconMap: Record<string, React.ReactNode> = {
  dashboard: <LayoutDashboard className="h-5 w-5" />,
  schedule: <Calendar className="h-5 w-5" />,
  workOrders: <Wrench className="h-5 w-5" />,
  clients: <Users className="h-5 w-5" />,
  catalog: <Package className="h-5 w-5" />,
  inventory: <Warehouse className="h-5 w-5" />,
  suppliers: <Building2 className="h-5 w-5" />,
  quotes: <FileText className="h-5 w-5" />,
  expenses: <Receipt className="h-5 w-5" />,
  billing: <CreditCard className="h-5 w-5" />,
  growth: <TrendingUp className="h-5 w-5" />,
  reports: <BarChart3 className="h-5 w-5" />,
};

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
  { labelKey: 'growth', href: '/growth' },
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

  // Renderiza um item de navegação (simples ou subitem)
  const renderNavItem = (item: NavItem, isSubItem: boolean = false) => {
    const active = isActive(item.href);
    const label = t(item.labelKey);
    const icon = iconMap[item.labelKey];

    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          'group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
          active
            ? 'bg-primary text-white shadow-auvo hover:bg-primary-600'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
          isSubItem && !collapsed && 'ml-2'
        )}
        title={collapsed ? label : undefined}
      >
        <span className={cn(
          'transition-colors duration-200 flex-shrink-0',
          active ? 'text-white' : 'text-gray-500 group-hover:text-gray-900'
        )}>
          {icon}
        </span>
        {!collapsed && (
          <span className="font-medium">{label}</span>
        )}
      </Link>
    );
  };

  return (
    <aside
      role="navigation"
      aria-label="Menu principal"
      className={cn(
        'flex flex-col h-screen bg-white border-r border-gray-200 transition-all duration-300',
        collapsed ? 'w-16' : 'w-64',
        className
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="text-2xl font-bold text-gradient-auvo">Auvo</span>
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500"
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
          {menuStructure.map((item) => {
            if (isNavGroup(item)) {
              // Renderiza grupo com subitens
              const groupActive = isGroupActive(item);
              return (
                <li key={item.labelKey}>
                  {/* Label do grupo */}
                  {!collapsed && (
                    <div className="px-3 pt-4 pb-2 first:pt-0">
                      <span className={cn(
                        'text-xs font-semibold uppercase tracking-wider',
                        groupActive ? 'text-gray-900' : 'text-gray-400'
                      )}>
                        {t(item.labelKey)}
                      </span>
                    </div>
                  )}
                  {/* Subitens */}
                  <ul className="space-y-1">
                    {item.items.map((subItem) => (
                      <li key={subItem.href}>
                        {renderNavItem(subItem, true)}
                      </li>
                    ))}
                  </ul>
                </li>
              );
            } else {
              // Renderiza item simples
              return (
                <li key={item.href}>
                  {renderNavItem(item)}
                </li>
              );
            }
          })}
        </ul>
      </nav>

      {/* Indique e Ganhe */}
      <div className="px-2 pb-2">
        <Link
          href="/referral"
          className={cn(
            'group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
            pathname === '/referral'
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg'
              : 'bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 hover:from-amber-100 hover:to-orange-100 border border-amber-200'
          )}
          title={collapsed ? t('referral') : undefined}
        >
          <span className={cn(
            'transition-colors duration-200 flex-shrink-0',
            pathname === '/referral' ? 'text-white' : 'text-amber-600'
          )}>
            <Gift className="h-5 w-5" />
          </span>
          {!collapsed && (
            <span className="font-medium">{t('referral')}</span>
          )}
        </Link>
      </div>

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
            'transition-colors duration-200 flex-shrink-0',
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
        <div className="p-4 border-t border-gray-200">
          <p className="text-xs text-gray-400 text-center">
            &copy; {new Date().getFullYear()} Auvo
          </p>
        </div>
      )}
    </aside>
  );
}

export default Sidebar;
