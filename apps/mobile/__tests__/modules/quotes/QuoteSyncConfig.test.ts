/**
 * QuoteSyncConfig Tests
 *
 * Testes para a configuração de sincronização de orçamentos.
 */

// Mock database
const mockRunAsync = jest.fn();
const mockGetDatabase = jest.fn(() => Promise.resolve({
  runAsync: mockRunAsync,
}));

jest.mock('../../../src/db/database', () => ({
  getDatabase: () => mockGetDatabase(),
}));

import { QuoteSyncConfig, SyncQuote, SyncQuoteItem } from '../../../src/modules/quotes/QuoteSyncConfig';

describe('QuoteSyncConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRunAsync.mockResolvedValue(undefined);
  });

  describe('configuration properties', () => {
    it('should have correct entity name', () => {
      expect(QuoteSyncConfig.name).toBe('quotes');
    });

    it('should have correct table name', () => {
      expect(QuoteSyncConfig.tableName).toBe('quotes');
    });

    it('should have correct API endpoints', () => {
      expect(QuoteSyncConfig.apiEndpoint).toBe('/sync/quotes');
      expect(QuoteSyncConfig.apiMutationEndpoint).toBe('/sync/quotes/mutations');
    });

    it('should use updatedAt as cursor field', () => {
      expect(QuoteSyncConfig.cursorField).toBe('updatedAt');
    });

    it('should have correct primary key', () => {
      expect(QuoteSyncConfig.primaryKeys).toEqual(['id']);
    });

    it('should use technicianId as scope field', () => {
      expect(QuoteSyncConfig.scopeField).toBe('technicianId');
    });

    it('should have batch size of 100', () => {
      expect(QuoteSyncConfig.batchSize).toBe(100);
    });

    it('should use last_write_wins for conflict resolution', () => {
      expect(QuoteSyncConfig.conflictResolution).toBe('last_write_wins');
    });
  });

  describe('transformFromServer', () => {
    it('should transform server quote to local format', () => {
      const serverData = {
        id: 'quote-1',
        clientId: 'client-1',
        status: 'draft',
        discountValue: 50,
        totalValue: 500,
        notes: 'Test notes',
        sentAt: '2024-01-15T10:00:00.000Z',
        visitScheduledAt: '2024-01-20T10:00:00.000Z',
        items: [
          {
            id: 'item-1',
            quoteId: 'quote-1',
            itemId: 'catalog-1',
            name: 'Service A',
            type: 'SERVICE',
            unit: 'un',
            quantity: 2,
            unitPrice: 100,
            discountValue: 10,
            totalPrice: 190,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-15T00:00:00.000Z',
        technicianId: 'tech-1',
        clientName: 'João Silva',
      };

      const result = QuoteSyncConfig.transformFromServer(serverData);

      expect(result.id).toBe('quote-1');
      expect(result.clientId).toBe('client-1');
      expect(result.status).toBe('DRAFT');
      expect(result.discountValue).toBe(50);
      expect(result.totalValue).toBe(500);
      expect(result.notes).toBe('Test notes');
      expect(result.technicianId).toBe('tech-1');
      expect(result.clientName).toBe('João Silva');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('Service A');
    });

    it('should uppercase status', () => {
      const serverData = {
        id: 'quote-1',
        clientId: 'client-1',
        status: 'sent',
        discountValue: 0,
        totalValue: 100,
        items: [],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        technicianId: 'tech-1',
      };

      const result = QuoteSyncConfig.transformFromServer(serverData);

      expect(result.status).toBe('SENT');
    });

    it('should handle missing optional fields', () => {
      const serverData = {
        id: 'quote-1',
        clientId: 'client-1',
        status: 'draft',
        discountValue: 0,
        totalValue: 0,
        items: [],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        technicianId: 'tech-1',
      };

      const result = QuoteSyncConfig.transformFromServer(serverData);

      expect(result.notes).toBeUndefined();
      expect(result.sentAt).toBeUndefined();
      expect(result.visitScheduledAt).toBeUndefined();
      expect(result.clientName).toBeUndefined();
    });

    it('should handle missing items array', () => {
      const serverData = {
        id: 'quote-1',
        clientId: 'client-1',
        status: 'draft',
        discountValue: 0,
        totalValue: 0,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        technicianId: 'tech-1',
      };

      const result = QuoteSyncConfig.transformFromServer(serverData);

      expect(result.items).toEqual([]);
    });

    it('should convert numeric strings to numbers', () => {
      const serverData = {
        id: 'quote-1',
        clientId: 'client-1',
        status: 'draft',
        discountValue: '50.5',
        totalValue: '500.75',
        items: [
          {
            id: 'item-1',
            quoteId: 'quote-1',
            name: 'Item',
            type: 'SERVICE',
            unit: 'un',
            quantity: '3',
            unitPrice: '100.5',
            discountValue: '10',
            totalPrice: '291.5',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        technicianId: 'tech-1',
      };

      const result = QuoteSyncConfig.transformFromServer(serverData);

      expect(result.discountValue).toBe(50.5);
      expect(result.totalValue).toBe(500.75);
      expect(result.items[0].quantity).toBe(3);
      expect(result.items[0].unitPrice).toBe(100.5);
    });
  });

  describe('transformToServer', () => {
    it('should transform local quote to server format', () => {
      const localQuote: SyncQuote = {
        id: 'quote-1',
        clientId: 'client-1',
        status: 'DRAFT',
        discountValue: 50,
        totalValue: 500,
        notes: 'Test notes',
        items: [
          {
            id: 'item-1',
            quoteId: 'quote-1',
            itemId: 'catalog-1',
            name: 'Service A',
            type: 'SERVICE',
            unit: 'un',
            quantity: 2,
            unitPrice: 100,
            discountValue: 10,
            totalPrice: 190,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        technicianId: 'tech-1',
      };

      const result = QuoteSyncConfig.transformToServer(localQuote) as any;

      expect(result.id).toBe('quote-1');
      expect(result.clientId).toBe('client-1');
      expect(result.status).toBe('DRAFT');
      expect(result.discountValue).toBe(50);
      expect(result.notes).toBe('Test notes');
      expect(result.items).toHaveLength(1);
    });

    it('should only include defined fields', () => {
      const partialQuote = {
        id: 'quote-1',
        clientId: 'client-1',
        status: 'APPROVED',
      };

      const result = QuoteSyncConfig.transformToServer(partialQuote) as any;

      expect(result.id).toBe('quote-1');
      expect(result.clientId).toBe('client-1');
      expect(result.status).toBe('APPROVED');
      expect(result.discountValue).toBeUndefined();
      expect(result.notes).toBeUndefined();
      expect(result.items).toBeUndefined();
    });

    it('should convert null notes to null', () => {
      const quote = {
        id: 'quote-1',
        clientId: 'client-1',
        notes: '',
      };

      const result = QuoteSyncConfig.transformToServer(quote) as any;

      expect(result.notes).toBeNull();
    });

    it('should transform items with defaults', () => {
      const quote = {
        id: 'quote-1',
        clientId: 'client-1',
        items: [
          {
            id: 'item-1',
            name: 'Manual Item',
            quantity: 1,
            unitPrice: 50,
          },
        ],
      };

      const result = QuoteSyncConfig.transformToServer(quote) as any;

      expect(result.items[0].type).toBe('SERVICE');
      expect(result.items[0].unit).toBe('un');
      expect(result.items[0].discountValue).toBe(0);
      expect(result.items[0].itemId).toBeNull();
    });
  });

  describe('customSave', () => {
    it('should do nothing for empty array', async () => {
      await QuoteSyncConfig.customSave!([], 'tech-1');

      expect(mockGetDatabase).not.toHaveBeenCalled();
      expect(mockRunAsync).not.toHaveBeenCalled();
    });

    it('should save quote to database', async () => {
      const quotes: SyncQuote[] = [
        {
          id: 'quote-1',
          clientId: 'client-1',
          status: 'DRAFT',
          discountValue: 0,
          totalValue: 100,
          items: [],
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          technicianId: 'tech-1',
        },
      ];

      await QuoteSyncConfig.customSave!(quotes, 'tech-1');

      // Should insert quote
      expect(mockRunAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO quotes'),
        expect.arrayContaining(['quote-1', 'client-1', 'DRAFT'])
      );

      // Should delete existing items
      expect(mockRunAsync).toHaveBeenCalledWith(
        'DELETE FROM quote_items WHERE quoteId = ?',
        ['quote-1']
      );
    });

    it('should save quote items', async () => {
      const quotes: SyncQuote[] = [
        {
          id: 'quote-1',
          clientId: 'client-1',
          status: 'DRAFT',
          discountValue: 0,
          totalValue: 200,
          items: [
            {
              id: 'item-1',
              quoteId: 'quote-1',
              name: 'Service A',
              type: 'SERVICE',
              unit: 'un',
              quantity: 2,
              unitPrice: 100,
              discountValue: 0,
              totalPrice: 200,
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
            },
          ],
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          technicianId: 'tech-1',
        },
      ];

      await QuoteSyncConfig.customSave!(quotes, 'tech-1');

      // Should insert item
      expect(mockRunAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO quote_items'),
        expect.arrayContaining(['item-1', 'quote-1', 'Service A', 'SERVICE'])
      );
    });

    it('should save multiple quotes', async () => {
      const quotes: SyncQuote[] = [
        {
          id: 'quote-1',
          clientId: 'client-1',
          status: 'DRAFT',
          discountValue: 0,
          totalValue: 100,
          items: [],
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          technicianId: 'tech-1',
        },
        {
          id: 'quote-2',
          clientId: 'client-2',
          status: 'SENT',
          discountValue: 10,
          totalValue: 200,
          items: [],
          createdAt: '2024-01-02T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
          technicianId: 'tech-1',
        },
      ];

      await QuoteSyncConfig.customSave!(quotes, 'tech-1');

      // Should have 2 INSERT OR REPLACE (for quotes) + 2 DELETE (for items)
      const insertCalls = mockRunAsync.mock.calls.filter(
        (call) => call[0].includes('INSERT OR REPLACE INTO quotes')
      );
      expect(insertCalls).toHaveLength(2);
    });

    it('should handle items with null itemId', async () => {
      const quotes: SyncQuote[] = [
        {
          id: 'quote-1',
          clientId: 'client-1',
          status: 'DRAFT',
          discountValue: 0,
          totalValue: 100,
          items: [
            {
              id: 'item-1',
              quoteId: 'quote-1',
              itemId: undefined, // Manual item, no catalog reference
              name: 'Manual Item',
              type: 'SERVICE',
              unit: 'un',
              quantity: 1,
              unitPrice: 100,
              discountValue: 0,
              totalPrice: 100,
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
            },
          ],
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          technicianId: 'tech-1',
        },
      ];

      await QuoteSyncConfig.customSave!(quotes, 'tech-1');

      // itemId should be null for manual items
      const itemInsertCall = mockRunAsync.mock.calls.find(
        (call) => call[0].includes('INSERT INTO quote_items')
      );
      expect(itemInsertCall).toBeDefined();
      expect(itemInsertCall![1]).toContain(null); // itemId is null
    });
  });
});
