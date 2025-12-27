/**
 * Notifications Service
 *
 * Service for fetching and managing user notifications.
 * Used by the NotificationDropdown component in the header.
 */

import api, { getErrorMessage } from './api';

export interface NotificationItem {
  id: string;
  type: string;
  channel: string;
  subject: string | null;
  body: string;
  payload: Record<string, unknown> | null;
  readAt: string | null;
  isRead: boolean;
  createdAt: string;
  client: {
    id: string;
    name: string;
  } | null;
}

export interface NotificationsResponse {
  data: NotificationItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    unreadCount: number;
  };
}

export interface UnreadCountResponse {
  unreadCount: number;
}

/**
 * Get user notifications with pagination
 */
export async function getNotifications(params?: {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
}): Promise<NotificationsResponse> {
  try {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.set('page', String(params.page));
    if (params?.limit) queryParams.set('limit', String(params.limit));
    if (params?.unreadOnly) queryParams.set('unreadOnly', 'true');

    const response = await api.get<NotificationsResponse>(
      `/notifications?${queryParams.toString()}`
    );
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Get unread notifications count (lightweight for polling)
 */
export async function getUnreadCount(): Promise<number> {
  try {
    const response = await api.get<UnreadCountResponse>('/notifications/unread-count');
    return response.data.unreadCount;
  } catch (error) {
    console.error('Error fetching unread count:', error);
    return 0;
  }
}

/**
 * Mark a notification as read
 */
export async function markAsRead(notificationId: string): Promise<boolean> {
  try {
    const response = await api.patch<{ success: boolean }>(
      `/notifications/${notificationId}/read`
    );
    return response.data.success;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return false;
  }
}

/**
 * Mark all notifications as read
 */
export async function markAllAsRead(): Promise<number> {
  try {
    const response = await api.post<{ success: boolean; count: number }>(
      '/notifications/mark-all-read'
    );
    return response.data.count;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return 0;
  }
}

export const notificationsService = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
};

export default notificationsService;
