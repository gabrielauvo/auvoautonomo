/**
 * ProDesign Card Component
 *
 * Container com fundo, borda e sombra opcional.
 */

import React from 'react';
import { View, ViewProps, StyleSheet, Pressable } from 'react-native';
import { useColors } from '../ThemeProvider';
import { spacing, borderRadius, shadows } from '../tokens';

// =============================================================================
// TYPES
// =============================================================================

type CardVariant = 'elevated' | 'outlined' | 'filled';

interface CardProps extends ViewProps {
  variant?: CardVariant;
  onPress?: () => void;
  padding?: keyof typeof spacing;
  children: React.ReactNode;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function Card({
  variant = 'elevated',
  onPress,
  padding = 4,
  style,
  children,
  ...props
}: CardProps) {
  const colors = useColors();

  const getVariantStyles = () => {
    switch (variant) {
      case 'elevated':
        return {
          backgroundColor: colors.background.primary,
          borderWidth: 0,
          ...shadows.md,
        };
      case 'outlined':
        return {
          backgroundColor: colors.background.primary,
          borderWidth: 1,
          borderColor: colors.border.light,
        };
      case 'filled':
        return {
          backgroundColor: colors.background.secondary,
          borderWidth: 0,
        };
      default:
        return {
          backgroundColor: colors.background.primary,
        };
    }
  };

  const cardStyle = [
    styles.base,
    getVariantStyles(),
    { padding: spacing[padding] },
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [
          cardStyle,
          pressed && { opacity: 0.9 },
        ]}
        onPress={onPress}
        {...props}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View style={cardStyle} {...props}>
      {children}
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  base: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
});

export default Card;
