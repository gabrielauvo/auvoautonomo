// @ts-nocheck
/**
 * Invoice Sync Configuration
 *
 * Configuração da entidade Invoice para sincronização 2-vias.
 * Alinhado com backend: GET /sync/invoices, POST /sync/invoices/mutations
 */

import { SyncEntityConfig } from '../../sync/types';
import { InvoiceStatus } from '../../db/schema';

// =============================================================================
// INVOICE TYPES
// =============================================================================

/**
 * SyncInvoice - Interface para sync
 *
 * Alinhado com backend SyncInvoiceDto
 */
export interface SyncInvoice {
  id: string;
  clientId: string;
  workOrderId?: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  dueDate: string;
  paidAt?: string;       // Server uses paidAt, local uses paidDate
  notes?: string;
  createdAt: string;
  updatedAt: string;
  // Local fields
  syncedAt?: string;
  technicianId: string;
  clientName?: string;
}

// =============================================================================
// SYNC CONFIGURATION
// =============================================================================

export const InvoiceSyncConfig: SyncEntityConfig<SyncInvoice> = {
  name: 'invoices',
  tableName: 'invoices',
  apiEndpoint: '/sync/invoices',
  apiMutationEndpoint: '/sync/invoices/mutations',
  cursorField: 'updatedAt',
  primaryKeys: ['id'],
  scopeField: 'technicianId',
  batchSize: 100,
  conflictResolution: 'last_write_wins',

  /**
   * Transform server data to local format
   */
  transformFromServer: (data: unknown): SyncInvoice => {
    const record = data as Record<string, unknown>;

    return {
      id: record.id as string,
      clientId: record.clientId as string,
      workOrderId: record.workOrderId as string | undefined,
      invoiceNumber: record.invoiceNumber as string,
      status: (record.status as string).toUpperCase() as InvoiceStatus,
      subtotal: Number(record.subtotal) || 0,
      tax: Number(record.tax) || 0,
      discount: Number(record.discount) || 0,
      total: Number(record.total) || 0,
      dueDate: record.dueDate as string,
      paidAt: record.paidAt as string | undefined,
      notes: record.notes as string | undefined,
      createdAt: record.createdAt as string,
      updatedAt: record.updatedAt as string,
      technicianId: record.technicianId as string,
      clientName: record.clientName as string | undefined,
    };
  },

  /**
   * Transform local data to server format
   */
  transformToServer: (data: SyncInvoice): unknown => {
    return {
      id: data.id,
      clientId: data.clientId,
      workOrderId: data.workOrderId || null,
      status: data.status,
      subtotal: data.subtotal,
      tax: data.tax,
      discount: data.discount,
      dueDate: data.dueDate,
      paidAt: data.paidAt || null,
      notes: data.notes || null,
    };
  },
};

export default InvoiceSyncConfig;
