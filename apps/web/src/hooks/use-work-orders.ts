/**
 * Hooks para o módulo de Ordens de Serviço
 *
 * React Query hooks para:
 * - Listagem de OS
 * - Detalhes da OS
 * - Operações CRUD
 * - Itens da OS
 * - Equipamentos
 * - Checklists
 * - Anexos
 * - Service Flow (conversão, timeline)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  workOrdersService,
  WorkOrder,
  WorkOrderSearchParams,
  CreateWorkOrderDto,
  UpdateWorkOrderDto,
  WorkOrderStatus,
  AddWorkOrderItemDto,
  UpdateWorkOrderItemDto,
  ChecklistTemplate,
  WorkOrderChecklist,
  ChecklistAnswerDto,
  Attachment,
  TimelineEvent,
  WorkOrderExtract,
} from '@/services/work-orders.service';

// ============================================
// WORK ORDERS QUERIES
// ============================================

/**
 * Hook para listar ordens de serviço
 */
export function useWorkOrders(params?: WorkOrderSearchParams) {
  return useQuery<WorkOrder[]>({
    queryKey: ['work-orders', params],
    queryFn: () => workOrdersService.listWorkOrders(params),
    staleTime: 30000, // 30 segundos
  });
}

/**
 * Hook para obter OS por ID
 */
export function useWorkOrder(id: string | undefined) {
  return useQuery<WorkOrder>({
    queryKey: ['work-order', id],
    queryFn: () => workOrdersService.getWorkOrderById(id!),
    enabled: !!id,
  });
}

/**
 * Hook para obter extrato da OS
 */
export function useWorkOrderExtract(id: string | undefined) {
  return useQuery<WorkOrderExtract>({
    queryKey: ['work-order', id, 'extract'],
    queryFn: () => workOrdersService.getWorkOrderExtract(id!),
    enabled: !!id,
  });
}

// ============================================
// WORK ORDERS MUTATIONS
// ============================================

/**
 * Hook para criar OS
 */
export function useCreateWorkOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateWorkOrderDto) => workOrdersService.createWorkOrder(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
    },
  });
}

/**
 * Hook para atualizar OS
 */
export function useUpdateWorkOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateWorkOrderDto }) =>
      workOrdersService.updateWorkOrder(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['work-order', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
    },
  });
}

/**
 * Hook para deletar OS
 */
export function useDeleteWorkOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => workOrdersService.deleteWorkOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
    },
  });
}

/**
 * Hook para atualizar status da OS
 */
export function useUpdateWorkOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: WorkOrderStatus; reason?: string }) =>
      workOrdersService.updateWorkOrderStatus(id, status, reason),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['work-order', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      // Também invalida timeline do cliente
      queryClient.invalidateQueries({ queryKey: ['client'] });
    },
  });
}

// ============================================
// WORK ORDER ITEMS MUTATIONS
// ============================================

/**
 * Hook para adicionar item à OS
 */
export function useAddWorkOrderItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workOrderId,
      data,
    }: {
      workOrderId: string;
      data: AddWorkOrderItemDto;
    }) => workOrdersService.addWorkOrderItem(workOrderId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['work-order', variables.workOrderId] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
    },
  });
}

/**
 * Hook para atualizar item da OS
 */
export function useUpdateWorkOrderItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workOrderId,
      itemId,
      data,
    }: {
      workOrderId: string;
      itemId: string;
      data: UpdateWorkOrderItemDto;
    }) => workOrdersService.updateWorkOrderItem(workOrderId, itemId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['work-order', variables.workOrderId] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
    },
  });
}

/**
 * Hook para remover item da OS
 */
export function useRemoveWorkOrderItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ workOrderId, itemId }: { workOrderId: string; itemId: string }) =>
      workOrdersService.removeWorkOrderItem(workOrderId, itemId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['work-order', variables.workOrderId] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
    },
  });
}

// ============================================
// EQUIPMENT MUTATIONS
// ============================================

/**
 * Hook para adicionar equipamento à OS
 */
export function useAddWorkOrderEquipment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workOrderId,
      equipmentId,
    }: {
      workOrderId: string;
      equipmentId: string;
    }) => workOrdersService.addWorkOrderEquipment(workOrderId, equipmentId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['work-order', variables.workOrderId] });
    },
  });
}

/**
 * Hook para remover equipamento da OS
 */
export function useRemoveWorkOrderEquipment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workOrderId,
      equipmentId,
    }: {
      workOrderId: string;
      equipmentId: string;
    }) => workOrdersService.removeWorkOrderEquipment(workOrderId, equipmentId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['work-order', variables.workOrderId] });
    },
  });
}

// ============================================
// CHECKLIST QUERIES & MUTATIONS
// ============================================

/**
 * Hook para listar templates de checklist
 */
export function useChecklistTemplates() {
  return useQuery<ChecklistTemplate[]>({
    queryKey: ['checklist-templates'],
    queryFn: () => workOrdersService.listChecklistTemplates(),
    staleTime: 60000, // 1 minuto
  });
}

/**
 * Hook para obter template de checklist
 */
export function useChecklistTemplate(id: string | undefined) {
  return useQuery<ChecklistTemplate>({
    queryKey: ['checklist-template', id],
    queryFn: () => workOrdersService.getChecklistTemplate(id!),
    enabled: !!id,
  });
}

/**
 * Hook para listar checklists da OS
 */
export function useWorkOrderChecklists(workOrderId: string | undefined) {
  return useQuery<WorkOrderChecklist[]>({
    queryKey: ['work-order', workOrderId, 'checklists'],
    queryFn: () => workOrdersService.listWorkOrderChecklists(workOrderId!),
    enabled: !!workOrderId,
  });
}

/**
 * Hook para obter checklist da OS com respostas
 */
export function useWorkOrderChecklist(
  workOrderId: string | undefined,
  checklistId: string | undefined
) {
  return useQuery<WorkOrderChecklist>({
    queryKey: ['work-order', workOrderId, 'checklist', checklistId],
    queryFn: () => workOrdersService.getWorkOrderChecklist(workOrderId!, checklistId!),
    enabled: !!workOrderId && !!checklistId,
  });
}

/**
 * Hook para criar checklist na OS
 */
export function useCreateWorkOrderChecklist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workOrderId,
      templateId,
    }: {
      workOrderId: string;
      templateId: string;
    }) => workOrdersService.createWorkOrderChecklist(workOrderId, templateId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['work-order', variables.workOrderId, 'checklists'],
      });
      queryClient.invalidateQueries({ queryKey: ['work-order', variables.workOrderId] });
    },
  });
}

/**
 * Hook para submeter respostas do checklist
 */
export function useSubmitChecklistAnswers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workOrderId,
      checklistId,
      answers,
    }: {
      workOrderId: string;
      checklistId: string;
      answers: ChecklistAnswerDto[];
    }) => workOrdersService.submitChecklistAnswers(workOrderId, checklistId, answers),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['work-order', variables.workOrderId, 'checklist', variables.checklistId],
      });
      queryClient.invalidateQueries({
        queryKey: ['work-order', variables.workOrderId, 'checklists'],
      });
      queryClient.invalidateQueries({ queryKey: ['work-order', variables.workOrderId] });
    },
  });
}

/**
 * Hook para deletar checklist da OS
 */
export function useDeleteWorkOrderChecklist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workOrderId,
      checklistId,
    }: {
      workOrderId: string;
      checklistId: string;
    }) => workOrdersService.deleteWorkOrderChecklist(workOrderId, checklistId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['work-order', variables.workOrderId, 'checklists'],
      });
      queryClient.invalidateQueries({ queryKey: ['work-order', variables.workOrderId] });
    },
  });
}

// ============================================
// ATTACHMENTS QUERIES & MUTATIONS
// ============================================

/**
 * Hook para listar anexos da OS
 */
export function useWorkOrderAttachments(workOrderId: string | undefined) {
  return useQuery<Attachment[]>({
    queryKey: ['work-order', workOrderId, 'attachments'],
    queryFn: () => workOrdersService.listWorkOrderAttachments(workOrderId!),
    enabled: !!workOrderId,
  });
}

/**
 * Hook para upload de anexo
 */
export function useUploadWorkOrderAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ workOrderId, file }: { workOrderId: string; file: File }) =>
      workOrdersService.uploadWorkOrderAttachment(workOrderId, file),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['work-order', variables.workOrderId, 'attachments'],
      });
      queryClient.invalidateQueries({ queryKey: ['work-order', variables.workOrderId] });
    },
  });
}

/**
 * Hook para deletar anexo
 */
export function useDeleteAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      attachmentId,
      workOrderId,
    }: {
      attachmentId: string;
      workOrderId: string;
    }) => workOrdersService.deleteAttachment(attachmentId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['work-order', variables.workOrderId, 'attachments'],
      });
      queryClient.invalidateQueries({ queryKey: ['work-order', variables.workOrderId] });
    },
  });
}

// ============================================
// SERVICE FLOW MUTATIONS
// ============================================

/**
 * Hook para converter orçamento em OS
 */
export function useConvertQuoteToWorkOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      quoteId,
      data,
    }: {
      quoteId: string;
      data?: Partial<CreateWorkOrderDto>;
    }) => workOrdersService.convertQuoteToWorkOrder(quoteId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['quote', variables.quoteId] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
  });
}

/**
 * Hook para concluir OS (via service-flow)
 */
export function useCompleteWorkOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (workOrderId: string) =>
      workOrdersService.completeWorkOrder(workOrderId),
    onSuccess: (_, workOrderId) => {
      queryClient.invalidateQueries({ queryKey: ['work-order', workOrderId] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['client'] });
    },
  });
}

/**
 * Hook para obter timeline do cliente
 */
export function useClientTimelineFlow(clientId: string | undefined) {
  return useQuery<TimelineEvent[]>({
    queryKey: ['client', clientId, 'timeline-flow'],
    queryFn: () => workOrdersService.getClientTimeline(clientId!),
    enabled: !!clientId,
  });
}

/**
 * Hook para gerar pagamento da OS
 */
export function useGenerateWorkOrderPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workOrderId,
      data,
    }: {
      workOrderId: string;
      data: {
        billingType: 'BOLETO' | 'PIX' | 'CREDIT_CARD';
        dueDate: string;
        value?: number;
        description?: string;
      };
    }) => workOrdersService.generateWorkOrderPayment(workOrderId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['work-order', variables.workOrderId, 'extract'],
      });
      queryClient.invalidateQueries({ queryKey: ['work-order', variables.workOrderId] });
    },
  });
}
