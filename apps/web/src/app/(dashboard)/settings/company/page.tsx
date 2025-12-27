'use client';

/**
 * Company Settings Page
 *
 * Configurações da empresa:
 * - Dados comerciais
 * - Endereço
 * - Logo
 * - Branding (cores)
 * - Auto-preenchimento via CNPJ (API CNPJá)
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslations } from '@/i18n';
import {
  Building2,
  FileText,
  MapPin,
  Phone,
  Mail,
  Palette,
  Check,
  AlertCircle,
  Loader2,
  CheckCircle2,
  QrCode,
  ToggleLeft,
  ToggleRight,
  Copy,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Textarea,
  FormField,
  Alert,
  Skeleton,
  SearchSelect,
} from '@/components/ui';
import { maskCNPJ, isValidCNPJ, cleanDocument, maskPhone, maskPhoneMobile, getTaxIdConfig, isPIXAvailable, type TaxIdLocale } from '@/lib/utils';
import { UploadLogo, ColorPicker, TemplatePreview } from '@/components/settings';
import {
  useCompanySettings,
  useUpdateCompanySettings,
  useUploadLogo,
  useDeleteLogo,
} from '@/hooks/use-settings';
import { useCnpjLookup } from '@/hooks/use-cnpj-lookup';
import { DEFAULT_BRANDING, CompanyBranding, PIX_KEY_TYPES, PixKeyType } from '@/services/settings.service';
import { getUploadUrl } from '@/services/api';

// Estados brasileiros
const STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

export default function CompanySettingsPage() {
  const { t, locale } = useTranslations('settings');
  const { data: company, isLoading } = useCompanySettings();
  const updateCompany = useUpdateCompanySettings();
  const uploadLogo = useUploadLogo();
  const deleteLogo = useDeleteLogo();
  const cnpjLookup = useCnpjLookup();

  // Get tax ID and PIX config based on locale
  const taxIdConfig = useMemo(() => getTaxIdConfig(locale as TaxIdLocale), [locale]);
  const showPIX = isPIXAvailable(locale as TaxIdLocale);

  // Ref para controlar se já buscou o CNPJ atual
  const lastLookedUpCnpj = useRef<string>('');

  // Form state
  const [tradeName, setTradeName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [stateRegistration, setStateRegistration] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');

  // Address state
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');

  // Branding state
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);

  // Pix state
  const [pixKey, setPixKey] = useState('');
  const [pixKeyType, setPixKeyType] = useState<PixKeyType | ''>('');
  const [pixKeyOwnerName, setPixKeyOwnerName] = useState('');
  const [pixKeyEnabled, setPixKeyEnabled] = useState(false);
  const [pixKeyCopied, setPixKeyCopied] = useState(false);

  // UI state
  const [saved, setSaved] = useState(false);
  const [taxIdError, setTaxIdError] = useState<string | null>(null);
  const [cnpjSuccess, setCnpjSuccess] = useState(false);

  // Load company data
  useEffect(() => {
    if (company) {
      setTradeName(company.tradeName || '');
      setLegalName(company.legalName || '');
      setTaxId(company.taxId ? taxIdConfig.mask(company.taxId) : '');
      setStateRegistration(company.stateRegistration || '');
      setEmail(company.email || '');
      setPhone(company.phone ? maskPhone(company.phone) : '');
      setWhatsapp(company.whatsapp ? maskPhoneMobile(company.whatsapp) : '');

      if (company.address) {
        setStreet(company.address.street || '');
        setNumber(company.address.number || '');
        setComplement(company.address.complement || '');
        setNeighborhood(company.address.neighborhood || '');
        setCity(company.address.city || '');
        setState(company.address.state || '');
        setZipCode(company.address.zipCode || '');
      }

      if (company.branding) {
        setBranding({ ...DEFAULT_BRANDING, ...company.branding });
      }

      // Load Pix data
      setPixKey(company.pixKey || '');
      setPixKeyType((company.pixKeyType as PixKeyType) || '');
      setPixKeyOwnerName(company.pixKeyOwnerName || '');
      setPixKeyEnabled(company.pixKeyEnabled || false);
    }
  }, [company]);

  // Handler especial para Tax ID com auto-preenchimento (CNPJ only for pt-BR)
  const handleTaxIdChange = useCallback((value: string) => {
    const masked = taxIdConfig.mask(value);
    setTaxId(masked);
    setCnpjSuccess(false);

    // For pt-BR, validate CNPJ and enable auto-fill
    if (taxIdConfig.showCnpjLookup) {
      const cleaned = cleanDocument(masked);
      if (cleaned.length === 14) {
        if (!isValidCNPJ(cleaned)) {
          setTaxIdError(t('invalidCnpj'));
        } else {
          setTaxIdError(null);

          // Consulta a API de CNPJ se ainda não foi consultado
          if (cleaned !== lastLookedUpCnpj.current) {
            lastLookedUpCnpj.current = cleaned;

            cnpjLookup.mutate(cleaned, {
              onSuccess: (data) => {
                // Preenche os campos automaticamente
                if (data.name) setLegalName(data.name);
                if (data.alias) setTradeName((prev) => prev || data.alias || '');
                if (data.email) setEmail((prev) => prev || data.email || '');
                if (data.phone) setPhone((prev) => prev || maskPhone(data.phone || '') || '');
                if (data.address) setStreet((prev) => prev || data.address || '');
                if (data.city) setCity((prev) => prev || data.city || '');
                if (data.state) setState((prev) => prev || data.state || '');
                if (data.zipCode) setZipCode((prev) => prev || data.zipCode || '');

                setCnpjSuccess(true);
                setTimeout(() => setCnpjSuccess(false), 3000);
              },
              onError: (error) => {
                console.warn('Erro ao consultar CNPJ:', error.message);
              },
            });
          }
        }
      } else if (cleaned.length > 0 && cleaned.length < 14) {
        setTaxIdError(null);
      } else {
        setTaxIdError(null);
      }
    } else {
      // For non-pt-BR, just validate if filled
      setTaxIdError(null);
    }
  }, [cnpjLookup, taxIdConfig, t]);

  const handleSave = async () => {
    // Valida Tax ID antes de salvar (only required validation for pt-BR)
    const cleanedTaxId = taxId.replace(/[^A-Za-z0-9]/g, '');
    if (taxIdConfig.showCnpjLookup) {
      // pt-BR: validate CNPJ
      if (cleanedTaxId.length > 0 && cleanedTaxId.length !== 14) {
        setTaxIdError(t('cnpjMustHave14Digits'));
        return;
      }
      if (cleanedTaxId.length === 14 && !isValidCNPJ(cleanedTaxId)) {
        setTaxIdError(t('invalidCnpj'));
        return;
      }
    } else if (cleanedTaxId && taxIdConfig.validate && !taxIdConfig.validate(cleanedTaxId)) {
      // For other locales, validate if filled
      setTaxIdError(t('invalidTaxId'));
      return;
    }

    try {
      const cleanedPhone = cleanDocument(phone);
      const cleanedWhatsapp = cleanDocument(whatsapp);

      // Só envia address se pelo menos um campo tiver valor
      const addressData = {
        street: street || undefined,
        number: number || undefined,
        complement: complement || undefined,
        neighborhood: neighborhood || undefined,
        city: city || undefined,
        state: state || undefined,
        zipCode: zipCode || undefined,
      };
      const hasAddress = Object.values(addressData).some(v => v !== undefined);

      await updateCompany.mutateAsync({
        tradeName,
        legalName: legalName || undefined,
        taxId: cleanedTaxId || undefined,
        stateRegistration: stateRegistration || undefined,
        email: email || undefined,
        phone: cleanedPhone || undefined,
        whatsapp: cleanedWhatsapp || undefined,
        address: hasAddress ? addressData : undefined,
        branding,
        // Pix settings
        pixKey: pixKey || null,
        pixKeyType: pixKeyType || null,
        pixKeyOwnerName: pixKeyOwnerName || null,
        pixKeyEnabled,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Erro ao salvar:', error);
    }
  };

  const handleUploadLogo = async (file: File) => {
    await uploadLogo.mutateAsync(file);
  };

  const handleDeleteLogo = async () => {
    await deleteLogo.mutateAsync();
  };

  const updateBrandingColor = (key: keyof CompanyBranding, color: string) => {
    setBranding((prev) => ({ ...prev, [key]: color }));
  };

  const handleCopyPixKey = async () => {
    if (pixKey) {
      await navigator.clipboard.writeText(pixKey);
      setPixKeyCopied(true);
      setTimeout(() => setPixKeyCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dados da empresa */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {t('companyData')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label={`${t('tradeName')} *`}>
              <Input
                value={tradeName}
                onChange={(e) => setTradeName(e.target.value)}
                placeholder={t('tradeNamePlaceholder')}
              />
            </FormField>

            <FormField label={t('legalName')}>
              <Input
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                placeholder={t('legalNamePlaceholder')}
              />
            </FormField>

            <FormField label={taxIdConfig.labelBusiness || taxIdConfig.label} error={taxIdError || undefined}>
              <div className="relative">
                {taxIdConfig.showCnpjLookup && cnpjLookup.isPending ? (
                  <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary animate-spin" />
                ) : cnpjSuccess ? (
                  <CheckCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                ) : (
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                )}
                <Input
                  value={taxId}
                  onChange={(e) => handleTaxIdChange(e.target.value)}
                  placeholder={taxIdConfig.placeholderBusiness || taxIdConfig.placeholder}
                  className="pl-10"
                  maxLength={taxIdConfig.maxLength}
                  error={!!taxIdError}
                />
                {taxIdConfig.showCnpjLookup && cnpjLookup.isPending && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                    {t('searchingData')}
                  </span>
                )}
              </div>
              {cnpjSuccess && (
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {t('dataAutoFilled')}
                </p>
              )}
            </FormField>

            <FormField label={t('stateRegistration')}>
              <Input
                value={stateRegistration}
                onChange={(e) => setStateRegistration(e.target.value)}
                placeholder={t('stateRegistrationPlaceholder')}
              />
            </FormField>
          </div>

          <div className="border-t pt-4" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label={t('email')}>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contato@empresa.com"
                  className="pl-10"
                />
              </div>
            </FormField>

            <FormField label={t('phone')}>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={phone}
                  onChange={(e) => setPhone(maskPhone(e.target.value))}
                  placeholder="(00) 0000-0000"
                  className="pl-10"
                  maxLength={15}
                />
              </div>
            </FormField>

            <FormField label={t('whatsapp')}>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(maskPhoneMobile(e.target.value))}
                  placeholder="(00) 00000-0000"
                  className="pl-10"
                  maxLength={15}
                />
              </div>
            </FormField>
          </div>
        </CardContent>
      </Card>

      {/* Endereço */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            {t('address')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <FormField label={t('zipCode')}>
              <Input
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                placeholder="00000-000"
              />
            </FormField>

            <FormField label={t('street')} className="md:col-span-2">
              <Input
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder={t('streetPlaceholder')}
              />
            </FormField>

            <FormField label={t('number')}>
              <Input
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder={t('numberPlaceholder')}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <FormField label={t('complement')}>
              <Input
                value={complement}
                onChange={(e) => setComplement(e.target.value)}
                placeholder={t('complementPlaceholder')}
              />
            </FormField>

            <FormField label={t('neighborhood')}>
              <Input
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                placeholder={t('neighborhoodPlaceholder')}
              />
            </FormField>

            <FormField label={t('city')}>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder={t('cityPlaceholder')}
              />
            </FormField>

            <FormField label={t('state')}>
              <SearchSelect
                options={[
                  { value: '', label: t('selectState') },
                  ...STATES.map((uf) => ({ value: uf, label: uf })),
                ]}
                value={state}
                onChange={setState}
                placeholder={t('selectState')}
                searchPlaceholder="Buscar estado..."
              />
            </FormField>
          </div>
        </CardContent>
      </Card>

      {/* Recebimento via Pix - Only show for pt-BR */}
      {showPIX && company?.pixKeyFeatureEnabled !== false && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                {t('pixReceiving')}
              </div>
              <button
                type="button"
                onClick={() => setPixKeyEnabled(!pixKeyEnabled)}
                className="flex items-center gap-2 text-sm font-normal"
              >
                {pixKeyEnabled ? (
                  <>
                    <ToggleRight className="h-6 w-6 text-green-500" />
                    <span className="text-green-600">{t('enabled')}</span>
                  </>
                ) : (
                  <>
                    <ToggleLeft className="h-6 w-6 text-gray-400" />
                    <span className="text-gray-500">{t('disabled')}</span>
                  </>
                )}
              </button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-500">
              {t('pixConfigDescription')}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label={t('pixKeyType')}>
                <SearchSelect
                  options={[
                    { value: '', label: t('selectType') },
                    ...PIX_KEY_TYPES.map((type) => ({ value: type.value, label: type.label })),
                  ]}
                  value={pixKeyType}
                  onChange={(val) => setPixKeyType(val as PixKeyType | '')}
                  placeholder={t('selectType')}
                  searchPlaceholder="Buscar tipo..."
                  disabled={!pixKeyEnabled}
                />
              </FormField>

              <FormField label={t('pixKey')}>
                <div className="relative">
                  <Input
                    value={pixKey}
                    onChange={(e) => setPixKey(e.target.value)}
                    placeholder={
                      pixKeyType === 'CPF' ? '000.000.000-00' :
                      pixKeyType === 'CNPJ' ? '00.000.000/0000-00' :
                      pixKeyType === 'EMAIL' ? 'email@exemplo.com' :
                      pixKeyType === 'PHONE' ? '+55 11 99999-9999' :
                      pixKeyType === 'RANDOM' ? 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' :
                      t('enterPixKey')
                    }
                    disabled={!pixKeyEnabled}
                    className="pr-10"
                  />
                  {pixKey && (
                    <button
                      type="button"
                      onClick={handleCopyPixKey}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      title={t('copyKey')}
                    >
                      {pixKeyCopied ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>
              </FormField>
            </div>

            <FormField label={t('pixOwnerName')}>
              <Input
                value={pixKeyOwnerName}
                onChange={(e) => setPixKeyOwnerName(e.target.value)}
                placeholder={t('pixOwnerNamePlaceholder')}
                disabled={!pixKeyEnabled}
              />
              <p className="text-xs text-gray-400 mt-1">
                {t('pixOwnerNameDescription')}
              </p>
            </FormField>

            {pixKeyEnabled && pixKey && (
              <Alert variant="default" className="bg-green-50 border-green-200">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                  <div className="text-sm text-green-800">
                    <strong>{t('pixKeyConfigured')}</strong>
                    <p className="mt-1">
                      {t('pixKeyConfiguredDescription')}
                    </p>
                  </div>
                </div>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Logo */}
      <Card>
        <CardHeader>
          <CardTitle>{t('logo')}</CardTitle>
        </CardHeader>
        <CardContent>
          <UploadLogo
            currentLogoUrl={company?.logoUrl}
            onUpload={handleUploadLogo}
            onRemove={handleDeleteLogo}
            isUploading={uploadLogo.isPending || deleteLogo.isPending}
          />
        </CardContent>
      </Card>

      {/* Branding */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            {t('branding')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Color pickers */}
            <div className="space-y-4">
              <p className="text-sm text-gray-500 mb-4">
                {t('brandingDescription')}
              </p>

              <div className="grid grid-cols-2 gap-4">
                <ColorPicker
                  label={t('primaryColor')}
                  value={branding.primaryColor}
                  onChange={(color) => updateBrandingColor('primaryColor', color)}
                />

                <ColorPicker
                  label={t('secondaryColor')}
                  value={branding.secondaryColor}
                  onChange={(color) => updateBrandingColor('secondaryColor', color)}
                />

                <ColorPicker
                  label={t('textColor')}
                  value={branding.textColor}
                  onChange={(color) => updateBrandingColor('textColor', color)}
                />

                <ColorPicker
                  label={t('accentColor')}
                  value={branding.accentColor}
                  onChange={(color) => updateBrandingColor('accentColor', color)}
                />
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setBranding(DEFAULT_BRANDING)}
                className="mt-2"
              >
                {t('resetColors')}
              </Button>
            </div>

            {/* Preview */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-3">{t('preview')}</p>
              <TemplatePreview
                type="quote"
                logoUrl={company?.logoUrl ? getUploadUrl(company.logoUrl) || undefined : undefined}
                primaryColor={branding.primaryColor}
                secondaryColor={branding.secondaryColor}
                companyName={tradeName || t('yourCompany')}
                showLogo={!!company?.logoUrl}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save button */}
      {saved && (
        <Alert variant="success">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4" />
            {t('saveSuccess')}
          </div>
        </Alert>
      )}

      {updateCompany.error && (
        <Alert variant="error">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {t('saveError')}
          </div>
        </Alert>
      )}

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          loading={updateCompany.isPending}
          leftIcon={<Check className="h-4 w-4" />}
        >
          {t('saveChanges')}
        </Button>
      </div>
    </div>
  );
}
