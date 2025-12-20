'use client';

import { useCallback } from 'react';

interface ToastOptions {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive' | 'success';
  duration?: number;
}

interface UseToastReturn {
  toast: (options: ToastOptions) => void;
}

/**
 * Simple toast hook using browser notifications or console
 * Can be replaced with a proper toast library later (react-hot-toast, sonner, etc.)
 */
export function useToast(): UseToastReturn {
  const toast = useCallback((options: ToastOptions) => {
    const { title, description, variant } = options;

    // For now, just log to console - can be enhanced with a proper toast UI
    const message = description ? `${title}: ${description}` : title;

    if (variant === 'destructive') {
      console.error('[Toast Error]', message);
    } else if (variant === 'success') {
      console.log('[Toast Success]', message);
    } else {
      console.log('[Toast]', message);
    }

    // Optionally show browser notification if permission granted
    // This provides visible feedback to the user
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(title, { body: description });
      }
    }
  }, []);

  return { toast };
}

export default useToast;
