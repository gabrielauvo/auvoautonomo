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
  label: string;
  route: string;
  badge?: number;
}

interface MenuSection {
  title?: string;
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
    title: 'Principal',
    items: [
      {
        id: 'home',
        icon: 'home-outline',
        activeIcon: 'home',
        label: 'Início',
        route: '/(main)',
      },
      {
        id: 'agenda',
        icon: 'calendar-outline',
        activeIcon: 'calendar',
        label: 'Agenda',
        route: '/(main)/agenda',
      },
      {
        id: 'os',
        icon: 'clipboard-outline',
        activeIcon: 'clipboard',
        label: 'Ordens de Serviço',
        route: '/(main)/os',
      },
      {
        id: 'clientes',
        icon: 'people-outline',
        activeIcon: 'people',
        label: 'Clientes',
        route: '/(main)/clientes',
      },
    ],
  },
  {
    title: 'Financeiro',
    items: [
      {
        id: 'orcamentos',
        icon: 'document-text-outline',
        activeIcon: 'document-text',
        label: 'Orçamentos',
        route: '/orcamentos',
      },
      {
        id: 'cobrancas',
        icon: 'cash-outline',
        activeIcon: 'cash',
        label: 'Cobranças',
        route: '/cobrancas',
      },
      {
        id: 'despesas',
        icon: 'wallet-outline',
        activeIcon: 'wallet',
        label: 'Despesas',
        route: '/despesas',
      },
    ],
  },
  {
    title: 'Catálogo',
    items: [
      {
        id: 'catalogo',
        icon: 'cube-outline',
        activeIcon: 'cube',
        label: 'Catálogo',
        route: '/catalogo',
      },
    ],
  },
  {
    title: 'Outros',
    items: [
      {
        id: 'relatorios',
        icon: 'bar-chart-outline',
        activeIcon: 'bar-chart',
        label: 'Relatórios',
        route: '/relatorios',
      },
      {
        id: 'ajuda',
        icon: 'help-circle-outline',
        activeIcon: 'help-circle',
        label: 'Ajuda',
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
}

const MenuItemComponent: React.FC<MenuItemComponentProps> = ({ item, isActive, onPress }) => {
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
        {item.label}
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

  const handleComingSoon = useCallback((feature: string) => {
    Alert.alert(
      'Em breve',
      `A funcionalidade "${feature}" estará disponível em breve.`,
      [{ text: 'OK' }]
    );
  }, []);

  const handleMenuPress = useCallback(
    (item: MenuItem) => {
      onClose();

      // Rotas que ainda não existem
      const comingSoonRoutes = ['/relatorios', '/ajuda'];

      if (comingSoonRoutes.includes(item.route)) {
        setTimeout(() => handleComingSoon(item.label), 300);
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
      'Sair',
      'Deseja realmente sair do aplicativo?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: () => logout(),
        },
      ]
    );
  }, [onClose, logout]);

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
                {user?.name || 'Usuário'}
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
            <View key={section.title || sectionIndex} style={styles.section}>
              {section.title && (
                <Text
                  variant="caption"
                  weight="semibold"
                  color="tertiary"
                  style={styles.sectionTitle}
                >
                  {section.title.toUpperCase()}
                </Text>
              )}
              {section.items.map((item) => (
                <MenuItemComponent
                  key={item.id}
                  item={item}
                  isActive={isRouteActive(item.route)}
                  onPress={() => handleMenuPress(item)}
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
              Sair da conta
            </Text>
          </TouchableOpacity>
          <Text variant="caption" color="tertiary" align="center" style={styles.version}>
            Auvo Mobile v1.0.0
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
