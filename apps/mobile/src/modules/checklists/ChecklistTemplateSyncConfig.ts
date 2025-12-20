/**
 * ChecklistTemplateSyncConfig
 *
 * Configuração de sincronização para Templates de Checklist.
 * Templates são read-only no mobile (origem: servidor).
 */

import { SyncEntityConfig } from '../../sync/types';
import {
  ChecklistTemplate,
  ChecklistSection,
  ChecklistQuestion,
} from '../../db/schema';

// =============================================================================
// SERVER RESPONSE TYPES
// =============================================================================

interface ServerChecklistTemplate {
  id: string;
  technicianId: string;
  name: string;
  description?: string;
  version: number;
  isActive: boolean;
  sections: ChecklistSection[];
  questions: ChecklistQuestion[];
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// SYNC CONFIG
// =============================================================================

export const ChecklistTemplateSyncConfig: SyncEntityConfig<ChecklistTemplate> = {
  name: 'checklist_templates',
  tableName: 'checklist_templates',
  apiEndpoint: '/checklist-templates/sync',
  apiMutationEndpoint: '/checklist-templates/sync/mutations', // Read-only, não usado
  cursorField: 'updatedAt',
  primaryKeys: ['id'],
  scopeField: 'technicianId',
  batchSize: 50, // Templates podem ser grandes (muitas perguntas)
  conflictResolution: 'server_wins', // Templates são source of truth do servidor

  /**
   * Transform server response to local format
   * Sections e Questions são armazenados como JSON
   */
  transformFromServer: (data: unknown): ChecklistTemplate => {
    const serverItem = data as ServerChecklistTemplate;
    // Convert isActive to integer (1/0) for SQLite storage
    const isActiveValue = serverItem.isActive !== false && (serverItem.isActive as unknown) !== 0;
    return {
      id: serverItem.id,
      name: serverItem.name,
      description: serverItem.description,
      version: serverItem.version,
      isActive: isActiveValue ? 1 : 0, // Store as integer for SQLite
      sections: serverItem.sections || [],
      questions: serverItem.questions || [],
      createdAt: serverItem.createdAt,
      updatedAt: serverItem.updatedAt,
      technicianId: serverItem.technicianId,
    } as unknown as ChecklistTemplate;
  },

  /**
   * Transform local item to server format
   * Templates são read-only no mobile, mas mantemos para consistência
   */
  transformToServer: (localItem: ChecklistTemplate): unknown => {
    return {
      id: localItem.id,
      name: localItem.name,
      description: localItem.description,
      version: localItem.version,
      isActive: localItem.isActive,
      sections: localItem.sections,
      questions: localItem.questions,
      createdAt: localItem.createdAt,
      updatedAt: localItem.updatedAt,
      technicianId: localItem.technicianId,
    };
  },
};

export default ChecklistTemplateSyncConfig;
