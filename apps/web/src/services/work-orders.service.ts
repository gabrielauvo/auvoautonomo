/**
 * Work Orders Service
 *
 * Serviço para comunicação com a API de Ordens de Serviço.
 *
 * Inclui:
 * - CRUD de OS
 * - Gerenciamento de status
 * - Itens da OS
 * - Equipamentos
 * - Checklists
 * - Timeline
 * - Conversão de orçamento
 */

import api, { getErrorMessage } from './api';

// ============================================
// TYPES & ENUMS
// ============================================

/**
 * Status da Ordem de Serviço
 */
export type WorkOrderStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'DONE' | 'CANCELED';

/**
 * Tipo de item da OS
 */
export type WorkOrderItemType = 'PRODUCT' | 'SERVICE' | 'BUNDLE';

/**
 * Tipo de item de checklist
 */
export type ChecklistItemType = 'TEXT' | 'NUMERIC' | 'BOOLEAN' | 'PHOTO' | 'SELECT';

/**
 * Item da Ordem de Serviço
 */
export interface WorkOrderItem {
  id: string;
  workOrderId: string;
  quoteItemId?: string;
  itemId?: string;
  name: string;
  type: WorkOrderItemType;
  unit: string;
  quantity: number;
  unitPrice: number;
  discountValue: number;
  totalPrice: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Equipamento vinculado à OS
 */
export interface WorkOrderEquipment {
  id: string;
  workOrderId: string;
  equipmentId: string;
  createdAt: string;
  equipment: {
    id: string;
    type: string;
    brand?: string;
    model?: string;
    serialNumber?: string;
  };
}

/**
 * Item de template de checklist
 */
export interface ChecklistTemplateItem {
  id: string;
  templateId: string;
  order: number;
  label: string;
  type: ChecklistItemType;
  options?: string[];
  isRequired: boolean;
  condition?: {
    itemId: string;
    operator: string;
    value: string | number | boolean;
  };
}

/**
 * Template de checklist
 */
export interface ChecklistTemplate {
  id: string;
  userId: string;
  title: string;
  description?: string;
  isActive: boolean;
  items?: ChecklistTemplateItem[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Resposta de item de checklist
 */
export interface ChecklistAnswer {
  id: string;
  checklistId: string;
  templateItemId: string;
  type: ChecklistItemType;
  valueText?: string;
  valueNumber?: number;
  valueBoolean?: boolean;
  valuePhoto?: string;
  valueSelect?: string;
  createdAt: string;
  updatedAt: string;
  templateItem?: ChecklistTemplateItem;
}

/**
 * Checklist da OS
 */
export interface WorkOrderChecklist {
  id: string;
  workOrderId: string;
  templateId: string;
  createdAt: string;
  updatedAt: string;
  template?: ChecklistTemplate;
  answers?: ChecklistAnswer[];
}

/**
 * Assinatura
 */
export interface Signature {
  id: string;
  workOrderId: string;
  type: 'CLIENT' | 'TECHNICIAN';
  signatureUrl: string;
  signedAt: string;
  signerName?: string;
}

/**
 * Anexo
 */
export interface Attachment {
  id: string;
  workOrderId?: string;
  clientId?: string;
  quoteId?: string;
  type: string; // AttachmentType: PHOTO, DOCUMENT, SIGNATURE
  mimeType: string;
  fileNameOriginal: string;
  fileSize: number;
  storagePath: string;
  publicUrl?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

/**
 * Cliente resumido
 */
export interface ClientSummary {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  taxId?: string;
}

/**
 * Tipo de Ordem de Serviço
 */
export interface WorkOrderType {
  id: string;
  name: string;
  description?: string;
  color?: string;
}

/**
 * Ordem de Serviço completa
 */
export interface WorkOrder {
  id: string;
  userId: string;
  clientId: string;
  quoteId?: string;
  workOrderTypeId?: string;
  number: number;
  title: string;
  description?: string;
  status: WorkOrderStatus;
  scheduledDate?: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  executionStart?: string;
  executionEnd?: string;
  startedAt?: string;
  completedAt?: string;
  address?: string;
  notes?: string;
  totalValue: number;
  discountValue?: number;
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
  client: ClientSummary;
  quote?: {
    id: string;
    number: number;
    totalValue: number;
    status: string;
  };
  workOrderType?: WorkOrderType;
  items?: WorkOrderItem[];
  equipments?: WorkOrderEquipment[];
  checklists?: WorkOrderChecklist[];
  attachments?: Attachment[];
  signatures?: Signature[];
}

/**
 * Parâmetros de busca de OS
 */
export interface WorkOrderSearchParams {
  search?: string;
  status?: WorkOrderStatus;
  clientId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

/**
 * DTO para criar OS
 */
export interface CreateWorkOrderDto {
  clientId: string;
  quoteId?: string;
  title: string;
  description?: string;
  scheduledDate?: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  address?: string;
  notes?: string;
  equipmentIds?: string[];
  checklistTemplateId?: string;
  workOrderTypeId?: string;
}

/**
 * DTO para atualizar OS
 */
export interface UpdateWorkOrderDto {
  title?: string;
  description?: string;
  scheduledDate?: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  executionStart?: string;
  executionEnd?: string;
  address?: string;
  notes?: string;
  workOrderTypeId?: string | null;
}

/**
 * DTO para adicionar item
 */
export interface AddWorkOrderItemDto {
  itemId?: string;
  name?: string;
  type?: WorkOrderItemType;
  unit?: string;
  quantity: number;
  unitPrice?: number;
  discountValue?: number;
}

/**
 * DTO para atualizar item
 */
export interface UpdateWorkOrderItemDto {
  quantity: number;
}

/**
 * DTO para submeter respostas do checklist
 */
export interface ChecklistAnswerDto {
  templateItemId: string;
  type: ChecklistItemType;
  valueText?: string;
  valueNumber?: number;
  valueBoolean?: boolean;
  valuePhoto?: string;
  valueSelect?: string;
}

/**
 * Evento da timeline
 */
export interface TimelineEvent {
  type: string;
  date: string;
  workOrderId?: string;
  quoteId?: string;
  paymentId?: string;
  data: Record<string, unknown>;
}

/**
 * Extrato da OS
 */
export interface WorkOrderExtract {
  workOrder: {
    id: string;
    title: string;
    description?: string;
    status: WorkOrderStatus;
    scheduledDate?: string;
    executionStart?: string;
    executionEnd?: string;
    createdAt: string;
  };
  client: ClientSummary;
  quote?: {
    id: string;
    totalValue: number;
    discountValue: number;
    status: string;
    items: Array<{
      name: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }>;
  };
  payments: Array<{
    id: string;
    value: number;
    billingType: string;
    status: string;
    dueDate: string;
    paidAt?: string;
    invoiceUrl?: string;
  }>;
  checklists: Array<{
    id: string;
    title: string;
    answersCount: number;
  }>;
  equipments: Array<{
    id: string;
    type: string;
    brand?: string;
    model?: string;
  }>;
  financialSummary: {
    totalQuoted: number;
    totalPaid: number;
    totalPending: number;
    balance: number;
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Verificar se pode editar a OS
 */
export function canEditWorkOrder(workOrder: WorkOrder): boolean {
  return workOrder.status === 'SCHEDULED';
}

/**
 * Verificar se pode iniciar a OS
 */
export function canStartWorkOrder(workOrder: WorkOrder): boolean {
  return workOrder.status === 'SCHEDULED';
}

/**
 * Verificar se pode concluir a OS
 */
export function canCompleteWorkOrder(workOrder: WorkOrder): boolean {
  return workOrder.status === 'IN_PROGRESS';
}

/**
 * Verificar se pode cancelar a OS
 */
export function canCancelWorkOrder(workOrder: WorkOrder): boolean {
  return workOrder.status === 'SCHEDULED' || workOrder.status === 'IN_PROGRESS';
}

/**
 * Verificar se a OS está em execução
 */
export function isWorkOrderActive(workOrder: WorkOrder): boolean {
  return workOrder.status === 'IN_PROGRESS';
}

/**
 * Verificar se a OS está finalizada
 */
export function isWorkOrderFinished(workOrder: WorkOrder): boolean {
  return workOrder.status === 'DONE' || workOrder.status === 'CANCELED';
}

// ============================================
// API FUNCTIONS - WORK ORDERS
// ============================================

/**
 * Listar ordens de serviço
 */
export async function listWorkOrders(params?: WorkOrderSearchParams): Promise<WorkOrder[]> {
  try {
    const response = await api.get<WorkOrder[]>('/work-orders', { params });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Obter ordem de serviço por ID
 */
export async function getWorkOrderById(id: string): Promise<WorkOrder> {
  try {
    const response = await api.get<WorkOrder>(`/work-orders/${id}`);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Criar ordem de serviço
 */
export async function createWorkOrder(data: CreateWorkOrderDto): Promise<WorkOrder> {
  try {
    const response = await api.post<WorkOrder>('/work-orders', data);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Atualizar ordem de serviço
 */
export async function updateWorkOrder(id: string, data: UpdateWorkOrderDto): Promise<WorkOrder> {
  try {
    const response = await api.put<WorkOrder>(`/work-orders/${id}`, data);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Deletar ordem de serviço
 */
export async function deleteWorkOrder(id: string): Promise<void> {
  try {
    await api.delete(`/work-orders/${id}`);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Atualizar status da OS
 */
export async function updateWorkOrderStatus(
  id: string,
  status: WorkOrderStatus,
  reason?: string
): Promise<WorkOrder> {
  try {
    const response = await api.patch<WorkOrder>(`/work-orders/${id}/status`, { status, reason });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

// ============================================
// API FUNCTIONS - WORK ORDER ITEMS
// ============================================

/**
 * Adicionar item à OS
 */
export async function addWorkOrderItem(
  workOrderId: string,
  data: AddWorkOrderItemDto
): Promise<WorkOrder> {
  try {
    const response = await api.post<WorkOrder>(`/work-orders/${workOrderId}/items`, data);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Atualizar item da OS
 */
export async function updateWorkOrderItem(
  workOrderId: string,
  itemId: string,
  data: UpdateWorkOrderItemDto
): Promise<WorkOrder> {
  try {
    const response = await api.put<WorkOrder>(
      `/work-orders/${workOrderId}/items/${itemId}`,
      data
    );
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Remover item da OS
 */
export async function removeWorkOrderItem(
  workOrderId: string,
  itemId: string
): Promise<WorkOrder> {
  try {
    const response = await api.delete<WorkOrder>(`/work-orders/${workOrderId}/items/${itemId}`);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

// ============================================
// API FUNCTIONS - EQUIPMENTS
// ============================================

/**
 * Adicionar equipamento à OS
 */
export async function addWorkOrderEquipment(
  workOrderId: string,
  equipmentId: string
): Promise<WorkOrder> {
  try {
    const response = await api.post<WorkOrder>(`/work-orders/${workOrderId}/equipments`, {
      equipmentId,
    });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Remover equipamento da OS
 */
export async function removeWorkOrderEquipment(
  workOrderId: string,
  equipmentId: string
): Promise<WorkOrder> {
  try {
    const response = await api.delete<WorkOrder>(
      `/work-orders/${workOrderId}/equipments/${equipmentId}`
    );
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

// ============================================
// API FUNCTIONS - CHECKLISTS
// ============================================

/**
 * Listar templates de checklist
 */
export async function listChecklistTemplates(): Promise<ChecklistTemplate[]> {
  try {
    const response = await api.get<ChecklistTemplate[]>('/checklist-templates');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Obter template de checklist por ID
 */
export async function getChecklistTemplate(id: string): Promise<ChecklistTemplate> {
  try {
    const response = await api.get<ChecklistTemplate>(`/checklist-templates/${id}`);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Criar checklist para OS
 */
export async function createWorkOrderChecklist(
  workOrderId: string,
  templateId: string
): Promise<WorkOrderChecklist> {
  try {
    const response = await api.post<WorkOrderChecklist>(
      `/checklist-instances`,
      { workOrderId, templateId }
    );
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Listar checklists da OS
 */
export async function listWorkOrderChecklists(
  workOrderId: string
): Promise<WorkOrderChecklist[]> {
  try {
    const response = await api.get<WorkOrderChecklist[]>(
      `/checklist-instances/work-orders/${workOrderId}`
    );
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Obter checklist da OS com respostas
 */
export async function getWorkOrderChecklist(
  workOrderId: string,
  checklistId: string
): Promise<WorkOrderChecklist> {
  try {
    const response = await api.get<WorkOrderChecklist>(
      `/checklist-instances/${checklistId}/full`
    );
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Submeter respostas do checklist
 */
export async function submitChecklistAnswers(
  workOrderId: string,
  checklistId: string,
  answers: ChecklistAnswerDto[]
): Promise<WorkOrderChecklist> {
  try {
    const response = await api.post<WorkOrderChecklist>(
      `/checklist-instances/${checklistId}/answers/batch`,
      { answers }
    );
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Deletar checklist da OS
 */
export async function deleteWorkOrderChecklist(
  workOrderId: string,
  checklistId: string
): Promise<void> {
  try {
    await api.delete(`/checklist-instances/${checklistId}`);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

// ============================================
// API FUNCTIONS - ATTACHMENTS
// ============================================

/**
 * Listar anexos da OS
 */
export async function listWorkOrderAttachments(workOrderId: string): Promise<Attachment[]> {
  try {
    const response = await api.get<Attachment[]>(`/attachments/by-work-order/${workOrderId}`);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Upload de anexo para OS
 *
 * SEGURANÇA:
 * - Validação de tipo MIME
 * - Validação de extensão
 * - Validação de tamanho (10MB)
 * - Sanitização de nome de arquivo
 * - Magic number validation (previne file type spoofing)
 */
export async function uploadWorkOrderAttachment(
  workOrderId: string,
  file: File
): Promise<Attachment> {
  try {
    // IMPORTANTE: Importa funções de sanitização
    const { validateFileUpload, sanitizeFileName } = await import('@/lib/sanitize');

    // Validação completa de segurança
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx'];

    const validation = validateFileUpload(file, {
      maxSizeMB: 10,
      allowedExtensions,
      allowedMimeTypes: allowedTypes,
    });

    if (!validation.valid) {
      throw new Error(validation.error || 'Arquivo inválido');
    }

    // Previne null bytes no nome do arquivo (path traversal)
    if (file.name.includes('\0')) {
      throw new Error('Nome de arquivo inválido');
    }

    // Sanitiza nome do arquivo
    const safeName = validation.sanitizedName || sanitizeFileName(file.name);

    // Cria novo File com nome sanitizado
    const safeFile = new File([file], safeName, { type: file.type });

    const formData = new FormData();
    formData.append('file', safeFile);
    formData.append('workOrderId', workOrderId);
    formData.append('type', 'PHOTO'); // Tipo padrão para anexos de OS

    const response = await api.post<Attachment>('/attachments', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Deletar anexo
 */
export async function deleteAttachment(attachmentId: string): Promise<void> {
  try {
    await api.delete(`/attachments/${attachmentId}`);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

// ============================================
// API FUNCTIONS - SERVICE FLOW
// ============================================

/**
 * Converter orçamento em OS
 */
export async function convertQuoteToWorkOrder(
  quoteId: string,
  data?: Partial<CreateWorkOrderDto>
): Promise<WorkOrder> {
  try {
    const response = await api.post<WorkOrder>(
      `/service-flow/quote/${quoteId}/convert-to-work-order`,
      data
    );
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Marcar OS como concluída (via service-flow)
 */
export async function completeWorkOrder(workOrderId: string): Promise<WorkOrder> {
  try {
    const response = await api.post<WorkOrder>(
      `/service-flow/work-order/${workOrderId}/complete`
    );
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Obter timeline do cliente
 */
export async function getClientTimeline(clientId: string): Promise<TimelineEvent[]> {
  try {
    const response = await api.get<TimelineEvent[]>(
      `/service-flow/client/${clientId}/timeline`
    );
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Obter extrato da OS
 */
export async function getWorkOrderExtract(workOrderId: string): Promise<WorkOrderExtract> {
  try {
    const response = await api.get<WorkOrderExtract>(
      `/service-flow/work-order/${workOrderId}/extract`
    );
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Gerar pagamento da OS
 */
export async function generateWorkOrderPayment(
  workOrderId: string,
  data: {
    billingType: 'BOLETO' | 'PIX' | 'CREDIT_CARD';
    dueDate: string;
    value?: number;
    description?: string;
  }
): Promise<unknown> {
  try {
    const response = await api.post(
      `/service-flow/work-order/${workOrderId}/generate-payment`,
      data
    );
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Gerar ou obter link de compartilhamento da OS
 */
export async function getWorkOrderShareLink(workOrderId: string): Promise<{ shareKey: string }> {
  try {
    const response = await api.post(`/work-orders/${workOrderId}/share`);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Abrir WhatsApp com link da OS
 *
 * SEGURANÇA:
 * - Valida phone number (previne injection)
 * - Sanitiza strings para URL encoding
 * - Usa apenas URLs whitelisted (wa.me)
 */
export function shareWorkOrderViaWhatsApp(
  shareKey: string,
  clientPhone: string | null | undefined,
  workOrderTitle: string,
  companyName: string
): void {
  // Valida shareKey (deve ser alfanumérico)
  if (!/^[a-zA-Z0-9_-]+$/.test(shareKey)) {
    throw new Error('Share key inválido');
  }

  // Monta a URL pública da OS
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const publicUrl = `${baseUrl}/os/${encodeURIComponent(shareKey)}`;

  // Sanitiza strings para mensagem
  const safeTitle = workOrderTitle.substring(0, 200); // Limita tamanho
  const safeCompany = companyName.substring(0, 100);

  // Monta a mensagem
  const message = encodeURIComponent(
    `Olá! Segue o link da sua Ordem de Serviço:\n\n` +
    `*${safeTitle}*\n\n` +
    `${publicUrl}\n\n` +
    `${safeCompany}`
  );

  if (clientPhone) {
    // Limpa o telefone - apenas números
    const cleanPhone = clientPhone.replace(/\D/g, '');

    // Valida formato brasileiro (10 ou 11 dígitos)
    if (cleanPhone.length < 10 || cleanPhone.length > 13) {
      throw new Error('Telefone inválido');
    }

    // Adiciona código do país se necessário
    const phoneWithCountry = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

    // IMPORTANTE: URL hardcoded (não aceita input do usuário)
    window.open(`https://wa.me/${phoneWithCountry}?text=${message}`, '_blank', 'noopener,noreferrer');
  } else {
    // Se não tem telefone, abre WhatsApp Web sem número
    window.open(`https://wa.me/?text=${message}`, '_blank', 'noopener,noreferrer');
  }
}

// ============================================
// EMAIL
// ============================================

/**
 * Envia a ordem de serviço por email para o cliente
 */
export async function sendWorkOrderEmail(workOrderId: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await api.post<{ success: boolean; message: string }>(`/work-orders/${workOrderId}/send-email`);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

// ============================================
// EXPORT SERVICE OBJECT
// ============================================

export const workOrdersService = {
  // Work Orders
  listWorkOrders,
  getWorkOrderById,
  createWorkOrder,
  updateWorkOrder,
  deleteWorkOrder,
  updateWorkOrderStatus,
  // Items
  addWorkOrderItem,
  updateWorkOrderItem,
  removeWorkOrderItem,
  // Equipments
  addWorkOrderEquipment,
  removeWorkOrderEquipment,
  // Checklists
  listChecklistTemplates,
  getChecklistTemplate,
  createWorkOrderChecklist,
  listWorkOrderChecklists,
  getWorkOrderChecklist,
  submitChecklistAnswers,
  deleteWorkOrderChecklist,
  // Attachments
  listWorkOrderAttachments,
  uploadWorkOrderAttachment,
  deleteAttachment,
  // Service Flow
  convertQuoteToWorkOrder,
  completeWorkOrder,
  getClientTimeline,
  getWorkOrderExtract,
  generateWorkOrderPayment,
  // Share
  getWorkOrderShareLink,
  shareWorkOrderViaWhatsApp,
  // Email
  sendWorkOrderEmail,
  // Helpers
  canEditWorkOrder,
  canStartWorkOrder,
  canCompleteWorkOrder,
  canCancelWorkOrder,
  isWorkOrderActive,
  isWorkOrderFinished,
};

export default workOrdersService;
