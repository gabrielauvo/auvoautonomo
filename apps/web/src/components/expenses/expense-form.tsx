'use client';

/**
 * Expense Form - Formulário de despesa
 *
 * Usado para criar e editar despesas
 */

import { useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from '@/i18n';
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
  Select,
} from '@/components/ui';
import { UpsellModal } from '@/components/billing';
import { useAuth } from '@/context/auth-context';
import { useCreateExpense, useUpdateExpense } from '@/hooks/use-expenses';
import { useExpenseCategories, useCreateExpenseCategory } from '@/hooks/use-expense-categories';
import { useSuppliers } from '@/hooks/use-suppliers';
import { useWorkOrders } from '@/hooks/use-work-orders';
import { Expense, CreateExpenseDto, ExpenseStatus, ExpensePaymentMethod } from '@/services/expenses.service';
import { Save, X, Receipt, DollarSign, Calendar, Building2, Folder, AlertCircle, Loader2, Plus, Briefcase } from 'lucide-react';

interface ExpenseFormProps {
  expense?: Expense;
  onSuccess?: (expense: Expense) => void;
  onCancel?: () => void;
}

interface FormErrors {
  description?: string;
  amount?: string;
  dueDate?: string;
  supplierId?: string;
  categoryId?: string;
  general?: string;
}

interface LimitError {
  error: string;
  resource: string;
  plan: string;
  max: number;
  current: number;
}

// Status options
const statusOptions: { value: ExpenseStatus; label: string }[] = [
  { value: 'DRAFT', label: 'Rascunho' },
  { value: 'PENDING', label: 'Pendente' },
  { value: 'PAID', label: 'Pago' },
  { value: 'CANCELED', label: 'Cancelado' },
];

// Payment method options
const paymentMethodOptions: { value: ExpensePaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'Dinheiro' },
  { value: 'PIX', label: 'PIX' },
  { value: 'CREDIT_CARD', label: 'Cartão de Crédito' },
  { value: 'DEBIT_CARD', label: 'Cartão de Débito' },
  { value: 'BANK_TRANSFER', label: 'Transferência Bancária' },
  { value: 'BOLETO', label: 'Boleto' },
  { value: 'OTHER', label: 'Outro' },
];

export function ExpenseForm({ expense, onSuccess, onCancel }: ExpenseFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslations('common');
  const { billing } = useAuth();
  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const createCategory = useCreateExpenseCategory();

  // Get supplierId and workOrderId from URL if provided
  const supplierIdFromUrl = searchParams.get('supplierId');
  const workOrderIdFromUrl = searchParams.get('workOrderId');

  const isEditing = !!expense;

  // Load categories, suppliers and work orders
  const { data: categories, isLoading: categoriesLoading } = useExpenseCategories();
  const { data: suppliers, isLoading: suppliersLoading } = useSuppliers();
  const { data: workOrders = [], isLoading: workOrdersLoading } = useWorkOrders();

  // Form state - use paidAt instead of paymentDate
  const [formData, setFormData] = useState<CreateExpenseDto>({
    description: expense?.description || '',
    amount: expense?.amount || 0,
    dueDate: expense?.dueDate?.split('T')[0] || '',
    status: expense?.status || 'PENDING',
    paymentMethod: expense?.paymentMethod || undefined,
    paidAt: expense?.paidAt?.split('T')[0] || undefined,
    supplierId: expense?.supplierId || supplierIdFromUrl || undefined,
    categoryId: expense?.categoryId || undefined,
    workOrderId: expense?.workOrderId || workOrderIdFromUrl || undefined,
    notes: expense?.notes || '',
    invoiceNumber: expense?.invoiceNumber || undefined,
  });

  // Estado separado para display do valor (evita re-renders)
  const [amountDisplay, setAmountDisplay] = useState(() => {
    if (expense?.amount) {
      return new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(expense.amount);
    }
    return '';
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [showUpsellModal, setShowUpsellModal] = useState(false);
  const [limitError, setLimitError] = useState<LimitError | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estado para criação de categoria inline
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Format currency input
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Parse currency input
  const parseCurrency = (value: string): number => {
    const cleanValue = value.replace(/[^\d,]/g, '').replace(',', '.');
    return parseFloat(cleanValue) || 0;
  };

  // Validação
  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.description.trim()) {
      newErrors.description = 'Descrição é obrigatória';
    }

    if (!formData.amount || formData.amount <= 0) {
      newErrors.amount = 'Valor deve ser maior que zero';
    }

    if (!formData.dueDate) {
      newErrors.dueDate = 'Data de vencimento é obrigatória';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handler de mudança de campo
  const handleChange = (field: keyof CreateExpenseDto, value: string | number | undefined) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Limpa erro do campo ao editar
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // Handler especial para valor - permite digitação livre
  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    // Permite apenas números, vírgula e ponto
    const rawValue = e.target.value.replace(/[^\d,.]/g, '');
    setAmountDisplay(rawValue);
  }, []);

  // Ao sair do campo, formata e atualiza o valor real
  const handleAmountBlur = useCallback(() => {
    const value = parseCurrency(amountDisplay);
    setFormData((prev) => ({ ...prev, amount: value }));
    // Formata para exibição
    if (value > 0) {
      setAmountDisplay(
        new Intl.NumberFormat('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(value)
      );
    }
    // Limpa erro do campo
    if (errors.amount) {
      setErrors((prev) => ({ ...prev, amount: undefined }));
    }
  }, [amountDisplay, errors.amount]);

  // Handler para criar nova categoria inline
  const handleCreateCategory = useCallback(async () => {
    if (!newCategoryName.trim()) return;

    try {
      const newCategory = await createCategory.mutateAsync({
        name: newCategoryName.trim(),
      });
      setFormData((prev) => ({ ...prev, categoryId: newCategory.id }));
      setNewCategoryName('');
      setShowNewCategoryInput(false);
    } catch {
      // Erro já tratado pelo hook
    }
  }, [newCategoryName, createCategory]);

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) {
      return;
    }

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});
    setLimitError(null);

    try {
      let result: Expense;

      // Prepara dados para envio - usa paidAt (não paymentDate)
      const submitData: CreateExpenseDto = {
        description: formData.description,
        amount: formData.amount,
        dueDate: formData.dueDate,
        status: formData.status,
        paymentMethod: formData.paymentMethod || undefined,
        paidAt: formData.paidAt || undefined,
        supplierId: formData.supplierId || undefined,
        categoryId: formData.categoryId || undefined,
        workOrderId: formData.workOrderId || undefined,
        notes: formData.notes || undefined,
        invoiceNumber: formData.invoiceNumber || undefined,
      };

      if (isEditing) {
        result = await updateExpense.mutateAsync({
          id: expense.id,
          data: submitData,
        });
      } else {
        result = await createExpense.mutateAsync(submitData);
      }

      if (onSuccess) {
        onSuccess(result);
      } else {
        router.push(`/expenses/${result.id}`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '';

      if (errorMessage.includes('LIMIT_REACHED') || errorMessage.includes('limite')) {
        setLimitError({
          error: 'LIMIT_REACHED',
          resource: 'EXPENSE',
          plan: billing?.planKey || 'TRIAL',
          max: -1,
          current: 0,
        });
        setShowUpsellModal(true);
      } else {
        setErrors({
          general: errorMessage || 'Erro ao salvar despesa. Tente novamente.',
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

  const isLoading = isSubmitting || createExpense.isPending || updateExpense.isPending || createCategory.isPending;
  const isDataLoading = categoriesLoading || suppliersLoading || workOrdersLoading;

  return (
    <>
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>{isEditing ? 'Editar Despesa' : 'Nova Despesa'}</CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Erro geral */}
            {errors.general && (
              <Alert variant="error">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {errors.general}
                </div>
              </Alert>
            )}

            {/* Dados principais */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Dados da Despesa
              </h3>

              <FormField label="Descrição" required error={errors.description}>
                <Input
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Descrição da despesa"
                  error={!!errors.description}
                  disabled={isLoading}
                />
              </FormField>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Valor" required error={errors.amount}>
                  <Input
                    value={amountDisplay}
                    onChange={handleAmountChange}
                    onBlur={handleAmountBlur}
                    placeholder="0,00"
                    leftIcon={<DollarSign className="h-4 w-4" />}
                    error={!!errors.amount}
                    disabled={isLoading}
                  />
                </FormField>

                <FormField label="Vencimento" required error={errors.dueDate}>
                  <Input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => handleChange('dueDate', e.target.value)}
                    leftIcon={<Calendar className="h-4 w-4" />}
                    error={!!errors.dueDate}
                    disabled={isLoading}
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Status">
                  <Select
                    value={formData.status}
                    onChange={(e) => handleChange('status', e.target.value as ExpenseStatus)}
                    disabled={isLoading}
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </FormField>

                <FormField label="Forma de Pagamento">
                  <Select
                    value={formData.paymentMethod || ''}
                    onChange={(e) => handleChange('paymentMethod', e.target.value || undefined)}
                    disabled={isLoading}
                  >
                    <option value="">Selecione a forma de pagamento</option>
                    {paymentMethodOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>

              {formData.status === 'PAID' && (
                <FormField label="Data do Pagamento">
                  <Input
                    type="date"
                    value={formData.paidAt || ''}
                    onChange={(e) => handleChange('paidAt', e.target.value || undefined)}
                    leftIcon={<Calendar className="h-4 w-4" />}
                    disabled={isLoading}
                  />
                </FormField>
              )}
            </div>

            {/* Ordem de Serviço */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Ordem de Serviço
              </h3>

              <FormField label="Vincular a uma Ordem de Serviço">
                {workOrdersLoading ? (
                  <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-gray-50">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-gray-500">{t('loading')}</span>
                  </div>
                ) : (
                  <Select
                    value={formData.workOrderId || ''}
                    onChange={(e) => handleChange('workOrderId', e.target.value || undefined)}
                    disabled={isLoading}
                  >
                    <option value="">Nenhuma ordem de serviço</option>
                    {workOrders.map((wo) => (
                      <option key={wo.id} value={wo.id}>
                        {wo.client?.name || 'Sem cliente'} - {wo.title}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
            </div>

            {/* Fornecedor e Categoria */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Fornecedor e Categoria
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Fornecedor">
                  {isDataLoading ? (
                    <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-gray-50">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-gray-500">{t('loading')}</span>
                    </div>
                  ) : (
                    <Select
                      value={formData.supplierId || ''}
                      onChange={(e) => handleChange('supplierId', e.target.value || undefined)}
                      disabled={isLoading}
                    >
                      <option value="">Selecione o fornecedor</option>
                      {suppliers?.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </FormField>

                <FormField label="Categoria">
                  {categoriesLoading ? (
                    <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-gray-50">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-gray-500">{t('loading')}</span>
                    </div>
                  ) : showNewCategoryInput ? (
                    <div className="flex gap-2">
                      <Input
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="Nome da nova categoria"
                        disabled={createCategory.isPending}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleCreateCategory();
                          } else if (e.key === 'Escape') {
                            setShowNewCategoryInput(false);
                            setNewCategoryName('');
                          }
                        }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleCreateCategory}
                        disabled={!newCategoryName.trim() || createCategory.isPending}
                        loading={createCategory.isPending}
                      >
                        Criar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setShowNewCategoryInput(false);
                          setNewCategoryName('');
                        }}
                        disabled={createCategory.isPending}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Select
                        value={formData.categoryId || ''}
                        onChange={(e) => handleChange('categoryId', e.target.value || undefined)}
                        disabled={isLoading}
                        className="flex-1"
                      >
                        <option value="">Selecione a categoria</option>
                        {categories?.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </Select>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setShowNewCategoryInput(true)}
                        disabled={isLoading}
                        title="Criar nova categoria"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </FormField>
              </div>
            </div>

            {/* Informações adicionais */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Folder className="h-4 w-4" />
                Informações Adicionais
              </h3>

              <FormField label="Número da Nota Fiscal">
                <Input
                  value={formData.invoiceNumber || ''}
                  onChange={(e) => handleChange('invoiceNumber', e.target.value || undefined)}
                  placeholder="Ex: NF-123456"
                  disabled={isLoading}
                />
              </FormField>

              <FormField label="Observações">
                <Textarea
                  value={formData.notes || ''}
                  onChange={(e) => handleChange('notes', e.target.value || undefined)}
                  placeholder="Observações sobre a despesa..."
                  rows={3}
                  disabled={isLoading}
                />
              </FormField>
            </div>
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
              disabled={isLoading || isDataLoading}
              leftIcon={<Save className="h-4 w-4" />}
            >
              {isLoading ? 'Salvando...' : 'Salvar'}
            </Button>
          </CardFooter>
        </Card>
      </form>

      {/* Modal de Upsell */}
      {limitError && (
        <UpsellModal
          isOpen={showUpsellModal}
          onClose={() => setShowUpsellModal(false)}
          resource={limitError.resource}
          currentPlan={limitError.plan}
          max={limitError.max}
          current={limitError.current}
        />
      )}
    </>
  );
}

export default ExpenseForm;
