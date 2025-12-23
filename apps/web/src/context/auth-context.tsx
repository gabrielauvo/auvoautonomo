'use client';

/**
 * Auth Context - Contexto de Autenticação
 *
 * Gerencia estado de autenticação global:
 * - Usuário logado
 * - Status de autenticação
 * - Funções de login/logout
 * - Carregamento inicial
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  authService,
  User,
  LoginCredentials,
  RegisterData,
} from '@/services/auth.service';
import { billingService, BillingStatus } from '@/services/billing.service';

/**
 * Bypass de autenticação controlado por variável de ambiente
 * Só funciona em desenvolvimento E com variável explicitamente habilitada
 */
const DEV_BYPASS_AUTH =
  process.env.NODE_ENV === 'development' &&
  process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH === 'true';

// Mock data apenas para desenvolvimento (não exposto em produção)
const getMockData = () => {
  if (!DEV_BYPASS_AUTH) return { user: null, billing: null };

  return {
    user: {
      id: 'dev-user-123',
      name: 'Usuário Demo',
      email: 'demo@auvo.com',
      companyName: 'Empresa Demo Ltda',
      phone: '(11) 99999-9999',
      createdAt: new Date().toISOString(),
    } as User,
    billing: {
      planKey: 'PRO',
      planName: 'Plano PRO',
      status: 'ACTIVE',
      limits: {
        maxClients: -1,
        maxQuotes: -1,
        maxWorkOrders: -1,
        maxPayments: -1,
      },
      usage: {
        clientsCount: 45,
        quotesCount: 120,
        workOrdersCount: 89,
        paymentsCount: 156,
      },
      features: {
        advancedReports: true,
        exportPdf: true,
        whatsapp: true,
      },
    } as BillingStatus,
  };
};

/**
 * Tipos do contexto
 */
interface AuthContextType {
  user: User | null;
  billing: BillingStatus | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  loginWithToken: (token: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshBilling: () => Promise<void>;
  clearError: () => void;
}

/**
 * Contexto de autenticação
 */
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Provider de autenticação
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refs para evitar race conditions
  const isLoadingRef = useRef(false);
  const isMountedRef = useRef(true);
  const hasLoadedRef = useRef(false);

  /**
   * Carrega dados do usuário a partir do token armazenado
   * Usa ref para prevenir chamadas simultâneas
   */
  const loadUser = useCallback(async () => {
    // Evita chamadas simultâneas ou repetidas
    if (isLoadingRef.current || hasLoadedRef.current) {
      return;
    }
    isLoadingRef.current = true;
    hasLoadedRef.current = true;

    // Bypass controlado por env var (só em desenvolvimento)
    if (DEV_BYPASS_AUTH) {
      const mockData = getMockData();
      if (isMountedRef.current) {
        setUser(mockData.user);
        setBilling(mockData.billing);
        setIsLoading(false);
      }
      isLoadingRef.current = false;
      return;
    }

    try {
      // Tenta carregar perfil - se falhar, não está autenticado
      const [profileData, billingData] = await Promise.all([
        authService.getProfile(),
        billingService.getBillingStatus().catch(() => null),
      ]);

      // Verifica se ainda está montado antes de atualizar estado
      if (isMountedRef.current) {
        setUser(profileData);
        setBilling(billingData);
      }
    } catch {
      // Token inválido, expirado ou não existe
      if (isMountedRef.current) {
        setUser(null);
        setBilling(null);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
      isLoadingRef.current = false;
    }
  }, []);

  /**
   * Carrega usuário ao montar componente
   * Cleanup ao desmontar para evitar memory leaks
   */
  useEffect(() => {
    isMountedRef.current = true;
    loadUser();

    return () => {
      isMountedRef.current = false;
    };
  }, [loadUser]);

  /**
   * Recarrega usuário quando a aba fica visível novamente
   * Garante que avatar e outros dados estejam sincronizados após mudanças no mobile
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user) {
        // Refresh user data silently when tab becomes visible
        authService.getProfile()
          .then((profileData) => {
            if (isMountedRef.current) {
              setUser(profileData);
            }
          })
          .catch(() => {
            // Ignore errors - user might have logged out
          });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

  /**
   * Realiza login
   */
  const login = useCallback(async (credentials: LoginCredentials) => {
    setIsLoading(true);
    setError(null);

    try {
      const { user: userData } = await authService.login(credentials);
      setUser(userData);

      // Carrega billing após login
      const billingData = await billingService.getBillingStatus().catch(() => null);
      setBilling(billingData);

      // Redireciona para dashboard
      router.push('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao fazer login';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  /**
   * Login com token (usado pelo Google OAuth callback)
   */
  const loginWithToken = useCallback(async (token: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Salva o token
      authService.setToken(token);

      // Carrega dados do usuário
      const [profileData, billingData] = await Promise.all([
        authService.getProfile(),
        billingService.getBillingStatus().catch(() => null),
      ]);

      setUser(profileData);
      setBilling(billingData);
    } catch (err) {
      authService.clearToken();
      const message = err instanceof Error ? err.message : 'Erro na autenticação';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Realiza registro
   */
  const register = useCallback(async (data: RegisterData) => {
    setIsLoading(true);
    setError(null);

    try {
      const { user: userData } = await authService.register(data);
      setUser(userData);

      // Carrega billing após registro
      const billingData = await billingService.getBillingStatus().catch(() => null);
      setBilling(billingData);

      // Redireciona para dashboard
      router.push('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao registrar';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  /**
   * Realiza logout
   */
  const logout = useCallback(async () => {
    setIsLoading(true);

    try {
      await authService.logout();
    } finally {
      setUser(null);
      setBilling(null);
      setIsLoading(false);
      router.push('/login');
    }
  }, [router]);

  /**
   * Atualiza dados do usuário
   */
  const refreshUser = useCallback(async () => {
    try {
      const profileData = await authService.getProfile();
      setUser(profileData);
    } catch {
      // Ignora erro silenciosamente
    }
  }, []);

  /**
   * Atualiza dados de billing
   */
  const refreshBilling = useCallback(async () => {
    try {
      const billingData = await billingService.getBillingStatus();
      setBilling(billingData);
    } catch {
      // Ignora erro silenciosamente
    }
  }, []);

  /**
   * Limpa erro
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value = useMemo<AuthContextType>(() => ({
    user,
    billing,
    isAuthenticated: !!user,
    isLoading,
    error,
    login,
    loginWithToken,
    register,
    logout,
    refreshUser,
    refreshBilling,
    clearError,
  }), [user, billing, isLoading, error, login, loginWithToken, register, logout, refreshUser, refreshBilling, clearError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook para usar o contexto de autenticação
 */
export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}

export default AuthContext;
