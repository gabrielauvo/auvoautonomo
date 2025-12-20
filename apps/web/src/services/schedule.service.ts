/**
 * Schedule Service
 *
 * Serviço para buscar atividades da agenda (Work Orders e visitas de orçamento)
 */

import api from './api';

export type ScheduleActivityType = 'WORK_ORDER' | 'QUOTE_VISIT';
export type ScheduleActivityStatus =
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'DONE'
  | 'CANCELED'
  | 'DRAFT'
  | 'SENT'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED';

export interface ScheduleActivityClient {
  id: string;
  name: string;
  phone?: string;
}

export interface ScheduleActivity {
  id: string;
  type: ScheduleActivityType;
  title: string;
  status: ScheduleActivityStatus;
  scheduledStart: string;
  scheduledEnd?: string;
  client: ScheduleActivityClient;
  address?: string;
  totalValue?: number;
  durationMinutes?: number;
}

export interface ScheduleDayResponse {
  date: string;
  activities: ScheduleActivity[];
  totalCount: number;
  workOrdersCount: number;
  quoteVisitsCount: number;
}

export const scheduleService = {
  /**
   * Busca atividades de um dia específico
   */
  async getScheduleByDay(date: string): Promise<ScheduleDayResponse> {
    const response = await api.get<ScheduleDayResponse>('/schedule/day', {
      params: { date },
    });
    return response.data;
  },

  /**
   * Busca atividades em um range de datas
   */
  async getScheduleByRange(
    startDate: string,
    endDate: string
  ): Promise<Record<string, ScheduleDayResponse>> {
    const response = await api.get<Record<string, ScheduleDayResponse>>(
      '/schedule/range',
      {
        params: { startDate, endDate },
      }
    );
    return response.data;
  },
};

export default scheduleService;
