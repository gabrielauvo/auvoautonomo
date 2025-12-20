// @ts-nocheck
/**
 * Client Repository
 *
 * Acesso ao banco de dados para clientes.
 */

import type { SQLiteBindValue } from 'expo-sqlite';
import {
  findAll,
  findById,
  findOne,
  insert,
  update,
  remove,
  count,
  rawQuery,
  QueryOptions,
} from '../database';
import { Client } from '../schema';

// Type helper for database operations
type ClientRecord = Record<string, unknown>;

const TABLE = 'clients';

// =============================================================================
// REPOSITORY
// =============================================================================

export const ClientRepository = {
  /**
   * Buscar todos os clientes do técnico
   */
  async getAll(technicianId: string, options: Omit<QueryOptions, 'where'> = {}): Promise<Client[]> {
    return findAll<Client>(TABLE, {
      where: { technicianId, isActive: 1 },
      orderBy: 'name',
      order: 'ASC',
      ...options,
    });
  },

  /**
   * Buscar cliente por ID
   */
  async getById(id: string): Promise<Client | null> {
    return findById<Client>(TABLE, id);
  },

  /**
   * Buscar cliente por email
   */
  async getByEmail(email: string, technicianId: string): Promise<Client | null> {
    return findOne<Client>(TABLE, { email, technicianId });
  },

  /**
   * Buscar clientes com paginação otimizada para 100k registros
   */
  async getPaginated(
    technicianId: string,
    page: number = 1,
    pageSize: number = 50
  ): Promise<{ data: Client[]; total: number; pages: number }> {
    const offset = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      findAll<Client>(TABLE, {
        where: { technicianId, isActive: 1 },
        orderBy: 'name',
        order: 'ASC',
        limit: pageSize,
        offset,
      }),
      count(TABLE, { technicianId, isActive: 1 }),
    ]);

    return {
      data,
      total,
      pages: Math.ceil(total / pageSize),
    };
  },

  /**
   * Buscar clientes por texto (nome, email, telefone)
   */
  async search(
    technicianId: string,
    query: string,
    limit: number = 50
  ): Promise<Client[]> {
    const searchQuery = `%${query}%`;

    return rawQuery<Client>(
      `SELECT * FROM ${TABLE}
       WHERE technicianId = ? AND isActive = 1
       AND (name LIKE ? OR email LIKE ? OR phone LIKE ? OR document LIKE ?)
       ORDER BY name ASC
       LIMIT ?`,
      [technicianId, searchQuery, searchQuery, searchQuery, searchQuery, limit]
    );
  },

  /**
   * Criar novo cliente
   */
  async create(data: Client | Omit<Client, 'createdAt' | 'updatedAt'>): Promise<void> {
    const now = new Date().toISOString();
    const record = {
      ...data,
      createdAt: (data as Client).createdAt || now,
      updatedAt: (data as Client).updatedAt || now,
    };
    await insert<ClientRecord>(TABLE, record as ClientRecord);
  },

  /**
   * Atualizar cliente
   */
  async update(id: string, data: Partial<Client>): Promise<void> {
    await update<ClientRecord>(TABLE, id, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  },

  /**
   * Soft delete (desativar cliente)
   * Define isActive=0 e deletedAt para sync
   */
  async softDelete(id: string): Promise<void> {
    const now = new Date().toISOString();
    await update<ClientRecord>(TABLE, id, {
      isActive: 0,  // Store as integer for SQLite
      deletedAt: now,
      updatedAt: now,
    });
  },

  /**
   * Hard delete (remover do banco)
   */
  async delete(id: string): Promise<void> {
    await remove(TABLE, id);
  },

  /**
   * Contar clientes do técnico
   */
  async count(technicianId: string): Promise<number> {
    return count(TABLE, { technicianId, isActive: 1 });
  },

  /**
   * Buscar clientes modificados após uma data (para sync)
   */
  async getModifiedAfter(
    technicianId: string,
    afterDate: string,
    limit: number = 100
  ): Promise<Client[]> {
    return rawQuery<Client>(
      `SELECT * FROM ${TABLE}
       WHERE technicianId = ? AND updatedAt > ?
       ORDER BY updatedAt ASC
       LIMIT ?`,
      [technicianId, afterDate, limit]
    );
  },

  /**
   * Batch insert para sync inicial
   */
  async batchInsert(clients: Client[]): Promise<void> {
    if (clients.length === 0) return;

    const columns = [
      'id', 'name', 'email', 'phone', 'document', 'address', 'city', 'state',
      'zipCode', 'notes', 'isActive', 'deletedAt', 'createdAt', 'updatedAt', 'syncedAt', 'technicianId',
    ];

    const placeholders = clients
      .map(() => `(${columns.map(() => '?').join(', ')})`)
      .join(', ');

    const values = clients.flatMap((client) =>
      columns.map((col) => (client as ClientRecord)[col] ?? null)
    ) as SQLiteBindValue[];

    await rawQuery(
      `INSERT OR REPLACE INTO ${TABLE} (${columns.join(', ')}) VALUES ${placeholders}`,
      values
    );
  },

  /**
   * Marcar como sincronizado
   */
  async markSynced(id: string): Promise<void> {
    await update<ClientRecord>(TABLE, id, {
      syncedAt: new Date().toISOString(),
    });
  },
};

export default ClientRepository;
