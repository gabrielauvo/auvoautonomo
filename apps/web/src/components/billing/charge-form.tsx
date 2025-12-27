'use client';

/**
 * ChargeForm - Formulário de Cobrança
 *
 * Permite:
 * - Selecionar cliente
 * - Definir valor e vencimento
 * - Escolher tipo de cobrança (PIX, Boleto, Cartão)
 * - Configurar desconto, multa e juros
 * - Adicionar descrição
 */

import { useState, useEffect, useMemo } from 'react';
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
import { useAuth } from '@/context/auth-context';
import { useFormatting } from '@/context';
import { useTranslations } from '@/i18n';
import { useSearchClients } from '@/hooks/use-clients';
import { useCreateCharge, useUpdateCharge } from '@/hooks/use-charges';
import {
  Charge,
  CreateChargeDto,
  UpdateChargeDto,
  BillingType,
} from '@/services/charges.service';
import { Client, getClientById } from '@/services/clients.service';
import {
  Save,
  X,
  User,
  Search,
  DollarSign,
  Calendar,
  FileText,
  QrCode,
  CreditCard,
  Percent,
  AlertCircle,
} from 'lucide-react';
import { cn, isPIXAvailable, type TaxIdLocale } from '@/lib/utils';

interface ChargeFormProps {
  charge?: Charge;
  preselectedClientId?: string;
  workOrderId?: string;
  quoteId?: string;
  defaultValue?: number;
  defaultDescription?: string;
  onSuccess?: (charge: Charge) => void;
  onCancel?: () => void;
}

interface FormErrors {
  clientId?: string;
  value?: string;
  dueDate?: string;
  billingType?: string;
  general?: string;
}

// Opções de tipo de cobrança - PIX only available for pt-BR
const ALL_BILLING_TYPE_OPTIONS: { value: BillingType; label: string; icon: React.ElementType; ptBROnly?: boolean }[] = [
  { value: 'PIX', label: 'PIX', icon: QrCode, ptBROnly: true },
  { value: 'BOLETO', label: 'Boleto', icon: FileText },
  { value: 'CREDIT_CARD', label: 'Cartão de Crédito', icon: CreditCard },
];


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

  const { data: clients, isLoading } = useSearchClients(
    search,
    isSearching && search.length >= 2
  );

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
            <p className="text-sm text-gray-500">{selectedClient.phone || selectedClient.email}</p>
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
                  <p className="text-xs text-gray-500">{client.phone || client.email}</p>
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

export function ChargeForm({
  charge,
  preselectedClientId,
  workOrderId,
  quoteId,
  defaultValue,
  defaultDescription,
  onSuccess,
  onCancel,
}: ChargeFormProps) {
  const router = useRouter();
  const { formatCurrency } = useFormatting();
  const searchParams = useSearchParams();
  const { billing } = useAuth();
  const { locale } = useTranslations();

  const createCharge = useCreateCharge();
  const updateCharge = useUpdateCharge();

  const isEditing = !!charge;

  // Filter billing types based on locale - PIX only for pt-BR
  const showPIX = isPIXAvailable(locale as TaxIdLocale);
  const BILLING_TYPE_OPTIONS = useMemo(() =>
    ALL_BILLING_TYPE_OPTIONS.filter(opt => !opt.ptBROnly || showPIX),
    [showPIX]
  );

  // Form state
  const [selectedClient, setSelectedClient] = useState<Client | null>(
    charge?.client ? (charge.client as unknown as Client) : null
  );
  const [value, setValue] = useState(
    charge?.value?.toString() || defaultValue?.toString() || ''
  );
  const [dueDate, setDueDate] = useState(charge?.dueDate?.split('T')[0] || '');
  // Default to BOLETO if PIX is not available
  const [billingType, setBillingType] = useState<BillingType>(charge?.billingType || (showPIX ? 'PIX' : 'BOLETO'));
  const [description, setDescription] = useState(
    charge?.description || defaultDescription || ''
  );
  const [showDiscountOptions, setShowDiscountOptions] = useState(!!charge?.discount);
  const [discountValue, setDiscountValue] = useState(charge?.discount?.value?.toString() || '');
  const [discountType, setDiscountType] = useState<'FIXED' | 'PERCENTAGE'>(
    charge?.discount?.type || 'FIXED'
  );
  const [fineValue, setFineValue] = useState(charge?.fine?.value?.toString() || '');
  const [interestValue, setInterestValue] = useState(charge?.interest?.value?.toString() || '');
  const [errors, setErrors] = useState<FormErrors>({});
  const [showUpsellModal, setShowUpsellModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Carregar cliente pré-selecionado
  useEffect(() => {
    const clientIdParam = searchParams.get('clientId') || preselectedClientId;
    if (clientIdParam && !selectedClient) {
      getClientById(clientIdParam)
        .then((client) => {
          setSelectedClient(client);
        })
        .catch((error) => {
          console.error('Erro ao carregar cliente pré-selecionado:', error);
        });
    }
  }, [searchParams, preselectedClientId, selectedClient]);

  // Validação
  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!selectedClient) {
      newErrors.clientId = 'Selecione um cliente';
    }

    if (!value || parseFloat(value) <= 0) {
      newErrors.value = 'Informe um valor válido';
    }

    if (!dueDate) {
      newErrors.dueDate = 'Informe a data de vencimento';
    }

    if (!billingType) {
      newErrors.billingType = 'Selecione o tipo de cobrança';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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
      let result: Charge;

      if (isEditing && charge) {
        const updateData: UpdateChargeDto = {
          dueDate,
          description: description || undefined,
          discount: discountValue
            ? {
                value: parseFloat(discountValue),
                type: discountType,
              }
            : undefined,
          fine: fineValue
            ? {
                value: parseFloat(fineValue),
                type: 'PERCENTAGE',
              }
            : undefined,
          interest: interestValue
            ? {
                value: parseFloat(interestValue),
                type: 'PERCENTAGE',
              }
            : undefined,
        };
        result = await updateCharge.mutateAsync({
          id: charge.id,
          data: updateData,
        });
      } else {
        const createData: CreateChargeDto = {
          clientId: selectedClient!.id,
          workOrderId: workOrderId || undefined,
          quoteId: quoteId || undefined,
          value: parseFloat(value),
          billingType,
          dueDate,
          description: description || undefined,
          discount: discountValue
            ? {
                value: parseFloat(discountValue),
                type: discountType,
              }
            : undefined,
          fine: fineValue
            ? {
                value: parseFloat(fineValue),
                type: 'PERCENTAGE',
              }
            : undefined,
          interest: interestValue
            ? {
                value: parseFloat(interestValue),
                type: 'PERCENTAGE',
              }
            : undefined,
        };
        result = await createCharge.mutateAsync(createData);
      }

      if (onSuccess) {
        onSuccess(result);
      } else {
        router.push(`/billing/charges/${result.id}`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '';

      if (errorMessage.includes('LIMIT_REACHED') || errorMessage.includes('limite')) {
        setShowUpsellModal(true);
      } else {
        setErrors({
          general: errorMessage || 'Erro ao salvar cobrança. Tente novamente.',
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

  const isLoading = isSubmitting || createCharge.isPending || updateCharge.isPending;

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
              disabled={isLoading || isEditing}
            />
          </CardContent>
        </Card>

        {/* Valor e Vencimento */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Valor e Vencimento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Valor *" error={errors.value}>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                    R$
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="0,00"
                    className="pl-10"
                    error={!!errors.value}
                    disabled={isLoading || isEditing}
                  />
                </div>
              </FormField>

              <FormField label="Vencimento *" error={errors.dueDate}>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="pl-10"
                    error={!!errors.dueDate}
                    disabled={isLoading}
                  />
                </div>
              </FormField>
            </div>
          </CardContent>
        </Card>

        {/* Tipo de Cobrança */}
        <Card>
          <CardHeader>
            <CardTitle>Forma de Pagamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {BILLING_TYPE_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isSelected = billingType === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setBillingType(option.value)}
                    disabled={isLoading || isEditing}
                    className={cn(
                      'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all',
                      isSelected
                        ? 'border-primary bg-primary-50 text-primary'
                        : 'border-gray-200 hover:border-gray-300 text-gray-600',
                      (isLoading || isEditing) && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <Icon className="h-6 w-6" />
                    <span className="text-sm font-medium">{option.label}</span>
                  </button>
                );
              })}
            </div>
            {errors.billingType && (
              <p className="text-sm text-error mt-2">{errors.billingType}</p>
            )}
          </CardContent>
        </Card>

        {/* Descrição */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Descrição
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição da cobrança (aparecerá no boleto/fatura)..."
              rows={3}
              disabled={isLoading}
            />
          </CardContent>
        </Card>

        {/* Opções avançadas (Desconto, Multa, Juros) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Percent className="h-5 w-5" />
                Desconto, Multa e Juros
              </CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowDiscountOptions(!showDiscountOptions)}
              >
                {showDiscountOptions ? 'Ocultar' : 'Configurar'}
              </Button>
            </div>
          </CardHeader>

          {showDiscountOptions && (
            <CardContent className="space-y-4">
              {/* Desconto */}
              <div className="p-4 bg-success-50 rounded-lg space-y-3">
                <h4 className="font-medium text-success-900">Desconto para pagamento antecipado</h4>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Valor do desconto">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      placeholder="0,00"
                      disabled={isLoading}
                    />
                  </FormField>
                  <FormField label="Tipo">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setDiscountType('FIXED')}
                        className={cn(
                          'flex-1 py-2 rounded text-sm font-medium',
                          discountType === 'FIXED'
                            ? 'bg-success text-white'
                            : 'bg-gray-100 text-gray-600'
                        )}
                      >
                        R$
                      </button>
                      <button
                        type="button"
                        onClick={() => setDiscountType('PERCENTAGE')}
                        className={cn(
                          'flex-1 py-2 rounded text-sm font-medium',
                          discountType === 'PERCENTAGE'
                            ? 'bg-success text-white'
                            : 'bg-gray-100 text-gray-600'
                        )}
                      >
                        %
                      </button>
                    </div>
                  </FormField>
                </div>
              </div>

              {/* Multa */}
              <div className="p-4 bg-warning-50 rounded-lg space-y-3">
                <h4 className="font-medium text-warning-900">Multa por atraso</h4>
                <FormField label="Percentual de multa (%)">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="2"
                    value={fineValue}
                    onChange={(e) => setFineValue(e.target.value)}
                    placeholder="0,00"
                    disabled={isLoading}
                  />
                </FormField>
                <p className="text-xs text-warning-700">Máximo permitido: 2%</p>
              </div>

              {/* Juros */}
              <div className="p-4 bg-error-50 rounded-lg space-y-3">
                <h4 className="font-medium text-error-900">Juros por atraso</h4>
                <FormField label="Percentual de juros ao mês (%)">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={interestValue}
                    onChange={(e) => setInterestValue(e.target.value)}
                    placeholder="0,00"
                    disabled={isLoading}
                  />
                </FormField>
                <p className="text-xs text-error-700">Máximo permitido: 1% ao mês</p>
              </div>
            </CardContent>
          )}

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
              {isLoading ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Criar Cobrança'}
            </Button>
          </CardFooter>
        </Card>
      </form>

      {/* Modal de Upsell */}
      <UpsellModal
        isOpen={showUpsellModal}
        onClose={() => setShowUpsellModal(false)}
        resource="PAYMENT"
        currentPlan={billing?.planKey || 'TRIAL'}
        max={-1}
        current={0}
      />
    </>
  );
}

export default ChargeForm;
