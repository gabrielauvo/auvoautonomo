/**
 * Hooks para o módulo de Checklists Avançados
 *
 * React Query hooks para:
 * - Templates de Checklist
 * - Seções
 * - Perguntas
 * - Instâncias por OS
 * - Respostas e Anexos
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  checklistsService,
  ChecklistTemplate,
  ChecklistSection,
  ChecklistQuestion,
  ChecklistInstance,
  ChecklistAnswer,
  ChecklistAttachment,
  CreateChecklistTemplateDto,
  UpdateChecklistTemplateDto,
  CreateChecklistSectionDto,
  UpdateChecklistSectionDto,
  CreateChecklistQuestionDto,
  UpdateChecklistQuestionDto,
  ReorderQuestionsDto,
  CreateChecklistInstanceDto,
  SubmitAnswerDto,
  BatchSubmitAnswersDto,
  ChecklistAttachmentType,
} from '@/services/checklists.service';

// ============================================
// QUERY KEYS
// ============================================

export const checklistKeys = {
  all: ['checklists'] as const,
  templates: () => [...checklistKeys.all, 'templates'] as const,
  template: (id: string) => [...checklistKeys.templates(), id] as const,
  instances: (workOrderId: string) => [...checklistKeys.all, 'instances', workOrderId] as const,
  instance: (id: string) => [...checklistKeys.all, 'instance', id] as const,
};

// ============================================
// TEMPLATE QUERIES
// ============================================

/**
 * Hook para listar templates de checklist
 */
export function useChecklistTemplates(includeInactive = false) {
  return useQuery<ChecklistTemplate[]>({
    queryKey: [...checklistKeys.templates(), { includeInactive }],
    queryFn: () => checklistsService.listTemplates(includeInactive),
    staleTime: 60000, // 1 minuto
  });
}

/**
 * Hook para obter template por ID
 */
export function useChecklistTemplate(id: string | undefined) {
  return useQuery<ChecklistTemplate>({
    queryKey: checklistKeys.template(id!),
    queryFn: () => checklistsService.getTemplateById(id!),
    enabled: !!id,
  });
}

// ============================================
// TEMPLATE MUTATIONS
// ============================================

/**
 * Hook para criar template
 */
export function useCreateChecklistTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateChecklistTemplateDto) =>
      checklistsService.createTemplate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: checklistKeys.templates() });
    },
  });
}

/**
 * Hook para atualizar template
 */
export function useUpdateChecklistTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateChecklistTemplateDto }) =>
      checklistsService.updateTemplate(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: checklistKeys.template(variables.id) });
      queryClient.invalidateQueries({ queryKey: checklistKeys.templates() });
    },
  });
}

/**
 * Hook para excluir template
 */
export function useDeleteChecklistTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => checklistsService.deleteTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: checklistKeys.templates() });
    },
  });
}

/**
 * Hook para duplicar template
 */
export function useDuplicateChecklistTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, name }: { id: string; name?: string }) =>
      checklistsService.duplicateTemplate(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: checklistKeys.templates() });
    },
  });
}

// ============================================
// SECTION MUTATIONS
// ============================================

/**
 * Hook para criar seção
 */
export function useCreateChecklistSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ templateId, data }: { templateId: string; data: CreateChecklistSectionDto }) =>
      checklistsService.createSection(templateId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: checklistKeys.template(variables.templateId) });
    },
  });
}

/**
 * Hook para atualizar seção
 */
export function useUpdateChecklistSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      templateId,
      sectionId,
      data,
    }: {
      templateId: string;
      sectionId: string;
      data: UpdateChecklistSectionDto;
    }) => checklistsService.updateSection(templateId, sectionId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: checklistKeys.template(variables.templateId) });
    },
  });
}

/**
 * Hook para excluir seção
 */
export function useDeleteChecklistSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ templateId, sectionId }: { templateId: string; sectionId: string }) =>
      checklistsService.deleteSection(templateId, sectionId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: checklistKeys.template(variables.templateId) });
    },
  });
}

/**
 * Hook para reordenar seções
 */
export function useReorderChecklistSections() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ templateId, sectionIds }: { templateId: string; sectionIds: string[] }) =>
      checklistsService.reorderSections(templateId, sectionIds),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: checklistKeys.template(variables.templateId) });
    },
  });
}

// ============================================
// QUESTION MUTATIONS
// ============================================

/**
 * Hook para criar pergunta
 */
export function useCreateChecklistQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ templateId, data }: { templateId: string; data: CreateChecklistQuestionDto }) =>
      checklistsService.createQuestion(templateId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: checklistKeys.template(variables.templateId) });
    },
  });
}

/**
 * Hook para atualizar pergunta
 */
export function useUpdateChecklistQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      templateId,
      questionId,
      data,
    }: {
      templateId: string;
      questionId: string;
      data: UpdateChecklistQuestionDto;
    }) => checklistsService.updateQuestion(templateId, questionId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: checklistKeys.template(variables.templateId) });
    },
  });
}

/**
 * Hook para excluir pergunta
 */
export function useDeleteChecklistQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ templateId, questionId }: { templateId: string; questionId: string }) =>
      checklistsService.deleteQuestion(templateId, questionId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: checklistKeys.template(variables.templateId) });
    },
  });
}

/**
 * Hook para reordenar perguntas
 */
export function useReorderChecklistQuestions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ templateId, data }: { templateId: string; data: ReorderQuestionsDto }) =>
      checklistsService.reorderQuestions(templateId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: checklistKeys.template(variables.templateId) });
    },
  });
}

/**
 * Hook para mover pergunta para outra seção
 */
export function useMoveChecklistQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      templateId,
      questionId,
      sectionId,
    }: {
      templateId: string;
      questionId: string;
      sectionId: string | null;
    }) => checklistsService.moveQuestion(templateId, questionId, sectionId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: checklistKeys.template(variables.templateId) });
    },
  });
}

// ============================================
// INSTANCE QUERIES
// ============================================

/**
 * Hook para listar instâncias de uma OS
 */
export function useChecklistInstances(workOrderId: string | undefined) {
  return useQuery<ChecklistInstance[]>({
    queryKey: checklistKeys.instances(workOrderId!),
    queryFn: () => checklistsService.listInstancesByWorkOrder(workOrderId!),
    enabled: !!workOrderId,
    staleTime: 30000, // 30 segundos
  });
}

/**
 * Hook para obter instância por ID
 */
export function useChecklistInstance(instanceId: string | undefined) {
  return useQuery<ChecklistInstance>({
    queryKey: checklistKeys.instance(instanceId!),
    queryFn: () => checklistsService.getInstanceById(instanceId!),
    enabled: !!instanceId,
  });
}

// ============================================
// INSTANCE MUTATIONS
// ============================================

/**
 * Hook para criar instância (anexar template a OS)
 */
export function useCreateChecklistInstance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ workOrderId, data }: { workOrderId: string; data: CreateChecklistInstanceDto }) =>
      checklistsService.createInstance(workOrderId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: checklistKeys.instances(variables.workOrderId) });
    },
  });
}

/**
 * Hook para excluir instância
 */
export function useDeleteChecklistInstance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ instanceId, workOrderId }: { instanceId: string; workOrderId: string }) =>
      checklistsService.deleteInstance(instanceId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: checklistKeys.instances(variables.workOrderId) });
      queryClient.invalidateQueries({ queryKey: checklistKeys.instance(variables.instanceId) });
    },
  });
}

/**
 * Hook para atualizar status da instância
 */
export function useUpdateChecklistInstanceStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      instanceId,
      status,
      workOrderId,
    }: {
      instanceId: string;
      status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
      workOrderId: string;
    }) => checklistsService.updateInstanceStatus(instanceId, status),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: checklistKeys.instance(variables.instanceId) });
      queryClient.invalidateQueries({ queryKey: checklistKeys.instances(variables.workOrderId) });
    },
  });
}

/**
 * Hook para finalizar checklist (com validação de perguntas obrigatórias)
 */
export function useCompleteChecklist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      instanceId,
      workOrderId,
    }: {
      instanceId: string;
      workOrderId: string;
    }) => checklistsService.completeChecklist(instanceId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: checklistKeys.instance(variables.instanceId) });
      queryClient.invalidateQueries({ queryKey: checklistKeys.instances(variables.workOrderId) });
    },
  });
}

/**
 * Hook para reabrir checklist finalizado
 */
export function useReopenChecklist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      instanceId,
      workOrderId,
    }: {
      instanceId: string;
      workOrderId: string;
    }) => checklistsService.reopenChecklist(instanceId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: checklistKeys.instance(variables.instanceId) });
      queryClient.invalidateQueries({ queryKey: checklistKeys.instances(variables.workOrderId) });
    },
  });
}

/**
 * Hook para submeter resposta individual
 */
export function useSubmitChecklistAnswer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      instanceId,
      data,
    }: {
      instanceId: string;
      data: SubmitAnswerDto;
      workOrderId?: string;
    }) => checklistsService.submitAnswer(instanceId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: checklistKeys.instance(variables.instanceId) });
      if (variables.workOrderId) {
        queryClient.invalidateQueries({ queryKey: checklistKeys.instances(variables.workOrderId) });
      }
    },
  });
}

/**
 * Hook para submeter múltiplas respostas
 */
export function useSubmitChecklistAnswersBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      instanceId,
      data,
    }: {
      instanceId: string;
      data: BatchSubmitAnswersDto;
      workOrderId?: string;
    }) => checklistsService.submitAnswersBatch(instanceId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: checklistKeys.instance(variables.instanceId) });
      if (variables.workOrderId) {
        queryClient.invalidateQueries({ queryKey: checklistKeys.instances(variables.workOrderId) });
      }
    },
  });
}

/**
 * Hook para upload de anexo
 */
export function useUploadChecklistAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      instanceId,
      answerId,
      file,
      type,
    }: {
      instanceId: string;
      answerId: string;
      file: File;
      type: ChecklistAttachmentType;
      workOrderId?: string;
    }) => checklistsService.uploadAttachment(instanceId, answerId, file, type),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: checklistKeys.instance(variables.instanceId) });
    },
  });
}
