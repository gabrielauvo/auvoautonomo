/**
 * Suppliers Service - Serviço de Fornecedores
 *
 * Gerencia:
 * - CRUD de fornecedores
 * - Busca e listagem
 */

import api, { getErrorMessage } from './api';

/**
 * Tipos de dados do fornecedor
 */
export interface Supplier {
  id: string;
  userId: string;
  name: string;
  document?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  // Contagens (vêm do backend)
  _count?: {
    expenses: number;
  };
}

export interface CreateSupplierDto {
  name: string;
  document?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

export interface UpdateSupplierDto extends Partial<CreateSupplierDto> {}

export interface SupplierListResponse {
  data: Supplier[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SupplierSearchParams {
  search?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Sanitiza parâmetros de busca para prevenir XSS
 */
function sanitizeSearchParam(value: string): string {
  return value
    .trim()
    .replace(/[<>]/g, '')
    .slice(0, 100);
}

/**
 * Listar todos os fornecedores
 */
export async function listSuppliers(params?: SupplierSearchParams): Promise<Supplier[]> {
  try {
    const queryParams: Record<string, string | number> = {};

    if (params?.search) {
      queryParams.search = sanitizeSearchParam(params.search);
    }
    if (params?.page) {
      queryParams.page = params.page;
    }
    if (params?.pageSize) {
      queryParams.pageSize = params.pageSize;
    }

    const response = await api.get<Supplier[]>('/suppliers', { params: queryParams });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Obter fornecedor por ID
 */
export async function getSupplierById(id: string): Promise<Supplier> {
  try {
    const response = await api.get<Supplier>(`/suppliers/${id}`);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Criar fornecedor
 */
export async function createSupplier(data: CreateSupplierDto): Promise<Supplier> {
  try {
    const response = await api.post<Supplier>('/suppliers', data);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Atualizar fornecedor
 */
export async function updateSupplier(id: string, data: UpdateSupplierDto): Promise<Supplier> {
  try {
    const response = await api.patch<Supplier>(`/suppliers/${id}`, data);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Deletar fornecedor (soft delete)
 */
export async function deleteSupplier(id: string): Promise<void> {
  try {
    await api.delete(`/suppliers/${id}`);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export const suppliersService = {
  listSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
};

export default suppliersService;
