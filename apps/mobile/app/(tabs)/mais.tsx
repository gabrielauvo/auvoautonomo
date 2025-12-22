/**
 * More Screen
 *
 * Menu com opcoes adicionais e navegacao.
 */

import React, { useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Text, Card, Avatar, Divider } from '../../src/design-system';
import { useColors } from '../../src/design-system/ThemeProvider';
import { useAuth } from '../../src/services';
import { spacing } from '../../src/design-system/tokens';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface MenuItem {
  icon: IconName;
  label: string;
  route?: string;
  onPress?: () => void;
  disabled?: boolean;
}

export default function MaisScreen() {
  const colors = useColors();
  const { user, logout } = useAuth();

  const handleComingSoon = useCallback((feature: string) => {
    Alert.alert(
      'Em breve',
      `A funcionalidade "${feature}" estara disponivel em breve.`,
      [{ text: 'OK' }]
    );
  }, []);

  const handleEditProfile = useCallback(() => {
    Alert.alert(
      'Editar Perfil',
      'A edicao de perfil estara disponivel em breve.',
      [{ text: 'OK' }]
    );
  }, []);

  const handleHelp = useCallback(() => {
    Alert.alert(
      'Ajuda',
      'Para suporte, entre em contato:\n\nEmail: suporte@auvo.com.br\nTelefone: (11) 0000-0000',
      [{ text: 'OK' }]
    );
  }, []);

  const menuItems: MenuItem[] = [
    {
      icon: 'cube-outline',
      label: 'Catálogo',
      route: '/catalogo',
    },
    {
      icon: 'document-text-outline',
      label: 'Orçamentos',
      route: '/orcamentos',
    },
    {
      icon: 'cash-outline',
      label: 'Cobranças',
      route: '/cobrancas',
    },
    {
      icon: 'bar-chart-outline',
      label: 'Relatórios',
      onPress: () => handleComingSoon('Relatórios'),
    },
    {
      icon: 'help-circle-outline',
      label: 'Ajuda',
      onPress: handleHelp,
    },
  ];

  const handleMenuPress = useCallback((item: MenuItem) => {
    if (item.route) {
      router.push(item.route as any);
    } else if (item.onPress) {
      item.onPress();
    }
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.secondary }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Card */}
        <Card variant="elevated" style={styles.profileCard}>
          <Avatar name={user?.name} size="lg" />
          <View style={styles.profileInfo}>
            <Text variant="h5">{user?.name || 'Tecnico'}</Text>
            <Text variant="bodySmall" color="secondary">
              {user?.email}
            </Text>
          </View>
          <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
            <Ionicons name="pencil-outline" size={20} color={colors.primary[500]} />
          </TouchableOpacity>
        </Card>

        {/* Menu Items */}
        <Card variant="elevated" style={styles.menuCard}>
          {menuItems.map((item, index) => (
            <React.Fragment key={item.label}>
              <TouchableOpacity
                style={[
                  styles.menuItem,
                  item.disabled && styles.menuItemDisabled
                ]}
                onPress={() => handleMenuPress(item)}
                disabled={item.disabled}
              >
                <View style={[styles.menuIcon, { backgroundColor: colors.primary[50] }]}>
                  <Ionicons name={item.icon} size={22} color={colors.primary[500]} />
                </View>
                <Text
                  variant="body"
                  style={styles.menuLabel}
                  color={item.disabled ? 'tertiary' : undefined}
                >
                  {item.label}
                </Text>
                <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
              </TouchableOpacity>
              {index < menuItems.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </Card>

        {/* Logout */}
        <Card variant="outlined" style={styles.logoutCard}>
          <TouchableOpacity style={styles.logoutButton} onPress={logout}>
            <Ionicons name="log-out-outline" size={22} color={colors.error[500]} />
            <Text variant="body" style={[styles.logoutText, { color: colors.error[500] }]}>
              Sair
            </Text>
          </TouchableOpacity>
        </Card>

        {/* Version */}
        <Text variant="caption" color="tertiary" style={styles.version}>
          Auvo Mobile v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing[4],
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  profileInfo: {
    flex: 1,
    marginLeft: spacing[4],
  },
  editButton: {
    padding: spacing[2],
  },
  menuCard: {
    marginBottom: spacing[4],
    padding: 0,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[4],
  },
  menuItemDisabled: {
    opacity: 0.5,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    flex: 1,
    marginLeft: spacing[3],
  },
  logoutCard: {
    marginBottom: spacing[4],
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    marginLeft: spacing[2],
  },
  version: {
    textAlign: 'center',
  },
});
