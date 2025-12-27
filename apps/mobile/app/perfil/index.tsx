/**
 * Profile Screen
 *
 * Tela principal de perfil com menu de opções
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Text, Card, Avatar, Badge, Button } from '../../src/design-system';
import { useColors, useSpacing } from '../../src/design-system/ThemeProvider';
import { useAuth } from '../../src/services';
import { useTranslation } from '../../src/i18n';
import { AuthService } from '../../src/services/AuthService';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// =============================================================================
// TYPES
// =============================================================================

interface ProfileData {
  id: string;
  name: string;
  email: string;
  phone: string;
  language: string;
  timezone: string;
  avatarUrl: string | null;
}

interface SubscriptionData {
  plan: {
    type: string;
    name: string;
    price: number;
  };
  status: string;
  currentPeriodEnd: string | null;
}

interface MenuItem {
  id: string;
  icon: IconName;
  label: string;
  description: string;
  route?: string;
  onPress?: () => void;
  badge?: string;
  badgeVariant?: 'primary' | 'success' | 'warning' | 'error';
  showChevron?: boolean;
}

// =============================================================================
// PROFILE SCREEN
// =============================================================================

export default function ProfileScreen() {
  const colors = useColors();
  const spacing = useSpacing();
  const { user, logout, updateUser } = useAuth();
  const { t } = useTranslation();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Load profile and subscription data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const token = await AuthService.getAccessToken();
      if (!token) return;

      // Load profile
      const profileRes = await fetch(`${API_URL}/settings/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setProfile(profileData);
      }

      // Load subscription
      const subRes = await fetch(`${API_URL}/billing/subscription`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (subRes.ok) {
        const subData = await subRes.json();
        setSubscription(subData);
      }
    } catch (error) {
      console.error('[Profile] Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePickAvatar = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(t('profile.permissionRequired'), t('profile.galleryPermissionMessage'));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadAvatar(result.assets[0].uri);
      }
    } catch (error) {
      console.error('[Profile] Error picking image:', error);
      Alert.alert(t('common.error'), t('profile.imageSelectError'));
    }
  };

  const uploadAvatar = async (uri: string) => {
    setIsUploadingAvatar(true);
    try {
      const token = await AuthService.getAccessToken();
      if (!token) return;

      const formData = new FormData();
      formData.append('avatar', {
        uri,
        type: 'image/jpeg',
        name: 'avatar.jpg',
      } as any);

      const response = await fetch(`${API_URL}/settings/profile/avatar`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setProfile((prev) => prev ? { ...prev, avatarUrl: data.avatarUrl } : null);

        // Atualizar o contexto de autenticação para propagar para outras telas
        await updateUser({ avatarUrl: data.avatarUrl });

        Alert.alert(t('common.success'), t('profile.avatarUpdated'));
      } else {
        const error = await response.json();
        Alert.alert(t('common.error'), error.message || t('profile.avatarUpdateError'));
      }
    } catch (error) {
      console.error('[Profile] Error uploading avatar:', error);
      Alert.alert(t('common.error'), t('profile.avatarUploadError'));
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t('profile.deleteAccount'),
      t('profile.deleteAccountConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AuthService.getAccessToken();
              if (!token) return;

              const response = await fetch(`${API_URL}/settings/profile`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              });

              if (response.ok) {
                await logout();
                Alert.alert(t('profile.accountDeleted'), t('profile.accountDeletedMessage'));
              } else {
                Alert.alert(t('common.error'), t('profile.deleteAccountError'));
              }
            } catch (error) {
              Alert.alert(t('common.error'), t('profile.deleteAccountError'));
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      t('profile.logout'),
      t('profile.logoutConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.logout'),
          style: 'destructive',
          onPress: () => logout(),
        },
      ]
    );
  };

  const menuItems: MenuItem[] = [
    {
      id: 'dados-pessoais',
      icon: 'person-outline',
      label: t('profile.menu.personalData'),
      description: t('profile.menu.personalDataDesc'),
      route: '/perfil/dados-pessoais',
      showChevron: true,
    },
    {
      id: 'alterar-senha',
      icon: 'lock-closed-outline',
      label: t('profile.menu.changePassword'),
      description: t('profile.menu.changePasswordDesc'),
      route: '/perfil/alterar-senha',
      showChevron: true,
    },
    {
      id: 'empresa',
      icon: 'business-outline',
      label: t('profile.menu.companyData'),
      description: t('profile.menu.companyDataDesc'),
      route: '/perfil/empresa',
      showChevron: true,
    },
    {
      id: 'plano',
      icon: 'star-outline',
      label: t('profile.menu.myPlan'),
      description: subscription?.plan?.name || t('common.loading'),
      route: '/perfil/plano',
      badge: subscription?.plan?.type === 'PRO' ? 'PRO' : 'FREE',
      badgeVariant: subscription?.plan?.type === 'PRO' ? 'primary' : 'warning',
      showChevron: true,
    },
    {
      id: 'indicacoes',
      icon: 'gift-outline',
      label: t('profile.menu.referral'),
      description: t('profile.menu.referralDesc'),
      route: '/perfil/indicacoes',
      badge: 'NOVO',
      badgeVariant: 'success',
      showChevron: true,
    },
    {
      id: 'preferencias',
      icon: 'settings-outline',
      label: t('profile.menu.preferences'),
      description: t('profile.menu.preferencesDesc'),
      route: '/perfil/preferencias',
      showChevron: true,
    },
    {
      id: 'idioma',
      icon: 'language-outline',
      label: t('profile.menu.language'),
      description: profile?.language || t('profile.menu.language'),
      route: '/perfil/idioma',
      showChevron: true,
    },
    {
      id: 'regional',
      icon: 'globe-outline',
      label: t('profile.menu.regionalSettings'),
      description: t('profile.menu.regionalSettingsDesc'),
      route: '/perfil/regional',
      showChevron: true,
    },
  ];

  const getPlanBadgeColor = () => {
    if (subscription?.plan?.type === 'PRO') {
      return colors.primary[500];
    }
    return colors.warning[500];
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background.secondary }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
          <Text variant="body" color="secondary" style={{ marginTop: spacing[3] }}>
            {t('common.loading')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.secondary }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background.primary }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text variant="h4" weight="semibold">
          {t('profile.title')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: spacing[6] }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <Card style={[styles.profileCard, { marginHorizontal: spacing[4], marginTop: spacing[4] }]}>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={handlePickAvatar}
            disabled={isUploadingAvatar}
          >
            {isUploadingAvatar ? (
              <View style={[styles.avatarPlaceholder, { backgroundColor: colors.gray[100] }]}>
                <ActivityIndicator size="small" color={colors.primary[500]} />
              </View>
            ) : profile?.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImage} />
            ) : (
              <Avatar name={profile?.name || user?.name} size="xl" />
            )}
            <View style={[styles.editBadge, { backgroundColor: colors.primary[500] }]}>
              <Ionicons name="camera" size={14} color="#FFF" />
            </View>
          </TouchableOpacity>

          <View style={styles.profileInfo}>
            <Text variant="h4" weight="bold" style={{ marginBottom: spacing[1] }}>
              {profile?.name || user?.name || t('profile.user')}
            </Text>
            <Text variant="body" color="secondary">
              {profile?.email || user?.email}
            </Text>
            {subscription?.plan && (
              <View style={[styles.planBadge, { backgroundColor: getPlanBadgeColor() + '20', marginTop: spacing[2] }]}>
                <Ionicons
                  name={subscription.plan.type === 'PRO' ? 'star' : 'star-outline'}
                  size={14}
                  color={getPlanBadgeColor()}
                />
                <Text
                  variant="caption"
                  weight="semibold"
                  style={{ color: getPlanBadgeColor(), marginLeft: 4 }}
                >
                  {t('profile.plan')} {subscription.plan.name}
                </Text>
              </View>
            )}
          </View>
        </Card>

        {/* Menu Items */}
        <View style={{ marginTop: spacing[4], paddingHorizontal: spacing[4] }}>
          <Text variant="caption" weight="semibold" color="tertiary" style={{ marginBottom: spacing[2], marginLeft: spacing[2] }}>
            {t('profile.settings')}
          </Text>
          <Card style={styles.menuCard}>
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.menuItem,
                  index < menuItems.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border.light },
                ]}
                onPress={() => {
                  if (item.route) {
                    router.push(item.route as any);
                  } else if (item.onPress) {
                    item.onPress();
                  }
                }}
              >
                <View style={[styles.menuIconContainer, { backgroundColor: colors.primary[50] }]}>
                  <Ionicons name={item.icon} size={20} color={colors.primary[500]} />
                </View>
                <View style={styles.menuContent}>
                  <View style={styles.menuTextContainer}>
                    <Text variant="body" weight="medium">
                      {item.label}
                    </Text>
                    <Text variant="caption" color="secondary" numberOfLines={1}>
                      {item.description}
                    </Text>
                  </View>
                  <View style={styles.menuRight}>
                    {item.badge && (
                      <Badge variant={item.badgeVariant || 'primary'} size="sm">
                        {item.badge}
                      </Badge>
                    )}
                    {item.showChevron && (
                      <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </Card>
        </View>

        {/* Danger Zone */}
        <View style={{ marginTop: spacing[6], paddingHorizontal: spacing[4] }}>
          <Text variant="caption" weight="semibold" color="tertiary" style={{ marginBottom: spacing[2], marginLeft: spacing[2] }}>
            {t('profile.dangerZone')}
          </Text>
          <Card style={styles.menuCard}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleLogout}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: colors.warning[50] }]}>
                <Ionicons name="log-out-outline" size={20} color={colors.warning[500]} />
              </View>
              <View style={styles.menuContent}>
                <View style={styles.menuTextContainer}>
                  <Text variant="body" weight="medium" style={{ color: colors.warning[600] }}>
                    {t('profile.logoutAccount')}
                  </Text>
                  <Text variant="caption" color="secondary">
                    {t('profile.disconnectApp')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuItem, { borderTopWidth: 1, borderTopColor: colors.border.light }]}
              onPress={handleDeleteAccount}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: colors.error[50] }]}>
                <Ionicons name="trash-outline" size={20} color={colors.error[500]} />
              </View>
              <View style={styles.menuContent}>
                <View style={styles.menuTextContainer}>
                  <Text variant="body" weight="medium" style={{ color: colors.error[600] }}>
                    {t('profile.deleteAccount')}
                  </Text>
                  <Text variant="caption" color="secondary">
                    {t('profile.permanentlyDeleteData')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
              </View>
            </TouchableOpacity>
          </Card>
        </View>

        {/* Version */}
        <Text variant="caption" color="tertiary" align="center" style={{ marginTop: spacing[6] }}>
          Auvo Mobile v1.0.0
        </Text>
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
  profileCard: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
  },
  profileInfo: {
    alignItems: 'center',
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  menuCard: {
    padding: 0,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuTextContainer: {
    flex: 1,
  },
  menuRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
