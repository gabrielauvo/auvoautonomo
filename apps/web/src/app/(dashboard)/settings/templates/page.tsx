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

  const [activeTab, setActiveTab] = useState('quote');
  const [saved, setSaved] = useState(false);

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
