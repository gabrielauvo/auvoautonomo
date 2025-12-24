import { api } from './api';

// Types
export interface ReferralCode {
  id: string;
  code: string;
  customCode: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  totalClicks: number;
  totalSignups: number;
  totalPaidConversions: number;
  createdAt: string;
}

export interface ReferralClick {
  id: string;
  platform: 'IOS' | 'ANDROID' | 'WEB' | 'UNKNOWN';
  createdAt: string;
  converted: boolean;
}

export interface Referral {
  id: string;
  status: 'PENDING' | 'SIGNUP_COMPLETE' | 'SUBSCRIPTION_PAID' | 'CHURNED' | 'FRAUDULENT';
  attributionMethod: 'LINK_DIRECT' | 'INSTALL_REFERRER' | 'FINGERPRINT' | 'MANUAL_CODE';
  platform: 'IOS' | 'ANDROID' | 'WEB' | 'UNKNOWN';
  referee: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  convertedAt: string | null;
}

export interface ReferralReward {
  id: string;
  daysAwarded: number;
  reason: 'SINGLE_REFERRAL' | 'MILESTONE_10' | 'BONUS' | 'REVERSAL';
  status: 'PENDING' | 'APPLIED' | 'EXPIRED' | 'REVERSED';
  referral?: {
    referee: {
      name: string;
    };
  };
  createdAt: string;
  appliedAt: string | null;
}

export interface ReferralDashboard {
  code: ReferralCode;
  stats: {
    totalClicks: number;
    totalSignups: number;
    totalPaidConversions: number;
    totalDaysEarned: number;
    pendingRewards: number;
  };
  referrals: Referral[];
  rewards: ReferralReward[];
  shareUrl: string;
}

export interface SetCustomCodeDto {
  customCode: string;
}

// Service functions
export async function getReferralDashboard(): Promise<ReferralDashboard> {
  const response = await api.get('/api/referral/dashboard');
  return response.data;
}

export async function getMyReferralCode(): Promise<ReferralCode> {
  const response = await api.get('/api/referral/my-code');
  return response.data;
}

export async function setCustomCode(dto: SetCustomCodeDto): Promise<ReferralCode> {
  const response = await api.post('/api/referral/custom-code', dto);
  return response.data;
}

export async function getMyReferrals(): Promise<Referral[]> {
  const response = await api.get('/api/referral/my-referrals');
  return response.data;
}

export async function getMyRewards(): Promise<ReferralReward[]> {
  const response = await api.get('/api/referral/my-rewards');
  return response.data;
}

// Utility functions
export function getStatusLabel(status: Referral['status']): string {
  const labels: Record<Referral['status'], string> = {
    PENDING: 'Aguardando',
    SIGNUP_COMPLETE: 'Cadastrado',
    SUBSCRIPTION_PAID: 'Pago',
    CHURNED: 'Cancelado',
    FRAUDULENT: 'Fraude',
  };
  return labels[status] || status;
}

export function getStatusColor(status: Referral['status']): string {
  const colors: Record<Referral['status'], string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    SIGNUP_COMPLETE: 'bg-blue-100 text-blue-800',
    SUBSCRIPTION_PAID: 'bg-green-100 text-green-800',
    CHURNED: 'bg-gray-100 text-gray-800',
    FRAUDULENT: 'bg-red-100 text-red-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

export function getRewardReasonLabel(reason: ReferralReward['reason']): string {
  const labels: Record<ReferralReward['reason'], string> = {
    SINGLE_REFERRAL: 'Indicação',
    MILESTONE_10: 'Bônus 10 indicações',
    BONUS: 'Bônus especial',
    REVERSAL: 'Estorno',
  };
  return labels[reason] || reason;
}

export function getPlatformLabel(platform: Referral['platform']): string {
  const labels: Record<Referral['platform'], string> = {
    IOS: 'iOS',
    ANDROID: 'Android',
    WEB: 'Web',
    UNKNOWN: 'Desconhecido',
  };
  return labels[platform] || platform;
}

export const referralService = {
  getReferralDashboard,
  getMyReferralCode,
  setCustomCode,
  getMyReferrals,
  getMyRewards,
  getStatusLabel,
  getStatusColor,
  getRewardReasonLabel,
  getPlatformLabel,
};
