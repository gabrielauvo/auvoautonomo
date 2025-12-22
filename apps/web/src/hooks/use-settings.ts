/**
 * Settings Hooks
 *
 * React Query hooks para o módulo de configurações
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  settingsService,
  UserProfile,
  UpdateProfileDto,
  ChangePasswordDto,
  CompanySettings,
  UpdateCompanyDto,
  SubscriptionInfo,
  TemplateSettings,
  QuoteTemplate,
  WorkOrderTemplate,
  ChargeTemplate,
  NotificationSettings,
  NotificationPreferences,
  NotificationMessages,
  SecurityInfo,
  PlanType,
  UpgradeResult,
  AcceptanceTermsSettings,
  UpdateAcceptanceTermsDto,
} from '@/services/settings.service';

// ============================================
// PROFILE HOOKS
// ============================================

/**
 * Hook para obter perfil do usuário
 */
export function useProfile() {
  return useQuery<UserProfile>({
    queryKey: ['settings', 'profile'],
    queryFn: () => settingsService.getProfile(),
    staleTime: 60000,
  });
}

/**
 * Hook para atualizar perfil
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateProfileDto) => settingsService.updateProfile(data),
    onSuccess: (updatedProfile) => {
      queryClient.setQueryData(['settings', 'profile'], updatedProfile);
      queryClient.invalidateQueries({ queryKey: ['auth', 'user'] });
    },
  });
}

/**
 * Hook para trocar senha
 */
export function useChangePassword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ChangePasswordDto) => settingsService.changePassword(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'security'] });
    },
  });
}

/**
 * Hook para upload de avatar
 */
export function useUploadAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => settingsService.uploadAvatar(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'profile'] });
      queryClient.invalidateQueries({ queryKey: ['auth', 'user'] });
    },
  });
}

// ============================================
// COMPANY HOOKS
// ============================================

/**
 * Hook para obter configurações da empresa
 */
export function useCompanySettings() {
  return useQuery<CompanySettings>({
    queryKey: ['settings', 'company'],
    queryFn: () => settingsService.getCompanySettings(),
    staleTime: 60000,
  });
}

/**
 * Hook para atualizar configurações da empresa
 */
export function useUpdateCompanySettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateCompanyDto) => settingsService.updateCompanySettings(data),
    onSuccess: (updatedSettings) => {
      queryClient.setQueryData(['settings', 'company'], updatedSettings);
    },
  });
}

/**
 * Hook para upload de logo
 */
export function useUploadLogo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => settingsService.uploadLogo(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'company'] });
    },
  });
}

/**
 * Hook para deletar logo
 */
export function useDeleteLogo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => settingsService.deleteLogo(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'company'] });
    },
  });
}

// ============================================
// SUBSCRIPTION HOOKS
// ============================================

/**
 * Hook para obter informações da assinatura
 */
export function useSubscription() {
  return useQuery<SubscriptionInfo>({
    queryKey: ['billing', 'subscription'],
    queryFn: () => settingsService.getSubscription(),
    staleTime: 30000,
  });
}

/**
 * Hook para fazer upgrade do plano
 */
export function useUpgradePlan() {
  const queryClient = useQueryClient();

  return useMutation<UpgradeResult, Error, PlanType>({
    mutationFn: (planType) => settingsService.upgradePlan(planType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing'] });
    },
  });
}

/**
 * Hook para cancelar assinatura
 */
export function useCancelSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => settingsService.cancelSubscription(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing', 'subscription'] });
    },
  });
}

/**
 * Hook para reativar assinatura
 */
export function useReactivateSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => settingsService.reactivateSubscription(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing', 'subscription'] });
    },
  });
}

// ============================================
// TEMPLATE HOOKS
// ============================================

/**
 * Hook para obter configurações de templates
 */
export function useTemplateSettings() {
  return useQuery<TemplateSettings>({
    queryKey: ['settings', 'templates'],
    queryFn: () => settingsService.getTemplateSettings(),
    staleTime: 60000,
  });
}

/**
 * Hook para atualizar template de orçamento
 */
export function useUpdateQuoteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<QuoteTemplate>) => settingsService.updateQuoteTemplate(data),
    onSuccess: (updatedTemplate) => {
      queryClient.setQueryData<TemplateSettings>(
        ['settings', 'templates'],
        (old) => old ? { ...old, quote: updatedTemplate } : undefined
      );
    },
  });
}

/**
 * Hook para atualizar template de OS
 */
export function useUpdateWorkOrderTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<WorkOrderTemplate>) => settingsService.updateWorkOrderTemplate(data),
    onSuccess: (updatedTemplate) => {
      queryClient.setQueryData<TemplateSettings>(
        ['settings', 'templates'],
        (old) => old ? { ...old, workOrder: updatedTemplate } : undefined
      );
    },
  });
}

/**
 * Hook para atualizar template de cobrança
 */
export function useUpdateChargeTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<ChargeTemplate>) => settingsService.updateChargeTemplate(data),
    onSuccess: (updatedTemplate) => {
      queryClient.setQueryData<TemplateSettings>(
        ['settings', 'templates'],
        (old) => old ? { ...old, charge: updatedTemplate } : undefined
      );
    },
  });
}

/**
 * Hook para resetar template para padrão
 */
export function useResetTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (type: 'quote' | 'workOrder' | 'charge') =>
      settingsService.resetTemplateToDefault(type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'templates'] });
    },
  });
}

// ============================================
// ACCEPTANCE TERMS HOOKS
// ============================================

/**
 * Hook para obter configurações de termos de aceite
 */
export function useAcceptanceTerms() {
  return useQuery<AcceptanceTermsSettings>({
    queryKey: ['settings', 'acceptanceTerms'],
    queryFn: () => settingsService.getAcceptanceTerms(),
    staleTime: 60000,
  });
}

/**
 * Hook para atualizar termos de aceite
 */
export function useUpdateAcceptanceTerms() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateAcceptanceTermsDto) =>
      settingsService.updateAcceptanceTerms(data),
    onSuccess: (updatedTerms) => {
      queryClient.setQueryData(['settings', 'acceptanceTerms'], updatedTerms);
    },
  });
}

// ============================================
// NOTIFICATION HOOKS
// ============================================

/**
 * Hook para obter configurações de notificações
 */
export function useNotificationSettings() {
  return useQuery<NotificationSettings>({
    queryKey: ['settings', 'notifications'],
    queryFn: () => settingsService.getNotificationSettings(),
    staleTime: 60000,
  });
}

/**
 * Hook para atualizar preferências de notificações
 */
export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<NotificationPreferences>) =>
      settingsService.updateNotificationPreferences(data),
    onSuccess: (updatedPrefs) => {
      queryClient.setQueryData<NotificationSettings>(
        ['settings', 'notifications'],
        (old) => old ? { ...old, preferences: updatedPrefs } : undefined
      );
    },
  });
}

/**
 * Hook para atualizar mensagens de notificações
 */
export function useUpdateNotificationMessages() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<NotificationMessages>) =>
      settingsService.updateNotificationMessages(data),
    onSuccess: (updatedMessages) => {
      queryClient.setQueryData<NotificationSettings>(
        ['settings', 'notifications'],
        (old) => old ? { ...old, messages: updatedMessages } : undefined
      );
    },
  });
}

// ============================================
// SECURITY HOOKS
// ============================================

/**
 * Hook para obter informações de segurança
 */
export function useSecurityInfo() {
  return useQuery<SecurityInfo>({
    queryKey: ['settings', 'security'],
    queryFn: () => settingsService.getSecurityInfo(),
    staleTime: 30000,
  });
}

/**
 * Hook para logout de todas as sessões
 */
export function useLogoutAllSessions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => settingsService.logoutAllSessions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'security'] });
    },
  });
}

/**
 * Hook para revogar sessão específica
 */
export function useRevokeSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: string) => settingsService.revokeSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'security'] });
    },
  });
}

/**
 * Hook para deletar conta
 */
export function useDeleteAccount() {
  return useMutation({
    mutationFn: (password: string) => settingsService.deleteAccount(password),
  });
}
