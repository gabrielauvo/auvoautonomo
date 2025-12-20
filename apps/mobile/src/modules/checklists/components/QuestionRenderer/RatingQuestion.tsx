// @ts-nocheck
/**
 * RatingQuestion
 *
 * Renderizador para perguntas de avaliacao com estrelas.
 */

import React, { useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../../../design-system';
import { useColors } from '../../../../design-system/ThemeProvider';

// =============================================================================
// TYPES
// =============================================================================

export interface RatingQuestionProps {
  value?: number;
  onChange: (value: number) => void;
  maxRating?: number;
  readOnly?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function RatingQuestion({
  value,
  onChange,
  maxRating = 5,
  readOnly = false,
}: RatingQuestionProps) {
  const colors = useColors();

  const handleSelect = useCallback(
    (rating: number) => {
      if (!readOnly) {
        // Se clicar na mesma estrela, remove a selecao
        onChange(rating === value ? 0 : rating);
      }
    },
    [value, onChange, readOnly]
  );

  const stars = Array.from({ length: maxRating }, (_, i) => i + 1);

  return (
    <View style={styles.container}>
      <View style={styles.starsRow}>
        {stars.map((rating) => {
          const isFilled = value !== undefined && rating <= value;
          return (
            <TouchableOpacity
              key={rating}
              onPress={() => handleSelect(rating)}
              disabled={readOnly}
              style={styles.starButton}
            >
              <Ionicons
                name={isFilled ? 'star' : 'star-outline'}
                size={36}
                color={isFilled ? colors.warning[500] : colors.border.medium}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Label de valor */}
      <Text variant="caption" color="secondary" style={styles.label}>
        {value ? `${value} de ${maxRating}` : 'Nenhuma avaliacao'}
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
    gap: 8,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  starButton: {
    padding: 4,
  },
  label: {
    marginTop: 4,
  },
});

export default RatingQuestion;
