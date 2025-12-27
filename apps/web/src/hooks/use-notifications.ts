/**
 * Hooks para Notificações Web
 *
 * React Query hooks com polling otimizado:
 * - Só faz polling quando a aba está visível
 * - Cache e deduplicação automática
 * - Invalidação ao marcar como lido
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  notificationsService,
  NotificationItem,
  NotificationsResponse,
} from '@/services/notifications.service';

const POLLING_INTERVAL = 30000; // 30 segundos

/**
 * Hook para verificar se a aba está visível
 */
function usePageVisibility() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(document.visibilityState === 'visible');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return isVisible;
}

/**
 * Hook para obter contagem de não lidas (usado para badge)
 * Faz polling apenas quando a aba está visível
 */
export function useUnreadCount() {
  const isVisible = usePageVisibility();

  return useQuery<number>({
    queryKey: ['notifications', 'unread-count'],
    queryFn: notificationsService.getUnreadCount,
    staleTime: 10000, // 10 segundos
    refetchInterval: isVisible ? POLLING_INTERVAL : false,
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook para listar notificações
 */
export function useNotifications(params?: {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
}) {
  return useQuery<NotificationsResponse>({
    queryKey: ['notifications', 'list', params],
    queryFn: () => notificationsService.getNotifications(params),
    staleTime: 15000, // 15 segundos
  });
}

/**
 * Hook para marcar notificação como lida
 */
export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) =>
      notificationsService.markAsRead(notificationId),
    onSuccess: () => {
      // Invalida as queries para atualizar a UI
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

/**
 * Hook para marcar todas como lidas
 */
export function useMarkAllAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: notificationsService.markAllAsRead,
    onSuccess: () => {
      // Invalida as queries para atualizar a UI
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

/**
 * Hook combinado para o dropdown de notificações
 * Retorna tudo que é necessário para o componente
 */
export function useNotificationDropdown() {
  const {
    data: unreadCount = 0,
    isLoading: isLoadingCount,
  } = useUnreadCount();

  const {
    data: notificationsData,
    isLoading: isLoadingList,
    refetch: refetchList,
  } = useNotifications({ limit: 10 });

  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();

  return {
    unreadCount,
    notifications: notificationsData?.data || [],
    isLoading: isLoadingCount || isLoadingList,
    markAsRead: markAsRead.mutate,
    markAllAsRead: markAllAsRead.mutate,
    isMarkingRead: markAsRead.isPending,
    isMarkingAllRead: markAllAsRead.isPending,
    refetch: refetchList,
  };
}
