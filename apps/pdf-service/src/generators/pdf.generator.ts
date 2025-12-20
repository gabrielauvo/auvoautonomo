import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import PDFDocument = require('pdfkit');

@Injectable()
export class PdfGenerator {
  private readonly logger = new Logger(PdfGenerator.name);

  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
  ) {}

  async generateQuotePdf(userId: string, quoteId: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, userId },
      include: {
        client: true,
        user: {
          select: { id: true, name: true, email: true },
        },
        items: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!quote) {
      throw new NotFoundException(`Orçamento ${quoteId} não encontrado`);
    }

    const buffer = await this.createQuotePdfBuffer(quote);
    const fileName = `orcamento_${quote.id.substring(0, 8).toUpperCase()}.pdf`;

    const result = await this.storageService.savePdf(userId, buffer, fileName, {
      quoteId: quote.id,
      clientId: quote.clientId,
      kind: 'QUOTE_PDF',
    });

    this.logger.log(`Quote PDF gerado: ${result.attachmentId}`);

    return result;
  }

  async generateWorkOrderPdf(userId: string, workOrderId: string) {
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, userId },
      include: {
        client: true,
        user: {
          select: { id: true, name: true, email: true },
        },
        items: {
          orderBy: { createdAt: 'asc' },
        },
        checklists: {
          include: {
            answers: true,
          },
        },
        checklistInstances: {
          include: {
            template: true,
            answers: {
              include: {
                attachments: true,
              },
            },
          },
        },
        signatures: {
          include: {
            attachment: true,
          },
        },
        quote: {
          select: { id: true, totalValue: true },
        },
      },
    });

    if (!workOrder) {
      throw new NotFoundException(`Ordem de Serviço ${workOrderId} não encontrada`);
    }

    const buffer = await this.createWorkOrderPdfBuffer(workOrder);
    const fileName = `os_${workOrder.id.substring(0, 8).toUpperCase()}.pdf`;

    const result = await this.storageService.savePdf(userId, buffer, fileName, {
      workOrderId: workOrder.id,
      clientId: workOrder.clientId,
      kind: 'WORK_ORDER_PDF',
    });

    this.logger.log(`Work Order PDF gerado: ${result.attachmentId}`);

    return result;
  }

  async generateInvoicePdf(userId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, userId },
      include: {
        client: true,
        user: {
          select: { id: true, name: true, email: true },
        },
        items: {
          orderBy: { createdAt: 'asc' },
        },
        payments: {
          orderBy: { dueDate: 'asc' },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Fatura ${invoiceId} não encontrada`);
    }

    const buffer = await this.createInvoicePdfBuffer(invoice);
    const fileName = `fatura_${invoice.id.substring(0, 8).toUpperCase()}.pdf`;

    const result = await this.storageService.savePdf(userId, buffer, fileName, {
      invoiceId: invoice.id,
      clientId: invoice.clientId,
      kind: 'INVOICE_PDF',
    });

    this.logger.log(`Invoice PDF gerado: ${result.attachmentId}`);

    return result;
  }

  // ==================== PDF BUFFER CREATION ====================

  private async createQuotePdfBuffer(quote: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      this.addHeader(doc, 'ORÇAMENTO');

      doc.fontSize(10)
        .text(`Nº: ${quote.id.substring(0, 8).toUpperCase()}`, { align: 'right' })
        .text(`Data: ${this.formatDate(quote.createdAt)}`, { align: 'right' })
        .text(`Status: ${this.translateQuoteStatus(quote.status)}`, { align: 'right' });

      doc.moveDown(2);

      this.addSection(doc, 'PRESTADOR DE SERVIÇO');
      doc.fontSize(10)
        .text(`Nome: ${quote.user.name || 'Não informado'}`)
        .text(`Email: ${quote.user.email}`);

      doc.moveDown();

      this.addSection(doc, 'CLIENTE');
      doc.fontSize(10)
        .text(`Nome: ${quote.client.name}`)
        .text(`Email: ${quote.client.email || 'Não informado'}`)
        .text(`Telefone: ${quote.client.phone || 'Não informado'}`)
        .text(`Endereço: ${this.formatAddress(quote.client)}`);

      doc.moveDown(2);

      this.addSection(doc, 'ITENS DO ORÇAMENTO');
      this.addItemsTable(doc, quote.items);

      doc.moveDown();

      const subtotal = quote.items.reduce(
        (sum: number, item: any) => sum + Number(item.totalPrice),
        0,
      );

      doc.fontSize(10)
        .text(`Subtotal: ${this.formatCurrency(subtotal)}`, { align: 'right' })
        .text(`Desconto: ${this.formatCurrency(Number(quote.discountValue))}`, { align: 'right' })
        .fontSize(12)
        .text(`TOTAL: ${this.formatCurrency(Number(quote.totalValue))}`, { align: 'right' });

      doc.moveDown(2);

      if (quote.notes) {
        this.addSection(doc, 'OBSERVAÇÕES');
        doc.fontSize(10).text(quote.notes);
      }

      doc.moveDown(2);
      this.addFooter(doc);
      doc.end();
    });
  }

  private async createWorkOrderPdfBuffer(workOrder: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      this.addHeader(doc, 'ORDEM DE SERVIÇO');

      doc.fontSize(10)
        .text(`Nº: ${workOrder.id.substring(0, 8).toUpperCase()}`, { align: 'right' })
        .text(`Data: ${this.formatDate(workOrder.createdAt)}`, { align: 'right' })
        .text(`Status: ${this.translateWorkOrderStatus(workOrder.status)}`, { align: 'right' });

      doc.moveDown(2);

      this.addSection(doc, 'PRESTADOR DE SERVIÇO');
      doc.fontSize(10)
        .text(`Nome: ${workOrder.user.name || 'Não informado'}`)
        .text(`Email: ${workOrder.user.email}`);

      doc.moveDown();

      this.addSection(doc, 'CLIENTE');
      doc.fontSize(10)
        .text(`Nome: ${workOrder.client.name}`)
        .text(`Email: ${workOrder.client.email || 'Não informado'}`)
        .text(`Telefone: ${workOrder.client.phone || 'Não informado'}`);

      doc.moveDown();

      this.addSection(doc, 'DETALHES DA OS');
      doc.fontSize(10)
        .text(`Título: ${workOrder.title}`)
        .text(`Descrição: ${workOrder.description || 'Não informada'}`)
        .text(`Endereço: ${workOrder.address || this.formatAddress(workOrder.client)}`);

      if (workOrder.scheduledDate) {
        doc.text(`Data Agendada: ${this.formatDate(workOrder.scheduledDate)}`);
      }
      if (workOrder.executionStart) {
        doc.text(`Início Execução: ${this.formatDateTime(workOrder.executionStart)}`);
      }
      if (workOrder.executionEnd) {
        doc.text(`Fim Execução: ${this.formatDateTime(workOrder.executionEnd)}`);
      }

      doc.moveDown(2);

      if (workOrder.items.length > 0) {
        this.addSection(doc, 'ITENS/SERVIÇOS');
        this.addItemsTable(doc, workOrder.items);
        doc.moveDown();

        if (workOrder.totalValue) {
          doc.fontSize(12)
            .text(`TOTAL: ${this.formatCurrency(Number(workOrder.totalValue))}`, { align: 'right' });
        }
        doc.moveDown();
      }

      // Checklists
      const allChecklists = [
        ...workOrder.checklists,
        ...workOrder.checklistInstances,
      ];

      if (allChecklists.length > 0) {
        this.addSection(doc, 'CHECKLISTS');
        for (const checklist of allChecklists) {
          const title = checklist.title || checklist.template?.name || 'Checklist';
          doc.fontSize(11).text(title, { underline: true });
          doc.moveDown(0.5);

          const answers = checklist.answers || [];
          for (const answer of answers) {
            const label = answer.templateItem?.label || answer.questionSnapshot?.label || 'Item';
            const value = this.getChecklistAnswerValue(answer);
            doc.fontSize(10).text(`• ${label}: ${value}`);
          }
          doc.moveDown();
        }
      }

      if (workOrder.notes) {
        this.addSection(doc, 'OBSERVAÇÕES');
        doc.fontSize(10).text(workOrder.notes);
        doc.moveDown();
      }

      if (workOrder.signatures.length > 0) {
        const signature = workOrder.signatures[0];
        this.addSection(doc, 'ASSINATURA');

        doc.fontSize(10)
          .text(`Assinado por: ${signature.signerName}`)
          .text(`Documento: ${signature.signerDocument || 'Não informado'}`)
          .text(`Função: ${signature.signerRole || 'Cliente'}`)
          .text(`Data/Hora: ${this.formatDateTime(signature.signedAt)}`);

        doc.moveDown(2);
      }

      this.addFooter(doc);
      doc.end();
    });
  }

  private async createInvoicePdfBuffer(invoice: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      this.addHeader(doc, 'FATURA');

      doc.fontSize(10)
        .text(`Nº: ${invoice.id.substring(0, 8).toUpperCase()}`, { align: 'right' })
        .text(`Data: ${this.formatDate(invoice.createdAt)}`, { align: 'right' })
        .text(`Status: ${this.translateInvoiceStatus(invoice.status)}`, { align: 'right' });

      doc.moveDown(2);

      this.addSection(doc, 'PRESTADOR DE SERVIÇO');
      doc.fontSize(10)
        .text(`Nome: ${invoice.user.name || 'Não informado'}`)
        .text(`Email: ${invoice.user.email}`);

      doc.moveDown();

      this.addSection(doc, 'CLIENTE');
      doc.fontSize(10)
        .text(`Nome: ${invoice.client.name}`)
        .text(`Email: ${invoice.client.email || 'Não informado'}`)
        .text(`Telefone: ${invoice.client.phone || 'Não informado'}`)
        .text(`Endereço: ${this.formatAddress(invoice.client)}`);

      doc.moveDown(2);

      if (invoice.items && invoice.items.length > 0) {
        this.addSection(doc, 'ITENS DA FATURA');
        this.addItemsTable(doc, invoice.items);
        doc.moveDown();
      }

      doc.fontSize(10)
        .text(`Subtotal: ${this.formatCurrency(Number(invoice.subtotal || 0))}`, { align: 'right' })
        .text(`Desconto: ${this.formatCurrency(Number(invoice.discount || 0))}`, { align: 'right' })
        .fontSize(12)
        .text(`TOTAL: ${this.formatCurrency(Number(invoice.totalValue))}`, { align: 'right' });

      doc.moveDown(2);

      if (invoice.payments && invoice.payments.length > 0) {
        this.addSection(doc, 'PAGAMENTOS');
        this.addPaymentsTable(doc, invoice.payments);
        doc.moveDown();
      }

      if (invoice.notes) {
        this.addSection(doc, 'OBSERVAÇÕES');
        doc.fontSize(10).text(invoice.notes);
      }

      doc.moveDown(2);
      this.addFooter(doc);
      doc.end();
    });
  }

  // ==================== PDF HELPERS ====================

  private addHeader(doc: any, title: string) {
    doc.fontSize(20).text(title, { align: 'center' });
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .stroke();
    doc.moveDown();
  }

  private addSection(doc: any, title: string) {
    doc.fontSize(12).text(title, { underline: true });
    doc.moveDown(0.5);
  }

  private addItemsTable(doc: any, items: any[]) {
    const tableTop = doc.y;
    const colWidths = [200, 60, 60, 80, 80];
    const headers = ['Item', 'Qtd', 'Unid', 'Preço Un.', 'Total'];

    let x = 50;
    doc.fontSize(9);
    headers.forEach((header, i) => {
      doc.text(header, x, tableTop, { width: colWidths[i], align: i === 0 ? 'left' : 'right' });
      x += colWidths[i];
    });

    doc.moveTo(50, tableTop + 15)
      .lineTo(545, tableTop + 15)
      .stroke();

    let y = tableTop + 20;
    items.forEach((item) => {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }

      x = 50;
      const rowData = [
        item.name,
        Number(item.quantity).toFixed(2),
        item.unit || 'un',
        this.formatCurrency(Number(item.unitPrice)),
        this.formatCurrency(Number(item.totalPrice)),
      ];

      rowData.forEach((data, i) => {
        doc.text(data, x, y, { width: colWidths[i], align: i === 0 ? 'left' : 'right' });
        x += colWidths[i];
      });

      y += 15;
    });

    doc.y = y;
  }

  private addPaymentsTable(doc: any, payments: any[]) {
    const tableTop = doc.y;
    const colWidths = [150, 100, 100, 100];
    const headers = ['Descrição', 'Vencimento', 'Valor', 'Status'];

    let x = 50;
    doc.fontSize(9);
    headers.forEach((header, i) => {
      doc.text(header, x, tableTop, { width: colWidths[i], align: i === 0 ? 'left' : 'center' });
      x += colWidths[i];
    });

    doc.moveTo(50, tableTop + 15)
      .lineTo(500, tableTop + 15)
      .stroke();

    let y = tableTop + 20;
    payments.forEach((payment) => {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }

      x = 50;
      const rowData = [
        payment.description || 'Pagamento',
        this.formatDate(payment.dueDate),
        this.formatCurrency(Number(payment.amount)),
        this.translatePaymentStatus(payment.status),
      ];

      rowData.forEach((data, i) => {
        doc.text(data, x, y, { width: colWidths[i], align: i === 0 ? 'left' : 'center' });
        x += colWidths[i];
      });

      y += 15;
    });

    doc.y = y;
  }

  private addFooter(doc: any) {
    const bottom = doc.page.height - 50;
    doc.fontSize(8)
      .text(
        `Documento gerado em ${this.formatDateTime(new Date())}`,
        50,
        bottom,
        { align: 'center' },
      );
  }

  private formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString('pt-BR');
  }

  private formatDateTime(date: Date | string): string {
    return new Date(date).toLocaleString('pt-BR');
  }

  private formatCurrency(value: number): string {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  private formatAddress(client: any): string {
    const parts = [
      client.address,
      client.city,
      client.state,
      client.zipCode,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'Não informado';
  }

  private translateQuoteStatus(status: string): string {
    const translations: Record<string, string> = {
      DRAFT: 'Rascunho',
      SENT: 'Enviado',
      APPROVED: 'Aprovado',
      REJECTED: 'Rejeitado',
      EXPIRED: 'Expirado',
    };
    return translations[status] || status;
  }

  private translateWorkOrderStatus(status: string): string {
    const translations: Record<string, string> = {
      SCHEDULED: 'Agendada',
      IN_PROGRESS: 'Em Andamento',
      DONE: 'Concluída',
      CANCELED: 'Cancelada',
    };
    return translations[status] || status;
  }

  private translateInvoiceStatus(status: string): string {
    const translations: Record<string, string> = {
      DRAFT: 'Rascunho',
      SENT: 'Enviada',
      PAID: 'Paga',
      PARTIALLY_PAID: 'Parcialmente Paga',
      OVERDUE: 'Vencida',
      CANCELED: 'Cancelada',
    };
    return translations[status] || status;
  }

  private translatePaymentStatus(status: string): string {
    const translations: Record<string, string> = {
      PENDING: 'Pendente',
      PAID: 'Pago',
      OVERDUE: 'Vencido',
      CANCELED: 'Cancelado',
    };
    return translations[status] || status;
  }

  private getChecklistAnswerValue(answer: any): string {
    if (answer.valueText) return answer.valueText;
    if (answer.valueNumber !== null && answer.valueNumber !== undefined) return answer.valueNumber.toString();
    if (answer.valueBoolean !== null && answer.valueBoolean !== undefined) return answer.valueBoolean ? 'Sim' : 'Não';
    if (answer.valueSelect) return answer.valueSelect;
    if (answer.valuePhoto) return '[Foto anexada]';
    return '-';
  }
}
