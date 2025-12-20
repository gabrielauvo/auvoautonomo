import { Injectable, BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

export interface ParsedClientRow {
  rowNumber: number;
  name: string;
  taxId: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  notes?: string;
}

export interface ParsedExcelResult {
  rows: ParsedClientRow[];
  errors: ParseRowError[];
  totalRows: number;
}

export interface ParseRowError {
  row: number;
  field: string;
  value: string;
  message: string;
}

// Magic bytes for file type validation
const XLSX_MAGIC_BYTES = [0x50, 0x4b, 0x03, 0x04]; // PK (ZIP format)
const XLS_MAGIC_BYTES = [0xd0, 0xcf, 0x11, 0xe0]; // Compound Document

// MIME types aceitos
const ALLOWED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/vnd.ms-excel', // xls
  'text/csv',
  'application/csv',
];

// Extensions aceitas
const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

// Limites
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_ROWS = 1000;

// Caracteres que indicam fórmulas (injeção de fórmula Excel)
const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r', '\n'];

@Injectable()
export class ExcelParserService {
  /**
   * Valida o arquivo antes do parsing
   */
  validateFile(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
  ): void {
    // 1. Validar tamanho
    if (buffer.length > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `Arquivo muito grande. Tamanho máximo permitido: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      );
    }

    // 2. Validar extensão
    const extension = this.getFileExtension(originalName).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      throw new BadRequestException(
        `Extensão não permitida. Extensões aceitas: ${ALLOWED_EXTENSIONS.join(', ')}`,
      );
    }

    // 3. Validar MIME type
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      throw new BadRequestException(
        `Tipo de arquivo não permitido. Tipos aceitos: xlsx, xls, csv`,
      );
    }

    // 4. Validar magic bytes (assinatura do arquivo)
    if (!this.validateMagicBytes(buffer, extension)) {
      throw new BadRequestException(
        'O conteúdo do arquivo não corresponde à extensão. Possível arquivo malicioso.',
      );
    }
  }

  /**
   * Valida os magic bytes do arquivo
   */
  private validateMagicBytes(buffer: Buffer, extension: string): boolean {
    if (buffer.length < 4) return false;

    const firstBytes = Array.from(buffer.slice(0, 4));

    if (extension === '.xlsx') {
      // XLSX é um arquivo ZIP
      return this.arraysEqual(firstBytes, XLSX_MAGIC_BYTES);
    }

    if (extension === '.xls') {
      // XLS é Compound Document
      return this.arraysEqual(firstBytes, XLS_MAGIC_BYTES);
    }

    if (extension === '.csv') {
      // CSV deve começar com caracteres printáveis
      // Não deve começar com null bytes ou caracteres de controle (exceto BOM)
      const firstByte = buffer[0];
      // BOM UTF-8: EF BB BF ou caracteres printáveis
      if (firstByte === 0xef || (firstByte >= 0x20 && firstByte <= 0x7e)) {
        return true;
      }
      // Também aceitar números e letras
      if (
        (firstByte >= 0x30 && firstByte <= 0x39) || // 0-9
        (firstByte >= 0x41 && firstByte <= 0x5a) || // A-Z
        (firstByte >= 0x61 && firstByte <= 0x7a) // a-z
      ) {
        return true;
      }
      return false;
    }

    return false;
  }

  private arraysEqual(a: number[], b: number[]): boolean {
    return a.length === b.length && a.every((val, i) => val === b[i]);
  }

  private getFileExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? `.${parts[parts.length - 1]}` : '';
  }

  /**
   * Faz o parse do arquivo Excel
   */
  async parseExcel(buffer: Buffer): Promise<ParsedExcelResult> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new BadRequestException('Arquivo Excel vazio ou inválido');
    }

    const rows: ParsedClientRow[] = [];
    const errors: ParseRowError[] = [];
    let totalRows = 0;

    // Começar da linha 2 (linha 1 é o cabeçalho)
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Pular cabeçalho

      totalRows++;

      // Verificar limite de linhas
      if (totalRows > MAX_ROWS) {
        if (totalRows === MAX_ROWS + 1) {
          errors.push({
            row: rowNumber,
            field: 'geral',
            value: '',
            message: `Limite de ${MAX_ROWS} linhas excedido. Linhas extras serão ignoradas.`,
          });
        }
        return;
      }

      const parsedRow = this.parseRow(row, rowNumber, errors);
      if (parsedRow) {
        rows.push(parsedRow);
      }
    });

    return {
      rows,
      errors,
      totalRows: Math.min(totalRows, MAX_ROWS),
    };
  }

  /**
   * Faz o parse de uma linha do Excel
   */
  private parseRow(
    row: ExcelJS.Row,
    rowNumber: number,
    errors: ParseRowError[],
  ): ParsedClientRow | null {
    const getValue = (colIndex: number): string => {
      const cell = row.getCell(colIndex);
      let value = '';

      if (cell.value === null || cell.value === undefined) {
        return '';
      }

      // Tratar diferentes tipos de valor
      if (typeof cell.value === 'object') {
        if ('text' in cell.value) {
          value = String(cell.value.text);
        } else if ('result' in cell.value) {
          // Fórmula - usar resultado, não a fórmula
          value = String(cell.value.result || '');
        } else {
          value = String(cell.value);
        }
      } else {
        value = String(cell.value);
      }

      // Sanitizar o valor
      return this.sanitizeValue(value);
    };

    // Colunas do template:
    // A: Nome, B: CPF/CNPJ, C: Telefone, D: Email, E: Endereço, F: Cidade, G: Estado, H: CEP, I: Observações
    const name = getValue(1);
    const taxId = getValue(2);
    const phone = getValue(3);
    const email = getValue(4);
    const address = getValue(5);
    const city = getValue(6);
    const state = getValue(7);
    const zipCode = getValue(8);
    const notes = getValue(9);

    let hasError = false;

    // Validar campos obrigatórios
    if (!name || name.trim() === '') {
      errors.push({
        row: rowNumber,
        field: 'name',
        value: name,
        message: 'Nome é obrigatório',
      });
      hasError = true;
    }

    if (!taxId || taxId.trim() === '') {
      errors.push({
        row: rowNumber,
        field: 'taxId',
        value: taxId,
        message: 'CPF/CNPJ é obrigatório',
      });
      hasError = true;
    }

    if (!phone || phone.trim() === '') {
      errors.push({
        row: rowNumber,
        field: 'phone',
        value: phone,
        message: 'Telefone é obrigatório',
      });
      hasError = true;
    }

    // Validar CPF/CNPJ
    const cleanTaxId = this.cleanNumeric(taxId);
    if (cleanTaxId && !this.isValidCpfCnpj(cleanTaxId)) {
      errors.push({
        row: rowNumber,
        field: 'taxId',
        value: taxId,
        message: 'CPF/CNPJ inválido',
      });
      hasError = true;
    }

    // Validar email se fornecido
    if (email && email.trim() !== '' && !this.isValidEmail(email)) {
      errors.push({
        row: rowNumber,
        field: 'email',
        value: email,
        message: 'Email inválido',
      });
      hasError = true;
    }

    // Validar estado (UF) se fornecido
    if (state && state.trim() !== '' && !this.isValidUF(state)) {
      errors.push({
        row: rowNumber,
        field: 'state',
        value: state,
        message: 'UF inválida. Use 2 letras (ex: GO, SP)',
      });
      hasError = true;
    }

    // Se linha tem campos preenchidos mas tem erro, não incluir
    if (hasError) {
      return null;
    }

    // Se linha está completamente vazia, ignorar sem erro
    if (!name && !taxId && !phone) {
      return null;
    }

    return {
      rowNumber,
      name: name.trim(),
      taxId: cleanTaxId,
      phone: this.cleanPhone(phone),
      email: email?.trim() || undefined,
      address: address?.trim() || undefined,
      city: city?.trim() || undefined,
      state: state?.trim().toUpperCase() || undefined,
      zipCode: this.cleanNumeric(zipCode) || undefined,
      notes: notes?.trim() || undefined,
    };
  }

  /**
   * Sanitiza um valor removendo possíveis injeções de fórmula
   */
  private sanitizeValue(value: string): string {
    if (!value) return '';

    let sanitized = value.trim();

    // Remover caracteres de fórmula do início
    while (
      sanitized.length > 0 &&
      FORMULA_PREFIXES.includes(sanitized[0])
    ) {
      sanitized = sanitized.slice(1).trim();
    }

    // Remover caracteres de controle (exceto espaço, tab, newline)
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // Remover caracteres RTL/LTR override (usados para disfarçar extensões de arquivo)
    sanitized = sanitized.replace(/[\u202A-\u202E\u2066-\u2069\u200E\u200F]/g, '');

    // Limitar tamanho
    if (sanitized.length > 500) {
      sanitized = sanitized.substring(0, 500);
    }

    return sanitized;
  }

  /**
   * Limpa string deixando apenas números
   */
  private cleanNumeric(value: string): string {
    if (!value) return '';
    return value.replace(/\D/g, '');
  }

  /**
   * Limpa telefone deixando apenas números e +
   */
  private cleanPhone(value: string): string {
    if (!value) return '';
    return value.replace(/[^\d+]/g, '');
  }

  /**
   * Valida CPF ou CNPJ
   */
  private isValidCpfCnpj(value: string): boolean {
    const clean = value.replace(/\D/g, '');

    if (clean.length === 11) {
      return this.isValidCpf(clean);
    }

    if (clean.length === 14) {
      return this.isValidCnpj(clean);
    }

    return false;
  }

  private isValidCpf(cpf: string): boolean {
    if (cpf.length !== 11) return false;

    // Verificar se todos os dígitos são iguais
    if (/^(\d)\1+$/.test(cpf)) return false;

    // Validar dígitos verificadores
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cpf.charAt(i)) * (10 - i);
    }
    let remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.charAt(9))) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cpf.charAt(i)) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.charAt(10))) return false;

    return true;
  }

  private isValidCnpj(cnpj: string): boolean {
    if (cnpj.length !== 14) return false;

    // Verificar se todos os dígitos são iguais
    if (/^(\d)\1+$/.test(cnpj)) return false;

    // Validar dígitos verificadores
    let size = cnpj.length - 2;
    let numbers = cnpj.substring(0, size);
    const digits = cnpj.substring(size);
    let sum = 0;
    let pos = size - 7;

    for (let i = size; i >= 1; i--) {
      sum += parseInt(numbers.charAt(size - i)) * pos--;
      if (pos < 2) pos = 9;
    }

    let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(0))) return false;

    size = size + 1;
    numbers = cnpj.substring(0, size);
    sum = 0;
    pos = size - 7;

    for (let i = size; i >= 1; i--) {
      sum += parseInt(numbers.charAt(size - i)) * pos--;
      if (pos < 2) pos = 9;
    }

    result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(1))) return false;

    return true;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }

  private isValidUF(uf: string): boolean {
    const validUFs = [
      'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
      'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
      'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
    ];
    return validUFs.includes(uf.trim().toUpperCase());
  }

  /**
   * Gera o arquivo modelo Excel
   */
  async generateTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Auvo';
    workbook.created = new Date();

    // Aba de dados
    const dataSheet = workbook.addWorksheet('Clientes');

    // Configurar colunas
    dataSheet.columns = [
      { header: 'Nome *', key: 'name', width: 30 },
      { header: 'CPF/CNPJ *', key: 'taxId', width: 18 },
      { header: 'Telefone *', key: 'phone', width: 15 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Endereço', key: 'address', width: 40 },
      { header: 'Cidade', key: 'city', width: 20 },
      { header: 'Estado (UF)', key: 'state', width: 12 },
      { header: 'CEP', key: 'zipCode', width: 12 },
      { header: 'Observações', key: 'notes', width: 40 },
    ];

    // Estilizar cabeçalho
    const headerRow = dataSheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F46E5' }, // Indigo-600
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 25;

    // Adicionar linhas de exemplo
    dataSheet.addRow({
      name: 'João Silva',
      taxId: '12345678900',
      phone: '62999999999',
      email: 'joao@email.com',
      address: 'Rua das Flores, 123',
      city: 'Goiânia',
      state: 'GO',
      zipCode: '74000000',
      notes: 'Cliente VIP',
    });

    dataSheet.addRow({
      name: 'Empresa ABC Ltda',
      taxId: '12345678000199',
      phone: '6232001234',
      email: 'contato@empresaabc.com.br',
      address: 'Av. Anhanguera, 5000',
      city: 'Goiânia',
      state: 'GO',
      zipCode: '74043010',
      notes: '',
    });

    // Estilizar linhas de exemplo
    [2, 3].forEach((rowNum) => {
      const row = dataSheet.getRow(rowNum);
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3F4F6' }, // Gray-100
      };
      row.font = { italic: true, color: { argb: 'FF6B7280' } };
    });

    // Aba de instruções
    const instructionsSheet = workbook.addWorksheet('Instruções');
    instructionsSheet.getColumn(1).width = 80;

    const instructions = [
      'INSTRUÇÕES PARA IMPORTAÇÃO DE CLIENTES',
      '',
      'CAMPOS OBRIGATÓRIOS (marcados com *):',
      '  - Nome: Nome completo do cliente ou razão social',
      '  - CPF/CNPJ: Apenas números (11 dígitos para CPF, 14 para CNPJ)',
      '  - Telefone: Apenas números (com DDD)',
      '',
      'CAMPOS OPCIONAIS:',
      '  - Email: Email válido do cliente',
      '  - Endereço: Endereço completo',
      '  - Cidade: Nome da cidade',
      '  - Estado (UF): 2 letras (ex: GO, SP, RJ)',
      '  - CEP: 8 dígitos (apenas números)',
      '  - Observações: Notas adicionais sobre o cliente',
      '',
      'IMPORTANTE:',
      '  - Limite máximo: 1000 clientes por importação',
      '  - NÃO modifique os cabeçalhos da aba "Clientes"',
      '  - As linhas de exemplo podem ser apagadas ou sobrescritas',
      '  - CPF/CNPJ duplicado: o cliente existente será atualizado',
      '  - Tamanho máximo do arquivo: 5MB',
      '',
      'DICAS:',
      '  - Verifique os CPF/CNPJ antes de importar',
      '  - Use uma planilha por vez para facilitar a correção de erros',
      '  - Após a importação, você receberá um relatório detalhado',
    ];

    instructions.forEach((text, index) => {
      const row = instructionsSheet.getRow(index + 1);
      row.getCell(1).value = text;
      if (index === 0) {
        row.font = { bold: true, size: 14 };
      } else if (text.startsWith('CAMPOS') || text.startsWith('IMPORTANTE') || text.startsWith('DICAS')) {
        row.font = { bold: true };
      }
    });

    // Gerar buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
