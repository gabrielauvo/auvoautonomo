/**
 * Hooks para o módulo de Orçamentos
 *
 * React Query hooks para:
 * - Listagem de orçamentos
 * - Detalhes do orçamento
 * - Operações CRUD
 * - Itens do orçamento
 * - Catálogo de produtos/serviços
 * - Geração de PDF
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  quotesService,
  Quote,
  QuoteSearchParams,
  CreateQuoteDto,
  UpdateQuoteDto,
  QuoteStatus,
  AddQuoteItemDto,
  UpdateQuoteItemDto,
  CatalogItem,
  CatalogCategory,
  QuoteItemType,
} from '@/services/quotes.service';

// ============================================
// QUOTES QUERIES
// ============================================

/**
 * Hook para listar orçamentos
 */
export function useQuotes(params?: QuoteSearchParams) {
  return useQuery<Quote[]>({
    queryKey: ['quotes', params],
    queryFn: () => quotesService.listQuotes(params),
    staleTime: 30000, // 30 segundos
  });
}

/**
 * Hook para obter orçamento por ID
 */
export function useQuote(id: string | undefined) {
  return useQuery<Quote>({
    queryKey: ['quote', id],
    queryFn: () => quotesService.getQuoteById(id!),
    enabled: !!id,
  });
}

// ============================================
// QUOTES MUTATIONS
// ============================================

/**
 * Hook para criar orçamento
 */
export function useCreateQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateQuoteDto) => quotesService.createQuote(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
  });
}

/**
 * Hook para atualizar orçamento
 */
export function useUpdateQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateQuoteDto }) =>
      quotesService.updateQuote(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['quote', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
  });
}

/**
 * Hook para deletar orçamento
 */
export function useDeleteQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => quotesService.deleteQuote(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
  });
}

/**
 * Hook para atualizar status do orçamento
 */
export function useUpdateQuoteStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: QuoteStatus; reason?: string }) =>
      quotesService.updateQuoteStatus(id, status, reason),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['quote', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      // Também invalida timeline do cliente se houver um relacionado
      queryClient.invalidateQueries({ queryKey: ['client'] });
    },
  });
}

// ============================================
// QUOTE ITEMS MUTATIONS
// ============================================

/**
 * Hook para adicionar item ao orçamento
 */
export function useAddQuoteItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ quoteId, data }: { quoteId: string; data: AddQuoteItemDto }) =>
      quotesService.addQuoteItem(quoteId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['quote', variables.quoteId] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
  });
}

/**
 * Hook para atualizar item do orçamento
 */
export function useUpdateQuoteItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      quoteId,
      itemId,
      data,
    }: {
      quoteId: string;
      itemId: string;
      data: UpdateQuoteItemDto;
    }) => quotesService.updateQuoteItem(quoteId, itemId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['quote', variables.quoteId] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
  });
}

/**
 * Hook para remover item do orçamento
 */
export function useRemoveQuoteItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ quoteId, itemId }: { quoteId: string; itemId: string }) =>
      quotesService.removeQuoteItem(quoteId, itemId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['quote', variables.quoteId] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
  });
}

// ============================================
// CATALOG QUERIES
// ============================================

/**
 * Hook para listar itens do catálogo
 */
export function useCatalogItems(params?: {
  type?: QuoteItemType;
  categoryId?: string;
  search?: string;
  isActive?: boolean;
}) {
  return useQuery<CatalogItem[]>({
    queryKey: ['catalog', 'items', params],
    queryFn: () => quotesService.listCatalogItems(params),
    staleTime: 60000, // 1 minuto
  });
}

/**
 * Hook para listar categorias do catálogo
 */
export function useCatalogCategories(isActive?: boolean) {
  return useQuery<CatalogCategory[]>({
    queryKey: ['catalog', 'categories', { isActive }],
    queryFn: () => quotesService.listCatalogCategories(isActive),
    staleTime: 60000, // 1 minuto
  });
}

// ============================================
// PDF & WHATSAPP
// ============================================

/**
 * Hook para gerar PDF do orçamento
 */
export function useGenerateQuotePdf() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (quoteId: string) => quotesService.generateQuotePdf(quoteId),
    onSuccess: (_, quoteId) => {
      // Invalida para recarregar attachments
      queryClient.invalidateQueries({ queryKey: ['quote', quoteId] });
    },
  });
}

/**
 * Hook para baixar PDF do orçamento
 */
export function useDownloadQuotePdf() {
  return useMutation({
    mutationFn: async (quoteId: string) => {
      console.log('[useDownloadQuotePdf] Iniciando download para:', quoteId);
      const blob = await quotesService.downloadQuotePdf(quoteId);
      console.log('[useDownloadQuotePdf] Blob recebido:', blob.size, 'bytes');
      // Cria link temporário para download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orcamento-${quoteId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      console.log('[useDownloadQuotePdf] Download completado');
      return blob;
    },
    onError: (error) => {
      console.error('[useDownloadQuotePdf] Erro na mutation:', error);
    },
  });
}

/**
 * Hook para criar link público e enviar WhatsApp
 */
export function useSendWhatsApp() {
  return useMutation({
    mutationFn: async ({
      quote,
      attachmentId,
    }: {
      quote: Quote;
      attachmentId: string;
    }) => {
      // Cria link público
      const publicLink = await quotesService.createPublicLink(attachmentId);
      // Gera mensagem
      const message = quotesService.generateWhatsAppMessage(quote, publicLink.url);
      // Abre WhatsApp
      quotesService.openWhatsApp(quote.client.phone, message);
      return publicLink;
    },
  });
}

/**
 * Hook para obter attachments do orçamento
 */
export function useQuoteAttachments(quoteId: string | undefined) {
  return useQuery({
    queryKey: ['quote', quoteId, 'attachments'],
    queryFn: () => quotesService.getQuoteAttachments(quoteId!),
    enabled: !!quoteId,
  });
}

/**
 * Hook para enviar orçamento por email
 */
export function useSendQuoteEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (quoteId: string) => quotesService.sendQuoteEmail(quoteId),
    onSuccess: (_, quoteId) => {
      queryClient.invalidateQueries({ queryKey: ['quote', quoteId] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
  });
}
