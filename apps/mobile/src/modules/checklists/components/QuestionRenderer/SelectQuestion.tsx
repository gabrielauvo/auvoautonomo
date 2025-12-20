// @ts-nocheck
/**
 * SelectQuestion
 *
 * Renderizador para perguntas de selecao unica ou multipla.
 */

import React, { useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../../../design-system';
import { useColors } from '../../../../design-system/ThemeProvider';
import type { QuestionOption } from '../VirtualizedChecklistRenderer';

// =============================================================================
// TYPES
// =============================================================================

export interface SelectQuestionProps {
  value?: string | string[];
  options: QuestionOption[];
  onChange: (value: string | string[]) => void;
  multiple?: boolean;
  readOnly?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function SelectQuestion({
  value,
  options,
  onChange,
  multiple = false,
  readOnly = false,
}: SelectQuestionProps) {
  const colors = useColors();

  // Normalizar valor para array
  const selectedValues: string[] = multiple
    ? Array.isArray(value)
      ? value
      : []
    : value
    ? [value as string]
    : [];

  const handleSelect = useCallback(
    (optionValue: string) => {
      if (readOnly) return;

      if (multiple) {
        // Multi-select: toggle
        const newValues = selectedValues.includes(optionValue)
          ? selectedValues.filter((v) => v !== optionValue)
          : [...selectedValues, optionValue];
        onChange(newValues);
      } else {
        // Single select
        onChange(optionValue);
      }
    },
    [multiple, selectedValues, onChange, readOnly]
  );

  const isSelected = (optionValue: string) => selectedValues.includes(optionValue);

  return (
    <View style={styles.container}>
      {options.map((option) => {
        const selected = isSelected(option.value);
        return (
          <TouchableOpacity
            key={option.id || option.value}
            style={[
              styles.option,
              {
                backgroundColor: selected ? colors.primary[50] : colors.background.primary,
                borderColor: selected ? colors.primary[500] : colors.border.light,
              },
            ]}
            onPress={() => handleSelect(option.value)}
            disabled={readOnly}
            activeOpacity={0.7}
          >
            {/* Indicador de selecao */}
            <View
              style={[
                multiple ? styles.checkboxIndicator : styles.radioIndicator,
                {
                  borderColor: selected ? colors.primary[500] : colors.border.medium,
                  backgroundColor: selected ? colors.primary[500] : 'transparent',
                },
              ]}
            >
              {selected && (
                <Ionicons
                  name={multiple ? 'checkmark' : 'ellipse'}
                  size={multiple ? 14 : 8}
                  color={multiple ? '#FFFFFF' : '#FFFFFF'}
                />
              )}
            </View>

            {/* Label */}
            <Text
              variant="body"
              style={[
                styles.optionLabel,
                { color: selected ? colors.primary[700] : colors.text.primary },
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
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
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  radioIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxIndicator: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    marginLeft: 12,
    flex: 1,
  },
});

export default SelectQuestion;
