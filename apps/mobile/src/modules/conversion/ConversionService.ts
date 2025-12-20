// @ts-nocheck
/**
 * Conversion Service
 *
 * Serviço para conversões entre entidades:
 * - OS -> Orçamento
 * - Orçamento -> Fatura
 *
 * Mantém referências e facilita fluxos de trabalho.
 */

import { v4 as uuidv4 } from 'uuid';
import { WorkOrder, Quote, Invoice, QuoteItem } from '../../db/schema';
import { QuoteService, CreateQuoteInput, QuoteWithItems } from '../quotes/QuoteService';
import { InvoiceService, CreateInvoiceInput } from '../invoices/InvoiceService';
import { workOrderService } from '../workorders/WorkOrderService';
import { ClientRepository } from '../../db/repositories/ClientRepository';

// =============================================================================
// TYPES
// =============================================================================

export interface WorkOrderToQuoteOptions {
  includeItems?: boolean;
  additionalItems?: {
    name: string;
    type?: 'SERVICE' | 'PRODUCT';
    unit?: string;
    quantity: number;
    unitPrice: number;
    discountValue?: number;
  }[];
  notes?: string;
  visitScheduledAt?: string;
  discountValue?: number;
}

export interface QuoteToInvoiceOptions {
  dueDate?: string;           // Default: 30 days from now
  tax?: number;               // Additional tax
  additionalDiscount?: number; // Additional discount
  notes?: string;
}

// =============================================================================
// CONVERSION SERVICE
// =============================================================================

class ConversionServiceClass {
  private technicianId: string | null = null;

  /**
   * Configurar o serviço com o ID do técnico
   */
  configure(technicianId: string): void {
    this.technicianId = technicianId;
  }

  /**
   * Converter Ordem de Serviço em Orçamento
   *
   * Cria um novo orçamento com base nos dados da OS:
   * - Cliente da OS
   * - Valor da OS como item de serviço (se > 0)
   * - Título da OS como nome do item
   * - Opcionalmente inclui itens adicionais
   */
  async workOrderToQuote(
    workOrderId: string,
    options: WorkOrderToQuoteOptions = {}
  ): Promise<QuoteWithItems> {
    if (!this.technicianId) {
      throw new Error('ConversionService not configured. Call configure() first.');
    }

    // Buscar OS
    const workOrder = await workOrderService.getWorkOrder(workOrderId);
    if (!workOrder) {
      throw new Error(`Work Order ${workOrderId} not found`);
    }

    // Preparar itens
    const items: CreateQuoteInput['items'] = [];

    // Adicionar valor da OS como item (se > 0)
    if (options.includeItems !== false && workOrder.totalValue && workOrder.totalValue > 0) {
      items.push({
        name: workOrder.title || 'Serviço',
        type: 'SERVICE',
        unit: 'un',
        quantity: 1,
        unitPrice: workOrder.totalValue,
        discountValue: 0,
      });
    }

    // Adicionar itens extras
    if (options.additionalItems?.length) {
      for (const item of options.additionalItems) {
        items.push({
          name: item.name,
          type: item.type || 'SERVICE',
          unit: item.unit || 'un',
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountValue: item.discountValue || 0,
        });
      }
    }

    // Se não tem itens, criar item placeholder
    if (items.length === 0) {
      items.push({
        name: workOrder.title || 'Serviço',
        type: 'SERVICE',
        unit: 'un',
        quantity: 1,
        unitPrice: 0,
        discountValue: 0,
      });
    }

    // Criar input do orçamento
    const quoteInput: CreateQuoteInput = {
      clientId: workOrder.clientId,
      notes: options.notes || workOrder.description || undefined,
      discountValue: options.discountValue || 0,
      visitScheduledAt: options.visitScheduledAt || workOrder.scheduledDate || undefined,
      items,
    };

    // Criar orçamento
    const quote = await QuoteService.createQuote(quoteInput);

    console.log(`[ConversionService] Created Quote ${quote.id} from WorkOrder ${workOrderId}`);

    return quote;
  }

  /**
   * Converter Orçamento em Fatura
   *
   * Cria uma nova fatura com base nos dados do orçamento:
   * - Cliente do orçamento
   * - Total do orçamento como subtotal
   * - Opcionalmente adiciona taxas e descontos extras
   */
  async quoteToInvoice(
    quoteId: string,
    options: QuoteToInvoiceOptions = {}
  ): Promise<Invoice> {
    if (!this.technicianId) {
      throw new Error('ConversionService not configured. Call configure() first.');
    }

    // Buscar orçamento com itens
    const quote = await QuoteService.getQuoteWithItems(quoteId);
    if (!quote) {
      throw new Error(`Quote ${quoteId} not found`);
    }

    // Verificar se o orçamento pode ser convertido
    if (quote.status !== 'APPROVED') {
      throw new Error(`Cannot convert quote with status ${quote.status}. Quote must be APPROVED.`);
    }

    // Calcular valores
    const subtotal = quote.totalValue;
    const tax = options.tax || 0;
    const discount = options.additionalDiscount || 0;

    // Preparar data de vencimento
    let dueDate: string;
    if (options.dueDate) {
      dueDate = options.dueDate;
    } else {
      const defaultDue = new Date();
      defaultDue.setDate(defaultDue.getDate() + 30);
      dueDate = defaultDue.toISOString();
    }

    // Criar input da fatura
    const invoiceInput: CreateInvoiceInput = {
      clientId: quote.clientId,
      subtotal,
      tax,
      discount,
      dueDate,
      notes: options.notes || quote.notes || undefined,
    };

    // Criar fatura
    const invoice = await InvoiceService.createInvoice(invoiceInput);

    console.log(`[ConversionService] Created Invoice ${invoice.id} from Quote ${quoteId}`);

    return invoice;
  }

  /**
   * Converter Ordem de Serviço diretamente em Fatura
   *
   * Atalho que pula a etapa do orçamento.
   */
  async workOrderToInvoice(
    workOrderId: string,
    options: {
      tax?: number;
      discount?: number;
      dueDate?: string;
      notes?: string;
    } = {}
  ): Promise<Invoice> {
    if (!this.technicianId) {
      throw new Error('ConversionService not configured. Call configure() first.');
    }

    // Buscar OS
    const workOrder = await workOrderService.getWorkOrder(workOrderId);
    if (!workOrder) {
      throw new Error(`Work Order ${workOrderId} not found`);
    }

    // Calcular valores
    const subtotal = workOrder.totalValue || 0;
    const tax = options.tax || 0;
    const discount = options.discount || 0;

    // Preparar data de vencimento
    let dueDate: string;
    if (options.dueDate) {
      dueDate = options.dueDate;
    } else {
      const defaultDue = new Date();
      defaultDue.setDate(defaultDue.getDate() + 30);
      dueDate = defaultDue.toISOString();
    }

    // Criar input da fatura
    const invoiceInput: CreateInvoiceInput = {
      clientId: workOrder.clientId,
      workOrderId: workOrderId,
      subtotal,
      tax,
      discount,
      dueDate,
      notes: options.notes || workOrder.description || undefined,
    };

    // Criar fatura
    const invoice = await InvoiceService.createInvoice(invoiceInput);

    console.log(`[ConversionService] Created Invoice ${invoice.id} from WorkOrder ${workOrderId}`);

    return invoice;
  }

  /**
   * Obter informações de conversão para uma OS
   */
  async getWorkOrderConversionInfo(workOrderId: string): Promise<{
    canConvert: boolean;
    reason?: string;
    suggestedItems: {
      name: string;
      type: 'SERVICE' | 'PRODUCT';
      quantity: number;
      unitPrice: number;
    }[];
    clientName?: string;
    totalValue?: number;
  }> {
    const workOrder = await workOrderService.getWorkOrder(workOrderId);

    if (!workOrder) {
      return {
        canConvert: false,
        reason: 'Work order not found',
        suggestedItems: [],
      };
    }

    // Verificar se a OS pode ser convertida
    if (workOrder.status !== 'DONE') {
      return {
        canConvert: false,
        reason: `Work order must be DONE to convert. Current status: ${workOrder.status}`,
        suggestedItems: [],
        clientName: workOrder.clientName,
        totalValue: workOrder.totalValue,
      };
    }

    // Sugerir itens baseados na OS
    const suggestedItems: {
      name: string;
      type: 'SERVICE' | 'PRODUCT';
      quantity: number;
      unitPrice: number;
    }[] = [];

    if (workOrder.totalValue && workOrder.totalValue > 0) {
      suggestedItems.push({
        name: workOrder.title || 'Serviço Realizado',
        type: 'SERVICE',
        quantity: 1,
        unitPrice: workOrder.totalValue,
      });
    }

    return {
      canConvert: true,
      suggestedItems,
      clientName: workOrder.clientName,
      totalValue: workOrder.totalValue,
    };
  }

  /**
   * Obter informações de conversão para um orçamento
   */
  async getQuoteConversionInfo(quoteId: string): Promise<{
    canConvert: boolean;
    reason?: string;
    clientName?: string;
    totalValue?: number;
    itemsCount?: number;
  }> {
    const quote = await QuoteService.getQuoteWithItems(quoteId);

    if (!quote) {
      return {
        canConvert: false,
        reason: 'Quote not found',
      };
    }

    // Verificar se o orçamento pode ser convertido
    if (quote.status !== 'APPROVED') {
      return {
        canConvert: false,
        reason: `Quote must be APPROVED to convert to invoice. Current status: ${quote.status}`,
        clientName: quote.clientName,
        totalValue: quote.totalValue,
        itemsCount: quote.items.length,
      };
    }

    return {
      canConvert: true,
      clientName: quote.clientName,
      totalValue: quote.totalValue,
      itemsCount: quote.items.length,
    };
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

export const ConversionService = new ConversionServiceClass();

export default ConversionService;
