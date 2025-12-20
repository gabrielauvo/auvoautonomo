// @ts-nocheck
/**
 * ScaleQuestion
 *
 * Renderizador para perguntas de escala numerica (ex: 0-10).
 */

import React, { useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { Text } from '../../../../design-system';
import { useColors } from '../../../../design-system/ThemeProvider';

// =============================================================================
// TYPES
// =============================================================================

export interface ScaleQuestionProps {
  value?: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  labels?: { min?: string; max?: string };
  readOnly?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ScaleQuestion({
  value,
  onChange,
  min = 0,
  max = 10,
  step = 1,
  labels,
  readOnly = false,
}: ScaleQuestionProps) {
  const colors = useColors();

  const handleChange = useCallback(
    (newValue: number) => {
      onChange(Math.round(newValue / step) * step);
    },
    [onChange, step]
  );

  // Gerar botoes para valores discretos (se poucos valores)
  const numValues = Math.floor((max - min) / step) + 1;
  const useButtons = numValues <= 11;

  if (useButtons) {
    const values = Array.from({ length: numValues }, (_, i) => min + i * step);

    return (
      <View style={styles.container}>
        {/* Botoes discretos */}
        <View style={styles.buttonsRow}>
          {values.map((v) => {
            const isSelected = value === v;
            return (
              <TouchableOpacity
                key={v}
                style={[
                  styles.scaleButton,
                  {
                    backgroundColor: isSelected ? colors.primary[500] : colors.background.secondary,
                    borderColor: isSelected ? colors.primary[500] : colors.border.light,
                  },
                ]}
                onPress={() => onChange(v)}
                disabled={readOnly}
              >
                <Text
                  variant="body"
                  weight={isSelected ? 'semibold' : 'regular'}
                  style={{ color: isSelected ? '#FFFFFF' : colors.text.primary }}
                >
                  {v}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Labels min/max */}
        {labels && (
          <View style={styles.labelsRow}>
            <Text variant="caption" color="tertiary">
              {labels.min || min}
            </Text>
            <Text variant="caption" color="tertiary">
              {labels.max || max}
            </Text>
          </View>
        )}
      </View>
    );
  }

  // Usar slider para muitos valores
  return (
    <View style={styles.container}>
      {/* Valor atual */}
      <View style={styles.valueContainer}>
        <Text variant="h3" weight="bold" style={{ color: colors.primary[500] }}>
          {value ?? '-'}
        </Text>
      </View>

      {/* Slider */}
      <Slider
        style={styles.slider}
        value={value ?? min}
        onValueChange={handleChange}
        minimumValue={min}
        maximumValue={max}
        step={step}
        minimumTrackTintColor={colors.primary[500]}
        maximumTrackTintColor={colors.border.light}
        thumbTintColor={colors.primary[500]}
        disabled={readOnly}
      />

      {/* Labels min/max */}
      <View style={styles.labelsRow}>
        <Text variant="caption" color="tertiary">
          {labels?.min || min}
        </Text>
        <Text variant="caption" color="tertiary">
          {labels?.max || max}
        </Text>
      </View>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  buttonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  scaleButton: {
    minWidth: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  valueContainer: {
    alignItems: 'center',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});

export default ScaleQuestion;
