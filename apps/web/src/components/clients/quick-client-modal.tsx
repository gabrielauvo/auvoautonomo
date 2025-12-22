'use client';

/**
 * QuickClientModal - Cadastro rápido de cliente
 *
 * Modal para cadastrar um novo cliente rapidamente durante
 * a criação de orçamentos ou OSs, sem precisar navegar
 * para outra tela.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Modal,
  ModalFooter,
  Button,
  Input,
  Textarea,
  FormField,
  Alert,
} from '@/components/ui';
import { useCreateClient } from '@/hooks/use-clients';
import { useCnpjLookup } from '@/hooks/use-cnpj-lookup';
import { Client, CreateClientDto } from '@/services/clients.service';
import {
  User,
  Phone,
  Mail,
  MapPin,
  AlertCircle,
  Loader2,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { isValidCPF, isValidCNPJ, maskCPFCNPJ, cleanDocument } from '@/lib/utils';

interface QuickClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClientCreated: (client: Client) => void;
  initialName?: string;
}

interface FormErrors {
  name?: string;
  phone?: string;
  taxId?: string;
  email?: string;
  general?: string;
}

export function QuickClientModal({
  isOpen,
  onClose,
  onClientCreated,
  initialName = '',
}: QuickClientModalProps) {
  const createClient = useCreateClient();
  const cnpjLookup = useCnpjLookup();

  // Ref para controlar se já buscou o CNPJ atual
  const lastLookedUpCnpj = useRef<string>('');

  // Form state
  const [formData, setFormData] = useState<CreateClientDto>({
    name: '',
    email: '',
    phone: '',
    taxId: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    notes: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cnpjSuccess, setCnpjSuccess] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Reset form quando modal abre
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: initialName,
        email: '',
        phone: '',
        taxId: '',
        address: '',
        city: '',
        state: '',
        zipCode: '',
        notes: '',
      });
      setErrors({});
      setCnpjSuccess(false);
      setShowAdvanced(false);
      lastLookedUpCnpj.current = '';
    }
  }, [isOpen, initialName]);

  // Validação
  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Nome é obrigatório';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Nome deve ter pelo menos 2 caracteres';
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
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // Handler especial para CPF/CNPJ com auto-preenchimento
  const handleTaxIdChange = useCallback(
    (value: string) => {
      const maskedValue = maskCPFCNPJ(value);
      setFormData((prev) => ({ ...prev, taxId: maskedValue }));
      setCnpjSuccess(false);

      if (errors.taxId) {
        setErrors((prev) => ({ ...prev, taxId: undefined }));
      }

      // Verifica se é um CNPJ válido (14 dígitos) e ainda não foi consultado
      const cleanTaxId = cleanDocument(maskedValue);
      if (
        cleanTaxId.length === 14 &&
        isValidCNPJ(cleanTaxId) &&
        cleanTaxId !== lastLookedUpCnpj.current
      ) {
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
            console.warn('Erro ao consultar CNPJ:', error.message);
          },
        });
      }
    },
    [cnpjLookup, errors.taxId]
  );

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

    if (isSubmitting) {
      return;
    }

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const submitData = {
        ...formData,
        taxId: cleanDocument(formData.taxId),
      };

      const result = await createClient.mutateAsync(submitData);

      onClientCreated(result);
      onClose();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '';
      setErrors({
        general: errorMessage || 'Erro ao criar cliente. Tente novamente.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading = isSubmitting || createClient.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cadastro Rápido de Cliente"
      description="Preencha os dados básicos para criar um novo cliente"
      size="lg"
    >
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          {/* Erro geral */}
          {errors.general && (
            <Alert variant="error">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {errors.general}
              </div>
            </Alert>
          )}

          {/* Dados obrigatórios */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <User className="h-4 w-4" />
              Dados Principais
            </h3>

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

            <FormField label="Nome / Razão Social" required error={errors.name}>
              <Input
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Nome completo ou razão social"
                error={!!errors.name}
                disabled={isLoading}
                autoFocus
              />
            </FormField>

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

          {/* Toggle campos adicionais */}
          <button
            type="button"
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 w-full justify-center py-2"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Ocultar campos adicionais
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                Mais campos (opcional)
              </>
            )}
          </button>

          {/* Campos adicionais */}
          {showAdvanced && (
            <div className="space-y-4 pt-2 border-t">
              <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Endereço
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField label="CEP">
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

              <FormField label="Observações">
                <Textarea
                  value={formData.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  placeholder="Informações adicionais sobre o cliente..."
                  rows={2}
                  disabled={isLoading}
                />
              </FormField>
            </div>
          )}
        </div>

        <ModalFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" loading={isLoading}>
            {isLoading ? 'Salvando...' : 'Cadastrar Cliente'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

export default QuickClientModal;
