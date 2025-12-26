/**
 * Clients Update Tool
 * Updates an existing client
 */

import { Injectable } from '@nestjs/common';
import { AiActionType } from '../../enums';
import { BaseTool } from '../base.tool';
import { ToolMetadata, ToolContext, ToolResult } from '../../interfaces/tool.interface';

interface ClientsUpdateParams {
  clientId: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  taxId?: string;
  notes?: string;
}

interface UpdatedClient {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

@Injectable()
export class ClientsUpdateTool extends BaseTool<ClientsUpdateParams, UpdatedClient> {
  readonly metadata: ToolMetadata = {
    name: 'clients.update',
    description:
      'Atualiza os dados de um cliente existente. Requer confirmação antes da execução.',
    actionType: AiActionType.UPDATE,
    parametersSchema: {
      type: 'object',
      required: ['clientId'],
      properties: {
        clientId: {
          type: 'string',
          format: 'uuid',
          description: 'ID do cliente a ser atualizado',
        },
        name: {
          type: 'string',
          description: 'Novo nome do cliente',
          minLength: 2,
          maxLength: 255,
        },
        email: {
          type: 'string',
          format: 'email',
          description: 'Novo email do cliente',
        },
        phone: {
          type: 'string',
          description: 'Novo telefone do cliente',
        },
        address: {
          type: 'string',
          description: 'Novo endereço',
        },
        city: {
          type: 'string',
          description: 'Nova cidade',
        },
        state: {
          type: 'string',
          description: 'Novo estado (UF)',
        },
        zipCode: {
          type: 'string',
          description: 'Novo CEP',
        },
        taxId: {
          type: 'string',
          description: 'Novo CPF ou CNPJ',
        },
        notes: {
          type: 'string',
          description: 'Novas observações',
        },
      },
    },
  };

  async validate(params: ClientsUpdateParams, context: ToolContext): Promise<true | string> {
    if (!params.clientId) {
      return 'O ID do cliente é obrigatório';
    }

    // Check ownership
    const isOwner = await this.verifyOwnership('client', params.clientId, context.userId);
    if (!isOwner) {
      return 'Cliente não encontrado';
    }

    // Validate fields if provided
    if (params.name !== undefined && params.name.trim().length < 2) {
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

    // Check if at least one field is being updated
    const updateFields = ['name', 'email', 'phone', 'address', 'city', 'state', 'zipCode', 'taxId', 'notes'];
    const hasUpdate = updateFields.some((field) => params[field as keyof ClientsUpdateParams] !== undefined);

    if (!hasUpdate) {
      return 'Nenhum campo para atualizar foi fornecido';
    }

    return true;
  }

  async execute(
    params: ClientsUpdateParams,
    context: ToolContext,
  ): Promise<ToolResult<UpdatedClient>> {
    const { clientId, ...updateData } = params;

    // Build update object with only provided fields
    const data: Record<string, unknown> = {};

    if (updateData.name !== undefined) data.name = updateData.name.trim();
    if (updateData.email !== undefined) data.email = updateData.email.toLowerCase().trim() || null;
    if (updateData.phone !== undefined) data.phone = updateData.phone.trim() || null;
    if (updateData.address !== undefined) data.address = updateData.address.trim() || null;
    if (updateData.city !== undefined) data.city = updateData.city.trim() || null;
    if (updateData.state !== undefined) data.state = updateData.state.toUpperCase().trim() || null;
    if (updateData.zipCode !== undefined) data.zipCode = updateData.zipCode.replace(/\D/g, '') || null;
    if (updateData.taxId !== undefined) data.taxId = updateData.taxId.replace(/\D/g, '') || null;
    if (updateData.notes !== undefined) data.notes = updateData.notes.trim() || null;

    const client = await this.prisma.client.update({
      where: { id: clientId },
      data,
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
      affectedEntities: [{ type: 'client', id: client.id, action: 'updated' }],
    };
  }
}
