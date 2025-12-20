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
import {
  Bell,
  Mail,
  MessageCircle,
  Clock,
  Check,
  AlertCircle,
  Info,
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

export default function NotificationsSettingsPage() {
  const { data: settings, isLoading } = useNotificationSettings();
  const updatePreferences = useUpdateNotificationPreferences();
  const updateMessages = useUpdateNotificationMessages();

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
      console.error('Erro ao salvar preferências:', error);
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
      console.error('Erro ao salvar mensagens:', error);
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
            Preferências de Notificação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="email">
                <Mail className="h-4 w-4 mr-2" />
                Email
              </TabsTrigger>
              <TabsTrigger value="whatsapp">
                <MessageCircle className="h-4 w-4 mr-2" />
                WhatsApp
              </TabsTrigger>
              <TabsTrigger value="reminders">
                <Clock className="h-4 w-4 mr-2" />
                Lembretes
              </TabsTrigger>
            </TabsList>

            {/* Email Tab */}
            <TabsContent value="email">
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">
                      Notificações por Email
                    </h4>
                    <p className="text-sm text-gray-500">
                      Receba atualizações importantes por email
                    </p>
                  </div>
                  <Switch
                    checked={emailEnabled}
                    onCheckedChange={setEmailEnabled}
                  />
                </div>

                <div className={emailEnabled ? '' : 'opacity-50 pointer-events-none'}>
                  <h5 className="text-sm font-medium text-gray-700 mb-4">
                    Orçamentos
                  </h5>
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">
                        Novo orçamento criado
                      </span>
                      <Switch
                        checked={emailNewQuote}
                        onCheckedChange={setEmailNewQuote}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">
                        Orçamento aprovado pelo cliente
                      </span>
                      <Switch
                        checked={emailQuoteApproved}
                        onCheckedChange={setEmailQuoteApproved}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">
                        Orçamento recusado pelo cliente
                      </span>
                      <Switch
                        checked={emailQuoteRejected}
                        onCheckedChange={setEmailQuoteRejected}
                      />
                    </div>
                  </div>

                  <h5 className="text-sm font-medium text-gray-700 mb-4">
                    Ordens de Serviço
                  </h5>
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">
                        Nova OS criada
                      </span>
                      <Switch
                        checked={emailNewWorkOrder}
                        onCheckedChange={setEmailNewWorkOrder}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">
                        OS concluída
                      </span>
                      <Switch
                        checked={emailWorkOrderCompleted}
                        onCheckedChange={setEmailWorkOrderCompleted}
                      />
                    </div>
                  </div>

                  <h5 className="text-sm font-medium text-gray-700 mb-4">
                    Cobranças
                  </h5>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">
                        Pagamento recebido
                      </span>
                      <Switch
                        checked={emailPaymentReceived}
                        onCheckedChange={setEmailPaymentReceived}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">
                        Pagamento em atraso
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

            {/* WhatsApp Tab */}
            <TabsContent value="whatsapp">
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">
                      Notificações via WhatsApp
                    </h4>
                    <p className="text-sm text-gray-500">
                      Envie lembretes automáticos para seus clientes
                    </p>
                  </div>
                  <Switch
                    checked={whatsappEnabled}
                    onCheckedChange={setWhatsappEnabled}
                  />
                </div>

                <Alert variant="info" className="mb-4">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium">Integração WhatsApp Business</p>
                      <p>
                        Os lembretes serão enviados através da API oficial do WhatsApp
                        Business. Certifique-se de que seus clientes autorizaram o
                        recebimento de mensagens.
                      </p>
                    </div>
                  </div>
                </Alert>

                <div className={whatsappEnabled ? '' : 'opacity-50 pointer-events-none'}>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-gray-700">
                          Lembretes de pagamento
                        </span>
                        <p className="text-xs text-gray-500">
                          Enviar lembretes antes e após o vencimento
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
                          Lembretes de agendamento
                        </span>
                        <p className="text-xs text-gray-500">
                          Enviar lembrete antes da data agendada da OS
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

            {/* Reminders Tab */}
            <TabsContent value="reminders">
              <div className="space-y-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-4">
                    Lembretes de Cobrança
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField label="Dias antes do vencimento">
                      <Input
                        type="number"
                        min={0}
                        max={30}
                        value={paymentDaysBefore}
                        onChange={(e) => setPaymentDaysBefore(Number(e.target.value))}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        0 = não enviar
                      </p>
                    </FormField>

                    <div className="flex flex-col">
                      <label className="text-sm font-medium text-gray-700 mb-2">
                        No dia do vencimento
                      </label>
                      <div className="flex items-center h-10">
                        <Switch
                          checked={paymentOnDueDate}
                          onCheckedChange={setPaymentOnDueDate}
                        />
                        <span className="ml-2 text-sm text-gray-500">
                          {paymentOnDueDate ? 'Enviar' : 'Não enviar'}
                        </span>
                      </div>
                    </div>

                    <FormField label="Dias após o vencimento">
                      <Input
                        type="number"
                        min={0}
                        max={30}
                        value={paymentDaysAfter}
                        onChange={(e) => setPaymentDaysAfter(Number(e.target.value))}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        0 = não enviar
                      </p>
                    </FormField>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h4 className="font-medium text-gray-900 mb-4">
                    Lembretes de Ordem de Serviço
                  </h4>

                  <div className="max-w-xs">
                    <FormField label="Dias antes do agendamento">
                      <Input
                        type="number"
                        min={0}
                        max={7}
                        value={workOrderDaysBefore}
                        onChange={(e) => setWorkOrderDaysBefore(Number(e.target.value))}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        0 = não enviar
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
                Preferências salvas com sucesso!
              </div>
            </Alert>
          )}

          {updatePreferences.error && (
            <Alert variant="error" className="mt-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Erro ao salvar preferências. Tente novamente.
              </div>
            </Alert>
          )}

          <div className="flex justify-end mt-6">
            <Button
              onClick={handleSavePreferences}
              loading={updatePreferences.isPending}
              leftIcon={<Check className="h-4 w-4" />}
            >
              Salvar preferências
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Mensagens personalizadas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Mensagens Personalizadas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert variant="info">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Personalize suas mensagens</p>
                <p>
                  Use as variáveis disponíveis para criar mensagens dinâmicas que
                  serão preenchidas automaticamente com os dados do cliente e da
                  cobrança.
                </p>
              </div>
            </div>
          </Alert>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <NotificationMessageEditor
              label="Lembrete de pagamento"
              description="Enviado antes do vencimento"
              value={paymentReminderMessage}
              onChange={setPaymentReminderMessage}
              defaultValue={DEFAULT_NOTIFICATION_MESSAGES.paymentReminder}
            />

            <NotificationMessageEditor
              label="Cobrança em atraso"
              description="Enviado após o vencimento"
              value={paymentOverdueMessage}
              onChange={setPaymentOverdueMessage}
              defaultValue={DEFAULT_NOTIFICATION_MESSAGES.paymentOverdue}
            />

            <NotificationMessageEditor
              label="Lembrete de OS"
              description="Enviado antes do agendamento"
              value={workOrderReminderMessage}
              onChange={setWorkOrderReminderMessage}
              defaultValue={DEFAULT_NOTIFICATION_MESSAGES.workOrderReminder}
            />

            <NotificationMessageEditor
              label="Follow-up de orçamento"
              description="Enviado para orçamentos pendentes"
              value={quoteFollowUpMessage}
              onChange={setQuoteFollowUpMessage}
              defaultValue={DEFAULT_NOTIFICATION_MESSAGES.quoteFollowUp}
            />
          </div>

          {messagesSaved && (
            <Alert variant="success">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4" />
                Mensagens salvas com sucesso!
              </div>
            </Alert>
          )}

          {updateMessages.error && (
            <Alert variant="error">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Erro ao salvar mensagens. Tente novamente.
              </div>
            </Alert>
          )}

          <div className="flex justify-end">
            <Button
              onClick={handleSaveMessages}
              loading={updateMessages.isPending}
              leftIcon={<Check className="h-4 w-4" />}
            >
              Salvar mensagens
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
