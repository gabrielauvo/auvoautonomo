/**
 * ProDesign Divider Component
 *
 * Linha divisória horizontal ou vertical.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useColors } from '../ThemeProvider';
import { spacing } from '../tokens';

// =============================================================================
// TYPES
// =============================================================================

interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  spacing?: keyof typeof spacing;
  style?: import('react-native').ViewStyle;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function Divider({
  orientation = 'horizontal',
  spacing: spacingProp = 0,
  style,
}: DividerProps) {
  const colors = useColors();
  const isVertical = orientation === 'vertical';

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: colors.border.light,
        },
        isVertical
          ? {
              width: 1,
              marginHorizontal: spacing[spacingProp],
            }
          : {
              height: 1,
              marginVertical: spacing[spacingProp],
            },
        style,
      ]}
    />
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  base: {},
});

export default Divider;
