import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  CustomersSearchDto,
  CustomersGetDto,
  CustomersCreateDto,
} from '../dto/tool-params/customers.dto';
import {
  WorkOrdersSearchDto,
  WorkOrdersCreateDto,
  WorkOrderItemDto,
  WorkOrderStatus,
} from '../dto/tool-params/work-orders.dto';
import {
  QuotesSearchDto,
  QuotesCreateDto,
  QuoteItemDto,
  QuoteStatus,
} from '../dto/tool-params/quotes.dto';
import {
  BillingPreviewChargeDto,
  BillingCreateChargeDto,
  BillingType,
} from '../dto/tool-params/billing.dto';
import { KbSearchDto, KnowledgeBaseCategory } from '../dto/tool-params/kb.dto';

describe('DTO Validation', () => {
  describe('CustomersSearchDto', () => {
    it('should pass with valid query', async () => {
      const dto = plainToInstance(CustomersSearchDto, {
        query: 'John Doe',
        limit: 20,
        offset: 0,
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with query too short', async () => {
      const dto = plainToInstance(CustomersSearchDto, {
        query: 'J',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('query');
    });

    it('should pass with optional hasOverduePayments', async () => {
      const dto = plainToInstance(CustomersSearchDto, {
        query: 'test',
        hasOverduePayments: true,
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with limit over 100', async () => {
      const dto = plainToInstance(CustomersSearchDto, {
        query: 'test',
        limit: 150,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('CustomersCreateDto', () => {
    it('should pass with valid data', async () => {
      const dto = plainToInstance(CustomersCreateDto, {
        idempotencyKey: 'key-1234567890',
        name: 'John Doe',
        email: 'john@example.com',
        phone: '11999999999',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail without idempotencyKey', async () => {
      const dto = plainToInstance(CustomersCreateDto, {
        name: 'John Doe',
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'idempotencyKey')).toBe(true);
    });

    it('should fail with idempotencyKey too short', async () => {
      const dto = plainToInstance(CustomersCreateDto, {
        idempotencyKey: 'short',
        name: 'John Doe',
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'idempotencyKey')).toBe(true);
    });

    it('should fail without name', async () => {
      const dto = plainToInstance(CustomersCreateDto, {
        idempotencyKey: 'key-1234567890',
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'name')).toBe(true);
    });

    it('should fail with invalid email', async () => {
      const dto = plainToInstance(CustomersCreateDto, {
        idempotencyKey: 'key-1234567890',
        name: 'John Doe',
        email: 'not-an-email',
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'email')).toBe(true);
    });

    it('should fail with invalid phone format', async () => {
      const dto = plainToInstance(CustomersCreateDto, {
        idempotencyKey: 'key-1234567890',
        name: 'John Doe',
        phone: '123', // Too short
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'phone')).toBe(true);
    });

    it('should fail with invalid state format', async () => {
      const dto = plainToInstance(CustomersCreateDto, {
        idempotencyKey: 'key-1234567890',
        name: 'John Doe',
        state: 'New York', // Should be 2 letters
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'state')).toBe(true);
    });

    it('should pass with valid taxId (CPF)', async () => {
      const dto = plainToInstance(CustomersCreateDto, {
        idempotencyKey: 'key-1234567890',
        name: 'John Doe',
        taxId: '12345678901', // 11 digits
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass with valid taxId (CNPJ)', async () => {
      const dto = plainToInstance(CustomersCreateDto, {
        idempotencyKey: 'key-1234567890',
        name: 'Company Inc',
        taxId: '12345678000199', // 14 digits
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('WorkOrdersCreateDto', () => {
    it('should pass with valid data', async () => {
      const dto = plainToInstance(WorkOrdersCreateDto, {
        idempotencyKey: 'key-1234567890',
        customerId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Fix AC unit',
        items: [
          { name: 'Labor', quantity: 2, unitPrice: 100 },
          { name: 'Parts', quantity: 1, unitPrice: 50 },
        ],
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail without customerId', async () => {
      const dto = plainToInstance(WorkOrdersCreateDto, {
        idempotencyKey: 'key-1234567890',
        title: 'Fix AC unit',
        items: [{ name: 'Labor', quantity: 2, unitPrice: 100 }],
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'customerId')).toBe(true);
    });

    it('should fail with invalid customerId format', async () => {
      const dto = plainToInstance(WorkOrdersCreateDto, {
        idempotencyKey: 'key-1234567890',
        customerId: 'not-a-uuid',
        title: 'Fix AC unit',
        items: [{ name: 'Labor', quantity: 2, unitPrice: 100 }],
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'customerId')).toBe(true);
    });

    it('should fail with empty items array', async () => {
      const dto = plainToInstance(WorkOrdersCreateDto, {
        idempotencyKey: 'key-1234567890',
        customerId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Fix AC unit',
        items: [],
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'items')).toBe(true);
    });

    it('should fail with title too short', async () => {
      const dto = plainToInstance(WorkOrdersCreateDto, {
        idempotencyKey: 'key-1234567890',
        customerId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'AB', // Too short
        items: [{ name: 'Labor', quantity: 2, unitPrice: 100 }],
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'title')).toBe(true);
    });
  });

  describe('BillingPreviewChargeDto', () => {
    it('should pass with valid data', async () => {
      const dto = plainToInstance(BillingPreviewChargeDto, {
        customerId: '550e8400-e29b-41d4-a716-446655440000',
        value: 100,
        billingType: 'PIX',
        dueDate: '2025-01-15',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with value below minimum', async () => {
      const dto = plainToInstance(BillingPreviewChargeDto, {
        customerId: '550e8400-e29b-41d4-a716-446655440000',
        value: 4, // Below R$ 5
        billingType: 'PIX',
        dueDate: '2025-01-15',
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'value')).toBe(true);
    });

    it('should fail with value above maximum', async () => {
      const dto = plainToInstance(BillingPreviewChargeDto, {
        customerId: '550e8400-e29b-41d4-a716-446655440000',
        value: 150000, // Above R$ 100,000
        billingType: 'PIX',
        dueDate: '2025-01-15',
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'value')).toBe(true);
    });

    it('should fail with invalid billingType', async () => {
      const dto = plainToInstance(BillingPreviewChargeDto, {
        customerId: '550e8400-e29b-41d4-a716-446655440000',
        value: 100,
        billingType: 'BITCOIN', // Invalid
        dueDate: '2025-01-15',
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'billingType')).toBe(true);
    });

    it('should fail with invalid dueDate format', async () => {
      const dto = plainToInstance(BillingPreviewChargeDto, {
        customerId: '550e8400-e29b-41d4-a716-446655440000',
        value: 100,
        billingType: 'PIX',
        dueDate: '15/01/2025', // Wrong format
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'dueDate')).toBe(true);
    });
  });

  describe('BillingCreateChargeDto', () => {
    it('should pass with valid data', async () => {
      const dto = plainToInstance(BillingCreateChargeDto, {
        idempotencyKey: 'key-1234567890',
        previewId: '550e8400-e29b-41d4-a716-446655440000',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail without previewId', async () => {
      const dto = plainToInstance(BillingCreateChargeDto, {
        idempotencyKey: 'key-1234567890',
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'previewId')).toBe(true);
    });
  });

  describe('KbSearchDto', () => {
    it('should pass with valid query', async () => {
      const dto = plainToInstance(KbSearchDto, {
        query: 'How do I create a customer?',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with query too short', async () => {
      const dto = plainToInstance(KbSearchDto, {
        query: 'AB', // Less than 3 chars
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'query')).toBe(true);
    });

    it('should pass with valid category', async () => {
      const dto = plainToInstance(KbSearchDto, {
        query: 'How to create charges?',
        category: 'billing',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with invalid category', async () => {
      const dto = plainToInstance(KbSearchDto, {
        query: 'How to do something?',
        category: 'invalid' as any,
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'category')).toBe(true);
    });

    it('should fail with limit above maximum', async () => {
      const dto = plainToInstance(KbSearchDto, {
        query: 'How to do something?',
        limit: 20, // Max is 10
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'limit')).toBe(true);
    });
  });
});
