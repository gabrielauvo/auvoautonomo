import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes } from 'crypto';

/**
 * Serviço para gerenciar acesso público às ordens de serviço
 * Gera e valida shareKeys para links compartilháveis
 */
@Injectable()
export class WorkOrdersPublicService {
  private readonly logger = new Logger(WorkOrdersPublicService.name);
  private readonly apiUrl: string;

  constructor(private prisma: PrismaService) {
    this.apiUrl = process.env.API_URL || 'http://localhost:3001';
  }

  /**
   * Constrói URL completa para arquivos armazenados localmente
   * Também corrige URLs que foram salvas com IP antigo
   */
  private buildFileUrl(publicUrl: string | null): string | null {
    if (!publicUrl) return null;

    // Se é uma Data URL (base64), retorna como está
    if (publicUrl.startsWith('data:')) {
      return publicUrl;
    }

    // Se já é uma URL completa (http/https)
    if (publicUrl.startsWith('http://') || publicUrl.startsWith('https://')) {
      // Substituir IPs locais antigos pelo API_URL atual
      // Isso corrige URLs salvas com IPs de desenvolvimento diferentes
      const urlObj = new URL(publicUrl);
      const currentApiUrl = new URL(this.apiUrl);

      // Se é um IP local (192.168.x.x ou 10.x.x.x ou localhost), substituir pelo API_URL atual
      const isLocalIP = /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|127\.|localhost)/i.test(urlObj.hostname);
      if (isLocalIP) {
        urlObj.protocol = currentApiUrl.protocol;
        urlObj.hostname = currentApiUrl.hostname;
        urlObj.port = currentApiUrl.port;
        return urlObj.toString();
      }

      return publicUrl;
    }

    // Senão, adiciona o domínio do backend
    return `${this.apiUrl}${publicUrl.startsWith('/') ? '' : '/'}${publicUrl}`;
  }

  /**
   * Busca uma ordem de serviço pela shareKey (acesso público)
   * Retorna apenas dados necessários para visualização pública
   */
  async findByShareKey(shareKey: string) {
    const workOrder = await this.prisma.workOrder.findUnique({
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
                attachments: {
                  select: {
                    id: true,
                    publicUrl: true,
                  },
                },
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

    if (!workOrder) {
      return null;
    }

    // Formatar dados para visualização pública
    return {
      id: workOrder.id,
      title: workOrder.title,
      description: workOrder.description,
      status: workOrder.status,
      scheduledDate: workOrder.scheduledDate,
      scheduledStartTime: workOrder.scheduledStartTime,
      scheduledEndTime: workOrder.scheduledEndTime,
      executionStart: workOrder.executionStart,
      executionEnd: workOrder.executionEnd,
      address: workOrder.address,
      notes: workOrder.notes,
      totalValue: workOrder.totalValue,
      createdAt: workOrder.createdAt,
      // Dados da empresa (prestador)
      company: {
        name: workOrder.user.companyName || workOrder.user.name,
        email: workOrder.user.email,
        phone: workOrder.user.phone,
        logoUrl: this.buildFileUrl(workOrder.user.companyLogoUrl),
        technicianName: workOrder.user.name,
      },
      // Dados do cliente
      client: {
        name: workOrder.client.name,
        taxId: workOrder.client.taxId,
        email: workOrder.client.email,
        phone: workOrder.client.phone,
        address: this.formatAddress(workOrder.client),
        notes: workOrder.client.notes,
      },
      // Itens/serviços
      items: workOrder.items.map((item) => ({
        name: item.name,
        type: item.type,
        unit: item.unit,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        discountValue: Number(item.discountValue),
        totalPrice: Number(item.totalPrice),
      })),
      // Assinatura do cliente
      signature: workOrder.signatures.length > 0 ? {
        signerName: workOrder.signatures[0].signerName,
        signerDocument: workOrder.signatures[0].signerDocument,
        signedAt: workOrder.signatures[0].signedAt,
        imageUrl: this.buildFileUrl(workOrder.signatures[0].attachment?.publicUrl || null),
      } : null,
      // Checklists
      checklists: workOrder.checklistInstances.map((instance) => ({
        name: instance.template?.name || 'Checklist',
        answers: instance.answers.map((answer) => ({
          questionId: answer.questionId,
          type: answer.type,
          valueText: answer.valueText,
          valueNumber: answer.valueNumber ? Number(answer.valueNumber) : null,
          valueBoolean: answer.valueBoolean,
          valueDate: answer.valueDate,
          valueJson: answer.valueJson,
          attachments: answer.attachments?.map((att) => ({
            id: att.id,
            url: this.buildFileUrl(att.publicUrl),
          })),
        })),
        templateSnapshot: instance.templateVersionSnapshot,
      })),
      // Fotos/anexos
      attachments: workOrder.attachments.map((att) => ({
        id: att.id,
        url: this.buildFileUrl(att.publicUrl),
        type: att.type,
        mimeType: att.mimeType,
        createdAt: att.createdAt,
      })),
    };
  }

  /**
   * Gera ou retorna a shareKey de uma OS
   */
  async getOrCreateShareKey(userId: string, workOrderId: string): Promise<string> {
    // Verificar se a OS pertence ao usuário
    const workOrder = await this.prisma.workOrder.findFirst({
      where: {
        id: workOrderId,
        userId,
      },
    });

    if (!workOrder) {
      throw new Error('Work order not found');
    }

    // Se já tem shareKey, retorna
    if (workOrder.shareKey) {
      return workOrder.shareKey;
    }

    // Gera nova shareKey única
    const shareKey = this.generateShareKey();

    // Atualiza a OS com a nova shareKey
    await this.prisma.workOrder.update({
      where: { id: workOrderId },
      data: { shareKey },
    });

    this.logger.log(`Generated shareKey for work order ${workOrderId}`);

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
}
