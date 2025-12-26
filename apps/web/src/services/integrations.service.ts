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
};
