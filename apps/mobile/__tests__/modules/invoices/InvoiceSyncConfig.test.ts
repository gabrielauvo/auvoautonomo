/**
 * InvoiceSyncConfig Tests
 *
 * Testes para a configuração de sincronização de faturas.
 */

import { InvoiceSyncConfig, SyncInvoice } from '../../../src/modules/invoices/InvoiceSyncConfig';

describe('InvoiceSyncConfig', () => {
  describe('configuration properties', () => {
    it('should have correct entity name', () => {
      expect(InvoiceSyncConfig.name).toBe('invoices');
    });

    it('should have correct table name', () => {
      expect(InvoiceSyncConfig.tableName).toBe('invoices');
    });

    it('should have correct API endpoints', () => {
      expect(InvoiceSyncConfig.apiEndpoint).toBe('/sync/invoices');
      expect(InvoiceSyncConfig.apiMutationEndpoint).toBe('/sync/invoices/mutations');
    });

    it('should use updatedAt as cursor field', () => {
      expect(InvoiceSyncConfig.cursorField).toBe('updatedAt');
    });

    it('should have correct primary key', () => {
      expect(InvoiceSyncConfig.primaryKeys).toEqual(['id']);
    });

    it('should use technicianId as scope field', () => {
      expect(InvoiceSyncConfig.scopeField).toBe('technicianId');
    });

    it('should have batch size of 100', () => {
      expect(InvoiceSyncConfig.batchSize).toBe(100);
    });

    it('should use last_write_wins for conflict resolution', () => {
      expect(InvoiceSyncConfig.conflictResolution).toBe('last_write_wins');
    });
  });

  describe('transformFromServer', () => {
    it('should transform server invoice to local format', () => {
      const serverData = {
        id: 'inv-1',
        clientId: 'client-1',
        workOrderId: 'wo-1',
        invoiceNumber: 'INV-2024-001',
        status: 'pending',
        subtotal: 500,
        tax: 50,
        discount: 25,
        total: 525,
        dueDate: '2024-02-15T00:00:00.000Z',
        paidAt: null,
        notes: 'Test invoice',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-15T00:00:00.000Z',
        technicianId: 'tech-1',
        clientName: 'João Silva',
      };

      const result = InvoiceSyncConfig.transformFromServer(serverData);

      expect(result.id).toBe('inv-1');
      expect(result.clientId).toBe('client-1');
      expect(result.workOrderId).toBe('wo-1');
      expect(result.invoiceNumber).toBe('INV-2024-001');
      expect(result.status).toBe('PENDING');
      expect(result.subtotal).toBe(500);
      expect(result.tax).toBe(50);
      expect(result.discount).toBe(25);
      expect(result.total).toBe(525);
      expect(result.technicianId).toBe('tech-1');
      expect(result.clientName).toBe('João Silva');
    });

    it('should uppercase status', () => {
      const serverData = {
        id: 'inv-1',
        clientId: 'client-1',
        invoiceNumber: 'INV-001',
        status: 'paid',
        subtotal: 100,
        tax: 0,
        discount: 0,
        total: 100,
        dueDate: '2024-01-15T00:00:00.000Z',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        technicianId: 'tech-1',
      };

      const result = InvoiceSyncConfig.transformFromServer(serverData);

      expect(result.status).toBe('PAID');
    });

    it('should handle all status types', () => {
      const statuses = ['pending', 'sent', 'paid', 'overdue', 'cancelled'];

      for (const status of statuses) {
        const serverData = {
          id: 'inv-1',
          clientId: 'client-1',
          invoiceNumber: 'INV-001',
          status,
          subtotal: 100,
          tax: 0,
          discount: 0,
          total: 100,
          dueDate: '2024-01-15T00:00:00.000Z',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          technicianId: 'tech-1',
        };

        const result = InvoiceSyncConfig.transformFromServer(serverData);
        expect(result.status).toBe(status.toUpperCase());
      }
    });

    it('should handle missing optional fields', () => {
      const serverData = {
        id: 'inv-1',
        clientId: 'client-1',
        invoiceNumber: 'INV-001',
        status: 'pending',
        subtotal: 100,
        tax: 0,
        discount: 0,
        total: 100,
        dueDate: '2024-01-15T00:00:00.000Z',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        technicianId: 'tech-1',
      };

      const result = InvoiceSyncConfig.transformFromServer(serverData);

      expect(result.workOrderId).toBeUndefined();
      expect(result.paidAt).toBeUndefined();
      expect(result.notes).toBeUndefined();
      expect(result.clientName).toBeUndefined();
    });

    it('should convert numeric strings to numbers', () => {
      const serverData = {
        id: 'inv-1',
        clientId: 'client-1',
        invoiceNumber: 'INV-001',
        status: 'pending',
        subtotal: '500.50',
        tax: '50.25',
        discount: '25.75',
        total: '525',
        dueDate: '2024-01-15T00:00:00.000Z',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        technicianId: 'tech-1',
      };

      const result = InvoiceSyncConfig.transformFromServer(serverData);

      expect(result.subtotal).toBe(500.5);
      expect(result.tax).toBe(50.25);
      expect(result.discount).toBe(25.75);
      expect(result.total).toBe(525);
    });

    it('should handle null/undefined numeric values as 0', () => {
      const serverData = {
        id: 'inv-1',
        clientId: 'client-1',
        invoiceNumber: 'INV-001',
        status: 'pending',
        subtotal: null,
        tax: undefined,
        discount: '',
        total: 0,
        dueDate: '2024-01-15T00:00:00.000Z',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        technicianId: 'tech-1',
      };

      const result = InvoiceSyncConfig.transformFromServer(serverData);

      expect(result.subtotal).toBe(0);
      expect(result.tax).toBe(0);
      expect(result.discount).toBe(0);
      expect(result.total).toBe(0);
    });

    it('should include paidAt when invoice is paid', () => {
      const serverData = {
        id: 'inv-1',
        clientId: 'client-1',
        invoiceNumber: 'INV-001',
        status: 'paid',
        subtotal: 100,
        tax: 0,
        discount: 0,
        total: 100,
        dueDate: '2024-01-15T00:00:00.000Z',
        paidAt: '2024-01-10T14:30:00.000Z',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-10T00:00:00.000Z',
        technicianId: 'tech-1',
      };

      const result = InvoiceSyncConfig.transformFromServer(serverData);

      expect(result.paidAt).toBe('2024-01-10T14:30:00.000Z');
    });
  });

  describe('transformToServer', () => {
    it('should transform local invoice to server format', () => {
      const localInvoice: SyncInvoice = {
        id: 'inv-1',
        clientId: 'client-1',
        workOrderId: 'wo-1',
        invoiceNumber: 'INV-2024-001',
        status: 'PENDING',
        subtotal: 500,
        tax: 50,
        discount: 25,
        total: 525,
        dueDate: '2024-02-15T00:00:00.000Z',
        notes: 'Test notes',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-15T00:00:00.000Z',
        technicianId: 'tech-1',
      };

      const result = InvoiceSyncConfig.transformToServer(localInvoice) as any;

      expect(result.id).toBe('inv-1');
      expect(result.clientId).toBe('client-1');
      expect(result.workOrderId).toBe('wo-1');
      expect(result.status).toBe('PENDING');
      expect(result.subtotal).toBe(500);
      expect(result.tax).toBe(50);
      expect(result.discount).toBe(25);
      expect(result.dueDate).toBe('2024-02-15T00:00:00.000Z');
      expect(result.notes).toBe('Test notes');
    });

    it('should convert undefined workOrderId to null', () => {
      const localInvoice: SyncInvoice = {
        id: 'inv-1',
        clientId: 'client-1',
        invoiceNumber: 'INV-001',
        status: 'PENDING',
        subtotal: 100,
        tax: 0,
        discount: 0,
        total: 100,
        dueDate: '2024-01-15T00:00:00.000Z',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        technicianId: 'tech-1',
      };

      const result = InvoiceSyncConfig.transformToServer(localInvoice) as any;

      expect(result.workOrderId).toBeNull();
    });

    it('should convert undefined paidAt to null', () => {
      const localInvoice: SyncInvoice = {
        id: 'inv-1',
        clientId: 'client-1',
        invoiceNumber: 'INV-001',
        status: 'PENDING',
        subtotal: 100,
        tax: 0,
        discount: 0,
        total: 100,
        dueDate: '2024-01-15T00:00:00.000Z',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        technicianId: 'tech-1',
      };

      const result = InvoiceSyncConfig.transformToServer(localInvoice) as any;

      expect(result.paidAt).toBeNull();
    });

    it('should convert undefined notes to null', () => {
      const localInvoice: SyncInvoice = {
        id: 'inv-1',
        clientId: 'client-1',
        invoiceNumber: 'INV-001',
        status: 'PENDING',
        subtotal: 100,
        tax: 0,
        discount: 0,
        total: 100,
        dueDate: '2024-01-15T00:00:00.000Z',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        technicianId: 'tech-1',
      };

      const result = InvoiceSyncConfig.transformToServer(localInvoice) as any;

      expect(result.notes).toBeNull();
    });

    it('should include paidAt when invoice is paid', () => {
      const localInvoice: SyncInvoice = {
        id: 'inv-1',
        clientId: 'client-1',
        invoiceNumber: 'INV-001',
        status: 'PAID',
        subtotal: 100,
        tax: 0,
        discount: 0,
        total: 100,
        dueDate: '2024-01-15T00:00:00.000Z',
        paidAt: '2024-01-10T14:30:00.000Z',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-10T00:00:00.000Z',
        technicianId: 'tech-1',
      };

      const result = InvoiceSyncConfig.transformToServer(localInvoice) as any;

      expect(result.paidAt).toBe('2024-01-10T14:30:00.000Z');
    });

    it('should not include local-only fields', () => {
      const localInvoice: SyncInvoice = {
        id: 'inv-1',
        clientId: 'client-1',
        invoiceNumber: 'INV-001',
        status: 'PENDING',
        subtotal: 100,
        tax: 0,
        discount: 0,
        total: 100,
        dueDate: '2024-01-15T00:00:00.000Z',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        technicianId: 'tech-1',
        clientName: 'João Silva',
        syncedAt: '2024-01-01T00:00:00.000Z',
      };

      const result = InvoiceSyncConfig.transformToServer(localInvoice) as any;

      expect(result.technicianId).toBeUndefined();
      expect(result.clientName).toBeUndefined();
      expect(result.syncedAt).toBeUndefined();
      expect(result.createdAt).toBeUndefined();
      expect(result.updatedAt).toBeUndefined();
      expect(result.invoiceNumber).toBeUndefined();
      expect(result.total).toBeUndefined();
    });
  });
});
