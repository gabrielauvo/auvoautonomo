/**
 * Auth Provider
 *
 * Context provider para autenticação.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { AuthService, User, LoginResponse } from './AuthService';
import { syncEngine, ClientSyncConfig, CategorySyncConfig, CatalogItemSyncConfig } from '../sync';
import { initDatabase, resetDatabase } from '../db';
import { ClientService } from '../modules/clients/ClientService';
import { workOrderService, WorkOrderSyncConfig, WorkOrderTypeSyncConfig } from '../modules/workorders';
import { WorkOrderExecutionService } from '../modules/workorders/execution';
import { AttachmentUploadService } from '../modules/checklists/services/AttachmentUploadService';
import { ChecklistSyncService } from '../modules/checklists/services/ChecklistSyncService';
import { SignatureSyncConfig } from '../modules/checklists/SignatureSyncConfig';
import { QuoteService, QuoteSyncConfig, QuoteSignatureService } from '../modules/quotes';
import { WorkOrderSignatureService } from '../modules/workorders/services/WorkOrderSignatureService';
import { InventoryService, inventorySyncService } from '../modules/inventory';

// =============================================================================
// TYPES
// =============================================================================

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  error: string | null;
}

// =============================================================================
// CONFIG
// =============================================================================

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

// =============================================================================
// CONTEXT
// =============================================================================

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// =============================================================================
// PROVIDER
// =============================================================================

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inicializar - verificar se já está logado
  useEffect(() => {
    const initialize = async () => {
      console.log('[AuthProvider] Starting initialization...');

      // 1. Inicializar banco de dados com timeout e fallback
      try {
        const dbTimeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Database init timeout (5s)')), 5000)
        );

        await Promise.race([initDatabase(), dbTimeout]);
        console.log('[AuthProvider] Database initialized successfully');
      } catch (dbError) {
        console.warn('[AuthProvider] Database init failed, trying reset:', dbError);
        // Try to reset the database
        try {
          await resetDatabase();
          console.log('[AuthProvider] Database reset successful');
        } catch (resetError) {
          console.warn('[AuthProvider] Database reset failed, continuing without DB:', resetError);
        }
      }

      // 2. Verificar autenticação existente
      try {
        const storedUser = await AuthService.getUser();
        const accessToken = await AuthService.getAccessToken();

        if (storedUser && accessToken) {
          console.log('[AuthProvider] Found stored user:', storedUser.email);
          console.log('[AuthProvider] technicianId:', storedUser.technicianId);
          console.log('[AuthProvider] accessToken exists:', !!accessToken);
          console.log('[AuthProvider] API_URL:', API_URL);
          setUser(storedUser);

          // Buscar perfil atualizado do servidor (para sincronizar nome, avatar, etc)
          // Não bloqueia inicialização - usa timeout curto e executa em background
          const fetchProfile = async () => {
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout

              const profileRes = await fetch(`${API_URL}/settings/profile`, {
                headers: { Authorization: `Bearer ${accessToken}` },
                signal: controller.signal,
              });
              clearTimeout(timeoutId);

              if (profileRes.ok) {
                const profileData = await profileRes.json();
                // Check if any important field changed
                const hasChanges =
                  profileData.name !== storedUser.name ||
                  profileData.avatarUrl !== storedUser.avatarUrl ||
                  profileData.phone !== storedUser.phone ||
                  profileData.language !== storedUser.language;

                if (hasChanges) {
                  const updatedUser = {
                    ...storedUser,
                    name: profileData.name || storedUser.name,
                    avatarUrl: profileData.avatarUrl,
                    phone: profileData.phone,
                    language: profileData.language,
                  };
                  await AuthService.saveUser(updatedUser);
                  setUser(updatedUser);
                  console.log('[AuthProvider] Updated user profile from server');
                }
              }
            } catch (profileError) {
              // Silently ignore - profile sync is optional
              console.log('[AuthProvider] Profile sync skipped:',
                profileError instanceof Error && profileError.name === 'AbortError'
                  ? 'timeout'
                  : 'network error'
              );
            }
          };

          // Execute in background - don't await
          fetchProfile();

          // Configurar sync engine
          syncEngine.configure({
            baseUrl: API_URL,
            authToken: accessToken,
            technicianId: storedUser.technicianId,
          });
          console.log('[AuthProvider] SyncEngine configured, isConfigured:', syncEngine.isConfigured());

          // Registrar entidades para sincronização
          syncEngine.registerEntity(ClientSyncConfig);
          syncEngine.registerEntity(WorkOrderSyncConfig);
          syncEngine.registerEntity(WorkOrderTypeSyncConfig);
          syncEngine.registerEntity(QuoteSyncConfig);
          syncEngine.registerEntity(CategorySyncConfig);
          syncEngine.registerEntity(CatalogItemSyncConfig);
          syncEngine.registerEntity(SignatureSyncConfig);

          // Configurar serviços
          ClientService.configure(storedUser.technicianId);
          workOrderService.setTechnicianId(storedUser.technicianId);
          WorkOrderExecutionService.configure(storedUser.technicianId);
          AttachmentUploadService.configure(storedUser.technicianId);
          ChecklistSyncService.configure(storedUser.technicianId);
          QuoteService.configure(storedUser.technicianId);
          QuoteSignatureService.configure(storedUser.technicianId);
          WorkOrderSignatureService.configure(storedUser.technicianId);
          InventoryService.configure(storedUser.technicianId);
          inventorySyncService.configure(API_URL, accessToken);

          // Iniciar sync inicial (não bloqueia login)
          console.log('[AuthProvider] Starting initial sync...');
          syncEngine.syncAll().catch((err) => {
            // Use warn - sync failures are expected when offline or no data
            console.warn('[AuthProvider] Initial sync skipped:', err.message || err);
          });

          // Sync inventory em background (separado do sync principal)
          inventorySyncService.fullSync().catch((err) => {
            console.warn('[AuthProvider] Inventory sync skipped:', err.message || err);
          });
        } else {
          console.log('[AuthProvider] No stored user found');
        }
      } catch (authError) {
        console.warn('[AuthProvider] Auth check failed:', authError);
        // Continua - usuário precisará fazer login
      }

      console.log('[AuthProvider] Initialization complete');
      setIsLoading(false);
    };

    initialize();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await AuthService.login(email, password, API_URL);

      setUser(response.user);

      // Configurar sync engine
      console.log('[AuthProvider] Login success, configuring SyncEngine...');
      console.log('[AuthProvider] technicianId from login:', response.user.technicianId);
      console.log('[AuthProvider] accessToken exists:', !!response.tokens.accessToken);
      console.log('[AuthProvider] API_URL:', API_URL);

      syncEngine.configure({
        baseUrl: API_URL,
        authToken: response.tokens.accessToken,
        technicianId: response.user.technicianId,
      });
      console.log('[AuthProvider] SyncEngine configured, isConfigured:', syncEngine.isConfigured());

      // Registrar entidades para sincronização
      syncEngine.registerEntity(ClientSyncConfig);
      syncEngine.registerEntity(WorkOrderSyncConfig);
      syncEngine.registerEntity(WorkOrderTypeSyncConfig);
      syncEngine.registerEntity(QuoteSyncConfig);
      syncEngine.registerEntity(CategorySyncConfig);
      syncEngine.registerEntity(CatalogItemSyncConfig);
      syncEngine.registerEntity(SignatureSyncConfig);
      console.log('[AuthProvider] Entities registered (clients, workOrders, workOrderTypes, quotes, categories, catalogItems, signatures)');

      // Configurar serviços
      ClientService.configure(response.user.technicianId);
      workOrderService.setTechnicianId(response.user.technicianId);
      WorkOrderExecutionService.configure(response.user.technicianId);
      AttachmentUploadService.configure(response.user.technicianId);
      ChecklistSyncService.configure(response.user.technicianId);
      QuoteService.configure(response.user.technicianId);
      QuoteSignatureService.configure(response.user.technicianId);
      WorkOrderSignatureService.configure(response.user.technicianId);
      InventoryService.configure(response.user.technicianId);
      inventorySyncService.configure(API_URL, response.tokens.accessToken);

      // Iniciar sync inicial (não bloqueia login)
      console.log('[AuthProvider] Starting initial sync...');
      syncEngine.syncAll().catch((err) => {
        // Use warn - sync failures are expected when offline or no data
        console.warn('[AuthProvider] Initial sync skipped:', err.message || err);
      });

      // Sync inventory em background
      inventorySyncService.fullSync().catch((err: Error) => {
        console.warn('[AuthProvider] Inventory sync skipped:', err.message || err);
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro no login';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);

    try {
      await AuthService.logout();
      // IMPORTANTE: NÃO resetar o banco de dados no logout!
      // Os dados locais (incluindo mutações pendentes) devem ser preservados
      // para que possam ser sincronizados quando o usuário fizer login novamente.
      // O reset só deve acontecer em casos específicos (ex: troca de conta/tenant)
      setUser(null);
    } catch (err) {
      console.error('[AuthProvider] Logout error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateUser = useCallback(async (updates: Partial<User>) => {
    if (!user) return;

    const updatedUser = { ...user, ...updates };
    await AuthService.saveUser(updatedUser);
    setUser(updatedUser);
    console.log('[AuthProvider] User updated:', updates);
  }, [user]);

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    updateUser,
    error,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// =============================================================================
// HOOK
// =============================================================================

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}

export default AuthProvider;
