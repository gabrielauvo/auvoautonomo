'use client';

/**
 * Quote Form - Formulário de orçamento
 *
 * Permite:
 * - Selecionar cliente
 * - Adicionar itens do catálogo ou manuais
 * - Aplicar descontos
 * - Adicionar observações
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Button,
  Input,
  Textarea,
  FormField,
  Alert,
  Skeleton,
} from '@/components/ui';
import { UpsellModal } from '@/components/billing';
import { QuoteItemsTable, CatalogSelectModal } from '@/components/quotes';
import { useAuth } from '@/context/auth-context';
import { useSearchClients } from '@/hooks/use-clients';
import {
  useCreateQuote,
  useUpdateQuote,
  useAddQuoteItem,
  useRemoveQuoteItem,
  useUpdateQuoteItem,
} from '@/hooks/use-quotes';
import {
  Quote,
  QuoteItem,
  CreateQuoteDto,
  UpdateQuoteDto,
  AddQuoteItemDto,
} from '@/services/quotes.service';
import { Client, getClientById } from '@/services/clients.service';
import {
  Save,
  X,
  User,
  Plus,
  Search,
  FileText,
  AlertCircle,
  Package,
  Percent,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuoteFormProps {
  quote?: Quote;
  onSuccess?: (quote: Quote) => void;
  onCancel?: () => void;
  preselectedClientId?: string;
}

interface FormErrors {
  clientId?: string;
  items?: string;
  general?: string;
}

interface LocalItem {
  id: string;
  name: string;
  type: 'PRODUCT' | 'SERVICE' | 'BUNDLE';
  unit: string;
  quantity: number;
  unitPrice: number;
  discountValue: number;
  totalPrice: number;
  itemId?: string; // ID do catálogo (se veio do catálogo)
}

// Formatar valor em moeda
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

// Componente de seleção de cliente
function ClientSelector({
  selectedClient,
  onSelect,
  error,
  disabled,
}: {
  selectedClient: Client | null;
  onSelect: (client: Client) => void;
  error?: string;
  disabled: boolean;
}) {
  const [search, setSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const { data: clients, isLoading } = useSearchClients(search, isSearching && search.length >= 2);

  const handleSelect = (client: Client) => {
    onSelect(client);
    setIsSearching(false);
    setSearch('');
  };

  if (selectedClient && !isSearching) {
    return (
      <div className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary-100 text-primary font-medium">
            {selectedClient.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-gray-900">{selectedClient.name}</p>
            <p className="text-sm text-gray-500">{selectedClient.phone}</p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsSearching(true)}
          disabled={disabled}
        >
          Trocar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Buscar cliente por nome ou telefone..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsSearching(true);
          }}
          onFocus={() => setIsSearching(true)}
          className="pl-10"
          error={!!error}
          disabled={disabled}
        />
      </div>

      {isSearching && search.length >= 2 && (
        <div className="border rounded-lg max-h-48 overflow-y-auto">
          {isLoading ? (
            <div className="p-3">
              <Skeleton className="h-10 w-full" />
            </div>
          ) : clients && clients.length > 0 ? (
            clients.map((client) => (
              <button
                key={client.id}
                type="button"
                className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 border-b last:border-b-0 text-left"
                onClick={() => handleSelect(client)}
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-600 font-medium text-sm">
                  {client.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">{client.name}</p>
                  <p className="text-xs text-gray-500">{client.phone}</p>
                </div>
              </button>
            ))
          ) : (
            <div className="p-3 text-center text-sm text-gray-500">
              Nenhum cliente encontrado
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-error">{error}</p>}
    </div>
  );
}

export function QuoteForm({ quote, onSuccess, onCancel, preselectedClientId }: QuoteFormProps) {
  const router = useRouter();
  const { billing } = useAuth();
  const createQuote = useCreateQuote();
  const updateQuote = useUpdateQuote();
  const addQuoteItem = useAddQuoteItem();
  const removeQuoteItem = useRemoveQuoteItem();

  const isEditing = !!quote;

  // Form state
  const [selectedClient, setSelectedClient] = useState<Client | null>(
    quote?.client ? (quote.client as unknown as Client) : null
  );
  const [items, setItems] = useState<LocalItem[]>([]);
  const [discountValue, setDiscountValue] = useState(quote?.discountValue?.toString() || '0');
  const [validUntil, setValidUntil] = useState(quote?.validUntil?.split('T')[0] || '');
  const [notes, setNotes] = useState(quote?.notes || '');
  const [errors, setErrors] = useState<FormErrors>({});
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [showUpsellModal, setShowUpsellModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inicializa itens do orçamento existente
  useEffect(() => {
    if (quote?.items) {
      setItems(
        quote.items.map((item) => ({
          id: item.id,
          name: item.name,
          type: item.type,
          unit: item.unit,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountValue: item.discountValue,
          totalPrice: item.totalPrice,
          itemId: item.productServiceItemId,
        }))
      );
    }
  }, [quote]);

  // Carregar cliente pré-selecionado
  useEffect(() => {
    if (preselectedClientId && !selectedClient) {
      getClientById(preselectedClientId)
        .then((client) => {
          setSelectedClient(client);
        })
        .catch((error) => {
          console.error('Erro ao carregar cliente pré-selecionado:', error);
        });
    }
  }, [preselectedClientId, selectedClient]);

  // Cálculos
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const itemsDiscount = items.reduce((sum, item) => sum + item.discountValue, 0);
  const generalDiscount = parseFloat(discountValue) || 0;
  const totalValue = subtotal - itemsDiscount - generalDiscount;

  // Validação
  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!selectedClient) {
      newErrors.clientId = 'Selecione um cliente';
    }

    if (items.length === 0) {
      newErrors.items = 'Adicione pelo menos um item ao orçamento';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Adicionar item do catálogo
  const handleAddCatalogItem = (data: AddQuoteItemDto) => {
    // Para criação, adicionamos localmente
    // Para edição, chamamos a API
    if (isEditing && quote) {
      addQuoteItem.mutate(
        { quoteId: quote.id, data },
        {
          onSuccess: (updatedQuote) => {
            if (updatedQuote.items) {
              setItems(
                updatedQuote.items.map((item) => ({
                  id: item.id,
                  name: item.name,
                  type: item.type,
                  unit: item.unit,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  discountValue: item.discountValue,
                  totalPrice: item.totalPrice,
                  itemId: item.productServiceItemId,
                }))
              );
            }
          },
        }
      );
    } else {
      // Cria item local temporário
      const newItem: LocalItem = {
        id: `temp-${Date.now()}`,
        name: data.name || 'Item do catálogo',
        type: data.type || 'SERVICE',
        unit: data.unit || 'un',
        quantity: data.quantity,
        unitPrice: data.unitPrice || 0,
        discountValue: data.discountValue || 0,
        totalPrice: (data.quantity * (data.unitPrice || 0)) - (data.discountValue || 0),
        itemId: data.itemId,
      };
      setItems((prev) => [...prev, newItem]);
    }

    // Limpa erro de itens
    if (errors.items) {
      setErrors((prev) => ({ ...prev, items: undefined }));
    }
  };

  // Editar item
  const handleEditItem = (_item: QuoteItem | LocalItem) => {
    // TODO: Implementar modal de edição de item
    // Por enquanto, o usuário pode remover e adicionar novamente
  };

  // Remover item
  const handleRemoveItem = (item: QuoteItem | LocalItem) => {
    if (isEditing && quote && !item.id.startsWith('temp-')) {
      removeQuoteItem.mutate(
        { quoteId: quote.id, itemId: item.id },
        {
          onSuccess: (updatedQuote) => {
            if (updatedQuote.items) {
              setItems(
                updatedQuote.items.map((i) => ({
                  id: i.id,
                  name: i.name,
                  type: i.type,
                  unit: i.unit,
                  quantity: i.quantity,
                  unitPrice: i.unitPrice,
                  discountValue: i.discountValue,
                  totalPrice: i.totalPrice,
                  itemId: i.productServiceItemId,
                }))
              );
            }
          },
        }
      );
    } else {
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    }
  };

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // CRITICAL: Guard against duplicate submissions
    if (isSubmitting) {
      return;
    }

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      let result: Quote;

      if (isEditing && quote) {
        // Atualiza orçamento existente
        const updateData: UpdateQuoteDto = {
          discountValue: generalDiscount,
          validUntil: validUntil || undefined,
          notes: notes || undefined,
        };
        result = await updateQuote.mutateAsync({ id: quote.id, data: updateData });
      } else {
        // Cria novo orçamento
        const createData: CreateQuoteDto = {
          clientId: selectedClient!.id,
          items: items.map((item) => {
            if (item.itemId) {
              // Item do catálogo
              return {
                itemId: item.itemId,
                quantity: item.quantity,
              };
            } else {
              // Item manual
              return {
                name: item.name,
                type: item.type,
                unit: item.unit,
                unitPrice: item.unitPrice,
                quantity: item.quantity,
              };
            }
          }),
          discountValue: generalDiscount,
          notes: notes || undefined,
        };
        result = await createQuote.mutateAsync(createData);
      }

      if (onSuccess) {
        onSuccess(result);
      } else {
        router.push(`/quotes/${result.id}`);
      }
    } catch (error: any) {
      const errorMessage = error.message || '';

      if (errorMessage.includes('LIMIT_REACHED') || errorMessage.includes('limite')) {
        setShowUpsellModal(true);
      } else {
        setErrors({
          general: errorMessage || 'Erro ao salvar orçamento. Tente novamente.',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler de cancelar
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      router.back();
    }
  };

  const isLoading =
    isSubmitting ||
    createQuote.isPending ||
    updateQuote.isPending ||
    addQuoteItem.isPending ||
    removeQuoteItem.isPending;

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Erro geral */}
        {errors.general && (
          <Alert variant="error">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {errors.general}
            </div>
          </Alert>
        )}

        {/* Seleção de cliente */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Cliente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ClientSelector
              selectedClient={selectedClient}
              onSelect={setSelectedClient}
              error={errors.clientId}
              disabled={isLoading || isEditing}
            />
          </CardContent>
        </Card>

        {/* Itens do orçamento */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Itens do Orçamento
              </CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowCatalogModal(true)}
                leftIcon={<Plus className="h-4 w-4" />}
                disabled={isLoading}
              >
                Adicionar Item
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {errors.items && (
              <Alert variant="error" className="mb-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {errors.items}
                </div>
              </Alert>
            )}

            <QuoteItemsTable
              items={items as unknown as QuoteItem[]}
              isEditable={true}
              isLoading={addQuoteItem.isPending || removeQuoteItem.isPending}
              onEditItem={handleEditItem}
              onRemoveItem={handleRemoveItem}
            />
          </CardContent>
        </Card>

        {/* Resumo e desconto */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5" />
              Desconto e Observações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField label="Desconto geral (R$)">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder="0,00"
                  disabled={isLoading}
                />
              </FormField>

              <FormField label="Validade">
                <Input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  disabled={isLoading}
                />
              </FormField>

              <div className="flex flex-col justify-end">
                <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Subtotal:</span>
                    <span className="text-gray-700">{formatCurrency(subtotal)}</span>
                  </div>
                  {(itemsDiscount > 0 || generalDiscount > 0) && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Descontos:</span>
                      <span className="text-error">
                        -{formatCurrency(itemsDiscount + generalDiscount)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-semibold pt-2 border-t">
                    <span className="text-gray-700">Total:</span>
                    <span className="text-gray-900">{formatCurrency(totalValue)}</span>
                  </div>
                </div>
              </div>
            </div>

            <FormField label="Observações">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observações sobre o orçamento..."
                rows={3}
                disabled={isLoading}
              />
            </FormField>
          </CardContent>

          <CardFooter className="flex justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={handleCancel}
              disabled={isLoading}
              leftIcon={<X className="h-4 w-4" />}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={isLoading}
              leftIcon={<Save className="h-4 w-4" />}
            >
              {isLoading ? 'Salvando...' : 'Salvar Orçamento'}
            </Button>
          </CardFooter>
        </Card>
      </form>

      {/* Modal de seleção de catálogo */}
      <CatalogSelectModal
        isOpen={showCatalogModal}
        onClose={() => setShowCatalogModal(false)}
        onSelect={handleAddCatalogItem}
      />

      {/* Modal de Upsell */}
      <UpsellModal
        isOpen={showUpsellModal}
        onClose={() => setShowUpsellModal(false)}
        resource="QUOTE"
        currentPlan={billing?.planKey || 'TRIAL'}
        max={-1}
        current={0}
      />
    </>
  );
}

export default QuoteForm;
