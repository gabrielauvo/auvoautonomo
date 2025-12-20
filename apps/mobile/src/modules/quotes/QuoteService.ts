// @ts-nocheck
/**
 * Quote Service
 *
 * Serviço para gerenciar orçamentos (quotes) com suporte offline-first.
 * - Operações CRUD salvam localmente primeiro
 * - Mutações são enfileiradas para sync
 * - Busca local com fallback online
 */

import { v4 as uuidv4 } from 'uuid';
import { QuoteRepository } from './QuoteRepository';
import { MutationQueue } from '../../queue/MutationQueue';
import { Quote, QuoteItem, QuoteStatus } from '../../db/schema';
import { syncEngine } from '../../sync';

// =============================================================================
// TYPES
// =============================================================================

export interface CreateQuoteItemInput {
  itemId?: string;        // ID do item do catálogo (opcional para itens manuais)
  name: string;
  type?: string;          // SERVICE | PRODUCT (default: SERVICE)
  unit?: string;          // un, h, etc (default: un)
  quantity: number;
  unitPrice: number;
  discountValue?: number;
}

export interface CreateQuoteInput {
  clientId: string;
  notes?: string;
  discountValue?: number;
  visitScheduledAt?: string;
  items: CreateQuoteItemInput[];
}

export interface UpdateQuoteInput {
  notes?: string;
  discountValue?: number;
  visitScheduledAt?: string;
  items?: CreateQuoteItemInput[];  // Se fornecido, substitui todos os itens
}

export interface QuoteWithItems extends Quote {
  items: QuoteItem[];
}

// =============================================================================
// QUOTE SERVICE
// =============================================================================

class QuoteServiceClass {
  private technicianId: string | null = null;

  /**
   * Configurar o serviço com o ID do técnico
   */
  configure(technicianId: string): void {
    this.technicianId = technicianId;
  }

  /**
   * Obter o ID do técnico configurado
   */
  getTechnicianId(): string | null {
    return this.technicianId;
  }

  /**
   * Criar novo orçamento com itens
   * - Salva localmente (otimista)
   * - Enfileira mutação para sync
   */
  async createQuote(input: CreateQuoteInput): Promise<QuoteWithItems> {
    if (!this.technicianId) {
      throw new Error('QuoteService not configured. Call configure() first.');
    }

    const now = new Date().toISOString();
    const id = uuidv4();

    // Processar itens
    const items: QuoteItem[] = input.items.map((item) => {
      const itemId = uuidv4();
      const quantity = item.quantity;
      const unitPrice = item.unitPrice;
      const discountValue = item.discountValue || 0;
      const totalPrice = quantity * unitPrice - discountValue;

      return {
        id: itemId,
        quoteId: id,
        itemId: item.itemId,
        name: item.name,
        type: item.type || 'SERVICE',
        unit: item.unit || 'un',
        quantity,
        unitPrice,
        discountValue,
        totalPrice,
        createdAt: now,
        updatedAt: now,
      };
    });

    // Calcular totais
    const itemsTotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const discountValue = input.discountValue || 0;
    const totalValue = itemsTotal - discountValue;

    const quote: Quote = {
      id,
      technicianId: this.technicianId,
      clientId: input.clientId,
      status: 'DRAFT',
      discountValue,
      totalValue,
      notes: input.notes || null,
      sentAt: null,
      visitScheduledAt: input.visitScheduledAt || null,
      createdAt: now,
      updatedAt: now,
      syncedAt: null,
    };

    // 1. Salvar localmente
    await QuoteRepository.createWithItems(quote, items);

    // 2. Enfileirar mutação para sync
    await MutationQueue.enqueue('quotes', id, 'create', {
      id,
      clientId: input.clientId,
      status: 'DRAFT',
      discountValue,
      notes: input.notes,
      visitScheduledAt: input.visitScheduledAt,
      items: items.map((item) => ({
        id: item.id,
        itemId: item.itemId,
        name: item.name,
        type: item.type,
        unit: item.unit,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountValue: item.discountValue,
      })),
    });

    console.log(`[QuoteService] Quote ${id} created and queued for sync`);
    console.log(`[QuoteService] Quote data: clientId=${input.clientId}, items=${items.length}, total=${totalValue}`);
    console.log(`[QuoteService] SyncEngine configured: ${syncEngine.isConfigured()}, online: ${syncEngine.isNetworkOnline()}`);

    return { ...quote, items };
  }

  /**
   * Atualizar orçamento
   * - Salva localmente (otimista)
   * - Enfileira mutação para sync
   */
  async updateQuote(id: string, input: UpdateQuoteInput): Promise<QuoteWithItems | null> {
    const existing = await QuoteRepository.getByIdWithItems(id);
    if (!existing) {
      throw new Error(`Quote ${id} not found`);
    }

    const now = new Date().toISOString();
    let items = existing.items;

    // Se novos itens foram fornecidos, processar
    if (input.items) {
      items = input.items.map((item) => {
        const itemId = uuidv4();
        const quantity = item.quantity;
        const unitPrice = item.unitPrice;
        const discountValue = item.discountValue || 0;
        const totalPrice = quantity * unitPrice - discountValue;

        return {
          id: itemId,
          quoteId: id,
          itemId: item.itemId,
          name: item.name,
          type: item.type || 'SERVICE',
          unit: item.unit || 'un',
          quantity,
          unitPrice,
          discountValue,
          totalPrice,
          createdAt: now,
          updatedAt: now,
        };
      });
    }

    // Calcular totais
    const itemsTotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const discountValue = input.discountValue ?? existing.discountValue;
    const totalValue = itemsTotal - discountValue;

    // Preparar dados de update
    const updateData: Partial<Quote> = {
      discountValue,
      totalValue,
      updatedAt: now,
    };

    if (input.notes !== undefined) updateData.notes = input.notes;
    if (input.visitScheduledAt !== undefined) updateData.visitScheduledAt = input.visitScheduledAt;

    // 1. Atualizar localmente
    if (input.items) {
      await QuoteRepository.updateWithItems(id, updateData, items);
    } else {
      await QuoteRepository.update(id, updateData);
    }

    // 2. Enfileirar mutação para sync
    await MutationQueue.enqueue('quotes', id, 'update', {
      id,
      clientId: existing.clientId,
      status: existing.status,
      discountValue,
      notes: input.notes ?? existing.notes,
      visitScheduledAt: input.visitScheduledAt ?? existing.visitScheduledAt,
      items: items.map((item) => ({
        id: item.id,
        itemId: item.itemId,
        name: item.name,
        type: item.type,
        unit: item.unit,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountValue: item.discountValue,
      })),
    });

    console.log(`[QuoteService] Quote ${id} updated and queued for sync`);

    return QuoteRepository.getByIdWithItems(id);
  }

  /**
   * Atualizar status do orçamento
   */
  async updateStatus(id: string, status: QuoteStatus): Promise<Quote | null> {
    const existing = await QuoteRepository.getById(id);
    if (!existing) {
      throw new Error(`Quote ${id} not found`);
    }

    // Validar transição de status
    this.validateStatusTransition(existing.status, status);

    // 1. Atualizar localmente
    await QuoteRepository.updateStatus(id, status);

    // 2. Enfileirar mutação para sync
    await MutationQueue.enqueue('quotes', id, 'update', {
      id,
      clientId: existing.clientId,
      status,
    });

    console.log(`[QuoteService] Quote ${id} status changed to ${status}`);

    return QuoteRepository.getById(id);
  }

  /**
   * Validar transição de status
   */
  private validateStatusTransition(currentStatus: QuoteStatus, newStatus: QuoteStatus): void {
    const validTransitions: Record<QuoteStatus, QuoteStatus[]> = {
      'DRAFT': ['SENT', 'EXPIRED'],
      'SENT': ['APPROVED', 'REJECTED', 'EXPIRED'],
      'APPROVED': ['EXPIRED'],
      'REJECTED': ['EXPIRED', 'DRAFT'],
      'EXPIRED': ['DRAFT'], // Permite reativar orçamento expirado
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new Error(`Cannot transition from ${currentStatus} to ${newStatus}`);
    }
  }

  /**
   * Enviar orçamento para o cliente
   */
  async sendQuote(id: string): Promise<Quote | null> {
    return this.updateStatus(id, 'SENT');
  }

  /**
   * Aprovar orçamento
   */
  async approveQuote(id: string): Promise<Quote | null> {
    return this.updateStatus(id, 'APPROVED');
  }

  /**
   * Rejeitar orçamento
   */
  async rejectQuote(id: string): Promise<Quote | null> {
    return this.updateStatus(id, 'REJECTED');
  }

  /**
   * Reativar orçamento expirado (voltar para DRAFT)
   */
  async reactivateQuote(id: string): Promise<Quote | null> {
    return this.updateStatus(id, 'DRAFT');
  }

  /**
   * Excluir orçamento (marca como EXPIRED)
   */
  async deleteQuote(id: string): Promise<void> {
    const existing = await QuoteRepository.getById(id);
    if (!existing) {
      throw new Error(`Quote ${id} not found`);
    }

    // 1. Marcar como EXPIRED localmente
    await QuoteRepository.updateStatus(id, 'EXPIRED');

    // 2. Enfileirar mutação para sync
    await MutationQueue.enqueue('quotes', id, 'delete', {
      id,
      clientId: existing.clientId,
    });

    console.log(`[QuoteService] Quote ${id} deleted and queued for sync`);
  }

  /**
   * Buscar orçamento por ID
   */
  async getQuote(id: string): Promise<Quote | null> {
    return QuoteRepository.getById(id);
  }

  /**
   * Buscar orçamento por ID com itens
   */
  async getQuoteWithItems(id: string): Promise<QuoteWithItems | null> {
    return QuoteRepository.getByIdWithItems(id);
  }

  /**
   * Listar orçamentos com paginação
   */
  async listQuotes(
    page: number = 1,
    pageSize: number = 50,
    status?: QuoteStatus
  ): Promise<{ data: Quote[]; total: number; pages: number }> {
    if (!this.technicianId) {
      throw new Error('QuoteService not configured. Call configure() first.');
    }

    return QuoteRepository.getPaginated(this.technicianId, page, pageSize, status);
  }

  /**
   * Listar orçamentos por cliente
   */
  async listByClient(clientId: string): Promise<Quote[]> {
    if (!this.technicianId) {
      throw new Error('QuoteService not configured. Call configure() first.');
    }

    return QuoteRepository.getByClient(clientId, this.technicianId);
  }

  /**
   * Buscar orçamentos por texto
   */
  async searchQuotes(query: string, limit: number = 50): Promise<Quote[]> {
    if (!this.technicianId) {
      throw new Error('QuoteService not configured. Call configure() first.');
    }

    return QuoteRepository.search(this.technicianId, query, limit);
  }

  /**
   * Adicionar item ao orçamento
   */
  async addItem(quoteId: string, item: CreateQuoteItemInput): Promise<QuoteItem> {
    const quote = await QuoteRepository.getById(quoteId);
    if (!quote) {
      throw new Error(`Quote ${quoteId} not found`);
    }

    const now = new Date().toISOString();
    const itemId = uuidv4();
    const quantity = item.quantity;
    const unitPrice = item.unitPrice;
    const discountValue = item.discountValue || 0;
    const totalPrice = quantity * unitPrice - discountValue;

    const quoteItem: QuoteItem = {
      id: itemId,
      quoteId,
      itemId: item.itemId,
      name: item.name,
      type: item.type || 'SERVICE',
      unit: item.unit || 'un',
      quantity,
      unitPrice,
      discountValue,
      totalPrice,
      createdAt: now,
      updatedAt: now,
    };

    // 1. Adicionar item localmente
    await QuoteRepository.addItem(quoteItem);

    // 2. Recalcular total
    await QuoteRepository.recalculateTotal(quoteId);

    // 3. Buscar orçamento atualizado e enfileirar sync
    const updated = await QuoteRepository.getByIdWithItems(quoteId);
    if (updated) {
      await MutationQueue.enqueue('quotes', quoteId, 'update', {
        id: quoteId,
        clientId: updated.clientId,
        status: updated.status,
        discountValue: updated.discountValue,
        items: updated.items.map((i) => ({
          id: i.id,
          itemId: i.itemId,
          name: i.name,
          type: i.type,
          unit: i.unit,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discountValue: i.discountValue,
        })),
      });
    }

    return quoteItem;
  }

  /**
   * Remover item do orçamento
   */
  async removeItem(quoteId: string, itemId: string): Promise<void> {
    const quote = await QuoteRepository.getById(quoteId);
    if (!quote) {
      throw new Error(`Quote ${quoteId} not found`);
    }

    // 1. Remover item localmente
    await QuoteRepository.removeItem(itemId);

    // 2. Recalcular total
    await QuoteRepository.recalculateTotal(quoteId);

    // 3. Buscar orçamento atualizado e enfileirar sync
    const updated = await QuoteRepository.getByIdWithItems(quoteId);
    if (updated) {
      await MutationQueue.enqueue('quotes', quoteId, 'update', {
        id: quoteId,
        clientId: updated.clientId,
        status: updated.status,
        discountValue: updated.discountValue,
        items: updated.items.map((i) => ({
          id: i.id,
          itemId: i.itemId,
          name: i.name,
          type: i.type,
          unit: i.unit,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discountValue: i.discountValue,
        })),
      });
    }
  }

  /**
   * Obter estatísticas de orçamentos
   */
  async getStats(): Promise<{
    total: number;
    byStatus: Record<QuoteStatus, number>;
    pending: number;
  }> {
    if (!this.technicianId) {
      return {
        total: 0,
        byStatus: { DRAFT: 0, SENT: 0, APPROVED: 0, REJECTED: 0, EXPIRED: 0 },
        pending: 0,
      };
    }

    const statuses: QuoteStatus[] = ['DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'EXPIRED'];

    const [total, pending, ...statusCounts] = await Promise.all([
      QuoteRepository.count(this.technicianId),
      MutationQueue.countPending(),
      ...statuses.map((status) => QuoteRepository.count(this.technicianId!, status)),
    ]);

    const byStatus: Record<QuoteStatus, number> = {} as Record<QuoteStatus, number>;
    statuses.forEach((status, index) => {
      byStatus[status] = statusCounts[index];
    });

    return { total, byStatus, pending };
  }

  /**
   * Sincronizar orçamentos manualmente
   */
  async sync(): Promise<void> {
    await syncEngine.syncEntity('quotes');
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

export const QuoteService = new QuoteServiceClass();

export default QuoteService;
