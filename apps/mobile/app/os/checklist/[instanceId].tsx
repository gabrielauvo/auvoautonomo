// @ts-nocheck
/**
 * Checklist Execution Screen
 *
 * Tela de execução de um checklist com suporte a 500+ perguntas.
 * - Renderização virtualizada
 * - Auto-save com debounce
 * - Sync incremental
 * - Captura de fotos e assinaturas
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, StyleSheet, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Text, Button } from '../../../src/design-system';
import { useColors, useSpacing } from '../../../src/design-system/ThemeProvider';
import {
  VirtualizedChecklistRenderer,
  ChecklistQuestion,
  ChecklistSection,
  AnswerValue,
} from '../../../src/modules/checklists/components/VirtualizedChecklistRenderer';
import { ChecklistInstanceRepository } from '../../../src/modules/checklists/repositories/ChecklistInstanceRepository';
import { ChecklistAnswerRepository } from '../../../src/modules/checklists/repositories/ChecklistAnswerRepository';
import { ChecklistAttachmentRepository } from '../../../src/modules/checklists/repositories/ChecklistAttachmentRepository';
import { ChecklistSyncService } from '../../../src/modules/checklists/services/ChecklistSyncService';
import { AttachmentUploadService } from '../../../src/modules/checklists/services/AttachmentUploadService';
import { ChecklistInstance, ChecklistAnswer } from '../../../src/db/schema';

// =============================================================================
// TYPES
// =============================================================================

interface ChecklistSnapshot {
  id: string;
  name: string;
  description?: string;
  sections: ChecklistSection[];
  questions: ChecklistQuestion[];
}

// =============================================================================
// HEADER
// =============================================================================

const ChecklistHeader = React.memo(function ChecklistHeader({
  title,
  progress,
  onBack,
  onSync,
  isSyncing,
  hasPending,
}: {
  title: string;
  progress: number;
  onBack: () => void;
  onSync: () => void;
  isSyncing: boolean;
  hasPending: boolean;
}) {
  const colors = useColors();
  const spacing = useSpacing();

  return (
    <View style={[styles.header, { backgroundColor: colors.background.primary, borderBottomColor: colors.border.light }]}>
      <View style={styles.headerRow}>
        {/* Back button */}
        <Button variant="ghost" size="sm" onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </Button>

        {/* Title */}
        <View style={styles.headerTitle}>
          <Text variant="body" weight="semibold" numberOfLines={1}>
            {title}
          </Text>
          <Text variant="caption" color="secondary">
            {progress}% completo
          </Text>
        </View>

        {/* Sync button */}
        <Button
          variant="ghost"
          size="sm"
          onPress={onSync}
          disabled={isSyncing}
        >
          <Ionicons
            name={isSyncing ? 'sync' : hasPending ? 'cloud-upload-outline' : 'cloud-done-outline'}
            size={22}
            color={hasPending ? colors.warning[500] : colors.success[500]}
          />
        </Button>
      </View>

      {/* Progress bar */}
      <View style={[styles.progressBar, { backgroundColor: colors.border.light }]}>
        <View
          style={[
            styles.progressFill,
            {
              backgroundColor: colors.primary[500],
              width: `${progress}%`,
            },
          ]}
        />
      </View>
    </View>
  );
});

// =============================================================================
// FOOTER
// =============================================================================

const ChecklistFooter = React.memo(function ChecklistFooter({
  onSave,
  onComplete,
  isComplete,
  isSaving,
}: {
  onSave: () => void;
  onComplete: () => void;
  isComplete: boolean;
  isSaving: boolean;
}) {
  const colors = useColors();
  const spacing = useSpacing();

  return (
    <View style={[styles.footer, { backgroundColor: colors.background.primary, borderTopColor: colors.border.light }]}>
      <Button
        variant="outline"
        size="lg"
        style={{ flex: 1 }}
        onPress={onSave}
        disabled={isSaving}
      >
        Salvar Progresso
      </Button>
      <Button
        variant="primary"
        size="lg"
        style={{ flex: 1 }}
        onPress={onComplete}
        disabled={!isComplete || isSaving}
      >
        Finalizar Checklist
      </Button>
    </View>
  );
});

// =============================================================================
// MAIN SCREEN
// =============================================================================

export default function ChecklistExecutionScreen() {
  const { instanceId } = useLocalSearchParams<{ instanceId: string }>();
  const colors = useColors();
  const spacing = useSpacing();

  // State
  const [instance, setInstance] = useState<ChecklistInstance | null>(null);
  const [snapshot, setSnapshot] = useState<ChecklistSnapshot | null>(null);
  const [answers, setAnswers] = useState<Map<string, ChecklistAnswer>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasPendingSync, setHasPendingSync] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs para debounce
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAnswersRef = useRef<Map<string, AnswerValue>>(new Map());
  // Store pending photo attachments (base64) per questionId
  const pendingAttachmentsRef = useRef<Map<string, Array<{ data: string; fileName: string; type: string }>>>(new Map());

  // ===========================================================================
  // LOAD DATA
  // ===========================================================================

  const loadData = useCallback(async () => {
    if (!instanceId) return;

    console.log('[ChecklistExecutionScreen] loadData called for:', instanceId);

    try {
      setIsLoading(true);
      setError(null);

      // Sempre buscar do servidor primeiro (dados mais atualizados)
      console.log('[ChecklistExecutionScreen] Fetching from server...');
      const result = await ChecklistSyncService.pullChecklistFull(instanceId);
      console.log('[ChecklistExecutionScreen] Server result:', result.success, 'has instance:', !!result.instance);

      if (result.success && result.instance) {
        setInstance(result.instance);

        // Parsear snapshot
        if (result.snapshot) {
          console.log('[ChecklistExecutionScreen] Parsing snapshot from server result');
          const snap = typeof result.snapshot === 'string'
            ? JSON.parse(result.snapshot)
            : result.snapshot;
          setSnapshot(snap);
        } else if (result.instance.templateVersionSnapshot) {
          console.log('[ChecklistExecutionScreen] Parsing snapshot from instance');
          try {
            const snap = typeof result.instance.templateVersionSnapshot === 'string'
              ? JSON.parse(result.instance.templateVersionSnapshot)
              : result.instance.templateVersionSnapshot;
            setSnapshot(snap);
          } catch (e) {
            console.error('[ChecklistExecutionScreen] Error parsing snapshot:', e);
          }
        }

        // Usar respostas do resultado do servidor
        if (result.answers && result.answers.length > 0) {
          console.log('[ChecklistExecutionScreen] Using answers from server:', result.answers.length);
          const answersMap = new Map(result.answers.map((a) => [a.questionId, a]));
          setAnswers(answersMap);
        } else {
          // Tentar carregar respostas locais (podem existir respostas pendentes)
          try {
            const localAnswers = await ChecklistAnswerRepository.getByInstance(instanceId);
            console.log('[ChecklistExecutionScreen] Local answers found:', localAnswers.length);
            if (localAnswers.length > 0) {
              const answersMap = new Map(localAnswers.map((a) => [a.questionId, a]));
              setAnswers(answersMap);
            }
          } catch (dbError) {
            console.warn('[ChecklistExecutionScreen] Could not load local answers:', dbError);
          }
        }

        // Verificar pendentes
        try {
          const pendingCount = await ChecklistSyncService.countPendingSync(instanceId);
          setHasPendingSync(pendingCount > 0);
        } catch (e) {
          // Ignorar erro ao verificar pendentes
        }
      } else {
        // Fallback: tentar carregar do banco local
        console.log('[ChecklistExecutionScreen] Server failed, trying local...');
        try {
          const inst = await ChecklistInstanceRepository.getById(instanceId);
          if (inst) {
            setInstance(inst);
            if (inst.templateVersionSnapshot) {
              const snap = typeof inst.templateVersionSnapshot === 'string'
                ? JSON.parse(inst.templateVersionSnapshot)
                : inst.templateVersionSnapshot;
              setSnapshot(snap);
            }
            const localAnswers = await ChecklistAnswerRepository.getByInstance(instanceId);
            const answersMap = new Map(localAnswers.map((a) => [a.questionId, a]));
            setAnswers(answersMap);
          } else {
            setError(result.error || 'Checklist nao encontrado');
          }
        } catch (dbError) {
          console.error('[ChecklistExecutionScreen] Local DB error:', dbError);
          setError(result.error || 'Checklist nao encontrado');
        }
      }
    } catch (err) {
      console.error('[ChecklistExecutionScreen] loadData error:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar checklist');
    } finally {
      setIsLoading(false);
    }
  }, [instanceId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ===========================================================================
  // ANSWER HANDLING
  // ===========================================================================

  const handleAnswerChange = useCallback(
    async (questionId: string, value: AnswerValue) => {
      if (!instanceId) return;

      // Atualizar estado local imediatamente
      setAnswers((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(questionId);
        const now = new Date().toISOString();

        const updatedAnswer: ChecklistAnswer = {
          id: existing?.id || `local-${questionId}-${Date.now()}`,
          instanceId,
          questionId,
          questionType: snapshot?.questions.find((q) => q.id === questionId)?.type || 'TEXT_SHORT',
          valueText: value.valueText,
          valueNumber: value.valueNumber,
          valueBoolean: value.valueBoolean !== undefined ? (value.valueBoolean ? 1 : 0) : undefined,
          valueDate: value.valueDate,
          valueJson: value.valueJson ? JSON.stringify(value.valueJson) : undefined,
          answeredAt: now,
          localId: existing?.localId || `local-${questionId}`,
          syncStatus: 'PENDING',
          createdAt: existing?.createdAt || now,
          updatedAt: now,
        };

        newMap.set(questionId, updatedAnswer);
        return newMap;
      });

      // Adicionar aos pendentes para salvar
      pendingAnswersRef.current.set(questionId, value);
      setHasPendingSync(true);

      // Debounce save (2 segundos)
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        savePendingAnswers();
      }, 2000);
    },
    [instanceId, snapshot]
  );

  // Salvar respostas pendentes - envia direto para API quando online
  // Não salva no banco local para evitar FK errors (instância não existe localmente)
  const savePendingAnswers = useCallback(async () => {
    if (pendingAnswersRef.current.size === 0 || !instanceId) return;

    const toSave = new Map(pendingAnswersRef.current);
    pendingAnswersRef.current.clear();

    // Capturar attachments pendentes também
    const attachmentsToSave = new Map(pendingAttachmentsRef.current);
    pendingAttachmentsRef.current.clear();

    console.log('[ChecklistExecutionScreen] savePendingAnswers - saving', toSave.size, 'answers with', attachmentsToSave.size, 'questions with attachments');

    try {
      // Verificar se está online para enviar direto para API
      const isOnline = ChecklistSyncService.isOnline();
      console.log('[ChecklistExecutionScreen] savePendingAnswers - isOnline:', isOnline);

      if (isOnline) {
        // Preparar payload para API
        const answersPayload = Array.from(toSave.entries()).map(([questionId, value]) => {
          const question = snapshot?.questions.find((q) => q.id === questionId);
          const attachments = attachmentsToSave.get(questionId) || [];
          return {
            questionId,
            type: question?.type || 'TEXT_SHORT',
            valueText: value.valueText || undefined,
            valueNumber: value.valueNumber || undefined,
            valueBoolean: value.valueBoolean,
            valueDate: value.valueDate || undefined,
            valueJson: value.valueJson || undefined,
            localId: `local-${questionId}-${Date.now()}`,
            deviceInfo: `Auvo Mobile (${new Date().toISOString()})`,
            // Include base64 attachments inline
            attachments: attachments.length > 0 ? attachments : undefined,
          };
        });

        // Enviar direto para API via sync endpoint
        const engine = require('../../../src/sync').syncEngine as any;
        const baseUrl = engine.baseUrl;
        const authToken = engine.authToken;

        if (baseUrl && authToken) {
          const url = `${baseUrl}/checklist-instances/sync`;
          console.log('[ChecklistExecutionScreen] Sending answers to:', url, 'with attachments:', answersPayload.filter(a => a.attachments).length);

          const response = await fetch(url, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${authToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              instanceId,
              answers: answersPayload,
              deviceInfo: 'Auvo Mobile',
            }),
          });

          if (response.ok) {
            const result = await response.json();
            console.log('[ChecklistExecutionScreen] Sync result:', result);
            setHasPendingSync(false);
          } else {
            console.warn('[ChecklistExecutionScreen] Sync failed:', response.status);
            // Re-adicionar para tentar novamente
            for (const [qId, val] of toSave) {
              pendingAnswersRef.current.set(qId, val);
            }
            // Re-adicionar attachments também
            for (const [qId, atts] of attachmentsToSave) {
              pendingAttachmentsRef.current.set(qId, atts);
            }
            setHasPendingSync(true);
          }
        }
      } else {
        // Offline - tentar salvar localmente (pode falhar por FK)
        console.log('[ChecklistExecutionScreen] Offline - trying local save');
        try {
          for (const [questionId, value] of toSave) {
            const question = snapshot?.questions.find((q) => q.id === questionId);

            await ChecklistAnswerRepository.upsert(instanceId, questionId, question?.type || 'TEXT_SHORT', {
              valueText: value.valueText,
              valueNumber: value.valueNumber,
              valueBoolean: value.valueBoolean !== undefined ? (value.valueBoolean ? 1 : 0) : undefined,
              valueDate: value.valueDate,
              valueJson: value.valueJson ? JSON.stringify(value.valueJson) : undefined,
            });
          }
        } catch (dbErr) {
          console.warn('[ChecklistExecutionScreen] Local DB save failed (FK expected):', dbErr);
          // Manter respostas na memória para tentar sync quando online
          for (const [qId, val] of toSave) {
            pendingAnswersRef.current.set(qId, val);
          }
        }
        // Re-adicionar attachments para sync quando online
        for (const [qId, atts] of attachmentsToSave) {
          pendingAttachmentsRef.current.set(qId, atts);
        }
        setHasPendingSync(true);
      }
    } catch (err) {
      console.error('[ChecklistExecutionScreen] savePendingAnswers error:', err);
      // Re-adicionar para tentar novamente
      for (const [qId, val] of toSave) {
        pendingAnswersRef.current.set(qId, val);
      }
      // Re-adicionar attachments também
      for (const [qId, atts] of attachmentsToSave) {
        pendingAttachmentsRef.current.set(qId, atts);
      }
      setHasPendingSync(true);
    }
  }, [instanceId, snapshot, answers]);

  // ===========================================================================
  // PHOTO CAPTURE
  // ===========================================================================

  const handlePhotoCapture = useCallback(
    async (questionId: string) => {
      try {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permissao necessaria', 'Precisamos de acesso a camera para tirar fotos.');
          return;
        }

        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
          base64: true, // Habilitar base64 para upload
        });

        if (!result.canceled && result.assets[0]) {
          const photoUri = result.assets[0].uri;
          const base64Data = result.assets[0].base64;

          // Atualizar resposta com foto local primeiro (feedback imediato)
          const existingAnswer = answers.get(questionId);
          const existingPhotos = existingAnswer?.valueJson
            ? JSON.parse(existingAnswer.valueJson)
            : [];
          const newPhotos = [...existingPhotos, photoUri];
          handleAnswerChange(questionId, { valueJson: newPhotos });

          // Armazenar base64 para enviar junto com o sync
          if (base64Data) {
            const fileName = `photo_${Date.now()}.jpg`;
            const existingAttachments = pendingAttachmentsRef.current.get(questionId) || [];
            existingAttachments.push({
              data: `data:image/jpeg;base64,${base64Data}`,
              fileName,
              type: 'PHOTO',
            });
            pendingAttachmentsRef.current.set(questionId, existingAttachments);
            console.log('[ChecklistExecutionScreen] Photo queued for sync:', questionId, fileName);

            // Também salvar no banco local para garantir persistência offline
            // Se não temos uma resposta ainda, usamos answerId = questionId (sem FK constraint)
            // O ChecklistSyncService busca por answerId OU questionId na hora do sync
            try {
              const engine = require('../../../src/sync').syncEngine as any;
              // Usar o ID da resposta se existir, senão usar questionId como answerId
              // A tabela permite answerId que não existe em checklist_answers (FK é opcional)
              const answerId = existingAnswer?.id || questionId;
              await ChecklistAttachmentRepository.create({
                answerId,
                workOrderId: instance?.workOrderId || '',
                type: 'PHOTO',
                fileName,
                fileSize: Math.round(base64Data.length * 0.75), // Aproximação do tamanho decodificado
                mimeType: 'image/jpeg',
                localPath: photoUri,
                base64Data: `data:image/jpeg;base64,${base64Data}`,
                technicianId: engine.technicianId || '',
              });
              console.log('[ChecklistExecutionScreen] Photo saved to local DB for offline sync, answerId:', answerId);
            } catch (dbErr) {
              console.error('[ChecklistExecutionScreen] Failed to save photo to DB:', dbErr);
            }
          }
        }
      } catch (err) {
        console.error('[ChecklistExecutionScreen] Photo capture error:', err);
        Alert.alert('Erro', 'Nao foi possivel capturar a foto');
      }
    },
    [answers, handleAnswerChange]
  );

  // ===========================================================================
  // SIGNATURE CAPTURE
  // ===========================================================================

  const handleSignatureCapture = useCallback(
    (questionId: string) => {
      // TODO: Implementar modal de assinatura
      Alert.alert('Em desenvolvimento', 'Captura de assinatura sera implementada em breve.');
    },
    []
  );

  // ===========================================================================
  // SYNC
  // ===========================================================================

  const handleSync = useCallback(async () => {
    if (!instanceId || isSyncing) return;

    try {
      setIsSyncing(true);

      // Salvar pendentes primeiro (envia para API automaticamente quando online)
      await savePendingAnswers();

      // Se ainda há pendentes na memória, significa que estamos offline
      if (pendingAnswersRef.current.size > 0) {
        Alert.alert('Aviso', 'Você está offline. As respostas serão sincronizadas quando houver conexão.');
      } else {
        setHasPendingSync(false);
      }
    } catch (err) {
      console.error('[ChecklistExecutionScreen] Sync error:', err);
      Alert.alert('Erro', 'Não foi possível sincronizar');
    } finally {
      setIsSyncing(false);
    }
  }, [instanceId, isSyncing, savePendingAnswers]);

  // ===========================================================================
  // COMPLETE
  // ===========================================================================

  const handleComplete = useCallback(async () => {
    if (!instanceId) return;

    Alert.alert(
      'Finalizar Checklist',
      'Tem certeza que deseja finalizar este checklist? Nao sera possivel editar depois.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Finalizar',
          onPress: async () => {
            try {
              setIsSaving(true);

              // Salvar e sincronizar pendentes
              await savePendingAnswers();
              await handleSync();

              // Completar checklist
              const result = await ChecklistSyncService.completeChecklist(instanceId);

              if (result.success) {
                Alert.alert('Sucesso', 'Checklist finalizado com sucesso!', [
                  { text: 'OK', onPress: () => router.back() },
                ]);
              } else {
                Alert.alert(
                  'Erro',
                  result.error || 'Nao foi possivel finalizar o checklist',
                  result.missingQuestions
                    ? [
                        {
                          text: 'OK',
                          onPress: () => {
                            // TODO: Scroll para primeira pergunta faltando
                          },
                        },
                      ]
                    : undefined
                );
              }
            } catch (err) {
              console.error('[ChecklistExecutionScreen] Complete error:', err);
              Alert.alert('Erro', 'Nao foi possivel finalizar o checklist');
            } finally {
              setIsSaving(false);
            }
          },
        },
      ]
    );
  }, [instanceId, savePendingAnswers, handleSync]);

  // ===========================================================================
  // COMPUTED VALUES
  // ===========================================================================

  const progress = useMemo(() => {
    if (!snapshot) return 0;
    const answerableQuestions = snapshot.questions.filter((q) => q.type !== 'SECTION_TITLE');
    if (answerableQuestions.length === 0) return 100;
    return Math.round((answers.size / answerableQuestions.length) * 100);
  }, [snapshot, answers]);

  const isComplete = useMemo(() => {
    if (!snapshot) return false;
    const requiredQuestions = snapshot.questions.filter(
      (q) => q.type !== 'SECTION_TITLE' && q.isRequired
    );
    return requiredQuestions.every((q) => answers.has(q.id));
  }, [snapshot, answers]);

  // ===========================================================================
  // RENDER
  // ===========================================================================

  // Loading
  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]}>
        <View style={styles.centered}>
          <Text variant="body" color="secondary">
            Carregando checklist...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error
  if (error || !instance || !snapshot) {
    // Provide more helpful error message for offline case
    let errorMessage = error || 'Checklist nao encontrado';
    let errorIcon: 'alert-circle-outline' | 'cloud-offline-outline' = 'alert-circle-outline';

    if (instance && !snapshot) {
      // Instance exists but snapshot is missing - likely offline without prior load
      errorMessage = 'Checklist nao disponivel offline. Conecte-se a internet para carregar o conteudo do checklist.';
      errorIcon = 'cloud-offline-outline';
    }

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]}>
        <View style={styles.centered}>
          <Ionicons name={errorIcon} size={48} color={colors.error[500]} />
          <Text variant="body" color="error" style={{ marginTop: spacing[2], textAlign: 'center', paddingHorizontal: spacing[4] }}>
            {errorMessage}
          </Text>
          <Button variant="ghost" onPress={() => router.back()} style={{ marginTop: spacing[4] }}>
            Voltar
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]} edges={['top']}>
      {/* Header */}
      <ChecklistHeader
        title={snapshot.name || 'Checklist'}
        progress={progress}
        onBack={() => {
          // Salvar antes de sair
          savePendingAnswers().then(() => router.back());
        }}
        onSync={handleSync}
        isSyncing={isSyncing}
        hasPending={hasPendingSync}
      />

      {/* Checklist */}
      <VirtualizedChecklistRenderer
        questions={snapshot.questions}
        sections={snapshot.sections || []}
        answers={answers}
        onAnswerChange={handleAnswerChange}
        onPhotoCapture={handlePhotoCapture}
        onSignatureCapture={handleSignatureCapture}
        readOnly={instance.status === 'COMPLETED'}
      />

      {/* Footer */}
      {instance.status !== 'COMPLETED' && (
        <ChecklistFooter
          onSave={savePendingAnswers}
          onComplete={handleComplete}
          isComplete={isComplete}
          isSaving={isSaving}
        />
      )}
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  header: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 0,
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    marginHorizontal: 8,
  },
  progressBar: {
    height: 4,
    marginTop: 8,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
  },
});
