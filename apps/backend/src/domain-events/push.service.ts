import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DevicesService } from '../devices/devices.service';
import {
  ExpoPushMessage,
  ExpoPushTicket,
  EventPayload,
  PushNotificationData,
  DomainEventType,
} from './types';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    private configService: ConfigService,
    private devicesService: DevicesService,
  ) {}

  /**
   * Send push notification to a user
   */
  async sendToUser(
    userId: string,
    notification: PushNotificationData,
  ): Promise<{ sent: number; failed: number }> {
    // Get user's active device tokens
    const tokens = await this.devicesService.getActiveTokensForUser(userId);

    if (tokens.length === 0) {
      this.logger.debug(`No active devices found for user ${userId}`);
      return { sent: 0, failed: 0 };
    }

    // Send to all user devices
    return this.sendToTokens(tokens, notification);
  }

  /**
   * Send push notification to multiple tokens
   */
  async sendToTokens(
    tokens: string[],
    notification: PushNotificationData,
  ): Promise<{ sent: number; failed: number }> {
    if (tokens.length === 0) {
      return { sent: 0, failed: 0 };
    }

    // Build Expo push messages
    const messages: ExpoPushMessage[] = tokens.map((token) => ({
      to: token,
      title: notification.title,
      body: notification.body,
      data: notification.data as unknown as Record<string, unknown>,
      sound: 'default',
      priority: 'high',
      channelId: 'default',
    }));

    try {
      const tickets = await this.sendPushNotifications(messages);

      let sent = 0;
      let failed = 0;

      // Process tickets
      for (let i = 0; i < tickets.length; i++) {
        const ticket = tickets[i];
        const token = tokens[i];

        if (ticket.status === 'ok') {
          sent++;
        } else {
          failed++;
          this.logger.warn(
            `Push failed for token ${token.substring(0, 20)}...: ${ticket.message}`,
          );

          // Deactivate device if not registered
          if (ticket.details?.error === 'DeviceNotRegistered') {
            await this.devicesService.deactivateDevice(token);
          }
        }
      }

      return { sent, failed };
    } catch (error) {
      this.logger.error(`Failed to send push notifications: ${error.message}`);
      return { sent: 0, failed: tokens.length };
    }
  }

  /**
   * Send push notifications via Expo API
   */
  private async sendPushNotifications(
    messages: ExpoPushMessage[],
  ): Promise<ExpoPushTicket[]> {
    // Chunk messages (Expo recommends max 100 per request)
    const chunks = this.chunkArray(messages, 100);
    const allTickets: ExpoPushTicket[] = [];

    for (const chunk of chunks) {
      try {
        const response = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(chunk),
        });

        if (!response.ok) {
          throw new Error(`Expo Push API error: ${response.status}`);
        }

        const result = await response.json();
        allTickets.push(...(result.data || []));
      } catch (error) {
        this.logger.error(`Expo Push API request failed: ${error.message}`);
        // Add error tickets for failed chunk
        for (let i = 0; i < chunk.length; i++) {
          allTickets.push({
            status: 'error',
            message: error.message,
          });
        }
      }
    }

    return allTickets;
  }

  /**
   * Build notification content from event type
   */
  buildNotification(
    eventType: DomainEventType,
    payload: EventPayload,
  ): PushNotificationData {
    const { title, body } = this.getNotificationContent(eventType, payload);

    return {
      title,
      body,
      data: payload,
    };
  }

  /**
   * Get notification title and body based on event type
   */
  private getNotificationContent(
    eventType: DomainEventType,
    payload: EventPayload,
  ): { title: string; body: string } {
    switch (eventType) {
      // Work Order events
      case 'work_order.created':
        return {
          title: 'Nova Ordem de Serviço',
          body: `OS criada: ${(payload as any).title || 'Nova OS'}`,
        };
      case 'work_order.assigned':
        return {
          title: 'OS Atribuída',
          body: `Você recebeu uma nova OS: ${(payload as any).title || ''}`,
        };
      case 'work_order.status_changed':
        return {
          title: 'Status Atualizado',
          body: `OS atualizada para: ${(payload as any).status || 'novo status'}`,
        };
      case 'work_order.completed':
        return {
          title: 'OS Concluída',
          body: `A OS "${(payload as any).title || ''}" foi concluída`,
        };

      // Quote events
      case 'quote.created':
        return {
          title: 'Novo Orçamento',
          body: `Orçamento criado para ${(payload as any).clientName || 'cliente'}`,
        };
      case 'quote.approved':
        return {
          title: 'Orçamento Aprovado!',
          body: `${(payload as any).clientName || 'Cliente'} aprovou o orçamento`,
        };
      case 'quote.rejected':
        return {
          title: 'Orçamento Rejeitado',
          body: `${(payload as any).clientName || 'Cliente'} rejeitou o orçamento`,
        };
      case 'quote.sent':
        return {
          title: 'Orçamento Enviado',
          body: `Orçamento enviado para ${(payload as any).clientName || 'cliente'}`,
        };

      // Invoice events
      case 'invoice.created':
        return {
          title: 'Nova Fatura',
          body: `Fatura criada para ${(payload as any).clientName || 'cliente'}`,
        };
      case 'invoice.paid':
        return {
          title: 'Pagamento Recebido!',
          body: `Fatura de ${(payload as any).clientName || 'cliente'} foi paga`,
        };
      case 'invoice.overdue':
        return {
          title: 'Fatura Vencida',
          body: `Fatura de ${(payload as any).clientName || 'cliente'} está vencida`,
        };

      // Client events
      case 'client.created':
        return {
          title: 'Novo Cliente',
          body: `Cliente "${(payload as any).name || ''}" cadastrado`,
        };
      case 'client.updated':
        return {
          title: 'Cliente Atualizado',
          body: `Dados de "${(payload as any).name || 'cliente'}" foram atualizados`,
        };

      // Payment events
      case 'payment.confirmed':
        return {
          title: 'Pagamento Confirmado!',
          body: `Pagamento de ${(payload as any).clientName || 'cliente'} confirmado`,
        };
      case 'payment.overdue':
        return {
          title: 'Pagamento Atrasado',
          body: `Pagamento de ${(payload as any).clientName || 'cliente'} está atrasado`,
        };

      // Sync events
      case 'sync.full_required':
        return {
          title: 'Sincronização Necessária',
          body: 'Por favor, sincronize seus dados',
        };

      default:
        return {
          title: 'Atualização',
          body: 'Há uma nova atualização disponível',
        };
    }
  }

  /**
   * Chunk array into smaller arrays
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}
