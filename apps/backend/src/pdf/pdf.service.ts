import { Injectable, NotFoundException, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, TemplateSettings } from '@prisma/client';
import { FileStorageService } from '../file-storage/file-storage.service';
import { AttachmentType } from '../file-storage/dto/upload-file.dto';
import { SettingsService } from '../settings/settings.service';
import { StorageProvider, STORAGE_PROVIDER } from '../file-storage/providers/storage-provider.interface';
import PDFDocument = require('pdfkit');

// Type for multipart file
interface MulterFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
  fieldname: string;
  encoding: string;
}

// Default template settings for fallback
const DEFAULT_WORK_ORDER_TEMPLATE = {
  workOrderShowLogo: true,
  workOrderLogoPosition: 'left',
  workOrderPrimaryColor: '#7C3AED',
  workOrderLayout: 'detailed',
  workOrderShowChecklist: true,
  workOrderFooterText: null as string | null,
  workOrderShowSignatureField: true,
  workOrderSignatureLabel: 'Assinatura do Cliente',
};

const DEFAULT_QUOTE_TEMPLATE = {
  quoteShowLogo: true,
  quoteLogoPosition: 'left',
  quotePrimaryColor: '#7C3AED',
  quoteSecondaryColor: '#6D28D9',
  quoteHeaderText: null as string | null,
  quoteFooterText: 'Obrigado pela preferência!',
  quoteDefaultMessage: 'Segue nosso orçamento conforme solicitado.',
  quoteTermsConditions: null as string | null,
  quoteShowSignature: false,
};

const DEFAULT_INVOICE_TEMPLATE = {
  invoiceShowLogo: true,
  invoiceLogoPosition: 'left',
  invoicePrimaryColor: '#7C3AED',
  invoiceSecondaryColor: '#6D28D9',
  invoiceHeaderText: null as string | null,
  invoiceFooterText: 'Obrigado pela preferência!',
  invoiceShowPaymentInfo: true,
  invoiceShowDueDate: true,
};

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  constructor(
    private prisma: PrismaService,
    private fileStorageService: FileStorageService,
    private settingsService: SettingsService,
    @Inject(STORAGE_PROVIDER)
    private storageProvider: StorageProvider,
  ) {}

  /**
   * Generate PDF for a Quote
   */
  async generateQuotePdf(userId: string, quoteId: string): Promise<{
    attachmentId: string;
    buffer: Buffer;
  }> {
    this.logger.log(`[PDF] generateQuotePdf called: userId=${userId}, quoteId=${quoteId}`);

    // Fetch quote with all related data including signatures
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, userId },
      include: {
        client: true,
        user: {
          select: { id: true, name: true, email: true, companyName: true, companyLogoUrl: true },
        },
        items: {
          orderBy: { createdAt: 'asc' },
        },
        signatures: {
          include: {
            attachment: true,
          },
          orderBy: { signedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!quote) {
      this.logger.error(`[PDF] Quote not found: quoteId=${quoteId}, userId=${userId}`);
      throw new NotFoundException(`Quote with ID ${quoteId} not found`);
    }

    this.logger.log(`[PDF] Quote found: clientId=${quote.clientId}, items=${quote.items?.length || 0}`);

    // Get template settings
    this.logger.log(`[PDF] Getting template settings for userId=${userId}`);
    const templateSettings = await this.settingsService.getRawTemplateSettings(userId);
    this.logger.log(`[PDF] Template settings loaded: ${templateSettings ? 'yes' : 'no'}`);

    // Generate PDF
    this.logger.log(`[PDF] Creating PDF buffer...`);
    const buffer = await this.createQuotePdfBuffer(quote, templateSettings, quote.user.companyLogoUrl);
    this.logger.log(`[PDF] PDF buffer created: size=${buffer.length} bytes`);

    // Save as attachment
    const mockFile: MulterFile = {
      buffer,
      mimetype: 'application/pdf',
      originalname: `orcamento_${quote.id.substring(0, 8).toUpperCase()}.pdf`,
      size: buffer.length,
      fieldname: 'file',
      encoding: '7bit',
    };

    this.logger.log(`[PDF] Uploading PDF as attachment...`);
    let attachment;
    try {
      attachment = await this.fileStorageService.upload(userId, mockFile as any, {
        type: AttachmentType.DOCUMENT,
        quoteId: quote.id,
        clientId: quote.clientId,
        description: `PDF do Orçamento ${quote.id.substring(0, 8).toUpperCase()}`,
        category: 'QUOTE_PDF',
      });
      this.logger.log(`[PDF] Attachment uploaded successfully: ${attachment.id}`);
    } catch (uploadError: any) {
      this.logger.error(`[PDF] ERROR uploading attachment: ${uploadError.message}`);
      this.logger.error(`[PDF] Upload error details - userId: ${userId}, clientId: ${quote.clientId}, quoteId: ${quote.id}`);
      throw uploadError;
    }

    // Update attachment metadata
    await this.prisma.attachment.update({
      where: { id: attachment.id },
      data: {
        metadata: {
          kind: 'QUOTE_PDF',
          version: 1,
          generatedAt: new Date().toISOString(),
        } as Prisma.JsonObject,
      },
    });

    this.logger.log(`Quote PDF generated: ${attachment.id} for quote ${quoteId}`);

    return {
      attachmentId: attachment.id,
      buffer,
    };
  }

  /**
   * Generate PDF for a Work Order
   */
  async generateWorkOrderPdf(userId: string, workOrderId: string): Promise<{
    attachmentId: string;
    buffer: Buffer;
  }> {
    // Fetch work order with all related data
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, userId },
      include: {
        client: true,
        user: {
          select: { id: true, name: true, email: true, companyName: true, companyLogoUrl: true },
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
            template: {
              select: {
                id: true,
                name: true,
              },
            },
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
        attachments: {
          where: {
            type: { in: ['PHOTO', 'DOCUMENT'] },
          },
          orderBy: { createdAt: 'asc' },
        },
        quote: {
          select: { id: true, totalValue: true },
        },
      },
    });

    if (!workOrder) {
      throw new NotFoundException(`Work Order with ID ${workOrderId} not found`);
    }

    // Get template settings
    const templateSettings = await this.settingsService.getRawTemplateSettings(userId);

    // Generate PDF
    const buffer = await this.createWorkOrderPdfBuffer(workOrder, templateSettings, workOrder.user.companyLogoUrl);

    // Save as attachment
    const mockFile: MulterFile = {
      buffer,
      mimetype: 'application/pdf',
      originalname: `os_${workOrder.id.substring(0, 8).toUpperCase()}.pdf`,
      size: buffer.length,
      fieldname: 'file',
      encoding: '7bit',
    };

    const attachment = await this.fileStorageService.upload(userId, mockFile, {
      type: AttachmentType.DOCUMENT,
      workOrderId: workOrder.id,
      clientId: workOrder.clientId,
      description: `PDF da OS ${workOrder.id.substring(0, 8).toUpperCase()}`,
      category: 'WORK_ORDER_PDF',
    });

    // Update attachment metadata
    await this.prisma.attachment.update({
      where: { id: attachment.id },
      data: {
        metadata: {
          kind: 'WORK_ORDER_PDF',
          version: 1,
          generatedAt: new Date().toISOString(),
        } as Prisma.JsonObject,
      },
    });

    this.logger.log(`Work Order PDF generated: ${attachment.id} for WO ${workOrderId}`);

    return {
      attachmentId: attachment.id,
      buffer,
    };
  }

  /**
   * Generate PDF for an Invoice/Charge
   */
  async generateInvoicePdf(userId: string, invoiceId: string): Promise<{
    attachmentId: string;
    buffer: Buffer;
  }> {
    // Fetch invoice with all related data
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, userId },
      include: {
        client: true,
        user: {
          select: { id: true, name: true, email: true, companyName: true, companyLogoUrl: true },
        },
        workOrder: {
          include: {
            items: {
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${invoiceId} not found`);
    }

    // Get template settings
    const templateSettings = await this.settingsService.getRawTemplateSettings(userId);

    // Generate PDF
    const buffer = await this.createInvoicePdfBuffer(invoice, templateSettings, invoice.user.companyLogoUrl);

    // Save as attachment (no specific invoiceId field in Attachment model, use metadata)
    const mockFile: MulterFile = {
      buffer,
      mimetype: 'application/pdf',
      originalname: `fatura_${invoice.invoiceNumber}.pdf`,
      size: buffer.length,
      fieldname: 'file',
      encoding: '7bit',
    };

    const attachment = await this.fileStorageService.upload(userId, mockFile as any, {
      type: AttachmentType.DOCUMENT,
      clientId: invoice.clientId,
      workOrderId: invoice.workOrderId || undefined,
      description: `PDF da Fatura ${invoice.invoiceNumber}`,
      category: 'INVOICE_PDF',
    });

    // Update attachment metadata
    await this.prisma.attachment.update({
      where: { id: attachment.id },
      data: {
        metadata: {
          kind: 'INVOICE_PDF',
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          version: 1,
          generatedAt: new Date().toISOString(),
        } as Prisma.JsonObject,
      },
    });

    this.logger.log(`Invoice PDF generated: ${attachment.id} for invoice ${invoiceId}`);

    return {
      attachmentId: attachment.id,
      buffer,
    };
  }

  // ==================== PRIVATE PDF GENERATION ====================

  private async createQuotePdfBuffer(quote: any, settings: TemplateSettings | null, logoUrl?: string | null): Promise<Buffer> {
    this.logger.log(`Creating Quote PDF buffer for quote ${quote.id}`);
    this.logger.log(`Quote items count: ${quote.items?.length || 0}`);

    // Use settings or defaults
    const primaryColor = settings?.quotePrimaryColor || DEFAULT_QUOTE_TEMPLATE.quotePrimaryColor;
    const footerText = settings?.quoteFooterText || DEFAULT_QUOTE_TEMPLATE.quoteFooterText;
    const showSignature = settings?.quoteShowSignature ?? DEFAULT_QUOTE_TEMPLATE.quoteShowSignature;
    const termsAndConditions = settings?.quoteTermsConditions;
    const showLogo = settings?.quoteShowLogo ?? DEFAULT_QUOTE_TEMPLATE.quoteShowLogo;

    // Fetch logo buffer if available
    let logoBuffer: Buffer | null = null;
    if (showLogo && logoUrl) {
      logoBuffer = await this.fetchLogoBuffer(logoUrl);
    }

    // Pre-fetch signature buffer if exists
    let signatureBuffer: { buffer: Buffer; mimeType: string } | null = null;
    if (quote.signatures && quote.signatures.length > 0 && quote.signatures[0].attachment) {
      try {
        signatureBuffer = await this.fileStorageService.getFileBuffer(
          quote.userId,
          quote.signatures[0].attachment.id,
        );
      } catch (error) {
        this.logger.warn(`Error pre-loading quote signature image: ${error}`);
      }
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const margin = 40;
      const pageWidth = doc.page.width - margin * 2;
      let currentY = margin;

      // ===================== CABEÇALHO =====================
      const companyName = quote.user.companyName || quote.user.name || 'Sua Empresa';
      currentY = this.drawDocumentHeader(
        doc,
        'ORÇAMENTO',
        `#${quote.id.substring(0, 8).toUpperCase()}`,
        companyName,
        logoBuffer,
        primaryColor,
      );

      // ===================== INFORMAÇÕES DO ORÇAMENTO =====================
      currentY = this.drawSectionTitle(doc, 'Informações do orçamento', margin, currentY, pageWidth, primaryColor);

      const quoteInfoFields = [
        { label: 'Número', value: quote.id.substring(0, 8).toUpperCase() },
        { label: 'Data', value: this.formatDate(quote.createdAt) },
        { label: 'Validade', value: quote.validUntil ? this.formatDate(quote.validUntil) : '-' },
        { label: 'Status', value: this.translateStatus(quote.status) },
      ];

      currentY = this.drawInfoGrid(doc, quoteInfoFields, margin, currentY, {
        labelWidth: 85,
        valueWidth: 173,
        columns: 2,
        rowHeight: 22,
      });

      currentY += 10;

      // ===================== PRESTADOR DE SERVIÇO =====================
      currentY = this.drawSectionTitle(doc, 'Prestador de serviço', margin, currentY, pageWidth, primaryColor);

      const providerFields = [
        { label: 'Nome/Empresa', value: quote.user.companyName || quote.user.name || '-' },
        { label: 'Email', value: quote.user.email || '-' },
      ];

      currentY = this.drawInfoGrid(doc, providerFields, margin, currentY, {
        labelWidth: 85,
        valueWidth: 173,
        columns: 2,
        rowHeight: 22,
      });

      currentY += 10;

      // ===================== INFORMAÇÕES DO CLIENTE =====================
      currentY = this.drawSectionTitle(doc, 'Informações do cliente', margin, currentY, pageWidth, primaryColor);

      const clientFields = [
        { label: 'Nome', value: quote.client.name || '-' },
        { label: 'CPF/CNPJ', value: quote.client.taxId || '-' },
        { label: 'Email', value: quote.client.email || '-' },
        { label: 'Telefone', value: quote.client.phone || '-' },
        { label: 'Endereço', value: this.formatAddress(quote.client) },
        { label: 'Falar com', value: quote.client.contactName || quote.client.name },
      ];

      currentY = this.drawInfoGrid(doc, clientFields, margin, currentY, {
        labelWidth: 85,
        valueWidth: 173,
        columns: 2,
        rowHeight: 22,
      });

      currentY += 10;

      // ===================== ITENS DO ORÇAMENTO =====================
      currentY = this.drawSectionTitle(doc, 'Itens do orçamento', margin, currentY, pageWidth, primaryColor);

      const itemHeaders = [
        { text: 'Item', width: 200 },
        { text: 'Qtd', width: 60 },
        { text: 'Unidade', width: 60 },
        { text: 'Preço Un.', width: 90 },
        { text: 'Total', width: 106 },
      ];

      const itemRows = (quote.items || []).map((item: any) => [
        item.name || 'Item sem nome',
        (Number(item.quantity) || 0).toFixed(2),
        item.unit || 'un',
        this.formatCurrency(Number(item.unitPrice) || 0),
        this.formatCurrency(Number(item.totalPrice) || 0),
      ]);

      currentY = this.drawTable(doc, itemHeaders, itemRows, margin, currentY, {
        headerBgColor: '#E5E7EB',
        headerTextColor: '#374151',
      });

      // ===================== TOTAIS =====================
      currentY += 5;
      const subtotal = (quote.items || []).reduce(
        (sum: number, item: any) => sum + (Number(item.totalPrice) || 0),
        0,
      );

      // Draw totals as a mini table on the right
      const totalsX = margin + pageWidth - 200;
      const totalsFields = [
        { label: 'Subtotal', value: this.formatCurrency(subtotal) },
        { label: 'Desconto', value: this.formatCurrency(Number(quote.discountValue) || 0) },
      ];

      for (const field of totalsFields) {
        this.drawTableCell(doc, field.label, totalsX, currentY, 100, 20, {
          bgColor: '#F3F4F6',
          bold: true,
          fontSize: 9,
          align: 'right',
        });
        this.drawTableCell(doc, field.value, totalsX + 100, currentY, 100, 20, {
          fontSize: 9,
          align: 'right',
        });
        currentY += 20;
      }

      // Total highlight
      this.drawTableCell(doc, 'TOTAL', totalsX, currentY, 100, 24, {
        bgColor: primaryColor,
        textColor: '#FFFFFF',
        bold: true,
        fontSize: 11,
        align: 'right',
      });
      this.drawTableCell(doc, this.formatCurrency(Number(quote.totalValue) || 0), totalsX + 100, currentY, 100, 24, {
        bgColor: primaryColor,
        textColor: '#FFFFFF',
        bold: true,
        fontSize: 11,
        align: 'right',
      });
      currentY += 34;

      // ===================== OBSERVAÇÕES =====================
      if (quote.notes) {
        currentY = this.drawSectionTitle(doc, 'Observações', margin, currentY, pageWidth, primaryColor);

        const notesFields = [
          { label: 'Observações', value: quote.notes },
        ];
        currentY = this.drawInfoGrid(doc, notesFields, margin, currentY, {
          labelWidth: 85,
          valueWidth: pageWidth - 85,
          columns: 1,
          rowHeight: 40,
        });

        currentY += 10;
      }

      // ===================== TERMOS E CONDIÇÕES =====================
      if (termsAndConditions) {
        if (currentY > doc.page.height - 150) {
          doc.addPage();
          currentY = margin;
        }

        currentY = this.drawSectionTitle(doc, 'Termos e condições', margin, currentY, pageWidth, primaryColor);

        doc.fontSize(8)
          .text(termsAndConditions, margin, currentY, { width: pageWidth });
        currentY = doc.y + 15;
      }

      // ===================== ASSINATURA =====================
      // Show signature section if there's a signature OR if showSignature is enabled (for blank field)
      const hasSignature = quote.signatures && quote.signatures.length > 0;

      if (showSignature || hasSignature) {
        if (currentY > doc.page.height - 200) {
          doc.addPage();
          currentY = margin;
        }

        currentY = this.drawSectionTitle(doc, 'Aprovação', margin, currentY, pageWidth, primaryColor);
        currentY += 15;

        if (hasSignature) {
          const signature = quote.signatures[0];

          // Try to render the signature image (using pre-fetched buffer)
          if (signatureBuffer && signatureBuffer.buffer) {
            try {
              // Centered signature image
              const signatureWidth = 200;
              const signatureHeight = 80;
              const signatureX = margin + (pageWidth - signatureWidth) / 2;

              doc.image(signatureBuffer.buffer, signatureX, currentY, {
                fit: [signatureWidth, signatureHeight],
                align: 'center',
                valign: 'center',
              });

              currentY += signatureHeight + 5;
            } catch (error) {
              this.logger.warn(`Error rendering quote signature image: ${error}`);
            }
          }

          // Signature line
          const lineWidth = 250;
          const lineX = margin + (pageWidth - lineWidth) / 2;
          doc.moveTo(lineX, currentY)
            .lineTo(lineX + lineWidth, currentY)
            .lineWidth(1)
            .stroke('#000000');

          currentY += 8;

          // Signer name
          if (signature.signerName) {
            doc.fontSize(11)
              .font('Helvetica-Bold')
              .fillColor('#000000')
              .text(signature.signerName, margin, currentY, {
                width: pageWidth,
                align: 'center',
              })
              .font('Helvetica');
            currentY += 15;
          }

          // Signer document
          if (signature.signerDocument) {
            doc.fontSize(10)
              .fillColor('#374151')
              .text(`CPF/RG: ${signature.signerDocument}`, margin, currentY, {
                width: pageWidth,
                align: 'center',
              })
              .fillColor('#000000');
            currentY += 15;
          }

          // Signed date
          if (signature.signedAt) {
            doc.fontSize(9)
              .fillColor('#6B7280')
              .text(`Assinado em: ${this.formatDateTime(signature.signedAt)}`, margin, currentY, {
                width: pageWidth,
                align: 'center',
              })
              .fillColor('#000000');
            currentY += 20;
          }
        } else {
          // No signature yet - show blank fields for manual signing
          const sigWidth = (pageWidth - 40) / 2;

          // Client signature
          doc.moveTo(margin, currentY + 40)
            .lineTo(margin + sigWidth, currentY + 40)
            .stroke('#000000');
          doc.fontSize(9)
            .text('Assinatura do Cliente', margin, currentY + 45, { width: sigWidth, align: 'center' });

          // Provider signature
          doc.moveTo(margin + sigWidth + 40, currentY + 40)
            .lineTo(margin + sigWidth * 2 + 40, currentY + 40)
            .stroke('#000000');
          doc.fontSize(9)
            .text('Assinatura do Prestador', margin + sigWidth + 40, currentY + 45, { width: sigWidth, align: 'center' });

          // Date field
          doc.text(`Data: ____/____/________`, margin, currentY + 70);
          currentY += 90;
        }
      }

      // ===================== RODAPÉ =====================
      const footerY = doc.page.height - 40;
      if (footerText) {
        doc.fontSize(9)
          .text(footerText, margin, footerY - 15, { width: pageWidth, align: 'center' });
      }
      doc.fontSize(8)
        .fillColor('#666666')
        .text(`Documento gerado em ${this.formatDateTime(new Date())}`, margin, footerY, {
          width: pageWidth,
          align: 'center',
        })
        .fillColor('#000000');

      doc.end();
    });
  }

  private async createWorkOrderPdfBuffer(workOrder: any, settings: TemplateSettings | null, logoUrl?: string | null): Promise<Buffer> {
    // Use settings or defaults
    const primaryColor = settings?.workOrderPrimaryColor || DEFAULT_WORK_ORDER_TEMPLATE.workOrderPrimaryColor;
    const showChecklist = settings?.workOrderShowChecklist ?? DEFAULT_WORK_ORDER_TEMPLATE.workOrderShowChecklist;
    const footerText = settings?.workOrderFooterText;
    const showSignatureField = settings?.workOrderShowSignatureField ?? DEFAULT_WORK_ORDER_TEMPLATE.workOrderShowSignatureField;
    const signatureLabel = settings?.workOrderSignatureLabel || DEFAULT_WORK_ORDER_TEMPLATE.workOrderSignatureLabel;
    const showLogo = settings?.workOrderShowLogo ?? DEFAULT_WORK_ORDER_TEMPLATE.workOrderShowLogo;

    // Fetch logo buffer if available
    let logoBuffer: Buffer | null = null;
    if (showLogo && logoUrl) {
      logoBuffer = await this.fetchLogoBuffer(logoUrl);
    }

    return new Promise(async (resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const margin = 40;
      const pageWidth = doc.page.width - margin * 2;
      let currentY = margin;

      // ===================== CABEÇALHO =====================
      const companyName = workOrder.user.companyName || workOrder.user.name || 'Sua Empresa';
      currentY = this.drawDocumentHeader(
        doc,
        'ORDEM DE SERVIÇO',
        `OS #${workOrder.id.substring(0, 8).toUpperCase()}`,
        companyName,
        logoBuffer,
        primaryColor,
      );

      // ===================== INFORMAÇÕES DO CLIENTE =====================
      currentY = this.drawSectionTitle(doc, 'Informações do cliente', margin, currentY, pageWidth, primaryColor);

      const clientFields = [
        { label: 'CPF/CNPJ', value: workOrder.client.taxId || '-' },
        { label: 'Email', value: workOrder.client.email || '-' },
        { label: 'Endereço', value: this.formatAddress(workOrder.client) },
        { label: 'Telefone', value: workOrder.client.phone || '-' },
        { label: 'Falar com', value: workOrder.client.contactName || workOrder.client.name },
        { label: 'Observação', value: workOrder.client.notes || '-' },
      ];

      currentY = this.drawInfoGrid(doc, clientFields, margin, currentY, {
        labelWidth: 85,
        valueWidth: 173,
        columns: 2,
        rowHeight: 22,
      });

      currentY += 10;

      // ===================== TAREFA (ORDEM DE SERVIÇO) =====================
      currentY = this.drawSectionTitle(doc, `Tarefa #${workOrder.id.substring(0, 8).toUpperCase()}`, margin, currentY, pageWidth, primaryColor);

      // Calculate duration if execution times exist
      let duration = '-';
      if (workOrder.executionStart && workOrder.executionEnd) {
        const start = new Date(workOrder.executionStart);
        const end = new Date(workOrder.executionEnd);
        const diffMs = end.getTime() - start.getTime();
        const diffMins = Math.round(diffMs / 60000);
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        duration = hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;
      }

      const taskFields = [
        { label: 'Técnico', value: workOrder.user.name || '-' },
        { label: 'Data/Hora', value: workOrder.scheduledDate ? this.formatDateTime(workOrder.scheduledDate) : '-' },
        { label: 'Serviço', value: workOrder.title || '-' },
        { label: 'Status', value: this.translateWorkOrderStatus(workOrder.status) },
        { label: 'Chegada', value: workOrder.executionStart ? this.formatDateTime(workOrder.executionStart) : '-' },
        { label: 'Saída', value: workOrder.executionEnd ? this.formatDateTime(workOrder.executionEnd) : '-' },
        { label: 'Duração', value: duration },
        { label: 'Endereço', value: workOrder.address || this.formatAddress(workOrder.client) },
      ];

      currentY = this.drawInfoGrid(doc, taskFields, margin, currentY, {
        labelWidth: 85,
        valueWidth: 173,
        columns: 2,
        rowHeight: 22,
      });

      // Description / Instructions
      if (workOrder.description) {
        const descFields = [
          { label: 'Orientação', value: workOrder.description },
        ];
        currentY = this.drawInfoGrid(doc, descFields, margin, currentY, {
          labelWidth: 85,
          valueWidth: pageWidth - 85,
          columns: 1,
          rowHeight: 30,
        });
      }

      // Execution report / Notes
      if (workOrder.notes) {
        const notesFields = [
          { label: 'Relato de execução', value: workOrder.notes },
        ];
        currentY = this.drawInfoGrid(doc, notesFields, margin, currentY, {
          labelWidth: 85,
          valueWidth: pageWidth - 85,
          columns: 1,
          rowHeight: 40,
        });
      }

      currentY += 10;

      // ===================== ITENS/SERVIÇOS =====================
      if (workOrder.items && workOrder.items.length > 0) {
        currentY = this.drawSectionTitle(doc, 'Itens/Serviços', margin, currentY, pageWidth, primaryColor);

        const itemHeaders = [
          { text: 'Item', width: 200 },
          { text: 'Qtd', width: 60 },
          { text: 'Unidade', width: 60 },
          { text: 'Preço Un.', width: 90 },
          { text: 'Total', width: 106 },
        ];

        const itemRows = workOrder.items.map((item: any) => [
          item.name || 'Item sem nome',
          (Number(item.quantity) || 0).toFixed(2),
          item.unit || 'un',
          this.formatCurrency(Number(item.unitPrice) || 0),
          this.formatCurrency(Number(item.totalPrice) || 0),
        ]);

        currentY = this.drawTable(doc, itemHeaders, itemRows, margin, currentY, {
          headerBgColor: '#E5E7EB',
          headerTextColor: '#374151',
        });

        // Total
        if (workOrder.totalValue) {
          currentY += 5;
          doc.fontSize(11)
            .font('Helvetica-Bold')
            .fillColor(primaryColor)
            .text(`TOTAL: ${this.formatCurrency(Number(workOrder.totalValue))}`, margin, currentY, {
              width: pageWidth,
              align: 'right',
            })
            .font('Helvetica')
            .fillColor('#000000');
          currentY += 20;
        }

        currentY += 10;
      }

      // ===================== CHECKLISTS =====================
      if (showChecklist && workOrder.checklistInstances && workOrder.checklistInstances.length > 0) {
        for (const instance of workOrder.checklistInstances) {
          // Check for page break
          if (currentY > doc.page.height - 150) {
            doc.addPage();
            currentY = margin;
          }

          const checklistName = instance.template?.name || 'Checklist';
          currentY = this.drawSectionTitle(doc, checklistName, margin, currentY, pageWidth, primaryColor);

          // Get questions from templateVersionSnapshot
          const snapshot = instance.templateVersionSnapshot as any;
          const questions = snapshot?.questions || [];

          // Create a map of questionId to answer
          const answerMap = new Map<string, any>();
          for (const answer of instance.answers) {
            answerMap.set(answer.questionId, answer);
          }

          // Build checklist rows
          const checklistRows: string[][] = [];
          let currentSection = '';

          for (const question of questions) {
            if (question.type === 'SECTION_TITLE') {
              // Add section as a row with merged appearance
              currentSection = question.title;
              checklistRows.push([`§ ${currentSection}`, '']);
              continue;
            }

            const answer = answerMap.get(question.id);
            const value = answer ? this.getChecklistAnswerValueAdvanced(answer) : '-';
            checklistRows.push([question.title, value]);
          }

          // Draw checklist as table
          const checklistHeaders = [
            { text: 'Pergunta', width: 340 },
            { text: 'Resposta', width: 176 },
          ];

          currentY = this.drawTable(doc, checklistHeaders, checklistRows, margin, currentY, {
            headerBgColor: '#E5E7EB',
            headerTextColor: '#374151',
            rowHeight: 22,
          });

          currentY += 10;

          // ===================== FOTOS DO CHECKLIST =====================
          // Coletar todas as fotos das respostas do checklist
          const checklistPhotoAttachments: any[] = [];
          for (const answer of instance.answers) {
            if (answer.attachments && answer.attachments.length > 0) {
              const photoAtts = answer.attachments.filter((att: any) =>
                att.mimeType?.startsWith('image/') || att.type === 'PHOTO'
              );
              for (const att of photoAtts) {
                // Encontrar a pergunta para ter o contexto
                const question = questions.find((q: any) => q.id === answer.questionId);
                checklistPhotoAttachments.push({
                  ...att,
                  questionTitle: question?.title || 'Foto',
                });
              }
            }
          }

          if (checklistPhotoAttachments.length > 0) {
            // Desenhar fotos do checklist
            const photoWidth = 120;
            const photoHeight = 90;
            const photosPerRow = 4;
            const photoSpacing = 8;

            let photoX = margin;
            let photoY = currentY;
            let col = 0;
            let rowPhotoY = currentY;

            for (let i = 0; i < checklistPhotoAttachments.length; i++) {
              const attachment = checklistPhotoAttachments[i];

              // Check for page break
              if (photoY > doc.page.height - photoHeight - 50) {
                doc.addPage();
                photoY = margin;
                rowPhotoY = margin;
              }

              try {
                // Fetch image from storage using storagePath (ChecklistAttachment uses storagePath directly)
                let imageBuffer: Buffer | null = null;

                if (attachment.storagePath) {
                  // Use storage provider directly for checklist attachments
                  imageBuffer = await this.storageProvider.getBuffer(attachment.storagePath);
                }

                if (imageBuffer) {
                  doc.image(imageBuffer, photoX, photoY, {
                    width: photoWidth,
                    height: photoHeight,
                    fit: [photoWidth, photoHeight],
                  });

                  // Caption with question title
                  doc
                    .fontSize(7)
                    .fillColor('#6B7280')
                    .text(
                      attachment.questionTitle.substring(0, 25) + (attachment.questionTitle.length > 25 ? '...' : ''),
                      photoX,
                      photoY + photoHeight + 2,
                      { width: photoWidth, align: 'center' }
                    );
                } else {
                  throw new Error('Buffer not found');
                }
              } catch (err) {
                this.logger.warn(`Failed to embed checklist photo ${attachment.id}: ${err}`);
                // Draw placeholder
                doc
                  .rect(photoX, photoY, photoWidth, photoHeight)
                  .fillColor('#F3F4F6')
                  .fill()
                  .strokeColor('#E5E7EB')
                  .stroke();
                doc
                  .fontSize(8)
                  .fillColor('#9CA3AF')
                  .text('Foto indisponível', photoX, photoY + photoHeight / 2 - 5, {
                    width: photoWidth,
                    align: 'center',
                  });
              }

              col++;
              if (col === photosPerRow) {
                col = 0;
                photoX = margin;
                photoY = rowPhotoY + photoHeight + 25;
                rowPhotoY = photoY;
              } else {
                photoX += photoWidth + photoSpacing;
              }

              // Update currentY after last photo in row
              if (col === 0 || i === checklistPhotoAttachments.length - 1) {
                currentY = rowPhotoY + photoHeight + 25;
              }
            }

            currentY += 10;
          }

          currentY += 5;
        }
      }
      // Legacy Checklists
      else if (showChecklist && workOrder.checklists && workOrder.checklists.length > 0) {
        for (const checklist of workOrder.checklists) {
          if (currentY > doc.page.height - 150) {
            doc.addPage();
            currentY = margin;
          }

          currentY = this.drawSectionTitle(doc, checklist.title || 'Checklist', margin, currentY, pageWidth, primaryColor);

          const legacyRows = checklist.answers.map((answer: any) => [
            answer.question || 'Item',
            this.getChecklistAnswerValue(answer),
          ]);

          const checklistHeaders = [
            { text: 'Pergunta', width: 340 },
            { text: 'Resposta', width: 176 },
          ];

          currentY = this.drawTable(doc, checklistHeaders, legacyRows, margin, currentY, {
            headerBgColor: '#E5E7EB',
            headerTextColor: '#374151',
            rowHeight: 22,
          });

          currentY += 15;
        }
      }

      // ===================== ANEXOS (FOTOS) =====================
      if (workOrder.attachments && workOrder.attachments.length > 0) {
        // Filtrar apenas fotos (imagens)
        const photoAttachments = workOrder.attachments.filter((att: any) =>
          att.mimeType?.startsWith('image/') || att.type === 'PHOTO'
        );

        if (photoAttachments.length > 0) {
          // Sempre começar anexos em nova página para melhor visualização
          doc.addPage();
          currentY = margin;

          currentY = this.drawSectionTitle(doc, `Anexos (${photoAttachments.length} foto${photoAttachments.length > 1 ? 's' : ''})`, margin, currentY, pageWidth, primaryColor);
          currentY += 15;

          // Configuração do grid de fotos: 2 colunas para melhor visualização
          const photosPerRow = 2;
          const gap = 15;
          const photoWidth = (pageWidth - gap) / photosPerRow;
          const photoHeight = 180; // Altura maior para melhor visualização
          const captionHeight = 20;
          const rowHeight = photoHeight + captionHeight + gap;

          for (let i = 0; i < photoAttachments.length; i++) {
            const attachment = photoAttachments[i];
            const col = i % photosPerRow;

            // Verificar se precisa de nova página (no início de cada linha)
            if (col === 0 && currentY + rowHeight > doc.page.height - 50) {
              doc.addPage();
              currentY = margin;
              // Redesenhar título da seção na nova página
              currentY = this.drawSectionTitle(doc, `Anexos (continuação)`, margin, currentY, pageWidth, primaryColor);
              currentY += 15;
            }

            const x = margin + col * (photoWidth + gap);
            const y = currentY;

            try {
              // Buscar buffer da imagem
              const imageBuffer = await this.fileStorageService.getFileBuffer(
                workOrder.userId,
                attachment.id,
              );

              if (imageBuffer && imageBuffer.buffer) {
                // Desenhar borda/moldura com sombra sutil
                doc.rect(x, y, photoWidth, photoHeight)
                  .lineWidth(1)
                  .stroke('#D1D5DB');

                // Desenhar imagem
                doc.image(imageBuffer.buffer, x + 3, y + 3, {
                  fit: [photoWidth - 6, photoHeight - 6],
                  align: 'center',
                  valign: 'center',
                });

                // Legenda com data e número da foto
                const captionY = y + photoHeight + 4;
                const photoDate = this.formatDateTime(attachment.createdAt);
                doc.fontSize(8)
                  .fillColor('#4B5563')
                  .text(`Foto ${i + 1} - ${photoDate}`, x, captionY, {
                    width: photoWidth,
                    align: 'center',
                  })
                  .fillColor('#000000');
              }
            } catch (error) {
              // Se não conseguir carregar a imagem, desenhar placeholder
              doc.rect(x, y, photoWidth, photoHeight)
                .fill('#F9FAFB')
                .lineWidth(1)
                .stroke('#E5E7EB');

              doc.fontSize(9)
                .fillColor('#9CA3AF')
                .text('Imagem indisponível', x, y + photoHeight / 2 - 5, {
                  width: photoWidth,
                  align: 'center',
                })
                .fillColor('#000000');
            }

            // Atualizar currentY ao final de cada linha (quando col é o último ou última foto)
            if (col === photosPerRow - 1 || i === photoAttachments.length - 1) {
              currentY += rowHeight;
            }
          }
        }
      }

      // ===================== ASSINATURA DO CLIENTE =====================
      // Assinatura aparece no final do documento (após anexos)
      if (showSignatureField && workOrder.signatures && workOrder.signatures.length > 0) {
        const signature = workOrder.signatures[0];

        // Verificar se precisa de nova página para a assinatura
        if (currentY > doc.page.height - 220) {
          doc.addPage();
          currentY = margin;
        }

        currentY = this.drawSectionTitle(doc, signatureLabel || 'Assinatura do Cliente', margin, currentY, pageWidth, primaryColor);
        currentY += 20;

        // Tentar carregar e exibir a imagem da assinatura
        let signatureDrawn = false;
        if (signature.attachment) {
          try {
            const signatureBuffer = await this.fileStorageService.getFileBuffer(
              workOrder.userId,
              signature.attachment.id,
            );

            if (signatureBuffer && signatureBuffer.buffer) {
              // Calcular posição centralizada para a assinatura
              const signatureWidth = 200;
              const signatureHeight = 80;
              const signatureX = margin + (pageWidth - signatureWidth) / 2;

              // Desenhar imagem da assinatura centralizada
              doc.image(signatureBuffer.buffer, signatureX, currentY, {
                fit: [signatureWidth, signatureHeight],
                align: 'center',
                valign: 'center',
              });

              currentY += signatureHeight + 5;
              signatureDrawn = true;
            }
          } catch (error) {
            this.logger.warn(`Erro ao carregar imagem da assinatura: ${error}`);
          }
        }

        // Linha da assinatura (abaixo da imagem ou sozinha se não houver imagem)
        const lineWidth = 250;
        const lineX = margin + (pageWidth - lineWidth) / 2;
        doc.moveTo(lineX, currentY)
          .lineTo(lineX + lineWidth, currentY)
          .lineWidth(1)
          .stroke('#000000');

        currentY += 8;

        // Nome do assinante centralizado
        if (signature.signerName) {
          doc.fontSize(11)
            .font('Helvetica-Bold')
            .fillColor('#000000')
            .text(signature.signerName, margin, currentY, {
              width: pageWidth,
              align: 'center',
            })
            .font('Helvetica');
          currentY += 15;
        }

        // Documento (CPF/RG) do assinante centralizado
        if (signature.signerDocument) {
          doc.fontSize(10)
            .fillColor('#374151')
            .text(`CPF/RG: ${signature.signerDocument}`, margin, currentY, {
              width: pageWidth,
              align: 'center',
            })
            .fillColor('#000000');
          currentY += 15;
        }

        // Data da assinatura
        if (signature.signedAt) {
          doc.fontSize(9)
            .fillColor('#6B7280')
            .text(`Assinado em: ${this.formatDateTime(signature.signedAt)}`, margin, currentY, {
              width: pageWidth,
              align: 'center',
            })
            .fillColor('#000000');
          currentY += 20;
        }
      }
      // Se não houver assinatura mas showSignatureField estiver habilitado, mostrar campo em branco
      else if (showSignatureField) {
        // Verificar se precisa de nova página
        if (currentY > doc.page.height - 150) {
          doc.addPage();
          currentY = margin;
        }

        currentY = this.drawSectionTitle(doc, signatureLabel || 'Assinatura do Cliente', margin, currentY, pageWidth, primaryColor);
        currentY += 30;

        // Linha para assinatura em branco
        const lineWidth = 250;
        const lineX = margin + (pageWidth - lineWidth) / 2;
        doc.moveTo(lineX, currentY)
          .lineTo(lineX + lineWidth, currentY)
          .lineWidth(1)
          .stroke('#000000');

        currentY += 8;

        // Label abaixo da linha
        doc.fontSize(9)
          .fillColor('#6B7280')
          .text('Assinatura', margin, currentY, {
            width: pageWidth,
            align: 'center',
          })
          .fillColor('#000000');

        currentY += 25;

        // Campo para data
        doc.fontSize(9)
          .text('Data: ____/____/________', margin, currentY, {
            width: pageWidth,
            align: 'center',
          });

        currentY += 30;
      }

      // ===================== RODAPÉ =====================
      const footerY = doc.page.height - 40;
      if (footerText) {
        doc.fontSize(9)
          .text(footerText, margin, footerY - 15, { width: pageWidth, align: 'center' });
      }
      doc.fontSize(8)
        .fillColor('#666666')
        .text(`Documento gerado em ${this.formatDateTime(new Date())}`, margin, footerY, {
          width: pageWidth,
          align: 'center',
        })
        .fillColor('#000000');

      doc.end();
    });
  }

  private async createInvoicePdfBuffer(invoice: any, settings: TemplateSettings | null, logoUrl?: string | null): Promise<Buffer> {
    // Use settings or defaults
    const primaryColor = (settings as any)?.invoicePrimaryColor || DEFAULT_INVOICE_TEMPLATE.invoicePrimaryColor;
    const footerText = (settings as any)?.invoiceFooterText || DEFAULT_INVOICE_TEMPLATE.invoiceFooterText;
    const showLogo = (settings as any)?.invoiceShowLogo ?? DEFAULT_INVOICE_TEMPLATE.invoiceShowLogo;
    const showPaymentInfo = (settings as any)?.invoiceShowPaymentInfo ?? DEFAULT_INVOICE_TEMPLATE.invoiceShowPaymentInfo;

    // Fetch logo buffer if available
    let logoBuffer: Buffer | null = null;
    if (showLogo && logoUrl) {
      logoBuffer = await this.fetchLogoBuffer(logoUrl);
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const margin = 40;
      const pageWidth = doc.page.width - margin * 2;
      let currentY = margin;

      // ===================== CABEÇALHO =====================
      const companyName = invoice.user.companyName || invoice.user.name || 'Sua Empresa';
      currentY = this.drawDocumentHeader(
        doc,
        'FATURA / COBRANÇA',
        `#${invoice.invoiceNumber}`,
        companyName,
        logoBuffer,
        primaryColor,
      );

      // ===================== INFORMAÇÕES DA FATURA =====================
      currentY = this.drawSectionTitle(doc, 'Informações da fatura', margin, currentY, pageWidth, primaryColor);

      const invoiceInfoFields = [
        { label: 'Número', value: invoice.invoiceNumber },
        { label: 'Data Emissão', value: this.formatDate(invoice.createdAt) },
        { label: 'Vencimento', value: this.formatDate(invoice.dueDate) },
        { label: 'Status', value: this.translateInvoiceStatus(invoice.status) },
      ];

      if (invoice.paidDate) {
        invoiceInfoFields.push({ label: 'Data Pagamento', value: this.formatDate(invoice.paidDate) });
      }

      currentY = this.drawInfoGrid(doc, invoiceInfoFields, margin, currentY, {
        labelWidth: 100,
        valueWidth: 158,
        columns: 2,
        rowHeight: 22,
      });

      // Status badge
      if (invoice.status === 'PAID') {
        currentY += 5;
        this.drawTableCell(doc, '✓ PAGO', margin, currentY, pageWidth, 25, {
          bgColor: '#16A34A',
          textColor: '#FFFFFF',
          bold: true,
          align: 'center',
          fontSize: 12,
        });
        currentY += 30;
      } else if (invoice.status === 'OVERDUE') {
        currentY += 5;
        this.drawTableCell(doc, '⚠ VENCIDO', margin, currentY, pageWidth, 25, {
          bgColor: '#DC2626',
          textColor: '#FFFFFF',
          bold: true,
          align: 'center',
          fontSize: 12,
        });
        currentY += 30;
      }

      currentY += 10;

      // ===================== PRESTADOR DE SERVIÇO =====================
      currentY = this.drawSectionTitle(doc, 'Prestador de serviço', margin, currentY, pageWidth, primaryColor);

      const providerFields = [
        { label: 'Nome/Empresa', value: invoice.user.companyName || invoice.user.name || '-' },
        { label: 'Email', value: invoice.user.email || '-' },
      ];

      currentY = this.drawInfoGrid(doc, providerFields, margin, currentY, {
        labelWidth: 100,
        valueWidth: 158,
        columns: 2,
        rowHeight: 22,
      });

      currentY += 10;

      // ===================== INFORMAÇÕES DO CLIENTE =====================
      currentY = this.drawSectionTitle(doc, 'Informações do cliente', margin, currentY, pageWidth, primaryColor);

      const clientFields = [
        { label: 'Nome', value: invoice.client.name || '-' },
        { label: 'CPF/CNPJ', value: invoice.client.taxId || '-' },
        { label: 'Email', value: invoice.client.email || '-' },
        { label: 'Telefone', value: invoice.client.phone || '-' },
        { label: 'Endereço', value: this.formatAddress(invoice.client) },
        { label: 'Falar com', value: invoice.client.contactName || invoice.client.name },
      ];

      currentY = this.drawInfoGrid(doc, clientFields, margin, currentY, {
        labelWidth: 100,
        valueWidth: 158,
        columns: 2,
        rowHeight: 22,
      });

      currentY += 10;

      // ===================== ITENS/SERVIÇOS =====================
      if (invoice.workOrder && invoice.workOrder.items && invoice.workOrder.items.length > 0) {
        currentY = this.drawSectionTitle(doc, 'Itens/Serviços', margin, currentY, pageWidth, primaryColor);

        const itemHeaders = [
          { text: 'Item', width: 200 },
          { text: 'Qtd', width: 60 },
          { text: 'Unidade', width: 60 },
          { text: 'Preço Un.', width: 90 },
          { text: 'Total', width: 106 },
        ];

        const itemRows = invoice.workOrder.items.map((item: any) => [
          item.name || 'Item sem nome',
          (Number(item.quantity) || 0).toFixed(2),
          item.unit || 'un',
          this.formatCurrency(Number(item.unitPrice) || 0),
          this.formatCurrency(Number(item.totalPrice) || 0),
        ]);

        currentY = this.drawTable(doc, itemHeaders, itemRows, margin, currentY, {
          headerBgColor: '#E5E7EB',
          headerTextColor: '#374151',
        });

        currentY += 10;
      }

      // ===================== VALORES =====================
      currentY = this.drawSectionTitle(doc, 'Valores', margin, currentY, pageWidth, primaryColor);

      // Draw totals as a table on the right
      const totalsX = margin + pageWidth - 220;
      const totalsFields: { label: string; value: string }[] = [
        { label: 'Subtotal', value: this.formatCurrency(Number(invoice.subtotal) || 0) },
      ];

      if (Number(invoice.discount) > 0) {
        totalsFields.push({ label: 'Desconto', value: `-${this.formatCurrency(Number(invoice.discount))}` });
      }

      if (Number(invoice.tax) > 0) {
        totalsFields.push({ label: 'Impostos/Taxas', value: `+${this.formatCurrency(Number(invoice.tax))}` });
      }

      for (const field of totalsFields) {
        this.drawTableCell(doc, field.label, totalsX, currentY, 110, 20, {
          bgColor: '#F3F4F6',
          bold: true,
          fontSize: 9,
          align: 'right',
        });
        this.drawTableCell(doc, field.value, totalsX + 110, currentY, 110, 20, {
          fontSize: 9,
          align: 'right',
        });
        currentY += 20;
      }

      // Total highlight
      this.drawTableCell(doc, 'TOTAL', totalsX, currentY, 110, 26, {
        bgColor: primaryColor,
        textColor: '#FFFFFF',
        bold: true,
        fontSize: 12,
        align: 'right',
      });
      this.drawTableCell(doc, this.formatCurrency(Number(invoice.total) || 0), totalsX + 110, currentY, 110, 26, {
        bgColor: primaryColor,
        textColor: '#FFFFFF',
        bold: true,
        fontSize: 12,
        align: 'right',
      });
      currentY += 36;

      // ===================== INFORMAÇÕES DE PAGAMENTO =====================
      if (showPaymentInfo) {
        currentY = this.drawSectionTitle(doc, 'Informações de pagamento', margin, currentY, pageWidth, primaryColor);

        const paymentFields: { label: string; value: string }[] = [
          { label: 'Data Vencimento', value: this.formatDate(invoice.dueDate) },
        ];

        if (invoice.paidDate) {
          paymentFields.push({ label: 'Data Pagamento', value: this.formatDate(invoice.paidDate) });
        }

        if (invoice.paymentMethod) {
          paymentFields.push({ label: 'Forma de Pagamento', value: invoice.paymentMethod });
        }

        currentY = this.drawInfoGrid(doc, paymentFields, margin, currentY, {
          labelWidth: 120,
          valueWidth: 138,
          columns: 2,
          rowHeight: 22,
        });

        currentY += 10;
      }

      // ===================== OBSERVAÇÕES =====================
      if (invoice.notes) {
        currentY = this.drawSectionTitle(doc, 'Observações', margin, currentY, pageWidth, primaryColor);

        const notesFields = [
          { label: 'Observações', value: invoice.notes },
        ];
        currentY = this.drawInfoGrid(doc, notesFields, margin, currentY, {
          labelWidth: 85,
          valueWidth: pageWidth - 85,
          columns: 1,
          rowHeight: 40,
        });

        currentY += 10;
      }

      // ===================== RODAPÉ =====================
      const footerY = doc.page.height - 40;
      if (footerText) {
        doc.fontSize(9)
          .text(footerText, margin, footerY - 15, { width: pageWidth, align: 'center' });
      }
      doc.fontSize(8)
        .fillColor('#666666')
        .text(`Documento gerado em ${this.formatDateTime(new Date())}`, margin, footerY, {
          width: pageWidth,
          align: 'center',
        })
        .fillColor('#000000');

      doc.end();
    });
  }

  // ==================== PDF HELPERS - TABELAS ====================

  /**
   * Desenha uma célula de tabela com borda
   */
  private drawTableCell(
    doc: any,
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    options: {
      bold?: boolean;
      bgColor?: string;
      textColor?: string;
      align?: 'left' | 'center' | 'right';
      fontSize?: number;
      noBorder?: boolean;
    } = {},
  ) {
    const {
      bold = false,
      bgColor,
      textColor = '#000000',
      align = 'left',
      fontSize = 9,
      noBorder = false,
    } = options;

    // Background
    if (bgColor) {
      doc.rect(x, y, width, height).fill(bgColor);
    }

    // Border
    if (!noBorder) {
      doc.rect(x, y, width, height).stroke('#CCCCCC');
    }

    // Text
    const padding = 4;
    doc.fontSize(fontSize)
      .fillColor(textColor)
      .font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .text(text, x + padding, y + padding, {
        width: width - padding * 2,
        height: height - padding * 2,
        align,
      })
      .font('Helvetica')
      .fillColor('#000000');
  }

  /**
   * Desenha uma tabela completa com cabeçalho e dados
   */
  private drawTable(
    doc: any,
    headers: { text: string; width: number }[],
    rows: string[][],
    startX: number,
    startY: number,
    options: {
      headerBgColor?: string;
      headerTextColor?: string;
      rowHeight?: number;
      headerHeight?: number;
      alternateRowColor?: string;
    } = {},
  ): number {
    const {
      headerBgColor = '#E5E7EB',
      headerTextColor = '#374151',
      rowHeight = 20,
      headerHeight = 22,
      alternateRowColor = '#F9FAFB',
    } = options;

    let currentY = startY;
    let x = startX;

    // Header row
    headers.forEach((header) => {
      this.drawTableCell(doc, header.text, x, currentY, header.width, headerHeight, {
        bold: true,
        bgColor: headerBgColor,
        textColor: headerTextColor,
        align: 'center',
        fontSize: 9,
      });
      x += header.width;
    });
    currentY += headerHeight;

    // Data rows
    rows.forEach((row, rowIndex) => {
      // Check for page break
      if (currentY + rowHeight > doc.page.height - 80) {
        doc.addPage();
        currentY = 50;
      }

      x = startX;
      const bgColor = rowIndex % 2 === 1 ? alternateRowColor : undefined;

      row.forEach((cell, cellIndex) => {
        this.drawTableCell(doc, cell, x, currentY, headers[cellIndex].width, rowHeight, {
          bgColor,
          align: cellIndex === 0 ? 'left' : 'center',
        });
        x += headers[cellIndex].width;
      });
      currentY += rowHeight;
    });

    return currentY;
  }

  /**
   * Desenha uma tabela de informações em formato grid (2 colunas: label + valor)
   */
  private drawInfoGrid(
    doc: any,
    fields: { label: string; value: string }[],
    startX: number,
    startY: number,
    options: {
      labelWidth?: number;
      valueWidth?: number;
      rowHeight?: number;
      columns?: number;
      labelBgColor?: string;
      allowPageBreak?: boolean;
    } = {},
  ): number {
    const {
      labelWidth = 100,
      valueWidth = 150,
      rowHeight = 18,
      columns = 2,
      labelBgColor = '#F3F4F6',
      allowPageBreak = true,
    } = options;

    let currentY = startY;
    const pairWidth = labelWidth + valueWidth;
    const fieldsPerRow = columns;

    for (let i = 0; i < fields.length; i += fieldsPerRow) {
      // Check for page break (only if allowed)
      if (allowPageBreak && currentY + rowHeight > doc.page.height - 80) {
        doc.addPage();
        currentY = 50;
      }

      for (let j = 0; j < fieldsPerRow && i + j < fields.length; j++) {
        const field = fields[i + j];
        const x = startX + j * pairWidth;

        // Label cell
        this.drawTableCell(doc, field.label, x, currentY, labelWidth, rowHeight, {
          bold: true,
          bgColor: labelBgColor,
          fontSize: 8,
        });

        // Value cell
        this.drawTableCell(doc, field.value || '-', x + labelWidth, currentY, valueWidth, rowHeight, {
          fontSize: 8,
        });
      }
      currentY += rowHeight;
    }

    return currentY;
  }

  /**
   * Desenha título de seção com linha
   */
  private drawSectionTitle(
    doc: any,
    title: string,
    startX: number,
    startY: number,
    width: number,
    primaryColor: string = '#7C3AED',
  ): number {
    const height = 22;

    // Background with primary color
    doc.rect(startX, startY, width, height).fill(primaryColor);

    // Text
    doc.fontSize(11)
      .fillColor('#FFFFFF')
      .font('Helvetica-Bold')
      .text(title, startX + 8, startY + 5, { width: width - 16 })
      .font('Helvetica')
      .fillColor('#000000');

    return startY + height;
  }

  /**
   * Desenha cabeçalho do documento com logo
   */
  private drawDocumentHeader(
    doc: any,
    title: string,
    docNumber: string,
    companyName: string,
    logoBuffer: Buffer | null,
    primaryColor: string,
  ): number {
    const margin = 50;
    const pageWidth = doc.page.width - margin * 2;
    let currentY = margin;

    // Company header section
    const headerHeight = 50;
    doc.rect(margin, currentY, pageWidth, headerHeight).fill(primaryColor);

    // Logo (if available)
    if (logoBuffer) {
      try {
        doc.rect(margin + 5, currentY + 5, 60, 40).fill('#FFFFFF');
        doc.image(logoBuffer, margin + 10, currentY + 10, { fit: [50, 30] });
      } catch (error) {
        this.logger.warn(`Failed to render logo: ${error}`);
      }
    }

    // Company name
    doc.fontSize(16)
      .fillColor('#FFFFFF')
      .font('Helvetica-Bold')
      .text(companyName, logoBuffer ? margin + 75 : margin + 10, currentY + 15, {
        width: pageWidth - (logoBuffer ? 160 : 20),
      })
      .font('Helvetica')
      .fillColor('#000000');

    // Document number on the right
    doc.fontSize(12)
      .fillColor('#FFFFFF')
      .text(docNumber, margin, currentY + 18, { width: pageWidth - 10, align: 'right' })
      .fillColor('#000000');

    currentY += headerHeight + 5;

    // Document title
    doc.fontSize(14)
      .fillColor(primaryColor)
      .font('Helvetica-Bold')
      .text(title, margin, currentY, { width: pageWidth, align: 'center' })
      .font('Helvetica')
      .fillColor('#000000');

    return currentY + 25;
  }

  // ==================== LEGACY PDF HELPERS ====================

  private addHeader(
    doc: any,
    title: string,
    primaryColor: string = '#7C3AED',
    logoBuffer?: Buffer | null,
    logoPosition: string = 'left',
    companyName?: string,
  ) {
    const pageWidth = doc.page.width - 100; // 50 margin on each side
    const headerHeight = 60;
    const logoWidth = 50;
    const logoHeight = 40;
    const startY = doc.y;
    const startX = 50;

    // Draw colored background rectangle
    doc.rect(startX, startY, pageWidth + 50, headerHeight)
      .fill(primaryColor);

    // Calculate positions for logo and title
    const contentY = startY + (headerHeight - logoHeight) / 2;

    // If logo exists, render it based on position
    if (logoBuffer) {
      try {
        if (logoPosition === 'left') {
          // Logo on left with white background
          doc.rect(startX + 10, contentY, logoWidth + 10, logoHeight)
            .fill('#FFFFFF');
          doc.image(logoBuffer, startX + 15, contentY + 5, { fit: [logoWidth, logoHeight - 10] });

          // Company name next to logo
          if (companyName) {
            doc.fontSize(14)
              .fillColor('#FFFFFF')
              .font('Helvetica-Bold')
              .text(companyName, startX + logoWidth + 30, contentY + 8, { width: pageWidth - logoWidth - 40 })
              .font('Helvetica');
          }
        } else if (logoPosition === 'right') {
          // Company name on left
          if (companyName) {
            doc.fontSize(14)
              .fillColor('#FFFFFF')
              .font('Helvetica-Bold')
              .text(companyName, startX + 10, contentY + 8, { width: pageWidth - logoWidth - 40 })
              .font('Helvetica');
          }
          // Logo on right with white background
          const logoX = doc.page.width - startX - logoWidth - 20;
          doc.rect(logoX, contentY, logoWidth + 10, logoHeight)
            .fill('#FFFFFF');
          doc.image(logoBuffer, logoX + 5, contentY + 5, { fit: [logoWidth, logoHeight - 10] });
        } else {
          // Center: logo centered with company name below
          const logoX = (doc.page.width - logoWidth - 10) / 2;
          doc.rect(logoX, contentY - 5, logoWidth + 10, logoHeight - 5)
            .fill('#FFFFFF');
          doc.image(logoBuffer, logoX + 5, contentY, { fit: [logoWidth, logoHeight - 15] });

          if (companyName) {
            doc.fontSize(12)
              .fillColor('#FFFFFF')
              .font('Helvetica-Bold')
              .text(companyName, startX, contentY + logoHeight - 10, { width: pageWidth + 50, align: 'center' })
              .font('Helvetica');
          }
        }
      } catch (error) {
        // If logo rendering fails, just render company name
        this.logger.warn(`Failed to render logo in PDF: ${error}`);
        if (companyName) {
          doc.fontSize(16)
            .fillColor('#FFFFFF')
            .font('Helvetica-Bold')
            .text(companyName, startX, contentY + 10, { width: pageWidth + 50, align: 'center' })
            .font('Helvetica');
        }
      }
    } else {
      // No logo, just render company name centered
      if (companyName) {
        doc.fontSize(16)
          .fillColor('#FFFFFF')
          .font('Helvetica-Bold')
          .text(companyName, startX, contentY + 10, { width: pageWidth + 50, align: 'center' })
          .font('Helvetica');
      }
    }

    // Move Y to after the header
    doc.y = startY + headerHeight + 10;
    doc.fillColor('black');

    // Add title below the header
    doc.fontSize(18)
      .fillColor(primaryColor)
      .font('Helvetica-Bold')
      .text(title, { align: 'center' })
      .font('Helvetica')
      .fillColor('black');

    doc.moveDown(0.5);
    doc.moveTo(50, doc.y)
      .strokeColor(primaryColor)
      .lineTo(545, doc.y)
      .stroke()
      .strokeColor('black');
    doc.moveDown();
  }

  private addSection(doc: any, title: string, primaryColor: string = '#7C3AED') {
    doc.fontSize(12)
      .fillColor(primaryColor)
      .text(title, { underline: true })
      .fillColor('black');
    doc.moveDown(0.5);
  }

  private addItemsTable(doc: any, items: any[], primaryColor: string = '#7C3AED') {
    const tableTop = doc.y;
    const colWidths = [200, 60, 60, 80, 80];
    const headers = ['Item', 'Qtd', 'Unid', 'Preço Un.', 'Total'];

    // Header row with color
    let x = 50;
    doc.fontSize(9).fillColor(primaryColor);
    headers.forEach((header, i) => {
      doc.text(header, x, tableTop, { width: colWidths[i], align: i === 0 ? 'left' : 'right' });
      x += colWidths[i];
    });
    doc.fillColor('black');

    // Line under header
    doc.moveTo(50, tableTop + 15)
      .strokeColor(primaryColor)
      .lineTo(545, tableTop + 15)
      .stroke()
      .strokeColor('black');

    // Data rows
    let y = tableTop + 20;
    (items || []).forEach((item) => {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }

      x = 50;
      const rowData = [
        item.name || 'Item sem nome',
        (Number(item.quantity) || 0).toFixed(2),
        item.unit || 'un',
        this.formatCurrency(Number(item.unitPrice) || 0),
        this.formatCurrency(Number(item.totalPrice) || 0),
      ];

      rowData.forEach((data, i) => {
        doc.text(data, x, y, { width: colWidths[i], align: i === 0 ? 'left' : 'right' });
        x += colWidths[i];
      });

      y += 15;
    });

    doc.y = y;
  }

  private addSignatureField(doc: any, label: string, primaryColor: string = '#7C3AED') {
    const startX = 50;
    const lineY = doc.y + 40;

    // Draw signature line
    doc.moveTo(startX, lineY)
      .lineTo(startX + 200, lineY)
      .stroke();

    // Add label below line
    doc.fontSize(10)
      .fillColor(primaryColor)
      .text(label, startX, lineY + 5, { width: 200, align: 'center' })
      .fillColor('black');

    // Add date field
    doc.moveDown();
    doc.text(`Data: ____/____/________`, startX, doc.y);

    doc.moveDown();
  }

  private addFooter(doc: any, customText?: string) {
    const bottom = doc.page.height - 50;

    // Custom footer text if provided
    if (customText) {
      doc.fontSize(10)
        .text(customText, 50, bottom - 20, { align: 'center' });
    }

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

  private translateStatus(status: string): string {
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
      PENDING: 'Pendente',
      PAID: 'Pago',
      OVERDUE: 'Vencido',
      CANCELLED: 'Cancelado',
    };
    return translations[status] || status;
  }

  private getChecklistAnswerValue(answer: any): string {
    switch (answer.type) {
      case 'TEXT':
        return answer.valueText || '-';
      case 'NUMERIC':
        return answer.valueNumber?.toString() || '-';
      case 'BOOLEAN':
        return answer.valueBoolean ? 'Sim' : 'Não';
      case 'SELECT':
        return answer.valueSelect || '-';
      case 'PHOTO':
        return answer.valuePhoto ? '[Foto anexada]' : '-';
      default:
        return '-';
    }
  }

  private getChecklistAnswerValueAdvanced(answer: any): string {
    switch (answer.type) {
      case 'TEXT_SHORT':
      case 'TEXT_LONG':
        return answer.valueText || '-';
      case 'NUMBER':
        return answer.valueNumber != null ? answer.valueNumber.toString() : '-';
      case 'CHECKBOX':
        return answer.valueBoolean != null ? (answer.valueBoolean ? 'Sim' : 'Não') : '-';
      case 'SELECT':
        // SELECT can be stored in valueJson or valueText
        if (answer.valueJson) {
          return typeof answer.valueJson === 'string' ? answer.valueJson : String(answer.valueJson);
        }
        return answer.valueText || '-';
      case 'MULTI_SELECT':
        const multiValue = answer.valueJson;
        if (multiValue && Array.isArray(multiValue)) {
          return multiValue.join(', ') || '-';
        }
        return '-';
      case 'DATE':
        return answer.valueDate ? this.formatDate(answer.valueDate) : '-';
      case 'TIME':
        if (answer.valueDate) {
          return new Date(answer.valueDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        }
        return '-';
      case 'DATETIME':
        return answer.valueDate ? this.formatDateTime(answer.valueDate) : '-';
      case 'PHOTO_REQUIRED':
      case 'PHOTO_OPTIONAL':
        return answer.attachments?.length > 0 ? `[${answer.attachments.length} foto(s) anexada(s)]` : '-';
      case 'FILE_UPLOAD':
        return answer.attachments?.length > 0 ? `[${answer.attachments.length} arquivo(s) anexado(s)]` : '-';
      case 'SIGNATURE_TECHNICIAN':
        return answer.attachments?.length > 0 ? '[Assinatura do técnico capturada]' : '-';
      case 'SIGNATURE_CLIENT':
        return answer.attachments?.length > 0 ? '[Assinatura do cliente capturada]' : '-';
      case 'RATING':
        const rating = answer.valueNumber != null ? answer.valueNumber : (answer.valueJson ? Number(answer.valueJson) : null);
        return rating != null ? `${rating}/5 estrelas` : '-';
      case 'SCALE':
        const scale = answer.valueNumber != null ? answer.valueNumber : (answer.valueJson ? Number(answer.valueJson) : null);
        return scale != null ? scale.toString() : '-';
      default:
        // Try to return any non-null value
        if (answer.valueText) return answer.valueText;
        if (answer.valueNumber != null) return answer.valueNumber.toString();
        if (answer.valueBoolean != null) return answer.valueBoolean ? 'Sim' : 'Não';
        if (answer.valueJson) return typeof answer.valueJson === 'string' ? answer.valueJson : JSON.stringify(answer.valueJson);
        return '-';
    }
  }

  /**
   * Fetches logo buffer from URL or local path
   */
  private async fetchLogoBuffer(logoUrl: string): Promise<Buffer | null> {
    try {
      // Check if it's a local file path (starts with /uploads/)
      if (logoUrl.startsWith('/uploads/')) {
        // Local storage - read from file system
        // Note: STORAGE_PATH is where files are stored, /uploads/ is the URL prefix
        const fs = await import('fs/promises');
        const path = await import('path');
        const storagePath = process.env.STORAGE_PATH || './storage';
        const relativePath = logoUrl.replace('/uploads/', '');
        const fullPath = path.join(storagePath, relativePath);

        this.logger.log(`[LOGO] Fetching local logo from: ${fullPath}`);
        return await fs.readFile(fullPath);
      }

      // Remote URL - fetch via HTTP
      if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
        const response = await fetch(logoUrl);
        if (!response.ok) {
          this.logger.warn(`Failed to fetch logo from URL: ${logoUrl}, status: ${response.status}`);
          return null;
        }
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
      }

      this.logger.warn(`Unknown logo URL format: ${logoUrl}`);
      return null;
    } catch (error) {
      this.logger.warn(`Error fetching logo buffer: ${error}`);
      return null;
    }
  }
}
