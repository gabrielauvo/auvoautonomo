/**
 * Types for Work Order Execution Module
 */

import { ExecutionSession, WorkOrderStatus } from '../../../db/schema';

// =============================================================================
// EXECUTION STATE
// =============================================================================

export interface ExecutionState {
  /** Se a OS está em execução ativa */
  isExecuting: boolean;
  /** Se está pausada */
  isPaused: boolean;
  /** Sessão ativa atual (se houver) */
  activeSession: ExecutionSession | null;
  /** Tempo total trabalhado em segundos */
  totalWorkTime: number;
  /** Tempo total pausado em segundos */
  totalPauseTime: number;
  /** Tempo atual da sessão ativa (atualizado a cada segundo) */
  currentSessionTime: number;
  /** Motivo da pausa atual (se pausado) */
  pauseReason?: string;
}

// =============================================================================
// EXECUTION ACTIONS
// =============================================================================

export type ExecutionAction =
  | { type: 'START' }
  | { type: 'PAUSE'; reason?: string }
  | { type: 'RESUME' }
  | { type: 'COMPLETE' }
  | { type: 'CANCEL' };

export interface ExecutionActionResult {
  success: boolean;
  error?: string;
  newStatus?: WorkOrderStatus;
}

// =============================================================================
// PAUSE REASONS
// =============================================================================

export const PAUSE_REASONS = [
  { value: 'lunch', label: 'Almoço' },
  { value: 'break', label: 'Intervalo' },
  { value: 'waiting_parts', label: 'Aguardando peças' },
  { value: 'waiting_client', label: 'Aguardando cliente' },
  { value: 'weather', label: 'Condições climáticas' },
  { value: 'end_of_day', label: 'Fim do expediente' },
  { value: 'other', label: 'Outro' },
] as const;

export type PauseReasonValue = typeof PAUSE_REASONS[number]['value'];

// =============================================================================
// TIME DISPLAY
// =============================================================================

export interface TimeDisplay {
  hours: number;
  minutes: number;
  seconds: number;
  formatted: string; // HH:MM:SS
  shortFormatted: string; // HH:MM
}

/**
 * Formata segundos para exibição
 */
export function formatTime(totalSeconds: number): TimeDisplay {
  // Garantir que temos um número válido
  const safeSeconds = Number.isFinite(totalSeconds) && totalSeconds >= 0 ? Math.floor(totalSeconds) : 0;

  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');

  return {
    hours,
    minutes,
    seconds,
    formatted: `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`,
    shortFormatted: `${pad(hours)}:${pad(minutes)}`,
  };
}

// =============================================================================
// EXECUTION SUMMARY
// =============================================================================

export interface ExecutionSummary {
  /** Status atual da OS */
  status: WorkOrderStatus;
  /** Data/hora de início da primeira sessão de trabalho */
  firstStartedAt?: string;
  /** Data/hora de fim da última sessão de trabalho */
  lastEndedAt?: string;
  /** Tempo total trabalhado formatado */
  totalWorkTimeFormatted: string;
  /** Tempo total pausado formatado */
  totalPauseTimeFormatted: string;
  /** Número total de sessões */
  sessionCount: number;
  /** Número de pausas */
  pauseCount: number;
}
