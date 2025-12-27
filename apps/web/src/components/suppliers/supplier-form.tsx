'use client';

/**
 * Supplier Form - Formulário de fornecedor
 *
 * Usado para criar e editar fornecedores
 * Suporta auto-preenchimento via CNPJ usando API CNPJá
 */

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
} from '@/components/ui';
import { UpsellModal } from '@/components/billing';
import { useAuth } from '@/context/auth-context';
import { useCreateSupplier, useUpdateSupplier } from '@/hooks/use-suppliers';
import { useCnpjLookup } from '@/hooks/use-cnpj-lookup';
import { Supplier, CreateSupplierDto } from '@/services/suppliers.service';
import { Save, X, Building2, Phone, Mail, MapPin, FileText, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { maskCPFCNPJ, cleanDocument, isValidCPF, isValidCNPJ } from '@/lib/utils';

interface SupplierFormProps {
  supplier?: Supplier;
  onSuccess?: (supplier: Supplier) => void;
  onCancel?: () => void;
}

interface FormErrors {
  name?: string;
  phone?: string;
  document?: string;
  email?: string;
  general?: string;
}

interface LimitError {
  error: string;
  resource: string;
  plan: string;
  max: number;
  current: number;
}

export function SupplierForm({ supplier, onSuccess, onCancel }: SupplierFormProps) {
  const { t } = useTranslations('suppliers');
  const router = useRouter();
  const { billing } = useAuth();
  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier();
  const cnpjLookup = useCnpjLookup();

  const isEditing = !!supplier;

  // Ref para controlar se já buscou o CNPJ atual
  const lastLookedUpCnpj = useRef<string>('');

  // Form state
  const [formData, setFormData] = useState<CreateSupplierDto>({
    name: supplier?.name || '',
    document: supplier?.document ? maskCPFCNPJ(supplier.document) : '',
    email: supplier?.email || '',
    phone: supplier?.phone || '',
    address: supplier?.address || '',
    notes: supplier?.notes || '',
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
      newErrors.name = t('form.validation.nameRequired');
    }

    // Documento é opcional, mas se preenchido, valida
    if (formData.document && formData.document.trim()) {
      const cleanDoc = cleanDocument(formData.document);
      if (cleanDoc.length === 11) {
        if (!isValidCPF(cleanDoc)) {
          newErrors.document = t('form.validation.invalidCpf');
        }
      } else if (cleanDoc.length === 14) {
        if (!isValidCNPJ(cleanDoc)) {
          newErrors.document = t('form.validation.invalidCnpj');
        }
      } else if (cleanDoc.length > 0) {
        newErrors.document = t('form.validation.documentLength');
      }
    }

    if (formData.phone && !/^[\d\s()+-]*$/.test(formData.phone)) {
      newErrors.phone = t('form.validation.invalidPhone');
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t('form.validation.invalidEmail');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handler de mudança de campo
  const handleChange = (field: keyof CreateSupplierDto, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Limpa erro do campo ao editar
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // Handler especial para documento com máscara e auto-preenchimento via CNPJ
  const handleDocumentChange = useCallback((value: string) => {
    const maskedValue = maskCPFCNPJ(value);
    setFormData((prev) => ({ ...prev, document: maskedValue }));
    setCnpjSuccess(false);

    // Limpa erro do campo
    if (errors.document) {
      setErrors((prev) => ({ ...prev, document: undefined }));
    }

    // Verifica se é um CNPJ válido (14 dígitos) e ainda não foi consultado
    const cleanDoc = cleanDocument(maskedValue);
    if (cleanDoc.length === 14 && isValidCNPJ(cleanDoc) && cleanDoc !== lastLookedUpCnpj.current) {
      lastLookedUpCnpj.current = cleanDoc;

      // Consulta a API de CNPJ
      cnpjLookup.mutate(cleanDoc, {
        onSuccess: (data) => {
          setFormData((prev) => ({
            ...prev,
            name: data.name || prev.name,
            email: data.email || prev.email,
            phone: data.phone || prev.phone,
            address: data.address
              ? `${data.address}${data.city ? `, ${data.city}` : ''}${data.state ? ` - ${data.state}` : ''}`
              : prev.address,
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
  }, [cnpjLookup, errors.document]);

  // Máscaras
  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 10) {
      return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
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
    setLimitError(null);

    try {
      let result: Supplier;

      // Prepara dados para envio
      const submitData: CreateSupplierDto = {
        name: formData.name,
        document: formData.document ? cleanDocument(formData.document) : undefined,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        address: formData.address || undefined,
        notes: formData.notes || undefined,
      };

      if (isEditing) {
        result = await updateSupplier.mutateAsync({
          id: supplier.id,
          data: submitData,
        });
      } else {
        result = await createSupplier.mutateAsync(submitData);
      }

      if (onSuccess) {
        onSuccess(result);
      } else {
        router.push(`/suppliers/${result.id}`);
      }
    } catch (error: any) {
      const errorMessage = error.message || '';

      if (errorMessage.includes('LIMIT_REACHED') || errorMessage.includes('limite')) {
        setLimitError({
          error: 'LIMIT_REACHED',
          resource: 'SUPPLIER',
          plan: billing?.planKey || 'TRIAL',
          max: -1,
          current: 0,
        });
        setShowUpsellModal(true);
      } else {
        setErrors({
          general: errorMessage || t('form.saveError'),
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

  const isLoading = isSubmitting || createSupplier.isPending || updateSupplier.isPending;

  return (
    <>
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>{isEditing ? t('editSupplier') : t('newSupplier')}</CardTitle>
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
                <Building2 className="h-4 w-4" />
                {t('form.mainData')}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label={t('form.nameLabel')} required error={errors.name}>
                  <Input
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder={t('form.namePlaceholder')}
                    error={!!errors.name}
                    disabled={isLoading}
                  />
                </FormField>

                <FormField label={t('form.documentLabel')} error={errors.document}>
                  <div className="relative">
                    <Input
                      value={formData.document}
                      onChange={(e) => handleDocumentChange(e.target.value)}
                      placeholder={t('form.documentPlaceholder')}
                      error={!!errors.document}
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
                        {t('form.searchingData')}
                      </span>
                    )}
                  </div>
                  {cnpjSuccess && (
                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      {t('form.autoFilledSuccess')}
                    </p>
                  )}
                </FormField>
              </div>
            </div>

            {/* Contato */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Phone className="h-4 w-4" />
                {t('form.contact')}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label={t('phone')} error={errors.phone}>
                  <Input
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', formatPhone(e.target.value))}
                    placeholder={t('form.phonePlaceholder')}
                    leftIcon={<Phone className="h-4 w-4" />}
                    error={!!errors.phone}
                    disabled={isLoading}
                    maxLength={15}
                  />
                </FormField>

                <FormField label={t('email')} error={errors.email}>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    placeholder={t('form.emailPlaceholder')}
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
                {t('address')}
              </h3>

              <FormField label={t('address')}>
                <Input
                  value={formData.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  placeholder={t('form.addressPlaceholder')}
                  disabled={isLoading}
                />
              </FormField>
            </div>

            {/* Observações */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {t('notes')}
              </h3>

              <FormField label={t('form.notesLabel')}>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  placeholder={t('form.notesPlaceholder')}
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
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              loading={isLoading}
              disabled={isLoading}
              leftIcon={<Save className="h-4 w-4" />}
            >
              {isLoading ? t('form.saving') : t('form.save')}
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

export default SupplierForm;
