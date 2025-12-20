// @ts-nocheck
/**
 * Invoice Service
 *
 * Serviço para gerenciar faturas (invoices) com suporte offline-first.
 * - Operações CRUD salvam localmente primeiro
 * - Mutações são enfileiradas para sync
 * - Busca local com fallback online
 */

import { v4 as uuidv4 } from 'uuid';
import { InvoiceRepository } from './InvoiceRepository';
import { MutationQueue } from '../../queue/MutationQueue';
import { Invoice, InvoiceStatus } from '../../db/schema';
import { syncEngine } from '../../sync';

// =============================================================================
// TYPES
// =============================================================================

export interface CreateInvoiceInput {
  clientId: string;
  workOrderId?: string;
  subtotal: number;
  tax?: number;
  discount?: number;
  dueDate?: string;       // Default: 30 days from now
  notes?: string;
}

export interface UpdateInvoiceInput {
  subtotal?: number;
  tax?: number;
  discount?: number;
  dueDate?: string;
  notes?: string;
}

export interface InvoiceSearchResult {
  data: Invoice[];
  isLocal: boolean;
  total: number;
}

export interface FinancialSummary {
  totalPending: number;
  totalPaid: number;
  totalOverdue: number;
  countPending: number;
  countPaid: number;
  countOverdue: number;
}

// =============================================================================
// INVOICE SERVICE
// =============================================================================

class InvoiceServiceClass {
  private technicianId: string | null = null;

  /**
   * Configurar o serviço com o ID do técnico
   */
  configure(technicianId: string): void {
    this.technicianId = technicianId;
  }

  /**
   * Criar nova fatura
   * - Salva localmente (otimista)
   * - Enfileira mutação para sync
   */
  async createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
    if (!this.technicianId) {
      throw new Error('InvoiceService not configured. Call configure() first.');
    }

    const now = new Date().toISOString();
    const id = uuidv4();

    // Gerar número da fatura
    const invoiceNumber = await InvoiceRepository.generateInvoiceNumber(this.technicianId);

    // Calcular valores
    const subtotal = input.subtotal;
    const tax = input.tax || 0;
    const discount = input.discount || 0;
    const total = subtotal + tax - discount;

    // Data de vencimento padrão: 30 dias
    const dueDate = input.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const invoice: Invoice = {
      id,
      technicianId: this.technicianId,
      clientId: input.clientId,
      workOrderId: input.workOrderId || null,
      invoiceNumber,
      status: 'PENDING',
      subtotal,
      tax,
      discount,
      total,
      dueDate,
      paidDate: null,
      notes: input.notes || null,
      createdAt: now,
      updatedAt: now,
      syncedAt: null,
    };

    // 1. Salvar localmente
    await InvoiceRepository.create(invoice);

    // 2. Enfileirar mutação para sync
    await MutationQueue.enqueue('invoices', id, 'create', {
      id,
      clientId: input.clientId,
      workOrderId: input.workOrderId,
      status: 'PENDING',
      subtotal,
      tax,
      discount,
      dueDate,
      notes: input.notes,
    });

    console.log(`[InvoiceService] Invoice ${id} created and queued for sync`);

    return invoice;
  }

  /**
   * Atualizar fatura
   * - Salva localmente (otimista)
   * - Enfileira mutação para sync
   */
  async updateInvoice(id: string, input: UpdateInvoiceInput): Promise<Invoice | null> {
    const existing = await InvoiceRepository.getById(id);
    if (!existing) {
      throw new Error(`Invoice ${id} not found`);
    }

    // Não permitir edição de faturas pagas ou canceladas
    if (existing.status === 'PAID' || existing.status === 'CANCELLED') {
      throw new Error(`Cannot update invoice with status ${existing.status}`);
    }

    const now = new Date().toISOString();

    // Calcular novos valores
    const subtotal = input.subtotal ?? existing.subtotal;
    const tax = input.tax ?? existing.tax;
    const discount = input.discount ?? existing.discount;
    const total = subtotal + tax - discount;

    // Preparar dados de update
    const updateData: Partial<Invoice> = {
      subtotal,
      tax,
      discount,
      total,
      updatedAt: now,
    };

    if (input.dueDate !== undefined) updateData.dueDate = input.dueDate;
    if (input.notes !== undefined) updateData.notes = input.notes;

    // 1. Atualizar localmente
    await InvoiceRepository.update(id, updateData);

    // 2. Enfileirar mutação para sync
    await MutationQueue.enqueue('invoices', id, 'update', {
      id,
      clientId: existing.clientId,
      workOrderId: existing.workOrderId,
      status: existing.status,
      subtotal,
      tax,
      discount,
      dueDate: input.dueDate ?? existing.dueDate,
      notes: input.notes ?? existing.notes,
    });

    console.log(`[InvoiceService] Invoice ${id} updated and queued for sync`);

    return InvoiceRepository.getById(id);
  }

  /**
   * Atualizar status da fatura
   */
  async updateStatus(id: string, status: InvoiceStatus): Promise<Invoice | null> {
    const existing = await InvoiceRepository.getById(id);
    if (!existing) {
      throw new Error(`Invoice ${id} not found`);
    }

    // Validar transição de status
    this.validateStatusTransition(existing.status, status);

    const now = new Date().toISOString();

    // Preparar dados de update
    const updateData: Partial<Invoice> = {
      status,
      updatedAt: now,
    };

    // Se marcando como pago, registrar data de pagamento
    if (status === 'PAID') {
      updateData.paidDate = now;
    }

    // 1. Atualizar localmente
    await InvoiceRepository.update(id, updateData);

    // 2. Enfileirar mutação para sync
    await MutationQueue.enqueue('invoices', id, 'update', {
      id,
      clientId: existing.clientId,
      status,
      paidAt: status === 'PAID' ? now : existing.paidDate,
    });

    console.log(`[InvoiceService] Invoice ${id} status changed to ${status}`);

    return InvoiceRepository.getById(id);
  }

  /**
   * Validar transição de status
   */
  private validateStatusTransition(currentStatus: InvoiceStatus, newStatus: InvoiceStatus): void {
    const validTransitions: Record<InvoiceStatus, InvoiceStatus[]> = {
      'PENDING': ['PAID', 'OVERDUE', 'CANCELLED'],
      'OVERDUE': ['PAID', 'CANCELLED'],
      'PAID': [],              // Status final
      'CANCELLED': [],         // Status final
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new Error(`Cannot transition from ${currentStatus} to ${newStatus}`);
    }
  }

  /**
   * Marcar fatura como paga
   */
  async markAsPaid(id: string): Promise<Invoice | null> {
    return this.updateStatus(id, 'PAID');
  }

  /**
   * Cancelar fatura
   */
  async cancelInvoice(id: string): Promise<Invoice | null> {
    return this.updateStatus(id, 'CANCELLED');
  }

  /**
   * Marcar fatura como vencida
   */
  async markAsOverdue(id: string): Promise<Invoice | null> {
    return this.updateStatus(id, 'OVERDUE');
  }

  /**
   * Excluir fatura
   * - Remove localmente
   * - Enfileira mutação para sync
   */
  async deleteInvoice(id: string): Promise<void> {
    const existing = await InvoiceRepository.getById(id);
    if (!existing) {
      throw new Error(`Invoice ${id} not found`);
    }

    // Não permitir exclusão de faturas pagas
    if (existing.status === 'PAID') {
      throw new Error('Cannot delete paid invoice');
    }

    // 1. Cancelar localmente (soft delete via status)
    await InvoiceRepository.update(id, {
      status: 'CANCELLED',
      updatedAt: new Date().toISOString(),
    });

    // 2. Enfileirar mutação para sync
    await MutationQueue.enqueue('invoices', id, 'delete', {
      id,
      clientId: existing.clientId,
    });

    console.log(`[InvoiceService] Invoice ${id} deleted and queued for sync`);
  }

  /**
   * Buscar fatura por ID
   */
  async getInvoice(id: string): Promise<Invoice | null> {
    return InvoiceRepository.getById(id);
  }

  /**
   * Listar faturas com paginação
   */
  async listInvoices(
    page: number = 1,
    pageSize: number = 50,
    status?: InvoiceStatus
  ): Promise<{ data: Invoice[]; total: number; pages: number }> {
    if (!this.technicianId) {
      throw new Error('InvoiceService not configured. Call configure() first.');
    }

    return InvoiceRepository.getPaginated(this.technicianId, page, pageSize, status);
  }

  /**
   * Listar faturas por cliente
   */
  async listByClient(clientId: string): Promise<Invoice[]> {
    if (!this.technicianId) {
      throw new Error('InvoiceService not configured. Call configure() first.');
    }

    return InvoiceRepository.getByClient(clientId, this.technicianId);
  }

  /**
   * Buscar faturas por texto
   */
  async searchInvoices(query: string, limit: number = 50): Promise<Invoice[]> {
    if (!this.technicianId) {
      throw new Error('InvoiceService not configured. Call configure() first.');
    }

    return InvoiceRepository.search(this.technicianId, query, limit);
  }

  /**
   * Listar faturas vencidas
   */
  async getOverdueInvoices(): Promise<Invoice[]> {
    if (!this.technicianId) {
      throw new Error('InvoiceService not configured. Call configure() first.');
    }

    return InvoiceRepository.getOverdue(this.technicianId);
  }

  /**
   * Listar faturas próximas do vencimento (7 dias)
   */
  async getDueSoonInvoices(days: number = 7): Promise<Invoice[]> {
    if (!this.technicianId) {
      throw new Error('InvoiceService not configured. Call configure() first.');
    }

    return InvoiceRepository.getDueSoon(this.technicianId, days);
  }

  /**
   * Obter resumo financeiro
   */
  async getFinancialSummary(): Promise<FinancialSummary> {
    if (!this.technicianId) {
      return {
        totalPending: 0,
        totalPaid: 0,
        totalOverdue: 0,
        countPending: 0,
        countPaid: 0,
        countOverdue: 0,
      };
    }

    return InvoiceRepository.getFinancialSummary(this.technicianId);
  }

  /**
   * Obter estatísticas de faturas
   */
  async getStats(): Promise<{
    total: number;
    byStatus: Record<InvoiceStatus, number>;
    pending: number;
  }> {
    if (!this.technicianId) {
      return {
        total: 0,
        byStatus: { PENDING: 0, PAID: 0, OVERDUE: 0, CANCELLED: 0 },
        pending: 0,
      };
    }

    const statuses: InvoiceStatus[] = ['PENDING', 'PAID', 'OVERDUE', 'CANCELLED'];

    const [total, pending, ...statusCounts] = await Promise.all([
      InvoiceRepository.count(this.technicianId),
      MutationQueue.countPending(),
      ...statuses.map((status) => InvoiceRepository.count(this.technicianId!, status)),
    ]);

    const byStatus: Record<InvoiceStatus, number> = {} as Record<InvoiceStatus, number>;
    statuses.forEach((status, index) => {
      byStatus[status] = statusCounts[index];
    });

    return { total, byStatus, pending };
  }

  /**
   * Processar faturas vencidas automaticamente
   * - Marca como OVERDUE faturas com dueDate no passado
   */
  async processOverdueInvoices(): Promise<number> {
    if (!this.technicianId) {
      return 0;
    }

    const overdue = await InvoiceRepository.getOverdue(this.technicianId);
    let processed = 0;

    for (const invoice of overdue) {
      if (invoice.status === 'PENDING') {
        await this.markAsOverdue(invoice.id);
        processed++;
      }
    }

    if (processed > 0) {
      console.log(`[InvoiceService] Processed ${processed} overdue invoices`);
    }

    return processed;
  }

  /**
   * Sincronizar faturas manualmente
   */
  async sync(): Promise<void> {
    await syncEngine.syncEntity('invoices');
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

export const InvoiceService = new InvoiceServiceClass();

export default InvoiceService;
