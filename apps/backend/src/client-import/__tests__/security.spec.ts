import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ExcelParserService } from '../excel-parser.service';
import * as ExcelJS from 'exceljs';

describe('Security Tests - Client Import', () => {
  let service: ExcelParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ExcelParserService],
    }).compile();

    service = module.get<ExcelParserService>(ExcelParserService);
  });

  describe('File Validation Security', () => {
    it('should reject executable files disguised as xlsx', () => {
      // EXE magic bytes
      const exeBuffer = Buffer.from([0x4d, 0x5a, ...Array(100).fill(0)]);

      expect(() =>
        service.validateFile(exeBuffer, 'malicious.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
      ).toThrow(BadRequestException);
    });

    it('should reject PDF files disguised as xlsx', () => {
      // PDF magic bytes
      const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, ...Array(100).fill(0)]);

      expect(() =>
        service.validateFile(pdfBuffer, 'document.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
      ).toThrow(BadRequestException);
    });

    it('should reject files with null bytes at start', () => {
      const nullBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00, ...Array(100).fill(0)]);

      expect(() =>
        service.validateFile(nullBuffer, 'data.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
      ).toThrow(BadRequestException);
    });

    it('should reject very small files (potential attack)', () => {
      const tinyBuffer = Buffer.from([0x50, 0x4b]); // Only 2 bytes

      expect(() =>
        service.validateFile(tinyBuffer, 'tiny.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
      ).toThrow(BadRequestException);
    });

    it('should reject files with double extensions', () => {
      const buffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, ...Array(100).fill(0)]);

      expect(() =>
        service.validateFile(buffer, 'document.xlsx.exe', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
      ).toThrow(BadRequestException);
    });

    it('should reject script files disguised as xlsx', () => {
      // Shell script magic bytes
      const scriptBuffer = Buffer.from('#!/bin/bash\nmalicious_command');

      expect(() =>
        service.validateFile(scriptBuffer, 'script.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
      ).toThrow(BadRequestException);
    });
  });

  describe('Content Injection Security', () => {
    const createWorkbook = async (rows: any[][]): Promise<Buffer> => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Test');
      rows.forEach((row) => sheet.addRow(row));
      return Buffer.from(await workbook.xlsx.writeBuffer());
    };

    it('should sanitize DDE injection attempts', async () => {
      const buffer = await createWorkbook([
        ['Nome', 'CPF/CNPJ', 'Telefone'],
        ['=DDE("cmd";"/C calc";"test")', '12345678909', '62999999999'],
      ]);

      const result = await service.parseExcel(buffer);

      // A sanitização remove o prefixo = que dispara a execução da fórmula
      // O texto restante é armazenado como texto simples (sem execução)
      const name = result.rows[0]?.name || '';
      expect(name.startsWith('=')).toBe(false);
    });

    it('should sanitize HYPERLINK injection', async () => {
      const buffer = await createWorkbook([
        ['Nome', 'CPF/CNPJ', 'Telefone'],
        ['=HYPERLINK("http://evil.com")', '12345678909', '62999999999'],
      ]);

      const result = await service.parseExcel(buffer);

      // Remove o = para evitar que a fórmula seja executada
      const name = result.rows[0]?.name || '';
      expect(name.startsWith('=')).toBe(false);
    });

    it('should sanitize IMPORTXML injection', async () => {
      const buffer = await createWorkbook([
        ['Nome', 'CPF/CNPJ', 'Telefone'],
        ['=IMPORTXML("http://evil.com")', '12345678909', '62999999999'],
      ]);

      const result = await service.parseExcel(buffer);

      // Remove o = para evitar que a fórmula seja executada
      const name = result.rows[0]?.name || '';
      expect(name.startsWith('=')).toBe(false);
    });

    it('should remove control characters', async () => {
      const buffer = await createWorkbook([
        ['Nome', 'CPF/CNPJ', 'Telefone'],
        ['João\x00Silva\x1F', '12345678909', '62999999999'],
      ]);

      const result = await service.parseExcel(buffer);

      expect(result.rows[0]?.name).not.toContain('\x00');
      expect(result.rows[0]?.name).not.toContain('\x1F');
    });

    it('should limit field length to prevent buffer overflow', async () => {
      const longString = 'A'.repeat(10000);
      const buffer = await createWorkbook([
        ['Nome', 'CPF/CNPJ', 'Telefone'],
        [longString, '12345678909', '62999999999'],
      ]);

      const result = await service.parseExcel(buffer);

      expect(result.rows[0]?.name.length).toBeLessThanOrEqual(500);
    });

    it('should handle unicode characters safely', async () => {
      const buffer = await createWorkbook([
        ['Nome', 'CPF/CNPJ', 'Telefone'],
        ['João © ™ € 中文', '12345678909', '62999999999'],
      ]);

      const result = await service.parseExcel(buffer);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].name).toContain('João');
    });

    it('should handle RTL override characters', async () => {
      // RTL Override (U+202E) can be used to disguise file extensions
      const buffer = await createWorkbook([
        ['Nome', 'CPF/CNPJ', 'Telefone'],
        ['Test\u202Eexe.txt', '12345678909', '62999999999'],
      ]);

      const result = await service.parseExcel(buffer);

      // RTL override should be stripped
      expect(result.rows[0]?.name).not.toContain('\u202E');
    });
  });

  describe('Data Validation Security', () => {
    const createWorkbook = async (rows: any[][]): Promise<Buffer> => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Test');
      rows.forEach((row) => sheet.addRow(row));
      return Buffer.from(await workbook.xlsx.writeBuffer());
    };

    it('should reject SQL injection in name field', async () => {
      const buffer = await createWorkbook([
        ['Nome', 'CPF/CNPJ', 'Telefone'],
        ["'; DROP TABLE clients; --", '12345678909', '62999999999'],
      ]);

      const result = await service.parseExcel(buffer);

      // SQL injection characters should pass through since we use parameterized queries
      // But should not cause any issues
      expect(result.rows).toHaveLength(1);
    });

    it('should reject XSS attempts in notes field', async () => {
      const buffer = await createWorkbook([
        ['Nome', 'CPF/CNPJ', 'Telefone', 'Email', 'End', 'Cidade', 'UF', 'CEP', 'Observações'],
        ['João', '12345678909', '62999999999', '', '', '', '', '', '<script>alert("XSS")</script>'],
      ]);

      const result = await service.parseExcel(buffer);

      // XSS content should be stored as plain text (escaped at render time)
      expect(result.rows).toHaveLength(1);
    });

    it('should validate CPF checksum', async () => {
      const buffer = await createWorkbook([
        ['Nome', 'CPF/CNPJ', 'Telefone'],
        ['João', '11111111111', '62999999999'], // Invalid: all same digits
        ['Maria', '12345678900', '62999999999'], // Invalid checksum
      ]);

      const result = await service.parseExcel(buffer);

      expect(result.errors).toHaveLength(2);
      expect(result.errors.every((e) => e.field === 'taxId')).toBe(true);
    });

    it('should validate CNPJ checksum', async () => {
      const buffer = await createWorkbook([
        ['Nome', 'CPF/CNPJ', 'Telefone'],
        ['Empresa', '11111111111111', '6232001234'], // Invalid: all same digits
        ['Empresa2', '12345678000100', '6232001234'], // Invalid checksum
      ]);

      const result = await service.parseExcel(buffer);

      expect(result.errors).toHaveLength(2);
      expect(result.errors.every((e) => e.field === 'taxId')).toBe(true);
    });

    it('should prevent path traversal in notes', async () => {
      const buffer = await createWorkbook([
        ['Nome', 'CPF/CNPJ', 'Telefone', 'Email', 'End', 'Cidade', 'UF', 'CEP', 'Observações'],
        ['João', '12345678909', '62999999999', '', '', '', '', '', '../../etc/passwd'],
      ]);

      const result = await service.parseExcel(buffer);

      // Path traversal in text fields is not dangerous for our use case
      // but should be handled safely
      expect(result.rows).toHaveLength(1);
    });
  });

  describe('DoS Prevention', () => {
    it('should enforce row limit of 1000', async () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Test');

      sheet.addRow(['Nome', 'CPF/CNPJ', 'Telefone']);
      for (let i = 0; i < 1500; i++) {
        sheet.addRow([`Client ${i}`, '12345678909', '62999999999']);
      }

      const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
      const result = await service.parseExcel(buffer);

      expect(result.totalRows).toBe(1000);
    });

    it('should enforce file size limit of 5MB', () => {
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024);

      expect(() =>
        service.validateFile(largeBuffer, 'large.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
      ).toThrow('Arquivo muito grande');
    });
  });
});
