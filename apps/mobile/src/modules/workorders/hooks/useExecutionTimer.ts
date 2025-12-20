// @ts-nocheck
/**
 * useExecutionTimer Hook
 *
 * Hook para gerenciar o timer de execução de uma OS.
 * - Atualiza a cada segundo quando em execução
 * - Pausa automaticamente quando a OS está pausada
 * - Calcula tempo total trabalhado + sessão atual
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { ExecutionState, formatTime, TimeDisplay } from '../execution';

// =============================================================================
// TYPES
// =============================================================================

export interface UseExecutionTimerReturn {
  /** Tempo da sessão atual em segundos */
  currentSessionSeconds: number;
  /** Tempo total trabalhado em segundos (incluindo sessão atual) */
  totalWorkSeconds: number;
  /** Tempo total de pausa em segundos (incluindo pausa atual se pausado) */
  totalPauseSeconds: number;
  /** Tempo da sessão atual formatado */
  currentSession: TimeDisplay;
  /** Tempo total trabalhado formatado */
  totalWork: TimeDisplay;
  /** Tempo total de pausa formatado */
  totalPause: TimeDisplay;
  /** Se o timer está rodando */
  isRunning: boolean;
  /** Se está pausado */
  isPaused: boolean;
}

export interface UseExecutionTimerOptions {
  /** Intervalo de atualização em ms (default: 1000) */
  updateInterval?: number;
  /** Se deve pausar quando o app vai para background */
  pauseOnBackground?: boolean;
}

// =============================================================================
// HOOK
// =============================================================================

export function useExecutionTimer(
  executionState: ExecutionState | null,
  options: UseExecutionTimerOptions = {}
): UseExecutionTimerReturn {
  const { updateInterval = 1000, pauseOnBackground = false } = options;

  const [tick, setTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>('active');

  // ===========================================================================
  // COMPUTED VALUES
  // ===========================================================================

  const isRunning = executionState?.isExecuting ?? false;
  const isPaused = executionState?.isPaused ?? false;

  // Calcular tempo da sessão atual
  const currentSessionSeconds = useMemo(() => {
    if (!executionState?.activeSession?.startedAt) {
      return 0;
    }
    const startTime = new Date(executionState.activeSession.startedAt).getTime();
    return Math.floor((Date.now() - startTime) / 1000);
  }, [executionState?.activeSession?.startedAt, tick]);

  // Calcular tempo total trabalhado (base + sessão atual se trabalhando)
  const totalWorkSeconds = useMemo(() => {
    const base = executionState?.totalWorkTime ?? 0;
    if (isRunning) {
      return base + currentSessionSeconds;
    }
    return base;
  }, [executionState?.totalWorkTime, isRunning, currentSessionSeconds]);

  // Calcular tempo total de pausa (base + sessão atual se pausado)
  const totalPauseSeconds = useMemo(() => {
    const base = executionState?.totalPauseTime ?? 0;
    if (isPaused) {
      return base + currentSessionSeconds;
    }
    return base;
  }, [executionState?.totalPauseTime, isPaused, currentSessionSeconds]);

  // Formatar tempos
  const currentSession = useMemo(() => formatTime(currentSessionSeconds), [currentSessionSeconds]);
  const totalWork = useMemo(() => formatTime(totalWorkSeconds), [totalWorkSeconds]);
  const totalPause = useMemo(() => formatTime(totalPauseSeconds), [totalPauseSeconds]);

  // ===========================================================================
  // TIMER CONTROL
  // ===========================================================================

  const startTimer = useCallback(() => {
    if (intervalRef.current) return;

    intervalRef.current = setInterval(() => {
      setTick((t) => t + 1);
    }, updateInterval);
  }, [updateInterval]);

  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // ===========================================================================
  // EFFECTS
  // ===========================================================================

  // Iniciar/parar timer baseado no estado de execução
  useEffect(() => {
    if (isRunning || isPaused) {
      startTimer();
    } else {
      stopTimer();
    }

    return () => {
      stopTimer();
    };
  }, [isRunning, isPaused, startTimer, stopTimer]);

  // Gerenciar estado do app (foreground/background)
  useEffect(() => {
    if (!pauseOnBackground) return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appStateRef.current === 'active' && nextAppState.match(/inactive|background/)) {
        // App foi para background
        stopTimer();
      } else if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        // App voltou para foreground
        if (isRunning || isPaused) {
          setTick((t) => t + 1); // Force update do tempo
          startTimer();
        }
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [pauseOnBackground, isRunning, isPaused, startTimer, stopTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer();
    };
  }, [stopTimer]);

  // ===========================================================================
  // RETURN
  // ===========================================================================

  return {
    currentSessionSeconds,
    totalWorkSeconds,
    totalPauseSeconds,
    currentSession,
    totalWork,
    totalPause,
    isRunning,
    isPaused,
  };
}

export default useExecutionTimer;
