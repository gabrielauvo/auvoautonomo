/**
 * Checklists Service
 *
 * Serviço para comunicação com a API de Checklists Avançados.
 *
 * Inclui:
 * - CRUD de Templates
 * - Gerenciamento de Seções
 * - Gerenciamento de Perguntas
 * - Instâncias de Checklist por OS
 * - Upload de anexos
 */

import api, { getErrorMessage } from './api';

// ============================================
// TYPES & ENUMS
// ============================================

/**
 * Tipos de pergunta do checklist
 */
export type ChecklistQuestionType =
  | 'TEXT_SHORT'
  | 'TEXT_LONG'
  | 'NUMBER'
  | 'DATE'
  | 'TIME'
  | 'DATETIME'
  | 'CHECKBOX'
  | 'SELECT'
  | 'MULTI_SELECT'
  | 'PHOTO_REQUIRED'
  | 'PHOTO_OPTIONAL'
  | 'SIGNATURE_TECHNICIAN'
  | 'SIGNATURE_CLIENT'
  | 'SECTION_TITLE'
  | 'RATING'
  | 'SCALE';

/**
 * Status da instância de checklist
 */
export type ChecklistInstanceStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

/**
 * Tipo de anexo de checklist
 */
export type ChecklistAttachmentType = 'PHOTO' | 'SIGNATURE' | 'DOCUMENT';

/**
 * Operadores de condição
 */
export type ConditionOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'GREATER_THAN'
  | 'LESS_THAN'
  | 'GREATER_THAN_OR_EQUAL'
  | 'LESS_THAN_OR_EQUAL'
  | 'CONTAINS'
  | 'NOT_CONTAINS'
  | 'IS_EMPTY'
  | 'IS_NOT_EMPTY'
  | 'IN'
  | 'NOT_IN';

/**
 * Ações de condição
 */
export type ConditionAction = 'SHOW' | 'HIDE' | 'REQUIRE' | 'SKIP_TO';

// ============================================
// INTERFACES - TEMPLATES
// ============================================

/**
 * Opção de pergunta
 */
export interface QuestionOption {
  value: string;
  label: string;
  order?: number;
}

/**
 * Validações de pergunta
 */
export interface QuestionValidation {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  patternMessage?: string;
  minPhotos?: number;
  maxPhotos?: number;
  allowedFileTypes?: string[];
  maxFileSize?: number;
}

/**
 * Metadata de pergunta
 */
export interface QuestionMetadata {
  scaleMin?: number;
  scaleMax?: number;
  scaleLabels?: { min: string; max: string };
  ratingType?: 'stars' | 'numbers' | 'emoji';
  photoInstructions?: string;
  signatureInstructions?: string;
  helpText?: string;
  defaultValue?: unknown;
}

/**
 * Regra condicional
 */
export interface ConditionalRule {
  questionId: string;
  operator: ConditionOperator;
  value: unknown;
  action: ConditionAction;
  targetQuestionId?: string;
  targetSectionId?: string;
}

/**
 * Lógica condicional
 */
export interface ConditionalLogic {
  rules: ConditionalRule[];
  logic?: 'AND' | 'OR';
}

/**
 * Seção do checklist
 */
export interface ChecklistSection {
  id: string;
  templateId: string;
  title: string;
  description?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  questions?: ChecklistQuestion[];
}

/**
 * Pergunta do checklist
 */
export interface ChecklistQuestion {
  id: string;
  templateId: string;
  sectionId?: string;
  type: ChecklistQuestionType;
  title: string;
  description?: string;
  placeholder?: string;
  isRequired: boolean;
  order: number;
  options?: QuestionOption[];
  validations?: QuestionValidation;
  conditionalLogic?: ConditionalLogic;
  metadata?: QuestionMetadata;
  createdAt: string;
  updatedAt: string;
}

/**
 * Template de checklist
 */
export interface ChecklistTemplate {
  id: string;
  userId: string;
  name: string;
  description?: string;
  version: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  sections?: ChecklistSection[];
  questions?: ChecklistQuestion[];
  _count?: {
    instances: number;
    questions: number;
    sections: number;
  };
}

// ============================================
// INTERFACES - INSTANCES
// ============================================

/**
 * Anexo de resposta
 */
export interface ChecklistAttachment {
  id: string;
  answerId: string;
  type: ChecklistAttachmentType;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  publicUrl?: string;
  thumbnailUrl?: string;
  uploadedAt: string;
}

/**
 * Resposta do checklist
 */
export interface ChecklistAnswer {
  id: string;
  instanceId: string;
  questionId: string;
  value?: unknown;
  notes?: string;
  answeredAt?: string;
  answeredBy?: string;
  attachments?: ChecklistAttachment[];
}

/**
 * Instância de checklist
 */
export interface ChecklistInstance {
  id: string;
  templateId: string;
  workOrderId: string;
  status: ChecklistInstanceStatus;
  templateSnapshot?: unknown;
  startedAt?: string;
  completedAt?: string;
  completedBy?: string;
  createdAt: string;
  updatedAt: string;
  template?: ChecklistTemplate;
  answers?: ChecklistAnswer[];
  _count?: {
    answers: number;
  };
}

// ============================================
// DTOs - CREATE/UPDATE
// ============================================

export interface CreateChecklistTemplateDto {
  name: string;
  description?: string;
  isActive?: boolean;
  sections?: CreateChecklistSectionDto[];
  questions?: CreateChecklistQuestionDto[];
}

export interface UpdateChecklistTemplateDto {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export interface CreateChecklistSectionDto {
  title: string;
  description?: string;
  order?: number;
}

export interface UpdateChecklistSectionDto {
  title?: string;
  description?: string;
  order?: number;
}

export interface CreateChecklistQuestionDto {
  sectionId?: string;
  sectionOrder?: number;
  type: ChecklistQuestionType;
  title: string;
  description?: string;
  placeholder?: string;
  isRequired?: boolean;
  order?: number;
  options?: QuestionOption[];
  validations?: QuestionValidation;
  conditionalLogic?: ConditionalLogic;
  metadata?: QuestionMetadata;
}

export interface UpdateChecklistQuestionDto {
  sectionId?: string;
  type?: ChecklistQuestionType;
  title?: string;
  description?: string;
  placeholder?: string;
  isRequired?: boolean;
  order?: number;
  options?: QuestionOption[];
  validations?: QuestionValidation;
  conditionalLogic?: ConditionalLogic;
  metadata?: QuestionMetadata;
}

export interface ReorderQuestionsDto {
  questionIds: string[];
  sectionId?: string;
}

export interface CreateChecklistInstanceDto {
  templateId: string;
}

export interface SubmitAnswerDto {
  questionId: string;
  value?: unknown;
  notes?: string;
  localId?: string;
}

export interface BatchSubmitAnswersDto {
  answers: SubmitAnswerDto[];
}

// ============================================
// API FUNCTIONS - TEMPLATES
// ============================================

/**
 * Listar templates de checklist
 */
async function listTemplates(includeInactive = false): Promise<ChecklistTemplate[]> {
  try {
    const { data } = await api.get<ChecklistTemplate[]>('/checklist-templates', {
      params: { includeInactive: includeInactive ? 'true' : undefined },
    });
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Obter template por ID
 */
async function getTemplateById(id: string): Promise<ChecklistTemplate> {
  try {
    const { data } = await api.get<ChecklistTemplate>(`/checklist-templates/${id}`);
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Criar template
 */
async function createTemplate(dto: CreateChecklistTemplateDto): Promise<ChecklistTemplate> {
  try {
    const { data } = await api.post<ChecklistTemplate>('/checklist-templates', dto);
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Atualizar template
 */
async function updateTemplate(id: string, dto: UpdateChecklistTemplateDto): Promise<ChecklistTemplate> {
  try {
    const { data } = await api.put<ChecklistTemplate>(`/checklist-templates/${id}`, dto);
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Excluir template
 */
async function deleteTemplate(id: string): Promise<void> {
  try {
    await api.delete(`/checklist-templates/${id}`);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Duplicar template
 */
async function duplicateTemplate(id: string, name?: string): Promise<ChecklistTemplate> {
  try {
    const { data } = await api.post<ChecklistTemplate>(`/checklist-templates/${id}/duplicate`, { name });
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Obter snapshot do template
 */
async function getTemplateSnapshot(id: string): Promise<unknown> {
  try {
    const { data } = await api.get(`/checklist-templates/${id}/snapshot`);
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

// ============================================
// API FUNCTIONS - SECTIONS
// ============================================

/**
 * Criar seção
 */
async function createSection(templateId: string, dto: CreateChecklistSectionDto): Promise<ChecklistSection> {
  try {
    const { data } = await api.post<ChecklistSection>(
      `/checklist-templates/${templateId}/sections`,
      dto
    );
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Atualizar seção
 */
async function updateSection(
  templateId: string,
  sectionId: string,
  dto: UpdateChecklistSectionDto
): Promise<ChecklistSection> {
  try {
    const { data } = await api.put<ChecklistSection>(
      `/checklist-templates/${templateId}/sections/${sectionId}`,
      dto
    );
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Excluir seção
 */
async function deleteSection(templateId: string, sectionId: string): Promise<void> {
  try {
    await api.delete(`/checklist-templates/${templateId}/sections/${sectionId}`);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Reordenar seções
 */
async function reorderSections(templateId: string, sectionIds: string[]): Promise<ChecklistSection[]> {
  try {
    const { data } = await api.patch<ChecklistSection[]>(
      `/checklist-templates/${templateId}/sections/reorder`,
      { sectionIds }
    );
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

// ============================================
// API FUNCTIONS - QUESTIONS
// ============================================

/**
 * Criar pergunta
 */
async function createQuestion(templateId: string, dto: CreateChecklistQuestionDto): Promise<ChecklistQuestion> {
  try {
    const { data } = await api.post<ChecklistQuestion>(
      `/checklist-templates/${templateId}/questions`,
      dto
    );
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Atualizar pergunta
 */
async function updateQuestion(
  templateId: string,
  questionId: string,
  dto: UpdateChecklistQuestionDto
): Promise<ChecklistQuestion> {
  try {
    const { data } = await api.put<ChecklistQuestion>(
      `/checklist-templates/${templateId}/questions/${questionId}`,
      dto
    );
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Excluir pergunta
 */
async function deleteQuestion(templateId: string, questionId: string): Promise<void> {
  try {
    await api.delete(`/checklist-templates/${templateId}/questions/${questionId}`);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Reordenar perguntas
 */
async function reorderQuestions(templateId: string, dto: ReorderQuestionsDto): Promise<ChecklistQuestion[]> {
  try {
    const { data } = await api.patch<ChecklistQuestion[]>(
      `/checklist-templates/${templateId}/questions/reorder`,
      dto
    );
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Mover pergunta para outra seção
 */
async function moveQuestion(
  templateId: string,
  questionId: string,
  sectionId: string | null
): Promise<ChecklistQuestion> {
  try {
    const { data } = await api.patch<ChecklistQuestion>(
      `/checklist-templates/${templateId}/questions/${questionId}/move`,
      { sectionId }
    );
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

// ============================================
// API FUNCTIONS - INSTANCES
// ============================================

/**
 * Listar instâncias de checklist de uma OS
 */
async function listInstancesByWorkOrder(workOrderId: string): Promise<ChecklistInstance[]> {
  try {
    const { data } = await api.get<ChecklistInstance[]>(
      `/checklist-instances/work-orders/${workOrderId}`
    );
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Obter instância por ID (com template snapshot completo)
 */
async function getInstanceById(instanceId: string): Promise<ChecklistInstance> {
  try {
    const { data } = await api.get<ChecklistInstance>(`/checklist-instances/${instanceId}/full`);
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Criar instância (anexar template a OS)
 */
async function createInstance(workOrderId: string, dto: CreateChecklistInstanceDto): Promise<ChecklistInstance> {
  try {
    const { data } = await api.post<ChecklistInstance>(
      `/checklist-instances`,
      { ...dto, workOrderId }
    );
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Excluir instância
 */
async function deleteInstance(instanceId: string): Promise<void> {
  try {
    await api.delete(`/checklist-instances/${instanceId}`);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Atualizar status da instância
 */
async function updateInstanceStatus(
  instanceId: string,
  status: ChecklistInstanceStatus
): Promise<ChecklistInstance> {
  try {
    const { data } = await api.patch<ChecklistInstance>(
      `/checklist-instances/${instanceId}/status`,
      { status }
    );
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Submeter resposta individual
 */
async function submitAnswer(instanceId: string, dto: SubmitAnswerDto): Promise<ChecklistAnswer> {
  try {
    const { data } = await api.post<ChecklistAnswer>(
      `/checklist-instances/${instanceId}/answers`,
      dto
    );
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Submeter múltiplas respostas
 */
async function submitAnswersBatch(instanceId: string, dto: BatchSubmitAnswersDto): Promise<ChecklistAnswer[]> {
  try {
    const { data } = await api.post<ChecklistAnswer[]>(
      `/checklist-instances/${instanceId}/answers/batch`,
      dto
    );
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Upload de anexo para resposta
 *
 * SEGURANÇA:
 * - Validação de tipo MIME e extensão
 * - Validação de tamanho (10MB)
 * - Sanitização de nome de arquivo
 */
async function uploadAttachment(
  instanceId: string,
  answerId: string,
  file: File,
  type: ChecklistAttachmentType
): Promise<ChecklistAttachment> {
  try {
    // Importa validação de segurança
    const { validateFileUpload } = await import('@/lib/sanitize');

    // Define tipos permitidos baseado no tipo de anexo
    const allowedTypes = type === 'PHOTO'
      ? ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
      : ['image/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

    const allowedExtensions = type === 'PHOTO'
      ? ['jpg', 'jpeg', 'png', 'webp']
      : ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx'];

    // Validação de segurança
    const validation = validateFileUpload(file, {
      maxSizeMB: 10,
      allowedExtensions,
      allowedMimeTypes: allowedTypes,
    });

    if (!validation.valid) {
      throw new Error(validation.error || 'Arquivo inválido');
    }

    // Cria arquivo com nome sanitizado
    const safeFile = new File([file], validation.sanitizedName || file.name, { type: file.type });

    const formData = new FormData();
    formData.append('file', safeFile);
    formData.append('type', type);

    const { data } = await api.post<ChecklistAttachment>(
      `/checklist-instances/${instanceId}/answers/${answerId}/attachments`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Finalizar checklist (valida perguntas obrigatórias)
 */
async function completeChecklist(instanceId: string): Promise<ChecklistInstance> {
  try {
    const { data } = await api.post<ChecklistInstance>(
      `/checklist-instances/${instanceId}/complete`
    );
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Reabrir checklist finalizado para edição
 */
async function reopenChecklist(instanceId: string): Promise<ChecklistInstance> {
  try {
    const { data } = await api.post<ChecklistInstance>(
      `/checklist-instances/${instanceId}/reopen`
    );
    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

// ============================================
// EXPORT SERVICE
// ============================================

export const checklistsService = {
  // Templates
  listTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  duplicateTemplate,
  getTemplateSnapshot,

  // Sections
  createSection,
  updateSection,
  deleteSection,
  reorderSections,

  // Questions
  createQuestion,
  updateQuestion,
  deleteQuestion,
  reorderQuestions,
  moveQuestion,

  // Instances
  listInstancesByWorkOrder,
  getInstanceById,
  createInstance,
  deleteInstance,
  updateInstanceStatus,
  completeChecklist,
  reopenChecklist,
  submitAnswer,
  submitAnswersBatch,
  uploadAttachment,
};

export default checklistsService;
