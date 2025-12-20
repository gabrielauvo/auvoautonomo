// @ts-nocheck
/**
 * useChecklistExecution
 *
 * Hook para gerenciar a execução de um checklist.
 * - Carrega perguntas e respostas
 * - Auto-save com debounce
 * - Sync automático
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { ChecklistInstanceRepository } from '../repositories/ChecklistInstanceRepository';
import { ChecklistAnswerRepository } from '../repositories/ChecklistAnswerRepository';
import { ChecklistSyncService } from '../services/ChecklistSyncService';
import {
  ChecklistInstance,
  ChecklistAnswer,
  ChecklistQuestion,
  ChecklistSection,
} from '../../../db/schema';

// =============================================================================
// TYPES
// =============================================================================

export interface ChecklistExecutionState {
  instance: ChecklistInstance | null;
  questions: ChecklistQuestion[];
  sections: ChecklistSection[];
  answers: Map<string, ChecklistAnswer>;
  isLoading: boolean;
  isSaving: boolean;
  isSyncing: boolean;
  error: string | null;
  progress: number;
  totalQuestions: number;
  answeredQuestions: number;
}

export interface ChecklistExecutionActions {
  loadChecklist: () => Promise<void>;
  saveAnswer: (questionId: string, value: any) => Promise<void>;
  syncAnswers: () => Promise<void>;
  completeChecklist: () => Promise<{ success: boolean; error?: string }>;
  refresh: () => Promise<void>;
}

export interface UseChecklistExecutionReturn {
  state: ChecklistExecutionState;
  actions: ChecklistExecutionActions;
}

interface UseChecklistExecutionOptions {
  autoSync?: boolean;
  syncInterval?: number;
  debounceMs?: number;
}

// =============================================================================
// HOOK
// =============================================================================

export function useChecklistExecution(
  instanceId: string,
  technicianId: string,
  options: UseChecklistExecutionOptions = {}
): UseChecklistExecutionReturn {
  const { autoSync = true, syncInterval = 30000, debounceMs = 2000 } = options;

  // State
  const [instance, setInstance] = useState<ChecklistInstance | null>(null);
  const [questions, setQuestions] = useState<ChecklistQuestion[]>([]);
  const [sections, setSections] = useState<ChecklistSection[]>([]);
  const [answers, setAnswers] = useState<Map<string, ChecklistAnswer>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSavesRef = useRef<Map<string, any>>(new Map());

  // =============================================================================
  // COMPUTED VALUES
  // =============================================================================

  const totalQuestions = questions.length;
  const answeredQuestions = answers.size;
  const progress = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;

  // =============================================================================
  // LOAD CHECKLIST
  // =============================================================================

  const loadChecklist = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Configurar service
      ChecklistSyncService.configure(technicianId);

      // Buscar do servidor (ou cache local se offline)
      const result = await ChecklistSyncService.pullChecklistFull(instanceId);

      if (!result.instance) {
        throw new Error('Checklist não encontrado');
      }

      setInstance(result.instance);

      // Parsear snapshot para obter perguntas e seções
      console.log('[useChecklistExecution] result.snapshot:', result.snapshot ? 'present' : 'absent');
      console.log('[useChecklistExecution] result.instance.templateVersionSnapshot:', result.instance.templateVersionSnapshot ? 'present' : 'absent');

      if (result.snapshot) {
        const snapshot = typeof result.snapshot === 'string'
          ? JSON.parse(result.snapshot)
          : result.snapshot;

        console.log('[useChecklistExecution] Parsed snapshot from result.snapshot:', {
          questionsCount: snapshot.questions?.length || 0,
          sectionsCount: snapshot.sections?.length || 0,
        });
        setQuestions(snapshot.questions || []);
        setSections(snapshot.sections || []);
      } else if (result.instance.templateVersionSnapshot) {
        console.log('[useChecklistExecution] Raw templateVersionSnapshot:', result.instance.templateVersionSnapshot.substring(0, 200));
        const snapshot = JSON.parse(result.instance.templateVersionSnapshot);
        console.log('[useChecklistExecution] Parsed snapshot from instance:', {
          questionsCount: snapshot.questions?.length || 0,
          sectionsCount: snapshot.sections?.length || 0,
          keys: Object.keys(snapshot),
        });
        setQuestions(snapshot.questions || []);
        setSections(snapshot.sections || []);
      } else {
        console.warn('[useChecklistExecution] NO SNAPSHOT AVAILABLE! Questions will be empty.');
      }

      // Carregar respostas
      const answersMap = new Map<string, ChecklistAnswer>();
      const localAnswers = await ChecklistAnswerRepository.getByInstance(instanceId);

      for (const answer of localAnswers) {
        answersMap.set(answer.questionId, answer);
      }

      // Merge com respostas do servidor
      if (result.answers) {
        for (const answer of result.answers) {
          if (!answersMap.has(answer.questionId)) {
            answersMap.set(answer.questionId, answer);
          }
        }
      }

      setAnswers(answersMap);

      // Atualizar status se ainda estiver PENDING
      if (result.instance.status === 'PENDING') {
        await ChecklistInstanceRepository.updateStatus(instanceId, 'IN_PROGRESS');
        await ChecklistSyncService.updateInstanceStatus(instanceId, 'IN_PROGRESS');
        setInstance((prev) => prev ? { ...prev, status: 'IN_PROGRESS' } : prev);
      }
    } catch (err) {
      console.error('[useChecklistExecution] loadChecklist error:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar checklist');
    } finally {
      setIsLoading(false);
    }
  }, [instanceId, technicianId]);

  // =============================================================================
  // SAVE ANSWER
  // =============================================================================

  const saveAnswerImmediate = useCallback(
    async (questionId: string, value: any) => {
      const question = questions.find((q) => q.id === questionId);
      if (!question) return;

      try {
        // Preparar dados da resposta
        const answerData: Partial<ChecklistAnswer> = {
          instanceId,
          questionId,
          questionType: question.type,
        };

        // Definir valor baseado no tipo
        switch (question.type) {
          case 'TEXT_SHORT':
          case 'TEXT_LONG':
            answerData.valueText = value;
            break;
          case 'NUMBER':
          case 'RATING':
          case 'SCALE':
            answerData.valueNumber = value;
            break;
          case 'CHECKBOX':
            answerData.valueBoolean = value ? 1 : 0;
            break;
          case 'DATE':
          case 'TIME':
          case 'DATETIME':
            answerData.valueDate = value;
            break;
          case 'SELECT':
          case 'MULTI_SELECT':
          case 'PHOTO':
          case 'SIGNATURE':
            answerData.valueJson = JSON.stringify(value);
            break;
          default:
            answerData.valueText = String(value);
        }

        // Verificar se já existe resposta
        const existing = answers.get(questionId);

        let savedAnswer: ChecklistAnswer;
        if (existing) {
          savedAnswer = await ChecklistAnswerRepository.update(existing.id, answerData);
        } else {
          savedAnswer = await ChecklistAnswerRepository.create(answerData as any);
        }

        // Atualizar state
        setAnswers((prev) => {
          const next = new Map(prev);
          next.set(questionId, savedAnswer);
          return next;
        });

        // Atualizar progresso
        const newProgress = Math.round(((answers.size + (existing ? 0 : 1)) / totalQuestions) * 100);
        await ChecklistInstanceRepository.updateProgress(instanceId, newProgress);
      } catch (err) {
        console.error('[useChecklistExecution] saveAnswer error:', err);
        throw err;
      }
    },
    [instanceId, questions, answers, totalQuestions]
  );

  const saveAnswer = useCallback(
    async (questionId: string, value: any) => {
      // Adicionar à fila de saves pendentes
      pendingSavesRef.current.set(questionId, value);

      // Cancelar timeout anterior
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Debounce save
      saveTimeoutRef.current = setTimeout(async () => {
        setIsSaving(true);
        try {
          // Processar todos os saves pendentes
          const pending = new Map(pendingSavesRef.current);
          pendingSavesRef.current.clear();

          for (const [qId, val] of pending) {
            await saveAnswerImmediate(qId, val);
          }
        } finally {
          setIsSaving(false);
        }
      }, debounceMs);
    },
    [saveAnswerImmediate, debounceMs]
  );

  // =============================================================================
  // SYNC ANSWERS
  // =============================================================================

  const syncAnswers = useCallback(async () => {
    if (isSyncing) return;

    setIsSyncing(true);
    try {
      // Processar saves pendentes primeiro
      if (pendingSavesRef.current.size > 0) {
        const pending = new Map(pendingSavesRef.current);
        pendingSavesRef.current.clear();
        for (const [qId, val] of pending) {
          await saveAnswerImmediate(qId, val);
        }
      }

      // Sincronizar com servidor
      const result = await ChecklistSyncService.pushPendingAnswers(instanceId);

      if (!result.success && result.errors.length > 0) {
        console.warn('[useChecklistExecution] Sync errors:', result.errors);
      }
    } catch (err) {
      console.error('[useChecklistExecution] syncAnswers error:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [instanceId, isSyncing, saveAnswerImmediate]);

  // =============================================================================
  // COMPLETE CHECKLIST
  // =============================================================================

  const completeChecklist = useCallback(async () => {
    // Forçar save de pendentes
    if (pendingSavesRef.current.size > 0) {
      const pending = new Map(pendingSavesRef.current);
      pendingSavesRef.current.clear();
      for (const [qId, val] of pending) {
        await saveAnswerImmediate(qId, val);
      }
    }

    // Tentar completar
    const result = await ChecklistSyncService.completeChecklist(instanceId);

    if (result.success) {
      setInstance((prev) => (prev ? { ...prev, status: 'COMPLETED', progress: 100 } : prev));
    }

    return result;
  }, [instanceId, saveAnswerImmediate]);

  // =============================================================================
  // REFRESH
  // =============================================================================

  const refresh = useCallback(async () => {
    // Sync primeiro
    await syncAnswers();
    // Depois reload
    await loadChecklist();
  }, [syncAnswers, loadChecklist]);

  // =============================================================================
  // EFFECTS
  // =============================================================================

  // Carregar ao montar
  useEffect(() => {
    loadChecklist();
  }, [loadChecklist]);

  // Auto-sync
  useEffect(() => {
    if (!autoSync) return;

    syncIntervalRef.current = setInterval(() => {
      syncAnswers();
    }, syncInterval);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [autoSync, syncInterval, syncAnswers]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, []);

  // =============================================================================
  // RETURN
  // =============================================================================

  return {
    state: {
      instance,
      questions,
      sections,
      answers,
      isLoading,
      isSaving,
      isSyncing,
      error,
      progress,
      totalQuestions,
      answeredQuestions,
    },
    actions: {
      loadChecklist,
      saveAnswer,
      syncAnswers,
      completeChecklist,
      refresh,
    },
  };
}

export default useChecklistExecution;
