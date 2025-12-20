/**
 * AppHeader Component
 *
 * Header padrão do app com botão de menu e título.
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity, ViewStyle, Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text, Badge } from '../design-system';
import { useColors } from '../design-system/ThemeProvider';
import { useDrawer } from './DrawerContext';
import { spacing } from '../design-system/tokens';

import { useSyncStatus } from '../sync';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface AppHeaderProps {
  title: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  rightIcon?: IconName;
  onRightPress?: () => void;
  rightComponent?: React.ReactNode;
  transparent?: boolean;
  style?: ViewStyle;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  showBackButton = false,
  onBackPress,
  rightIcon,
  onRightPress,
  rightComponent,
  transparent = false,
  style,
}) => {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { openDrawer } = useDrawer();
  const { isOnline } = useSyncStatus();

  const statusBarHeight = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0;
  const topPadding = Math.max(insets.top, statusBarHeight);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: transparent ? 'transparent' : colors.background.primary,
          borderBottomColor: transparent ? 'transparent' : colors.border.light,
          paddingTop: topPadding,
        },
        style,
      ]}
    >
      <View style={styles.content}>
        {/* Left Side - Menu or Back Button */}
        <View style={styles.leftContainer}>
          {showBackButton ? (
            <TouchableOpacity
              style={[styles.iconButton, { backgroundColor: colors.gray[100] }]}
              onPress={onBackPress}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={22} color={colors.text.primary} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.iconButton, { backgroundColor: colors.gray[100] }]}
              onPress={openDrawer}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="menu" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Center - Title */}
        <View style={styles.titleContainer}>
          <Text variant="h5" numberOfLines={1} align="center">
            {title}
          </Text>
        </View>

        {/* Right Side - Action or Status */}
        <View style={styles.rightContainer}>
          {rightComponent ? (
            rightComponent
          ) : rightIcon ? (
            <TouchableOpacity
              style={[styles.iconButton, { backgroundColor: colors.gray[100] }]}
              onPress={onRightPress}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name={rightIcon} size={22} color={colors.text.primary} />
            </TouchableOpacity>
          ) : (
            <Badge variant={isOnline ? 'success' : 'error'} size="sm">
              {isOnline ? 'Online' : 'Offline'}
            </Badge>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    paddingHorizontal: spacing[3],
  },
  leftContainer: {
    width: 48,
    alignItems: 'flex-start',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing[2],
  },
  rightContainer: {
    width: 80,
    alignItems: 'flex-end',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AppHeader;
