'use client';

/**
 * Templates Settings Page
 *
 * Configurações de templates:
 * - Template de orçamento
 * - Template de OS
 * - Template de cobrança
 */

import { useState, useEffect } from 'react';
import { useTranslations } from '@/i18n';
import {
  FileText,
  Wrench,
  Receipt,
  Check,
  AlertCircle,
  RotateCcw,
  ScrollText,
  Lock,
  Info,
  Crown,
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
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui';
import {
  ColorPicker,
  TemplatePreview,
  NotificationMessageEditor,
} from '@/components/settings';
import {
  useTemplateSettings,
  useUpdateQuoteTemplate,
  useUpdateWorkOrderTemplate,
  useUpdateChargeTemplate,
  useResetTemplate,
  useCompanySettings,
  useAcceptanceTerms,
  useUpdateAcceptanceTerms,
} from '@/hooks/use-settings';
import {
  DEFAULT_QUOTE_TEMPLATE,
  DEFAULT_WORK_ORDER_TEMPLATE,
  DEFAULT_CHARGE_TEMPLATE,
  QuoteTemplate,
  WorkOrderTemplate,
  ChargeTemplate,
} from '@/services/settings.service';
import { getUploadUrl } from '@/services/api';

export default function TemplatesSettingsPage() {
  const { t } = useTranslations('settings');
  const { data: templates, isLoading } = useTemplateSettings();
  const { data: company } = useCompanySettings();
  const updateQuoteTemplate = useUpdateQuoteTemplate();
  const updateWorkOrderTemplate = useUpdateWorkOrderTemplate();
  const updateChargeTemplate = useUpdateChargeTemplate();
  const resetTemplate = useResetTemplate();

  // Acceptance terms
  const { data: acceptanceTerms, isLoading: isLoadingTerms } = useAcceptanceTerms();
  const updateAcceptanceTerms = useUpdateAcceptanceTerms();

  const [activeTab, setActiveTab] = useState('quote');
  const [saved, setSaved] = useState(false);

  // Acceptance terms state
  const [termsEnabled, setTermsEnabled] = useState(false);
  const [termsContent, setTermsContent] = useState('');

  // Quote template state
  const [quoteTemplate, setQuoteTemplate] = useState<QuoteTemplate>(DEFAULT_QUOTE_TEMPLATE);

  // Work order template state
  const [workOrderTemplate, setWorkOrderTemplate] = useState<WorkOrderTemplate>(DEFAULT_WORK_ORDER_TEMPLATE);

  // Charge template state
  const [chargeTemplate, setChargeTemplate] = useState<ChargeTemplate>(DEFAULT_CHARGE_TEMPLATE);

  // Load templates
  useEffect(() => {
    if (templates) {
      setQuoteTemplate({ ...DEFAULT_QUOTE_TEMPLATE, ...templates.quote });
      setWorkOrderTemplate({ ...DEFAULT_WORK_ORDER_TEMPLATE, ...templates.workOrder });
      setChargeTemplate({ ...DEFAULT_CHARGE_TEMPLATE, ...templates.charge });
    }
  }, [templates]);

  // Load acceptance terms
  useEffect(() => {
    if (acceptanceTerms) {
      setTermsEnabled(acceptanceTerms.enabled);
      setTermsContent(acceptanceTerms.termsContent || '');
    }
  }, [acceptanceTerms]);

  const handleSaveQuote = async () => {
    try {
      await updateQuoteTemplate.mutateAsync(quoteTemplate);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Erro ao salvar:', error);
    }
  };

  const handleSaveWorkOrder = async () => {
    try {
      await updateWorkOrderTemplate.mutateAsync(workOrderTemplate);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Erro ao salvar:', error);
    }
  };

  const handleSaveCharge = async () => {
    try {
      await updateChargeTemplate.mutateAsync(chargeTemplate);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Erro ao salvar:', error);
    }
  };

  const handleResetTemplate = async (type: 'quote' | 'workOrder' | 'charge') => {
    try {
      await resetTemplate.mutateAsync(type);
      if (type === 'quote') setQuoteTemplate(DEFAULT_QUOTE_TEMPLATE);
      if (type === 'workOrder') setWorkOrderTemplate(DEFAULT_WORK_ORDER_TEMPLATE);
      if (type === 'charge') setChargeTemplate(DEFAULT_CHARGE_TEMPLATE);
    } catch (error) {
      console.error('Erro ao resetar:', error);
    }
  };

  const handleSaveAcceptanceTerms = async () => {
    try {
      await updateAcceptanceTerms.mutateAsync({
        enabled: termsEnabled,
        termsContent: termsContent || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Erro ao salvar termos:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="quote">
            <FileText className="h-4 w-4 mr-2" />
            {t('quote')}
          </TabsTrigger>
          <TabsTrigger value="workOrder">
            <Wrench className="h-4 w-4 mr-2" />
            {t('workOrder')}
          </TabsTrigger>
          <TabsTrigger value="charge">
            <Receipt className="h-4 w-4 mr-2" />
            {t('charge')}
          </TabsTrigger>
          <TabsTrigger value="acceptanceTerms">
            <ScrollText className="h-4 w-4 mr-2" />
            {t('acceptanceTerms')}
          </TabsTrigger>
        </TabsList>

        {/* Template de Orçamento */}
        <TabsContent value="quote">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t('quoteTemplate')}</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleResetTemplate('quote')}
                loading={resetTemplate.isPending}
                leftIcon={<RotateCcw className="h-4 w-4" />}
              >
                {t('resetDefault')}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Configurações */}
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={quoteTemplate.showLogo}
                        onChange={(e) =>
                          setQuoteTemplate({ ...quoteTemplate, showLogo: e.target.checked })
                        }
                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span className="text-sm">{t('showLogo')}</span>
                    </label>

                    {quoteTemplate.showLogo && (
                      <select
                        value={quoteTemplate.logoPosition}
                        onChange={(e) =>
                          setQuoteTemplate({
                            ...quoteTemplate,
                            logoPosition: e.target.value as 'left' | 'center' | 'right',
                          })
                        }
                        className="px-3 py-1.5 border rounded text-sm"
                      >
                        <option value="left">{t('left')}</option>
                        <option value="center">{t('center')}</option>
                        <option value="right">{t('right')}</option>
                      </select>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <ColorPicker
                      label={t('primaryColor')}
                      value={quoteTemplate.primaryColor}
                      onChange={(color) =>
                        setQuoteTemplate({ ...quoteTemplate, primaryColor: color })
                      }
                    />
                    <ColorPicker
                      label={t('secondaryColor')}
                      value={quoteTemplate.secondaryColor}
                      onChange={(color) =>
                        setQuoteTemplate({ ...quoteTemplate, secondaryColor: color })
                      }
                    />
                  </div>

                  <FormField label={t('headerText')}>
                    <Input
                      value={quoteTemplate.headerText || ''}
                      onChange={(e) =>
                        setQuoteTemplate({ ...quoteTemplate, headerText: e.target.value })
                      }
                      placeholder={t('headerTextPlaceholder')}
                    />
                  </FormField>

                  <FormField label={t('footerText')}>
                    <Input
                      value={quoteTemplate.footerText || ''}
                      onChange={(e) =>
                        setQuoteTemplate({ ...quoteTemplate, footerText: e.target.value })
                      }
                      placeholder={t('footerTextPlaceholder')}
                    />
                  </FormField>

                  <FormField label={t('defaultMessage')}>
                    <Textarea
                      value={quoteTemplate.defaultMessage || ''}
                      onChange={(e) =>
                        setQuoteTemplate({ ...quoteTemplate, defaultMessage: e.target.value })
                      }
                      placeholder={t('defaultMessagePlaceholder')}
                      rows={3}
                    />
                  </FormField>

                  <FormField label={t('termsAndConditions')}>
                    <Textarea
                      value={quoteTemplate.termsAndConditions || ''}
                      onChange={(e) =>
                        setQuoteTemplate({ ...quoteTemplate, termsAndConditions: e.target.value })
                      }
                      placeholder={t('termsAndConditionsPlaceholder')}
                      rows={3}
                    />
                  </FormField>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={quoteTemplate.showSignature}
                      onChange={(e) =>
                        setQuoteTemplate({ ...quoteTemplate, showSignature: e.target.checked })
                      }
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm">{t('showSignatureField')}</span>
                  </label>
                </div>

                {/* Preview */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-3">{t('preview')}</p>
                  <TemplatePreview
                    type="quote"
                    logoUrl={getUploadUrl(company?.logoUrl) || undefined}
                    logoPosition={quoteTemplate.logoPosition}
                    primaryColor={quoteTemplate.primaryColor}
                    secondaryColor={quoteTemplate.secondaryColor}
                    companyName={company?.tradeName}
                    showLogo={quoteTemplate.showLogo}
                    headerText={quoteTemplate.headerText}
                    footerText={quoteTemplate.footerText}
                  />
                </div>
              </div>

              <div className="flex justify-end mt-6 pt-4 border-t">
                <Button
                  onClick={handleSaveQuote}
                  loading={updateQuoteTemplate.isPending}
                  leftIcon={<Check className="h-4 w-4" />}
                >
                  {t('saveTemplate')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Template de OS */}
        <TabsContent value="workOrder">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t('workOrderTemplate')}</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleResetTemplate('workOrder')}
                loading={resetTemplate.isPending}
                leftIcon={<RotateCcw className="h-4 w-4" />}
              >
                {t('resetDefault')}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Configurações */}
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={workOrderTemplate.showLogo}
                        onChange={(e) =>
                          setWorkOrderTemplate({ ...workOrderTemplate, showLogo: e.target.checked })
                        }
                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span className="text-sm">{t('showLogo')}</span>
                    </label>

                    {workOrderTemplate.showLogo && (
                      <select
                        value={workOrderTemplate.logoPosition}
                        onChange={(e) =>
                          setWorkOrderTemplate({
                            ...workOrderTemplate,
                            logoPosition: e.target.value as 'left' | 'center' | 'right',
                          })
                        }
                        className="px-3 py-1.5 border rounded text-sm"
                      >
                        <option value="left">{t('left')}</option>
                        <option value="center">{t('center')}</option>
                        <option value="right">{t('right')}</option>
                      </select>
                    )}
                  </div>

                  <ColorPicker
                    label={t('primaryColor')}
                    value={workOrderTemplate.primaryColor}
                    onChange={(color) =>
                      setWorkOrderTemplate({ ...workOrderTemplate, primaryColor: color })
                    }
                  />

                  <FormField label={t('layout')}>
                    <select
                      value={workOrderTemplate.layout}
                      onChange={(e) =>
                        setWorkOrderTemplate({
                          ...workOrderTemplate,
                          layout: e.target.value as 'compact' | 'detailed',
                        })
                      }
                      className="w-full h-10 px-3 border rounded-lg text-sm"
                    >
                      <option value="compact">{t('compact')}</option>
                      <option value="detailed">{t('detailed')}</option>
                    </select>
                  </FormField>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={workOrderTemplate.showChecklist}
                      onChange={(e) =>
                        setWorkOrderTemplate({ ...workOrderTemplate, showChecklist: e.target.checked })
                      }
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm">{t('showChecklistInPDF')}</span>
                  </label>

                  <FormField label={t('footerText')}>
                    <Input
                      value={workOrderTemplate.footerText || ''}
                      onChange={(e) =>
                        setWorkOrderTemplate({ ...workOrderTemplate, footerText: e.target.value })
                      }
                      placeholder={t('workOrderFooterPlaceholder')}
                    />
                  </FormField>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={workOrderTemplate.showSignatureField}
                      onChange={(e) =>
                        setWorkOrderTemplate({ ...workOrderTemplate, showSignatureField: e.target.checked })
                      }
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm">{t('showCustomerSignature')}</span>
                  </label>

                  {workOrderTemplate.showSignatureField && (
                    <FormField label={t('signatureLabel')}>
                      <Input
                        value={workOrderTemplate.signatureLabel || ''}
                        onChange={(e) =>
                          setWorkOrderTemplate({ ...workOrderTemplate, signatureLabel: e.target.value })
                        }
                        placeholder={t('signatureLabelPlaceholder')}
                      />
                    </FormField>
                  )}
                </div>

                {/* Preview */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-3">{t('preview')}</p>
                  <TemplatePreview
                    type="workOrder"
                    logoUrl={getUploadUrl(company?.logoUrl) || undefined}
                    logoPosition={workOrderTemplate.logoPosition}
                    primaryColor={workOrderTemplate.primaryColor}
                    companyName={company?.tradeName}
                    showLogo={workOrderTemplate.showLogo}
                    footerText={workOrderTemplate.footerText}
                  />
                </div>
              </div>

              <div className="flex justify-end mt-6 pt-4 border-t">
                <Button
                  onClick={handleSaveWorkOrder}
                  loading={updateWorkOrderTemplate.isPending}
                  leftIcon={<Check className="h-4 w-4" />}
                >
                  {t('saveTemplate')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Template de Cobrança */}
        <TabsContent value="charge">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t('chargeTemplate')}</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleResetTemplate('charge')}
                loading={resetTemplate.isPending}
                leftIcon={<RotateCcw className="h-4 w-4" />}
              >
                {t('resetDefault')}
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <NotificationMessageEditor
                label={t('whatsappDefaultMessage')}
                description={t('whatsappDefaultMessageDescription')}
                value={chargeTemplate.whatsappMessage}
                onChange={(value) =>
                  setChargeTemplate({ ...chargeTemplate, whatsappMessage: value })
                }
                defaultValue={DEFAULT_CHARGE_TEMPLATE.whatsappMessage}
                rows={6}
              />

              <NotificationMessageEditor
                label={t('reminderMessage')}
                description={t('reminderMessageDescription')}
                value={chargeTemplate.reminderMessage || ''}
                onChange={(value) =>
                  setChargeTemplate({ ...chargeTemplate, reminderMessage: value })
                }
                defaultValue={DEFAULT_CHARGE_TEMPLATE.reminderMessage}
                rows={4}
              />

              <FormField label={t('emailSubject')}>
                <Input
                  value={chargeTemplate.emailSubject || ''}
                  onChange={(e) =>
                    setChargeTemplate({ ...chargeTemplate, emailSubject: e.target.value })
                  }
                  placeholder={t('emailSubjectPlaceholder')}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {t('emailSubjectHelper')}
                </p>
              </FormField>

              <div className="flex justify-end pt-4 border-t">
                <Button
                  onClick={handleSaveCharge}
                  loading={updateChargeTemplate.isPending}
                  leftIcon={<Check className="h-4 w-4" />}
                >
                  {t('saveTemplate')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Termos de Aceite */}
        <TabsContent value="acceptanceTerms">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ScrollText className="h-5 w-5" />
                {t('acceptanceTerms')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Feature not available message */}
              {acceptanceTerms && !acceptanceTerms.featureAvailable && (
                <Alert variant="default" className="bg-amber-50 border-amber-200">
                  <div className="flex items-start gap-3">
                    <Crown className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-800">
                        {t('acceptanceTermsFeatureUnavailable')}
                      </p>
                      <p className="text-sm text-amber-700 mt-1">
                        {t('acceptanceTermsFeatureDescription')}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 border-amber-300 text-amber-700 hover:bg-amber-100"
                        onClick={() => window.location.href = '/settings/plan'}
                      >
                        {t('acceptanceTermsUpgrade')}
                      </Button>
                    </div>
                  </div>
                </Alert>
              )}

              {/* Description */}
              <div className="text-sm text-gray-600">
                {t('acceptanceTermsDescription')}
              </div>

              {/* Toggle */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  {acceptanceTerms?.featureAvailable ? (
                    <ScrollText className="h-5 w-5 text-primary" />
                  ) : (
                    <Lock className="h-5 w-5 text-gray-400" />
                  )}
                  <div>
                    <p className="font-medium">{t('acceptanceTermsEnabled')}</p>
                    <p className="text-xs text-gray-500">
                      {termsEnabled ? 'Cliente precisará aceitar os termos' : 'Assinatura sem termos de aceite'}
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={termsEnabled}
                    onChange={(e) => setTermsEnabled(e.target.checked)}
                    disabled={!acceptanceTerms?.featureAvailable}
                    className="sr-only peer"
                  />
                  <div className={`w-11 h-6 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${
                    acceptanceTerms?.featureAvailable
                      ? 'bg-gray-200 peer-checked:bg-primary'
                      : 'bg-gray-200 cursor-not-allowed'
                  }`}></div>
                </label>
              </div>

              {/* Terms Content Editor */}
              <FormField label={t('acceptanceTermsContent')}>
                <Textarea
                  value={termsContent}
                  onChange={(e) => setTermsContent(e.target.value)}
                  placeholder={t('acceptanceTermsContentPlaceholder')}
                  rows={10}
                  disabled={!acceptanceTerms?.featureAvailable}
                  className={!acceptanceTerms?.featureAvailable ? 'bg-gray-100 cursor-not-allowed' : ''}
                />
              </FormField>

              {/* Info Card */}
              {acceptanceTerms?.featureAvailable && (
                <Alert variant="default" className="bg-blue-50 border-blue-200">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                    <p className="text-sm text-blue-800">
                      {t('acceptanceTermsInfo')}
                    </p>
                  </div>
                </Alert>
              )}

              {/* Version info */}
              {(acceptanceTerms?.version ?? 0) > 0 && acceptanceTerms?.featureAvailable && (
                <div className="flex items-center gap-6 text-sm text-gray-500 pt-4 border-t">
                  <span>
                    <strong>{t('acceptanceTermsVersion')}:</strong> {acceptanceTerms.version}
                  </span>
                  {acceptanceTerms.updatedAt && (
                    <span>
                      <strong>{t('acceptanceTermsUpdatedAt')}:</strong>{' '}
                      {new Date(acceptanceTerms.updatedAt).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                </div>
              )}

              {/* Save Button */}
              <div className="flex justify-end pt-4 border-t">
                <Button
                  onClick={handleSaveAcceptanceTerms}
                  loading={updateAcceptanceTerms.isPending}
                  disabled={!acceptanceTerms?.featureAvailable}
                  leftIcon={<Check className="h-4 w-4" />}
                >
                  {t('saveTemplate')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Success message */}
      {saved && (
        <Alert variant="success">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4" />
            {t('templateSaved')}
          </div>
        </Alert>
      )}
    </div>
  );
}
