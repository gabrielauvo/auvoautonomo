import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Response from CNPJá Open API
 */
export interface CnpjLookupResponse {
  taxId: string;
  name: string;
  alias?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  status?: string;
  foundedAt?: string;
  activities?: {
    code: string;
    description: string;
  }[];
}

/**
 * Raw response from CNPJá API
 */
interface CnpjaApiResponse {
  taxId: string;
  alias?: string;
  founded?: string;
  head?: boolean;
  statusDate?: string;
  status?: {
    id: number;
    text: string;
  };
  address?: {
    municipality?: string;
    state?: string;
    street?: string;
    number?: string;
    district?: string;
    city?: string;
    zip?: string;
  };
  phones?: Array<{
    area?: string;
    number?: string;
  }>;
  emails?: Array<{
    address?: string;
  }>;
  mainActivity?: {
    id?: number;
    text?: string;
  };
  sideActivities?: Array<{
    id?: number;
    text?: string;
  }>;
  company?: {
    id?: number;
    name?: string;
    equity?: number;
    nature?: {
      id?: number;
      text?: string;
    };
    size?: {
      id?: number;
      acronym?: string;
      text?: string;
    };
  };
}

@Injectable()
export class CnpjLookupService {
  private readonly logger = new Logger(CnpjLookupService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.cnpja.com';

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('CNPJA_API_KEY') || '';
  }

  /**
   * Consulta dados de uma empresa pelo CNPJ
   * Usa a API comercial do CNPJá com autenticação
   */
  async lookup(cnpj: string): Promise<CnpjLookupResponse> {
    // Remove caracteres não numéricos
    const cleanCnpj = cnpj.replace(/\D/g, '');

    // Valida tamanho do CNPJ
    if (cleanCnpj.length !== 14) {
      throw new BadRequestException('CNPJ deve ter 14 dígitos');
    }

    // Valida se a API key está configurada
    if (!this.apiKey) {
      this.logger.warn('CNPJA_API_KEY não configurada, usando API pública');
      return this.lookupPublic(cleanCnpj);
    }

    try {
      this.logger.log(`Consultando CNPJ: ${cleanCnpj}`);

      const response = await fetch(`${this.baseUrl}/office/${cleanCnpj}`, {
        method: 'GET',
        headers: {
          Authorization: this.apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Erro na API CNPJá: ${response.status} - ${errorText}`);

        if (response.status === 404) {
          throw new BadRequestException('CNPJ não encontrado na base da Receita Federal');
        }

        if (response.status === 429) {
          throw new BadRequestException('Limite de consultas excedido. Tente novamente mais tarde.');
        }

        throw new BadRequestException('Erro ao consultar CNPJ. Tente novamente.');
      }

      const data: CnpjaApiResponse = await response.json();
      return this.transformResponse(data);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Erro ao consultar CNPJ: ${error.message}`);
      throw new BadRequestException('Erro ao consultar CNPJ. Verifique a conexão e tente novamente.');
    }
  }

  /**
   * Consulta usando API pública (sem autenticação)
   * Dados podem estar desatualizados
   */
  private async lookupPublic(cnpj: string): Promise<CnpjLookupResponse> {
    try {
      const response = await fetch(`https://open.cnpja.com/office/${cnpj}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new BadRequestException('CNPJ não encontrado');
        }
        throw new BadRequestException('Erro ao consultar CNPJ');
      }

      const data: CnpjaApiResponse = await response.json();
      return this.transformResponse(data);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Erro ao consultar CNPJ');
    }
  }

  /**
   * Transforma resposta da API para formato interno
   */
  private transformResponse(data: CnpjaApiResponse): CnpjLookupResponse {
    // Formata telefone
    let phone: string | undefined;
    if (data.phones && data.phones.length > 0) {
      const firstPhone = data.phones[0];
      if (firstPhone.area && firstPhone.number) {
        phone = `(${firstPhone.area}) ${firstPhone.number}`;
      }
    }

    // Formata endereço
    let address: string | undefined;
    if (data.address) {
      const parts: string[] = [];
      if (data.address.street) parts.push(data.address.street);
      if (data.address.number) parts.push(data.address.number);
      if (data.address.district) parts.push(data.address.district);
      address = parts.join(', ');
    }

    // Formata CEP
    let zipCode: string | undefined;
    if (data.address?.zip) {
      const zip = data.address.zip.replace(/\D/g, '');
      if (zip.length === 8) {
        zipCode = `${zip.slice(0, 5)}-${zip.slice(5)}`;
      }
    }

    // Formata atividades
    const activities: { code: string; description: string }[] = [];
    if (data.mainActivity) {
      activities.push({
        code: String(data.mainActivity.id || ''),
        description: data.mainActivity.text || '',
      });
    }
    if (data.sideActivities) {
      for (const activity of data.sideActivities) {
        activities.push({
          code: String(activity.id || ''),
          description: activity.text || '',
        });
      }
    }

    return {
      taxId: data.taxId,
      name: data.company?.name || data.alias || '',
      alias: data.alias,
      email: data.emails?.[0]?.address,
      phone,
      address,
      city: data.address?.city || data.address?.municipality,
      state: data.address?.state,
      zipCode,
      status: data.status?.text,
      foundedAt: data.founded,
      activities,
    };
  }
}
