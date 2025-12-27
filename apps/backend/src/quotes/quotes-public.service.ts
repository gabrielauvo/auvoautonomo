import { Injectable, Logger, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FileStorageService } from '../file-storage/file-storage.service';
import { AttachmentType } from '../file-storage/dto/upload-file.dto';
import { SettingsService } from '../settings/settings.service';
import { randomBytes, createHash } from 'crypto';

/**
 * Serviço para gerenciar acesso público aos orçamentos
 * Gera e valida shareKeys para links compartilháveis
 */
@Injectable()
export class QuotesPublicService {
  private readonly logger = new Logger(QuotesPublicService.name);
  private readonly apiUrl: string;

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => FileStorageService))
    private fileStorageService: FileStorageService,
    private settingsService: SettingsService,
  ) {
    this.apiUrl = process.env.API_URL || 'http://localhost:3001';
  }

  /**
   * Constrói URL completa para arquivos armazenados localmente
   */
  private buildFileUrl(publicUrl: string | null): string | null {
    if (!publicUrl) return null;
    // Se é uma URL completa (http/https) ou Data URL (data:), retorna como está
    if (publicUrl.startsWith('http://') || publicUrl.startsWith('https://') || publicUrl.startsWith('data:')) {
      return publicUrl;
    }
    // Senão, adiciona o domínio do backend
    return `${this.apiUrl}${publicUrl.startsWith('/') ? '' : '/'}${publicUrl}`;
  }

  /**
   * Busca um orçamento pela shareKey (acesso público)
   * Retorna apenas dados necessários para visualização pública
   */
  async findByShareKey(shareKey: string) {
    const quote = await this.prisma.quote.findUnique({
      where: { shareKey },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            companyName: true,
            companyLogoUrl: true,
          },
        },
        client: {
          select: {
            id: true,
            name: true,
            taxId: true,
            email: true,
            phone: true,
            address: true,
            city: true,
            state: true,
            zipCode: true,
            notes: true,
          },
        },
        items: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            name: true,
            type: true,
            unit: true,
            quantity: true,
            unitPrice: true,
            discountValue: true,
            totalPrice: true,
          },
        },
        signatures: {
          include: {
            attachment: {
              select: {
                id: true,
                publicUrl: true,
              },
            },
          },
        },
        attachments: {
          where: {
            type: { in: ['PHOTO', 'DOCUMENT'] },
          },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            publicUrl: true,
            type: true,
            mimeType: true,
            createdAt: true,
          },
        },
      },
    });

    if (!quote) {
      return null;
    }

    // Buscar configurações de template do usuário para cores
    const templateSettings = await this.settingsService.getTemplateSettings(quote.userId);

    // Formatar dados para visualização pública
    return {
      id: quote.id,
      status: quote.status,
      notes: quote.notes,
      discountValue: Number(quote.discountValue),
      totalValue: Number(quote.totalValue),
      sentAt: quote.sentAt,
      visitScheduledAt: quote.visitScheduledAt,
      validUntil: quote.validUntil,
      createdAt: quote.createdAt,
      // Dados da empresa (prestador)
      company: {
        name: quote.user.companyName || quote.user.name,
        email: quote.user.email,
        phone: quote.user.phone,
        logoUrl: this.buildFileUrl(quote.user.companyLogoUrl),
      },
      // Dados do cliente
      client: {
        name: quote.client.name,
        taxId: quote.client.taxId,
        email: quote.client.email,
        phone: quote.client.phone,
        address: this.formatAddress(quote.client),
        notes: quote.client.notes,
      },
      // Itens/serviços
      items: quote.items.map((item) => ({
        name: item.name,
        type: item.type,
        unit: item.unit,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        discountValue: Number(item.discountValue),
        totalPrice: Number(item.totalPrice),
      })),
      // Assinatura do cliente (se houver)
      signature: quote.signatures.length > 0 ? {
        signerName: quote.signatures[0].signerName,
        signerDocument: quote.signatures[0].signerDocument,
        signedAt: quote.signatures[0].signedAt,
        imageUrl: this.buildFileUrl(quote.signatures[0].attachment?.publicUrl || null),
      } : null,
      // Fotos/anexos
      attachments: quote.attachments.map((att) => ({
        id: att.id,
        url: this.buildFileUrl(att.publicUrl),
        type: att.type,
        mimeType: att.mimeType,
        createdAt: att.createdAt,
      })),
      // Configurações de template (cores)
      template: {
        primaryColor: templateSettings.quote.primaryColor,
        secondaryColor: templateSettings.quote.secondaryColor,
        showLogo: templateSettings.quote.showLogo,
        logoPosition: templateSettings.quote.logoPosition,
        footerText: templateSettings.quote.footerText,
      },
    };
  }

  /**
   * Gera ou retorna a shareKey de um orçamento
   */
  async getOrCreateShareKey(userId: string, quoteId: string): Promise<string> {
    // Verificar se o orçamento pertence ao usuário
    const quote = await this.prisma.quote.findFirst({
      where: {
        id: quoteId,
        userId,
      },
    });

    if (!quote) {
      throw new Error('Quote not found');
    }

    // Se já tem shareKey, retorna
    if (quote.shareKey) {
      return quote.shareKey;
    }

    // Gera nova shareKey única
    const shareKey = this.generateShareKey();

    // Atualiza o orçamento com a nova shareKey
    await this.prisma.quote.update({
      where: { id: quoteId },
      data: { shareKey },
    });

    this.logger.log(`Generated shareKey for quote ${quoteId}`);

    return shareKey;
  }

  /**
   * Gera uma chave única para compartilhamento
   * Formato: 22 caracteres base64url-safe
   */
  private generateShareKey(): string {
    return randomBytes(16).toString('base64url');
  }

  /**
   * Formata endereço do cliente
   */
  private formatAddress(client: {
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
  }): string {
    const parts = [
      client.address,
      client.city,
      client.state,
      client.zipCode,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : '';
  }

  // ==================== AÇÕES PÚBLICAS (VIA SHAREKEY) ====================

  /**
   * Assina e aprova um orçamento via link público
   */
  async signAndApproveByShareKey(
    shareKey: string,
    dto: {
      imageBase64: string;
      signerName: string;
      signerDocument?: string;
      signerRole?: string;
      // Acceptance terms audit fields
      termsAcceptedAt?: string;
      termsHash?: string;
      termsVersion?: number;
    },
    requestInfo: { ipAddress?: string; userAgent?: string },
  ) {
    // Buscar orçamento pela shareKey
    const quote = await this.prisma.quote.findUnique({
      where: { shareKey },
      include: {
        signatures: true,
        client: true,
        user: true,
      },
    });

    if (!quote) {
      throw new BadRequestException('Orçamento não encontrado ou link inválido');
    }

    // Verificar se o orçamento pode ser assinado (status SENT)
    if (quote.status !== 'SENT') {
      if (quote.status === 'APPROVED') {
        throw new BadRequestException('Este orçamento já foi aprovado');
      }
      if (quote.status === 'REJECTED') {
        throw new BadRequestException('Este orçamento foi recusado');
      }
      if (quote.status === 'DRAFT') {
        throw new BadRequestException('Este orçamento ainda não foi enviado');
      }
      throw new BadRequestException('Este orçamento não pode ser assinado no momento');
    }

    // Verificar se já tem assinatura
    if (quote.signatures.length > 0) {
      throw new BadRequestException('Este orçamento já possui uma assinatura');
    }

    // Verificar se termos de aceite sao obrigatorios e foram aceitos
    const terms = await this.settingsService.getAcceptanceTermsForQuote(quote.userId);
    if (terms.required) {
      // Termos sao obrigatorios - verificar se foram aceitos
      if (!dto.termsAcceptedAt || !dto.termsHash) {
        this.logger.warn(`Quote ${quote.id}: Acceptance terms required but not accepted`);
        throw new BadRequestException(
          'Este orcamento requer aceite dos termos de condicoes antes da assinatura',
        );
      }
      // Verificar se o hash dos termos aceitos corresponde ao atual
      if (dto.termsHash !== terms.termsHash) {
        this.logger.warn(
          `Quote ${quote.id}: Terms hash mismatch - accepted: ${dto.termsHash}, current: ${terms.termsHash}`,
        );
        // Nao bloquear, mas registrar o warning
        // O conteudo pode ter sido atualizado entre a leitura e o aceite
      }
    }

    // Upload da imagem da assinatura
    const attachment = await this.fileStorageService.uploadFromBase64(
      quote.userId,
      dto.imageBase64,
      {
        type: AttachmentType.SIGNATURE,
        quoteId: quote.id,
        clientId: quote.clientId,
        description: `Assinatura de aceite - ${dto.signerName}`,
        category: 'QUOTE_SIGNATURE',
      },
    );

    // Criar hash para integridade
    const signatureData = JSON.stringify({
      quoteId: quote.id,
      signerName: dto.signerName,
      signerDocument: dto.signerDocument,
      signedAt: new Date().toISOString(),
      attachmentId: attachment.id,
    });
    const hash = createHash('sha256').update(signatureData).digest('hex');

    // Criar registro de assinatura (incluindo campos de aceite dos termos)
    const signature = await this.prisma.signature.create({
      data: {
        userId: quote.userId,
        clientId: quote.clientId,
        quoteId: quote.id,
        attachmentId: attachment.id,
        signerName: dto.signerName,
        signerDocument: dto.signerDocument,
        signerRole: dto.signerRole || 'Cliente',
        ipAddress: requestInfo.ipAddress,
        userAgent: requestInfo.userAgent,
        hash,
        // Acceptance terms audit fields
        termsAcceptedAt: dto.termsAcceptedAt ? new Date(dto.termsAcceptedAt) : null,
        termsHash: dto.termsHash || null,
        termsVersion: dto.termsVersion || null,
      },
    });

    // Atualizar status do orçamento para APPROVED
    await this.prisma.quote.update({
      where: { id: quote.id },
      data: { status: 'APPROVED' },
    });

    this.logger.log(`Quote ${quote.id} approved with signature ${signature.id} via public link`);

    return {
      success: true,
      message: 'Orçamento assinado e aprovado com sucesso',
      signatureId: signature.id,
      quoteStatus: 'APPROVED',
    };
  }

  /**
   * Buscar termos de aceite para um orcamento
   * Usado pelo app mobile antes da assinatura
   */
  async getAcceptanceTermsForQuote(userId: string, quoteId: string): Promise<{
    required: boolean;
    termsContent: string | null;
    version: number;
    termsHash: string | null;
  }> {
    // Verificar se o orcamento pertence ao usuario
    const quote = await this.prisma.quote.findFirst({
      where: {
        id: quoteId,
        userId,
      },
    });

    if (!quote) {
      this.logger.warn(`Quote ${quoteId} not found for user ${userId}`);
      return {
        required: false,
        termsContent: null,
        version: 0,
        termsHash: null,
      };
    }

    // Buscar termos de aceite usando o settingsService
    return this.settingsService.getAcceptanceTermsForQuote(userId);
  }

  /**
   * Buscar termos de aceite para um orcamento via shareKey (publico)
   */
  async getAcceptanceTermsForShareKey(shareKey: string): Promise<{
    required: boolean;
    termsContent: string | null;
    version: number;
    termsHash: string | null;
  }> {
    // Buscar orcamento pela shareKey
    const quote = await this.prisma.quote.findUnique({
      where: { shareKey },
      select: { userId: true },
    });

    if (!quote) {
      return {
        required: false,
        termsContent: null,
        version: 0,
        termsHash: null,
      };
    }

    // Buscar termos de aceite usando o settingsService
    return this.settingsService.getAcceptanceTermsForQuote(quote.userId);
  }

  /**
   * Rejeita um orçamento via link público
   */
  async rejectByShareKey(
    shareKey: string,
    reason?: string,
  ) {
    // Buscar orçamento pela shareKey
    const quote = await this.prisma.quote.findUnique({
      where: { shareKey },
    });

    if (!quote) {
      throw new BadRequestException('Orçamento não encontrado ou link inválido');
    }

    // Verificar se o orçamento pode ser rejeitado (status SENT)
    if (quote.status !== 'SENT') {
      if (quote.status === 'APPROVED') {
        throw new BadRequestException('Este orçamento já foi aprovado e não pode ser recusado');
      }
      if (quote.status === 'REJECTED') {
        throw new BadRequestException('Este orçamento já foi recusado');
      }
      if (quote.status === 'DRAFT') {
        throw new BadRequestException('Este orçamento ainda não foi enviado');
      }
      throw new BadRequestException('Este orçamento não pode ser recusado no momento');
    }

    // Atualizar status do orçamento para REJECTED
    await this.prisma.quote.update({
      where: { id: quote.id },
      data: {
        status: 'REJECTED',
        notes: reason ? `${quote.notes || ''}\n\nMotivo da recusa: ${reason}`.trim() : quote.notes,
      },
    });

    this.logger.log(`Quote ${quote.id} rejected via public link`);

    return {
      success: true,
      message: 'Orçamento recusado',
      quoteStatus: 'REJECTED',
    };
  }
}
