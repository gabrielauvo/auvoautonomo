import {
  Controller,
  Post,
  Body,
  Headers,
  Logger,
  HttpCode,
  HttpStatus,
  BadRequestException,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as crypto from 'crypto';
import { WebhooksService } from './webhooks.service';
import { AsaasWebhookEvent } from '../common/asaas/asaas-http.client';
import { Throttle } from '@nestjs/throttler';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);
  private readonly webhookSecret: string;
  private readonly allowedIps: string[];

  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly configService: ConfigService,
  ) {
    this.webhookSecret =
      this.configService.get<string>('ASAAS_WEBHOOK_SECRET') || '';
    // IPs conhecidos do Asaas (verificar documentação oficial)
    this.allowedIps = (
      this.configService.get<string>('ASAAS_ALLOWED_IPS') || ''
    )
      .split(',')
      .filter(Boolean);
  }

  /**
   * Valida a assinatura do webhook do Asaas
   */
  private validateSignature(
    payload: string,
    signature: string | undefined,
  ): boolean {
    if (!this.webhookSecret) {
      this.logger.warn(
        'ASAAS_WEBHOOK_SECRET not configured - webhook validation disabled',
      );
      return true; // Em desenvolvimento, permite sem validação
    }

    if (!signature) {
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );
  }

  /**
   * POST /webhooks/asaas
   * Endpoint para receber webhooks do Asaas
   * Validação de assinatura e rate limiting aplicados
   */
  @Post('asaas')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 100, ttl: 60000 } }) // 100 requests por minuto
  async handleAsaasWebhook(
    @Body() event: AsaasWebhookEvent,
    @Headers('x-asaas-signature') signature: string | undefined,
    @Headers('x-forwarded-for') forwardedFor: string | undefined,
    @Req() request: RawBodyRequest<Request>,
  ) {
    // Validar IP de origem se lista de IPs configurada
    if (this.allowedIps.length > 0) {
      const clientIp = forwardedFor?.split(',')[0]?.trim() || request.ip;
      if (!this.allowedIps.includes(clientIp || '')) {
        this.logger.warn(`Webhook from unauthorized IP: ${clientIp}`);
        throw new BadRequestException('Unauthorized source');
      }
    }

    // Validar assinatura
    const rawBody = request.rawBody?.toString() || JSON.stringify(event);
    if (!this.validateSignature(rawBody, signature)) {
      this.logger.warn('Invalid webhook signature received');
      throw new BadRequestException('Invalid signature');
    }

    // Validar campos obrigatórios
    if (!event.event || !event.payment) {
      this.logger.warn('Invalid webhook payload: missing required fields');
      throw new BadRequestException('Invalid payload');
    }

    this.logger.log(`Received Asaas webhook event: ${event.event}`);

    try {
      await this.webhooksService.handleAsaasEvent(event);
      return { received: true };
    } catch (error) {
      this.logger.error('Failed to process Asaas webhook', error);
      return { received: true };
    }
  }
}
