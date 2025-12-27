/**
 * DrawerMenu Component
 *
 * Menu lateral com navegação principal do app.
 * Design moderno e intuitivo.
 */

import React, { useCallback, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Modal,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Avatar, Badge, Divider } from '../design-system';
import { useColors } from '../design-system/ThemeProvider';
import { useAuth } from '../services';
import { spacing, borderRadius } from '../design-system/tokens';
import { useTranslation } from '../i18n';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = SCREEN_WIDTH * 0.82;

// =============================================================================
// TYPES
// =============================================================================

interface MenuItem {
  id: string;
  icon: IconName;
  activeIcon: IconName;
  labelKey: string;
  route: string;
  badge?: number;
}

interface MenuSection {
  titleKey?: string;
  items: MenuItem[];
}

interface DrawerMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

// =============================================================================
// MENU CONFIGURATION
// =============================================================================

const MENU_SECTIONS: MenuSection[] = [
  {
    titleKey: 'menu.main',
    items: [
      {
        id: 'home',
        icon: 'home-outline',
        activeIcon: 'home',
        labelKey: 'navigation.home',
        route: '/(main)',
      },
      {
        id: 'agenda',
        icon: 'calendar-outline',
        activeIcon: 'calendar',
        labelKey: 'navigation.schedule',
        route: '/(main)/agenda',
      },
      {
        id: 'os',
        icon: 'clipboard-outline',
        activeIcon: 'clipboard',
        labelKey: 'navigation.workOrders',
        route: '/(main)/os',
      },
      {
        id: 'clientes',
        icon: 'people-outline',
        activeIcon: 'people',
        labelKey: 'navigation.clients',
        route: '/(main)/clientes',
      },
    ],
  },
  {
    titleKey: 'menu.financial',
    items: [
      {
        id: 'orcamentos',
        icon: 'document-text-outline',
        activeIcon: 'document-text',
        labelKey: 'navigation.quotes',
        route: '/orcamentos',
      },
      {
        id: 'cobrancas',
        icon: 'cash-outline',
        activeIcon: 'cash',
        labelKey: 'navigation.charges',
        route: '/cobrancas',
      },
      {
        id: 'despesas',
        icon: 'wallet-outline',
        activeIcon: 'wallet',
        labelKey: 'menu.expenses',
        route: '/despesas',
      },
    ],
  },
  {
    titleKey: 'menu.catalogSection',
    items: [
      {
        id: 'catalogo',
        icon: 'cube-outline',
        activeIcon: 'cube',
        labelKey: 'navigation.catalog',
        route: '/catalogo',
      },
    ],
  },
  {
    titleKey: 'menu.other',
    items: [
      {
        id: 'relatorios',
        icon: 'bar-chart-outline',
        activeIcon: 'bar-chart',
        labelKey: 'navigation.reports',
        route: '/relatorios',
      },
      {
        id: 'ajuda',
        icon: 'help-circle-outline',
        activeIcon: 'help-circle',
        labelKey: 'menu.help',
        route: '/ajuda',
      },
    ],
  },
];

// =============================================================================
// MENU ITEM COMPONENT
// =============================================================================

interface MenuItemComponentProps {
  item: MenuItem;
  isActive: boolean;
  onPress: () => void;
  t: (key: string) => string;
}

const MenuItemComponent: React.FC<MenuItemComponentProps> = ({ item, isActive, onPress, t }) => {
  const colors = useColors();

  return (
    <TouchableOpacity
      style={[
        styles.menuItem,
        isActive && { backgroundColor: colors.primary[50] },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.menuIconContainer,
          { backgroundColor: isActive ? colors.primary[100] : colors.gray[100] },
        ]}
      >
        <Ionicons
          name={isActive ? item.activeIcon : item.icon}
          size={22}
          color={isActive ? colors.primary[600] : colors.text.secondary}
        />
      </View>
      <Text
        variant="body"
        weight={isActive ? 'semibold' : 'normal'}
        style={[
          styles.menuLabel,
          { color: isActive ? colors.primary[700] : colors.text.primary },
        ]}
      >
        {t(item.labelKey)}
      </Text>
      {item.badge && item.badge > 0 && (
        <Badge variant="error" size="sm">
          {item.badge > 99 ? '99+' : item.badge.toString()}
        </Badge>
      )}
      {isActive && (
        <View style={[styles.activeIndicator, { backgroundColor: colors.primary[500] }]} />
      )}
    </TouchableOpacity>
  );
};

// =============================================================================
// DRAWER MENU COMPONENT
// =============================================================================

export const DrawerMenu: React.FC<DrawerMenuProps> = ({ isOpen, onClose }) => {
  const colors = useColors();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { t } = useTranslation();

  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isOpen) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -DRAWER_WIDTH,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isOpen, slideAnim, fadeAnim]);

  const handleComingSoon = useCallback((featureKey: string) => {
    const featureName = t(featureKey);
    Alert.alert(
      t('common.soon'),
      t('menu.comingSoonMessage', { feature: featureName }),
      [{ text: t('common.confirm') }]
    );
  }, [t]);

  const handleMenuPress = useCallback(
    (item: MenuItem) => {
      onClose();

      // Rotas que ainda não existem
      const comingSoonRoutes = ['/ajuda'];

      if (comingSoonRoutes.includes(item.route)) {
        setTimeout(() => handleComingSoon(item.labelKey), 300);
        return;
      }

      setTimeout(() => {
        router.push(item.route as any);
      }, 100);
    },
    [router, onClose, handleComingSoon]
  );

  const handleLogout = useCallback(() => {
    onClose();
    Alert.alert(
      t('settings.logout'),
      t('settings.logoutConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.logout'),
          style: 'destructive',
          onPress: () => logout(),
        },
      ]
    );
  }, [onClose, logout, t]);

  const handleEditProfile = useCallback(() => {
    onClose();
    setTimeout(() => {
      router.push('/perfil' as any);
    }, 100);
  }, [onClose, router]);

  const isRouteActive = useCallback(
    (route: string) => {
      // Normalizar rotas para comparação
      const normalizedPathname = pathname.replace(/\/$/, '');
      const normalizedRoute = route.replace(/\/$/, '');

      // Verificar se é a rota de início
      if (normalizedRoute === '/(main)' || normalizedRoute === '/(tabs)') {
        return normalizedPathname === '/' || normalizedPathname === '/(main)' || normalizedPathname === '/(tabs)';
      }

      return normalizedPathname.startsWith(normalizedRoute);
    },
    [pathname]
  );

  if (!isOpen) return null;

  return (
    <Modal
      transparent
      visible={isOpen}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View
          style={[
            styles.backdropInner,
            { backgroundColor: 'rgba(0,0,0,0.5)', opacity: fadeAnim },
          ]}
        />
      </Pressable>

      {/* Drawer */}
      <Animated.View
        style={[
          styles.drawer,
          {
            backgroundColor: colors.background.primary,
            width: DRAWER_WIDTH,
            transform: [{ translateX: slideAnim }],
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        {/* Header / Profile */}
        <View style={[styles.header, { borderBottomColor: colors.border.light }]}>
          <TouchableOpacity style={styles.profileSection} onPress={handleEditProfile}>
            <Avatar name={user?.name} src={user?.avatarUrl} size="lg" />
            <View style={styles.profileInfo}>
              <Text variant="h5" numberOfLines={1}>
                {user?.name || t('menu.user')}
              </Text>
              <Text variant="caption" color="secondary" numberOfLines={1}>
                {user?.email}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
          </TouchableOpacity>
        </View>

        {/* Menu Items */}
        <ScrollView
          style={styles.menuContainer}
          contentContainerStyle={styles.menuContent}
          showsVerticalScrollIndicator={false}
        >
          {MENU_SECTIONS.map((section, sectionIndex) => (
            <View key={section.titleKey || sectionIndex} style={styles.section}>
              {section.titleKey && (
                <Text
                  variant="caption"
                  weight="semibold"
                  color="tertiary"
                  style={styles.sectionTitle}
                >
                  {t(section.titleKey).toUpperCase()}
                </Text>
              )}
              {section.items.map((item) => (
                <MenuItemComponent
                  key={item.id}
                  item={item}
                  isActive={isRouteActive(item.route)}
                  onPress={() => handleMenuPress(item)}
                  t={t}
                />
              ))}
              {sectionIndex < MENU_SECTIONS.length - 1 && (
                <Divider style={styles.sectionDivider} />
              )}
            </View>
          ))}
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: colors.border.light }]}>
          <TouchableOpacity
            style={[styles.logoutButton, { backgroundColor: colors.error[50] }]}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={22} color={colors.error[600]} />
            <Text variant="body" weight="medium" style={{ color: colors.error[600], marginLeft: spacing[3] }}>
              {t('menu.logoutAccount')}
            </Text>
          </TouchableOpacity>
          <Text variant="caption" color="tertiary" align="center" style={styles.version}>
            {t('menu.appVersion', { version: '1.0.0' })}
          </Text>
        </View>
      </Animated.View>
    </Modal>
  );
};

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  backdropInner: {
    flex: 1,
  },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  header: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[5],
    borderBottomWidth: 1,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
    marginLeft: spacing[3],
    marginRight: spacing[2],
  },
  menuContainer: {
    flex: 1,
  },
  menuContent: {
    paddingVertical: spacing[2],
  },
  section: {
    paddingHorizontal: spacing[3],
  },
  sectionTitle: {
    paddingHorizontal: spacing[3],
    paddingTop: spacing[4],
    paddingBottom: spacing[2],
    letterSpacing: 0.5,
  },
  sectionDivider: {
    marginVertical: spacing[2],
    marginHorizontal: spacing[3],
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.lg,
    marginVertical: spacing[0.5],
    position: 'relative',
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    flex: 1,
    marginLeft: spacing[3],
  },
  activeIndicator: {
    position: 'absolute',
    left: 0,
    top: '25%',
    bottom: '25%',
    width: 3,
    borderRadius: 2,
  },
  footer: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderTopWidth: 1,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
  },
  version: {
    marginTop: spacing[3],
  },
});

export default DrawerMenu;
