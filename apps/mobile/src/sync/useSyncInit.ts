// @ts-nocheck
/**
 * useSyncInit Hook
 *
 * Inicializa o SyncEngine com as configurações das entidades.
 * Deve ser chamado após autenticação bem-sucedida.
 */

import { useEffect, useRef } from 'react';
import { syncEngine } from './SyncEngine';
import { ClientSyncConfig } from './entities/ClientSyncConfig';
import { CategorySyncConfig } from './entities/CategorySyncConfig';
import { CatalogItemSyncConfig } from './entities/CatalogItemSyncConfig';
import { getApiBaseUrl } from '../config/api';

interface SyncInitOptions {
  authToken: string;
  technicianId: string;
}

/**
 * Hook para inicializar o SyncEngine quando o usuário está autenticado
 */
export function useSyncInit(options: SyncInitOptions | null) {
  const initialized = useRef(false);

  useEffect(() => {
    if (!options || initialized.current) return;

    const { authToken, technicianId } = options;

    // Configurar o engine com credenciais
    syncEngine.configure({
      baseUrl: getApiBaseUrl(),
      authToken,
      technicianId,
    });

    // Registrar entidades para sincronização
    // Ordem importante: categories antes de items (items dependem de categories)
    syncEngine.registerEntity(ClientSyncConfig);
    syncEngine.registerEntity(CategorySyncConfig);
    syncEngine.registerEntity(CatalogItemSyncConfig);

    // Marcar como inicializado
    initialized.current = true;

    console.log('[SyncInit] SyncEngine configured and entities registered (clients, categories, catalogItems)');

    // Fazer sync inicial
    syncEngine.syncAll().catch((error) => {
      console.error('[SyncInit] Initial sync failed:', error);
    });
  }, [options]);

  // Reset quando opções mudam para null (logout)
  useEffect(() => {
    if (!options) {
      initialized.current = false;
    }
  }, [options]);
}

export default useSyncInit;
