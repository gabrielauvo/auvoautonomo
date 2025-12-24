/**
 * Settings Service
 *
 * Serviço para gerenciamento de configurações do usuário e empresa
 */

import api from './api';

// ============================================
// TYPES
// ============================================

// Perfil do usuário
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  language: string;
  timezone: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileDto {
  name?: string;
  phone?: string;
  language?: string;
  timezone?: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// Pix key types
export type PixKeyType = 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'RANDOM';

export const PIX_KEY_TYPES: { value: PixKeyType; label: string }[] = [
  { value: 'CPF', label: 'CPF' },
  { value: 'CNPJ', label: 'CNPJ' },
  { value: 'EMAIL', label: 'E-mail' },
  { value: 'PHONE', label: 'Telefone' },
  { value: 'RANDOM', label: 'Chave aleatória' },
];

// Dados da empresa
export interface CompanySettings {
  id: string;
  tradeName: string; // Nome comercial
  legalName?: string; // Razão social
  taxId?: string; // CPF/CNPJ
  stateRegistration?: string; // Inscrição estadual
  email?: string;
  phone?: string;
  whatsapp?: string;
  address?: CompanyAddress;
  logoUrl?: string;
  branding: CompanyBranding;
  // Pix settings
  pixKey?: string | null;
  pixKeyType?: PixKeyType | null;
  pixKeyOwnerName?: string | null;
  pixKeyEnabled?: boolean;
  pixKeyFeatureEnabled?: boolean; // Feature flag from plan
  createdAt: string;
  updatedAt: string;
}

export interface CompanyAddress {
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

export interface CompanyBranding {
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  backgroundColor: string;
  accentColor: string;
}

export interface UpdateCompanyDto {
  tradeName?: string;
  legalName?: string;
  taxId?: string;
  stateRegistration?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  address?: CompanyAddress;
  branding?: Partial<CompanyBranding>;
  // Pix settings
  pixKey?: string | null;
  pixKeyType?: PixKeyType | null;
  pixKeyOwnerName?: string | null;
  pixKeyEnabled?: boolean;
}

// Plano e assinatura
export type PlanType = 'FREE' | 'PRO';

export interface PlanInfo {
  type: PlanType;
  name: string;
  price: number;
  billingCycle: 'monthly' | 'yearly';
  features: string[];
  limits: PlanLimits;
}

export interface PlanLimits {
  maxClients: number;
  maxQuotes: number;
  maxWorkOrders: number;
  maxPayments: number;
  maxAttachments: number;
  maxUsers: number;
}

export interface PlanUsage {
  clientsCount: number;
  quotesCount: number;
  workOrdersCount: number;
  paymentsCount: number;
  attachmentsCount: number;
  usersCount: number;
}

export interface SubscriptionInfo {
  id?: string;
  /** Tipo do plano: FREE ou PRO */
  planKey: 'FREE' | 'PRO';
  planName: string;
  /** Status da assinatura: TRIALING = em trial, ACTIVE = assinante pago */
  subscriptionStatus: 'FREE' | 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'BLOCKED' | 'EXPIRED';
  /** Período de cobrança (mensal ou anual) */
  billingPeriod?: 'MONTHLY' | 'YEARLY';
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  /** Data de fim do trial */
  trialEndAt?: string | null;
  /** Dias restantes do trial */
  trialDaysRemaining?: number;
  cancelAtPeriodEnd?: boolean;
  createdAt?: string;
}

export interface UpgradeResult {
  paymentUrl: string;
  subscriptionId: string;
}

// Templates
export interface QuoteTemplate {
  showLogo: boolean;
  logoPosition: 'left' | 'center' | 'right';
  primaryColor: string;
  secondaryColor: string;
  headerText?: string;
  footerText?: string;
  defaultMessage?: string;
  termsAndConditions?: string;
  showSignature: boolean;
}

export interface WorkOrderTemplate {
  showLogo: boolean;
  logoPosition: 'left' | 'center' | 'right';
  primaryColor: string;
  layout: 'compact' | 'detailed';
  showChecklist: boolean;
  footerText?: string;
  showSignatureField: boolean;
  signatureLabel?: string;
}

export interface ChargeTemplate {
  whatsappMessage: string;
  emailSubject?: string;
  emailBody?: string;
  reminderMessage?: string;
}

export interface TemplateSettings {
  quote: QuoteTemplate;
  workOrder: WorkOrderTemplate;
  charge: ChargeTemplate;
}

// Termos de Aceite (Acceptance Terms)
export interface AcceptanceTermsSettings {
  enabled: boolean;
  termsContent: string | null;
  version: number;
  updatedAt: string | null;
  termsHash: string | null;
  featureAvailable: boolean;
  planMessage: string | null;
}

export interface UpdateAcceptanceTermsDto {
  enabled?: boolean;
  termsContent?: string | null;
}

// Notificações
export interface NotificationPreferences {
  email: EmailNotificationPrefs;
  whatsapp: WhatsAppNotificationPrefs;
  reminders: ReminderPrefs;
}

export interface EmailNotificationPrefs {
  enabled: boolean;
  newQuote: boolean;
  quoteApproved: boolean;
  quoteRejected: boolean;
  newWorkOrder: boolean;
  workOrderCompleted: boolean;
  paymentReceived: boolean;
  paymentOverdue: boolean;
}

export interface WhatsAppNotificationPrefs {
  enabled: boolean;
  paymentReminder: boolean;
  workOrderReminder: boolean;
}

export interface ReminderPrefs {
  paymentDaysBefore: number;
  paymentOnDueDate: boolean;
  paymentDaysAfter: number;
  workOrderDaysBefore: number;
}

export interface NotificationMessages {
  paymentReminder: string;
  paymentOverdue: string;
  workOrderReminder: string;
  quoteFollowUp: string;
}

export interface NotificationSettings {
  preferences: NotificationPreferences;
  messages: NotificationMessages;
}

// Segurança
export interface SecurityInfo {
  lastPasswordChange?: string;
  twoFactorEnabled: boolean;
  activeSessions: SessionInfo[];
}

export interface SessionInfo {
  id: string;
  device: string;
  browser: string;
  location?: string;
  lastActive: string;
  current: boolean;
}

// ============================================
// DEFAULT VALUES
// ============================================

export const DEFAULT_BRANDING: CompanyBranding = {
  primaryColor: '#7C3AED',
  secondaryColor: '#6D28D9',
  textColor: '#1F2937',
  backgroundColor: '#FFFFFF',
  accentColor: '#10B981',
};

export const DEFAULT_QUOTE_TEMPLATE: QuoteTemplate = {
  showLogo: true,
  logoPosition: 'left',
  primaryColor: '#7C3AED',
  secondaryColor: '#6D28D9',
  headerText: '',
  footerText: 'Obrigado pela preferência!',
  defaultMessage: 'Segue nosso orçamento conforme solicitado.',
  termsAndConditions: '',
  showSignature: false,
};

export const DEFAULT_WORK_ORDER_TEMPLATE: WorkOrderTemplate = {
  showLogo: true,
  logoPosition: 'left',
  primaryColor: '#7C3AED',
  layout: 'detailed',
  showChecklist: true,
  footerText: '',
  showSignatureField: true,
  signatureLabel: 'Assinatura do Cliente',
};

export const DEFAULT_CHARGE_TEMPLATE: ChargeTemplate = {
  whatsappMessage: `Olá {nome_cliente}! 👋

Segue sua cobrança:

💰 *Valor:* {valor}
📅 *Vencimento:* {data}

🔗 *Link para pagamento:*
{link_pagamento}

Qualquer dúvida, estou à disposição! 😊`,
  emailSubject: 'Cobrança - {valor}',
  emailBody: '',
  reminderMessage: `Olá {nome_cliente}, lembramos que seu pagamento no valor de {valor} vence em {data}.
Se já pagou, desconsidere esta mensagem.`,
};

export const DEFAULT_NOTIFICATION_MESSAGES: NotificationMessages = {
  paymentReminder: `Olá {nome_cliente}, lembramos que seu pagamento no valor de {valor} vence em {data}. Se já pagou, desconsidere.`,
  paymentOverdue: `Olá {nome_cliente}, identificamos que o pagamento no valor de {valor} está em atraso desde {data}. Entre em contato conosco.`,
  workOrderReminder: `Olá {nome_cliente}, sua ordem de serviço está agendada para {data}. Confirma o atendimento?`,
  quoteFollowUp: `Olá {nome_cliente}, enviamos um orçamento no valor de {valor}. Teve alguma dúvida? Estamos à disposição!`,
};

// ============================================
// PLAN COMPARISON
// ============================================

export const PLAN_FEATURES: Record<PlanType, PlanInfo> = {
  FREE: {
    type: 'FREE',
    name: 'Plano Gratuito',
    price: 0,
    billingCycle: 'monthly',
    features: [
      'Até 10 clientes',
      'Até 10 orçamentos',
      'Até 10 OS',
      'Até 5 cobranças',
      'Suporte por email',
    ],
    limits: {
      maxClients: 10,
      maxQuotes: 10,
      maxWorkOrders: 10,
      maxPayments: 5,
      maxAttachments: 10,
      maxUsers: 1,
    },
  },
  PRO: {
    type: 'PRO',
    name: 'Plano PRO',
    price: 99.9,
    billingCycle: 'monthly',
    features: [
      'Clientes ilimitados',
      'Orçamentos ilimitados',
      'OS ilimitadas',
      'Cobranças ilimitadas',
      'Templates personalizados',
      'Relatórios avançados',
      'Exportação em PDF',
      'Integração com WhatsApp',
      'Suporte prioritário',
      'Sem marca d\'água',
    ],
    limits: {
      maxClients: -1,
      maxQuotes: -1,
      maxWorkOrders: -1,
      maxPayments: -1,
      maxAttachments: -1,
      maxUsers: 1,
    },
  },
};

// ============================================
// API SERVICE
// ============================================

export const settingsService = {
  // ========== PERFIL ==========
  async getProfile(): Promise<UserProfile> {
    const response = await api.get('/settings/profile');
    return response.data;
  },

  async updateProfile(data: UpdateProfileDto): Promise<UserProfile> {
    const response = await api.put('/settings/profile', data);
    return response.data;
  },

  async changePassword(data: ChangePasswordDto): Promise<void> {
    await api.post('/settings/change-password', data);
  },

  /**
   * Upload de avatar
   *
   * SEGURANÇA:
   * - Apenas imagens permitidas
   * - Tamanho máximo 5MB
   * - Validação de tipo MIME e extensão
   */
  async uploadAvatar(file: File): Promise<{ avatarUrl: string }> {
    // Validação de segurança
    const { validateFileUpload } = await import('@/lib/sanitize');

    const validation = validateFileUpload(file, {
      maxSizeMB: 5,
      allowedExtensions: ['jpg', 'jpeg', 'png', 'webp'],
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    });

    if (!validation.valid) {
      throw new Error(validation.error || 'Imagem inválida');
    }

    const safeFile = new File([file], validation.sanitizedName || file.name, { type: file.type });

    const formData = new FormData();
    formData.append('avatar', safeFile);
    const response = await api.post('/settings/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // ========== EMPRESA ==========
  async getCompanySettings(): Promise<CompanySettings> {
    const response = await api.get('/settings/company');
    return response.data;
  },

  async updateCompanySettings(data: UpdateCompanyDto): Promise<CompanySettings> {
    const response = await api.put('/settings/company', data);
    return response.data;
  },

  /**
   * Upload de logo da empresa
   *
   * SEGURANÇA:
   * - Apenas imagens permitidas
   * - Tamanho máximo 5MB
   * - Validação de tipo MIME e extensão
   */
  async uploadLogo(file: File): Promise<{ logoUrl: string }> {
    // Validação de segurança
    const { validateFileUpload } = await import('@/lib/sanitize');

    const validation = validateFileUpload(file, {
      maxSizeMB: 5,
      allowedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'svg'],
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
    });

    if (!validation.valid) {
      throw new Error(validation.error || 'Imagem inválida');
    }

    const safeFile = new File([file], validation.sanitizedName || file.name, { type: file.type });

    const formData = new FormData();
    formData.append('logo', safeFile);
    const response = await api.post('/settings/company/logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async deleteLogo(): Promise<void> {
    await api.delete('/settings/company/logo');
  },

  // ========== PLANO / ASSINATURA ==========
  async getSubscription(): Promise<SubscriptionInfo> {
    const response = await api.get('/billing/subscription');
    return response.data;
  },

  async upgradePlan(planType: PlanType): Promise<UpgradeResult> {
    const response = await api.post('/billing/upgrade', { plan: planType });
    return response.data;
  },

  async cancelSubscription(): Promise<void> {
    await api.post('/billing/cancel');
  },

  async reactivateSubscription(): Promise<SubscriptionInfo> {
    const response = await api.post('/billing/reactivate');
    return response.data;
  },

  // ========== TEMPLATES ==========
  async getTemplateSettings(): Promise<TemplateSettings> {
    const response = await api.get('/settings/templates');
    return response.data;
  },

  async updateQuoteTemplate(data: Partial<QuoteTemplate>): Promise<QuoteTemplate> {
    const response = await api.put('/settings/templates/quote', data);
    return response.data;
  },

  async updateWorkOrderTemplate(data: Partial<WorkOrderTemplate>): Promise<WorkOrderTemplate> {
    const response = await api.put('/settings/templates/work-order', data);
    return response.data;
  },

  async updateChargeTemplate(data: Partial<ChargeTemplate>): Promise<ChargeTemplate> {
    const response = await api.put('/settings/templates/charge', data);
    return response.data;
  },

  async resetTemplateToDefault(type: 'quote' | 'workOrder' | 'charge'): Promise<void> {
    await api.post(`/settings/templates/${type}/reset`);
  },

  // ========== TERMOS DE ACEITE ==========
  async getAcceptanceTerms(): Promise<AcceptanceTermsSettings> {
    const response = await api.get('/settings/acceptance-terms');
    return response.data;
  },

  async updateAcceptanceTerms(data: UpdateAcceptanceTermsDto): Promise<AcceptanceTermsSettings> {
    const response = await api.put('/settings/acceptance-terms', data);
    return response.data;
  },

  // ========== NOTIFICAÇÕES ==========
  async getNotificationSettings(): Promise<NotificationSettings> {
    const response = await api.get('/settings/notifications');
    return response.data;
  },

  async updateNotificationPreferences(
    data: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    const response = await api.put('/settings/notifications/preferences', data);
    return response.data;
  },

  async updateNotificationMessages(
    data: Partial<NotificationMessages>
  ): Promise<NotificationMessages> {
    const response = await api.put('/settings/notifications/messages', data);
    return response.data;
  },

  // ========== SEGURANÇA ==========
  async getSecurityInfo(): Promise<SecurityInfo> {
    const response = await api.get('/settings/security');
    return response.data;
  },

  async logoutAllSessions(): Promise<void> {
    await api.post('/settings/security/logout-all');
  },

  async revokeSession(sessionId: string): Promise<void> {
    await api.delete(`/settings/security/sessions/${sessionId}`);
  },

  async deleteAccount(password: string): Promise<void> {
    await api.post('/settings/delete-account', { password });
  },
};

// ============================================
// HELPERS
// ============================================

/**
 * Verifica se o limite foi atingido
 */
export function isLimitReached(
  current: number,
  max: number
): boolean {
  if (max === -1) return false; // -1 = ilimitado
  return current >= max;
}

/**
 * Calcula percentual de uso
 */
export function getUsagePercentage(
  current: number,
  max: number
): number {
  if (max === -1) return 0;
  return Math.min(100, Math.round((current / max) * 100));
}

/**
 * Formata o preço do plano
 */
export function formatPlanPrice(price: number): string {
  if (price === 0) return 'Grátis';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(price);
}

/**
 * Substitui placeholders na mensagem
 */
export function replacePlaceholders(
  message: string,
  data: Record<string, string>
): string {
  let result = message;
  Object.entries(data).forEach(([key, value]) => {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  });
  return result;
}

/**
 * Lista de placeholders disponíveis
 */
export const AVAILABLE_PLACEHOLDERS = [
  { key: 'nome_cliente', description: 'Nome do cliente' },
  { key: 'valor', description: 'Valor formatado (R$)' },
  { key: 'data', description: 'Data formatada' },
  { key: 'link_pagamento', description: 'Link de pagamento' },
  { key: 'numero_os', description: 'Número da OS' },
  { key: 'numero_orcamento', description: 'Número do orçamento' },
];

export default settingsService;
