/**
 * Conversation State Machine
 * Manages conversation states and transitions
 */

export enum ConversationState {
  IDLE = 'IDLE',
  PLANNING = 'PLANNING',
  AWAITING_CONFIRMATION = 'AWAITING_CONFIRMATION',
  EXECUTING = 'EXECUTING',
}

export interface PendingPlan {
  id: string;
  action: string;
  tool: string;
  params: Record<string, unknown>;
  collectedFields: Record<string, unknown>;
  missingFields: string[];
  createdAt: Date;
  expiresAt: Date;
}

export interface ConversationStateData {
  state: ConversationState;
  pendingPlan?: PendingPlan;
  lastToolResult?: {
    tool: string;
    success: boolean;
    data?: unknown;
    error?: string;
  };
  billingPreviewId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * State transition rules
 */
export const STATE_TRANSITIONS: Record<
  ConversationState,
  ConversationState[]
> = {
  [ConversationState.IDLE]: [
    ConversationState.PLANNING,
    ConversationState.EXECUTING, // For read operations
  ],
  [ConversationState.PLANNING]: [
    ConversationState.AWAITING_CONFIRMATION,
    ConversationState.PLANNING, // Collecting more fields
    ConversationState.IDLE, // User cancels
  ],
  [ConversationState.AWAITING_CONFIRMATION]: [
    ConversationState.EXECUTING,
    ConversationState.IDLE, // User rejects
    ConversationState.PLANNING, // User wants to modify
  ],
  [ConversationState.EXECUTING]: [
    ConversationState.IDLE, // Execution complete
    ConversationState.PLANNING, // Chain to next action
  ],
};

/**
 * Check if a state transition is valid
 */
export function isValidTransition(
  from: ConversationState,
  to: ConversationState,
): boolean {
  return STATE_TRANSITIONS[from].includes(to);
}

/**
 * Get default state data
 */
export function getDefaultStateData(): ConversationStateData {
  return {
    state: ConversationState.IDLE,
  };
}

/**
 * Check if confirmation keywords are present in message
 */
export function isConfirmation(message: string): boolean {
  const confirmPatterns = [
    /^sim$/i,
    /^confirmo$/i,
    /^sim,?\s*confirmo$/i,
    /^pode\s*fazer$/i,
    /^pode\s*criar$/i,
    /^ok$/i,
    /^certo$/i,
    /^pode$/i,
    /^confirmar$/i,
    /^aprovo$/i,
    /^autorizo$/i,
    /^prosseguir$/i,
    /^executar$/i,
    /^yes$/i,
    /^confirm$/i,
  ];

  const normalizedMessage = message.trim().toLowerCase();
  return confirmPatterns.some(pattern => pattern.test(normalizedMessage));
}

/**
 * Check if rejection keywords are present in message
 */
export function isRejection(message: string): boolean {
  const rejectPatterns = [
    /^não$/i,
    /^nao$/i,
    /^cancelar$/i,
    /^cancela$/i,
    /^parar$/i,
    /^para$/i,
    /^desistir$/i,
    /^no$/i,
    /^cancel$/i,
    /^rejeitar$/i,
    /^rejeito$/i,
    /^recusar$/i,
    /^recuso$/i,
  ];

  const normalizedMessage = message.trim().toLowerCase();
  return rejectPatterns.some(pattern => pattern.test(normalizedMessage));
}

/**
 * Check if user wants to modify the plan
 */
export function isModificationRequest(message: string): boolean {
  const modifyPatterns = [
    /alterar/i,
    /modificar/i,
    /mudar/i,
    /trocar/i,
    /corrigir/i,
    /ajustar/i,
    /atualizar/i,
    /editar/i,
  ];

  return modifyPatterns.some(pattern => pattern.test(message));
}
