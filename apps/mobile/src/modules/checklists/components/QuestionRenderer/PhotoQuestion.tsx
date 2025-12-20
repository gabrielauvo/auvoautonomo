// @ts-nocheck
/**
 * PhotoQuestion
 *
 * Renderizador para perguntas que requerem fotos.
 */

import React, { useCallback } from 'react';
import { View, TouchableOpacity, Image, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../../../design-system';
import { useColors } from '../../../../design-system/ThemeProvider';

// =============================================================================
// TYPES
// =============================================================================

export interface PhotoQuestionProps {
  value?: string[];
  onChange: (value: string[]) => void;
  onCapture?: () => void;
  maxPhotos?: number;
  readOnly?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function PhotoQuestion({
  value = [],
  onChange,
  onCapture,
  maxPhotos = 5,
  readOnly = false,
}: PhotoQuestionProps) {
  const colors = useColors();

  const handleRemovePhoto = useCallback(
    (index: number) => {
      const newPhotos = [...value];
      newPhotos.splice(index, 1);
      onChange(newPhotos);
    },
    [value, onChange]
  );

  const handleAddPhoto = useCallback(() => {
    if (onCapture) {
      onCapture();
    }
  }, [onCapture]);

  const canAddMore = value.length < maxPhotos;

  return (
    <View style={styles.container}>
      {/* Grid de fotos */}
      <View style={styles.photosGrid}>
        {value.map((photoUri, index) => (
          <View key={`photo-${index}`} style={styles.photoContainer}>
            <Image
              source={{ uri: photoUri }}
              style={[styles.photo, { borderColor: colors.border.light }]}
              resizeMode="cover"
            />
            {!readOnly && (
              <TouchableOpacity
                style={[styles.removeButton, { backgroundColor: colors.error[500] }]}
                onPress={() => handleRemovePhoto(index)}
              >
                <Ionicons name="close" size={14} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>
        ))}

        {/* Botao adicionar foto */}
        {!readOnly && canAddMore && (
          <TouchableOpacity
            style={[
              styles.addButton,
              {
                borderColor: colors.border.medium,
                backgroundColor: colors.background.secondary,
              },
            ]}
            onPress={handleAddPhoto}
          >
            <Ionicons name="camera" size={28} color={colors.primary[500]} />
            <Text variant="caption" color="primary" style={{ marginTop: 4 }}>
              Adicionar
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Contador */}
      <Text variant="caption" color="tertiary" style={styles.counter}>
        {value.length} de {maxPhotos} fotos
      </Text>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoContainer: {
    position: 'relative',
  },
  photo: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 1,
  },
  removeButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    textAlign: 'center',
  },
});

export default PhotoQuestion;
