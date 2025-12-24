'use client';

/**
 * Client Form - Formulário de cliente
 *
 * Usado para criar e editar clientes
 * Suporta auto-preenchimento via CNPJ usando API CNPJá
 */

import { useState, useEffect, useCallback, useRef } from 'react';
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
} from '@/components/ui';
import { UpsellModal } from '@/components/billing';
import { useAuth } from '@/context/auth-context';
import { useCreateClient, useUpdateClient } from '@/hooks/use-clients';
import { useCnpjLookup } from '@/hooks/use-cnpj-lookup';
import { Client, CreateClientDto } from '@/services/clients.service';
import { Save, X, User, Phone, Mail, MapPin, FileText, AlertCircle, Loader2, Building2, CheckCircle2 } from 'lucide-react';
import { isValidCPF, isValidCNPJ, maskCPFCNPJ, cleanDocument } from '@/lib/utils';

interface ClientFormProps {
  client?: Client;
  onSuccess?: (client: Client) => void;
  onCancel?: () => void;
}

interface FormErrors {
  name?: string;
  phone?: string;
  taxId?: string;
  email?: string;
  zipCode?: string;
  general?: string;
}

interface LimitError {
  error: string;
  resource: string;
  plan: string;
  max: number;
  current: number;
}

export function ClientForm({ client, onSuccess, onCancel }: ClientFormProps) {
  const router = useRouter();
  const { billing } = useAuth();
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const cnpjLookup = useCnpjLookup();

  const isEditing = !!client;

  // Ref para controlar se já buscou o CNPJ atual
  const lastLookedUpCnpj = useRef<string>('');

  // Form state
  const [formData, setFormData] = useState<CreateClientDto>({
    name: client?.name || '',
    email: client?.email || '',
    phone: client?.phone || '',
    taxId: client?.taxId ? maskCPFCNPJ(client.taxId) : '',
    address: client?.address || '',
    city: client?.city || '',
    state: client?.state || '',
    zipCode: client?.zipCode || '',
    notes: client?.notes || '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [showUpsellModal, setShowUpsellModal] = useState(false);
  const [limitError, setLimitError] = useState<LimitError | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cnpjSuccess, setCnpjSuccess] = useState(false);

  // Validação
  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Nome é obrigatório';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Telefone é obrigatório';
    } else if (!/^[\d\s()+-]+$/.test(formData.phone)) {
      newErrors.phone = 'Telefone inválido';
    }

    if (!formData.taxId.trim()) {
      newErrors.taxId = 'CPF/CNPJ é obrigatório';
    } else {
      const cleanTaxId = cleanDocument(formData.taxId);
      if (cleanTaxId.length === 11) {
        if (!isValidCPF(cleanTaxId)) {
          newErrors.taxId = 'CPF inválido';
        }
      } else if (cleanTaxId.length === 14) {
        if (!isValidCNPJ(cleanTaxId)) {
          newErrors.taxId = 'CNPJ inválido';
        }
      } else {
        newErrors.taxId = 'CPF deve ter 11 dígitos ou CNPJ deve ter 14 dígitos';
      }
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email inválido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handler de mudança de campo
  const handleChange = (field: keyof CreateClientDto, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Limpa erro do campo ao editar
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // Handler especial para CNPJ com auto-preenchimento
  const handleTaxIdChange = useCallback((value: string) => {
    const maskedValue = maskCPFCNPJ(value);
    setFormData((prev) => ({ ...prev, taxId: maskedValue }));
    setCnpjSuccess(false);

    // Limpa erro do campo
    if (errors.taxId) {
      setErrors((prev) => ({ ...prev, taxId: undefined }));
    }

    // Verifica se é um CNPJ válido (14 dígitos) e ainda não foi consultado
    const cleanTaxId = cleanDocument(maskedValue);
    if (cleanTaxId.length === 14 && isValidCNPJ(cleanTaxId) && cleanTaxId !== lastLookedUpCnpj.current) {
      lastLookedUpCnpj.current = cleanTaxId;

      // Consulta a API de CNPJ
      cnpjLookup.mutate(cleanTaxId, {
        onSuccess: (data) => {
          setFormData((prev) => ({
            ...prev,
            name: data.name || prev.name,
            email: data.email || prev.email,
            phone: data.phone || prev.phone,
            address: data.address || prev.address,
            city: data.city || prev.city,
            state: data.state || prev.state,
            zipCode: data.zipCode || prev.zipCode,
          }));
          setCnpjSuccess(true);

          // Limpa indicador de sucesso após 3 segundos
          setTimeout(() => setCnpjSuccess(false), 3000);
        },
        onError: (error) => {
          // Não mostra erro, apenas não preenche automaticamente
          console.warn('Erro ao consultar CNPJ:', error.message);
        },
      });
    }
  }, [cnpjLookup, errors.taxId]);

  // Máscaras
  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 10) {
      return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  };


  const formatZipCode = (value: string) => {
    const digits = value.replace(/\D/g, '');
    return digits.replace(/(\d{5})(\d{3})/, '$1-$2');
  };

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Previne múltiplos envios
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
      let result: Client;

      // Prepara dados para envio - envia taxId apenas com números
      const submitData = {
        ...formData,
        taxId: cleanDocument(formData.taxId),
      };

      if (isEditing) {
        result = await updateClient.mutateAsync({
          id: client.id,
          data: submitData,
        });
      } else {
        result = await createClient.mutateAsync(submitData);
      }

      if (onSuccess) {
        onSuccess(result);
      } else {
        router.push(`/clients/${result.id}`);
      }
    } catch (error: any) {
      // Verifica se é erro de limite
      const errorMessage = error.message || '';

      if (errorMessage.includes('LIMIT_REACHED') || errorMessage.includes('limite')) {
        // Tenta extrair dados do erro (mantido por compatibilidade, mas novo modelo não tem limites)
        setLimitError({
          error: 'LIMIT_REACHED',
          resource: 'CLIENT',
          plan: billing?.planKey || 'TRIAL',
          max: -1,
          current: 0,
        });
        setShowUpsellModal(true);
      } else {
        setErrors({
          general: errorMessage || 'Erro ao salvar cliente. Tente novamente.',
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

  const isLoading = isSubmitting || createClient.isPending || updateClient.isPending;

  return (
    <>
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>{isEditing ? 'Editar Cliente' : 'Novo Cliente'}</CardTitle>
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
                <User className="h-4 w-4" />
                Dados Principais
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Nome / Razão Social" required error={errors.name}>
                  <Input
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="Nome completo ou razão social"
                    error={!!errors.name}
                    disabled={isLoading}
                  />
                </FormField>

                <FormField label="CPF / CNPJ" required error={errors.taxId}>
                  <div className="relative">
                    <Input
                      value={formData.taxId}
                      onChange={(e) => handleTaxIdChange(e.target.value)}
                      placeholder="000.000.000-00 ou 00.000.000/0000-00"
                      error={!!errors.taxId}
                      disabled={isLoading}
                      maxLength={18}
                      leftIcon={
                        cnpjLookup.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        ) : cnpjSuccess ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <Building2 className="h-4 w-4" />
                        )
                      }
                    />
                    {cnpjLookup.isPending && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                        Buscando dados...
                      </span>
                    )}
                  </div>
                  {cnpjSuccess && (
                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Dados preenchidos automaticamente
                    </p>
                  )}
                </FormField>
              </div>
            </div>

            {/* Contato */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Contato
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Telefone" required error={errors.phone}>
                  <Input
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', formatPhone(e.target.value))}
                    placeholder="(00) 00000-0000"
                    leftIcon={<Phone className="h-4 w-4" />}
                    error={!!errors.phone}
                    disabled={isLoading}
                    maxLength={15}
                  />
                </FormField>

                <FormField label="Email" error={errors.email}>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    placeholder="email@exemplo.com"
                    leftIcon={<Mail className="h-4 w-4" />}
                    error={!!errors.email}
                    disabled={isLoading}
                  />
                </FormField>
              </div>
            </div>

            {/* Endereço */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Endereço
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField label="CEP" error={errors.zipCode}>
                  <Input
                    value={formData.zipCode}
                    onChange={(e) => handleChange('zipCode', formatZipCode(e.target.value))}
                    placeholder="00000-000"
                    disabled={isLoading}
                    maxLength={9}
                  />
                </FormField>

                <div className="md:col-span-2">
                  <FormField label="Endereço">
                    <Input
                      value={formData.address}
                      onChange={(e) => handleChange('address', e.target.value)}
                      placeholder="Rua, número, complemento"
                      disabled={isLoading}
                    />
                  </FormField>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Cidade">
                  <Input
                    value={formData.city}
                    onChange={(e) => handleChange('city', e.target.value)}
                    placeholder="Cidade"
                    disabled={isLoading}
                  />
                </FormField>

                <FormField label="Estado">
                  <Input
                    value={formData.state}
                    onChange={(e) => handleChange('state', e.target.value.toUpperCase())}
                    placeholder="UF"
                    disabled={isLoading}
                    maxLength={2}
                  />
                </FormField>
              </div>
            </div>

            {/* Observações */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Observações
              </h3>

              <FormField label="Notas">
                <Textarea
                  value={formData.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  placeholder="Observações sobre o cliente..."
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
              disabled={isLoading}
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

export default ClientForm;
