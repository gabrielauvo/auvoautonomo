// @ts-nocheck
/**
 * Agenda Screen
 *
 * Tela de agenda com visualizacao de OS por dia/semana.
 */

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Text, Card, Badge } from '../../src/design-system';
import { useColors, useSpacing } from '../../src/design-system/ThemeProvider';
import { AppHeader } from '../../src/components';
import { workOrderService } from '../../src/modules/workorders/WorkOrderService';
import { useSyncStatus } from '../../src/sync';
import { WorkOrder, WorkOrderStatus, resetDatabase } from '../../src/db';
import { formatLocalDate, extractDatePart } from '../../src/utils/dateUtils';

// =============================================================================
// CONSTANTS
// =============================================================================

const STATUS_CONFIG: Record<WorkOrderStatus, { color: string; label: string }> = {
  SCHEDULED: { color: 'primary', label: 'Agendada' },
  IN_PROGRESS: { color: 'warning', label: 'Em Andamento' },
  DONE: { color: 'success', label: 'Concluída' },
  CANCELED: { color: 'error', label: 'Cancelada' },
};

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getWeekDays(date: Date): Date[] {
  const day = date.getDay();
  const diff = date.getDate() - day;
  const week: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(date);
    d.setDate(diff + i);
    week.push(d);
  }
  return week;
}

function formatDateKey(date: Date): string {
  return formatLocalDate(date);
}

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

// =============================================================================
// DAY BUTTON COMPONENT
// =============================================================================

const DayButton = React.memo(function DayButton({
  date,
  isSelected,
  hasWorkOrders,
  onPress,
}: {
  date: Date;
  isSelected: boolean;
  hasWorkOrders: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  const isToday = isSameDay(date, new Date());

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.dayButton,
        isSelected && { backgroundColor: colors.primary[500] },
        !isSelected && isToday && { borderColor: colors.primary[500], borderWidth: 2 },
      ]}
    >
      <Text
        variant="caption"
        style={[
          styles.dayLabel,
          { color: isSelected ? '#FFFFFF' : colors.text.secondary },
        ]}
      >
        {WEEKDAYS[date.getDay()]}
      </Text>
      <Text
        variant="h5"
        style={[
          { color: isSelected ? '#FFFFFF' : colors.text.primary },
        ]}
      >
        {date.getDate()}
      </Text>
      {hasWorkOrders && !isSelected && (
        <View style={[styles.dayDot, { backgroundColor: colors.primary[500] }]} />
      )}
    </TouchableOpacity>
  );
});

// =============================================================================
// AGENDA ITEM COMPONENT
// =============================================================================

const AgendaItem = React.memo(function AgendaItem({
  workOrder,
  onPress,
}: {
  workOrder: WorkOrder;
  onPress: () => void;
}) {
  const colors = useColors();
  const statusConfig = STATUS_CONFIG[workOrder.status];

  const formattedTime = useMemo(() => {
    if (!workOrder.scheduledStartTime) return 'Dia todo';
    const time = new Date(workOrder.scheduledStartTime);
    return time.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [workOrder.scheduledStartTime]);

  return (
    <Pressable onPress={onPress}>
      <View
        style={[
          styles.agendaItem,
          {
            borderLeftColor: colors[statusConfig.color][500],
            backgroundColor: colors.background.secondary,
          },
        ]}
      >
        <View style={styles.agendaTime}>
          <Text variant="bodySmall" weight="medium">
            {formattedTime}
          </Text>
        </View>
        <View style={styles.agendaContent}>
          <View style={styles.agendaTitleRow}>
            <Text variant="body" weight="medium" numberOfLines={1} style={styles.agendaTitle}>
              {workOrder.title}
            </Text>
            <Badge variant={statusConfig.color as any} size="sm">
              {statusConfig.label}
            </Badge>
          </View>
          {workOrder.clientName && (
            <Text variant="caption" color="secondary" numberOfLines={1}>
              {workOrder.clientName}
            </Text>
          )}
          {workOrder.address && (
            <View style={styles.addressRow}>
              <Ionicons name="location-outline" size={12} color={colors.text.tertiary} />
              <Text variant="caption" color="tertiary" numberOfLines={1} style={{ marginLeft: 4 }}>
                {workOrder.address}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
});

// =============================================================================
// MAIN SCREEN
// =============================================================================

export default function AgendaScreen() {
  const colors = useColors();
  const spacing = useSpacing();
  const { isSyncing, isOnline, sync } = useSyncStatus();

  // State
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekDays, setWeekDays] = useState<Date[]>(getWeekDays(new Date()));
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [weekWorkOrders, setWeekWorkOrders] = useState<Record<string, WorkOrder[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Load work orders for selected day
  const loadDayWorkOrders = useCallback(async (date: Date) => {
    setIsLoading(true);
    try {
      const dateKey = formatDateKey(date);
      const orders = await workOrderService.getWorkOrdersForDay(dateKey);
      setWorkOrders(orders);
    } catch (error) {
      console.error('[AgendaScreen] Error loading work orders:', error);
      if (error instanceof Error && error.message.includes('datatype mismatch')) {
        console.log('[AgendaScreen] Attempting database reset due to schema error...');
        try {
          await resetDatabase();
          const dateKey = formatDateKey(date);
          const orders = await workOrderService.getWorkOrdersForDay(dateKey);
          setWorkOrders(orders);
        } catch (resetError) {
          console.error('[AgendaScreen] Database reset failed:', resetError);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load work orders for the week (to show dots)
  const loadWeekWorkOrders = useCallback(async (week: Date[]) => {
    try {
      const startDate = formatDateKey(week[0]);
      const endDate = formatDateKey(week[6]);
      const orders = await workOrderService.getWorkOrdersForDateRange(startDate, endDate);

      const grouped: Record<string, WorkOrder[]> = {};
      orders.forEach((wo) => {
        const dateStr = wo.scheduledDate || wo.scheduledStartTime;
        if (dateStr) {
          const key = extractDatePart(dateStr);
          if (key) {
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(wo);
          }
        }
      });
      setWeekWorkOrders(grouped);
    } catch (error) {
      console.error('[AgendaScreen] Error loading week work orders:', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadDayWorkOrders(selectedDate);
    loadWeekWorkOrders(weekDays);
  }, []);

  // Load when date changes
  useEffect(() => {
    loadDayWorkOrders(selectedDate);
  }, [selectedDate, loadDayWorkOrders]);

  // Navigate week
  const goToPreviousWeek = useCallback(() => {
    const newDate = new Date(weekDays[0]);
    newDate.setDate(newDate.getDate() - 7);
    const newWeek = getWeekDays(newDate);
    setWeekDays(newWeek);
    setSelectedDate(newWeek[0]);
    loadWeekWorkOrders(newWeek);
  }, [weekDays, loadWeekWorkOrders]);

  const goToNextWeek = useCallback(() => {
    const newDate = new Date(weekDays[6]);
    newDate.setDate(newDate.getDate() + 1);
    const newWeek = getWeekDays(newDate);
    setWeekDays(newWeek);
    setSelectedDate(newWeek[0]);
    loadWeekWorkOrders(newWeek);
  }, [weekDays, loadWeekWorkOrders]);

  const goToToday = useCallback(() => {
    const today = new Date();
    const newWeek = getWeekDays(today);
    setWeekDays(newWeek);
    setSelectedDate(today);
    loadWeekWorkOrders(newWeek);
  }, [loadWeekWorkOrders]);

  // Handle day press
  const handleDayPress = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);

  // Handle work order press
  const handleWorkOrderPress = useCallback((workOrder: WorkOrder) => {
    router.push(`/os/${workOrder.id}`);
  }, []);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    if (isOnline) {
      await sync();
    }
    loadDayWorkOrders(selectedDate);
    loadWeekWorkOrders(weekDays);
  }, [isOnline, sync, selectedDate, weekDays, loadDayWorkOrders, loadWeekWorkOrders]);

  // Format month/year header
  const monthYearHeader = useMemo(() => {
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return `${months[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;
  }, [selectedDate]);

  // Format selected date
  const selectedDateFormatted = useMemo(() => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    };
    return selectedDate.toLocaleDateString('pt-BR', options);
  }, [selectedDate]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background.primary }]}>
      <AppHeader title="Agenda" />

      {/* Calendar Header */}
      <View style={[styles.calendarHeader, { backgroundColor: colors.background.secondary }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={goToPreviousWeek} style={styles.navButton}>
            <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text variant="h5">{monthYearHeader}</Text>
          <TouchableOpacity onPress={goToNextWeek} style={styles.navButton}>
            <Ionicons name="chevron-forward" size={24} color={colors.text.primary} />
          </TouchableOpacity>
        </View>

        {/* Week days */}
        <View style={styles.weekContainer}>
          {weekDays.map((date, index) => (
            <DayButton
              key={index}
              date={date}
              isSelected={isSameDay(date, selectedDate)}
              hasWorkOrders={!!weekWorkOrders[formatDateKey(date)]?.length}
              onPress={() => handleDayPress(date)}
            />
          ))}
        </View>

        {/* Today button */}
        <TouchableOpacity
          onPress={goToToday}
          style={[styles.todayButton, { borderColor: colors.primary[500] }]}
        >
          <Text variant="caption" style={{ color: colors.primary[500] }}>
            Hoje
          </Text>
        </TouchableOpacity>
      </View>

      {/* Selected date info */}
      <View style={[styles.dateInfo, { paddingHorizontal: spacing[4] }]}>
        <Text variant="body" weight="medium" style={{ textTransform: 'capitalize' }}>
          {selectedDateFormatted}
        </Text>
        <Text variant="caption" color="secondary">
          {workOrders.length} agendamento{workOrders.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Work orders list */}
      <ScrollView
        style={styles.listContainer}
        contentContainerStyle={{ paddingHorizontal: spacing[4], paddingBottom: spacing[20] }}
      >
        {isLoading ? (
          <View style={styles.emptyContainer}>
            <Text variant="body" color="secondary">Carregando...</Text>
          </View>
        ) : workOrders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={48} color={colors.text.tertiary} />
            <Text variant="body" color="secondary" style={{ marginTop: 12 }}>
              Nenhum agendamento para este dia
            </Text>
          </View>
        ) : (
          workOrders.map((wo) => (
            <AgendaItem
              key={wo.id}
              workOrder={wo}
              onPress={() => handleWorkOrderPress(wo)}
            />
          ))
        )}
      </ScrollView>

      {/* Sync status */}
      <View style={[styles.syncBar, { backgroundColor: colors.background.secondary }]}>
        <View style={styles.syncInfo}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isOnline ? colors.success[500] : colors.error[500] },
            ]}
          />
          <Text variant="caption" color="secondary">
            {isSyncing ? 'Sincronizando...' : isOnline ? 'Online' : 'Offline'}
          </Text>
        </View>
        <TouchableOpacity onPress={handleRefresh} disabled={isSyncing}>
          <Ionicons
            name="refresh"
            size={20}
            color={isSyncing ? colors.text.tertiary : colors.primary[500]}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  calendarHeader: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navButton: {
    padding: 4,
  },
  weekContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayButton: {
    width: 44,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  dayLabel: {
    fontSize: 10,
    marginBottom: 4,
  },
  dayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    position: 'absolute',
    bottom: 4,
  },
  todayButton: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 12,
  },
  dateInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  listContainer: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  agendaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
  },
  agendaTime: {
    width: 60,
  },
  agendaContent: {
    flex: 1,
    marginLeft: 8,
  },
  agendaTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  agendaTitle: {
    flex: 1,
    marginRight: 8,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  syncBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  syncInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
