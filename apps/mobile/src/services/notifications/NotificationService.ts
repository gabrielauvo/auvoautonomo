// @ts-nocheck
/**
 * Notification Service
 *
 * Gerencia push notifications usando Expo Notifications.
 *
 * Responsabilidades:
 * - Solicitar permissao de notificacoes
 * - Obter Expo Push Token
 * - Registrar/desregistrar device no backend
 * - Lidar com notificacoes recebidas
 * - Trigger re-sync baseado no payload
 *
 * IMPORTANTE: Push NAO substitui sync. Push apenas notifica
 * que existe uma mudanca. O app decide o que re-sincronizar.
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PushNotificationPayload,
  DeviceRegistrationRequest,
  DeviceRegistrationResponse,
  NotificationHandler,
  NotificationHandlerOptions,
} from './types';

// =============================================================================
// CONSTANTS
// =============================================================================

const STORAGE_KEYS = {
  PUSH_TOKEN: '@notification:push_token',
  DEVICE_ID: '@notification:device_id',
  PERMISSION_REQUESTED: '@notification:permission_requested',
};

// =============================================================================
// NOTIFICATION SERVICE
// =============================================================================

// Flag to track if handler is configured
let notificationHandlerConfigured = false;

function configureNotificationHandler() {
  if (notificationHandlerConfigured) return;

  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      }),
    });
    notificationHandlerConfigured = true;
  } catch (error) {
    console.warn('[NotificationService] Failed to configure handler:', error);
  }
}

class NotificationServiceClass {
  private expoPushToken: string | null = null;
  private deviceId: string | null = null;
  private apiBaseUrl: string | null = null;
  private authToken: string | null = null;

  private notificationListener: Notifications.Subscription | null = null;
  private responseListener: Notifications.Subscription | null = null;

  private handlers: NotificationHandlerOptions = {};

  /**
   * Configurar o servico com URL da API e token de autenticacao
   */
  configure(apiBaseUrl: string, authToken: string): void {
    this.apiBaseUrl = apiBaseUrl;
    this.authToken = authToken;
  }

  /**
   * Definir handlers para notificacoes
   */
  setHandlers(handlers: NotificationHandlerOptions): void {
    this.handlers = handlers;
  }

  /**
   * Inicializar o servico de notificacoes
   * Deve ser chamado apos login do usuario
   */
  async initialize(): Promise<boolean> {
    try {
      // 0. Configure notification handler (moved from top-level to avoid crash)
      configureNotificationHandler();

      // 1. Verificar se e dispositivo fisico
      if (!Device.isDevice) {
        console.log('[NotificationService] Must use physical device for push notifications');
        return false;
      }

      // 2. Verificar/solicitar permissao
      const hasPermission = await this.checkAndRequestPermission();
      if (!hasPermission) {
        console.log('[NotificationService] Permission denied');
        return false;
      }

      // 3. Obter token
      const token = await this.getExpoPushToken();
      if (!token) {
        console.log('[NotificationService] Failed to get push token');
        return false;
      }

      this.expoPushToken = token;

      // 4. Registrar device no backend
      await this.registerDevice();

      // 5. Configurar listeners
      this.setupListeners();

      // 6. Configurar Android notification channel
      if (Platform.OS === 'android') {
        await this.setupAndroidChannel();
      }

      console.log('[NotificationService] Initialized successfully');
      return true;
    } catch (error) {
      console.error('[NotificationService] Initialization failed:', error);
      return false;
    }
  }

  /**
   * Desregistrar device (logout)
   */
  async unregister(): Promise<void> {
    try {
      if (this.deviceId && this.apiBaseUrl && this.authToken) {
        await fetch(`${this.apiBaseUrl}/devices/${this.deviceId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${this.authToken}`,
          },
        });
      }

      // Limpar listeners
      if (this.notificationListener) {
        Notifications.removeNotificationSubscription(this.notificationListener);
      }
      if (this.responseListener) {
        Notifications.removeNotificationSubscription(this.responseListener);
      }

      // Limpar storage
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.PUSH_TOKEN,
        STORAGE_KEYS.DEVICE_ID,
      ]);

      this.expoPushToken = null;
      this.deviceId = null;

      console.log('[NotificationService] Unregistered successfully');
    } catch (error) {
      console.error('[NotificationService] Unregister failed:', error);
    }
  }

  /**
   * Obter o push token atual
   */
  getToken(): string | null {
    return this.expoPushToken;
  }

  /**
   * Verificar se tem permissao para notificacoes
   */
  async hasPermission(): Promise<boolean> {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  /**
   * Verificar e solicitar permissao
   */
  private async checkAndRequestPermission(): Promise<boolean> {
    // Verificar status atual
    const { status: existingStatus } = await Notifications.getPermissionsAsync();

    if (existingStatus === 'granted') {
      return true;
    }

    // Verificar se ja solicitamos antes
    const alreadyRequested = await AsyncStorage.getItem(STORAGE_KEYS.PERMISSION_REQUESTED);

    if (existingStatus === 'denied' && alreadyRequested) {
      // Usuario ja negou e ja pedimos antes - nao pedir de novo
      return false;
    }

    // Solicitar permissao
    const { status } = await Notifications.requestPermissionsAsync();
    await AsyncStorage.setItem(STORAGE_KEYS.PERMISSION_REQUESTED, 'true');

    return status === 'granted';
  }

  /**
   * Obter Expo Push Token
   */
  private async getExpoPushToken(): Promise<string | null> {
    try {
      // Verificar se temos token em cache
      const cachedToken = await AsyncStorage.getItem(STORAGE_KEYS.PUSH_TOKEN);

      // Obter novo token
      const projectId = Constants.expoConfig?.extra?.eas?.projectId ||
                        Constants.easConfig?.projectId;

      if (!projectId) {
        console.warn('[NotificationService] No projectId found');
        // Fallback para desenvolvimento
        const token = (await Notifications.getExpoPushTokenAsync()).data;
        await AsyncStorage.setItem(STORAGE_KEYS.PUSH_TOKEN, token);
        return token;
      }

      const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

      // Verificar se token mudou
      if (cachedToken && cachedToken !== token) {
        console.log('[NotificationService] Token changed, will refresh');
        await this.refreshToken(cachedToken, token);
      }

      await AsyncStorage.setItem(STORAGE_KEYS.PUSH_TOKEN, token);
      return token;
    } catch (error) {
      console.error('[NotificationService] Failed to get push token:', error);
      return null;
    }
  }

  /**
   * Registrar device no backend
   */
  private async registerDevice(): Promise<void> {
    if (!this.expoPushToken || !this.apiBaseUrl || !this.authToken) {
      throw new Error('NotificationService not configured');
    }

    const request: DeviceRegistrationRequest = {
      expoPushToken: this.expoPushToken,
      platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
      appVersion: Constants.expoConfig?.version,
      deviceModel: Device.modelName || undefined,
      osVersion: Device.osVersion || undefined,
    };

    const response = await fetch(`${this.apiBaseUrl}/devices/register`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Device registration failed: ${response.status}`);
    }

    const data: DeviceRegistrationResponse = await response.json();
    this.deviceId = data.id;
    await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_ID, data.id);

    console.log(`[NotificationService] Device registered: ${data.id}`);
  }

  /**
   * Atualizar token no backend (quando muda)
   */
  private async refreshToken(oldToken: string, newToken: string): Promise<void> {
    if (!this.apiBaseUrl || !this.authToken) {
      return;
    }

    try {
      await fetch(`${this.apiBaseUrl}/devices/refresh-token`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ oldToken, newToken }),
      });

      console.log('[NotificationService] Token refreshed');
    } catch (error) {
      console.error('[NotificationService] Token refresh failed:', error);
    }
  }

  /**
   * Configurar listeners para notificacoes
   */
  private setupListeners(): void {
    // Listener para quando recebe notificacao (app em foreground)
    this.notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('[NotificationService] Notification received:', notification);

        const payload = this.extractPayload(notification);
        if (payload && this.handlers.onForeground) {
          this.handlers.onForeground(payload);
        }
      }
    );

    // Listener para quando usuario toca na notificacao
    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log('[NotificationService] Notification tapped:', response);

        const payload = this.extractPayload(response.notification);
        if (payload && this.handlers.onTap) {
          this.handlers.onTap(payload);
        }
      }
    );
  }

  /**
   * Extrair payload da notificacao
   */
  private extractPayload(notification: Notifications.Notification): PushNotificationPayload | null {
    try {
      const data = notification.request.content.data;
      if (!data || !data.eventType) {
        return null;
      }
      return data as PushNotificationPayload;
    } catch {
      return null;
    }
  }

  /**
   * Configurar Android notification channel
   */
  private async setupAndroidChannel(): Promise<void> {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#7C3AED',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
    });
  }

  /**
   * Obter a ultima notificacao que abriu o app
   * (para deep linking quando app estava fechado)
   */
  async getLastNotificationResponse(): Promise<PushNotificationPayload | null> {
    const response = await Notifications.getLastNotificationResponseAsync();
    if (!response) {
      return null;
    }
    return this.extractPayload(response.notification);
  }

  /**
   * Limpar badge count
   */
  async clearBadge(): Promise<void> {
    await Notifications.setBadgeCountAsync(0);
  }

  /**
   * Definir badge count
   */
  async setBadge(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(count);
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

export const NotificationService = new NotificationServiceClass();

export default NotificationService;
