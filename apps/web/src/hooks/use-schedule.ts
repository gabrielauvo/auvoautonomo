/**
 * useSchedule Hook
 *
 * Hook para gerenciar estado e fetch da agenda
 */

import { useQuery } from '@tanstack/react-query';
import { scheduleService, ScheduleDayResponse } from '@/services/schedule.service';

/**
 * Hook para buscar atividades de um dia específico
 */
export function useScheduleDay(date: string) {
  return useQuery<ScheduleDayResponse>({
    queryKey: ['schedule', 'day', date],
    queryFn: () => scheduleService.getScheduleByDay(date),
    enabled: !!date,
    staleTime: 1000 * 60 * 2, // 2 minutos
  });
}

/**
 * Hook para buscar atividades em um range de datas
 */
export function useScheduleRange(startDate: string, endDate: string) {
  return useQuery<Record<string, ScheduleDayResponse>>({
    queryKey: ['schedule', 'range', startDate, endDate],
    queryFn: () => scheduleService.getScheduleByRange(startDate, endDate),
    enabled: !!startDate && !!endDate,
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Formata data para exibição
 */
export function formatDateDisplay(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/**
 * Formata hora para exibição
 */
export function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Calcula a data no formato YYYY-MM-DD
 */
export function getDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Adiciona/subtrai dias de uma data
 */
export function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + 'T12:00:00');
  date.setDate(date.getDate() + days);
  return getDateString(date);
}

/**
 * Verifica se a data é hoje
 */
export function isToday(dateStr: string): boolean {
  return dateStr === getDateString(new Date());
}
