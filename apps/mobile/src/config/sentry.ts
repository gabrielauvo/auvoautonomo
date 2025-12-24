import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function initSentry() {
  if (!SENTRY_DSN) {
    console.warn('[Sentry] DSN not configured, skipping initialization');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,

    // Environment based on expo config
    environment: process.env.EXPO_PUBLIC_ENV || 'development',

    // App version from app.json
    release: `${Constants.expoConfig?.slug}@${Constants.expoConfig?.version}`,

    // Sample rate for performance monitoring (1.0 = 100%)
    tracesSampleRate: process.env.EXPO_PUBLIC_ENV === 'production' ? 0.2 : 1.0,

    // Enable debug in development
    debug: process.env.EXPO_PUBLIC_ENV !== 'production',

    // Automatically capture unhandled errors
    enableAutoSessionTracking: true,

    // Session timeout in milliseconds
    sessionTrackingIntervalMillis: 30000,

    // Attach stack traces to all messages
    attachStacktrace: true,

    // Before sending event, you can modify or filter it
    beforeSend(event) {
      // Filter out development errors if needed
      if (process.env.EXPO_PUBLIC_ENV !== 'production') {
        // In development, log to console instead of sending
        console.log('[Sentry Event]', event.message || event.exception);
      }
      return event;
    },
  });
}

// Helper to capture exceptions with additional context
export function captureException(error: Error, context?: Record<string, unknown>) {
  Sentry.captureException(error, {
    extra: context,
  });
}

// Helper to capture messages
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
  Sentry.captureMessage(message, level);
}

// Helper to set user context
export function setUser(user: { id: string; email?: string; name?: string } | null) {
  if (user) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.name,
    });
  } else {
    Sentry.setUser(null);
  }
}

// Helper to add breadcrumb
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, unknown>
) {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
  });
}

// Export Sentry for direct access if needed
export { Sentry };
