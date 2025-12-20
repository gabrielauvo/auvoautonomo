/**
 * ProDesign Button Component
 *
 * Botão com múltiplas variantes e estados.
 */

import React from 'react';
import {
  TouchableOpacity,
  TouchableOpacityProps,
  ActivityIndicator,
  StyleSheet,
  View,
} from 'react-native';
import { useColors } from '../ThemeProvider';
import { spacing, borderRadius, typography, shadows } from '../tokens';
import { Text } from './Text';

// =============================================================================
// TYPES
// =============================================================================

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<TouchableOpacityProps, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  children: string;
}

// =============================================================================
// SIZE STYLES
// =============================================================================

const sizeStyles = {
  sm: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    fontSize: typography.fontSize.sm,
    iconSize: 16,
  },
  md: {
    paddingVertical: spacing[2.5],
    paddingHorizontal: spacing[4],
    fontSize: typography.fontSize.base,
    iconSize: 20,
  },
  lg: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
    fontSize: typography.fontSize.lg,
    iconSize: 24,
  },
};

// =============================================================================
// COMPONENT
// =============================================================================

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  children,
  style,
  ...props
}: ButtonProps) {
  const colors = useColors();
  const sizeConfig = sizeStyles[size];

  // Variant styles
  const getVariantStyles = () => {
    const isDisabled = disabled || loading;

    switch (variant) {
      case 'primary':
        return {
          backgroundColor: isDisabled ? colors.primary[300] : colors.primary[500],
          borderWidth: 0,
          borderColor: 'transparent',
          textColor: colors.white,
        };
      case 'secondary':
        return {
          backgroundColor: isDisabled ? colors.secondary[100] : colors.secondary[100],
          borderWidth: 0,
          borderColor: 'transparent',
          textColor: isDisabled ? colors.secondary[400] : colors.secondary[700],
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: isDisabled ? colors.border.light : colors.border.default,
          textColor: isDisabled ? colors.text.tertiary : colors.text.primary,
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          borderWidth: 0,
          borderColor: 'transparent',
          textColor: isDisabled ? colors.text.tertiary : colors.primary[500],
        };
      case 'danger':
        return {
          backgroundColor: isDisabled ? colors.error[300] : colors.error[500],
          borderWidth: 0,
          borderColor: 'transparent',
          textColor: colors.white,
        };
      default:
        return {
          backgroundColor: colors.primary[500],
          borderWidth: 0,
          borderColor: 'transparent',
          textColor: colors.white,
        };
    }
  };

  const variantConfig = getVariantStyles();

  const buttonStyle = [
    styles.base,
    {
      backgroundColor: variantConfig.backgroundColor,
      borderWidth: variantConfig.borderWidth,
      borderColor: variantConfig.borderColor,
      paddingVertical: sizeConfig.paddingVertical,
      paddingHorizontal: sizeConfig.paddingHorizontal,
    },
    fullWidth && styles.fullWidth,
    variant === 'primary' && !disabled && !loading && shadows.sm,
    style,
  ];

  return (
    <TouchableOpacity
      style={buttonStyle}
      disabled={disabled || loading}
      activeOpacity={0.7}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variantConfig.textColor} />
      ) : (
        <View style={styles.content}>
          {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
          <Text
            variant="label"
            style={[
              { color: variantConfig.textColor, fontSize: sizeConfig.fontSize },
            ]}
          >
            {children}
          </Text>
          {rightIcon && <View style={styles.rightIcon}>{rightIcon}</View>}
        </View>
      )}
    </TouchableOpacity>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
  },
  fullWidth: {
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leftIcon: {
    marginRight: spacing[2],
  },
  rightIcon: {
    marginLeft: spacing[2],
  },
});

export default Button;
