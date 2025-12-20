'use client';

/**
 * ScheduleCalendarView Component
 *
 * Visualização de calendário mensal com atividades
 * - Cores representam status das ordens de serviço
 * - Clique em uma atividade abre a ordem de serviço
 */

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useScheduleRange } from '@/hooks/use-schedule';
import {
  ScheduleActivity,
  ScheduleActivityStatus,
  ScheduleDayResponse,
} from '@/services/schedule.service';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { Button, Skeleton } from '@/components/ui';
import { cn } from '@/lib/utils';

interface ScheduleCalendarViewProps {
  onDayClick?: (date: string) => void;
}

/**
 * Cores por status da atividade
 */
const statusColors: Record<ScheduleActivityStatus, { bg: string; text: string; dot: string }> = {
  SCHEDULED: { bg: 'bg-blue-100', text: 'text-blue-800', dot: 'bg-blue-500' },
  IN_PROGRESS: { bg: 'bg-yellow-100', text: 'text-yellow-800', dot: 'bg-yellow-500' },
  DONE: { bg: 'bg-green-100', text: 'text-green-800', dot: 'bg-green-500' },
  CANCELED: { bg: 'bg-red-100', text: 'text-red-800', dot: 'bg-red-500' },
  DRAFT: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
  SENT: { bg: 'bg-purple-100', text: 'text-purple-800', dot: 'bg-purple-500' },
  APPROVED: { bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  REJECTED: { bg: 'bg-rose-100', text: 'text-rose-800', dot: 'bg-rose-500' },
  EXPIRED: { bg: 'bg-orange-100', text: 'text-orange-800', dot: 'bg-orange-500' },
};

const weekDays = ['DOM.', 'SEG.', 'TER.', 'QUA.', 'QUI.', 'SEX.', 'SÁB.'];

const monthNames = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/**
 * Formata hora para exibição compacta
 */
function formatTimeShort(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Gera array de dias do mês com padding para alinhar semana
 */
function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startWeekDay = firstDay.getDay();

  const days: (number | null)[] = [];

  // Padding inicial (dias do mês anterior)
  for (let i = 0; i < startWeekDay; i++) {
    days.push(null);
  }

  // Dias do mês atual
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  return days;
}

/**
 * Componente de item de atividade no calendário
 */
function CalendarActivityItem({ activity }: { activity: ScheduleActivity }) {
  const colors = statusColors[activity.status];
  const href = activity.type === 'WORK_ORDER'
    ? `/work-orders/${activity.id}`
    : `/quotes/${activity.id}`;

  return (
    <Link href={href}>
      <div
        className={cn(
          'flex items-center gap-1 px-1 py-0.5 rounded text-xs truncate cursor-pointer hover:opacity-80 transition-opacity',
          colors.bg,
          colors.text
        )}
        title={`${activity.title} - ${activity.client.name}`}
      >
        <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', colors.dot)} />
        <span className="font-medium">{formatTimeShort(activity.scheduledStart)}</span>
        <span className="truncate">{activity.client.name}</span>
      </div>
    </Link>
  );
}

// Status de OS para filtro (os principais)
type FilterStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'DONE' | 'CANCELED';

const filterOptions: { status: FilterStatus; label: string; dotColor: string }[] = [
  { status: 'SCHEDULED', label: 'Agendado', dotColor: 'bg-blue-500' },
  { status: 'IN_PROGRESS', label: 'Em Andamento', dotColor: 'bg-yellow-500' },
  { status: 'DONE', label: 'Concluído', dotColor: 'bg-green-500' },
  { status: 'CANCELED', label: 'Cancelado', dotColor: 'bg-red-500' },
];

export function ScheduleCalendarView({ onDayClick }: ScheduleCalendarViewProps) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());

  // Filtros de status (todos ativos por padrão)
  const [activeFilters, setActiveFilters] = useState<Set<FilterStatus>>(
    new Set(['SCHEDULED', 'IN_PROGRESS', 'DONE', 'CANCELED'])
  );

  // Filtro por cliente
  const [clientFilter, setClientFilter] = useState<string>('');
  const [clientSearch, setClientSearch] = useState<string>('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  // Toggle de filtro
  const toggleFilter = (status: FilterStatus) => {
    setActiveFilters((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(status)) {
        // Não permitir desativar todos os filtros
        if (newSet.size > 1) {
          newSet.delete(status);
        }
      } else {
        newSet.add(status);
      }
      return newSet;
    });
  };

  // Ativar/desativar todos os filtros
  const toggleAllFilters = () => {
    if (activeFilters.size === filterOptions.length) {
      // Se todos ativos, ativar apenas SCHEDULED
      setActiveFilters(new Set(['SCHEDULED']));
    } else {
      // Ativar todos
      setActiveFilters(new Set(filterOptions.map((f) => f.status)));
    }
  };

  // Calcula range de datas para o mês
  const { startDate, endDate } = useMemo(() => {
    const start = new Date(currentYear, currentMonth, 1);
    const end = new Date(currentYear, currentMonth + 1, 0);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  }, [currentYear, currentMonth]);

  // Fetch das atividades do mês
  const { data: scheduleData, isLoading } = useScheduleRange(startDate, endDate);

  // Lista de clientes únicos do mês (para o dropdown de filtro)
  const uniqueClients = useMemo(() => {
    if (!scheduleData) return [];
    const clientsMap = new Map<string, { id: string; name: string }>();
    Object.values(scheduleData).forEach((dayData) => {
      dayData.activities.forEach((activity) => {
        if (!clientsMap.has(activity.client.id)) {
          clientsMap.set(activity.client.id, {
            id: activity.client.id,
            name: activity.client.name,
          });
        }
      });
    });
    return Array.from(clientsMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [scheduleData]);

  // Clientes filtrados pela busca
  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return uniqueClients;
    const search = clientSearch.toLowerCase();
    return uniqueClients.filter((c) => c.name.toLowerCase().includes(search));
  }, [uniqueClients, clientSearch]);

  // Nome do cliente selecionado
  const selectedClientName = useMemo(() => {
    if (!clientFilter) return '';
    const client = uniqueClients.find((c) => c.id === clientFilter);
    return client?.name || '';
  }, [clientFilter, uniqueClients]);

  // Dias do calendário
  const calendarDays = useMemo(
    () => getCalendarDays(currentYear, currentMonth),
    [currentYear, currentMonth]
  );

  // Navegar para mês anterior
  const goToPreviousMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  // Navegar para próximo mês
  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  // Ir para hoje
  const goToToday = () => {
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
  };

  // Obter atividades de um dia (com filtros aplicados)
  const getActivitiesForDay = (day: number): ScheduleActivity[] => {
    if (!scheduleData) return [];
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const activities = scheduleData[dateStr]?.activities || [];
    // Aplicar filtros de status e cliente
    return activities.filter((activity) => {
      const statusMatch = activeFilters.has(activity.status as FilterStatus);
      const clientMatch = !clientFilter || activity.client.id === clientFilter;
      return statusMatch && clientMatch;
    });
  };

  // Verificar se é hoje
  const isToday = (day: number) => {
    return (
      day === today.getDate() &&
      currentMonth === today.getMonth() &&
      currentYear === today.getFullYear()
    );
  };

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      {/* Header do calendário */}
      <div className="p-4 border-b space-y-3">
        {/* Linha 1: Navegação e filtro por cliente */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon-sm" onClick={goToPreviousMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon-sm" onClick={goToNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-semibold ml-2">
              {monthNames[currentMonth]} {currentYear}
            </h2>
          </div>

          {/* Filtro por cliente */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filtrar por cliente..."
                  value={clientFilter ? selectedClientName : clientSearch}
                  onChange={(e) => {
                    setClientSearch(e.target.value);
                    setClientFilter('');
                    setShowClientDropdown(true);
                  }}
                  onFocus={() => setShowClientDropdown(true)}
                  className={cn(
                    'pl-8 pr-8 py-1.5 text-sm border rounded-md w-48 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
                    clientFilter && 'bg-primary/5 border-primary/30'
                  )}
                />
                {(clientFilter || clientSearch) && (
                  <button
                    onClick={() => {
                      setClientFilter('');
                      setClientSearch('');
                      setShowClientDropdown(false);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Dropdown de clientes */}
              {showClientDropdown && !clientFilter && filteredClients.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
                  {filteredClients.map((client) => (
                    <button
                      key={client.id}
                      onClick={() => {
                        setClientFilter(client.id);
                        setClientSearch('');
                        setShowClientDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 truncate"
                    >
                      {client.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Mensagem quando não há clientes */}
              {showClientDropdown && !clientFilter && clientSearch && filteredClients.length === 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg z-50 p-3 text-sm text-gray-500">
                  Nenhum cliente encontrado
                </div>
              )}
            </div>

            <Button variant="outline" size="sm" onClick={goToToday}>
              Hoje
            </Button>
          </div>
        </div>

        {/* Linha 2: Filtros por Status */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-gray-500 mr-1">Filtrar:</span>
          {filterOptions.map((filter) => {
            const isActive = activeFilters.has(filter.status);
            return (
              <button
                key={filter.status}
                onClick={() => toggleFilter(filter.status)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all border',
                  isActive
                    ? 'bg-white border-gray-300 text-gray-700 shadow-sm'
                    : 'bg-gray-100 border-transparent text-gray-400 hover:bg-gray-200'
                )}
              >
                <span
                  className={cn(
                    'w-2 h-2 rounded-full transition-opacity',
                    filter.dotColor,
                    !isActive && 'opacity-40'
                  )}
                />
                {filter.label}
              </button>
            );
          })}
          <button
            onClick={toggleAllFilters}
            className="ml-2 text-xs text-primary hover:underline font-medium"
          >
            {activeFilters.size === filterOptions.length ? 'Limpar' : 'Todos'}
          </button>
        </div>
      </div>

      {/* Overlay para fechar dropdown */}
      {showClientDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowClientDropdown(false)}
        />
      )}

      {/* Dias da semana */}
      <div className="grid grid-cols-7 border-b">
        {weekDays.map((day) => (
          <div
            key={day}
            className="py-2 text-center text-xs font-medium text-gray-500 border-r last:border-r-0"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Grid do calendário */}
      <div className="grid grid-cols-7">
        {calendarDays.map((day, index) => {
          const activities = day ? getActivitiesForDay(day) : [];
          const dateStr = day
            ? `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            : '';
          const hasMore = activities.length > 4;
          const displayActivities = activities.slice(0, 4);

          return (
            <div
              key={index}
              className={cn(
                'min-h-[120px] border-r border-b last:border-r-0 p-1',
                day === null && 'bg-gray-50',
                isLoading && 'animate-pulse'
              )}
              onClick={() => day && onDayClick?.(dateStr)}
            >
              {day !== null && (
                <>
                  {/* Número do dia */}
                  <div
                    className={cn(
                      'text-sm font-medium mb-1',
                      isToday(day)
                        ? 'bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center'
                        : 'text-gray-700 pl-1'
                    )}
                  >
                    {day}
                  </div>

                  {/* Lista de atividades */}
                  {isLoading ? (
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      {displayActivities.map((activity) => (
                        <CalendarActivityItem key={activity.id} activity={activity} />
                      ))}
                      {hasMore && (
                        <div className="text-xs text-gray-500 pl-1 font-medium">
                          mais +{activities.length - 4}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ScheduleCalendarView;
