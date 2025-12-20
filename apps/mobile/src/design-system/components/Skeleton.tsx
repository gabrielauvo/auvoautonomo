// @ts-nocheck
/**
 * ProDesign Skeleton Component
 *
 * Placeholder animado para carregamento.
 */

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { useColors } from '../ThemeProvider';
import { borderRadius } from '../tokens';

// =============================================================================
// TYPES
// =============================================================================

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: keyof typeof borderRadius;
  style?: ViewStyle;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function Skeleton({
  width = '100%',
  height = 20,
  borderRadius: radiusProp = 'default',
  style,
}: SkeletonProps) {
  const colors = useColors();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: borderRadius[radiusProp],
          backgroundColor: colors.secondary[200],
          opacity,
        },
        style,
      ]}
    />
  );
}

// =============================================================================
// SKELETON PRESETS
// =============================================================================

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <View style={styles.textContainer}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          height={16}
          width={index === lines - 1 ? '60%' : '100%'}
          style={index > 0 ? styles.textLine : undefined}
        />
      ))}
    </View>
  );
}

export function SkeletonCard() {
  const colors = useColors();

  return (
    <View style={[styles.card, { backgroundColor: colors.background.primary }]}>
      <Skeleton height={150} borderRadius="lg" />
      <View style={styles.cardContent}>
        <Skeleton height={20} width="70%" />
        <Skeleton height={16} width="50%" style={styles.cardLine} />
        <Skeleton height={16} width="90%" style={styles.cardLine} />
      </View>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  textContainer: {},
  textLine: {
    marginTop: 8,
  },
  card: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  cardContent: {
    padding: 16,
  },
  cardLine: {
    marginTop: 8,
  },
});

export default Skeleton;
