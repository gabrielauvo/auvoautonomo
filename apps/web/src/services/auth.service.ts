/**
 * Auth Service - Serviço de Autenticação
 *
 * Gerencia:
 * - Login/Logout via API routes (HttpOnly cookies)
 * - Carregamento de perfil do usuário
 * - Tokens são gerenciados pelo servidor (HttpOnly)
 *
 * SEGURANÇA:
 * - Tokens em HttpOnly cookies (não acessíveis via JS)
 * - API routes do Next.js fazem proxy para backend
 * - CSRF protection em formulários
 */

import api, { AUTH_TOKEN_KEY, getErrorMessage } from './api';
import Cookies from 'js-cookie';

/**
 * Tipos de dados do usuário
 */
export interface User {
  id: string;
  email: string;
  name: string;
  companyName?: string | null;
  avatarUrl?: string | null;
  planKey?: 'FREE' | 'PRO' | 'TEAM';
  subscriptionStatus?: 'FREE' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED';
  createdAt?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  companyName?: string;
  phone?: string;
}

/**
 * Realiza login do usuário
 *
 * SEGURANÇA: Usa API route Next.js que armazena token em HttpOnly cookie
 */
export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  try {
    // Faz login via API route (não diretamente no backend)
    // A API route armazena o token em HttpOnly cookie
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
      credentials: 'include', // Importante para enviar/receber cookies
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Erro ao fazer login');
    }

    const data = await response.json();

    // Token agora está em HttpOnly cookie, não acessível via JS
    // Retornamos apenas os dados do usuário
    return {
      user: data.user,
      token: '', // Token não é mais acessível no frontend
    };
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Realiza logout do usuário
 *
 * SEGURANÇA: Usa API route que remove HttpOnly cookies
 */
export async function logout(): Promise<void> {
  try {
    // Faz logout via API route que remove cookies HttpOnly
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
  } catch (error) {
    // Mesmo com erro, cookies são removidos pelo servidor
    console.warn('Logout error:', error);
  }
}

/**
 * Registra novo usuário
 */
export async function register(data: RegisterData): Promise<LoginResponse> {
  try {
    const response = await api.post<LoginResponse>('/auth/register', data);

    const { token, user } = response.data;

    // Armazena token em cookie
    Cookies.set(AUTH_TOKEN_KEY, token, {
      expires: 7,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    return { token, user };
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Carrega perfil do usuário atual
 *
 * SEGURANÇA: Usa API route que faz proxy para o backend com HttpOnly cookie
 */
export async function getProfile(): Promise<User> {
  try {
    // Usa API route do Next.js que tem acesso ao cookie HttpOnly
    const response = await fetch('/api/auth/me', {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Erro ao carregar perfil');
    }

    return response.json();
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Verifica se existe token armazenado
 *
 * NOTA: Token está em HttpOnly cookie, não acessível via JS.
 * Esta função tenta fazer uma chamada ao backend para verificar.
 */
export async function hasToken(): Promise<boolean> {
  try {
    await api.get('/auth/me');
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Obtém token armazenado
 *
 * @deprecated Token está em HttpOnly cookie e não é acessível via JavaScript.
 * Use as chamadas de API diretamente - o cookie é enviado automaticamente.
 */
export function getToken(): string | undefined {
  console.warn('getToken() deprecated: Token is in HttpOnly cookie');
  return undefined;
}

/**
 * Remove token armazenado
 *
 * @deprecated Use a função logout() que remove cookies via API route
 */
export function clearToken(): void {
  console.warn('clearToken() deprecated: Use logout() instead');
  logout();
}

/**
 * Define token (usado para OAuth callbacks)
 *
 * @deprecated Token agora é gerenciado via API routes com HttpOnly cookies
 */
export function setToken(token: string): void {
  console.warn('setToken() deprecated: Token is managed via API routes');
  // Mantém compatibilidade para preferências não-sensíveis
  Cookies.set('legacy_token', token, {
    expires: 7,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
}

/**
 * Renova access token usando refresh token
 *
 * SEGURANÇA: Usa API route que gerencia tokens em HttpOnly cookies
 */
export async function refreshToken(): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });

    return response.ok;
  } catch (error) {
    console.error('Token refresh error:', error);
    return false;
  }
}

export const authService = {
  login,
  logout,
  register,
  getProfile,
  hasToken,
  getToken, // deprecated
  clearToken, // deprecated
  setToken, // deprecated
  refreshToken,
};

export default authService;
