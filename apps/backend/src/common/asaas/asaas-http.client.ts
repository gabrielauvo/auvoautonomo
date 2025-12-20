import { Injectable, Logger } from '@nestjs/common';
import { AsaasEnvironment } from '@prisma/client';

export interface AsaasCustomer {
  id?: string;
  name: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  cpfCnpj?: string;
  postalCode?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string;
  externalReference?: string;
  notificationDisabled?: boolean;
  additionalEmails?: string;
  municipalInscription?: string;
  stateInscription?: string;
  observations?: string;
}

export interface AsaasPayment {
  customer: string;
  billingType: 'BOLETO' | 'CREDIT_CARD' | 'PIX';
  value: number;
  dueDate: string;
  description?: string;
  externalReference?: string;
  installmentCount?: number;
  installmentValue?: number;
  discount?: {
    value?: number;
    dueDateLimitDays?: number;
    type?: 'FIXED' | 'PERCENTAGE';
  };
  interest?: {
    value?: number;
  };
  fine?: {
    value?: number;
  };
  postalService?: boolean;
  split?: Array<{
    walletId: string;
    fixedValue?: number;
    percentualValue?: number;
  }>;
}

export interface AsaasPaymentResponse {
  id: string;
  customer: string;
  billingType: string;
  value: number;
  netValue?: number;
  originalValue?: number;
  dueDate: string;
  status: string;
  description?: string;
  externalReference?: string;
  invoiceUrl?: string;
  invoiceNumber?: string;
  bankSlipUrl?: string;
  pixTransaction?: {
    qrCode: {
      payload: string;
      encodedImage: string;
    };
    expirationDate?: string;
  };
  confirmedDate?: string;
  paymentDate?: string;
  clientPaymentDate?: string;
  installmentNumber?: number;
  transactionReceiptUrl?: string;
  nossoNumero?: string;
  refunds?: any[];
  deleted?: boolean;
  postalService?: boolean;
  anticipated?: boolean;
  anticipable?: boolean;
}

export interface AsaasAccountInfo {
  object: string;
  id: string;
  name: string;
  email: string;
  loginEmail?: string;
  phone?: string;
  mobilePhone?: string;
  cpfCnpj: string;
  personType: 'FISICA' | 'JURIDICA';
  companyType?: string;
  birthDate?: string;
  postalCode?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string;
  city?: string;
  state?: string;
  country?: string;
  walletId?: string;
}

export interface AsaasWebhookEvent {
  event: string;
  payment?: {
    id: string;
    customer: string;
    value: number;
    netValue?: number;
    originalValue?: number;
    dueDate: string;
    paymentDate?: string;
    clientPaymentDate?: string;
    installmentNumber?: number;
    billingType: string;
    status: string;
    description?: string;
    externalReference?: string;
    confirmedDate?: string;
    refundedValue?: number;
    deleted?: boolean;
  };
}

@Injectable()
export class AsaasHttpClient {
  private readonly logger = new Logger(AsaasHttpClient.name);
  private readonly sandboxUrl = 'https://api-sandbox.asaas.com/v3';
  private readonly productionUrl = 'https://api.asaas.com/v3';

  private getBaseUrl(environment: AsaasEnvironment): string {
    return environment === AsaasEnvironment.SANDBOX ? this.sandboxUrl : this.productionUrl;
  }

  private getHeaders(apiKey: string): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'accept': 'application/json',
      'access_token': apiKey,
      'User-Agent': 'FieldFlow/1.0',
    };
  }

  /**
   * Get account information to validate API Key
   * Endpoint: GET /myAccount/commercialInfo
   * Docs: https://docs.asaas.com/reference/recuperar-dados-comerciais
   */
  async getAccountInfo(apiKey: string, environment: AsaasEnvironment): Promise<AsaasAccountInfo> {
    const url = `${this.getBaseUrl(environment)}/myAccount/commercialInfo`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(apiKey),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        this.logger.error('Failed to get account info', {
          status: response.status,
          error: errorData,
        });
        throw new Error(`Failed to get account info: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this.logger.log('Account info retrieved successfully');
      return data;
    } catch (error) {
      this.logger.error('Error getting account info', error);
      throw error;
    }
  }

  /**
   * Create or update a customer
   * Endpoint: POST /customers or PUT /customers/:id
   * Docs: https://docs.asaas.com/reference/criar-novo-cliente
   */
  async createOrUpdateCustomer(
    apiKey: string,
    environment: AsaasEnvironment,
    customer: AsaasCustomer,
  ): Promise<AsaasCustomer> {
    const baseUrl = this.getBaseUrl(environment);
    const isUpdate = !!customer.id;
    const url = isUpdate ? `${baseUrl}/customers/${customer.id}` : `${baseUrl}/customers`;
    const method = isUpdate ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: this.getHeaders(apiKey),
        body: JSON.stringify(customer),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        this.logger.error(`Failed to ${isUpdate ? 'update' : 'create'} customer`, {
          status: response.status,
          error: errorData,
        });
        throw new Error(
          `Failed to ${isUpdate ? 'update' : 'create'} customer: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();
      this.logger.log(`Customer ${isUpdate ? 'updated' : 'created'} successfully`, { id: data.id });
      return data;
    } catch (error) {
      this.logger.error(`Error ${isUpdate ? 'updating' : 'creating'} customer`, error);
      throw error;
    }
  }

  /**
   * Create a payment (charge)
   * Endpoint: POST /payments
   * Docs: https://docs.asaas.com/reference/criar-nova-cobranca
   */
  async createPayment(
    apiKey: string,
    environment: AsaasEnvironment,
    payment: AsaasPayment,
  ): Promise<AsaasPaymentResponse> {
    const url = `${this.getBaseUrl(environment)}/payments`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(apiKey),
        body: JSON.stringify(payment),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        this.logger.error('Failed to create payment', {
          status: response.status,
          error: errorData,
        });

        // Extract Asaas error message for better UX
        const asaasError = this.extractAsaasErrorMessage(errorData);
        throw new Error(asaasError || `Failed to create payment: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this.logger.log('Payment created successfully', { id: data.id });
      return data;
    } catch (error) {
      this.logger.error('Error creating payment', error);
      throw error;
    }
  }

  /**
   * Extract user-friendly error message from Asaas API response
   */
  private extractAsaasErrorMessage(errorData: any): string | null {
    // Asaas returns errors in format: { errors: [{ code: 'xxx', description: 'message' }] }
    if (errorData?.errors?.length > 0) {
      const firstError = errorData.errors[0];
      const code = firstError.code;
      const description = firstError.description;

      // Map known error codes to friendly messages
      const errorMessages: Record<string, string> = {
        invalid_billingType: 'PIX não está disponível. Sua conta Asaas precisa ser aprovada para usar PIX. Use Boleto ou Cartão de Crédito.',
        invalid_customer: 'Cliente inválido ou não encontrado no Asaas.',
        invalid_value: 'Valor da cobrança inválido.',
        invalid_dueDate: 'Data de vencimento inválida.',
        insufficient_balance: 'Saldo insuficiente na conta Asaas.',
      };

      return errorMessages[code] || description || null;
    }

    return null;
  }

  /**
   * Get payment by ID
   * Endpoint: GET /payments/:id
   * Docs: https://docs.asaas.com/reference/recuperar-uma-unica-cobranca
   */
  async getPayment(
    apiKey: string,
    environment: AsaasEnvironment,
    paymentId: string,
  ): Promise<AsaasPaymentResponse> {
    const url = `${this.getBaseUrl(environment)}/payments/${paymentId}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(apiKey),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        this.logger.error('Failed to get payment', {
          status: response.status,
          error: errorData,
        });
        throw new Error(`Failed to get payment: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      this.logger.error('Error getting payment', error);
      throw error;
    }
  }

  /**
   * Delete payment
   * Endpoint: DELETE /payments/:id
   * Docs: https://docs.asaas.com/reference/remover-cobranca
   */
  async deletePayment(apiKey: string, environment: AsaasEnvironment, paymentId: string): Promise<void> {
    const url = `${this.getBaseUrl(environment)}/payments/${paymentId}`;

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: this.getHeaders(apiKey),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        this.logger.error('Failed to delete payment', {
          status: response.status,
          error: errorData,
        });
        throw new Error(`Failed to delete payment: ${response.status} ${response.statusText}`);
      }

      this.logger.log('Payment deleted successfully', { id: paymentId });
    } catch (error) {
      this.logger.error('Error deleting payment', error);
      throw error;
    }
  }
}
