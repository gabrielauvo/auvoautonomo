'use client';

/**
 * Header - Barra superior da aplicação
 *
 * Contém:
 * - Nome do usuário
 * - Badge do plano
 * - Botão de logout
 * - Menu de usuário
 * - Dropdown de notificações (integrado com API)
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/auth-context';
import { Badge, Avatar } from '@/components/ui';
import { LogOut, User, Settings, ChevronDown, Bell, CreditCard, FileText, CheckCircle, AlertCircle, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations, useLocale } from '@/i18n';
import { useNotificationDropdown } from '@/hooks/use-notifications';
import type { NotificationItem } from '@/services/notifications.service';

interface HeaderProps {
  className?: string;
}

export function Header({ className }: HeaderProps) {
  const { user, billing, logout, isLoading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const { t: tNav } = useTranslations('navigation');
  const { t: tAuth } = useTranslations('auth');
  const { t: tCommon } = useTranslations('common');
  const { locale } = useLocale();

  // Hook de notificações com polling
  const {
    unreadCount,
    notifications,
    isLoading: isLoadingNotifications,
    markAsRead,
    markAllAsRead,
    isMarkingAllRead,
  } = useNotificationDropdown();

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

  // Formata tempo relativo
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return locale === 'pt-BR' ? 'agora' : 'now';
    if (diffMins < 60) return locale === 'pt-BR' ? `${diffMins} min atrás` : `${diffMins} min ago`;
    if (diffHours < 24) return locale === 'pt-BR' ? `${diffHours}h atrás` : `${diffHours}h ago`;
    if (diffDays < 7) return locale === 'pt-BR' ? `${diffDays}d atrás` : `${diffDays}d ago`;
    return date.toLocaleDateString(locale);
  };

  // Ícone baseado no tipo de notificação
  const getNotificationIcon = (type: string) => {
    if (type.includes('QUOTE')) return <FileText className="h-4 w-4 text-primary" />;
    if (type.includes('WORK_ORDER')) return <CheckCircle className="h-4 w-4 text-success" />;
    if (type.includes('PAYMENT')) return <AlertCircle className="h-4 w-4 text-warning" />;
    return <Bell className="h-4 w-4 text-gray-500" />;
  };

  // Título baseado no tipo de notificação
  const getNotificationTitle = (notification: NotificationItem) => {
    if (notification.subject) return notification.subject;
    const typeMap: Record<string, string> = {
      QUOTE_SENT: locale === 'pt-BR' ? 'Orçamento enviado' : 'Quote sent',
      QUOTE_APPROVED: locale === 'pt-BR' ? 'Orçamento aprovado' : 'Quote approved',
      QUOTE_REJECTED: locale === 'pt-BR' ? 'Orçamento recusado' : 'Quote rejected',
      WORK_ORDER_CREATED: locale === 'pt-BR' ? 'Nova OS criada' : 'Work order created',
      WORK_ORDER_COMPLETED: locale === 'pt-BR' ? 'OS finalizada' : 'Work order completed',
      PAYMENT_RECEIVED: locale === 'pt-BR' ? 'Pagamento recebido' : 'Payment received',
      PAYMENT_OVERDUE: locale === 'pt-BR' ? 'Pagamento atrasado' : 'Payment overdue',
    };
    return typeMap[notification.type] || notification.type;
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
  };

  // Badge do plano - mostra status baseado no subscriptionStatus
  const getPlanBadge = () => {
    const status = billing?.subscriptionStatus;
    const planKey = billing?.planKey;

    // Se está em trial, mostra TRIAL
    if (status === 'TRIALING') {
      return (
        <Badge variant="warning" size="sm">
          TRIAL
        </Badge>
      );
    }

    // Se está ativo no PRO, mostra PRO
    if (status === 'ACTIVE' && planKey === 'PRO') {
      return (
        <Badge variant="success" size="sm">
          PRO
        </Badge>
      );
    }

    // Se expirou ou cancelou, mostra FREE
    return (
      <Badge variant="default" size="sm">
        FREE
      </Badge>
    );
  };

  return (
    <header
      role="banner"
      className={cn(
        'flex items-center justify-between h-16 px-6 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700',
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
            className="relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
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
            <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 animate-fade-in">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{tNav('notificationsTitle')}</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllAsRead()}
                    disabled={isMarkingAllRead}
                    className="text-xs text-primary hover:text-primary-dark disabled:opacity-50"
                  >
                    {isMarkingAllRead ? <Loader2 className="h-3 w-3 animate-spin" /> : tNav('markAllAsRead')}
                  </button>
                )}
              </div>

              {/* Lista de notificações */}
              <div className="max-h-80 overflow-y-auto">
                {isLoadingNotifications ? (
                  <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    <p className="text-sm">{tCommon('loading')}...</p>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">{tNav('noNotifications')}</p>
                  </div>
                ) : (
                  notifications.map(notification => (
                    <div
                      key={notification.id}
                      onClick={() => !notification.isRead && markAsRead(notification.id)}
                      className={cn(
                        'flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-50 dark:border-gray-700 last:border-0',
                        !notification.isRead && 'bg-primary-50/30 dark:bg-primary-900/20'
                      )}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          'text-sm',
                          notification.isRead ? 'text-gray-700 dark:text-gray-300' : 'text-gray-900 dark:text-gray-100 font-medium'
                        )}>
                          {getNotificationTitle(notification)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {notification.body}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatRelativeTime(notification.createdAt)}
                        </p>
                      </div>
                      {!notification.isRead && (
                        <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-2" />
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-2">
                <a
                  href="/settings/notifications"
                  className="text-xs text-primary hover:text-primary-dark block text-center"
                  onClick={() => setNotificationsOpen(false)}
                >
                  {tNav('viewAllNotifications')}
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Menu do usuário */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-3 p-1.5 pr-3 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <Avatar
              src={user?.avatarUrl || undefined}
              fallback={user?.name || tCommon('loading')}
              size="sm"
            />
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
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
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50 animate-fade-in">
              {/* Info do usuário */}
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user?.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
              </div>

              {/* Links */}
              <div className="py-1">
                <a
                  href="/settings/profile"
                  className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  onClick={() => setMenuOpen(false)}
                >
                  <User className="h-4 w-4" />
                  {tNav('profile')}
                </a>
                <a
                  href="/settings/plan"
                  className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  onClick={() => setMenuOpen(false)}
                >
                  <CreditCard className="h-4 w-4" />
                  {tNav('plan')}
                  {getPlanBadge()}
                </a>
                <a
                  href="/settings"
                  className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  onClick={() => setMenuOpen(false)}
                >
                  <Settings className="h-4 w-4" />
                  {tNav('settings')}
                </a>
              </div>

              {/* Logout */}
              <div className="border-t border-gray-100 dark:border-gray-700 py-1">
                <button
                  onClick={handleLogout}
                  disabled={isLoading}
                  className="flex items-center gap-3 w-full px-4 py-2 text-sm text-error hover:bg-error-50 dark:hover:bg-error-900/20"
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
