'use client';

/**
 * Header - Barra superior da aplicação
 *
 * Contém:
 * - Nome do usuário
 * - Badge do plano
 * - Botão de logout
 * - Menu de usuário
 * - Dropdown de notificações
 */

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import { Badge, Avatar } from '@/components/ui';
import { LogOut, User, Settings, ChevronDown, Bell, CreditCard, FileText, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/i18n';

interface HeaderProps {
  className?: string;
}

// Tipos de notificação
interface Notification {
  id: string;
  type: 'quote' | 'service_order' | 'payment' | 'system';
  title: string;
  message: string;
  time: string;
  read: boolean;
}

// Notificações mockadas (depois integrar com API)
const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'quote',
    title: 'Orçamento aprovado',
    message: 'O cliente João Silva aprovou o orçamento #1234',
    time: '5 min atrás',
    read: false,
  },
  {
    id: '2',
    type: 'service_order',
    title: 'Nova OS criada',
    message: 'Ordem de serviço #5678 foi criada',
    time: '1 hora atrás',
    read: false,
  },
  {
    id: '3',
    type: 'payment',
    title: 'Pagamento recebido',
    message: 'Pagamento de R$ 1.500,00 confirmado',
    time: '2 horas atrás',
    read: true,
  },
];

export function Header({ className }: HeaderProps) {
  const { user, billing, logout, isLoading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);
  const menuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const { t: tNav } = useTranslations('navigation');
  const { t: tAuth } = useTranslations('auth');
  const { t: tCommon } = useTranslations('common');

  const unreadCount = notifications.filter(n => !n.read).length;

  // Fecha menus ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'quote':
        return <FileText className="h-4 w-4 text-primary" />;
      case 'service_order':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'payment':
        return <AlertCircle className="h-4 w-4 text-warning" />;
      default:
        return <Bell className="h-4 w-4 text-gray-500" />;
    }
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
  };

  // Badge do plano
  const getPlanBadge = () => {
    const planKey = billing?.planKey || 'FREE';
    const variants: Record<string, 'default' | 'secondary' | 'success'> = {
      FREE: 'default',
      PRO: 'success',
      TEAM: 'secondary',
    };
    return (
      <Badge variant={variants[planKey] || 'default'} size="sm">
        {planKey}
      </Badge>
    );
  };

  return (
    <header
      role="banner"
      className={cn(
        'flex items-center justify-between h-16 px-6 bg-white border-b border-gray-200',
        className
      )}
    >
      {/* Lado esquerdo - pode ter breadcrumb ou título */}
      <div className="flex items-center gap-4">
        {/* Espaço para breadcrumb ou título da página */}
      </div>

      {/* Lado direito */}
      <div className="flex items-center gap-4">
        {/* Notificações */}
        <div className="relative" ref={notificationsRef}>
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="relative p-2 rounded-full hover:bg-gray-100 text-gray-500"
            title={tNav('notifications')}
          >
            <Bell className="h-5 w-5" />
            {/* Badge de notificação */}
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-error rounded-full" />
            )}
          </button>

          {/* Dropdown de notificações */}
          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 animate-fade-in">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">Notificações</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-primary hover:text-primary-dark"
                  >
                    Marcar todas como lidas
                  </button>
                )}
              </div>

              {/* Lista de notificações */}
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-gray-500">
                    <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhuma notificação</p>
                  </div>
                ) : (
                  notifications.map(notification => (
                    <div
                      key={notification.id}
                      onClick={() => markAsRead(notification.id)}
                      className={cn(
                        'flex items-start gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0',
                        !notification.read && 'bg-primary-50/30'
                      )}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          'text-sm',
                          notification.read ? 'text-gray-700' : 'text-gray-900 font-medium'
                        )}>
                          {notification.title}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {notification.time}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-2" />
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-gray-100 px-4 py-2">
                <a
                  href="/settings/notifications"
                  className="text-xs text-primary hover:text-primary-dark block text-center"
                  onClick={() => setNotificationsOpen(false)}
                >
                  Ver todas as notificações
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Menu do usuário */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-3 p-1.5 pr-3 rounded-full hover:bg-gray-100 transition-colors"
          >
            <Avatar
              src={user?.avatarUrl || undefined}
              fallback={user?.name || tCommon('loading')}
              size="sm"
            />
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-gray-900">
                {user?.name || tCommon('loading')}
              </p>
              <div className="flex items-center gap-2">
                {getPlanBadge()}
              </div>
            </div>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-gray-400 transition-transform',
                menuOpen && 'rotate-180'
              )}
            />
          </button>

          {/* Dropdown menu */}
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 animate-fade-in">
              {/* Info do usuário */}
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>

              {/* Links */}
              <div className="py-1">
                <a
                  href="/settings/profile"
                  className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => setMenuOpen(false)}
                >
                  <User className="h-4 w-4" />
                  {tNav('profile')}
                </a>
                <a
                  href="/settings/plan"
                  className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => setMenuOpen(false)}
                >
                  <CreditCard className="h-4 w-4" />
                  {tNav('plan')}
                  {getPlanBadge()}
                </a>
                <a
                  href="/settings"
                  className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => setMenuOpen(false)}
                >
                  <Settings className="h-4 w-4" />
                  {tNav('settings')}
                </a>
              </div>

              {/* Logout */}
              <div className="border-t border-gray-100 py-1">
                <button
                  onClick={handleLogout}
                  disabled={isLoading}
                  className="flex items-center gap-3 w-full px-4 py-2 text-sm text-error hover:bg-error-50"
                >
                  <LogOut className="h-4 w-4" />
                  {isLoading ? `${tAuth('logout')}...` : tAuth('logout')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
