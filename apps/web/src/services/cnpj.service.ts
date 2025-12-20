/**
 * CNPJ Lookup Service - Serviço de consulta CNPJ
 *
 * Consulta dados de empresas via API CNPJá
 */

import api, { getErrorMessage } from './api';

/**
 * Dados retornados da consulta CNPJ
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
 * Consultar dados de empresa pelo CNPJ
 */
export async function lookupCnpj(cnpj: string): Promise<CnpjLookupResponse> {
  try {
    // Remove caracteres não numéricos
    const cleanCnpj = cnpj.replace(/\D/g, '');

    const response = await api.get<CnpjLookupResponse>(`/cnpj/${cleanCnpj}`);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export const cnpjService = {
  lookupCnpj,
};

export default cnpjService;
