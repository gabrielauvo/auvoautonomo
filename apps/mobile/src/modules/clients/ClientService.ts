// @ts-nocheck
/**
 * Client Service
 *
 * Serviço para gerenciar clientes com suporte offline-first.
 * - Operações CRUD salvam localmente primeiro
 * - Mutações são enfileiradas para sync
 * - Busca local com fallback online
 */

import { v4 as uuidv4 } from 'uuid';
import { ClientRepository } from '../../db/repositories/ClientRepository';
import { MutationQueue } from '../../queue/MutationQueue';
import { Client } from '../../db/schema';
import { syncEngine } from '../../sync';
import { DeviceContactsService } from '../../services/DeviceContactsService';

// =============================================================================
// TYPES
// =============================================================================

export interface CreateClientInput {
  name: string;
  email?: string;
  phone?: string;           // Optional for offline-first
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  taxId?: string;           // Optional for offline-first
  notes?: string;
}

export interface UpdateClientInput {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  taxId?: string;
  notes?: string;
}

export interface ClientSearchResult {
  data: Client[];
  isLocal: boolean;
  total: number;
}

// =============================================================================
// CLIENT SERVICE
// =============================================================================

class ClientServiceClass {
  private technicianId: string | null = null;
  private companyName: string | null = null;

  /**
   * Configurar o serviço com o ID do técnico
   */
  configure(technicianId: string, companyName?: string): void {
    this.technicianId = technicianId;
    this.companyName = companyName || null;
  }

  /**
   * Criar novo cliente
   * - Salva localmente (otimista)
   * - Enfileira mutação para sync
   */
  async createClient(input: CreateClientInput): Promise<Client> {
    if (!this.technicianId) {
      throw new Error('ClientService not configured. Call configure() first.');
    }

    const now = new Date().toISOString();
    const id = uuidv4();

    const client = {
      id,
      technicianId: this.technicianId,
      name: input.name,
      email: input.email || null,
      phone: input.phone || null,
      address: input.address || null,
      city: input.city || null,
      state: input.state || null,
      zipCode: input.zipCode || null,
      document: input.taxId || null,
      notes: input.notes || null,
      isActive: 1,  // Store as integer for SQLite
      createdAt: now,
      updatedAt: now,
      syncedAt: null,
    } as unknown as Client;

    // 1. Salvar localmente
    await ClientRepository.create(client);

    // 2. Enfileirar mutação para sync
    await MutationQueue.enqueue('clients', id, 'create', {
      id,
      name: input.name,
      email: input.email,
      phone: input.phone,
      address: input.address,
      city: input.city,
      state: input.state,
      zipCode: input.zipCode,
      taxId: input.taxId,
      notes: input.notes,
    });

    console.log(`[ClientService] Client ${id} created and queued for sync`);

    // 3. Tentar criar contato na agenda do dispositivo (best effort, não bloqueia)
    // A criação do contato é local (offline-first) e não depende da sincronização
    DeviceContactsService.onClientCreated(
      { name: client.name, phone: client.phone },
      this.companyName || undefined
    );

    // 4. Tentar sincronizar imediatamente se online
    if (syncEngine.isNetworkOnline()) {
      console.log('[ClientService] Online - triggering immediate sync');
      syncEngine.syncAll().catch((err) => {
        console.error('[ClientService] Immediate sync failed:', err);
      });
    }

    return client;
  }

  /**
   * Atualizar cliente
   * - Salva localmente (otimista)
   * - Enfileira mutação para sync
   * - Tenta sincronizar imediatamente se online
   */
  async updateClient(id: string, input: UpdateClientInput): Promise<Client | null> {
    const existing = await ClientRepository.getById(id);
    if (!existing) {
      throw new Error(`Client ${id} not found`);
    }

    const now = new Date().toISOString();

    // Preparar dados de update
    const updateData: Partial<Client> = {
      updatedAt: now,
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.email !== undefined) updateData.email = input.email;
    if (input.phone !== undefined) updateData.phone = input.phone;
    if (input.address !== undefined) updateData.address = input.address;
    if (input.city !== undefined) updateData.city = input.city;
    if (input.state !== undefined) updateData.state = input.state;
    if (input.zipCode !== undefined) updateData.zipCode = input.zipCode;
    if (input.taxId !== undefined) updateData.document = input.taxId;
    if (input.notes !== undefined) updateData.notes = input.notes;

    // 1. Atualizar localmente
    await ClientRepository.update(id, updateData);

    // 2. Enfileirar mutação para sync
    await MutationQueue.enqueue('clients', id, 'update', {
      id,
      name: input.name ?? existing.name,
      email: input.email ?? existing.email,
      phone: input.phone ?? existing.phone,
      address: input.address ?? existing.address,
      city: input.city ?? existing.city,
      state: input.state ?? existing.state,
      zipCode: input.zipCode ?? existing.zipCode,
      taxId: input.taxId ?? existing.document,
      notes: input.notes ?? existing.notes,
    });

    console.log(`[ClientService] Client ${id} updated and queued for sync`);

    // 3. Tentar sincronizar imediatamente se online
    if (syncEngine.isNetworkOnline()) {
      console.log('[ClientService] Online - triggering immediate sync for update');
      syncEngine.syncAll().catch((err) => {
        console.error('[ClientService] Immediate sync after update failed:', err);
      });
    }

    return ClientRepository.getById(id);
  }

  /**
   * Excluir cliente (soft delete)
   * - Marca como inativo localmente
   * - Enfileira mutação para sync
   * - Tenta sincronizar imediatamente se online
   */
  async deleteClient(id: string): Promise<void> {
    const existing = await ClientRepository.getById(id);
    if (!existing) {
      throw new Error(`Client ${id} not found`);
    }

    // 1. Soft delete localmente
    await ClientRepository.softDelete(id);

    // 2. Enfileirar mutação para sync
    // Enviar dados que o backend aceita (sem technicianId/isActive que são rejeitados)
    await MutationQueue.enqueue('clients', id, 'delete', {
      id,
      name: existing.name,
      email: existing.email,
      phone: existing.phone,
      taxId: existing.document,
      address: existing.address,
      city: existing.city,
      state: existing.state,
      zipCode: existing.zipCode,
      notes: existing.notes,
    });

    console.log(`[ClientService] Client ${id} deleted and queued for sync`);

    // 3. Tentar sincronizar imediatamente se online
    if (syncEngine.isNetworkOnline()) {
      console.log('[ClientService] Online - triggering immediate sync for delete');
      syncEngine.syncAll().catch((err) => {
        console.error('[ClientService] Immediate sync after delete failed:', err);
      });
    }
  }

  /**
   * Buscar cliente por ID
   */
  async getClient(id: string): Promise<Client | null> {
    return ClientRepository.getById(id);
  }

  /**
   * Listar clientes com paginação
   */
  async listClients(
    page: number = 1,
    pageSize: number = 50
  ): Promise<{ data: Client[]; total: number; pages: number }> {
    if (!this.technicianId) {
      throw new Error('ClientService not configured. Call configure() first.');
    }

    return ClientRepository.getPaginated(this.technicianId, page, pageSize);
  }

  /**
   * Buscar clientes por texto (local primeiro, fallback online)
   */
  async searchClients(
    query: string,
    limit: number = 50
  ): Promise<ClientSearchResult> {
    if (!this.technicianId) {
      throw new Error('ClientService not configured. Call configure() first.');
    }

    // 1. Busca local primeiro
    const localResults = await ClientRepository.search(
      this.technicianId,
      query,
      limit
    );

    if (localResults.length > 0) {
      return {
        data: localResults,
        isLocal: true,
        total: localResults.length,
      };
    }

    // 2. Se não encontrou localmente e está online, buscar no servidor
    if (syncEngine.isNetworkOnline()) {
      try {
        const serverResults = await this.searchOnline(query, limit);
        return {
          data: serverResults,
          isLocal: false,
          total: serverResults.length,
        };
      } catch (error) {
        console.warn('[ClientService] Online search failed:', error);
      }
    }

    return {
      data: [],
      isLocal: true,
      total: 0,
    };
  }

  /**
   * Buscar clientes no servidor (sem salvar localmente)
   */
  private async searchOnline(
    query: string,
    limit: number
  ): Promise<Client[]> {
    const state = syncEngine.getState();
    const baseUrl = (syncEngine as any).baseUrl;
    const authToken = (syncEngine as any).authToken;

    if (!baseUrl || !authToken) {
      throw new Error('SyncEngine not configured');
    }

    const url = new URL(`${baseUrl}/clients/search`);
    url.searchParams.set('q', query);
    url.searchParams.set('limit', String(limit));

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`);
    }

    const data = await response.json();

    // Transform server data to local format
    return data.map((item: any) => ({
      id: item.id,
      technicianId: this.technicianId,
      name: item.name,
      email: item.email,
      phone: item.phone,
      document: item.taxId,
      address: item.address,
      city: item.city,
      state: item.state,
      zipCode: item.zipCode,
      notes: item.notes,
      isActive: !item.deletedAt ? 1 : 0,  // Store as integer for SQLite
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      syncedAt: null,
    }));
  }

  /**
   * Contar clientes pendentes de sync
   */
  async getPendingCount(): Promise<number> {
    return MutationQueue.countPending();
  }

  /**
   * Verificar se cliente tem mutações pendentes
   */
  async hasPendingMutations(id: string): Promise<boolean> {
    return MutationQueue.hasPendingFor('clients', id);
  }

  /**
   * Sincronizar clientes manualmente
   */
  async sync(): Promise<void> {
    await syncEngine.syncEntity('clients');
  }

  /**
   * Obter estatísticas de clientes
   */
  async getStats(): Promise<{
    total: number;
    pending: number;
  }> {
    if (!this.technicianId) {
      return { total: 0, pending: 0 };
    }

    const [total, pending] = await Promise.all([
      ClientRepository.count(this.technicianId),
      MutationQueue.countPending(),
    ]);

    return { total, pending };
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

export const ClientService = new ClientServiceClass();

export default ClientService;
