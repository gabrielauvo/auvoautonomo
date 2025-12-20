/**
 * ChecklistAnswerSyncConfig
 *
 * Configuração de sincronização para Respostas de Checklist.
 * Respostas são criadas offline e sincronizadas com idempotência via localId.
 */

import { SyncEntityConfig } from '../../sync/types';
import { ChecklistAnswer, ChecklistQuestionType } from '../../db/schema';

// =============================================================================
// SERVER RESPONSE TYPES
// =============================================================================

interface ServerChecklistAnswer {
  id: string;
  instanceId: string;
  questionId: string;
  type: ChecklistQuestionType;
  valueText?: string;
  valueNumber?: number;
  valueBoolean?: boolean;
  valueDate?: string;
  valueJson?: string | object;
  answeredAt: string;
  answeredBy?: string;
  deviceInfo?: string;
  localId?: string;
  deletedAt?: string;
  syncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// SYNC CONFIG
// =============================================================================

export const ChecklistAnswerSyncConfig: SyncEntityConfig<ChecklistAnswer> = {
  name: 'checklist_answers',
  tableName: 'checklist_answers',
  apiEndpoint: '/checklist-instances/answers/sync',
  apiMutationEndpoint: '/checklist-instances/sync', // Usa endpoint batch do backend
  cursorField: 'updatedAt',
  primaryKeys: ['id'],
  scopeField: 'instanceId', // Escopo por instância (que tem technicianId)
  batchSize: 100,
  conflictResolution: 'last_write_wins',

  /**
   * Transform server response to local format
   */
  transformFromServer: (data: unknown): ChecklistAnswer => {
    const serverItem = data as ServerChecklistAnswer;

    // valueJson pode vir como string JSON ou objeto
    const valueJson = typeof serverItem.valueJson === 'object'
      ? JSON.stringify(serverItem.valueJson)
      : serverItem.valueJson;

    return {
      id: serverItem.id,
      instanceId: serverItem.instanceId,
      questionId: serverItem.questionId,
      type: serverItem.type,
      valueText: serverItem.valueText,
      valueNumber: serverItem.valueNumber,
      valueBoolean: serverItem.valueBoolean,
      valueDate: serverItem.valueDate,
      valueJson: valueJson,
      answeredAt: serverItem.answeredAt,
      answeredBy: serverItem.answeredBy,
      deviceInfo: serverItem.deviceInfo,
      localId: serverItem.localId,
      syncStatus: 'SYNCED', // Dados do servidor são sempre SYNCED
      syncedAt: serverItem.syncedAt,
      createdAt: serverItem.createdAt,
      updatedAt: serverItem.updatedAt,
    };
  },

  /**
   * Transform local item to server mutation format
   * Backend espera formato específico para syncOfflineAnswers
   */
  transformToServer: (localItem: ChecklistAnswer): unknown => {
    // Parse valueJson se for string
    let valueJson: unknown;
    if (localItem.valueJson) {
      try {
        valueJson = JSON.parse(localItem.valueJson);
      } catch {
        valueJson = localItem.valueJson;
      }
    }

    return {
      localId: localItem.localId || localItem.id, // Idempotência
      questionId: localItem.questionId,
      valueText: localItem.valueText,
      valueNumber: localItem.valueNumber,
      valueBoolean: localItem.valueBoolean,
      valueDate: localItem.valueDate,
      valueJson: valueJson,
      answeredAt: localItem.answeredAt,
      answeredBy: localItem.answeredBy,
      deviceInfo: localItem.deviceInfo,
    };
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Extract value from answer based on question type
 */
export function getAnswerValue(answer: ChecklistAnswer): unknown {
  switch (answer.type) {
    case 'TEXT_SHORT':
    case 'TEXT_LONG':
      return answer.valueText;

    case 'NUMBER':
    case 'RATING':
    case 'SCALE':
      return answer.valueNumber;

    case 'CHECKBOX':
      return answer.valueBoolean;

    case 'DATE':
    case 'TIME':
    case 'DATETIME':
      return answer.valueDate;

    case 'SELECT':
    case 'MULTI_SELECT':
      return answer.valueJson ? JSON.parse(answer.valueJson) : null;

    case 'PHOTO_REQUIRED':
    case 'PHOTO_OPTIONAL':
    case 'FILE_UPLOAD':
    case 'SIGNATURE_TECHNICIAN':
    case 'SIGNATURE_CLIENT':
      // Attachments são referenciados via answerId na tabela checklist_attachments
      return answer.valueJson ? JSON.parse(answer.valueJson) : null;

    case 'SECTION_TITLE':
      return null; // Não tem valor

    default:
      return answer.valueText || answer.valueNumber || answer.valueBoolean || answer.valueDate || answer.valueJson;
  }
}

/**
 * Set value for answer based on question type
 */
export function setAnswerValue(
  type: ChecklistQuestionType,
  value: unknown,
): Partial<ChecklistAnswer> {
  const base: Partial<ChecklistAnswer> = {
    type,
    valueText: undefined,
    valueNumber: undefined,
    valueBoolean: undefined,
    valueDate: undefined,
    valueJson: undefined,
    answeredAt: new Date().toISOString(),
  };

  switch (type) {
    case 'TEXT_SHORT':
    case 'TEXT_LONG':
      base.valueText = value as string;
      break;

    case 'NUMBER':
    case 'RATING':
    case 'SCALE':
      base.valueNumber = value as number;
      break;

    case 'CHECKBOX':
      base.valueBoolean = value as boolean;
      break;

    case 'DATE':
    case 'TIME':
    case 'DATETIME':
      base.valueDate = value as string;
      break;

    case 'SELECT':
      base.valueJson = JSON.stringify(value);
      break;

    case 'MULTI_SELECT':
      base.valueJson = JSON.stringify(value);
      break;

    case 'PHOTO_REQUIRED':
    case 'PHOTO_OPTIONAL':
    case 'FILE_UPLOAD':
    case 'SIGNATURE_TECHNICIAN':
    case 'SIGNATURE_CLIENT':
      // value contém informações sobre os attachments
      base.valueJson = JSON.stringify(value);
      break;

    case 'SECTION_TITLE':
      // Não tem valor
      break;
  }

  return base;
}

/**
 * Validate answer based on question type and validation rules
 */
export function validateAnswer(
  type: ChecklistQuestionType,
  value: unknown,
  isRequired: boolean,
): { valid: boolean; error?: string } {
  // Check required
  if (isRequired && (value === null || value === undefined || value === '')) {
    return { valid: false, error: 'Campo obrigatório' };
  }

  // Skip validation if empty and not required
  if (value === null || value === undefined || value === '') {
    return { valid: true };
  }

  // Type-specific validation
  switch (type) {
    case 'NUMBER':
    case 'RATING':
    case 'SCALE':
      if (typeof value !== 'number' || isNaN(value)) {
        return { valid: false, error: 'Valor numérico inválido' };
      }
      break;

    case 'CHECKBOX':
      if (typeof value !== 'boolean') {
        return { valid: false, error: 'Valor booleano inválido' };
      }
      break;

    case 'DATE':
    case 'TIME':
    case 'DATETIME':
      if (typeof value !== 'string' || isNaN(Date.parse(value))) {
        return { valid: false, error: 'Data/hora inválida' };
      }
      break;

    case 'SELECT':
      if (typeof value !== 'string') {
        return { valid: false, error: 'Seleção inválida' };
      }
      break;

    case 'MULTI_SELECT':
      if (!Array.isArray(value)) {
        return { valid: false, error: 'Seleção múltipla inválida' };
      }
      break;
  }

  return { valid: true };
}

export default ChecklistAnswerSyncConfig;
