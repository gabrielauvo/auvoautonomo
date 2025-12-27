/**
 * Referral Screen
 *
 * Tela do programa de indicações - compartilhar código e ver indicações
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Text, Card, Badge } from '../../src/design-system';
import { useColors, useSpacing } from '../../src/design-system/ThemeProvider';
import { AuthService } from '../../src/services/AuthService';
import { useTranslation, useLocale } from '../../src/i18n';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL || 'https://auvo.com';

// =============================================================================
// TYPES
// =============================================================================

interface ReferralCode {
  id: string;
  code: string;
  customCode: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  totalClicks: number;
  totalSignups: number;
  totalPaidConversions: number;
}

interface Referral {
  id: string;
  status: 'PENDING' | 'SIGNUP_COMPLETE' | 'SUBSCRIPTION_PAID' | 'CHURNED' | 'FRAUDULENT';
  attributionMethod: string;
  platform: 'IOS' | 'ANDROID' | 'WEB' | 'UNKNOWN';
  referee: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  convertedAt: string | null;
}

interface ReferralReward {
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
}

interface ReferralDashboard {
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

// =============================================================================
// HELPERS
// =============================================================================

const getPlatformIcon = (platform: Referral['platform']): string => {
  const icons: Record<Referral['platform'], string> = {
    IOS: 'logo-apple',
    ANDROID: 'logo-android',
    WEB: 'desktop-outline',
    UNKNOWN: 'help-circle-outline',
  };
  return icons[platform] || 'help-circle-outline';
};

// =============================================================================
// REFERRAL SCREEN
// =============================================================================

export default function ReferralScreen() {
  const colors = useColors();
  const spacing = useSpacing();
  const { t } = useTranslation();
  const { locale } = useLocale();

  const [dashboard, setDashboard] = useState<ReferralDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Status labels using translations
  const getStatusLabel = useCallback((status: Referral['status']): string => {
    const labels: Record<Referral['status'], string> = {
      PENDING: t('referral.statusPending'),
      SIGNUP_COMPLETE: t('referral.statusSignupComplete'),
      SUBSCRIPTION_PAID: t('referral.statusSubscriptionPaid'),
      CHURNED: t('referral.statusChurned'),
      FRAUDULENT: t('referral.statusFraudulent'),
    };
    return labels[status] || status;
  }, [t]);

  // Reward reason labels using translations
  const getRewardReasonLabel = useCallback((reason: ReferralReward['reason']): string => {
    const labels: Record<ReferralReward['reason'], string> = {
      SINGLE_REFERRAL: t('referral.reasonSingleReferral'),
      MILESTONE_10: t('referral.reasonMilestone10'),
      BONUS: t('referral.reasonBonus'),
      REVERSAL: t('referral.reasonReversal'),
    };
    return labels[reason] || reason;
  }, [t]);

  const loadData = useCallback(async () => {
    try {
      const token = await AuthService.getAccessToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/referral/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setDashboard(data);
      }
    } catch (error) {
      console.error('[Referral] Error loading data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadData();
  }, [loadData]);

  const handleCopyCode = async () => {
    if (!dashboard) return;

    const code = dashboard.code.customCode || dashboard.code.code;
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyLink = async () => {
    if (!dashboard?.shareUrl) return;

    await Clipboard.setStringAsync(dashboard.shareUrl);
    Alert.alert(t('common.success'), t('referral.linkCopied'));
  };

  const handleShare = async () => {
    if (!dashboard?.shareUrl) return;

    try {
      const message = t('referral.shareMessage').replace('{url}', dashboard.shareUrl);
      await Share.share({
        message,
        url: dashboard.shareUrl,
        title: t('referral.shareTitle'),
      });
    } catch (error) {
      console.error('[Referral] Error sharing:', error);
    }
  };

  const handleShareWhatsApp = async () => {
    if (!dashboard?.shareUrl) return;

    const whatsappText = t('referral.whatsappMessage').replace('{url}', dashboard.shareUrl);
    const message = encodeURIComponent(whatsappText);

    // Try to open WhatsApp
    const whatsappUrl = `whatsapp://send?text=${message}`;

    try {
      const { Linking } = await import('react-native');
      const canOpen = await Linking.canOpenURL(whatsappUrl);
      if (canOpen) {
        await Linking.openURL(whatsappUrl);
      } else {
        handleShare();
      }
    } catch {
      handleShare();
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background.secondary }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
          <Text variant="body" color="secondary" style={{ marginTop: spacing[3] }}>
            {t('referral.loading')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!dashboard) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background.secondary }]}>
        <View style={[styles.header, { backgroundColor: colors.background.primary }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text variant="h4" weight="semibold">
            {t('referral.title')}
          </Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <Text variant="body" color="secondary">
            {t('referral.errorLoading')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const { code, stats, referrals, rewards, shareUrl } = dashboard;
  const progressToMilestone = Math.min(stats.totalPaidConversions, 10);
  const hasReachedMilestone = stats.totalPaidConversions >= 10;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.secondary }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background.primary }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text variant="h4" weight="semibold">
          {t('referral.title')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: spacing[6] }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary[500]}
          />
        }
      >
        {/* Share Card */}
        <View style={[styles.shareCard, { backgroundColor: colors.primary[600], margin: spacing[4] }]}>
          <View style={styles.shareCardHeader}>
            <View>
              <Text variant="h5" weight="bold" style={{ color: '#FFF' }}>
                {t('referral.yourCode')}
              </Text>
              <Text variant="caption" style={{ color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
                {t('referral.shareAndEarn')}
              </Text>
            </View>
            <View style={[styles.giftIcon, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Ionicons name="gift" size={24} color="#FFF" />
            </View>
          </View>

          {/* Code Display */}
          <TouchableOpacity
            style={[styles.codeContainer, { backgroundColor: 'rgba(255,255,255,0.15)' }]}
            onPress={handleCopyCode}
          >
            <Text variant="h4" weight="bold" style={{ color: '#FFF', letterSpacing: 2 }}>
              {code.customCode || code.code}
            </Text>
            <Ionicons
              name={copied ? 'checkmark' : 'copy-outline'}
              size={20}
              color="#FFF"
              style={{ marginLeft: 8 }}
            />
          </TouchableOpacity>

          {/* Share Buttons */}
          <View style={styles.shareButtons}>
            <TouchableOpacity
              style={[styles.shareButton, { backgroundColor: '#25D366' }]}
              onPress={handleShareWhatsApp}
            >
              <Ionicons name="logo-whatsapp" size={20} color="#FFF" />
              <Text variant="caption" weight="semibold" style={{ color: '#FFF', marginLeft: 6 }}>
                {t('referral.whatsApp')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.shareButton, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
              onPress={handleCopyLink}
            >
              <Ionicons name="link-outline" size={20} color="#FFF" />
              <Text variant="caption" weight="semibold" style={{ color: '#FFF', marginLeft: 6 }}>
                {t('referral.copyLink')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.shareButton, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
              onPress={handleShare}
            >
              <Ionicons name="share-outline" size={20} color="#FFF" />
              <Text variant="caption" weight="semibold" style={{ color: '#FFF', marginLeft: 6 }}>
                {t('referral.more')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={[styles.statsGrid, { paddingHorizontal: spacing[4] }]}>
          <Card style={[styles.statCard, { flex: 1, marginRight: spacing[2] }]}>
            <Ionicons name="finger-print-outline" size={24} color={colors.primary[500]} />
            <Text variant="h4" weight="bold" style={{ marginTop: spacing[2] }}>
              {stats.totalClicks}
            </Text>
            <Text variant="caption" color="secondary">
              {t('referral.clicks')}
            </Text>
          </Card>

          <Card style={[styles.statCard, { flex: 1, marginLeft: spacing[2] }]}>
            <Ionicons name="people-outline" size={24} color={colors.primary[500]} />
            <Text variant="h4" weight="bold" style={{ marginTop: spacing[2] }}>
              {stats.totalSignups}
            </Text>
            <Text variant="caption" color="secondary">
              {t('referral.signups')}
            </Text>
          </Card>
        </View>

        <View style={[styles.statsGrid, { paddingHorizontal: spacing[4], marginTop: spacing[3] }]}>
          <Card style={[styles.statCard, { flex: 1, marginRight: spacing[2] }]}>
            <Ionicons name="trophy-outline" size={24} color={colors.success[500]} />
            <Text variant="h4" weight="bold" style={{ marginTop: spacing[2] }}>
              {stats.totalPaidConversions}
            </Text>
            <Text variant="caption" color="secondary">
              {t('referral.subscribers')}
            </Text>
          </Card>

          <Card style={[styles.statCard, { flex: 1, marginLeft: spacing[2] }]}>
            <Ionicons name="gift-outline" size={24} color={colors.warning[500]} />
            <Text variant="h4" weight="bold" style={{ marginTop: spacing[2] }}>
              {stats.totalDaysEarned}
            </Text>
            <Text variant="caption" color="secondary">
              {t('referral.daysEarned')}
            </Text>
          </Card>
        </View>

        {/* Milestone Progress */}
        <Card style={[styles.milestoneCard, { marginHorizontal: spacing[4], marginTop: spacing[4] }]}>
          <View style={styles.milestoneHeader}>
            <View style={[styles.milestoneIcon, { backgroundColor: colors.warning[100] }]}>
              <Ionicons name="sparkles" size={20} color={colors.warning[600]} />
            </View>
            <View style={{ flex: 1, marginLeft: spacing[3] }}>
              <Text variant="body" weight="semibold">
                {t('referral.milestone12Months')}
              </Text>
              <Text variant="caption" color="secondary">
                {t('referral.milestoneDescription')}
              </Text>
            </View>
          </View>

          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { backgroundColor: colors.gray[100] }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${(progressToMilestone / 10) * 100}%`,
                    backgroundColor: hasReachedMilestone
                      ? colors.warning[500]
                      : colors.primary[500],
                  },
                ]}
              />
            </View>
            <Text variant="caption" color="secondary" style={{ marginTop: spacing[2] }}>
              {t('referral.referralsProgress').replace('{current}', String(progressToMilestone))}
              {hasReachedMilestone
                ? ` - ${t('referral.milestoneAchieved')} 🎉`
                : ` - ${t('referral.remaining').replace('{count}', String(10 - progressToMilestone))}`}
            </Text>
          </View>
        </Card>

        {/* How it works */}
        <View style={{ marginTop: spacing[4], paddingHorizontal: spacing[4] }}>
          <Text variant="body" weight="semibold" style={{ marginBottom: spacing[3] }}>
            {t('referral.howItWorks')}
          </Text>

          <Card style={styles.howItWorksCard}>
            <View style={styles.howItWorksItem}>
              <View style={[styles.stepNumber, { backgroundColor: colors.primary[500] }]}>
                <Text variant="caption" weight="bold" style={{ color: '#FFF' }}>
                  1
                </Text>
              </View>
              <View style={{ flex: 1, marginLeft: spacing[3] }}>
                <Text variant="body" weight="medium">
                  {t('referral.step1Title')}
                </Text>
                <Text variant="caption" color="secondary">
                  {t('referral.step1Description')}
                </Text>
              </View>
            </View>

            <View style={[styles.howItWorksItem, { marginTop: spacing[3] }]}>
              <View style={[styles.stepNumber, { backgroundColor: colors.primary[500] }]}>
                <Text variant="caption" weight="bold" style={{ color: '#FFF' }}>
                  2
                </Text>
              </View>
              <View style={{ flex: 1, marginLeft: spacing[3] }}>
                <Text variant="body" weight="medium">
                  {t('referral.step2Title')}
                </Text>
                <Text variant="caption" color="secondary">
                  {t('referral.step2Description')}
                </Text>
              </View>
            </View>

            <View style={[styles.howItWorksItem, { marginTop: spacing[3] }]}>
              <View style={[styles.stepNumber, { backgroundColor: colors.primary[500] }]}>
                <Text variant="caption" weight="bold" style={{ color: '#FFF' }}>
                  3
                </Text>
              </View>
              <View style={{ flex: 1, marginLeft: spacing[3] }}>
                <Text variant="body" weight="medium">
                  {t('referral.step3Title')}
                </Text>
                <Text variant="caption" color="secondary">
                  {t('referral.step3Description')}
                </Text>
              </View>
            </View>
          </Card>
        </View>

        {/* Referrals List */}
        {referrals.length > 0 && (
          <View style={{ marginTop: spacing[4], paddingHorizontal: spacing[4] }}>
            <Text variant="body" weight="semibold" style={{ marginBottom: spacing[3] }}>
              {t('referral.yourReferrals')}
            </Text>

            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {referrals.map((referral, index) => (
                <View
                  key={referral.id}
                  style={[
                    styles.referralItem,
                    index < referrals.length - 1 && {
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border.light,
                    },
                  ]}
                >
                  <View style={[styles.referralAvatar, { backgroundColor: colors.primary[100] }]}>
                    <Text variant="body" weight="bold" style={{ color: colors.primary[600] }}>
                      {referral.referee.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: spacing[3] }}>
                    <Text variant="body" weight="medium">
                      {referral.referee.name}
                    </Text>
                    <View style={styles.referralMeta}>
                      <Ionicons
                        name={getPlatformIcon(referral.platform) as any}
                        size={12}
                        color={colors.text.tertiary}
                      />
                      <Text variant="caption" color="tertiary" style={{ marginLeft: 4 }}>
                        {new Date(referral.createdAt).toLocaleDateString(locale)}
                      </Text>
                    </View>
                  </View>
                  <Badge
                    variant={
                      referral.status === 'SUBSCRIPTION_PAID'
                        ? 'success'
                        : referral.status === 'PENDING'
                          ? 'warning'
                          : 'primary'
                    }
                    size="sm"
                  >
                    {getStatusLabel(referral.status)}
                  </Badge>
                </View>
              ))}
            </Card>
          </View>
        )}

        {/* Rewards List */}
        {rewards.length > 0 && (
          <View style={{ marginTop: spacing[4], paddingHorizontal: spacing[4] }}>
            <Text variant="body" weight="semibold" style={{ marginBottom: spacing[3] }}>
              {t('referral.rewardsHistory')}
            </Text>

            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {rewards.map((reward, index) => (
                <View
                  key={reward.id}
                  style={[
                    styles.rewardItem,
                    index < rewards.length - 1 && {
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border.light,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.rewardIcon,
                      {
                        backgroundColor:
                          reward.reason === 'MILESTONE_10'
                            ? colors.warning[100]
                            : reward.reason === 'REVERSAL'
                              ? colors.error[100]
                              : colors.success[100],
                      },
                    ]}
                  >
                    <Ionicons
                      name={
                        reward.reason === 'MILESTONE_10'
                          ? 'sparkles'
                          : reward.reason === 'REVERSAL'
                            ? 'close'
                            : 'gift'
                      }
                      size={16}
                      color={
                        reward.reason === 'MILESTONE_10'
                          ? colors.warning[600]
                          : reward.reason === 'REVERSAL'
                            ? colors.error[600]
                            : colors.success[600]
                      }
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: spacing[3] }}>
                    <Text variant="body" weight="medium">
                      {getRewardReasonLabel(reward.reason)}
                    </Text>
                    <Text variant="caption" color="secondary">
                      {new Date(reward.createdAt).toLocaleDateString(locale)}
                    </Text>
                  </View>
                  <Text
                    variant="body"
                    weight="bold"
                    style={{
                      color:
                        reward.reason === 'REVERSAL' ? colors.error[500] : colors.success[500],
                    }}
                  >
                    {reward.reason === 'REVERSAL' ? '-' : '+'}
                    {reward.daysAwarded} {t('referral.days')}
                  </Text>
                </View>
              ))}
            </Card>
          </View>
        )}

        {/* Empty state */}
        {referrals.length === 0 && (
          <View style={[styles.emptyState, { marginHorizontal: spacing[4], marginTop: spacing[4] }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.primary[100] }]}>
              <Ionicons name="people-outline" size={32} color={colors.primary[500]} />
            </View>
            <Text variant="body" weight="semibold" style={{ marginTop: spacing[3] }}>
              {t('referral.noReferralsYet')}
            </Text>
            <Text variant="caption" color="secondary" align="center" style={{ marginTop: spacing[1] }}>
              {t('referral.noReferralsDescription')}
            </Text>
            <TouchableOpacity
              style={[styles.emptyButton, { backgroundColor: colors.primary[500], marginTop: spacing[4] }]}
              onPress={handleShare}
            >
              <Ionicons name="share-outline" size={18} color="#FFF" />
              <Text variant="body" weight="semibold" style={{ color: '#FFF', marginLeft: 8 }}>
                {t('referral.shareNow')}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  shareCard: {
    borderRadius: 16,
    padding: 20,
  },
  shareCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  giftIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 16,
  },
  shareButtons: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 8,
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  statsGrid: {
    flexDirection: 'row',
  },
  statCard: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  milestoneCard: {
    padding: 16,
  },
  milestoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  milestoneIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    marginTop: 16,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  howItWorksCard: {
    padding: 16,
  },
  howItWorksItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  referralItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  referralAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  referralMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  rewardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  rewardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    padding: 24,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
});
