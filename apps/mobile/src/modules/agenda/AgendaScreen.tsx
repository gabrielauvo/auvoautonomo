/**
 * AgendaScreen
 *
 * Tela principal da agenda - navegação por dia/semana.
 * Consulta DB local por intervalo de datas.
 * Funciona offline com dados sincronizados.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Text } from '../../design-system/components/Text';
import { Card } from '../../design-system/components/Card';
import { Badge } from '../../design-system/components/Badge';
import { colors, spacing, borderRadius, shadows, theme } from '../../design-system/tokens';
import { WorkOrder, WorkOrderStatus } from '../../db/schema';
import { workOrderService } from '../workorders/WorkOrderService';

// =============================================================================
// TYPES
// =============================================================================

interface AgendaScreenProps {
  onWorkOrderPress?: (workOrder: WorkOrder) => void;
  onSync?: () => Promise<void>;
}

type ViewMode = 'day' | 'week';

// =============================================================================
// CONSTANTS
// =============================================================================

const DAYS_OF_WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

// =============================================================================
// HELPERS
// =============================================================================

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getWeekDays(date: Date): Date[] {
  const day = date.getDay();
  const startOfWeek = addDays(date, -day);
  return Array.from({ length: 7 }, (_, i) => addDays(startOfWeek, i));
}

function isSameDay(d1: Date, d2: Date): boolean {
  return formatDate(d1) === formatDate(d2);
}

function getStatusColor(status: WorkOrderStatus): string {
  return theme.statusColors.workOrder[status] || colors.gray[500];
}

function getStatusLabel(status: WorkOrderStatus): string {
  const labels: Record<WorkOrderStatus, string> = {
    SCHEDULED: 'Agendada',
    IN_PROGRESS: 'Em Andamento',
    DONE: 'Concluída',
    CANCELED: 'Cancelada',
  };
  return labels[status];
}

// =============================================================================
// COMPONENTS
// =============================================================================

const DateNavigator: React.FC<{
  selectedDate: Date;
  viewMode: ViewMode;
  onDateChange: (date: Date) => void;
  onViewModeChange: (mode: ViewMode) => void;
}> = ({ selectedDate, viewMode, onDateChange, onViewModeChange }) => {
  const navigatePrev = () => {
    const days = viewMode === 'week' ? -7 : -1;
    onDateChange(addDays(selectedDate, days));
  };

  const navigateNext = () => {
    const days = viewMode === 'week' ? 7 : 1;
    onDateChange(addDays(selectedDate, days));
  };

  const goToToday = () => {
    onDateChange(new Date());
  };

  const weekDays = getWeekDays(selectedDate);
  const isToday = isSameDay(selectedDate, new Date());

  return (
    <View style={styles.navigator}>
      {/* Header com mês/ano e navegação */}
      <View style={styles.navigatorHeader}>
        <TouchableOpacity onPress={navigatePrev} style={styles.navButton}>
          <Text variant="h4" color="primary">‹</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={goToToday}>
          <Text variant="h4" weight="semibold">
            {MONTHS[selectedDate.getMonth()]} {selectedDate.getFullYear()}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={navigateNext} style={styles.navButton}>
          <Text variant="h4" color="primary">›</Text>
        </TouchableOpacity>
      </View>

      {/* Toggle Day/Week */}
      <View style={styles.viewModeToggle}>
        <TouchableOpacity
          style={[styles.viewModeButton, viewMode === 'day' && styles.viewModeButtonActive]}
          onPress={() => onViewModeChange('day')}
        >
          <Text
            variant="bodySmall"
            weight={viewMode === 'day' ? 'semibold' : 'normal'}
            style={{ color: viewMode === 'day' ? colors.white : colors.gray[600] }}
          >
            Dia
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewModeButton, viewMode === 'week' && styles.viewModeButtonActive]}
          onPress={() => onViewModeChange('week')}
        >
          <Text
            variant="bodySmall"
            weight={viewMode === 'week' ? 'semibold' : 'normal'}
            style={{ color: viewMode === 'week' ? colors.white : colors.gray[600] }}
          >
            Semana
          </Text>
        </TouchableOpacity>
      </View>

      {/* Week Days Strip */}
      <View style={styles.weekStrip}>
        {weekDays.map((day, index) => {
          const isSelected = isSameDay(day, selectedDate);
          const dayIsToday = isSameDay(day, new Date());

          return (
            <TouchableOpacity
              key={index}
              style={[
                styles.dayButton,
                isSelected && styles.dayButtonSelected,
                dayIsToday && !isSelected && styles.dayButtonToday,
              ]}
              onPress={() => onDateChange(day)}
            >
              <Text
                variant="caption"
                style={{
                  color: isSelected ? colors.white : colors.gray[500],
                }}
              >
                {DAYS_OF_WEEK[index]}
              </Text>
              <Text
                variant="body"
                weight="semibold"
                style={{
                  color: isSelected ? colors.white : dayIsToday ? colors.primary[600] : colors.text.primary,
                }}
              >
                {day.getDate()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const WorkOrderCard: React.FC<{
  workOrder: WorkOrder;
  onPress: () => void;
}> = ({ workOrder, onPress }) => {
  const time = workOrderService.formatScheduledTime(workOrder);
  const statusColor = getStatusColor(workOrder.status);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card variant="elevated" style={styles.workOrderCard}>
        <View style={styles.workOrderContent}>
          {/* Time indicator */}
          <View style={styles.timeColumn}>
            <Text variant="bodySmall" weight="semibold" style={{ color: colors.primary[600] }}>
              {time}
            </Text>
          </View>

          {/* Status indicator bar */}
          <View style={[styles.statusBar, { backgroundColor: statusColor }]} />

          {/* Main content */}
          <View style={styles.workOrderMain}>
            <Text variant="body" weight="semibold" numberOfLines={1}>
              {workOrder.title}
            </Text>

            <Text variant="bodySmall" color="secondary" numberOfLines={1}>
              {workOrder.clientName || 'Cliente'}
            </Text>

            {workOrder.address && (
              <Text variant="caption" color="tertiary" numberOfLines={1}>
                📍 {workOrder.address}
              </Text>
            )}

            <View style={styles.badgeContainer}>
              <Badge
                label={getStatusLabel(workOrder.status)}
                variant={
                  workOrder.status === 'DONE' ? 'success' :
                  workOrder.status === 'IN_PROGRESS' ? 'warning' :
                  workOrder.status === 'CANCELED' ? 'error' : 'default'
                }
                size="small"
              />
            </View>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
};

const EmptyState: React.FC<{ date: Date }> = ({ date }) => {
  const isToday = isSameDay(date, new Date());

  return (
    <View style={styles.emptyState}>
      <Text variant="h2" style={styles.emptyIcon}>📋</Text>
      <Text variant="body" weight="semibold" align="center">
        {isToday ? 'Nenhuma OS para hoje' : 'Nenhuma OS agendada'}
      </Text>
      <Text variant="bodySmall" color="secondary" align="center">
        {isToday
          ? 'Aproveite para organizar seu dia!'
          : `Sem ordens de serviço para ${date.toLocaleDateString('pt-BR')}`}
      </Text>
    </View>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const AgendaScreen: React.FC<AgendaScreenProps> = ({
  onWorkOrderPress,
  onSync,
}) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load work orders for selected date/week
  const loadWorkOrders = useCallback(async () => {
    try {
      setLoading(true);

      if (viewMode === 'day') {
        const dateStr = formatDate(selectedDate);
        const orders = await workOrderService.getWorkOrdersForDay(dateStr);
        setWorkOrders(orders);
      } else {
        const weekDays = getWeekDays(selectedDate);
        const startDate = formatDate(weekDays[0]);
        const endDate = formatDate(weekDays[6]) + 'T23:59:59';
        const orders = await workOrderService.getWorkOrdersForDateRange(startDate, endDate);
        setWorkOrders(orders);
      }
    } catch (error) {
      console.error('Error loading work orders:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, viewMode]);

  // Load on mount and when date/mode changes
  useEffect(() => {
    loadWorkOrders();
  }, [loadWorkOrders]);

  // Pull to refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (onSync) {
        await onSync();
      }
      await loadWorkOrders();
    } finally {
      setRefreshing(false);
    }
  };

  const handleWorkOrderPress = (workOrder: WorkOrder) => {
    if (onWorkOrderPress) {
      onWorkOrderPress(workOrder);
    }
  };

  // Group work orders by day for week view
  const groupedByDay = React.useMemo(() => {
    if (viewMode !== 'week') return null;

    const groups: Record<string, WorkOrder[]> = {};
    for (const wo of workOrders) {
      const date = wo.scheduledDate || wo.scheduledStartTime?.split('T')[0];
      if (date) {
        if (!groups[date]) groups[date] = [];
        groups[date].push(wo);
      }
    }
    return groups;
  }, [workOrders, viewMode]);

  const renderItem = ({ item }: { item: WorkOrder }) => (
    <WorkOrderCard
      workOrder={item}
      onPress={() => handleWorkOrderPress(item)}
    />
  );

  const renderWeekItem = ({ item }: { item: [string, WorkOrder[]] }) => {
    const [date, orders] = item;
    const dateObj = new Date(date + 'T00:00:00');
    const isToday = isSameDay(dateObj, new Date());

    return (
      <View style={styles.weekDaySection}>
        <View style={[styles.weekDayHeader, isToday && styles.weekDayHeaderToday]}>
          <Text variant="bodySmall" weight="semibold">
            {DAYS_OF_WEEK[dateObj.getDay()]} {dateObj.getDate()}
          </Text>
          <Text variant="caption" color="secondary">
            {orders.length} OS
          </Text>
        </View>
        {orders.map((wo) => (
          <WorkOrderCard
            key={wo.id}
            workOrder={wo}
            onPress={() => handleWorkOrderPress(wo)}
          />
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <DateNavigator
        selectedDate={selectedDate}
        viewMode={viewMode}
        onDateChange={setSelectedDate}
        onViewModeChange={setViewMode}
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[600]} />
        </View>
      ) : viewMode === 'day' ? (
        <FlatList
          data={workOrders}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary[600]]}
              tintColor={colors.primary[600]}
            />
          }
          ListEmptyComponent={<EmptyState date={selectedDate} />}
        />
      ) : (
        <FlatList
          data={Object.entries(groupedByDay || {}).sort((a, b) => a[0].localeCompare(b[0]))}
          keyExtractor={([date]) => date}
          renderItem={renderWeekItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary[600]]}
              tintColor={colors.primary[600]}
            />
          }
          ListEmptyComponent={<EmptyState date={selectedDate} />}
        />
      )}
    </View>
  );
};

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  navigator: {
    backgroundColor: colors.background.primary,
    paddingTop: spacing[2],
    paddingBottom: spacing[3],
    ...shadows.sm,
  },
  navigatorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    marginBottom: spacing[3],
  },
  navButton: {
    padding: spacing[2],
  },
  viewModeToggle: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing[3],
  },
  viewModeButton: {
    paddingVertical: spacing[1.5],
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[100],
    marginHorizontal: spacing[1],
  },
  viewModeButtonActive: {
    backgroundColor: colors.primary[600],
  },
  weekStrip: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: spacing[2],
  },
  dayButton: {
    alignItems: 'center',
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[2],
    borderRadius: borderRadius.lg,
    minWidth: 44,
  },
  dayButtonSelected: {
    backgroundColor: colors.primary[600],
  },
  dayButtonToday: {
    borderWidth: 1,
    borderColor: colors.primary[600],
  },
  listContent: {
    padding: spacing[4],
    paddingBottom: spacing[16],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  workOrderCard: {
    marginBottom: spacing[3],
  },
  workOrderContent: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  timeColumn: {
    width: 60,
    paddingRight: spacing[2],
    justifyContent: 'flex-start',
    paddingTop: spacing[0.5],
  },
  statusBar: {
    width: 4,
    borderRadius: 2,
    marginRight: spacing[3],
  },
  workOrderMain: {
    flex: 1,
  },
  badgeContainer: {
    marginTop: spacing[2],
    flexDirection: 'row',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing[16],
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing[4],
  },
  weekDaySection: {
    marginBottom: spacing[4],
  },
  weekDayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.md,
    marginBottom: spacing[2],
  },
  weekDayHeaderToday: {
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
});

export default AgendaScreen;
