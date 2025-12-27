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
type StatusIndicator = 'online' | 'offline' | 'busy' | 'away' | 'none';

interface AvatarProps {
  size?: AvatarSize;
  src?: string | null;
  name?: string;
  /** Shows a status indicator dot on the avatar */
  status?: StatusIndicator;
}

// =============================================================================
// SIZES
// =============================================================================

const sizes = {
  xs: { container: 24, fontSize: typography.fontSize.xs, indicator: 8 },
  sm: { container: 32, fontSize: typography.fontSize.sm, indicator: 10 },
  md: { container: 40, fontSize: typography.fontSize.base, indicator: 12 },
  lg: { container: 48, fontSize: typography.fontSize.lg, indicator: 14 },
  xl: { container: 64, fontSize: typography.fontSize.xl, indicator: 16 },
};

// =============================================================================
// COMPONENT
// =============================================================================

export function Avatar({ size = 'md', src, name, status = 'none' }: AvatarProps) {
  const colors = useColors();
  const sizeConfig = sizes[size];

  const getInitials = (name?: string) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const getStatusColor = (status: StatusIndicator) => {
    switch (status) {
      case 'online':
        return '#22C55E'; // green-500
      case 'offline':
        return '#9CA3AF'; // gray-400
      case 'busy':
        return '#EF4444'; // red-500
      case 'away':
        return '#F59E0B'; // amber-500
      default:
        return 'transparent';
    }
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

  // Render the avatar with status indicator overlay
  const renderContent = () => {
    if (src) {
      return (
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
      );
    }

    return (
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
    );
  };

  const showIndicator = status !== 'none';

  return (
    <View style={{ position: 'relative' }}>
      <View style={containerStyle}>{renderContent()}</View>
      {showIndicator && (
        <View
          style={{
            position: 'absolute',
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: getStatusColor(status),
            borderWidth: 2,
            borderColor: '#FFFFFF',
            bottom: -2,
            right: -2,
          }}
        />
      )}
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
