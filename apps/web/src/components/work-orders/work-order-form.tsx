'use client';

/**
 * WorkOrderForm - Formulário de Ordem de Serviço
 *
 * Permite:
 * - Selecionar cliente
 * - Definir título e descrição
 * - Agendar data/hora
 * - Adicionar itens do catálogo ou manuais
 * - Adicionar observações
 */

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { WorkOrderItemsTable } from '@/components/work-orders';
import { CatalogSelectModal } from '@/components/quotes';
import { QuickClientModal } from '@/components/clients';
import { useAuth } from '@/context/auth-context';
import { useFormatting } from '@/context';
import { useSearchClients } from '@/hooks/use-clients';
import { useQuote } from '@/hooks/use-quotes';
import {
  useCreateWorkOrder,
  useUpdateWorkOrder,
  useAddWorkOrderItem,
  useRemoveWorkOrderItem,
} from '@/hooks/use-work-orders';
import { useChecklistTemplates } from '@/hooks/use-checklists';
import { useActiveWorkOrderTypes } from '@/hooks/use-work-order-types';
import {
  WorkOrder,
  WorkOrderItem,
  CreateWorkOrderDto,
  UpdateWorkOrderDto,
  AddWorkOrderItemDto,
} from '@/services/work-orders.service';
import { Client, getClientById } from '@/services/clients.service';
import {
  Save,
  X,
  User,
  Plus,
  Search,
  Package,
  Calendar,
  MapPin,
  FileText,
  AlertCircle,
  ClipboardCheck,
  Tag,
  UserPlus,
} from 'lucide-react';

interface WorkOrderFormProps {
  workOrder?: WorkOrder;
  onSuccess?: (workOrder: WorkOrder) => void;
  onCancel?: () => void;
  preselectedClientId?: string;
}

interface FormErrors {
  clientId?: string;
  title?: string;
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
  itemId?: string;
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
  const [showQuickClientModal, setShowQuickClientModal] = useState(false);

  const { data: clients, isLoading } = useSearchClients(
    search,
    isSearching && search.length >= 2
  );

  const handleSelect = (client: Client) => {
    onSelect(client);
    setIsSearching(false);
    setSearch('');
  };

  const handleClientCreated = (client: Client) => {
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
    <>
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
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
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowQuickClientModal(true)}
            disabled={disabled}
            title="Cadastrar novo cliente"
          >
            <UserPlus className="h-4 w-4" />
          </Button>
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
              <div className="p-4 text-center">
                <p className="text-sm text-gray-500 mb-3">Nenhum cliente encontrado</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowQuickClientModal(true)}
                  leftIcon={<UserPlus className="h-4 w-4" />}
                >
                  Cadastrar novo cliente
                </Button>
              </div>
            )}
          </div>
        )}

        {error && <p className="text-sm text-error">{error}</p>}
      </div>

      {/* Modal de cadastro rápido de cliente */}
      <QuickClientModal
        isOpen={showQuickClientModal}
        onClose={() => setShowQuickClientModal(false)}
        onClientCreated={handleClientCreated}
        initialName={search}
      />
    </>
  );
}

export function WorkOrderForm({ workOrder, onSuccess, onCancel, preselectedClientId }: WorkOrderFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { billing } = useAuth();
  const { formatCurrency } = useFormatting();

  const quoteId = searchParams.get('quoteId');
  const { data: quote, isLoading: isLoadingQuote } = useQuote(quoteId || undefined);

  const createWorkOrder = useCreateWorkOrder();
  const updateWorkOrder = useUpdateWorkOrder();
  const addItem = useAddWorkOrderItem();
  const removeItem = useRemoveWorkOrderItem();

  // Buscar templates de checklist ativos
  const { data: checklistTemplates, isLoading: isLoadingTemplates } = useChecklistTemplates(false);

  // Buscar tipos de OS ativos
  const { data: workOrderTypes, isLoading: isLoadingTypes } = useActiveWorkOrderTypes();

  const isEditing = !!workOrder;

  // Form state
  const [selectedClient, setSelectedClient] = useState<Client | null>(
    workOrder?.client ? (workOrder.client as unknown as Client) : null
  );
  const [title, setTitle] = useState(workOrder?.title || '');
  const [description, setDescription] = useState(workOrder?.description || '');
  const [scheduledDate, setScheduledDate] = useState(
    workOrder?.scheduledDate?.split('T')[0] || ''
  );
  const [scheduledStartTime, setScheduledStartTime] = useState(
    workOrder?.scheduledStartTime?.split('T')[1]?.substring(0, 5) || ''
  );
  const [scheduledEndTime, setScheduledEndTime] = useState(
    workOrder?.scheduledEndTime?.split('T')[1]?.substring(0, 5) || ''
  );
  const [address, setAddress] = useState(workOrder?.address || '');
  const [notes, setNotes] = useState(workOrder?.notes || '');
  const [items, setItems] = useState<LocalItem[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [showUpsellModal, setShowUpsellModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedChecklistTemplateId, setSelectedChecklistTemplateId] = useState<string>('');
  const [selectedWorkOrderTypeId, setSelectedWorkOrderTypeId] = useState<string>(
    workOrder?.workOrderTypeId || ''
  );

  // Inicializa com dados do orçamento (conversão)
  useEffect(() => {
    if (quote && !workOrder) {
      setSelectedClient(quote.client as unknown as Client);
      setTitle(`OS - ${quote.client?.name || 'Cliente'}`);

      // Converter itens do orçamento - garantir valores válidos
      if (quote.items) {
        setItems(
          quote.items.map((item) => {
            // Garantir que quantity seja pelo menos 0.001
            const quantity = Number(item.quantity) || 0;
            const safeQuantity = quantity > 0 ? quantity : 1;

            // Garantir que unitPrice seja >= 0
            const unitPrice = Number(item.unitPrice) || 0;
            const safeUnitPrice = unitPrice >= 0 ? unitPrice : 0;

            // Garantir que discountValue seja >= 0
            const discountValue = Number(item.discountValue) || 0;
            const safeDiscountValue = discountValue >= 0 ? discountValue : 0;

            return {
              id: `temp-${item.id}`,
              name: item.name || 'Item',
              type: item.type || 'SERVICE',
              unit: item.unit || 'un',
              quantity: safeQuantity,
              unitPrice: safeUnitPrice,
              discountValue: safeDiscountValue,
              totalPrice: (safeQuantity * safeUnitPrice) - safeDiscountValue,
              itemId: item.productServiceItemId,
            };
          })
        );
      }
    }
  }, [quote, workOrder]);

  // Inicializa itens da OS existente
  useEffect(() => {
    if (workOrder?.items) {
      setItems(
        workOrder.items.map((item) => ({
          id: item.id,
          name: item.name,
          type: item.type,
          unit: item.unit,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountValue: item.discountValue,
          totalPrice: item.totalPrice,
          itemId: item.itemId,
        }))
      );
    }
  }, [workOrder]);

  // Carregar cliente pré-selecionado
  useEffect(() => {
    if (preselectedClientId && !selectedClient && !quoteId) {
      getClientById(preselectedClientId)
        .then((client) => {
          setSelectedClient(client);
        })
        .catch((error) => {
          console.error('Erro ao carregar cliente pré-selecionado:', error);
        });
    }
  }, [preselectedClientId, selectedClient, quoteId]);

  // Cálculos
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const totalDiscount = items.reduce((sum, item) => sum + item.discountValue, 0);
  const totalValue = subtotal - totalDiscount;

  // Validação
  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!selectedClient) {
      newErrors.clientId = 'Selecione um cliente';
    }

    if (!title.trim()) {
      newErrors.title = 'Informe o título da OS';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Adicionar item do catálogo
  const handleAddCatalogItem = (data: AddWorkOrderItemDto) => {
    if (isEditing && workOrder) {
      addItem.mutate(
        { workOrderId: workOrder.id, data },
        {
          onSuccess: (updatedWorkOrder) => {
            if (updatedWorkOrder.items) {
              setItems(
                updatedWorkOrder.items.map((item) => ({
                  id: item.id,
                  name: item.name,
                  type: item.type,
                  unit: item.unit,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  discountValue: item.discountValue,
                  totalPrice: item.totalPrice,
                  itemId: item.itemId,
                }))
              );
            }
          },
        }
      );
    } else {
      const newItem: LocalItem = {
        id: `temp-${Date.now()}`,
        name: data.name || 'Item',
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

    if (errors.items) {
      setErrors((prev) => ({ ...prev, items: undefined }));
    }
  };

  // Remover item
  const handleRemoveItem = (item: WorkOrderItem | LocalItem) => {
    if (isEditing && workOrder && !item.id.startsWith('temp-')) {
      removeItem.mutate(
        { workOrderId: workOrder.id, itemId: item.id },
        {
          onSuccess: (updatedWorkOrder) => {
            if (updatedWorkOrder.items) {
              setItems(
                updatedWorkOrder.items.map((i) => ({
                  id: i.id,
                  name: i.name,
                  type: i.type,
                  unit: i.unit,
                  quantity: i.quantity,
                  unitPrice: i.unitPrice,
                  discountValue: i.discountValue,
                  totalPrice: i.totalPrice,
                  itemId: i.itemId,
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
      let result: WorkOrder;

      if (isEditing && workOrder) {
        const updateData: UpdateWorkOrderDto = {
          title,
          description: description || undefined,
          scheduledDate: scheduledDate || undefined,
          scheduledStartTime: scheduledDate && scheduledStartTime
            ? `${scheduledDate}T${scheduledStartTime}:00`
            : undefined,
          scheduledEndTime: scheduledDate && scheduledEndTime
            ? `${scheduledDate}T${scheduledEndTime}:00`
            : undefined,
          address: address || undefined,
          notes: notes || undefined,
          workOrderTypeId: selectedWorkOrderTypeId || null,
        };
        result = await updateWorkOrder.mutateAsync({
          id: workOrder.id,
          data: updateData,
        });
      } else {
        const createData: CreateWorkOrderDto = {
          clientId: selectedClient!.id,
          quoteId: quoteId || undefined,
          title,
          description: description || undefined,
          scheduledDate: scheduledDate || undefined,
          scheduledStartTime: scheduledDate && scheduledStartTime
            ? `${scheduledDate}T${scheduledStartTime}:00`
            : undefined,
          scheduledEndTime: scheduledDate && scheduledEndTime
            ? `${scheduledDate}T${scheduledEndTime}:00`
            : undefined,
          address: address || undefined,
          notes: notes || undefined,
          checklistTemplateId: selectedChecklistTemplateId || undefined,
          workOrderTypeId: selectedWorkOrderTypeId || undefined,
        };
        result = await createWorkOrder.mutateAsync(createData);

        // Adicionar itens após criar - garantir valores válidos
        for (const item of items) {
          // Validar e sanitizar valores antes de enviar
          const quantity = Number(item.quantity) || 0;
          const safeQuantity = quantity > 0 ? quantity : 1;

          const unitPrice = Number(item.unitPrice) || 0;
          const safeUnitPrice = unitPrice >= 0 ? unitPrice : 0;

          const discountValue = Number(item.discountValue) || 0;
          const safeDiscountValue = discountValue >= 0 ? discountValue : 0;

          await addItem.mutateAsync({
            workOrderId: result.id,
            data: {
              itemId: item.itemId || undefined,
              name: item.itemId ? undefined : (item.name || 'Item'),
              type: item.itemId ? undefined : (item.type || 'SERVICE'),
              unit: item.itemId ? undefined : (item.unit || 'un'),
              quantity: safeQuantity,
              unitPrice: item.itemId ? undefined : safeUnitPrice,
              discountValue: safeDiscountValue > 0 ? safeDiscountValue : undefined,
            },
          });
        }
      }

      if (onSuccess) {
        onSuccess(result);
      } else {
        router.push(`/work-orders/${result.id}`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '';

      if (errorMessage.includes('LIMIT_REACHED') || errorMessage.includes('limite')) {
        setShowUpsellModal(true);
      } else {
        setErrors({
          general: errorMessage || 'Erro ao salvar ordem de serviço. Tente novamente.',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      router.back();
    }
  };

  const isLoading =
    isSubmitting ||
    createWorkOrder.isPending ||
    updateWorkOrder.isPending ||
    addItem.isPending ||
    removeItem.isPending;

  if (quoteId && isLoadingQuote) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

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

        {/* Cliente */}
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
              disabled={isLoading || isEditing || !!quoteId}
            />
          </CardContent>
        </Card>

        {/* Informações da OS */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Informações da OS
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField label="Título *" error={errors.title}>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Manutenção ar-condicionado"
                error={!!errors.title}
                disabled={isLoading}
              />
            </FormField>

            <FormField label="Descrição">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrição detalhada do serviço..."
                rows={3}
                disabled={isLoading}
              />
            </FormField>

            {/* Tipo de OS - Apenas se tiver tipos cadastrados */}
            {workOrderTypes && workOrderTypes.length > 0 && (
              <FormField label="Tipo de OS">
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <select
                    value={selectedWorkOrderTypeId}
                    onChange={(e) => setSelectedWorkOrderTypeId(e.target.value)}
                    disabled={isLoading || isLoadingTypes}
                    className="w-full h-10 pl-10 pr-3 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed appearance-none"
                  >
                    <option value="">Sem tipo definido</option>
                    {workOrderTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                  {/* Color indicator */}
                  {selectedWorkOrderTypeId && (
                    <div
                      className="absolute right-10 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border"
                      style={{
                        backgroundColor: workOrderTypes.find(t => t.id === selectedWorkOrderTypeId)?.color || '#6B7280',
                      }}
                    />
                  )}
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                    <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </FormField>
            )}
          </CardContent>
        </Card>

        {/* Agendamento */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Agendamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField label="Data">
                <Input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  disabled={isLoading}
                />
              </FormField>

              <FormField label="Hora início">
                <Input
                  type="time"
                  value={scheduledStartTime}
                  onChange={(e) => setScheduledStartTime(e.target.value)}
                  disabled={isLoading || !scheduledDate}
                />
              </FormField>

              <FormField label="Hora fim">
                <Input
                  type="time"
                  value={scheduledEndTime}
                  onChange={(e) => setScheduledEndTime(e.target.value)}
                  disabled={isLoading || !scheduledDate}
                />
              </FormField>
            </div>

            <FormField label="Endereço do serviço">
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Endereço onde será realizado o serviço"
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
            </FormField>
          </CardContent>
        </Card>

        {/* Checklist Template - Apenas para criação */}
        {!isEditing && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5" />
                Checklist
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FormField label="Template de Checklist">
                <select
                  value={selectedChecklistTemplateId}
                  onChange={(e) => setSelectedChecklistTemplateId(e.target.value)}
                  disabled={isLoading || isLoadingTemplates}
                  className="w-full h-10 px-3 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">Nenhum checklist (opcional)</option>
                  {checklistTemplates?.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                      {template.description ? ` - ${template.description}` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-sm text-gray-500 mt-1">
                  Selecione um checklist para o técnico preencher durante a execução do serviço.
                </p>
              </FormField>
            </CardContent>
          </Card>
        )}

        {/* Itens */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Itens da OS
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

            <WorkOrderItemsTable
              items={items as unknown as WorkOrderItem[]}
              isEditable={true}
              isLoading={addItem.isPending || removeItem.isPending}
              onRemoveItem={handleRemoveItem}
            />

            {/* Resumo */}
            {items.length > 0 && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between text-lg font-semibold">
                  <span className="text-gray-700">Total:</span>
                  <span className="text-gray-900">{formatCurrency(totalValue)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Observações */}
        <Card>
          <CardHeader>
            <CardTitle>Observações</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações sobre a ordem de serviço..."
              rows={3}
              disabled={isLoading}
            />
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
              {isLoading ? 'Salvando...' : 'Salvar OS'}
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
        resource="WORK_ORDER"
        currentPlan={billing?.planKey || 'TRIAL'}
        max={-1}
        current={0}
      />
    </>
  );
}

export default WorkOrderForm;
