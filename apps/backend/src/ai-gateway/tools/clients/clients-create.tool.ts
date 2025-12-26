/**
 * Clients Create Tool
 * Creates a new client for the authenticated user
 */

import { Injectable } from '@nestjs/common';
import { AiActionType } from '../../enums';
import { BaseTool } from '../base.tool';
import { ToolMetadata, ToolContext, ToolResult } from '../../interfaces/tool.interface';

interface ClientsCreateParams {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  taxId?: string;
  notes?: string;
}

interface CreatedClient {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

@Injectable()
export class ClientsCreateTool extends BaseTool<ClientsCreateParams, CreatedClient> {
  readonly metadata: ToolMetadata = {
    name: 'clients.create',
    description:
      'Cria um novo cliente. Requer confirmação antes da execução.',
    actionType: AiActionType.CREATE,
    parametersSchema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: {
          type: 'string',
          description: 'Nome completo do cliente',
          minLength: 2,
          maxLength: 255,
        },
        email: {
          type: 'string',
          format: 'email',
          description: 'Email do cliente',
        },
        phone: {
          type: 'string',
          description: 'Telefone do cliente (com DDD)',
        },
        address: {
          type: 'string',
          description: 'Endereço completo',
        },
        city: {
          type: 'string',
          description: 'Cidade',
        },
        state: {
          type: 'string',
          description: 'Estado (UF)',
          minLength: 2,
          maxLength: 2,
        },
        zipCode: {
          type: 'string',
          description: 'CEP',
        },
        taxId: {
          type: 'string',
          description: 'CPF ou CNPJ',
        },
        notes: {
          type: 'string',
          description: 'Observações sobre o cliente',
        },
      },
    },
  };

  async validate(params: ClientsCreateParams, context: ToolContext): Promise<true | string> {
    if (!params.name || params.name.trim().length < 2) {
      return 'O nome do cliente deve ter pelo menos 2 caracteres';
    }

    if (params.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(params.email)) {
        return 'Email inválido';
      }
    }

    if (params.state && params.state.length !== 2) {
      return 'O estado deve ter 2 caracteres (UF)';
    }

    // Check entity limit
    const canCreate = await this.checkEntityLimit(context.userId, 'clients');
    if (!canCreate) {
      return 'Você atingiu o limite de clientes do seu plano. Faça upgrade para continuar.';
    }

    return true;
  }

  async execute(
    params: ClientsCreateParams,
    context: ToolContext,
  ): Promise<ToolResult<CreatedClient>> {
    const client = await this.prisma.client.create({
      data: {
        userId: context.userId,
        name: params.name.trim(),
        email: params.email?.toLowerCase().trim() || null,
        phone: params.phone?.trim() || null,
        address: params.address?.trim() || null,
        city: params.city?.trim() || null,
        state: params.state?.toUpperCase().trim() || null,
        zipCode: params.zipCode?.replace(/\D/g, '') || null,
        taxId: params.taxId?.replace(/\D/g, '') || null,
        notes: params.notes?.trim() || null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
      },
    });

    return {
      success: true,
      data: client,
      affectedEntities: [{ type: 'client', id: client.id, action: 'created' }],
    };
  }
}
