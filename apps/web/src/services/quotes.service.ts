/**
 * Quotes Service - Serviço de Orçamentos
 *
 * Gerencia:
 * - CRUD de orçamentos
 * - Itens do orçamento
 * - Mudança de status
 * - Geração de PDF
 * - Links públicos
 */

import api, { getErrorMessage } from './api';

/**
 * Status do orçamento
 */
export type QuoteStatus = 'DRAFT' | 'SENT' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

/**
 * Tipo de item
 */
export type QuoteItemType = 'PRODUCT' | 'SERVICE' | 'BUNDLE';

/**
 * Item do orçamento
 */
export interface QuoteItem {
  id: string;
  quoteId: string;
  productServiceItemId?: string;
  name: string;
  type: QuoteItemType;
  unit: string;
  quantity: number;
  unitPrice: number;
  discountValue: number;
  totalPrice: number;
  createdAt: string;
  // Dados do item do catálogo (quando existir)
  productServiceItem?: {
    id: string;
    name: string;
    type: QuoteItemType;
    basePrice: number;
    unit: string;
  };
}

/**
 * Orçamento
 */
export interface Quote {
  id: string;
  userId: string;
  clientId: string;
  number: number;
  status: QuoteStatus;
  discountValue: number;
  totalValue: number;
  notes?: string;
  validUntil?: string;
  sentAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  createdAt: string;
  updatedAt: string;
  // Relacionamentos
  client: {
    id: string;
    name: string;
    email?: string;
    phone: string;
    taxId: string;
  };
  items?: QuoteItem[];
  _count?: {
    items: number;
  };
}

/**
 * Parâmetros de busca de orçamentos
 */
export interface QuoteSearchParams {
  clientId?: string;
  status?: QuoteStatus;
  search?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * DTO para criar item do orçamento
 * Suporta itens do catálogo (com itemId) ou itens manuais (com name, type, unit, unitPrice)
 */
export interface CreateQuoteItemDto {
  // Item do catálogo
  itemId?: string;
  // Item manual
  name?: string;
  type?: QuoteItemType;
  unit?: string;
  unitPrice?: number;
  // Comum
  quantity: number;
}

/**
 * DTO para adicionar item ao orçamento (após criação)
 */
export interface AddQuoteItemDto {
  // Do catálogo
  itemId?: string;
  // Manual
  name?: string;
  type?: QuoteItemType;
  unit?: string;
  unitPrice?: number;
  // Comum
  quantity: number;
  discountValue?: number;
}

/**
 * DTO para criar orçamento
 */
export interface CreateQuoteDto {
  clientId: string;
  items: CreateQuoteItemDto[];
  discountValue?: number;
  notes?: string;
}

/**
 * DTO para atualizar orçamento
 */
export interface UpdateQuoteDto {
  discountValue?: number;
  notes?: string;
  validUntil?: string;
}

/**
 * DTO para atualizar item do orçamento
 */
export interface UpdateQuoteItemDto {
  quantity?: number;
  unitPrice?: number;
  discountValue?: number;
}

/**
 * Item do catálogo (ProductServiceItem)
 */
export interface CatalogItem {
  id: string;
  name: string;
  description?: string;
  type: QuoteItemType;
  basePrice: number;
  unit: string;
  isActive: boolean;
  categoryId?: string;
  category?: {
    id: string;
    name: string;
  };
}

/**
 * Categoria do catálogo
 */
export interface CatalogCategory {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  _count?: {
    items: number;
  };
}

/**
 * Resposta da geração de PDF
 */
export interface GeneratePdfResponse {
  attachmentId: string;
  message: string;
}

/**
 * Resposta do link público
 */
export interface PublicLinkResponse {
  id: string;
  token: string;
  url: string;
  expiresAt: string;
}

// ============================================
// QUOTES
// ============================================

/**
 * Listar orçamentos
 */
export async function listQuotes(params?: QuoteSearchParams): Promise<Quote[]> {
  try {
    const response = await api.get<Quote[]>('/quotes', { params });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Obter orçamento por ID
 */
export async function getQuoteById(id: string): Promise<Quote> {
  try {
    const response = await api.get<Quote>(`/quotes/${id}`);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Criar orçamento
 */
export async function createQuote(data: CreateQuoteDto): Promise<Quote> {
  try {
    const response = await api.post<Quote>('/quotes', data);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Atualizar orçamento
 */
export async function updateQuote(id: string, data: UpdateQuoteDto): Promise<Quote> {
  try {
    const response = await api.put<Quote>(`/quotes/${id}`, data);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Deletar orçamento
 */
export async function deleteQuote(id: string): Promise<void> {
  try {
    await api.delete(`/quotes/${id}`);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Atualizar status do orçamento
 */
export async function updateQuoteStatus(
  id: string,
  status: QuoteStatus,
  reason?: string
): Promise<Quote> {
  try {
    const response = await api.patch<Quote>(`/quotes/${id}/status`, {
      status,
      ...(reason && { reason }),
    });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

// ============================================
// QUOTE ITEMS
// ============================================

/**
 * Adicionar item ao orçamento
 */
export async function addQuoteItem(quoteId: string, data: AddQuoteItemDto): Promise<Quote> {
  try {
    const response = await api.post<Quote>(`/quotes/${quoteId}/items`, data);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Atualizar item do orçamento
 */
export async function updateQuoteItem(
  quoteId: string,
  itemId: string,
  data: UpdateQuoteItemDto
): Promise<Quote> {
  try {
    const response = await api.put<Quote>(`/quotes/${quoteId}/items/${itemId}`, data);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Remover item do orçamento
 */
export async function removeQuoteItem(quoteId: string, itemId: string): Promise<Quote> {
  try {
    const response = await api.delete<Quote>(`/quotes/${quoteId}/items/${itemId}`);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

// ============================================
// CATALOG (Products/Services)
// ============================================

/**
 * Listar itens do catálogo
 */
export async function listCatalogItems(params?: {
  type?: QuoteItemType;
  categoryId?: string;
  search?: string;
  isActive?: boolean;
}): Promise<CatalogItem[]> {
  try {
    const response = await api.get<CatalogItem[]>('/products/items', { params });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Listar categorias do catálogo
 */
export async function listCatalogCategories(isActive?: boolean): Promise<CatalogCategory[]> {
  try {
    const response = await api.get<CatalogCategory[]>('/products/categories', {
      params: { isActive },
    });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

// ============================================
// PDF & PUBLIC LINKS
// ============================================

/**
 * Gerar PDF do orçamento
 */
export async function generateQuotePdf(quoteId: string): Promise<GeneratePdfResponse> {
  try {
    const response = await api.post<GeneratePdfResponse>(`/quotes/${quoteId}/generate-pdf`);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Baixar PDF do orçamento diretamente
 */
export async function downloadQuotePdf(quoteId: string): Promise<Blob> {
  if (process.env.NODE_ENV === 'development') {
    console.log('[downloadQuotePdf] Iniciando requisição para:', quoteId);
  }

  try {
    const response = await api.post(`/quotes/${quoteId}/generate-pdf`, undefined, {
      params: { download: 'true' },
      responseType: 'blob',
    });

    if (process.env.NODE_ENV === 'development') {
      console.log('[downloadQuotePdf] Resposta recebida:', response.status);
    }

    return response.data;
  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[downloadQuotePdf] Erro capturado:', error);
    }

    // Quando responseType é 'blob', erros também vêm como blob
    // Precisamos extrair a mensagem de erro do blob
    if (error?.response?.data instanceof Blob) {
      try {
        const errorText = await error.response.data.text();

        if (process.env.NODE_ENV === 'development') {
          console.error('[downloadQuotePdf] Erro blob text:', errorText);
        }

        const errorJson = JSON.parse(errorText);
        throw new Error(errorJson.message || 'Erro ao gerar PDF');
      } catch (parseError) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[downloadQuotePdf] Erro ao parsear blob:', parseError);
        }

        throw new Error(`Erro ao gerar PDF: ${error?.response?.status || 'desconhecido'}`);
      }
    }
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Criar link público para attachment
 */
export async function createPublicLink(
  attachmentId: string,
  expiresInDays?: number
): Promise<PublicLinkResponse> {
  try {
    const response = await api.post<PublicLinkResponse>(
      `/attachments/${attachmentId}/public-link`,
      { expiresInDays }
    );
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Obter attachments do orçamento
 */
export async function getQuoteAttachments(quoteId: string): Promise<any[]> {
  try {
    const response = await api.get(`/attachments/by-quote/${quoteId}`);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

// ============================================
// HELPERS
// ============================================

/**
 * Verifica se o orçamento pode ser editado
 */
export function canEditQuote(quote: Quote): boolean {
  return quote.status === 'DRAFT';
}

/**
 * Verifica se o orçamento pode ser enviado
 */
export function canSendQuote(quote: Quote): boolean {
  return quote.status === 'DRAFT' && (quote.items?.length || 0) > 0;
}

/**
 * Verifica se o orçamento pode ser aprovado/rejeitado
 */
export function canApproveRejectQuote(quote: Quote): boolean {
  return quote.status === 'SENT';
}

/**
 * Verifica se o orçamento pode ser convertido em OS
 */
export function canConvertToWorkOrder(quote: Quote): boolean {
  return quote.status === 'APPROVED';
}

/**
 * Gera mensagem para WhatsApp
 */
export function generateWhatsAppMessage(quote: Quote, publicLink: string): string {
  const formattedValue = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(quote.totalValue);

  return encodeURIComponent(
    `Olá! Segue seu orçamento no valor de ${formattedValue}.\n\n` +
    `Acesse em: ${publicLink}\n\n` +
    `Qualquer dúvida estou à disposição!`
  );
}

/**
 * Abre WhatsApp com mensagem
 */
export function openWhatsApp(phone: string | null | undefined, message: string): void {
  if (!phone) {
    alert('Cliente não possui telefone cadastrado');
    return;
  }
  const cleanPhone = phone.replace(/\D/g, '');
  const phoneWithCountry = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
  window.open(`https://wa.me/${phoneWithCountry}?text=${message}`, '_blank');
}

/**
 * Gera ou obtém o shareKey para compartilhamento público do orçamento
 */
export async function getQuoteShareLink(quoteId: string): Promise<{ shareKey: string }> {
  try {
    const response = await api.post<{ shareKey: string }>(`/quotes/${quoteId}/share`);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export const quotesService = {
  // Quotes
  listQuotes,
  getQuoteById,
  createQuote,
  updateQuote,
  deleteQuote,
  updateQuoteStatus,
  // Items
  addQuoteItem,
  updateQuoteItem,
  removeQuoteItem,
  // Catalog
  listCatalogItems,
  listCatalogCategories,
  // PDF & Links
  generateQuotePdf,
  downloadQuotePdf,
  createPublicLink,
  getQuoteAttachments,
  getQuoteShareLink,
  // Helpers
  canEditQuote,
  canSendQuote,
  canApproveRejectQuote,
  canConvertToWorkOrder,
  generateWhatsAppMessage,
  openWhatsApp,
};

export default quotesService;
