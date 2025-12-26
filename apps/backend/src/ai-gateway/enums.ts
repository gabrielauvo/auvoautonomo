/**
 * AI Gateway Enums
 * These values must match the Prisma schema enums exactly.
 * Using string literals instead of importing from @prisma/client
 * ensures tests work even when Prisma client hasn't been regenerated.
 */

export const AiConversationStatus = {
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  EXPIRED: 'EXPIRED',
} as const;

export type AiConversationStatus =
  (typeof AiConversationStatus)[keyof typeof AiConversationStatus];

export const AiPlanStatus = {
  PENDING_CONFIRMATION: 'PENDING_CONFIRMATION',
  CONFIRMED: 'CONFIRMED',
  EXECUTING: 'EXECUTING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
} as const;

export type AiPlanStatus = (typeof AiPlanStatus)[keyof typeof AiPlanStatus];

export const AiActionType = {
  READ: 'READ',
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  SEND: 'SEND',
  PAYMENT_CREATE: 'PAYMENT_CREATE',
  PAYMENT_SEND: 'PAYMENT_SEND',
} as const;

export type AiActionType = (typeof AiActionType)[keyof typeof AiActionType];

export const AiAuditCategory = {
  TOOL_CALL: 'TOOL_CALL',
  PLAN_CREATED: 'PLAN_CREATED',
  PLAN_CONFIRMED: 'PLAN_CONFIRMED',
  PLAN_REJECTED: 'PLAN_REJECTED',
  PLAN_EXECUTED: 'PLAN_EXECUTED',
  ACTION_SUCCESS: 'ACTION_SUCCESS',
  ACTION_FAILED: 'ACTION_FAILED',
  SECURITY_BLOCK: 'SECURITY_BLOCK',
  RATE_LIMIT: 'RATE_LIMIT',
} as const;

export type AiAuditCategory =
  (typeof AiAuditCategory)[keyof typeof AiAuditCategory];
