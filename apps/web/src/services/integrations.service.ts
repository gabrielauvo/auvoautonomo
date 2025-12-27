import { api } from '@/services/api';

// ============================================
// ASAAS
// ============================================

export type AsaasEnvironment = 'SANDBOX' | 'PRODUCTION';

export interface AsaasAccountInfo {
  name: string;
  email: string;
  cpfCnpj?: string;
  personType?: string;
}

export interface AsaasIntegrationStatus {
  connected: boolean;
  environment: AsaasEnvironment | null;
  isActive: boolean;
  connectedAt?: string;
  accountInfo?: AsaasAccountInfo;
  error?: string;
}

export interface ConnectAsaasDto {
  apiKey: string;
  environment: AsaasEnvironment;
}

export interface ConnectAsaasResponse {
  id: string;
  environment: AsaasEnvironment;
  isActive: boolean;
  connectedAt: string;
  accountInfo: AsaasAccountInfo;
}

// ============================================
// STRIPE
// ============================================

export type StripeEnvironment = 'TEST' | 'LIVE';

export interface StripeAccountInfo {
  name?: string;
  email: string;
  country?: string;
}

export interface StripeIntegrationStatus {
  connected: boolean;
  environment: StripeEnvironment | null;
  isActive: boolean;
  connectedAt?: string;
  publishableKey?: string;
  accountInfo?: StripeAccountInfo;
  error?: string;
}

export interface ConnectStripeDto {
  secretKey: string;
  publishableKey?: string;
  webhookSecret?: string;
  environment: StripeEnvironment;
}

export interface ConnectStripeResponse {
  id: string;
  environment: StripeEnvironment;
  isActive: boolean;
  connectedAt: string;
  accountInfo: StripeAccountInfo;
}

// ============================================
// MERCADO PAGO
// ============================================

export type MercadoPagoEnvironment = 'SANDBOX' | 'PRODUCTION';

export interface MercadoPagoAccountInfo {
  name?: string;
  email: string;
  country?: string;
}

export interface MercadoPagoIntegrationStatus {
  connected: boolean;
  environment: MercadoPagoEnvironment | null;
  country?: string;
  isActive: boolean;
  connectedAt?: string;
  publicKey?: string;
  accountInfo?: MercadoPagoAccountInfo;
  error?: string;
}

export interface ConnectMercadoPagoDto {
  accessToken: string;
  publicKey?: string;
  webhookSecret?: string;
  environment: MercadoPagoEnvironment;
  country?: string;
}

export interface ConnectMercadoPagoResponse {
  id: string;
  environment: MercadoPagoEnvironment;
  country?: string;
  isActive: boolean;
  connectedAt: string;
  accountInfo: MercadoPagoAccountInfo;
}

// ============================================
// Z-API (WhatsApp)
// ============================================

export interface ZApiStatus {
  configured: boolean;
  enabled: boolean;
  instanceId: string | null;
  hasToken: boolean;
  hasClientToken: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'error' | 'not_configured';
  phoneNumber: string | null;
  connectedAt: string | null;
}

export interface ZApiConnectionStatus {
  configured: boolean;
  connected: boolean;
  status: 'connected' | 'disconnected' | 'error' | 'not_configured';
  phoneNumber: string | null;
  message: string;
}

export interface ZApiQrCodeResponse {
  qrCode: string;
  message: string;
}

export interface ConnectZApiDto {
  instanceId: string;
  token: string;
  clientToken: string;
  enabled?: boolean;
}

export interface ZApiTestMessageDto {
  phone: string;
}

// ============================================
// SERVICE
// ============================================

export const integrationsService = {
  // Asaas
  async getAsaasStatus(): Promise<AsaasIntegrationStatus> {
    const response = await api.get<AsaasIntegrationStatus>('/integrations/asaas/status');
    return response.data;
  },

  async connectAsaas(dto: ConnectAsaasDto): Promise<ConnectAsaasResponse> {
    const response = await api.post<ConnectAsaasResponse>('/integrations/asaas/connect', dto);
    return response.data;
  },

  async disconnectAsaas(): Promise<{ message: string }> {
    const response = await api.delete<{ message: string }>('/integrations/asaas/disconnect');
    return response.data;
  },

  // Stripe
  async getStripeStatus(): Promise<StripeIntegrationStatus> {
    const response = await api.get<StripeIntegrationStatus>('/integrations/stripe/status');
    return response.data;
  },

  async connectStripe(dto: ConnectStripeDto): Promise<ConnectStripeResponse> {
    const response = await api.post<ConnectStripeResponse>('/integrations/stripe/connect', dto);
    return response.data;
  },

  async disconnectStripe(): Promise<{ message: string }> {
    const response = await api.delete<{ message: string }>('/integrations/stripe/disconnect');
    return response.data;
  },

  // Mercado Pago
  async getMercadoPagoStatus(): Promise<MercadoPagoIntegrationStatus> {
    const response = await api.get<MercadoPagoIntegrationStatus>('/integrations/mercadopago/status');
    return response.data;
  },

  async connectMercadoPago(dto: ConnectMercadoPagoDto): Promise<ConnectMercadoPagoResponse> {
    const response = await api.post<ConnectMercadoPagoResponse>('/integrations/mercadopago/connect', dto);
    return response.data;
  },

  async disconnectMercadoPago(): Promise<{ message: string }> {
    const response = await api.delete<{ message: string }>('/integrations/mercadopago/disconnect');
    return response.data;
  },

  // Z-API (WhatsApp)
  async getZApiStatus(): Promise<ZApiStatus> {
    const response = await api.get<ZApiStatus>('/settings/whatsapp/zapi');
    return response.data;
  },

  async getZApiConnectionStatus(): Promise<ZApiConnectionStatus> {
    const response = await api.get<ZApiConnectionStatus>('/settings/whatsapp/zapi/status');
    return response.data;
  },

  async connectZApi(dto: ConnectZApiDto): Promise<{ configured: boolean; enabled: boolean; message: string }> {
    const response = await api.put<{ configured: boolean; enabled: boolean; message: string }>(
      '/settings/whatsapp/zapi',
      dto,
    );
    return response.data;
  },

  async getZApiQrCode(): Promise<ZApiQrCodeResponse> {
    const response = await api.get<ZApiQrCodeResponse>('/settings/whatsapp/zapi/qrcode');
    return response.data;
  },

  async disconnectZApi(): Promise<{ success: boolean; message: string }> {
    const response = await api.post<{ success: boolean; message: string }>(
      '/settings/whatsapp/zapi/disconnect',
    );
    return response.data;
  },

  async testZApiMessage(dto: ZApiTestMessageDto): Promise<{ success: boolean; message: string }> {
    const response = await api.post<{ success: boolean; message: string }>(
      '/settings/whatsapp/zapi/test',
      dto,
    );
    return response.data;
  },
};
