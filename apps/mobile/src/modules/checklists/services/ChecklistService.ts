/**
 * ChecklistService
 *
 * Serviço para gerenciamento de checklists offline-first.
 * Gerencia instâncias, respostas e sincronização.
 */

import {
  ChecklistTemplate,
  ChecklistInstance,
  ChecklistAnswer,
  ChecklistAttachment,
  ChecklistInstanceStatus,
  ChecklistQuestionType,
} from '../../../db/schema';
import { setAnswerValue, getAnswerValue } from '../ChecklistAnswerSyncConfig';
import { calculateProgress, areAllRequiredAnswered } from '../components/ConditionalLogicEvaluator';

// =============================================================================
// TYPES
// =============================================================================

export interface CreateInstanceInput {
  workOrderId: string;
  templateId: string;
  technicianId: string;
}

export interface SaveAnswerInput {
  instanceId: string;
  questionId: string;
  type: ChecklistQuestionType;
  value: unknown;
  answeredBy?: string;
  deviceInfo?: string;
}

export interface AttachmentInput {
  answerId?: string;          // Opcional: pode ser anexo direto da OS
  workOrderId: string;        // Obrigatório: referência à OS
  type: 'PHOTO' | 'SIGNATURE' | 'FILE';
  filePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  thumbnailPath?: string;
  technicianId: string;       // Obrigatório
}

export interface ChecklistServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// =============================================================================
// IN-MEMORY STORAGE (Replace with SQLite in production)
// =============================================================================

// For now, using in-memory storage. In production, this would use SQLite via expo-sqlite
const templates = new Map<string, ChecklistTemplate>();
const instances = new Map<string, ChecklistInstance>();
const answers = new Map<string, ChecklistAnswer>();
const attachments = new Map<string, ChecklistAttachment>();

// =============================================================================
// CHECKLIST SERVICE
// =============================================================================

export class ChecklistService {
  // =============================================================================
  // TEMPLATE METHODS
  // =============================================================================

  async getTemplate(templateId: string): Promise<ChecklistTemplate | null> {
    return templates.get(templateId) || null;
  }

  async getActiveTemplates(technicianId: string): Promise<ChecklistTemplate[]> {
    return Array.from(templates.values()).filter(
      t => t.technicianId === technicianId && t.isActive
    );
  }

  async saveTemplate(template: ChecklistTemplate): Promise<void> {
    templates.set(template.id, template);
  }

  // =============================================================================
  // INSTANCE METHODS
  // =============================================================================

  async createInstance(input: CreateInstanceInput): Promise<ChecklistServiceResult<ChecklistInstance>> {
    const template = await this.getTemplate(input.templateId);
    if (!template) {
      return { success: false, error: 'Template não encontrado' };
    }

    const now = new Date().toISOString();
    const instance: ChecklistInstance = {
      id: this.generateId('inst'),
      workOrderId: input.workOrderId,
      templateId: input.templateId,
      templateVersionSnapshot: JSON.stringify(template),
      status: 'PENDING',
      progress: 0,
      createdAt: now,
      updatedAt: now,
      technicianId: input.technicianId,
    };

    instances.set(instance.id, instance);
    return { success: true, data: instance };
  }

  async getInstance(instanceId: string): Promise<ChecklistInstance | null> {
    return instances.get(instanceId) || null;
  }

  async getInstancesForWorkOrder(workOrderId: string): Promise<ChecklistInstance[]> {
    return Array.from(instances.values()).filter(
      i => i.workOrderId === workOrderId
    );
  }

  async updateInstanceStatus(
    instanceId: string,
    status: ChecklistInstanceStatus,
    completedBy?: string
  ): Promise<ChecklistServiceResult<ChecklistInstance>> {
    const instance = instances.get(instanceId);
    if (!instance) {
      return { success: false, error: 'Instância não encontrada' };
    }

    // Validate status transition
    const validTransitions: Record<ChecklistInstanceStatus, ChecklistInstanceStatus[]> = {
      PENDING: ['IN_PROGRESS', 'CANCELLED'],
      IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
      COMPLETED: ['IN_PROGRESS'], // Permite reabrir checklist concluído
      CANCELLED: [],
    };

    if (!validTransitions[instance.status].includes(status)) {
      return {
        success: false,
        error: `Transição inválida: ${instance.status} → ${status}`,
      };
    }

    // If completing, validate all required answers
    if (status === 'COMPLETED') {
      const instanceAnswers = await this.getAnswersForInstance(instanceId);
      const template = JSON.parse(instance.templateVersionSnapshot) as ChecklistTemplate;
      const answersMap = new Map(instanceAnswers.map(a => [a.questionId, a]));

      const { complete, missingQuestions } = areAllRequiredAnswered(template.questions, answersMap);
      if (!complete) {
        return {
          success: false,
          error: `Faltam ${missingQuestions.length} pergunta(s) obrigatória(s)`,
        };
      }
    }

    const now = new Date().toISOString();
    const previousStatus = instance.status;
    instance.status = status;
    instance.updatedAt = now;

    if (status === 'IN_PROGRESS' && !instance.startedAt) {
      instance.startedAt = now;
    }

    // Reabrir checklist concluído
    if (status === 'IN_PROGRESS' && previousStatus === 'COMPLETED') {
      instance.completedAt = undefined;
      instance.completedBy = undefined;
    }

    if (status === 'COMPLETED') {
      instance.completedAt = now;
      instance.completedBy = completedBy;
      instance.progress = 100;
    }

    return { success: true, data: instance };
  }

  // =============================================================================
  // ANSWER METHODS
  // =============================================================================

  async saveAnswer(input: SaveAnswerInput): Promise<ChecklistServiceResult<ChecklistAnswer>> {
    const instance = instances.get(input.instanceId);
    if (!instance) {
      return { success: false, error: 'Instância não encontrada' };
    }

    // Check if instance can be edited
    if (instance.status === 'COMPLETED' || instance.status === 'CANCELLED') {
      return { success: false, error: 'Checklist não pode mais ser editado' };
    }

    // Auto-start if pending
    if (instance.status === 'PENDING') {
      await this.updateInstanceStatus(input.instanceId, 'IN_PROGRESS');
    }

    const now = new Date().toISOString();
    const existingAnswer = Array.from(answers.values()).find(
      a => a.instanceId === input.instanceId && a.questionId === input.questionId
    );

    const answerValues = setAnswerValue(input.type, input.value);
    const answer: ChecklistAnswer = {
      id: existingAnswer?.id || this.generateId('ans'),
      instanceId: input.instanceId,
      questionId: input.questionId,
      type: input.type,
      ...answerValues,
      answeredAt: now,
      answeredBy: input.answeredBy,
      deviceInfo: input.deviceInfo,
      localId: existingAnswer?.localId || this.generateId('local'),
      syncStatus: 'PENDING', // Nova resposta começa como PENDING
      createdAt: existingAnswer?.createdAt || now,
      updatedAt: now,
    };

    answers.set(answer.id, answer);

    // Update instance progress
    await this.updateInstanceProgress(input.instanceId);

    return { success: true, data: answer };
  }

  async getAnswer(instanceId: string, questionId: string): Promise<ChecklistAnswer | null> {
    return Array.from(answers.values()).find(
      a => a.instanceId === instanceId && a.questionId === questionId
    ) || null;
  }

  async getAnswersForInstance(instanceId: string): Promise<ChecklistAnswer[]> {
    return Array.from(answers.values()).filter(a => a.instanceId === instanceId);
  }

  async deleteAnswer(answerId: string): Promise<boolean> {
    const answer = answers.get(answerId);
    if (!answer) return false;

    // Delete associated attachments
    const answerAttachments = Array.from(attachments.values()).filter(
      a => a.answerId === answerId
    );
    for (const att of answerAttachments) {
      attachments.delete(att.id);
    }

    answers.delete(answerId);
    await this.updateInstanceProgress(answer.instanceId);
    return true;
  }

  // =============================================================================
  // ATTACHMENT METHODS
  // =============================================================================

  async addAttachment(input: AttachmentInput): Promise<ChecklistServiceResult<ChecklistAttachment>> {
    // Se tiver answerId, validar que a resposta existe
    if (input.answerId) {
      const answer = answers.get(input.answerId);
      if (!answer) {
        return { success: false, error: 'Resposta não encontrada' };
      }
    }

    const now = new Date().toISOString();
    const attachment: ChecklistAttachment = {
      id: this.generateId('att'),
      answerId: input.answerId,
      workOrderId: input.workOrderId,
      type: input.type,
      filePath: input.filePath,
      fileName: input.fileName,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      thumbnailPath: input.thumbnailPath,
      syncStatus: 'PENDING',        // Novo anexo começa como PENDING
      uploadAttempts: 0,
      localId: this.generateId('local'),
      createdAt: now,
      updatedAt: now,
      technicianId: input.technicianId,
    };

    attachments.set(attachment.id, attachment);
    return { success: true, data: attachment };
  }

  async getAttachmentsForAnswer(answerId: string): Promise<ChecklistAttachment[]> {
    return Array.from(attachments.values()).filter(a => a.answerId === answerId);
  }

  async deleteAttachment(attachmentId: string): Promise<boolean> {
    return attachments.delete(attachmentId);
  }

  // =============================================================================
  // SYNC METHODS
  // =============================================================================

  async getUnsyncedInstances(technicianId: string): Promise<ChecklistInstance[]> {
    return Array.from(instances.values()).filter(
      i => i.technicianId === technicianId && !i.syncedAt
    );
  }

  async getUnsyncedAnswers(instanceId: string): Promise<ChecklistAnswer[]> {
    return Array.from(answers.values()).filter(
      a => a.instanceId === instanceId && !a.syncedAt
    );
  }

  async markInstanceSynced(instanceId: string, serverId?: string): Promise<void> {
    const instance = instances.get(instanceId);
    if (instance) {
      instance.syncedAt = new Date().toISOString();
      if (serverId && serverId !== instanceId) {
        // Update local references to new server ID
        instances.delete(instanceId);
        instance.id = serverId;
        instances.set(serverId, instance);

        // Update answer references
        for (const answer of answers.values()) {
          if (answer.instanceId === instanceId) {
            answer.instanceId = serverId;
          }
        }
      }
    }
  }

  async markAnswerSynced(answerId: string, serverId?: string): Promise<void> {
    const answer = answers.get(answerId);
    if (answer) {
      answer.syncedAt = new Date().toISOString();
      if (serverId && serverId !== answerId) {
        answers.delete(answerId);
        answer.id = serverId;
        answers.set(serverId, answer);

        // Update attachment references
        for (const att of attachments.values()) {
          if (att.answerId === answerId) {
            att.answerId = serverId;
          }
        }
      }
    }
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async updateInstanceProgress(instanceId: string): Promise<void> {
    const instance = instances.get(instanceId);
    if (!instance) return;

    const template = JSON.parse(instance.templateVersionSnapshot) as ChecklistTemplate;
    const instanceAnswers = await this.getAnswersForInstance(instanceId);
    const answersMap = new Map(instanceAnswers.map(a => [a.questionId, a]));

    const progress = calculateProgress(template.questions, answersMap);
    instance.progress = progress;
    instance.updatedAt = new Date().toISOString();
  }

  // =============================================================================
  // CLEAR DATA (for testing)
  // =============================================================================

  async clearAll(): Promise<void> {
    templates.clear();
    instances.clear();
    answers.clear();
    attachments.clear();
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

export const checklistService = new ChecklistService();

export default checklistService;
