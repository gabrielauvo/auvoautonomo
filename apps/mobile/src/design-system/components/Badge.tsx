/**
 * ProDesign Badge Component
 *
 * Badge para status, contagens e labels.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useColors } from '../ThemeProvider';
import { spacing, borderRadius } from '../tokens';
import { Text } from './Text';

// =============================================================================
// TYPES
// =============================================================================

type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'default';
type BadgeSize = 'sm' | 'md' | 'small' | 'medium';

interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children?: string;
  label?: string; // Alias for children
}

// =============================================================================
// COMPONENT
// =============================================================================

export function Badge({
  variant = 'primary',
  size = 'md',
  children,
  label,
}: BadgeProps) {
  const colors = useColors();
  const text = children || label || '';

  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: colors.primary[100],
          textColor: colors.primary[700],
        };
      case 'secondary':
        return {
          backgroundColor: colors.secondary[100],
          textColor: colors.secondary[700],
        };
      case 'success':
        return {
          backgroundColor: colors.success[100],
          textColor: colors.success[700],
        };
      case 'warning':
        return {
          backgroundColor: colors.warning[100],
          textColor: colors.warning[700],
        };
      case 'error':
        return {
          backgroundColor: colors.error[100],
          textColor: colors.error[700],
        };
      case 'info':
        return {
          backgroundColor: colors.info[100],
          textColor: colors.info[700],
        };
      case 'default':
      default:
        return {
          backgroundColor: colors.gray[100],
          textColor: colors.gray[700],
        };
    }
  };

  const variantConfig = getVariantStyles();
  const isSmall = size === 'sm' || size === 'small';

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: variantConfig.backgroundColor,
          paddingVertical: isSmall ? spacing[0.5] : spacing[1],
          paddingHorizontal: isSmall ? spacing[1.5] : spacing[2],
        },
      ]}
    >
      <Text
        variant={isSmall ? 'caption' : 'bodySmall'}
        weight="medium"
        style={{ color: variantConfig.textColor }}
      >
        {text}
      </Text>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    borderRadius: borderRadius.full,
  },
});

export default Badge;
