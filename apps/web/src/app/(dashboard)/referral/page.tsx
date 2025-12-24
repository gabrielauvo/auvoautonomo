'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getReferralDashboard,
  setCustomCode,
  getReferralStatusLabel,
  getReferralStatusColor,
  getRewardReasonLabel,
  getPlatformLabel,
  type ReferralDashboard,
} from '@/services';
import {
  Gift,
  Users,
  MousePointerClick,
  Trophy,
  Copy,
  Check,
  Share2,
  Smartphone,
  Monitor,
  Clock,
  Sparkles,
  Edit2,
  X,
  Loader2,
} from 'lucide-react';

export default function ReferralPage() {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [isEditingCode, setIsEditingCode] = useState(false);
  const [customCodeInput, setCustomCodeInput] = useState('');

  const { data: dashboard, isLoading, error } = useQuery<ReferralDashboard>({
    queryKey: ['referral-dashboard'],
    queryFn: getReferralDashboard,
  });

  const customCodeMutation = useMutation({
    mutationFn: (customCode: string) => setCustomCode({ customCode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['referral-dashboard'] });
      setIsEditingCode(false);
      toast.success('Código personalizado definido com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao definir código personalizado');
    },
  });

  const handleCopyLink = async () => {
    if (!dashboard?.shareUrl) return;

    try {
      await navigator.clipboard.writeText(dashboard.shareUrl);
      setCopied(true);
      toast.success('Link copiado!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Erro ao copiar link');
    }
  };

  const handleShare = async () => {
    if (!dashboard?.shareUrl) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Conheça o Auvo Autônomo',
          text: 'Experimente o Auvo Autônomo e gerencie seu negócio de forma profissional!',
          url: dashboard.shareUrl,
        });
      } catch {
        // User cancelled or error
      }
    } else {
      handleCopyLink();
    }
  };

  const handleSaveCustomCode = () => {
    if (!customCodeInput.trim()) {
      toast.error('Digite um código válido');
      return;
    }
    customCodeMutation.mutate(customCodeInput.trim().toUpperCase());
  };

  useEffect(() => {
    if (dashboard?.code.customCode) {
      setCustomCodeInput(dashboard.code.customCode);
    }
  }, [dashboard?.code.customCode]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Erro ao carregar dados de indicação</p>
      </div>
    );
  }

  const { code, stats, referrals, rewards, shareUrl } = dashboard;
  const progressToMilestone = Math.min(stats.totalPaidConversions, 10);
  const hasReachedMilestone = stats.totalPaidConversions >= 10;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Programa de Indicação</h1>
        <p className="text-gray-600 mt-1">
          Indique amigos e ganhe meses grátis de assinatura
        </p>
      </div>

      {/* Share Card */}
      <div className="bg-gradient-to-br from-purple-600 via-purple-700 to-purple-900 rounded-2xl p-6 text-white">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold mb-2">Seu link de indicação</h2>
            <p className="text-purple-200 text-sm">
              Compartilhe este link com amigos e colegas
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-full p-3">
            <Gift className="w-6 h-6" />
          </div>
        </div>

        {/* Code Display */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-purple-200 text-xs mb-1">Seu código:</p>
              {isEditingCode ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customCodeInput}
                    onChange={(e) => setCustomCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    placeholder="SEU-CODIGO"
                    maxLength={20}
                    className="bg-white/20 text-white placeholder-purple-300 font-mono text-lg font-bold tracking-wider px-3 py-1 rounded-lg w-40 focus:outline-none focus:ring-2 focus:ring-white/50"
                  />
                  <button
                    onClick={handleSaveCustomCode}
                    disabled={customCodeMutation.isPending}
                    className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {customCodeMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingCode(false);
                      setCustomCodeInput(code.customCode || '');
                    }}
                    className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-lg font-bold tracking-wider">
                    {code.customCode || code.code}
                  </span>
                  <button
                    onClick={() => setIsEditingCode(true)}
                    className="p-1 hover:bg-white/20 rounded transition-colors"
                    title="Personalizar código"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Share URL */}
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-3 font-mono text-sm truncate">
            {shareUrl}
          </div>
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-2 bg-white text-purple-700 px-4 py-3 rounded-lg font-semibold hover:bg-purple-50 transition-colors"
          >
            {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            {copied ? 'Copiado!' : 'Copiar'}
          </button>
          <button
            onClick={handleShare}
            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-3 rounded-lg font-semibold transition-colors"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <MousePointerClick className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.totalClicks}</p>
          <p className="text-sm text-gray-500">Cliques no link</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.totalSignups}</p>
          <p className="text-sm text-gray-500">Cadastros</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <Trophy className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.totalPaidConversions}</p>
          <p className="text-sm text-gray-500">Assinaturas pagas</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Gift className="w-5 h-5 text-amber-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.totalDaysEarned}</p>
          <p className="text-sm text-gray-500">Dias ganhos</p>
        </div>
      </div>

      {/* Milestone Progress */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Bônus de 12 meses</h3>
            <p className="text-sm text-gray-500">
              Indique 10 amigos que assinem e ganhe 12 meses grátis!
            </p>
          </div>
        </div>

        <div className="relative">
          <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                hasReachedMilestone
                  ? 'bg-gradient-to-r from-amber-400 to-orange-500'
                  : 'bg-purple-600'
              }`}
              style={{ width: `${(progressToMilestone / 10) * 100}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-sm">
            <span className="text-gray-500">{progressToMilestone}/10 indicações</span>
            {hasReachedMilestone ? (
              <span className="text-amber-600 font-semibold flex items-center gap-1">
                <Check className="w-4 h-4" /> Bônus conquistado!
              </span>
            ) : (
              <span className="text-gray-500">
                Faltam {10 - progressToMilestone} indicações
              </span>
            )}
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-purple-50 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Como funciona</h3>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-semibold">
              1
            </div>
            <div>
              <p className="font-medium text-gray-900">Compartilhe seu link</p>
              <p className="text-sm text-gray-600">
                Envie para amigos, colegas e nas redes sociais
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-semibold">
              2
            </div>
            <div>
              <p className="font-medium text-gray-900">Amigo assina</p>
              <p className="text-sm text-gray-600">
                Quando ele assinar um plano pago, você ganha
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-semibold">
              3
            </div>
            <div>
              <p className="font-medium text-gray-900">Ganhe 1 mês grátis</p>
              <p className="text-sm text-gray-600">
                +12 meses bônus ao atingir 10 indicações!
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Referrals List */}
      {referrals.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Suas indicações</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {referrals.map((referral) => (
              <div key={referral.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                    <span className="text-purple-600 font-semibold">
                      {referral.referee.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{referral.referee.name}</p>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      {referral.platform === 'IOS' || referral.platform === 'ANDROID' ? (
                        <Smartphone className="w-3 h-3" />
                      ) : (
                        <Monitor className="w-3 h-3" />
                      )}
                      <span>{getPlatformLabel(referral.platform)}</span>
                      <span className="text-gray-300">•</span>
                      <Clock className="w-3 h-3" />
                      <span>{new Date(referral.createdAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getReferralStatusColor(referral.status)}`}>
                  {getReferralStatusLabel(referral.status)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rewards List */}
      {rewards.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Histórico de recompensas</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {rewards.map((reward) => (
              <div key={reward.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    reward.reason === 'MILESTONE_10'
                      ? 'bg-gradient-to-br from-amber-400 to-orange-500'
                      : reward.reason === 'REVERSAL'
                        ? 'bg-red-100'
                        : 'bg-green-100'
                  }`}>
                    {reward.reason === 'MILESTONE_10' ? (
                      <Sparkles className="w-5 h-5 text-white" />
                    ) : reward.reason === 'REVERSAL' ? (
                      <X className="w-5 h-5 text-red-600" />
                    ) : (
                      <Gift className="w-5 h-5 text-green-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {getRewardReasonLabel(reward.reason)}
                      {reward.referral?.referee?.name && (
                        <span className="text-gray-500 font-normal">
                          {' '}• {reward.referral.referee.name}
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(reward.createdAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
                <span className={`font-semibold ${
                  reward.reason === 'REVERSAL' ? 'text-red-600' : 'text-green-600'
                }`}>
                  {reward.reason === 'REVERSAL' ? '-' : '+'}{reward.daysAwarded} dias
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {referrals.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-purple-600" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Nenhuma indicação ainda</h3>
          <p className="text-gray-500 mb-4">
            Compartilhe seu link e comece a ganhar meses grátis!
          </p>
          <button
            onClick={handleShare}
            className="inline-flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors"
          >
            <Share2 className="w-5 h-5" />
            Compartilhar agora
          </button>
        </div>
      )}
    </div>
  );
}
