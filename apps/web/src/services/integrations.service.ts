import { api } from '@/services/api';

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

export const integrationsService = {
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
};
