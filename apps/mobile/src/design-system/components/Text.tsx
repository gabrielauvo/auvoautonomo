/**
 * ProDesign Text Component
 *
 * Componente de texto com variantes pré-definidas.
 */

import React from 'react';
import { Text as RNText, TextProps as RNTextProps, StyleSheet } from 'react-native';
import { useColors, useTypography } from '../ThemeProvider';
import { typography } from '../tokens';

// =============================================================================
// TYPES
// =============================================================================

type TextVariant =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'subtitle'
  | 'body'
  | 'bodySmall'
  | 'caption'
  | 'label';

type TextColor = 'primary' | 'secondary' | 'tertiary' | 'inverse' | 'error' | 'success' | 'warning';

interface TextProps extends RNTextProps {
  variant?: TextVariant;
  color?: TextColor;
  weight?: keyof typeof typography.fontWeight;
  align?: 'left' | 'center' | 'right';
  children: React.ReactNode;
}

// =============================================================================
// VARIANT STYLES
// =============================================================================

const variantStyles = {
  h1: {
    fontSize: typography.fontSize['4xl'],
    fontWeight: typography.fontWeight.bold,
    lineHeight: typography.fontSize['4xl'] * typography.lineHeight.tight,
  },
  h2: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    lineHeight: typography.fontSize['3xl'] * typography.lineHeight.tight,
  },
  h3: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.semibold,
    lineHeight: typography.fontSize['2xl'] * typography.lineHeight.tight,
  },
  h4: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    lineHeight: typography.fontSize.xl * typography.lineHeight.tight,
  },
  h5: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.medium,
    lineHeight: typography.fontSize.lg * typography.lineHeight.normal,
  },
  h6: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    lineHeight: typography.fontSize.base * typography.lineHeight.normal,
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    lineHeight: typography.fontSize.base * typography.lineHeight.normal,
  },
  body: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.normal,
    lineHeight: typography.fontSize.base * typography.lineHeight.normal,
  },
  bodySmall: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.normal,
    lineHeight: typography.fontSize.sm * typography.lineHeight.normal,
  },
  caption: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.normal,
    lineHeight: typography.fontSize.xs * typography.lineHeight.normal,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    lineHeight: typography.fontSize.sm * typography.lineHeight.normal,
  },
};

// =============================================================================
// COMPONENT
// =============================================================================

export function Text({
  variant = 'body',
  color = 'primary',
  weight,
  align = 'left',
  style,
  children,
  ...props
}: TextProps) {
  const colors = useColors();

  const colorValue = (() => {
    switch (color) {
      case 'primary': return colors.text.primary;
      case 'secondary': return colors.text.secondary;
      case 'tertiary': return colors.text.tertiary;
      case 'inverse': return colors.text.inverse;
      case 'error': return colors.error[500];
      case 'success': return colors.success[500];
      case 'warning': return colors.warning[500];
      default: return colors.text.primary;
    }
  })();

  const computedStyle = [
    variantStyles[variant],
    { color: colorValue, textAlign: align },
    weight && { fontWeight: typography.fontWeight[weight] },
    style,
  ];

  return (
    <RNText style={computedStyle} {...props}>
      {children}
    </RNText>
  );
}

export default Text;
