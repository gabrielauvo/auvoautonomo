import { api } from './api';

export interface WorkOrderType {
  id: string;
  userId: string;
  name: string;
  description?: string;
  color?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkOrderTypeDto {
  name: string;
  description?: string;
  color?: string;
}

export interface UpdateWorkOrderTypeDto {
  name?: string;
  description?: string;
  color?: string;
  isActive?: boolean;
}

export interface WorkOrderTypesListResponse {
  items: WorkOrderType[];
  total: number;
  limit: number;
  offset: number;
}

export interface WorkOrderTypesFilters {
  search?: string;
  isActive?: boolean;
  limit?: number;
  offset?: number;
}

export const workOrderTypesService = {
  /**
   * List work order types with optional filters
   */
  async list(filters: WorkOrderTypesFilters = {}): Promise<WorkOrderTypesListResponse> {
    const params = new URLSearchParams();

    if (filters.search) params.append('search', filters.search);
    if (filters.isActive !== undefined) params.append('isActive', String(filters.isActive));
    if (filters.limit) params.append('limit', String(filters.limit));
    if (filters.offset) params.append('offset', String(filters.offset));

    const queryString = params.toString();
    const url = queryString ? `/work-order-types?${queryString}` : '/work-order-types';

    const response = await api.get<WorkOrderTypesListResponse>(url);
    return response.data;
  },

  /**
   * Get a single work order type by ID
   */
  async getById(id: string): Promise<WorkOrderType> {
    const response = await api.get<WorkOrderType>(`/work-order-types/${id}`);
    return response.data;
  },

  /**
   * Create a new work order type
   */
  async create(data: CreateWorkOrderTypeDto): Promise<WorkOrderType> {
    const response = await api.post<WorkOrderType>('/work-order-types', data);
    return response.data;
  },

  /**
   * Update an existing work order type
   */
  async update(id: string, data: UpdateWorkOrderTypeDto): Promise<WorkOrderType> {
    const response = await api.put<WorkOrderType>(`/work-order-types/${id}`, data);
    return response.data;
  },

  /**
   * Deactivate a work order type (soft delete)
   */
  async deactivate(id: string): Promise<WorkOrderType> {
    const response = await api.patch<WorkOrderType>(`/work-order-types/${id}/deactivate`);
    return response.data;
  },

  /**
   * Reactivate a work order type
   */
  async reactivate(id: string): Promise<WorkOrderType> {
    const response = await api.patch<WorkOrderType>(`/work-order-types/${id}/reactivate`);
    return response.data;
  },

  /**
   * Get active work order types for selection
   */
  async getActiveTypes(): Promise<WorkOrderType[]> {
    const response = await api.get<WorkOrderTypesListResponse>('/work-order-types?isActive=true&limit=100');
    return response.data.items;
  },
};
