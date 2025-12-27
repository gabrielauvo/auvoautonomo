'use client';

/**
 * Notifications Settings Page
 *
 * Configurações de notificações:
 * - Preferências de email
 * - Preferências de WhatsApp
 * - Lembretes automáticos
 * - Mensagens personalizadas
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from '@/i18n';
import {
  Bell,
  Mail,
  MessageCircle,
  Clock,
  Check,
  AlertCircle,
  Info,
  ExternalLink,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  FormField,
  Alert,
  Skeleton,
  Switch,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui';
import { NotificationMessageEditor } from '@/components/settings';
import {
  useNotificationSettings,
  useUpdateNotificationPreferences,
  useUpdateNotificationMessages,
} from '@/hooks/use-settings';
import {
  DEFAULT_NOTIFICATION_MESSAGES,
  NotificationPreferences,
  NotificationMessages,
} from '@/services/settings.service';
import { useZApiStatus } from '@/hooks/use-integrations';
import { useFormatting } from '@/hooks/use-formatting';

export default function NotificationsSettingsPage() {
  const { t } = useTranslations('notifications');
  const tIntegrations = useTranslations('integrations');
  const { locale } = useFormatting();
  const { data: settings, isLoading } = useNotificationSettings();
  const { data: zapiStatus } = useZApiStatus();
  const updatePreferences = useUpdateNotificationPreferences();
  const updateMessages = useUpdateNotificationMessages();

  // WhatsApp is not commonly used in English-speaking countries
  const showWhatsApp = !locale.startsWith('en');

  // Z-API connection status
  const isZApiConnected = zapiStatus?.configured && zapiStatus?.connectionStatus === 'connected';

  // Tab state
  const [activeTab, setActiveTab] = useState('email');

  // Email preferences
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [emailNewQuote, setEmailNewQuote] = useState(true);
  const [emailQuoteApproved, setEmailQuoteApproved] = useState(true);
  const [emailQuoteRejected, setEmailQuoteRejected] = useState(true);
  const [emailNewWorkOrder, setEmailNewWorkOrder] = useState(true);
  const [emailWorkOrderCompleted, setEmailWorkOrderCompleted] = useState(true);
  const [emailPaymentReceived, setEmailPaymentReceived] = useState(true);
  const [emailPaymentOverdue, setEmailPaymentOverdue] = useState(true);

  // WhatsApp preferences
  const [whatsappEnabled, setWhatsappEnabled] = useState(true);
  const [whatsappPaymentReminder, setWhatsappPaymentReminder] = useState(true);
  const [whatsappWorkOrderReminder, setWhatsappWorkOrderReminder] = useState(true);

  // Reminder preferences
  const [paymentDaysBefore, setPaymentDaysBefore] = useState(3);
  const [paymentOnDueDate, setPaymentOnDueDate] = useState(true);
  const [paymentDaysAfter, setPaymentDaysAfter] = useState(1);
  const [workOrderDaysBefore, setWorkOrderDaysBefore] = useState(1);

  // Messages
  const [paymentReminderMessage, setPaymentReminderMessage] = useState('');
  const [paymentOverdueMessage, setPaymentOverdueMessage] = useState('');
  const [workOrderReminderMessage, setWorkOrderReminderMessage] = useState('');
  const [quoteFollowUpMessage, setQuoteFollowUpMessage] = useState('');

  // UI state
  const [prefsSaved, setPrefsSaved] = useState(false);
  const [messagesSaved, setMessagesSaved] = useState(false);

  // Load settings
  useEffect(() => {
    if (settings) {
      // Email
      setEmailEnabled(settings.preferences.email.enabled);
      setEmailNewQuote(settings.preferences.email.newQuote);
      setEmailQuoteApproved(settings.preferences.email.quoteApproved);
      setEmailQuoteRejected(settings.preferences.email.quoteRejected);
      setEmailNewWorkOrder(settings.preferences.email.newWorkOrder);
      setEmailWorkOrderCompleted(settings.preferences.email.workOrderCompleted);
      setEmailPaymentReceived(settings.preferences.email.paymentReceived);
      setEmailPaymentOverdue(settings.preferences.email.paymentOverdue);

      // WhatsApp
      setWhatsappEnabled(settings.preferences.whatsapp.enabled);
      setWhatsappPaymentReminder(settings.preferences.whatsapp.paymentReminder);
      setWhatsappWorkOrderReminder(settings.preferences.whatsapp.workOrderReminder);

      // Reminders
      setPaymentDaysBefore(settings.preferences.reminders.paymentDaysBefore);
      setPaymentOnDueDate(settings.preferences.reminders.paymentOnDueDate);
      setPaymentDaysAfter(settings.preferences.reminders.paymentDaysAfter);
      setWorkOrderDaysBefore(settings.preferences.reminders.workOrderDaysBefore);

      // Messages
      setPaymentReminderMessage(settings.messages.paymentReminder);
      setPaymentOverdueMessage(settings.messages.paymentOverdue);
      setWorkOrderReminderMessage(settings.messages.workOrderReminder);
      setQuoteFollowUpMessage(settings.messages.quoteFollowUp);
    }
  }, [settings]);

  const handleSavePreferences = async () => {
    try {
      const preferences: Partial<NotificationPreferences> = {
        email: {
          enabled: emailEnabled,
          newQuote: emailNewQuote,
          quoteApproved: emailQuoteApproved,
          quoteRejected: emailQuoteRejected,
          newWorkOrder: emailNewWorkOrder,
          workOrderCompleted: emailWorkOrderCompleted,
          paymentReceived: emailPaymentReceived,
          paymentOverdue: emailPaymentOverdue,
        },
        whatsapp: {
          enabled: whatsappEnabled,
          paymentReminder: whatsappPaymentReminder,
          workOrderReminder: whatsappWorkOrderReminder,
        },
        reminders: {
          paymentDaysBefore,
          paymentOnDueDate,
          paymentDaysAfter,
          workOrderDaysBefore,
        },
      };

      await updatePreferences.mutateAsync(preferences);
      setPrefsSaved(true);
      setTimeout(() => setPrefsSaved(false), 3000);
    } catch (error) {
      console.error('Error saving preferences:', error);
    }
  };

  const handleSaveMessages = async () => {
    try {
      const messages: Partial<NotificationMessages> = {
        paymentReminder: paymentReminderMessage,
        paymentOverdue: paymentOverdueMessage,
        workOrderReminder: workOrderReminderMessage,
        quoteFollowUp: quoteFollowUpMessage,
      };

      await updateMessages.mutateAsync(messages);
      setMessagesSaved(true);
      setTimeout(() => setMessagesSaved(false), 3000);
    } catch (error) {
      console.error('Error saving messages:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Preferências de notificação */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            {t('title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="email">
                <Mail className="h-4 w-4 mr-2" />
                {t('tabs.email')}
              </TabsTrigger>
              {showWhatsApp && (
                <TabsTrigger value="whatsapp">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  {t('tabs.whatsapp')}
                </TabsTrigger>
              )}
              <TabsTrigger value="reminders">
                <Clock className="h-4 w-4 mr-2" />
                {t('tabs.reminders')}
              </TabsTrigger>
            </TabsList>

            {/* Email Tab */}
            <TabsContent value="email">
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">
                      {t('email.title')}
                    </h4>
                    <p className="text-sm text-gray-500">
                      {t('email.description')}
                    </p>
                  </div>
                  <Switch
                    checked={emailEnabled}
                    onCheckedChange={setEmailEnabled}
                  />
                </div>

                <div className={emailEnabled ? '' : 'opacity-50 pointer-events-none'}>
                  <h5 className="text-sm font-medium text-gray-700 mb-4">
                    {t('email.quotes')}
                  </h5>
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">
                        {t('email.newQuote')}
                      </span>
                      <Switch
                        checked={emailNewQuote}
                        onCheckedChange={setEmailNewQuote}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">
                        {t('email.quoteApproved')}
                      </span>
                      <Switch
                        checked={emailQuoteApproved}
                        onCheckedChange={setEmailQuoteApproved}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">
                        {t('email.quoteRejected')}
                      </span>
                      <Switch
                        checked={emailQuoteRejected}
                        onCheckedChange={setEmailQuoteRejected}
                      />
                    </div>
                  </div>

                  <h5 className="text-sm font-medium text-gray-700 mb-4">
                    {t('email.workOrders')}
                  </h5>
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">
                        {t('email.newWorkOrder')}
                      </span>
                      <Switch
                        checked={emailNewWorkOrder}
                        onCheckedChange={setEmailNewWorkOrder}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">
                        {t('email.workOrderCompleted')}
                      </span>
                      <Switch
                        checked={emailWorkOrderCompleted}
                        onCheckedChange={setEmailWorkOrderCompleted}
                      />
                    </div>
                  </div>

                  <h5 className="text-sm font-medium text-gray-700 mb-4">
                    {t('email.charges')}
                  </h5>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">
                        {t('email.paymentReceived')}
                      </span>
                      <Switch
                        checked={emailPaymentReceived}
                        onCheckedChange={setEmailPaymentReceived}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">
                        {t('email.paymentOverdue')}
                      </span>
                      <Switch
                        checked={emailPaymentOverdue}
                        onCheckedChange={setEmailPaymentOverdue}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* WhatsApp Tab - Hidden for English locales */}
            {showWhatsApp && (
              <TabsContent value="whatsapp">
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="font-medium text-gray-900">
                        {t('whatsapp.title')}
                      </h4>
                      <p className="text-sm text-gray-500">
                        {t('whatsapp.description')}
                      </p>
                    </div>
                    <Switch
                      checked={whatsappEnabled}
                      onCheckedChange={setWhatsappEnabled}
                    />
                  </div>

                  <Alert variant={isZApiConnected ? 'success' : 'warning'} className="mb-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-2">
                        <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div className="text-sm">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium">{t('whatsapp.integrationTitle')}</p>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              isZApiConnected
                                ? 'bg-success/10 text-success'
                                : 'bg-warning/10 text-warning'
                            }`}>
                              {isZApiConnected ? tIntegrations.t('zapiConnected') : tIntegrations.t('zapiNotConfigured')}
                            </span>
                          </div>
                          <p className="mt-1">
                            {t('whatsapp.integrationDescription')}
                          </p>
                        </div>
                      </div>
                      <Link
                        href="/settings/integrations"
                        className="flex-shrink-0 inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                      >
                        {t('whatsapp.configureIntegration')}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </Alert>

                  <div className={whatsappEnabled ? '' : 'opacity-50 pointer-events-none'}>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-medium text-gray-700">
                            {t('whatsapp.paymentReminder')}
                          </span>
                          <p className="text-xs text-gray-500">
                            {t('whatsapp.paymentReminderDescription')}
                          </p>
                        </div>
                        <Switch
                          checked={whatsappPaymentReminder}
                          onCheckedChange={setWhatsappPaymentReminder}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-medium text-gray-700">
                            {t('whatsapp.scheduleReminder')}
                          </span>
                          <p className="text-xs text-gray-500">
                            {t('whatsapp.scheduleReminderDescription')}
                          </p>
                        </div>
                        <Switch
                          checked={whatsappWorkOrderReminder}
                          onCheckedChange={setWhatsappWorkOrderReminder}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            )}

            {/* Reminders Tab */}
            <TabsContent value="reminders">
              <div className="space-y-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-4">
                    {t('reminders.chargeReminders')}
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField label={t('reminders.daysBefore')}>
                      <Input
                        type="number"
                        min={0}
                        max={30}
                        value={paymentDaysBefore}
                        onChange={(e) => setPaymentDaysBefore(Number(e.target.value))}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {t('reminders.zeroNoSend')}
                      </p>
                    </FormField>

                    <div className="flex flex-col">
                      <label className="text-sm font-medium text-gray-700 mb-2">
                        {t('reminders.onDueDate')}
                      </label>
                      <div className="flex items-center h-10">
                        <Switch
                          checked={paymentOnDueDate}
                          onCheckedChange={setPaymentOnDueDate}
                        />
                        <span className="ml-2 text-sm text-gray-500">
                          {paymentOnDueDate ? t('reminders.send') : t('reminders.dontSend')}
                        </span>
                      </div>
                    </div>

                    <FormField label={t('reminders.daysAfter')}>
                      <Input
                        type="number"
                        min={0}
                        max={30}
                        value={paymentDaysAfter}
                        onChange={(e) => setPaymentDaysAfter(Number(e.target.value))}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {t('reminders.zeroNoSend')}
                      </p>
                    </FormField>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h4 className="font-medium text-gray-900 mb-4">
                    {t('reminders.workOrderReminders')}
                  </h4>

                  <div className="max-w-xs">
                    <FormField label={t('reminders.daysBeforeSchedule')}>
                      <Input
                        type="number"
                        min={0}
                        max={7}
                        value={workOrderDaysBefore}
                        onChange={(e) => setWorkOrderDaysBefore(Number(e.target.value))}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {t('reminders.zeroNoSend')}
                      </p>
                    </FormField>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {prefsSaved && (
            <Alert variant="success" className="mt-4">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4" />
                {t('preferencesSaved')}
              </div>
            </Alert>
          )}

          {updatePreferences.error && (
            <Alert variant="error" className="mt-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {t('preferencesError')}
              </div>
            </Alert>
          )}

          <div className="flex justify-end mt-6">
            <Button
              onClick={handleSavePreferences}
              loading={updatePreferences.isPending}
              leftIcon={<Check className="h-4 w-4" />}
            >
              {t('savePreferences')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Mensagens personalizadas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            {t('messages.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert variant="info">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">{t('messages.infoTitle')}</p>
                <p>
                  {t('messages.infoDescription')}
                </p>
              </div>
            </div>
          </Alert>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <NotificationMessageEditor
              label={t('messages.paymentReminder')}
              description={t('messages.paymentReminderDescription')}
              value={paymentReminderMessage}
              onChange={setPaymentReminderMessage}
              defaultValue={DEFAULT_NOTIFICATION_MESSAGES.paymentReminder}
            />

            <NotificationMessageEditor
              label={t('messages.paymentOverdue')}
              description={t('messages.paymentOverdueDescription')}
              value={paymentOverdueMessage}
              onChange={setPaymentOverdueMessage}
              defaultValue={DEFAULT_NOTIFICATION_MESSAGES.paymentOverdue}
            />

            <NotificationMessageEditor
              label={t('messages.workOrderReminder')}
              description={t('messages.workOrderReminderDescription')}
              value={workOrderReminderMessage}
              onChange={setWorkOrderReminderMessage}
              defaultValue={DEFAULT_NOTIFICATION_MESSAGES.workOrderReminder}
            />

            <NotificationMessageEditor
              label={t('messages.quoteFollowUp')}
              description={t('messages.quoteFollowUpDescription')}
              value={quoteFollowUpMessage}
              onChange={setQuoteFollowUpMessage}
              defaultValue={DEFAULT_NOTIFICATION_MESSAGES.quoteFollowUp}
            />
          </div>

          {messagesSaved && (
            <Alert variant="success">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4" />
                {t('messagesSaved')}
              </div>
            </Alert>
          )}

          {updateMessages.error && (
            <Alert variant="error">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {t('messagesError')}
              </div>
            </Alert>
          )}

          <div className="flex justify-end">
            <Button
              onClick={handleSaveMessages}
              loading={updateMessages.isPending}
              leftIcon={<Check className="h-4 w-4" />}
            >
              {t('saveMessages')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
