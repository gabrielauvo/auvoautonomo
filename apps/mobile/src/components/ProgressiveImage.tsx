/**
 * ProgressiveImage
 *
 * Componente de imagem otimizado para dispositivos com pouca memória.
 * Características:
 * - Carrega thumbnail de baixa qualidade primeiro (blur up)
 * - Transição suave para imagem full
 * - Placeholder enquanto carrega
 * - Tratamento de erros com fallback
 * - Lazy loading baseado em visibilidade
 */

import React, { useState, useCallback, memo } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Animated,
  StyleProp,
  ImageStyle,
  ViewStyle,
  ActivityIndicator,
} from 'react-native';
import { colors } from '../design-system/tokens';

// =============================================================================
// TYPES
// =============================================================================

interface ProgressiveImageProps {
  /** URI da imagem principal */
  source: string | null | undefined;

  /** URI do thumbnail (baixa resolução) - opcional */
  thumbnailSource?: string | null;

  /** Estilos da imagem */
  style?: StyleProp<ImageStyle>;

  /** Estilos do container */
  containerStyle?: StyleProp<ViewStyle>;

  /** Cor de fundo do placeholder */
  placeholderColor?: string;

  /** Mostrar indicador de loading */
  showLoading?: boolean;

  /** Blur radius para thumbnail (0-25) */
  blurRadius?: number;

  /** Duração da transição em ms */
  fadeDuration?: number;

  /** Callback quando imagem carrega */
  onLoad?: () => void;

  /** Callback quando ocorre erro */
  onError?: () => void;

  /** Componente de fallback em caso de erro */
  fallback?: React.ReactNode;

  /** Modo de redimensionamento */
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
}

// =============================================================================
// COMPONENT
// =============================================================================

function ProgressiveImageComponent({
  source,
  thumbnailSource,
  style,
  containerStyle,
  placeholderColor = colors.gray[200],
  showLoading = true,
  blurRadius = 10,
  fadeDuration = 300,
  onLoad,
  onError,
  fallback,
  resizeMode = 'cover',
}: ProgressiveImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [thumbnailLoaded, setThumbnailLoaded] = useState(false);

  // Animated value for fade transition
  const imageOpacity = useState(new Animated.Value(0))[0];
  const thumbnailOpacity = useState(new Animated.Value(0))[0];

  // Handle thumbnail load
  const handleThumbnailLoad = useCallback(() => {
    setThumbnailLoaded(true);
    Animated.timing(thumbnailOpacity, {
      toValue: 1,
      duration: fadeDuration / 2,
      useNativeDriver: true,
    }).start();
  }, [thumbnailOpacity, fadeDuration]);

  // Handle main image load
  const handleImageLoad = useCallback(() => {
    setIsLoading(false);
    Animated.timing(imageOpacity, {
      toValue: 1,
      duration: fadeDuration,
      useNativeDriver: true,
    }).start(() => {
      // After main image is visible, hide thumbnail to save memory
      thumbnailOpacity.setValue(0);
    });
    onLoad?.();
  }, [imageOpacity, thumbnailOpacity, fadeDuration, onLoad]);

  // Handle error
  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
    onError?.();
  }, [onError]);

  // No source provided
  if (!source) {
    return (
      <View style={[styles.container, containerStyle, { backgroundColor: placeholderColor }]}>
        {fallback || <View style={[styles.placeholder, style]} />}
      </View>
    );
  }

  // Error state
  if (hasError) {
    return (
      <View style={[styles.container, containerStyle, { backgroundColor: placeholderColor }]}>
        {fallback || <View style={[styles.placeholder, style]} />}
      </View>
    );
  }

  return (
    <View style={[styles.container, containerStyle]}>
      {/* Placeholder background */}
      <View style={[styles.placeholder, style, { backgroundColor: placeholderColor }]} />

      {/* Thumbnail (blurred, low quality) */}
      {thumbnailSource && !thumbnailLoaded && (
        <Animated.Image
          source={{ uri: thumbnailSource }}
          style={[styles.image, style, { opacity: thumbnailOpacity }]}
          blurRadius={blurRadius}
          resizeMode={resizeMode}
          onLoad={handleThumbnailLoad}
          onError={() => {
            // Thumbnail error is not critical, just skip it
            setThumbnailLoaded(true);
          }}
        />
      )}

      {/* Main image */}
      <Animated.Image
        source={{ uri: source }}
        style={[styles.image, style, { opacity: imageOpacity }]}
        resizeMode={resizeMode}
        onLoad={handleImageLoad}
        onError={handleError}
      />

      {/* Loading indicator */}
      {isLoading && showLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary[500]} />
        </View>
      )}
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  placeholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  image: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// =============================================================================
// EXPORTS
// =============================================================================

// Memoize to prevent unnecessary re-renders
export const ProgressiveImage = memo(ProgressiveImageComponent);

// Helper function to generate thumbnail URL (if using Cloudinary or similar)
export function getThumbnailUrl(
  originalUrl: string | null | undefined,
  width: number = 50
): string | undefined {
  if (!originalUrl) return undefined;

  // Example for Cloudinary URLs
  // Adjust this for your image hosting service
  if (originalUrl.includes('cloudinary.com')) {
    // Insert transformation before /upload/
    return originalUrl.replace(
      '/upload/',
      `/upload/w_${width},q_30,f_auto/`
    );
  }

  // For other services, return undefined (skip thumbnail)
  return undefined;
}

export default ProgressiveImage;
