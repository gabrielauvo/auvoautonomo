/**
 * Auth Service
 *
 * Serviço de autenticação com armazenamento seguro.
 */

import * as SecureStore from 'expo-secure-store';
import { fetchWithTimeout } from '../utils/fetch-with-timeout';

// =============================================================================
// CONSTANTS
// =============================================================================

const KEYS = {
  ACCESS_TOKEN: 'auth_access_token',
  REFRESH_TOKEN: 'auth_refresh_token',
  USER_ID: 'auth_user_id',
  USER_EMAIL: 'auth_user_email',
  USER_NAME: 'auth_user_name',
  TECHNICIAN_ID: 'auth_technician_id',
  AVATAR_URL: 'auth_avatar_url',
} as const;

// =============================================================================
// TYPES
// =============================================================================

export interface User {
  id: string;
  email: string;
  name: string;
  technicianId: string;
  avatarUrl?: string | null;
  phone?: string | null;
  language?: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

// =============================================================================
// AUTH SERVICE
// =============================================================================

export const AuthService = {
  /**
   * Salvar tokens de autenticação
   */
  async saveTokens(tokens: AuthTokens): Promise<void> {
    // SecureStore only accepts strings - ensure all values are strings
    await Promise.all([
      SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, String(tokens.accessToken || '')),
      SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, String(tokens.refreshToken || '')),
    ]);
  },

  /**
   * Buscar access token
   */
  async getAccessToken(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.ACCESS_TOKEN);
  },

  /**
   * Buscar refresh token
   */
  async getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.REFRESH_TOKEN);
  },

  /**
   * Salvar dados do usuário
   */
  async saveUser(user: User): Promise<void> {
    // SecureStore only accepts strings - ensure all values are strings
    await Promise.all([
      SecureStore.setItemAsync(KEYS.USER_ID, String(user.id || '')),
      SecureStore.setItemAsync(KEYS.USER_EMAIL, String(user.email || '')),
      SecureStore.setItemAsync(KEYS.USER_NAME, String(user.name || '')),
      SecureStore.setItemAsync(KEYS.TECHNICIAN_ID, String(user.technicianId || user.id || '')),
      SecureStore.setItemAsync(KEYS.AVATAR_URL, String(user.avatarUrl || '')),
    ]);
  },

  /**
   * Buscar dados do usuário
   */
  async getUser(): Promise<User | null> {
    const [id, email, name, technicianId, avatarUrl] = await Promise.all([
      SecureStore.getItemAsync(KEYS.USER_ID),
      SecureStore.getItemAsync(KEYS.USER_EMAIL),
      SecureStore.getItemAsync(KEYS.USER_NAME),
      SecureStore.getItemAsync(KEYS.TECHNICIAN_ID),
      SecureStore.getItemAsync(KEYS.AVATAR_URL),
    ]);

    if (!id || !email || !name || !technicianId) {
      return null;
    }

    return { id, email, name, technicianId, avatarUrl: avatarUrl || null };
  },

  /**
   * Limpar todos os dados de autenticação
   */
  async clearAll(): Promise<void> {
    await Promise.all(
      Object.values(KEYS).map((key) => SecureStore.deleteItemAsync(key))
    );
  },

  /**
   * Verificar se está autenticado
   */
  async isAuthenticated(): Promise<boolean> {
    const token = await this.getAccessToken();
    return !!token;
  },

  /**
   * Login
   */
  async login(email: string, password: string, apiUrl: string): Promise<LoginResponse> {
    const response = await fetchWithTimeout(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
      timeout: 30000, // 30s timeout para login
      retries: 2, // Retry uma vez em caso de falha de rede
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Falha no login');
    }

    const data = await response.json();

    // Backend returns { user, token } - handle both old and new format
    const accessToken = data.accessToken || data.token;
    const refreshToken = data.refreshToken || data.token; // Fallback to same token if no refresh

    if (!accessToken) {
      throw new Error('No access token in login response');
    }

    // Salvar tokens e usuário
    await this.saveTokens({
      accessToken,
      refreshToken,
    });

    // Backend doesn't have technicianId field - use user.id as technicianId
    const user: User = {
      id: data.user.id,
      email: data.user.email,
      name: data.user.name,
      technicianId: data.user.technicianId || data.user.id,
      avatarUrl: data.user.avatarUrl || null,
    };

    await this.saveUser(user);

    return {
      user,
      tokens: {
        accessToken,
        refreshToken,
      },
    };
  },

  /**
   * Logout
   */
  async logout(): Promise<void> {
    await this.clearAll();
  },

  /**
   * Refresh token
   */
  async refreshAccessToken(apiUrl: string): Promise<string | null> {
    const refreshToken = await this.getRefreshToken();

    if (!refreshToken) {
      return null;
    }

    try {
      const response = await fetchWithTimeout(`${apiUrl}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
        timeout: 15000, // 15s timeout para refresh
        retries: 1, // Sem retry - se falhar, deixar usuário fazer login
      });

      if (!response.ok) {
        // Refresh token inválido, fazer logout
        await this.clearAll();
        return null;
      }

      const data = await response.json();

      await this.saveTokens({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken || refreshToken,
      });

      return data.accessToken;
    } catch {
      return null;
    }
  },
};

export default AuthService;
