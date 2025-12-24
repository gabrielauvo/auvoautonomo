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
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  Skeleton,
  Input,
} from '@/components/ui';
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
  Link as LinkIcon,
  QrCode,
  TrendingUp,
  Calendar,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ReferralPage() {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [isEditingCode, setIsEditingCode] = useState(false);
  const [customCodeInput, setCustomCodeInput] = useState('');
  const [showQRCode, setShowQRCode] = useState(false);

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
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <div className="grid grid-cols-4 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Gift className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-500">Erro ao carregar dados de indicação</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['referral-dashboard'] })}
          >
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { code, stats, referrals, rewards, shareUrl } = dashboard;
  const progressToMilestone = Math.min(stats.totalPaidConversions, 10);
  const hasReachedMilestone = stats.totalPaidConversions >= 10;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Programa de Indicação</h1>
          <p className="text-gray-500 mt-1">
            Indique amigos e ganhe meses grátis de assinatura
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="primary" className="text-sm px-3 py-1">
            <Gift className="w-4 h-4 mr-1" />
            1 mês por indicação
          </Badge>
        </div>
      </div>

      {/* Main Share Card */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-primary to-primary-600 p-6 text-white">
          <div className="flex flex-col lg:flex-row lg:items-center gap-6">
            {/* Left side - Code and Link */}
            <div className="flex-1 space-y-4">
              <div>
                <p className="text-primary-100 text-sm font-medium mb-1">Seu código de indicação</p>
                <div className="flex items-center gap-3">
                  {isEditingCode ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={customCodeInput}
                        onChange={(e) => setCustomCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                        placeholder="MEU-CODIGO"
                        maxLength={20}
                        className="bg-white/20 border-white/30 text-white placeholder-primary-200 font-mono text-xl font-bold w-48 focus:bg-white/30"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-white hover:bg-white/20"
                        onClick={handleSaveCustomCode}
                        disabled={customCodeMutation.isPending}
                      >
                        {customCodeMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-white hover:bg-white/20"
                        onClick={() => {
                          setIsEditingCode(false);
                          setCustomCodeInput(code.customCode || '');
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span className="font-mono text-2xl font-bold tracking-wider">
                        {code.customCode || code.code}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-white hover:bg-white/20"
                        onClick={() => setIsEditingCode(true)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <div>
                <p className="text-primary-100 text-sm font-medium mb-2">Seu link de indicação</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-white/10 rounded-lg px-4 py-2.5 font-mono text-sm truncate">
                    {shareUrl}
                  </div>
                  <Button
                    variant="secondary"
                    className="shrink-0"
                    onClick={handleCopyLink}
                  >
                    {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                    {copied ? 'Copiado!' : 'Copiar'}
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-white hover:bg-white/20 shrink-0"
                    onClick={handleShare}
                  >
                    <Share2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Right side - QR Code placeholder */}
            <div className="hidden lg:flex flex-col items-center justify-center bg-white/10 rounded-xl p-6 min-w-[140px]">
              <QrCode className="w-16 h-16 text-white/80 mb-2" />
              <span className="text-xs text-primary-100">QR Code</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Cliques</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalClicks}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-xl">
                <MousePointerClick className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Cadastros</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalSignups}</p>
              </div>
              <div className="p-3 bg-purple-50 rounded-xl">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Assinaturas</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalPaidConversions}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-xl">
                <Trophy className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Dias ganhos</p>
                <p className="text-2xl font-bold text-green-600">+{stats.totalDaysEarned}</p>
              </div>
              <div className="p-3 bg-amber-50 rounded-xl">
                <Gift className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress to Milestone */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
            <div className={cn(
              "p-3 rounded-xl",
              hasReachedMilestone ? "bg-gradient-to-br from-amber-400 to-orange-500" : "bg-amber-50"
            )}>
              <Sparkles className={cn("w-6 h-6", hasReachedMilestone ? "text-white" : "text-amber-600")} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">Bônus de 12 meses</h3>
              <p className="text-sm text-gray-500">
                Indique 10 amigos que assinem e ganhe 12 meses grátis adicionais!
              </p>
            </div>
            {hasReachedMilestone && (
              <Badge variant="success" className="shrink-0">
                <Check className="w-3 h-3 mr-1" />
                Conquistado!
              </Badge>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{progressToMilestone} de 10 indicações</span>
              <span className={cn(
                "font-medium",
                hasReachedMilestone ? "text-green-600" : "text-gray-700"
              )}>
                {hasReachedMilestone ? 'Meta alcançada!' : `Faltam ${10 - progressToMilestone}`}
              </span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  hasReachedMilestone
                    ? "bg-gradient-to-r from-amber-400 to-orange-500"
                    : "bg-primary"
                )}
                style={{ width: `${(progressToMilestone / 10) * 100}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* How it works */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Como funciona</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center font-bold">
                1
              </div>
              <div>
                <p className="font-medium text-gray-900">Compartilhe seu link</p>
                <p className="text-sm text-gray-500 mt-1">
                  Envie para amigos, colegas e nas redes sociais
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center font-bold">
                2
              </div>
              <div>
                <p className="font-medium text-gray-900">Amigo se cadastra</p>
                <p className="text-sm text-gray-500 mt-1">
                  Quando ele criar uma conta pelo seu link
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center font-bold">
                3
              </div>
              <div>
                <p className="font-medium text-gray-900">Vocês ganham!</p>
                <p className="text-sm text-gray-500 mt-1">
                  Ao assinar, você ganha 30 dias grátis
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Two columns: Referrals and Rewards */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Referrals List */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Indicações recentes</CardTitle>
            {referrals.length > 0 && (
              <Badge variant="secondary">{referrals.length}</Badge>
            )}
          </CardHeader>
          <CardContent>
            {referrals.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Users className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-sm text-gray-500">Nenhuma indicação ainda</p>
                <p className="text-xs text-gray-400 mt-1">
                  Compartilhe seu link para começar!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {referrals.slice(0, 5).map((referral) => (
                  <div
                    key={referral.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center">
                        <span className="text-primary font-semibold text-sm">
                          {referral.referee.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">
                          {referral.referee.name}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          {referral.platform === 'IOS' || referral.platform === 'ANDROID' ? (
                            <Smartphone className="w-3 h-3" />
                          ) : (
                            <Monitor className="w-3 h-3" />
                          )}
                          <span>{new Date(referral.createdAt).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </div>
                    </div>
                    <Badge
                      variant={
                        referral.status === 'SUBSCRIPTION_PAID'
                          ? 'success'
                          : referral.status === 'SIGNUP_COMPLETE'
                            ? 'primary'
                            : 'secondary'
                      }
                      className="text-xs"
                    >
                      {getReferralStatusLabel(referral.status)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rewards List */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recompensas</CardTitle>
            {rewards.length > 0 && (
              <Badge variant="success">+{stats.totalDaysEarned} dias</Badge>
            )}
          </CardHeader>
          <CardContent>
            {rewards.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Gift className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-sm text-gray-500">Nenhuma recompensa ainda</p>
                <p className="text-xs text-gray-400 mt-1">
                  Ganhe quando seus amigos assinarem!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {rewards.slice(0, 5).map((reward) => (
                  <div
                    key={reward.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center",
                        reward.reason === 'MILESTONE_10'
                          ? "bg-gradient-to-br from-amber-400 to-orange-500"
                          : reward.reason === 'REVERSAL'
                            ? "bg-red-100"
                            : "bg-green-100"
                      )}>
                        {reward.reason === 'MILESTONE_10' ? (
                          <Sparkles className="w-4 h-4 text-white" />
                        ) : reward.reason === 'REVERSAL' ? (
                          <X className="w-4 h-4 text-red-600" />
                        ) : (
                          <Gift className="w-4 h-4 text-green-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">
                          {getRewardReasonLabel(reward.reason)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(reward.createdAt).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    <span className={cn(
                      "font-semibold text-sm",
                      reward.reason === 'REVERSAL' ? "text-red-600" : "text-green-600"
                    )}>
                      {reward.reason === 'REVERSAL' ? '-' : '+'}{reward.daysAwarded} dias
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Empty state CTA */}
      {referrals.length === 0 && (
        <Card className="bg-gradient-to-br from-primary-50 to-purple-50 border-primary-100">
          <CardContent className="py-8 text-center">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Share2 className="w-8 h-8 text-primary" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">
              Comece a indicar agora!
            </h3>
            <p className="text-gray-500 text-sm mb-4 max-w-md mx-auto">
              Compartilhe seu link com amigos e colegas. Cada amigo que assinar dá a você 30 dias grátis!
            </p>
            <Button onClick={handleShare} leftIcon={<Share2 className="w-4 h-4" />}>
              Compartilhar meu link
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
