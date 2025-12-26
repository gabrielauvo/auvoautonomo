'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslations } from '@/i18n';
import {
  getReferralDashboard,
  setCustomCode,
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
import { AppLayout } from '@/components/layout';
import {
  Gift,
  Users,
  MousePointerClick,
  Trophy,
  Copy,
  Check,
  Smartphone,
  Monitor,
  Edit2,
  X,
  Loader2,
  QrCode,
  MessageCircle,
  Zap,
  Target,
  ArrowRight,
  Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ReferralPage() {
  const { t } = useTranslations('referral');
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
      toast.success(t('codeActivated'));
    },
    onError: (error: Error) => {
      toast.error(error.message || t('errorSettingCode'));
    },
  });

  const handleCopyLink = async () => {
    if (!dashboard?.shareUrl) return;

    try {
      await navigator.clipboard.writeText(dashboard.shareUrl);
      setCopied(true);
      toast.success(t('linkCopied'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('errorLoading'));
    }
  };

  const handleShareWhatsApp = () => {
    if (!dashboard?.shareUrl) return;

    const message = `Opa! 👋
Se você é autônomo e ainda organiza serviço no WhatsApp ou caderno, dá uma olhada nisso.
Uso o Auvo Autônomo e nesse link você ganha benefício pra testar 👇
${dashboard.shareUrl}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
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
      toast.error(t('enterValidCode'));
      return;
    }
    customCodeMutation.mutate(customCodeInput.trim().toUpperCase());
  };

  // Helper functions to get translated labels
  const getReferralStatusLabel = (status: string): string => {
    return t(`status.${status}` as never) || status;
  };

  const getRewardReasonLabel = (reason: string): string => {
    return t(`rewardReason.${reason}` as never) || reason;
  };

  useEffect(() => {
    if (dashboard?.code.customCode) {
      setCustomCodeInput(dashboard.code.customCode);
    }
  }, [dashboard?.code.customCode]);

  if (isLoading) {
    return (
      <AppLayout>
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
      </AppLayout>
    );
  }

  if (error || !dashboard) {
    return (
      <AppLayout>
        <Card>
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Gift className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500">{t('errorLoading')}</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['referral-dashboard'] })}
            >
              {t('tryAgain')}
            </Button>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  const { code, stats, referrals, rewards, shareUrl } = dashboard;
  const progressToMilestone = Math.min(stats.totalPaidConversions, 10);
  const hasReachedMilestone = stats.totalPaidConversions >= 10;
  const remainingToMilestone = 10 - progressToMilestone;

  // Dynamic challenge text based on progress
  const getChallengeText = () => {
    if (hasReachedMilestone) {
      return {
        title: t('challenge.titleCompleted'),
        subtitle: t('challenge.subtitleCompleted'),
        badge: t('challenge.badgeCompleted'),
      };
    }
    if (progressToMilestone === 0) {
      return {
        title: t('challenge.title'),
        subtitle: t('challenge.subtitle'),
        badge: null,
      };
    }
    if (remainingToMilestone <= 3) {
      return {
        title: t('challenge.titleAlmostThere', { remaining: remainingToMilestone }),
        subtitle: t('challenge.subtitleAlmostThere'),
        badge: t('challenge.badgeAlmostThere'),
      };
    }
    return {
      title: t('challenge.title'),
      subtitle: t('challenge.subtitleProgress', { remaining: remainingToMilestone }),
      badge: null,
    };
  };

  const challengeText = getChallengeText();

  return (
    <AppLayout>
      <div className="space-y-6">
      {/* Header with compelling copy */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('title')}
          </h1>
          <p className="text-gray-500 mt-1">
            {t('subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="primary" className="text-sm px-3 py-1.5 animate-pulse">
            <Gift className="w-4 h-4 mr-1.5" />
            {t('perReferralBadge')}
          </Badge>
        </div>
      </div>

      {/* Main Share Card - Improved */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-primary to-primary-600 p-6 text-white">
          <div className="flex flex-col lg:flex-row lg:items-center gap-6">
            {/* Left side - Code and Link */}
            <div className="flex-1 space-y-4">
              <div>
                <p className="text-primary-100 text-sm font-medium mb-1">{t('exclusiveCode')}</p>
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
                        title={t('customizeCode')}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <div>
                <p className="text-primary-100 text-sm font-medium mb-2">{t('shareLink')}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex-1 min-w-0 bg-white/10 rounded-lg px-4 py-2.5 font-mono text-sm truncate">
                    {shareUrl}
                  </div>
                  <Button
                    variant="secondary"
                    className="shrink-0"
                    onClick={handleCopyLink}
                  >
                    {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                    {copied ? t('copied') : t('copyLink')}
                  </Button>
                </div>
              </div>

              {/* WhatsApp Share Button - Primary CTA */}
              <div className="pt-2">
                <Button
                  size="lg"
                  className="w-full sm:w-auto bg-[#25D366] hover:bg-[#20BD5A] text-white shadow-lg hover:shadow-xl transition-all"
                  onClick={handleShareWhatsApp}
                >
                  <MessageCircle className="w-5 h-5 mr-2" />
                  {t('sendWhatsApp')}
                </Button>
                <p className="text-primary-200 text-xs mt-2">
                  {t('whatsappMessageReady')}
                </p>
              </div>
            </div>

            {/* Right side - QR Code placeholder */}
            <div className="hidden lg:flex flex-col items-center justify-center bg-white/10 rounded-xl p-6 min-w-[140px]">
              <QrCode className="w-16 h-16 text-white/80 mb-2" />
              <span className="text-xs text-primary-100">{t('qrCode')}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Stats Grid with microcopy */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="group hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">{t('stats.clicks')}</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalClicks}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {stats.totalClicks === 0 ? t('stats.clicksEmpty') : t('stats.clicksLabel')}
                </p>
              </div>
              <div className="p-3 bg-blue-50 rounded-xl group-hover:scale-110 transition-transform">
                <MousePointerClick className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">{t('stats.signups')}</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalSignups}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {stats.totalSignups === 0 ? t('stats.signupsEmpty') : t('stats.signupsLabel')}
                </p>
              </div>
              <div className="p-3 bg-purple-50 rounded-xl group-hover:scale-110 transition-transform">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">{t('stats.subscriptions')}</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalPaidConversions}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {stats.totalPaidConversions === 0 ? t('stats.subscriptionsEmpty') : t('stats.subscriptionsLabel')}
                </p>
              </div>
              <div className="p-3 bg-green-50 rounded-xl group-hover:scale-110 transition-transform">
                <Trophy className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-md transition-shadow bg-gradient-to-br from-green-50 to-emerald-50 border-green-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700 mb-1">{t('stats.earned')}</p>
                <p className="text-2xl font-bold text-green-600">+{stats.totalDaysEarned} {t('stats.days')}</p>
                <p className="text-xs text-green-600/70 mt-1">
                  {stats.totalDaysEarned === 0 ? t('stats.earnedEmpty') : t('stats.earnedLabel')}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-xl group-hover:scale-110 transition-transform">
                <Gift className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Challenge Block - Gamified Milestone */}
      <Card className={cn(
        "overflow-hidden transition-all",
        hasReachedMilestone && "ring-2 ring-amber-400 ring-offset-2"
      )}>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
            <div className={cn(
              "p-4 rounded-xl transition-all",
              hasReachedMilestone
                ? "bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-200"
                : progressToMilestone > 0
                  ? "bg-gradient-to-br from-amber-100 to-orange-100"
                  : "bg-amber-50"
            )}>
              {hasReachedMilestone ? (
                <Trophy className="w-8 h-8 text-white" />
              ) : (
                <Target className="w-8 h-8 text-amber-600" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-lg text-gray-900">{challengeText.title}</h3>
                {challengeText.badge && (
                  <Badge
                    variant={hasReachedMilestone ? "success" : "warning"}
                    className="animate-pulse"
                  >
                    {hasReachedMilestone && <Check className="w-3 h-3 mr-1" />}
                    {challengeText.badge}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {challengeText.subtitle}
              </p>
            </div>
            {!hasReachedMilestone && progressToMilestone > 0 && (
              <div className="text-right">
                <span className="text-3xl font-bold text-amber-600">{progressToMilestone}</span>
                <span className="text-gray-400">/10</span>
              </div>
            )}
          </div>

          {/* Improved Progress Bar */}
          <div className="space-y-2">
            <div className="h-4 bg-gray-100 rounded-full overflow-hidden relative">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-700 ease-out relative",
                  hasReachedMilestone
                    ? "bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400 animate-shimmer"
                    : progressToMilestone > 0
                      ? "bg-gradient-to-r from-amber-400 to-orange-500"
                      : "bg-gray-200"
                )}
                style={{ width: `${Math.max((progressToMilestone / 10) * 100, 2)}%` }}
              >
                {progressToMilestone > 0 && !hasReachedMilestone && (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md" />
                )}
              </div>
              {/* Progress markers */}
              <div className="absolute inset-0 flex justify-between px-1">
                {[...Array(10)].map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-0.5 h-full",
                      i < progressToMilestone ? "bg-white/30" : "bg-gray-200"
                    )}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">
                {progressToMilestone === 1
                  ? t('challenge.progressLabel', { count: progressToMilestone })
                  : t('challenge.progressLabelPlural', { count: progressToMilestone })
                }
              </span>
              <span className={cn(
                "font-medium",
                hasReachedMilestone ? "text-green-600" : "text-amber-600"
              )}>
                {hasReachedMilestone ? t('challenge.goalCompleted') : t('challenge.goalLabel')}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* How it works - Improved copy */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            {t('howItWorks.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="flex items-start gap-4 group">
              <div className="flex-shrink-0 w-12 h-12 bg-primary text-white rounded-xl flex items-center justify-center font-bold text-lg group-hover:scale-110 transition-transform">
                1
              </div>
              <div>
                <p className="font-semibold text-gray-900">{t('howItWorks.step1Title')}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {t('howItWorks.step1Description')}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4 group">
              <div className="flex-shrink-0 w-12 h-12 bg-primary text-white rounded-xl flex items-center justify-center font-bold text-lg group-hover:scale-110 transition-transform">
                2
              </div>
              <div>
                <p className="font-semibold text-gray-900">{t('howItWorks.step2Title')}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {t('howItWorks.step2Description')}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4 group">
              <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-xl flex items-center justify-center font-bold text-lg group-hover:scale-110 transition-transform">
                <Gift className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">{t('howItWorks.step3Title')}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {t('howItWorks.step3Description')}
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
            <CardTitle className="text-base">{t('referralsList.title')}</CardTitle>
            {referrals.length > 0 && (
              <Badge variant="secondary">{referrals.length}</Badge>
            )}
          </CardHeader>
          <CardContent>
            {referrals.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-50 to-purple-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-7 h-7 text-blue-400" />
                </div>
                <p className="font-medium text-gray-700">{t('referralsList.empty')}</p>
                <p className="text-sm text-gray-500 mt-1 max-w-[200px] mx-auto">
                  {t('referralsList.emptyDescription')}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={handleShareWhatsApp}
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  {t('referralsList.referNow')}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {referrals.slice(0, 5).map((referral) => (
                  <div
                    key={referral.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                        <span className="text-primary font-semibold">
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
                      {referral.status === 'SUBSCRIPTION_PAID' && <Check className="w-3 h-3 mr-1" />}
                      {getReferralStatusLabel(referral.status)}
                    </Badge>
                  </div>
                ))}
                {referrals.length > 5 && (
                  <p className="text-center text-sm text-gray-500 pt-2">
                    {t('referralsList.moreReferrals', { count: referrals.length - 5 })}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rewards List */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{t('rewardsList.title')}</CardTitle>
            {rewards.length > 0 && (
              <Badge variant="success" className="animate-pulse">
                <Gift className="w-3 h-3 mr-1" />
                +{stats.totalDaysEarned} {t('rewardsList.daysLabel')}
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            {rewards.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-14 h-14 bg-gradient-to-br from-green-50 to-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Gift className="w-7 h-7 text-green-400" />
                </div>
                <p className="font-medium text-gray-700">{t('rewardsList.empty')}</p>
                <p className="text-sm text-gray-500 mt-1 max-w-[220px] mx-auto">
                  {t('rewardsList.emptyDescription')}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {rewards.slice(0, 5).map((reward) => (
                  <div
                    key={reward.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center",
                        reward.reason === 'MILESTONE_10'
                          ? "bg-gradient-to-br from-amber-400 to-orange-500 shadow-md"
                          : reward.reason === 'REVERSAL'
                            ? "bg-red-100"
                            : "bg-green-100"
                      )}>
                        {reward.reason === 'MILESTONE_10' ? (
                          <Trophy className="w-5 h-5 text-white" />
                        ) : reward.reason === 'REVERSAL' ? (
                          <X className="w-5 h-5 text-red-600" />
                        ) : (
                          <Gift className="w-5 h-5 text-green-600" />
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
                      "font-bold text-sm px-2 py-1 rounded-md",
                      reward.reason === 'REVERSAL'
                        ? "text-red-600 bg-red-50"
                        : "text-green-600 bg-green-50"
                    )}>
                      {reward.reason === 'REVERSAL' ? '-' : '+'}{reward.daysAwarded} {t('rewardsList.daysLabel')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Empty state CTA - More compelling */}
      {referrals.length === 0 && (
        <Card className="bg-gradient-to-br from-primary-50 via-purple-50 to-blue-50 border-primary-100 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary/5 to-purple-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardContent className="py-10 text-center relative">
            <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-primary/10">
              <Gift className="w-10 h-10 text-primary" />
            </div>
            <h3 className="font-bold text-xl text-gray-900 mb-2">
              {t('emptyState.title')}
            </h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              {t('emptyState.description')}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                size="lg"
                className="bg-[#25D366] hover:bg-[#20BD5A] text-white shadow-lg"
                onClick={handleShareWhatsApp}
              >
                <MessageCircle className="w-5 h-5 mr-2" />
                {t('sendWhatsApp')}
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={handleCopyLink}
              >
                <Copy className="w-4 h-4 mr-2" />
                {t('copyLink')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tip section for users with some referrals */}
      {referrals.length > 0 && referrals.length < 5 && (
        <Card className="bg-blue-50 border-blue-100">
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-blue-100 rounded-lg shrink-0">
                <Star className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-blue-900">{t('tip.title')}</p>
                <p className="text-sm text-blue-700">
                  {t('tip.description')}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-blue-600 hover:text-blue-700 hover:bg-blue-100 shrink-0"
                onClick={handleShareWhatsApp}
              >
                {t('tip.action')}
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      </div>
    </AppLayout>
  );
}
