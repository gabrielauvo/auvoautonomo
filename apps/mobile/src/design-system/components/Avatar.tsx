/**
 * ProDesign Avatar Component
 *
 * Avatar com imagem ou iniciais.
 */

import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { useColors } from '../ThemeProvider';
import { borderRadius, typography } from '../tokens';
import { Text } from './Text';

// =============================================================================
// TYPES
// =============================================================================

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  size?: AvatarSize;
  src?: string | null;
  name?: string;
}

// =============================================================================
// SIZES
// =============================================================================

const sizes = {
  xs: { container: 24, fontSize: typography.fontSize.xs },
  sm: { container: 32, fontSize: typography.fontSize.sm },
  md: { container: 40, fontSize: typography.fontSize.base },
  lg: { container: 48, fontSize: typography.fontSize.lg },
  xl: { container: 64, fontSize: typography.fontSize.xl },
};

// =============================================================================
// COMPONENT
// =============================================================================

export function Avatar({ size = 'md', src, name }: AvatarProps) {
  const colors = useColors();
  const sizeConfig = sizes[size];

  const getInitials = (name?: string) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const containerStyle = [
    styles.container,
    {
      width: sizeConfig.container,
      height: sizeConfig.container,
      borderRadius: sizeConfig.container / 2,
      backgroundColor: colors.primary[100],
    },
  ];

  if (src) {
    return (
      <View style={containerStyle}>
        <Image
          source={{ uri: src }}
          style={[
            styles.image,
            {
              width: sizeConfig.container,
              height: sizeConfig.container,
              borderRadius: sizeConfig.container / 2,
            },
          ]}
        />
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      <Text
        variant="body"
        weight="medium"
        style={{
          fontSize: sizeConfig.fontSize,
          color: colors.primary[600],
        }}
      >
        {getInitials(name)}
      </Text>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    resizeMode: 'cover',
  },
});

export default Avatar;
