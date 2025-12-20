/**
 * QuoteRepository Tests
 *
 * Testes para operações do repositório de orçamentos.
 */

// Mock database functions
const mockFindAll = jest.fn();
const mockFindById = jest.fn();
const mockFindOne = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockRemove = jest.fn();
const mockCount = jest.fn();
const mockRawQuery = jest.fn();

jest.mock('../../../src/db/database', () => ({
  findAll: (...args: unknown[]) => mockFindAll(...args),
  findById: (...args: unknown[]) => mockFindById(...args),
  findOne: (...args: unknown[]) => mockFindOne(...args),
  insert: (...args: unknown[]) => mockInsert(...args),
  update: (...args: unknown[]) => mockUpdate(...args),
  remove: (...args: unknown[]) => mockRemove(...args),
  count: (...args: unknown[]) => mockCount(...args),
  rawQuery: (...args: unknown[]) => mockRawQuery(...args),
}));

import { QuoteRepository } from '../../../src/modules/quotes/QuoteRepository';
import { Quote, QuoteItem, QuoteStatus } from '../../../src/db/schema';

describe('QuoteRepository', () => {
  const technicianId = 'tech-123';

  const mockQuote: Quote = {
    id: 'quote-1',
    clientId: 'client-1',
    clientName: 'John Doe',
    clientPhone: '1234567890',
    clientEmail: 'john@example.com',
    clientAddress: '123 Main St',
    status: 'DRAFT' as QuoteStatus,
    totalValue: 1000,
    discountValue: 100,
    notes: 'Test notes',
    validUntil: '2024-02-01T00:00:00.000Z',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    technicianId,
  };

  const mockQuoteItem: QuoteItem = {
    id: 'item-1',
    quoteId: 'quote-1',
    name: 'Test Service',
    description: 'Test description',
    quantity: 2,
    unitPrice: 500,
    totalPrice: 1000,
    type: 'SERVICE',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAll', () => {
    it('should return all quotes for a technician', async () => {
      mockFindAll.mockResolvedValue([mockQuote]);

      const result = await QuoteRepository.getAll(technicianId);

      expect(mockFindAll).toHaveBeenCalledWith('quotes', {
        where: { technicianId },
        orderBy: 'updatedAt',
        order: 'DESC',
      });
      expect(result).toEqual([mockQuote]);
    });

    it('should pass additional options', async () => {
      mockFindAll.mockResolvedValue([]);

      await QuoteRepository.getAll(technicianId, { limit: 10, offset: 5 });

      expect(mockFindAll).toHaveBeenCalledWith('quotes', {
        where: { technicianId },
        orderBy: 'updatedAt',
        order: 'DESC',
        limit: 10,
        offset: 5,
      });
    });
  });

  describe('getById', () => {
    it('should return quote by ID', async () => {
      mockFindById.mockResolvedValue(mockQuote);

      const result = await QuoteRepository.getById('quote-1');

      expect(mockFindById).toHaveBeenCalledWith('quotes', 'quote-1');
      expect(result).toEqual(mockQuote);
    });

    it('should return null if quote not found', async () => {
      mockFindById.mockResolvedValue(null);

      const result = await QuoteRepository.getById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getByIdWithItems', () => {
    it('should return quote with items', async () => {
      mockFindById.mockResolvedValue(mockQuote);
      mockFindAll.mockResolvedValue([mockQuoteItem]);

      const result = await QuoteRepository.getByIdWithItems('quote-1');

      expect(mockFindById).toHaveBeenCalledWith('quotes', 'quote-1');
      expect(mockFindAll).toHaveBeenCalledWith('quote_items', {
        where: { quoteId: 'quote-1' },
        orderBy: 'createdAt',
        order: 'ASC',
      });
      expect(result).toEqual({ ...mockQuote, items: [mockQuoteItem] });
    });

    it('should return null if quote not found', async () => {
      mockFindById.mockResolvedValue(null);

      const result = await QuoteRepository.getByIdWithItems('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getByClient', () => {
    it('should return quotes by client', async () => {
      mockFindAll.mockResolvedValue([mockQuote]);

      const result = await QuoteRepository.getByClient('client-1', technicianId);

      expect(mockFindAll).toHaveBeenCalledWith('quotes', {
        where: { clientId: 'client-1', technicianId },
        orderBy: 'updatedAt',
        order: 'DESC',
      });
      expect(result).toEqual([mockQuote]);
    });
  });

  describe('getByStatus', () => {
    it('should return quotes by status', async () => {
      mockFindAll.mockResolvedValue([mockQuote]);

      const result = await QuoteRepository.getByStatus(technicianId, 'DRAFT');

      expect(mockFindAll).toHaveBeenCalledWith('quotes', {
        where: { technicianId, status: 'DRAFT' },
        orderBy: 'updatedAt',
        order: 'DESC',
      });
      expect(result).toEqual([mockQuote]);
    });
  });

  describe('getPaginated', () => {
    it('should return paginated quotes with status filter', async () => {
      mockFindAll.mockResolvedValue([mockQuote]);
      mockCount.mockResolvedValue(100);

      const result = await QuoteRepository.getPaginated(technicianId, 1, 50, 'DRAFT');

      expect(mockFindAll).toHaveBeenCalledWith('quotes', {
        where: { technicianId, status: 'DRAFT' },
        orderBy: 'updatedAt',
        order: 'DESC',
        limit: 50,
        offset: 0,
      });
      expect(result).toEqual({
        data: [mockQuote],
        total: 100,
        pages: 2,
      });
    });

    it('should exclude EXPIRED quotes when no status filter', async () => {
      mockRawQuery
        .mockResolvedValueOnce([mockQuote])
        .mockResolvedValueOnce([{ total: 100 }]);

      const result = await QuoteRepository.getPaginated(technicianId);

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining("status != 'EXPIRED'"),
        [technicianId, 50, 0]
      );
      expect(result.data).toEqual([mockQuote]);
    });

    it('should calculate correct offset for page 2', async () => {
      mockFindAll.mockResolvedValue([]);
      mockCount.mockResolvedValue(100);

      await QuoteRepository.getPaginated(technicianId, 2, 50, 'SENT');

      expect(mockFindAll).toHaveBeenCalledWith('quotes', expect.objectContaining({
        offset: 50,
      }));
    });
  });

  describe('search', () => {
    it('should search quotes by query', async () => {
      mockRawQuery.mockResolvedValue([mockQuote]);

      const result = await QuoteRepository.search(technicianId, 'John');

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining("status != 'EXPIRED'"),
        [technicianId, '%John%', '%John%', 50]
      );
      expect(result).toEqual([mockQuote]);
    });

    it('should use custom limit', async () => {
      mockRawQuery.mockResolvedValue([]);

      await QuoteRepository.search(technicianId, 'test', 10);

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.any(String),
        [technicianId, '%test%', '%test%', 10]
      );
    });
  });

  describe('create', () => {
    it('should create a new quote with timestamps', async () => {
      mockInsert.mockResolvedValue(undefined);

      const newQuote = { ...mockQuote };
      delete (newQuote as Partial<Quote>).createdAt;
      delete (newQuote as Partial<Quote>).updatedAt;

      await QuoteRepository.create(newQuote);

      expect(mockInsert).toHaveBeenCalledWith('quotes', expect.objectContaining({
        id: mockQuote.id,
        clientId: mockQuote.clientId,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      }));
    });
  });

  describe('createWithItems', () => {
    it('should create quote and items', async () => {
      mockInsert.mockResolvedValue(undefined);

      const newQuote = { ...mockQuote };
      delete (newQuote as Partial<Quote>).createdAt;
      delete (newQuote as Partial<Quote>).updatedAt;

      const newItem = { ...mockQuoteItem };
      delete (newItem as Partial<QuoteItem>).createdAt;
      delete (newItem as Partial<QuoteItem>).updatedAt;

      await QuoteRepository.createWithItems(newQuote, [newItem]);

      // Should insert quote
      expect(mockInsert).toHaveBeenCalledWith('quotes', expect.objectContaining({
        id: mockQuote.id,
      }));
      // Should insert item
      expect(mockInsert).toHaveBeenCalledWith('quote_items', expect.objectContaining({
        quoteId: mockQuote.id,
      }));
    });
  });

  describe('update', () => {
    it('should update quote with new updatedAt', async () => {
      mockUpdate.mockResolvedValue(undefined);

      await QuoteRepository.update('quote-1', { notes: 'Updated notes' });

      expect(mockUpdate).toHaveBeenCalledWith('quotes', 'quote-1', {
        notes: 'Updated notes',
        updatedAt: expect.any(String),
      });
    });
  });

  describe('updateWithItems', () => {
    it('should update quote and replace items', async () => {
      mockUpdate.mockResolvedValue(undefined);
      mockRawQuery.mockResolvedValue(undefined);
      mockInsert.mockResolvedValue(undefined);

      const newItem = { ...mockQuoteItem, id: 'item-2' };
      delete (newItem as Partial<QuoteItem>).createdAt;
      delete (newItem as Partial<QuoteItem>).updatedAt;

      await QuoteRepository.updateWithItems('quote-1', { notes: 'Updated' }, [newItem]);

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM quote_items'),
        ['quote-1']
      );
      expect(mockInsert).toHaveBeenCalledWith('quote_items', expect.objectContaining({
        id: 'item-2',
        quoteId: 'quote-1',
      }));
    });
  });

  describe('updateStatus', () => {
    it('should update quote status', async () => {
      mockUpdate.mockResolvedValue(undefined);

      await QuoteRepository.updateStatus('quote-1', 'APPROVED');

      expect(mockUpdate).toHaveBeenCalledWith('quotes', 'quote-1', {
        status: 'APPROVED',
        updatedAt: expect.any(String),
      });
    });

    it('should set sentAt when status is SENT', async () => {
      mockUpdate.mockResolvedValue(undefined);

      await QuoteRepository.updateStatus('quote-1', 'SENT');

      expect(mockUpdate).toHaveBeenCalledWith('quotes', 'quote-1', {
        status: 'SENT',
        updatedAt: expect.any(String),
        sentAt: expect.any(String),
      });
    });
  });

  describe('delete', () => {
    it('should delete quote and items', async () => {
      mockRawQuery.mockResolvedValue(undefined);
      mockRemove.mockResolvedValue(undefined);

      await QuoteRepository.delete('quote-1');

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM quote_items'),
        ['quote-1']
      );
      expect(mockRemove).toHaveBeenCalledWith('quotes', 'quote-1');
    });
  });

  describe('count', () => {
    it('should return count with status filter', async () => {
      mockCount.mockResolvedValue(42);

      const result = await QuoteRepository.count(technicianId, 'DRAFT');

      expect(mockCount).toHaveBeenCalledWith('quotes', { technicianId, status: 'DRAFT' });
      expect(result).toBe(42);
    });

    it('should exclude EXPIRED when no status filter', async () => {
      mockRawQuery.mockResolvedValue([{ total: 42 }]);

      const result = await QuoteRepository.count(technicianId);

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining("status != 'EXPIRED'"),
        [technicianId]
      );
      expect(result).toBe(42);
    });
  });

  describe('getModifiedAfter', () => {
    it('should return quotes modified after date', async () => {
      mockRawQuery.mockResolvedValue([mockQuote]);
      const afterDate = '2024-01-01T00:00:00.000Z';

      const result = await QuoteRepository.getModifiedAfter(technicianId, afterDate);

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('updatedAt > ?'),
        [technicianId, afterDate, 100]
      );
      expect(result).toEqual([mockQuote]);
    });
  });

  describe('batchUpsert', () => {
    it('should insert new quotes', async () => {
      mockFindById.mockResolvedValue(null);
      mockInsert.mockResolvedValue(undefined);

      await QuoteRepository.batchUpsert([mockQuote]);

      expect(mockInsert).toHaveBeenCalledWith('quotes', expect.objectContaining({
        id: mockQuote.id,
        syncedAt: expect.any(String),
      }));
    });

    it('should update existing quotes', async () => {
      mockFindById.mockResolvedValue(mockQuote);
      mockUpdate.mockResolvedValue(undefined);

      await QuoteRepository.batchUpsert([mockQuote]);

      expect(mockUpdate).toHaveBeenCalledWith('quotes', mockQuote.id, expect.objectContaining({
        syncedAt: expect.any(String),
      }));
    });

    it('should do nothing for empty array', async () => {
      await QuoteRepository.batchUpsert([]);

      expect(mockFindById).not.toHaveBeenCalled();
    });
  });

  describe('markSynced', () => {
    it('should update syncedAt timestamp', async () => {
      mockUpdate.mockResolvedValue(undefined);

      await QuoteRepository.markSynced('quote-1');

      expect(mockUpdate).toHaveBeenCalledWith('quotes', 'quote-1', {
        syncedAt: expect.any(String),
      });
    });
  });

  describe('getItems', () => {
    it('should return items for a quote', async () => {
      mockFindAll.mockResolvedValue([mockQuoteItem]);

      const result = await QuoteRepository.getItems('quote-1');

      expect(mockFindAll).toHaveBeenCalledWith('quote_items', {
        where: { quoteId: 'quote-1' },
        orderBy: 'createdAt',
        order: 'ASC',
      });
      expect(result).toEqual([mockQuoteItem]);
    });
  });

  describe('addItem', () => {
    it('should add item with timestamps', async () => {
      mockInsert.mockResolvedValue(undefined);

      const newItem = { ...mockQuoteItem };
      delete (newItem as Partial<QuoteItem>).createdAt;
      delete (newItem as Partial<QuoteItem>).updatedAt;

      await QuoteRepository.addItem(newItem);

      expect(mockInsert).toHaveBeenCalledWith('quote_items', expect.objectContaining({
        id: mockQuoteItem.id,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      }));
    });
  });

  describe('updateItem', () => {
    it('should update item with new updatedAt', async () => {
      mockUpdate.mockResolvedValue(undefined);

      await QuoteRepository.updateItem('item-1', { quantity: 5 });

      expect(mockUpdate).toHaveBeenCalledWith('quote_items', 'item-1', {
        quantity: 5,
        updatedAt: expect.any(String),
      });
    });
  });

  describe('removeItem', () => {
    it('should remove item', async () => {
      mockRemove.mockResolvedValue(undefined);

      await QuoteRepository.removeItem('item-1');

      expect(mockRemove).toHaveBeenCalledWith('quote_items', 'item-1');
    });
  });

  describe('batchUpsertItems', () => {
    it('should insert new items', async () => {
      mockFindById.mockResolvedValue(null);
      mockInsert.mockResolvedValue(undefined);

      await QuoteRepository.batchUpsertItems([mockQuoteItem]);

      expect(mockInsert).toHaveBeenCalledWith('quote_items', mockQuoteItem);
    });

    it('should update existing items', async () => {
      mockFindById.mockResolvedValue(mockQuoteItem);
      mockUpdate.mockResolvedValue(undefined);

      await QuoteRepository.batchUpsertItems([mockQuoteItem]);

      expect(mockUpdate).toHaveBeenCalledWith('quote_items', mockQuoteItem.id, mockQuoteItem);
    });

    it('should do nothing for empty array', async () => {
      await QuoteRepository.batchUpsertItems([]);

      expect(mockFindById).not.toHaveBeenCalled();
    });
  });

  describe('recalculateTotal', () => {
    it('should recalculate total from items', async () => {
      mockFindAll.mockResolvedValue([mockQuoteItem]);
      mockFindById.mockResolvedValue(mockQuote);
      mockUpdate.mockResolvedValue(undefined);

      const result = await QuoteRepository.recalculateTotal('quote-1');

      // itemsTotal = 1000, discountValue = 100, total = 900
      expect(result).toBe(900);
      expect(mockUpdate).toHaveBeenCalledWith('quotes', 'quote-1', {
        totalValue: 900,
        updatedAt: expect.any(String),
      });
    });

    it('should return 0 if quote not found', async () => {
      mockFindAll.mockResolvedValue([mockQuoteItem]);
      mockFindById.mockResolvedValue(null);

      const result = await QuoteRepository.recalculateTotal('non-existent');

      expect(result).toBe(0);
    });
  });
});
