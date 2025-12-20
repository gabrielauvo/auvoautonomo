import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ExcelParserService } from '../excel-parser.service';
import * as ExcelJS from 'exceljs';

describe('ExcelParserService', () => {
  let service: ExcelParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ExcelParserService],
    }).compile();

    service = module.get<ExcelParserService>(ExcelParserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateFile', () => {
    it('should reject files larger than 5MB', () => {
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB

      expect(() =>
        service.validateFile(largeBuffer, 'test.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
      ).toThrow(BadRequestException);
    });

    it('should reject invalid extensions', () => {
      const buffer = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // Valid xlsx magic bytes

      expect(() =>
        service.validateFile(buffer, 'test.exe', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
      ).toThrow(BadRequestException);
    });

    it('should reject invalid MIME types', () => {
      const buffer = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

      expect(() =>
        service.validateFile(buffer, 'test.xlsx', 'application/octet-stream'),
      ).toThrow(BadRequestException);
    });

    it('should reject files with mismatched magic bytes', () => {
      // XLS magic bytes with xlsx extension
      const buffer = Buffer.from([0xd0, 0xcf, 0x11, 0xe0]);

      expect(() =>
        service.validateFile(buffer, 'test.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
      ).toThrow('O conteúdo do arquivo não corresponde à extensão');
    });

    it('should accept valid xlsx files', () => {
      // Valid xlsx magic bytes (PK - ZIP format)
      const buffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, ...Array(100).fill(0)]);

      expect(() =>
        service.validateFile(buffer, 'clientes.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
      ).not.toThrow();
    });

    it('should accept valid xls files', () => {
      // Valid xls magic bytes (Compound Document)
      const buffer = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, ...Array(100).fill(0)]);

      expect(() =>
        service.validateFile(buffer, 'clientes.xls', 'application/vnd.ms-excel'),
      ).not.toThrow();
    });

    it('should accept valid CSV files', () => {
      // Valid CSV content
      const buffer = Buffer.from('Nome,CPF,Telefone\nJoao,12345678900,62999999999');

      expect(() =>
        service.validateFile(buffer, 'clientes.csv', 'text/csv'),
      ).not.toThrow();
    });
  });

  describe('parseExcel', () => {
    const createTestWorkbook = async (rows: any[][]): Promise<Buffer> => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Clientes');

      rows.forEach((row) => {
        sheet.addRow(row);
      });

      return Buffer.from(await workbook.xlsx.writeBuffer());
    };

    it('should parse valid Excel data', async () => {
      const buffer = await createTestWorkbook([
        ['Nome', 'CPF/CNPJ', 'Telefone', 'Email', 'Endereço', 'Cidade', 'Estado', 'CEP', 'Observações'],
        ['João Silva', '12345678909', '62999999999', 'joao@email.com', 'Rua A', 'Goiânia', 'GO', '74000000', 'Nota'],
      ]);

      const result = await service.parseExcel(buffer);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].name).toBe('João Silva');
      expect(result.rows[0].taxId).toBe('12345678909');
      expect(result.errors).toHaveLength(0);
    });

    it('should report errors for missing required fields', async () => {
      const buffer = await createTestWorkbook([
        ['Nome', 'CPF/CNPJ', 'Telefone'],
        ['', '12345678909', '62999999999'], // Missing name
        ['Maria', '', '62999999999'], // Missing taxId
        ['Pedro', '12345678909', ''], // Missing phone
      ]);

      const result = await service.parseExcel(buffer);

      expect(result.rows).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.field === 'name')).toBe(true);
      expect(result.errors.some((e) => e.field === 'taxId')).toBe(true);
      expect(result.errors.some((e) => e.field === 'phone')).toBe(true);
    });

    it('should validate CPF format', async () => {
      const buffer = await createTestWorkbook([
        ['Nome', 'CPF/CNPJ', 'Telefone'],
        ['João', '123', '62999999999'], // Invalid CPF
      ]);

      const result = await service.parseExcel(buffer);

      expect(result.rows).toHaveLength(0);
      expect(result.errors.some((e) => e.field === 'taxId' && e.message.includes('inválido'))).toBe(true);
    });

    it('should validate CNPJ format', async () => {
      // CNPJ válido: 11.222.333/0001-81 (com dígitos verificadores corretos)
      const buffer = await createTestWorkbook([
        ['Nome', 'CPF/CNPJ', 'Telefone'],
        ['Empresa', '11222333000181', '6232001234'],
      ]);

      const result = await service.parseExcel(buffer);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].taxId).toBe('11222333000181');
    });

    it('should validate email format', async () => {
      const buffer = await createTestWorkbook([
        ['Nome', 'CPF/CNPJ', 'Telefone', 'Email'],
        ['João', '12345678909', '62999999999', 'invalid-email'],
      ]);

      const result = await service.parseExcel(buffer);

      expect(result.errors.some((e) => e.field === 'email')).toBe(true);
    });

    it('should validate state (UF) format', async () => {
      const buffer = await createTestWorkbook([
        ['Nome', 'CPF/CNPJ', 'Telefone', 'Email', 'Endereço', 'Cidade', 'Estado'],
        ['João', '12345678909', '62999999999', '', '', '', 'XX'], // Invalid UF
      ]);

      const result = await service.parseExcel(buffer);

      expect(result.errors.some((e) => e.field === 'state')).toBe(true);
    });

    it('should limit rows to 1000', async () => {
      const rows = [['Nome', 'CPF/CNPJ', 'Telefone']];
      for (let i = 0; i < 1050; i++) {
        rows.push([`Cliente ${i}`, '12345678909', '62999999999']);
      }

      const buffer = await createTestWorkbook(rows);
      const result = await service.parseExcel(buffer);

      expect(result.totalRows).toBe(1000);
      expect(result.errors.some((e) => e.message.includes('Limite de 1000'))).toBe(true);
    });

    it('should skip empty rows', async () => {
      const buffer = await createTestWorkbook([
        ['Nome', 'CPF/CNPJ', 'Telefone'],
        ['João', '12345678909', '62999999999'],
        ['', '', ''], // Empty row
        ['Maria', '98765432100', '62988888888'],
      ]);

      const result = await service.parseExcel(buffer);

      expect(result.rows).toHaveLength(2);
    });
  });

  describe('Security: Formula Injection', () => {
    const createTestWorkbook = async (rows: any[][]): Promise<Buffer> => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Clientes');
      rows.forEach((row) => sheet.addRow(row));
      return Buffer.from(await workbook.xlsx.writeBuffer());
    };

    it('should sanitize formula injection with = prefix', async () => {
      const buffer = await createTestWorkbook([
        ['Nome', 'CPF/CNPJ', 'Telefone'],
        ['=CMD|calc.exe!A0', '12345678909', '62999999999'],
      ]);

      const result = await service.parseExcel(buffer);

      // O nome deve ser sanitizado, removendo o =
      expect(result.rows[0]?.name || '').not.toContain('=');
    });

    it('should sanitize formula injection with + prefix', async () => {
      const buffer = await createTestWorkbook([
        ['Nome', 'CPF/CNPJ', 'Telefone'],
        ['+cmd|calc', '12345678909', '62999999999'],
      ]);

      const result = await service.parseExcel(buffer);

      const name = result.rows[0]?.name || '';
      expect(name.startsWith('+')).toBe(false);
    });

    it('should sanitize formula injection with - prefix', async () => {
      const buffer = await createTestWorkbook([
        ['Nome', 'CPF/CNPJ', 'Telefone'],
        ['-1+1|cmd', '12345678909', '62999999999'],
      ]);

      const result = await service.parseExcel(buffer);

      const name = result.rows[0]?.name || '';
      expect(name.startsWith('-')).toBe(false);
    });

    it('should sanitize formula injection with @ prefix', async () => {
      const buffer = await createTestWorkbook([
        ['Nome', 'CPF/CNPJ', 'Telefone'],
        ['@SUM(A1:A10)', '12345678909', '62999999999'],
      ]);

      const result = await service.parseExcel(buffer);

      const name = result.rows[0]?.name || '';
      expect(name.startsWith('@')).toBe(false);
    });
  });

  describe('generateTemplate', () => {
    it('should generate a valid Excel template', async () => {
      const buffer = await service.generateTemplate();

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);

      // Verify it's a valid xlsx (ZIP format)
      expect(buffer[0]).toBe(0x50); // P
      expect(buffer[1]).toBe(0x4b); // K
    });

    it('should contain required columns', async () => {
      const buffer = await service.generateTemplate();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);

      const sheet = workbook.getWorksheet('Clientes');
      expect(sheet).toBeDefined();

      const headers = sheet?.getRow(1);
      const headerValues = [
        headers?.getCell(1).value,
        headers?.getCell(2).value,
        headers?.getCell(3).value,
      ];

      expect(headerValues).toContain('Nome *');
      expect(headerValues).toContain('CPF/CNPJ *');
      expect(headerValues).toContain('Telefone *');
    });

    it('should contain instructions sheet', async () => {
      const buffer = await service.generateTemplate();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);

      const instructionsSheet = workbook.getWorksheet('Instruções');
      expect(instructionsSheet).toBeDefined();
    });
  });
});
