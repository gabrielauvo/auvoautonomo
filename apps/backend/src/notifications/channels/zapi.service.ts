import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Z-API Integration Service
 *
 * Handles WhatsApp message sending via Z-API.
 * Each user configures their own Z-API credentials (BYOC model).
 *
 * API Docs: https://developer.z-api.io/
 */

export interface ZApiSendTextRequest {
  phone: string;
  message: string;
  delayMessage?: number; // 1-15 seconds
  delayTyping?: number; // 1-15 seconds
}

export interface ZApiSendTextResponse {
  zaapId: string;
  messageId: string;
  id: string;
}

export interface ZApiConnectionStatus {
  connected: boolean;
  phone?: string;
  phoneNumber?: string; // Alias for phone
  error?: string;
}

export interface ZApiCredentials {
  instanceId: string;
  token: string;
  clientToken: string;
}

@Injectable()
export class ZApiService {
  private readonly logger = new Logger(ZApiService.name);
  private readonly baseUrl = 'https://api.z-api.io';

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get Z-API credentials for a user
   */
  async getCredentials(userId: string): Promise<ZApiCredentials | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        zapiInstanceId: true,
        zapiToken: true,
        zapiClientToken: true,
        zapiEnabled: true,
      },
    });

    if (!user?.zapiEnabled || !user.zapiInstanceId || !user.zapiToken || !user.zapiClientToken) {
      return null;
    }

    return {
      instanceId: user.zapiInstanceId,
      token: user.zapiToken,
      clientToken: user.zapiClientToken,
    };
  }

  /**
   * Send text message via Z-API
   */
  async sendText(
    credentials: ZApiCredentials,
    request: ZApiSendTextRequest,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const url = `${this.baseUrl}/instances/${credentials.instanceId}/token/${credentials.token}/send-text`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': credentials.clientToken,
        },
        body: JSON.stringify({
          phone: this.normalizePhone(request.phone),
          message: request.message,
          ...(request.delayMessage && { delayMessage: request.delayMessage }),
          ...(request.delayTyping && { delayTyping: request.delayTyping }),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Z-API error: ${response.status} - ${errorText}`);
        return {
          success: false,
          error: `Z-API error: ${response.status}`,
        };
      }

      const data = (await response.json()) as ZApiSendTextResponse;
      this.logger.log(`Z-API message sent: ${data.messageId}`);

      return {
        success: true,
        messageId: data.messageId || data.id,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Z-API request failed: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Check connection status
   */
  async checkConnection(credentials: ZApiCredentials): Promise<ZApiConnectionStatus> {
    const url = `${this.baseUrl}/instances/${credentials.instanceId}/token/${credentials.token}/status`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Client-Token': credentials.clientToken,
        },
      });

      if (!response.ok) {
        return {
          connected: false,
          error: `Z-API status error: ${response.status}`,
        };
      }

      const data = await response.json();

      // Z-API returns different status values
      // connected: true when WhatsApp is connected
      const isConnected = data.connected === true || data.status === 'CONNECTED';

      const phoneValue = data.phone || data.phoneNumber;
      return {
        connected: isConnected,
        phone: phoneValue,
        phoneNumber: phoneValue, // Alias
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        connected: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get QR Code for connecting WhatsApp
   */
  async getQrCode(credentials: ZApiCredentials): Promise<{ qrCode?: string; error?: string }> {
    const url = `${this.baseUrl}/instances/${credentials.instanceId}/token/${credentials.token}/qr-code/image`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Client-Token': credentials.clientToken,
        },
      });

      if (!response.ok) {
        return {
          error: `Failed to get QR code: ${response.status}`,
        };
      }

      const data = await response.json();

      return {
        qrCode: data.value || data.qrCode,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        error: errorMessage,
      };
    }
  }

  /**
   * Disconnect WhatsApp session
   */
  async disconnect(credentials: ZApiCredentials): Promise<{ success: boolean; error?: string }> {
    const url = `${this.baseUrl}/instances/${credentials.instanceId}/token/${credentials.token}/disconnect`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Client-Token': credentials.clientToken,
        },
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to disconnect: ${response.status}`,
        };
      }

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Normalize phone number to Z-API format (digits only, with country code)
   */
  private normalizePhone(phone: string): string {
    // Remove all non-digit characters
    let digits = phone.replace(/\D/g, '');

    // If Brazilian number without country code, add 55
    if (digits.length === 10 || digits.length === 11) {
      digits = '55' + digits;
    }

    return digits;
  }

  /**
   * Mask phone for logging (privacy)
   */
  maskPhone(phone: string): string {
    if (phone.length < 8) return '****';
    return phone.substring(0, 4) + '****' + phone.substring(phone.length - 4);
  }
}
