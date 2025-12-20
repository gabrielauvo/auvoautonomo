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
} from 'lucide-react';
import { AppLayout } from '@/components/layout';
import { Card } from '@/components/ui';
import { cn } from '@/lib/utils';

interface SettingsLayoutProps {
  children: React.ReactNode;
}

const SETTINGS_NAV = [
  {
    href: '/settings/account',
    label: 'Conta',
    icon: User,
    description: 'Nome, email e preferências',
  },
  {
    href: '/settings/company',
    label: 'Empresa',
    icon: Building2,
    description: 'Dados e identidade visual',
  },
  {
    href: '/settings/plan',
    label: 'Plano',
    icon: CreditCard,
    description: 'Assinatura e limites',
  },
  {
    href: '/settings/templates',
    label: 'Templates',
    icon: FileText,
    description: 'Personalizar documentos',
  },
  {
    href: '/checklists',
    label: 'Checklists',
    icon: ClipboardCheck,
    description: 'Templates de checklists',
  },
  {
    href: '/settings/integrations',
    label: 'Integrações',
    icon: Plug,
    description: 'Asaas e outros serviços',
  },
  {
    href: '/settings/notifications',
    label: 'Notificações',
    icon: Bell,
    description: 'Alertas e mensagens',
  },
  {
    href: '/settings/security',
    label: 'Segurança',
    icon: Shield,
    description: 'Senha e sessões',
  },
];

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  const pathname = usePathname();

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="page-header">
          <h1 className="page-title">Configurações</h1>
          <p className="page-subtitle">
            Gerencie sua conta, empresa e preferências
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
                        {item.label}
                      </p>
                      <p className="text-xs text-gray-500 truncate hidden sm:block lg:hidden xl:block">
                        {item.description}
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
