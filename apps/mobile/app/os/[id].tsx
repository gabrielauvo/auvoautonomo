// @ts-nocheck
/**
 * Work Order Detail Screen
 *
 * Tela de detalhes e execução de uma Ordem de Serviço.
 * - Tabs: Info, Checklists, Anexos, Histórico
 * - Controles: Iniciar, Pausar, Retomar, Concluir
 * - Timer de execução em tempo real
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { Text, Card, Badge, Button } from '../../src/design-system';
import { useColors, useSpacing } from '../../src/design-system/ThemeProvider';
import { useWorkOrderExecution, useExecutionTimer } from '../../src/modules/workorders/hooks';
import { ShareService } from '../../src/services';
import { PAUSE_REASONS, PauseReasonValue } from '../../src/modules/workorders/execution';
import { WorkOrderStatus, ChecklistAttachment, Signature } from '../../src/db/schema';
import { ChecklistAttachmentRepository } from '../../src/modules/checklists/repositories/ChecklistAttachmentRepository';
import { syncEngine } from '../../src/sync';
import { useAuth } from '../../src/services/AuthProvider';
import { SignaturePad, SignatureData } from '../../src/modules/checklists/components/SignaturePad';
import { SIGNER_ROLES } from '../../src/modules/checklists/SignatureSyncConfig';
import { rawQuery, insert, findOne, update } from '../../src/db/database';
import { v4 as uuidv4 } from 'uuid';
import { useTranslation, useLocale } from '../../src/i18n';

// =============================================================================
// CONSTANTS
// =============================================================================

// Status config is now dynamic - see getStatusConfig function below

const TAB_KEYS = ['info', 'checklists', 'attachments', 'signature', 'history'] as const;

type TabKey = typeof TAB_KEYS[number];

// =============================================================================
// EXECUTION TIMER DISPLAY
// =============================================================================

const ExecutionTimerDisplay = React.memo(function ExecutionTimerDisplay({
  timer,
  t,
}: {
  timer: ReturnType<typeof useExecutionTimer>;
  t: (key: string) => string;
}) {
  const colors = useColors();

  if (!timer.isRunning && !timer.isPaused) return null;

  return (
    <View style={[styles.timerContainer, { backgroundColor: colors.background.secondary }]}>
      <View style={styles.timerRow}>
        <View style={styles.timerItem}>
          <Text variant="caption" color="secondary">
            {t('workOrders.detail.timer.session')}
          </Text>
          <Text variant="h3" weight="bold" style={{ color: timer.isPaused ? colors.warning[500] : colors.success[500] }}>
            {timer.currentSession.formatted}
          </Text>
        </View>
        <View style={styles.timerDivider} />
        <View style={styles.timerItem}>
          <Text variant="caption" color="secondary">
            {t('workOrders.detail.timer.totalWork')}
          </Text>
          <Text variant="h3" weight="bold">
            {timer.totalWork.formatted}
          </Text>
        </View>
      </View>
      {timer.isPaused && (
        <View style={[styles.pausedBadge, { backgroundColor: colors.warning[100] }]}>
          <Ionicons name="pause-circle" size={16} color={colors.warning[600]} />
          <Text variant="caption" style={{ color: colors.warning[600] }}>
            {t('workOrders.detail.timer.paused')}
          </Text>
        </View>
      )}
    </View>
  );
});

// =============================================================================
// EXECUTION CONTROLS
// =============================================================================

const ExecutionControls = React.memo(function ExecutionControls({
  status,
  isExecuting,
  isPaused,
  hasPendingSync,
  isSyncing,
  isSharing,
  clientPhone,
  totalValue,
  clientId,
  clientName,
  workOrderId,
  workOrderTitle,
  onStart,
  onPause,
  onResume,
  onComplete,
  onReopen,
  onRetrySync,
  onShareWhatsApp,
  onCreateCharge,
  t,
}: {
  status: WorkOrderStatus;
  isExecuting: boolean;
  isPaused: boolean;
  hasPendingSync: boolean;
  isSyncing?: boolean;
  isSharing?: boolean;
  clientPhone?: string;
  totalValue?: number;
  clientId?: string;
  clientName?: string;
  workOrderId?: string;
  workOrderTitle?: string;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onComplete: () => void;
  onReopen?: () => void;
  onRetrySync?: () => void;
  onShareWhatsApp?: () => void;
  onCreateCharge?: () => void;
  t: (key: string) => string;
}) {
  const colors = useColors();
  const spacing = useSpacing();

  // Para OS cancelada, não mostrar nada
  if (status === 'CANCELED') {
    return null;
  }

  // Para OS concluída, mostrar botões de WhatsApp, Criar Cobrança e Reabrir
  if (status === 'DONE') {
    return (
      <View style={[styles.controlsContainer, { padding: spacing[4], backgroundColor: colors.background.primary }]}>
        {/* Botão de compartilhar via WhatsApp */}
        {clientPhone && onShareWhatsApp && (
          <TouchableOpacity
            style={[styles.whatsappButton, { marginBottom: spacing[3] }]}
            onPress={onShareWhatsApp}
            disabled={isSharing}
          >
            {isSharing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <View style={styles.buttonContent}>
                <Ionicons name="logo-whatsapp" size={20} color="#FFFFFF" />
                <Text variant="body" weight="semibold" style={{ color: '#FFFFFF', marginLeft: 8 }}>
                  {t('workOrders.detail.execution.sendReportWhatsApp')}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* Botão Criar Cobrança - só aparece se OS tem valor */}
        {totalValue && totalValue > 0 && onCreateCharge && (
          <TouchableOpacity
            style={[styles.createChargeButton, { backgroundColor: colors.success[600], marginBottom: spacing[3] }]}
            onPress={onCreateCharge}
          >
            <View style={styles.buttonContent}>
              <Ionicons name="receipt-outline" size={20} color="#FFFFFF" />
              <Text variant="body" weight="semibold" style={{ color: '#FFFFFF', marginLeft: 8 }}>
                {t('workOrders.detail.execution.createCharge')}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        <Button variant="outline" size="lg" fullWidth onPress={onReopen}>
          <View style={styles.buttonContent}>
            <Ionicons name="refresh" size={20} color={colors.primary[500]} />
            <Text variant="body" weight="semibold" style={{ color: colors.primary[500], marginLeft: 8 }}>
              {t('workOrders.detail.execution.reopenWO')}
            </Text>
          </View>
        </Button>
      </View>
    );
  }

  return (
    <View style={[styles.controlsContainer, { padding: spacing[4], backgroundColor: colors.background.primary }]}>
      {/* OS Agendada - Mostrar botao Iniciar */}
      {status === 'SCHEDULED' && (
        <Button variant="primary" size="lg" fullWidth onPress={onStart}>
          <View style={styles.buttonContent}>
            <Ionicons name="play" size={20} color="#FFF" />
            <Text variant="body" weight="semibold" style={{ color: '#FFF', marginLeft: 8 }}>
              {t('workOrders.detail.execution.startExecution')}
            </Text>
          </View>
        </Button>
      )}

      {/* OS em Execução */}
      {status === 'IN_PROGRESS' && (
        <View style={styles.controlsRow}>
          {/* Pausar/Retomar */}
          {isPaused ? (
            <Button variant="outline" size="lg" style={styles.controlButton} onPress={onResume}>
              <View style={styles.buttonContent}>
                <Ionicons name="play" size={18} color={colors.primary[500]} />
                <Text variant="body" weight="medium" style={{ color: colors.primary[500], marginLeft: 6 }}>
                  {t('workOrders.detail.execution.resume')}
                </Text>
              </View>
            </Button>
          ) : (
            <Button variant="outline" size="lg" style={styles.controlButton} onPress={onPause}>
              <View style={styles.buttonContent}>
                <Ionicons name="pause" size={18} color={colors.warning[500]} />
                <Text variant="body" weight="medium" style={{ color: colors.warning[500], marginLeft: 6 }}>
                  {t('workOrders.detail.execution.pause')}
                </Text>
              </View>
            </Button>
          )}

          {/* Concluir */}
          <Button variant="primary" size="lg" style={styles.controlButton} onPress={onComplete}>
            <View style={styles.buttonContent}>
              <Ionicons name="checkmark-circle" size={18} color="#FFF" />
              <Text variant="body" weight="semibold" style={{ color: '#FFF', marginLeft: 6 }}>
                {t('workOrders.detail.execution.complete')}
              </Text>
            </View>
          </Button>
        </View>
      )}

      {/* Indicador de pendentes - clicável para retry */}
      {hasPendingSync && (
        <TouchableOpacity
          style={[styles.pendingBadge, { backgroundColor: colors.warning[100] }]}
          onPress={onRetrySync}
          disabled={isSyncing}
        >
          {isSyncing ? (
            <ActivityIndicator size="small" color={colors.warning[600]} />
          ) : (
            <Ionicons name="cloud-upload-outline" size={14} color={colors.warning[600]} />
          )}
          <Text variant="caption" style={{ color: colors.warning[600], marginLeft: 4 }}>
            {isSyncing ? t('workOrders.detail.execution.syncing') : t('workOrders.detail.execution.pendingDataTapToSync')}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

// =============================================================================
// PAUSE REASON MODAL
// =============================================================================

function PauseReasonModal({
  visible,
  onClose,
  onConfirm,
  t,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (reason: PauseReasonValue, notes?: string) => void;
  t: (key: string) => string;
}) {
  const colors = useColors();
  const spacing = useSpacing();
  const [selectedReason, setSelectedReason] = useState<PauseReasonValue | null>(null);
  const [notes, setNotes] = useState('');

  const handleConfirm = () => {
    if (selectedReason) {
      onConfirm(selectedReason, notes || undefined);
      setSelectedReason(null);
      setNotes('');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.background.primary }]}>
          <Text variant="h4" weight="semibold" style={styles.modalTitle}>
            {t('workOrders.detail.pauseModal.title')}
          </Text>

          <ScrollView style={styles.reasonsList}>
            {PAUSE_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason.value}
                style={[
                  styles.reasonItem,
                  {
                    backgroundColor:
                      selectedReason === reason.value
                        ? colors.primary[50]
                        : colors.background.secondary,
                    borderColor:
                      selectedReason === reason.value ? colors.primary[500] : colors.border.light,
                  },
                ]}
                onPress={() => setSelectedReason(reason.value)}
              >
                <Text
                  variant="body"
                  style={{
                    color: selectedReason === reason.value ? colors.primary[600] : colors.text.primary,
                  }}
                >
                  {reason.label}
                </Text>
                {selectedReason === reason.value && (
                  <Ionicons name="checkmark" size={20} color={colors.primary[500]} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>

          {selectedReason === 'other' && (
            <TextInput
              placeholder={t('workOrders.detail.pauseModal.describeMotive')}
              value={notes}
              onChangeText={setNotes}
              style={[
                styles.notesInput,
                {
                  backgroundColor: colors.background.secondary,
                  borderColor: colors.border.light,
                  color: colors.text.primary,
                },
              ]}
              placeholderTextColor={colors.text.tertiary}
              multiline
            />
          )}

          <View style={styles.modalButtons}>
            <Button variant="ghost" onPress={onClose} style={{ flex: 1 }}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              onPress={handleConfirm}
              disabled={!selectedReason}
              style={{ flex: 1 }}
            >
              {t('common.confirm')}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// =============================================================================
// INFO TAB
// =============================================================================

const InfoTab = React.memo(function InfoTab({
  workOrder,
  executionSummary,
}: {
  workOrder: any;
  executionSummary: any;
}) {
  const colors = useColors();
  const spacing = useSpacing();

  if (!workOrder) return null;

  const formattedDate = workOrder.scheduledDate
    ? new Date(workOrder.scheduledDate).toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : 'Sem data agendada';

  const formattedTime = workOrder.scheduledStartTime
    ? new Date(workOrder.scheduledStartTime).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <ScrollView style={styles.tabContent} contentContainerStyle={{ padding: spacing[4] }}>
      {/* Cliente */}
      <Card variant="outlined" style={[styles.infoCard, { marginBottom: spacing[3] }]}>
        <View style={styles.infoCardHeader}>
          <Ionicons name="person-outline" size={20} color={colors.primary[500]} />
          <Text variant="body" weight="semibold" style={{ marginLeft: 8 }}>
            Cliente
          </Text>
        </View>
        <Text variant="body">{workOrder.clientName || 'Cliente não informado'}</Text>
        {workOrder.clientPhone && (
          <Text variant="caption" color="secondary">
            {workOrder.clientPhone}
          </Text>
        )}
      </Card>

      {/* Tipo de OS */}
      {workOrder.workOrderTypeName && (
        <Card variant="outlined" style={[styles.infoCard, { marginBottom: spacing[3] }]}>
          <View style={styles.infoCardHeader}>
            <Ionicons name="pricetag-outline" size={20} color={colors.primary[500]} />
            <Text variant="body" weight="semibold" style={{ marginLeft: 8 }}>
              Tipo de OS
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: workOrder.workOrderTypeColor || colors.primary[500],
                marginRight: 8,
              }}
            />
            <Text variant="body">{workOrder.workOrderTypeName}</Text>
          </View>
        </Card>
      )}

      {/* Agendamento */}
      <Card variant="outlined" style={[styles.infoCard, { marginBottom: spacing[3] }]}>
        <View style={styles.infoCardHeader}>
          <Ionicons name="calendar-outline" size={20} color={colors.primary[500]} />
          <Text variant="body" weight="semibold" style={{ marginLeft: 8 }}>
            Agendamento
          </Text>
        </View>
        <Text variant="body">{formattedDate}</Text>
        {formattedTime && (
          <Text variant="caption" color="secondary">
            Horário: {formattedTime}
          </Text>
        )}
      </Card>

      {/* Endereço */}
      {workOrder.address && (
        <Card variant="outlined" style={[styles.infoCard, { marginBottom: spacing[3] }]}>
          <View style={styles.infoCardHeader}>
            <Ionicons name="location-outline" size={20} color={colors.primary[500]} />
            <Text variant="body" weight="semibold" style={{ marginLeft: 8 }}>
              Endereço
            </Text>
          </View>
          <Text variant="body">{workOrder.address}</Text>
        </Card>
      )}

      {/* Descrição */}
      {workOrder.description && (
        <Card variant="outlined" style={[styles.infoCard, { marginBottom: spacing[3] }]}>
          <View style={styles.infoCardHeader}>
            <Ionicons name="document-text-outline" size={20} color={colors.primary[500]} />
            <Text variant="body" weight="semibold" style={{ marginLeft: 8 }}>
              Descrição
            </Text>
          </View>
          <Text variant="body" color="secondary">
            {workOrder.description}
          </Text>
        </Card>
      )}

      {/* Resumo de Execução (se aplicável) */}
      {executionSummary && (executionSummary.totalWorkTimeFormatted !== '00:00:00' || executionSummary.sessionCount > 0) && (
        <Card variant="outlined" style={[styles.infoCard, { marginBottom: spacing[3] }]}>
          <View style={styles.infoCardHeader}>
            <Ionicons name="timer-outline" size={20} color={colors.primary[500]} />
            <Text variant="body" weight="semibold" style={{ marginLeft: 8 }}>
              Tempo de Execução
            </Text>
          </View>
          <View style={styles.executionSummary}>
            <View style={styles.summaryItem}>
              <Text variant="caption" color="secondary">
                Trabalhado
              </Text>
              <Text variant="body" weight="semibold">
                {executionSummary.totalWorkTimeFormatted}
              </Text>
            </View>
            {executionSummary.pauseCount > 0 && (
              <View style={styles.summaryItem}>
                <Text variant="caption" color="secondary">
                  Pausas
                </Text>
                <Text variant="body" weight="semibold">
                  {executionSummary.pauseCount}x ({executionSummary.totalPauseTimeFormatted})
                </Text>
              </View>
            )}
          </View>
        </Card>
      )}

      {/* Notas */}
      {workOrder.notes && (
        <Card variant="outlined" style={styles.infoCard}>
          <View style={styles.infoCardHeader}>
            <Ionicons name="create-outline" size={20} color={colors.primary[500]} />
            <Text variant="body" weight="semibold" style={{ marginLeft: 8 }}>
              Notas
            </Text>
          </View>
          <Text variant="body" color="secondary">
            {workOrder.notes}
          </Text>
        </Card>
      )}
    </ScrollView>
  );
});

// =============================================================================
// CHECKLISTS TAB
// =============================================================================

const ChecklistsTab = React.memo(function ChecklistsTab({
  workOrderId,
  workOrderStatus,
}: {
  workOrderId: string;
  workOrderStatus: WorkOrderStatus;
}) {
  const colors = useColors();
  const spacing = useSpacing();
  const { user } = useAuth();
  const [checklists, setChecklists] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isReopening, setIsReopening] = useState(false);

  // Carregar checklists
  useEffect(() => {
    async function loadChecklists() {
      console.log('[ChecklistsTab] Loading checklists for workOrderId:', workOrderId);
      setLoadError(null);
      try {
        const { ChecklistSyncService } = await import('../../src/modules/checklists/services/ChecklistSyncService');
        console.log('[ChecklistsTab] ChecklistSyncService imported');

        // Garantir que o technicianId está configurado
        if (user?.technicianId) {
          ChecklistSyncService.configure(user.technicianId);
          console.log('[ChecklistsTab] Configured with technicianId:', user.technicianId);
        }

        const result = await ChecklistSyncService.pullChecklistsForWorkOrder(workOrderId);
        console.log('[ChecklistsTab] Result:', JSON.stringify(result, null, 2));
        if (result.success) {
          setChecklists(result.checklists || []);
        } else {
          setLoadError(result.error || 'Erro ao carregar checklists');
          setChecklists([]);
        }
      } catch (err) {
        console.error('[ChecklistsTab] Error loading checklists:', err);
        setLoadError(err instanceof Error ? err.message : 'Erro desconhecido');
      } finally {
        setIsLoading(false);
      }
    }
    if (workOrderId) {
      loadChecklists();
    }
  }, [workOrderId, user?.technicianId]);

  const handleOpenChecklist = (instanceId: string, checklistStatus: string) => {
    // Permitir visualização de checklists concluídos mesmo com OS finalizada
    if (checklistStatus === 'COMPLETED') {
      router.push(`/os/checklist/${instanceId}`);
      return;
    }
    // Para editar, OS precisa estar em progresso
    if (workOrderStatus !== 'IN_PROGRESS') {
      Alert.alert('Aviso', 'Inicie a execução da OS antes de preencher o checklist');
      return;
    }
    router.push(`/os/checklist/${instanceId}`);
  };

  const handleReopenChecklist = async (instanceId: string) => {
    if (workOrderStatus !== 'IN_PROGRESS') {
      Alert.alert('Aviso', 'A ordem de serviço precisa estar em andamento para reabrir o checklist');
      return;
    }

    Alert.alert(
      'Reabrir Checklist',
      'Deseja reabrir este checklist para edição?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Reabrir',
          onPress: async () => {
            setIsReopening(true);
            try {
              const { ChecklistSyncService } = await import('../../src/modules/checklists/services/ChecklistSyncService');
              const result = await ChecklistSyncService.reopenChecklist(instanceId);
              if (result.success) {
                // Recarregar lista de checklists
                const reloadResult = await ChecklistSyncService.pullChecklistsForWorkOrder(workOrderId);
                if (reloadResult.success) {
                  setChecklists(reloadResult.checklists || []);
                }
                // Abrir o checklist reaberto para edição
                router.push(`/os/checklist/${instanceId}`);
              } else {
                Alert.alert('Erro', result.error || 'Falha ao reabrir checklist');
              }
            } catch (err) {
              Alert.alert('Erro', err instanceof Error ? err.message : 'Erro ao reabrir checklist');
            } finally {
              setIsReopening(false);
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.tabContent, styles.emptyTab]}>
        <Text variant="body" color="secondary">
          Carregando checklists...
        </Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={[styles.tabContent, styles.emptyTab]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.error[500]} />
        <Text variant="body" color="error" style={{ marginTop: spacing[2], textAlign: 'center' }}>
          {loadError}
        </Text>
        <TouchableOpacity
          style={{ marginTop: spacing[3], padding: spacing[2] }}
          onPress={() => {
            setIsLoading(true);
            setLoadError(null);
            import('../../src/modules/checklists/services/ChecklistSyncService')
              .then(({ ChecklistSyncService }) =>
                ChecklistSyncService.pullChecklistsForWorkOrder(workOrderId)
              )
              .then((result) => {
                if (result.success) {
                  setChecklists(result.checklists || []);
                } else {
                  setLoadError(result.error || 'Erro ao carregar');
                }
              })
              .catch((err) => setLoadError(err.message))
              .finally(() => setIsLoading(false));
          }}
        >
          <Text variant="body" style={{ color: colors.primary[500] }}>
            Tentar novamente
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (checklists.length === 0) {
    return (
      <View style={[styles.tabContent, styles.emptyTab]}>
        <Ionicons name="checkbox-outline" size={48} color={colors.text.tertiary} />
        <Text variant="body" color="tertiary" style={{ marginTop: spacing[2] }}>
          Nenhum checklist vinculado
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Loading overlay when reopening checklist */}
      {isReopening && (
        <View style={[styles.loadingOverlay, { backgroundColor: 'rgba(255,255,255,0.9)' }]}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
          <Text variant="body" color="secondary" style={{ marginTop: spacing[2] }}>
            Sincronizando e reabrindo...
          </Text>
        </View>
      )}
      <ScrollView style={styles.tabContent} contentContainerStyle={{ padding: spacing[4] }}>
        {/* Filter duplicates to avoid key collision */}
        {checklists.filter((checklist, index, self) =>
          index === self.findIndex(c => c.id === checklist.id)
        ).map((checklist) => {
        const statusColor =
          checklist.status === 'COMPLETED'
            ? colors.success[500]
            : checklist.status === 'IN_PROGRESS'
            ? colors.warning[500]
            : colors.text.tertiary;

        const statusLabel =
          checklist.status === 'COMPLETED'
            ? 'Concluído'
            : checklist.status === 'IN_PROGRESS'
            ? 'Em andamento'
            : 'Pendente';

        return (
          <TouchableOpacity
            key={checklist.id}
            onPress={() => handleOpenChecklist(checklist.id, checklist.status)}
          >
            <Card
              variant="outlined"
              style={[styles.checklistCard, { marginBottom: spacing[3] }]}
            >
              <View style={styles.checklistCardHeader}>
                <View style={{ flex: 1 }}>
                  <Text variant="body" weight="semibold">
                    {checklist.templateName || 'Checklist'}
                  </Text>
                  <Text variant="caption" color="secondary">
                    {statusLabel}
                  </Text>
                </View>
                <View style={styles.progressContainer}>
                  <Text variant="caption" style={{ color: statusColor }}>
                    {checklist.progress || 0}%
                  </Text>
                  <Ionicons
                    name={checklist.status === 'COMPLETED' ? 'checkmark-circle' : 'chevron-forward'}
                    size={20}
                    color={statusColor}
                  />
                </View>
              </View>
              {/* Progress bar */}
              <View style={[styles.progressBar, { backgroundColor: colors.background.tertiary }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${checklist.progress || 0}%`,
                      backgroundColor: statusColor,
                    },
                  ]}
                />
              </View>
              {/* Botão Reabrir para checklists concluídos quando OS está em andamento */}
              {checklist.status === 'COMPLETED' && workOrderStatus === 'IN_PROGRESS' && (
                <TouchableOpacity
                  style={[
                    styles.reopenButton,
                    { backgroundColor: colors.primary[50], borderColor: colors.primary[200] },
                  ]}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleReopenChecklist(checklist.id);
                  }}
                >
                  <Ionicons name="refresh-outline" size={16} color={colors.primary[600]} />
                  <Text variant="caption" style={{ color: colors.primary[600], marginLeft: 4 }}>
                    Reabrir para edição
                  </Text>
                </TouchableOpacity>
              )}
            </Card>
          </TouchableOpacity>
        );
      })}
      </ScrollView>
    </View>
  );
});

const AttachmentsTab = React.memo(function AttachmentsTab({
  workOrderId,
  workOrderStatus,
  technicianId,
}: {
  workOrderId: string;
  workOrderStatus: WorkOrderStatus;
  technicianId?: string;
}) {
  const colors = useColors();
  const spacing = useSpacing();
  const [attachments, setAttachments] = useState<ChecklistAttachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<ChecklistAttachment | null>(null);

  // Carregar anexos da OS
  const loadAttachments = useCallback(async () => {
    try {
      setIsLoading(true);
      const results = await ChecklistAttachmentRepository.getByWorkOrder(workOrderId);
      setAttachments(results);
    } catch (err) {
      console.error('[AttachmentsTab] Error loading attachments:', err);
    } finally {
      setIsLoading(false);
    }
  }, [workOrderId]);

  // Enviar anexos pendentes quando voltar online
  const pushPendingAttachments = useCallback(async () => {
    const engine = syncEngine as any;
    if (!engine.baseUrl || !engine.authToken || !syncEngine.isNetworkOnline()) {
      return;
    }

    try {
      const pendingAttachments = await ChecklistAttachmentRepository.getPendingUpload();
      const workOrderPending = pendingAttachments.filter(a => a.workOrderId === workOrderId);

      if (workOrderPending.length === 0) return;

      console.log('[AttachmentsTab] Pushing', workOrderPending.length, 'pending attachments...');

      for (const attachment of workOrderPending) {
        try {
          // Obter base64 data
          let base64Data = attachment.base64Data;
          if (!base64Data && attachment.localPath) {
            base64Data = await FileSystem.readAsStringAsync(attachment.localPath, {
              encoding: FileSystem.EncodingType.Base64,
            });
          }

          if (!base64Data) {
            console.warn('[AttachmentsTab] No data for attachment:', attachment.id);
            // Marcar como falha se não tem dados
            await ChecklistAttachmentRepository.update(attachment.id, {
              syncStatus: 'FAILED',
              uploadAttempts: (attachment.uploadAttempts || 0) + 1,
              lastUploadError: 'Dados da imagem não encontrados',
            });
            continue;
          }

          const response = await fetch(`${engine.baseUrl}/attachments/base64`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${engine.authToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              data: `data:${attachment.mimeType || 'image/jpeg'};base64,${base64Data}`,
              type: 'PHOTO',
              workOrderId,
            }),
          });

          if (response.ok) {
            const result = await response.json();
            await ChecklistAttachmentRepository.markSynced(attachment.id, result.publicUrl || result.id);
            console.log('[AttachmentsTab] Attachment synced:', attachment.id);
          } else {
            const errorText = await response.text();
            console.warn('[AttachmentsTab] Upload failed:', attachment.id, response.status, errorText);
            await ChecklistAttachmentRepository.update(attachment.id, {
              syncStatus: 'FAILED',
              uploadAttempts: (attachment.uploadAttempts || 0) + 1,
              lastUploadError: `${response.status}: ${errorText.substring(0, 200)}`,
            });
          }
        } catch (uploadErr) {
          console.warn('[AttachmentsTab] Failed to sync attachment:', attachment.id, uploadErr);
          await ChecklistAttachmentRepository.update(attachment.id, {
            syncStatus: 'FAILED',
            uploadAttempts: (attachment.uploadAttempts || 0) + 1,
            lastUploadError: uploadErr instanceof Error ? uploadErr.message : 'Erro desconhecido',
          });
        }
      }

      // Recarregar para atualizar status
      const results = await ChecklistAttachmentRepository.getByWorkOrder(workOrderId);
      setAttachments(results);
    } catch (err) {
      console.error('[AttachmentsTab] Error pushing pending attachments:', err);
    }
  }, [workOrderId]);

  useEffect(() => {
    if (workOrderId) {
      // Primeiro enviar pendentes, depois carregar
      pushPendingAttachments().then(() => loadAttachments());
    }
  }, [workOrderId, loadAttachments, pushPendingAttachments]);

  // Solicitar permissão de câmera/galeria
  const requestPermission = async (type: 'camera' | 'gallery') => {
    if (type === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      return status === 'granted';
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      return status === 'granted';
    }
  };

  // Capturar foto da câmera
  const takePhoto = async () => {
    const hasPermission = await requestPermission('camera');
    if (!hasPermission) {
      Alert.alert('Permissão negada', 'É necessário permitir o acesso à câmera para tirar fotos.');
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets[0]) {
        await saveAttachment(result.assets[0]);
      }
    } catch (err) {
      console.error('[AttachmentsTab] Camera error:', err);
      Alert.alert('Erro', 'Não foi possível capturar a foto.');
    }
  };

  // Selecionar da galeria
  const pickFromGallery = async () => {
    const hasPermission = await requestPermission('gallery');
    if (!hasPermission) {
      Alert.alert('Permissão negada', 'É necessário permitir o acesso à galeria para selecionar fotos.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsMultipleSelection: true,
        selectionLimit: 10,
      });

      if (!result.canceled && result.assets.length > 0) {
        for (const asset of result.assets) {
          await saveAttachment(asset);
        }
      }
    } catch (err) {
      console.error('[AttachmentsTab] Gallery error:', err);
      Alert.alert('Erro', 'Não foi possível selecionar as fotos.');
    }
  };

  // Comprimir imagem antes de salvar (800x800, qualidade 0.5 para evitar erro 413)
  const compressImage = async (uri: string): Promise<{ uri: string; base64: string }> => {
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 800, height: 800 } }],
        {
          compress: 0.5,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );
      return { uri: result.uri, base64: result.base64 || '' };
    } catch (error) {
      console.warn('[AttachmentsTab] Compression failed, using original:', error);
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return { uri, base64 };
    }
  };

  // Salvar anexo - upload direto para o servidor via /attachments/base64
  const saveAttachment = async (asset: ImagePicker.ImagePickerAsset) => {
    try {
      setIsUploading(true);

      // Comprimir imagem antes de enviar
      const compressed = await compressImage(asset.uri);
      const fileName = asset.fileName || `foto_${Date.now()}.jpg`;
      const fileSize = Math.round(compressed.base64.length * 0.75);

      // Salvar localmente primeiro (para exibição imediata)
      const localAttachment = await ChecklistAttachmentRepository.create({
        workOrderId,
        type: 'PHOTO',
        fileName,
        fileSize,
        mimeType: 'image/jpeg',
        localPath: compressed.uri,
        base64Data: compressed.base64,
        technicianId: technicianId || '',
        syncStatus: 'UPLOADING',
      });

      // Atualizar lista imediatamente
      setAttachments((prev) => [...prev, localAttachment]);

      // Upload para o servidor via endpoint /attachments/base64
      try {
        const engine = syncEngine as any;
        if (engine.baseUrl && engine.authToken) {
          console.log('[AttachmentsTab] Uploading to /attachments/base64...');
          const response = await fetch(`${engine.baseUrl}/attachments/base64`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${engine.authToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              data: `data:image/jpeg;base64,${compressed.base64}`,
              type: 'PHOTO',
              workOrderId,
            }),
          });

          if (response.ok) {
            const result = await response.json();
            console.log('[AttachmentsTab] Upload success:', result.id);
            // Atualizar registro local com URL do servidor
            await ChecklistAttachmentRepository.markSynced(localAttachment.id, result.publicUrl || result.id);
            // Atualizar item na lista
            setAttachments((prev) =>
              prev.map((a) =>
                a.id === localAttachment.id
                  ? { ...a, syncStatus: 'SYNCED', remotePath: result.publicUrl || result.id }
                  : a
              )
            );
          } else {
            const errorText = await response.text();
            console.error('[AttachmentsTab] Upload failed:', response.status, errorText);
            // Marcar como falhou mas manter localmente
            await ChecklistAttachmentRepository.update(localAttachment.id, {
              syncStatus: 'FAILED',
              lastUploadError: `${response.status}: ${errorText}`,
            });
          }
        }
      } catch (uploadErr) {
        console.error('[AttachmentsTab] Upload error:', uploadErr);
        // Falha no upload, mas anexo fica salvo localmente
        await ChecklistAttachmentRepository.update(localAttachment.id, {
          syncStatus: 'FAILED',
          lastUploadError: uploadErr instanceof Error ? uploadErr.message : 'Erro de upload',
        });
      }

    } catch (err) {
      console.error('[AttachmentsTab] Save attachment error:', err);
      Alert.alert('Erro', 'Não foi possível salvar a foto.');
    } finally {
      setIsUploading(false);
    }
  };

  // Mostrar opções de adicionar foto
  const showAddOptions = () => {
    if (workOrderStatus !== 'IN_PROGRESS') {
      Alert.alert('Aviso', 'Inicie a execução da OS antes de adicionar anexos.');
      return;
    }

    Alert.alert(
      'Adicionar Foto',
      'Escolha uma opção',
      [
        { text: 'Tirar Foto', onPress: takePhoto },
        { text: 'Escolher da Galeria', onPress: pickFromGallery },
        { text: 'Cancelar', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  // Deletar anexo
  const deleteAttachment = async (attachment: ChecklistAttachment) => {
    Alert.alert(
      'Excluir Foto',
      'Deseja realmente excluir esta foto?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await ChecklistAttachmentRepository.delete(attachment.id);
              setAttachments((prev) => prev.filter((a) => a.id !== attachment.id));
            } catch (err) {
              console.error('[AttachmentsTab] Delete error:', err);
              Alert.alert('Erro', 'Não foi possível excluir a foto.');
            }
          },
        },
      ]
    );
  };

  // Obter URI da imagem (local ou remota)
  const getImageUri = (attachment: ChecklistAttachment) => {
    if (attachment.localPath) {
      return attachment.localPath;
    }
    if (attachment.remotePath) {
      return attachment.remotePath;
    }
    if (attachment.base64Data) {
      return `data:${attachment.mimeType || 'image/jpeg'};base64,${attachment.base64Data}`;
    }
    return null;
  };

  // Obter ícone de status de sync
  const getSyncStatusIcon = (status: string) => {
    switch (status) {
      case 'SYNCED':
        return { name: 'cloud-done', color: colors.success[500] };
      case 'UPLOADING':
        return { name: 'cloud-upload', color: colors.warning[500] };
      case 'FAILED':
        return { name: 'cloud-offline', color: colors.error[500] };
      default:
        return { name: 'cloud-outline', color: colors.text.tertiary };
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.tabContent, styles.emptyTab]}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text variant="body" color="secondary" style={{ marginTop: spacing[2] }}>
          Carregando anexos...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.tabContent}>
      <ScrollView contentContainerStyle={{ padding: spacing[4] }}>
        {/* Grid de fotos */}
        {attachments.length > 0 ? (
          <View style={styles.photoGrid}>
            {/* Filter duplicates to avoid key collision */}
            {attachments.filter((attachment, index, self) =>
              index === self.findIndex(a => a.id === attachment.id)
            ).map((attachment) => {
              const imageUri = getImageUri(attachment);
              const syncStatus = getSyncStatusIcon(attachment.syncStatus);

              return (
                <TouchableOpacity
                  key={attachment.id}
                  style={[styles.photoItem, { backgroundColor: colors.background.secondary }]}
                  onPress={() => setSelectedImage(attachment)}
                  onLongPress={() => deleteAttachment(attachment)}
                >
                  {imageUri ? (
                    <Image source={{ uri: imageUri }} style={styles.photoThumbnail} />
                  ) : (
                    <View style={[styles.photoPlaceholder, { backgroundColor: colors.background.tertiary }]}>
                      <Ionicons name="image-outline" size={32} color={colors.text.tertiary} />
                    </View>
                  )}
                  {/* Badge de status */}
                  <View style={[styles.syncBadge, { backgroundColor: colors.background.primary }]}>
                    <Ionicons name={syncStatus.name as any} size={14} color={syncStatus.color} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyAttachments}>
            <Ionicons name="images-outline" size={64} color={colors.text.tertiary} />
            <Text variant="body" color="tertiary" style={{ marginTop: spacing[3], textAlign: 'center' }}>
              Nenhuma foto anexada
            </Text>
            <Text variant="caption" color="tertiary" style={{ textAlign: 'center', marginTop: spacing[1] }}>
              Toque no botão abaixo para adicionar fotos
            </Text>
          </View>
        )}

        {/* Contador */}
        {attachments.length > 0 && (
          <Text variant="caption" color="secondary" style={{ marginTop: spacing[3], textAlign: 'center' }}>
            {attachments.length} foto{attachments.length !== 1 ? 's' : ''} anexada{attachments.length !== 1 ? 's' : ''}
          </Text>
        )}
      </ScrollView>

      {/* Botão de adicionar */}
      <TouchableOpacity
        style={[
          styles.addPhotoButton,
          {
            backgroundColor: workOrderStatus === 'IN_PROGRESS' ? colors.primary[500] : colors.text.tertiary,
          },
        ]}
        onPress={showAddOptions}
        disabled={isUploading}
      >
        {isUploading ? (
          <ActivityIndicator size="small" color="#FFF" />
        ) : (
          <>
            <Ionicons name="camera" size={24} color="#FFF" />
            <Text variant="body" weight="semibold" style={{ color: '#FFF', marginLeft: 8 }}>
              Adicionar Foto
            </Text>
          </>
        )}
      </TouchableOpacity>

      {/* Modal de visualização */}
      <Modal
        visible={selectedImage !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <View style={styles.imageModalOverlay}>
          <TouchableOpacity
            style={styles.imageModalClose}
            onPress={() => setSelectedImage(null)}
          >
            <Ionicons name="close" size={32} color="#FFF" />
          </TouchableOpacity>
          {selectedImage && (
            <Image
              source={{ uri: getImageUri(selectedImage) || '' }}
              style={styles.imageModalFull}
              resizeMode="contain"
            />
          )}
          <View style={styles.imageModalFooter}>
            <Text variant="caption" style={{ color: '#FFF' }}>
              {selectedImage?.fileName}
            </Text>
            <TouchableOpacity
              style={[styles.imageModalDelete, { backgroundColor: colors.error[500] }]}
              onPress={() => {
                if (selectedImage) {
                  deleteAttachment(selectedImage);
                  setSelectedImage(null);
                }
              }}
            >
              <Ionicons name="trash" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
});

const HistoryTab = React.memo(function HistoryTab() {
  const colors = useColors();
  const spacing = useSpacing();

  return (
    <View style={[styles.tabContent, styles.emptyTab]}>
      <Ionicons name="time-outline" size={48} color={colors.text.tertiary} />
      <Text variant="body" color="tertiary" style={{ marginTop: spacing[2] }}>
        Histórico vazio
      </Text>
    </View>
  );
});

// =============================================================================
// SIGNATURE TAB
// =============================================================================

const SignatureTab = React.memo(function SignatureTab({
  workOrderId,
  workOrderStatus,
  clientId,
  clientName,
}: {
  workOrderId: string;
  workOrderStatus: WorkOrderStatus;
  clientId?: string;
  clientName?: string;
}) {
  const colors = useColors();
  const spacing = useSpacing();
  const { user } = useAuth();
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [signature, setSignature] = useState<{
    id?: string;
    signerName: string;
    signerRole: string;
    signedAt: string;
    imageUrl?: string;
    signatureBase64?: string; // Para exibir assinatura local offline
    isPendingSync?: boolean;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Carregar assinatura existente (servidor + local)
  useEffect(() => {
    async function loadSignature() {
      try {
        setIsLoading(true);
        const engine = syncEngine as any;
        const isOnline = engine.baseUrl && engine.authToken && syncEngine.isNetworkOnline();

        // Primeiro, tentar carregar assinatura local (pode ter sido salva offline)
        let localSignature: Signature | null = null;
        try {
          const localResults = await rawQuery<Signature>(
            `SELECT * FROM signatures WHERE workOrderId = ? ORDER BY signedAt DESC LIMIT 1`,
            [workOrderId]
          );
          localSignature = localResults.length > 0 ? localResults[0] : null;
          console.log('[SignatureTab] Local signature found:', !!localSignature, localSignature?.syncedAt ? 'synced' : 'pending');
        } catch (dbErr) {
          console.warn('[SignatureTab] Error loading local signature:', dbErr);
        }

        // Se online, tentar buscar do servidor
        if (isOnline) {
          try {
            // Primeiro, enviar assinaturas pendentes antes de buscar
            if (localSignature && !localSignature.syncedAt) {
              console.log('[SignatureTab] Pushing pending signature before pull...');
              await pushPendingSignature(localSignature, engine);
            }

            const response = await fetch(`${engine.baseUrl}/work-orders/${workOrderId}/signature`, {
              headers: {
                Authorization: `Bearer ${engine.authToken}`,
              },
            });

            if (response.ok) {
              const text = await response.text();
              if (text && text.trim() !== '' && text !== 'null') {
                const data = JSON.parse(text);
                if (data && data.id) {
                  let imageUrl;
                  if (data.attachment?.publicUrl) {
                    imageUrl = data.attachment.publicUrl.startsWith('http')
                      ? data.attachment.publicUrl
                      : `${engine.baseUrl}${data.attachment.publicUrl}`;
                  }
                  setSignature({
                    id: data.id,
                    signerName: data.signerName,
                    signerRole: data.signerRole || 'Cliente',
                    signedAt: data.signedAt,
                    imageUrl,
                    isPendingSync: false,
                  });
                  return;
                }
              }
            }
          } catch (fetchErr) {
            console.warn('[SignatureTab] Error fetching from server, using local:', fetchErr);
          }
        }

        // Fallback para assinatura local
        if (localSignature) {
          setSignature({
            id: localSignature.id,
            signerName: localSignature.signerName,
            signerRole: localSignature.signerRole || 'Cliente',
            signedAt: localSignature.signedAt,
            signatureBase64: localSignature.signatureBase64,
            isPendingSync: !localSignature.syncedAt,
          });
        } else {
          setSignature(null);
        }
      } catch (err) {
        // Usar warn ao invés de error - é esperado quando offline
        console.warn('[SignatureTab] Error loading signature (may be offline):', err);
        setSignature(null);
      } finally {
        setIsLoading(false);
      }
    }

    // Helper para enviar assinatura pendente
    async function pushPendingSignature(sig: Signature, engine: any) {
      try {
        const response = await fetch(`${engine.baseUrl}/work-orders/${workOrderId}/signature`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${engine.authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            imageBase64: sig.signatureBase64,
            signerName: sig.signerName,
            signerDocument: sig.signerDocument,
            signerRole: sig.signerRole,
            localId: sig.localId || sig.id,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          // Marcar como sincronizado
          await rawQuery(
            `UPDATE signatures SET syncedAt = ?, updatedAt = ? WHERE id = ?`,
            [new Date().toISOString(), new Date().toISOString(), sig.id]
          );
          console.log('[SignatureTab] Pending signature synced:', result.id);
        }
      } catch (pushErr) {
        console.warn('[SignatureTab] Failed to push pending signature:', pushErr);
      }
    }

    if (workOrderId) {
      loadSignature();
    }
  }, [workOrderId]);

  // Salvar assinatura (offline-first)
  const handleCaptureSignature = async (data: SignatureData) => {
    try {
      setIsSaving(true);
      const engine = syncEngine as any;
      const isOnline = engine.baseUrl && engine.authToken && syncEngine.isNetworkOnline();
      const now = new Date().toISOString();
      const localId = uuidv4();

      // SEMPRE salvar localmente primeiro (offline-first)
      const localSignature: Partial<Signature> = {
        id: localId,
        workOrderId,
        clientId: clientId || '',
        signerName: data.signerName,
        signerDocument: data.signerDocument,
        signerRole: data.signerRole,
        signedAt: data.timestamp,
        signatureBase64: data.signatureBase64,
        localId,
        technicianId: user?.technicianId || '',
        createdAt: now,
        updatedAt: now,
        // syncedAt será preenchido após sync com servidor
      };

      // Salvar no banco local
      try {
        await insert('signatures', localSignature as Record<string, unknown>);
        console.log('[SignatureTab] Signature saved locally:', localId);
      } catch (insertErr) {
        console.error('[SignatureTab] Error saving locally:', insertErr);
        Alert.alert('Erro', 'Não foi possível salvar a assinatura localmente.');
        return;
      }

      // Atualizar UI imediatamente
      setSignature({
        id: localId,
        signerName: data.signerName,
        signerRole: data.signerRole,
        signedAt: data.timestamp,
        signatureBase64: data.signatureBase64,
        isPendingSync: true,
      });

      // Se online, tentar enviar para o servidor
      if (isOnline) {
        try {
          const response = await fetch(`${engine.baseUrl}/work-orders/${workOrderId}/signature`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${engine.authToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              imageBase64: data.signatureBase64,
              signerName: data.signerName,
              signerDocument: data.signerDocument,
              signerRole: data.signerRole,
              localId,
            }),
          });

          if (response.ok) {
            const result = await response.json();
            // Marcar como sincronizado
            await rawQuery(
              `UPDATE signatures SET syncedAt = ?, updatedAt = ? WHERE id = ?`,
              [now, now, localId]
            );

            setSignature({
              id: result.id,
              signerName: data.signerName,
              signerRole: data.signerRole,
              signedAt: data.timestamp,
              imageUrl: result.attachment?.publicUrl
                ? (result.attachment.publicUrl.startsWith('http')
                    ? result.attachment.publicUrl
                    : `${engine.baseUrl}${result.attachment.publicUrl}`)
                : undefined,
              isPendingSync: false,
            });
            Alert.alert('Sucesso', 'Assinatura coletada com sucesso!');
          } else {
            const errorText = await response.text();
            console.error('[SignatureTab] Server error:', response.status, errorText);
            Alert.alert('Aviso', 'Assinatura salva localmente. Será sincronizada quando houver conexão.');
          }
        } catch (fetchErr) {
          console.warn('[SignatureTab] Network error, saved locally:', fetchErr);
          Alert.alert('Aviso', 'Assinatura salva localmente. Será sincronizada quando houver conexão.');
        }
      } else {
        Alert.alert('Sucesso', 'Assinatura salva localmente. Será sincronizada quando houver conexão.');
      }
    } catch (err) {
      console.error('[SignatureTab] Error:', err);
      Alert.alert('Erro', 'Falha ao salvar assinatura.');
    } finally {
      setIsSaving(false);
      setShowSignaturePad(false);
    }
  };

  // Loading
  if (isLoading) {
    return (
      <View style={[styles.tabContent, styles.emptyTab]}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text variant="body" color="secondary" style={{ marginTop: spacing[2] }}>
          Carregando...
        </Text>
      </View>
    );
  }

  // Se já tem assinatura, mostrar
  if (signature) {
    // Determinar fonte da imagem (servidor ou local base64)
    const imageSource = signature.imageUrl
      ? { uri: signature.imageUrl }
      : signature.signatureBase64
        ? { uri: `data:image/png;base64,${signature.signatureBase64}` }
        : null;

    return (
      <ScrollView style={styles.tabContent} contentContainerStyle={{ padding: spacing[4] }}>
        <Card variant="outlined" style={[styles.infoCard, { marginBottom: spacing[3] }]}>
          <View style={styles.infoCardHeader}>
            <Ionicons
              name={signature.isPendingSync ? "cloud-upload-outline" : "checkmark-circle"}
              size={20}
              color={signature.isPendingSync ? colors.warning[500] : colors.success[500]}
            />
            <Text
              variant="body"
              weight="semibold"
              style={{ marginLeft: 8, color: signature.isPendingSync ? colors.warning[600] : colors.success[600] }}
            >
              {signature.isPendingSync ? 'Assinatura Pendente de Sync' : 'Assinatura Coletada'}
            </Text>
          </View>

          {/* Indicador de pendente */}
          {signature.isPendingSync && (
            <View style={[styles.pendingSyncBadge, { backgroundColor: colors.warning[50], marginBottom: spacing[2] }]}>
              <Ionicons name="time-outline" size={14} color={colors.warning[600]} />
              <Text variant="caption" style={{ marginLeft: 4, color: colors.warning[600] }}>
                Será sincronizada quando houver conexão
              </Text>
            </View>
          )}

          {/* Imagem da assinatura (servidor ou local base64) */}
          {imageSource && (
            <View style={[styles.signatureImageContainer, { borderColor: colors.border.light }]}>
              <Image
                source={imageSource}
                style={styles.signatureImage}
                resizeMode="contain"
              />
            </View>
          )}

          <View style={{ marginTop: spacing[3] }}>
            <View style={styles.signatureInfo}>
              <Text variant="caption" color="secondary">Nome:</Text>
              <Text variant="body" weight="medium">{signature.signerName}</Text>
            </View>
            <View style={styles.signatureInfo}>
              <Text variant="caption" color="secondary">Papel:</Text>
              <Text variant="body">{signature.signerRole}</Text>
            </View>
            <View style={styles.signatureInfo}>
              <Text variant="caption" color="secondary">Data/Hora:</Text>
              <Text variant="body">
                {new Date(signature.signedAt).toLocaleString('pt-BR')}
              </Text>
            </View>
          </View>
        </Card>
      </ScrollView>
    );
  }

  // Se não tem assinatura, mostrar botão para coletar
  const canCollectSignature = workOrderStatus === 'IN_PROGRESS' || workOrderStatus === 'DONE';

  return (
    <View style={styles.tabContent}>
      <View style={[styles.emptyTab, { padding: spacing[4] }]}>
        <View style={[styles.signatureIconContainer, { backgroundColor: colors.primary[50] }]}>
          <Ionicons name="pencil-outline" size={48} color={colors.primary[500]} />
        </View>
        <Text variant="h4" weight="semibold" style={{ marginTop: spacing[3], textAlign: 'center' }}>
          Assinatura do Cliente
        </Text>
        <Text variant="body" color="secondary" style={{ marginTop: spacing[2], textAlign: 'center' }}>
          {canCollectSignature
            ? 'Colete a assinatura do cliente para confirmar o serviço realizado.'
            : 'Inicie a OS para coletar a assinatura do cliente.'}
        </Text>

        {canCollectSignature && (
          <Button
            variant="primary"
            size="lg"
            onPress={() => setShowSignaturePad(true)}
            style={{ marginTop: spacing[4], width: '100%' }}
            disabled={isSaving}
          >
            <View style={styles.buttonContent}>
              <Ionicons name="pencil" size={20} color="#FFF" />
              <Text variant="body" weight="semibold" style={{ color: '#FFF', marginLeft: 8 }}>
                {isSaving ? 'Salvando...' : 'Coletar Assinatura'}
              </Text>
            </View>
          </Button>
        )}
      </View>

      {/* Modal de Assinatura */}
      <SignaturePad
        visible={showSignaturePad}
        onClose={() => setShowSignaturePad(false)}
        onCapture={handleCaptureSignature}
        defaultSignerName={clientName || ''}
        defaultSignerRole={SIGNER_ROLES.CLIENT}
        title="Assinatura do Cliente"
      />
    </View>
  );
});

// =============================================================================
// MAIN SCREEN
// =============================================================================

export default function WorkOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const spacing = useSpacing();
  const { user } = useAuth();
  const { t } = useTranslation();
  const { locale } = useLocale();

  // State
  const [activeTab, setActiveTab] = useState<TabKey>('info');
  const [pauseModalVisible, setPauseModalVisible] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  // Hooks
  const {
    workOrder,
    executionState,
    executionSummary,
    isLoading,
    error,
    hasPendingSync,
    actions,
  } = useWorkOrderExecution(id || '');

  const timer = useExecutionTimer(executionState);

  // Dynamic status config based on current locale
  const STATUS_CONFIG = useMemo(() => ({
    SCHEDULED: { color: 'primary', label: t('workOrders.detail.statuses.scheduled'), icon: 'calendar' },
    IN_PROGRESS: { color: 'warning', label: t('workOrders.detail.statuses.inProgress'), icon: 'play-circle' },
    DONE: { color: 'success', label: t('workOrders.detail.statuses.done'), icon: 'checkmark-circle' },
    CANCELED: { color: 'error', label: t('workOrders.detail.statuses.canceled'), icon: 'close-circle' },
  }), [t, locale]);

  // Dynamic tabs based on current locale
  const TABS = useMemo(() => [
    { key: 'info', label: t('workOrders.detail.tabs.info'), icon: 'information-circle-outline' },
    { key: 'checklists', label: t('workOrders.detail.tabs.checklists'), icon: 'checkbox-outline' },
    { key: 'attachments', label: t('workOrders.detail.tabs.attachments'), icon: 'attach-outline' },
    { key: 'signature', label: t('workOrders.detail.tabs.signature'), icon: 'pencil-outline' },
    { key: 'history', label: t('workOrders.detail.tabs.history'), icon: 'time-outline' },
  ] as const, [t, locale]);

  // Handlers
  const handleStart = useCallback(async () => {
    const success = await actions.start({ syncChecklistsFirst: true });
    if (!success) {
      Alert.alert(t('common.error'), t('workOrders.detail.alerts.couldNotStart'));
    }
  }, [actions, t]);

  const handlePause = useCallback(() => {
    setPauseModalVisible(true);
  }, []);

  const handlePauseConfirm = useCallback(
    async (reason: PauseReasonValue, notes?: string) => {
      setPauseModalVisible(false);
      const success = await actions.pause(reason, notes);
      if (!success) {
        Alert.alert(t('common.error'), t('workOrders.detail.alerts.couldNotPause'));
      }
    },
    [actions, t]
  );

  const handleResume = useCallback(async () => {
    const success = await actions.resume();
    if (!success) {
      Alert.alert(t('common.error'), t('workOrders.detail.alerts.couldNotResume'));
    }
  }, [actions, t]);

  const handleComplete = useCallback(async () => {
    Alert.alert(
      t('workOrders.detail.execution.complete'),
      t('workOrders.detail.alerts.completeConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('workOrders.detail.execution.complete'),
          onPress: async () => {
            const result = await actions.complete({ syncPendingFirst: true });
            if (result.success) {
              Alert.alert(t('common.success'), t('workOrders.detail.alerts.completeSuccess'));
            } else {
              Alert.alert(t('common.error'), result.error || t('workOrders.detail.alerts.couldNotComplete'));
            }
          },
        },
      ],
      { cancelable: true }
    );
  }, [actions, t]);

  // Handler para reabrir OS concluída
  const handleReopen = useCallback(async () => {
    Alert.alert(
      t('workOrders.detail.execution.reopenWO'),
      t('workOrders.detail.alerts.reopenConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('workOrders.detail.checklists.reopen'),
          onPress: async () => {
            try {
              const success = await actions.start({ syncChecklistsFirst: false });
              if (success) {
                Alert.alert(t('common.success'), t('workOrders.detail.alerts.reopenSuccess'));
              } else {
                Alert.alert(t('common.error'), t('workOrders.detail.alerts.couldNotReopen'));
              }
            } catch (err) {
              Alert.alert(t('common.error'), err instanceof Error ? err.message : t('workOrders.detail.alerts.couldNotReopen'));
            }
          },
        },
      ],
      { cancelable: true }
    );
  }, [actions, t]);

  // Handler para compartilhar via WhatsApp
  const handleShareWhatsApp = useCallback(async () => {
    if (!workOrder || !workOrder.clientPhone) {
      Alert.alert(t('common.error'), t('workOrders.detail.alerts.noClientPhone'));
      return;
    }

    try {
      setIsSharing(true);
      await ShareService.shareWorkOrderViaWhatsApp(
        workOrder.id,
        workOrder.clientPhone,
        workOrder.clientName || t('workOrders.detail.info.client'),
        workOrder.title,
      );
    } catch (error: any) {
      console.error('[WorkOrderDetail] Error sharing:', error);
      Alert.alert(t('common.error'), error.message || t('workOrders.detail.alerts.shareError'));
    } finally {
      setIsSharing(false);
    }
  }, [workOrder, t]);

  // Handler para criar cobrança a partir da OS
  const handleCreateCharge = useCallback(() => {
    if (!workOrder) return;

    // Navegar para a tela de nova cobrança com os dados pré-preenchidos
    const params = new URLSearchParams();
    if (workOrder.clientId) params.append('clientId', workOrder.clientId);
    if (workOrder.clientName) params.append('clientName', encodeURIComponent(workOrder.clientName));
    params.append('workOrderId', workOrder.id);
    if (workOrder.totalValue) params.append('value', workOrder.totalValue.toString());
    if (workOrder.title) params.append('description', encodeURIComponent(`OS: ${workOrder.title}`));

    router.push(`/cobrancas/nova?${params.toString()}`);
  }, [workOrder, router]);

  // Handler para retry de sync de dados pendentes (respostas de checklist e anexos)
  const handleRetrySync = useCallback(async () => {
    if (isSyncing || !id) return;

    setIsSyncing(true);
    try {
      console.log('[WorkOrderDetail] Retrying sync for pending data...');

      const { ChecklistSyncService } = await import('../../src/modules/checklists/services/ChecklistSyncService');

      // 1. Sincronizar respostas de checklist pendentes
      const pendingAnswers = await ChecklistSyncService.countPendingSyncByWorkOrder(id);
      if (pendingAnswers > 0) {
        console.log(`[WorkOrderDetail] Found ${pendingAnswers} pending answers, syncing...`);
        await ChecklistSyncService.pushPendingAnswers(id);
      }

      // 2. Buscar anexos pendentes desta OS
      const pendingAttachments = await ChecklistAttachmentRepository.getByWorkOrder(id);
      const toUpload = pendingAttachments.filter(
        (a) => a.syncStatus === 'PENDING' || a.syncStatus === 'FAILED'
      );

      let successCount = 0;
      let failCount = 0;

      if (toUpload.length > 0) {
        console.log(`[WorkOrderDetail] Found ${toUpload.length} pending attachments`);

        const engine = syncEngine as any;
        if (!engine.baseUrl || !engine.authToken) {
          throw new Error('SyncEngine não configurado');
        }

        for (const attachment of toUpload) {
          try {
            // Obter base64 do anexo
            let base64Data = attachment.base64Data;

            if (!base64Data && attachment.localPath) {
              // Ler do arquivo local
              base64Data = await FileSystem.readAsStringAsync(attachment.localPath, {
                encoding: FileSystem.EncodingType.Base64,
              });
            }

            if (!base64Data) {
              console.warn(`[WorkOrderDetail] No data for attachment ${attachment.id}`);
              failCount++;
              continue;
            }

            // Upload via /attachments/base64 (endpoint para anexos diretos da OS)
            const response = await fetch(`${engine.baseUrl}/attachments/base64`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${engine.authToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                data: `data:${attachment.mimeType || 'image/jpeg'};base64,${base64Data}`,
                type: 'PHOTO',
                workOrderId: id,
              }),
            });

            if (response.ok) {
              const result = await response.json();
              console.log(`[WorkOrderDetail] Upload success for ${attachment.id}:`, result.id);
              await ChecklistAttachmentRepository.markSynced(attachment.id, result.publicUrl || result.id);
              successCount++;
            } else {
              const errorText = await response.text();
              console.error(`[WorkOrderDetail] Upload failed for ${attachment.id}:`, response.status, errorText);
              await ChecklistAttachmentRepository.update(attachment.id, {
                syncStatus: 'FAILED',
                lastUploadError: `${response.status}: ${errorText}`,
              });
              failCount++;
            }
          } catch (uploadErr) {
            console.error(`[WorkOrderDetail] Upload error for ${attachment.id}:`, uploadErr);
            await ChecklistAttachmentRepository.update(attachment.id, {
              syncStatus: 'FAILED',
              lastUploadError: uploadErr instanceof Error ? uploadErr.message : 'Erro de upload',
            });
            failCount++;
          }
        }
      }

      // Atualizar estado
      await actions.refresh();

      // Verificar se ainda há pendentes
      const stillPendingAnswers = await ChecklistSyncService.countPendingSyncByWorkOrder(id);
      const stillPendingUploads = await ChecklistSyncService.countPendingUploadsByWorkOrder(id);

      if (stillPendingAnswers === 0 && stillPendingUploads === 0) {
        Alert.alert(t('common.success'), t('workOrders.detail.alerts.syncSuccess'));
      } else if (failCount > 0 || stillPendingAnswers > 0 || stillPendingUploads > 0) {
        const pendingMsg = [];
        if (stillPendingAnswers > 0) pendingMsg.push(`${stillPendingAnswers} resposta(s)`);
        if (stillPendingUploads > 0) pendingMsg.push(`${stillPendingUploads} anexo(s)`);
        Alert.alert(t('common.warning'), t('workOrders.detail.alerts.syncPartial', { pending: pendingMsg.join(', ') }));
      }
    } catch (err) {
      console.error('[WorkOrderDetail] Retry sync error:', err);
      Alert.alert(t('common.error'), t('workOrders.detail.alerts.syncFailed'));
    } finally {
      setIsSyncing(false);
    }
  }, [id, isSyncing, actions, t]);

  // Status config
  const statusConfig = workOrder ? STATUS_CONFIG[workOrder.status] : null;

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'info':
        return <InfoTab workOrder={workOrder} executionSummary={executionSummary} />;
      case 'checklists':
        return <ChecklistsTab workOrderId={id || ''} workOrderStatus={workOrder.status} />;
      case 'attachments':
        return <AttachmentsTab workOrderId={id || ''} workOrderStatus={workOrder.status} technicianId={user?.technicianId} />;
      case 'signature':
        return (
          <SignatureTab
            workOrderId={id || ''}
            workOrderStatus={workOrder.status}
            clientId={workOrder.clientId}
            clientName={workOrder.clientName}
          />
        );
      case 'history':
        return <HistoryTab />;
      default:
        return null;
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]}>
        <View style={styles.loadingContainer}>
          <Text variant="body" color="secondary">
            {t('common.loading')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error || !workOrder) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error[500]} />
          <Text variant="body" color="error" style={{ marginTop: spacing[2] }}>
            {error || t('workOrders.detail.alerts.workOrderNotFound')}
          </Text>
          <Button variant="ghost" onPress={() => router.back()} style={{ marginTop: spacing[4] }}>
            {t('common.back')}
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background.primary, borderBottomColor: colors.border.light }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text variant="h4" weight="semibold" numberOfLines={1} style={styles.headerTitle}>
            {workOrder.title}
          </Text>
          {statusConfig && (
            <Badge variant={statusConfig.color as any} size="sm">
              {statusConfig.label}
            </Badge>
          )}
        </View>
      </View>

      {/* Timer (quando em execução) */}
      <ExecutionTimerDisplay timer={timer} t={t} />

      {/* Tabs - ScrollView horizontal para caber em telas menores */}
      <View style={[styles.tabsContainer, { borderBottomColor: colors.border.light }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScrollContent}
        >
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tab,
                activeTab === tab.key && { borderBottomColor: colors.primary[500] },
              ]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Ionicons
                name={tab.icon as any}
                size={18}
                color={activeTab === tab.key ? colors.primary[500] : colors.text.tertiary}
              />
              <Text
                variant="caption"
                style={{
                  marginLeft: 4,
                  color: activeTab === tab.key ? colors.primary[500] : colors.text.tertiary,
                }}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Tab Content */}
      <View style={styles.tabContentContainer}>{renderTabContent()}</View>

      {/* Execution Controls */}
      <ExecutionControls
        status={workOrder.status}
        isExecuting={executionState?.isExecuting ?? false}
        isPaused={executionState?.isPaused ?? false}
        hasPendingSync={hasPendingSync}
        isSyncing={isSyncing}
        isSharing={isSharing}
        clientPhone={workOrder.clientPhone}
        totalValue={workOrder.totalValue}
        clientId={workOrder.clientId}
        clientName={workOrder.clientName}
        workOrderId={workOrder.id}
        workOrderTitle={workOrder.title}
        onStart={handleStart}
        onPause={handlePause}
        onResume={handleResume}
        onComplete={handleComplete}
        onReopen={handleReopen}
        onRetrySync={handleRetrySync}
        onShareWhatsApp={handleShareWhatsApp}
        onCreateCharge={handleCreateCharge}
        t={t}
      />

      {/* Pause Reason Modal */}
      <PauseReasonModal
        visible={pauseModalVisible}
        onClose={() => setPauseModalVisible(false)}
        onConfirm={handlePauseConfirm}
        t={t}
      />
    </SafeAreaView>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    flex: 1,
  },
  timerContainer: {
    padding: 16,
    alignItems: 'center',
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timerItem: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  timerDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E5E7EB',
  },
  pausedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  tabsContainer: {
    borderBottomWidth: 1,
  },
  tabsScrollContent: {
    flexDirection: 'row',
    paddingHorizontal: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabContentContainer: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
  },
  emptyTab: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoCard: {
    padding: 16,
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  executionSummary: {
    flexDirection: 'row',
    gap: 24,
  },
  summaryItem: {
    gap: 2,
  },
  controlsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  controlButton: {
    flex: 1,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: 8,
    marginTop: 12,
  },
  pendingSyncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '70%',
  },
  modalTitle: {
    marginBottom: 16,
    textAlign: 'center',
  },
  reasonsList: {
    marginBottom: 16,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    minHeight: 80,
    marginBottom: 16,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  checklistCard: {
    padding: 16,
  },
  checklistCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  reopenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  whatsappButton: {
    backgroundColor: '#25D366',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createChargeButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Estilos para aba de anexos
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoItem: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  photoThumbnail: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyAttachments: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  addPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    margin: 16,
    borderRadius: 12,
  },
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  imageModalFull: {
    width: '100%',
    height: '80%',
  },
  imageModalFooter: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  imageModalDelete: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Estilos para aba de assinatura
  signatureIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signatureImageContainer: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  signatureImage: {
    width: '100%',
    height: 150,
  },
  signatureInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
});
