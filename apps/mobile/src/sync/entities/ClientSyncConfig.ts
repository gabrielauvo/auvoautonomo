// @ts-nocheck
/**
 * Client Sync Configuration
 *
 * Configuração da entidade Client para sincronização 2-vias.
 */

import { SyncEntityConfig } from '../types';

// =============================================================================
// CLIENT TYPES
// =============================================================================

/**
 * SyncClient - Interface para sync
 *
 * IMPORTANTE: O servidor usa 'taxId' mas o schema local usa 'document'.
 * A transformação é feita em transformFromServer/transformToServer.
 */
export interface SyncClient {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  document?: string;      // CPF/CNPJ (local) - maps to taxId on server
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  notes?: string;
  isActive: boolean;      // Status do cliente
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;     // Soft delete timestamp
  // Local fields
  syncedAt?: string;
  technicianId: string;   // Required - escopo por técnico
}

// =============================================================================
// SYNC CONFIGURATION
// =============================================================================

export const ClientSyncConfig: SyncEntityConfig<SyncClient> = {
  name: 'clients',
  tableName: 'clients',
  apiEndpoint: '/clients/sync',
  apiMutationEndpoint: '/clients/sync/mutations',
  cursorField: 'updatedAt',
  primaryKeys: ['id'],
  scopeField: 'technicianId',
  batchSize: 100, // 100 per page for mobile
  conflictResolution: 'last_write_wins',

  /**
   * Transform server data to local format
   *
   * Mapeamentos importantes:
   * - server.taxId → local.document
   * - server.isActive pode vir como boolean ou number
   */
  transformFromServer: (data: unknown): SyncClient => {
    const record = data as Record<string, unknown>;
    // Convert isActive to integer (1/0) for SQLite storage
    const isActiveValue = record.isActive !== false && record.isActive !== 0;
    return {
      id: record.id as string,
      name: record.name as string,
      email: record.email as string | undefined,
      phone: record.phone as string | undefined,
      document: record.taxId as string | undefined, // Server taxId → local document
      address: record.address as string | undefined,
      city: record.city as string | undefined,
      state: record.state as string | undefined,
      zipCode: record.zipCode as string | undefined,
      notes: record.notes as string | undefined,
      isActive: isActiveValue ? 1 : 0, // Store as integer for SQLite
      createdAt: record.createdAt as string,
      updatedAt: record.updatedAt as string,
      deletedAt: record.deletedAt as string | undefined,
      technicianId: record.technicianId as string,
    } as unknown as SyncClient;
  },

  /**
   * Transform local data to server format
   *
   * Mapeamentos importantes:
   * - local.document → server.taxId
   * - NÃO enviar isActive e technicianId (não existem no DTO do backend)
   */
  transformToServer: (data: SyncClient): unknown => {
    // Handle both local format (document) and mutation payload format (taxId)
    const record = data as Record<string, unknown>;
    return {
      id: data.id,
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      taxId: data.document || record.taxId || null, // Accept both document and taxId
      address: data.address || null,
      city: data.city || null,
      state: data.state || null,
      zipCode: data.zipCode || null,
      notes: data.notes || null,
      // NÃO enviar isActive e technicianId - backend rejeita campos não whitelisted
    };
  },
};

export default ClientSyncConfig;
