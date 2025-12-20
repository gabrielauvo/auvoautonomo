// @ts-nocheck
/**
 * NumberQuestion
 *
 * Renderizador para perguntas numericas.
 */

import React, { useState, useCallback } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../../../design-system';
import { useColors } from '../../../../design-system/ThemeProvider';

// =============================================================================
// TYPES
// =============================================================================

export interface NumberQuestionProps {
  value?: number;
  onChange: (value: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  readOnly?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function NumberQuestion({
  value,
  onChange,
  min,
  max,
  step = 1,
  placeholder,
  readOnly = false,
}: NumberQuestionProps) {
  const colors = useColors();
  const [isFocused, setIsFocused] = useState(false);
  const [inputText, setInputText] = useState(value !== undefined ? String(value) : '');

  const handleChangeText = useCallback(
    (text: string) => {
      // Permitir apenas numeros, ponto e sinal de menos
      const cleaned = text.replace(/[^0-9.-]/g, '');
      setInputText(cleaned);

      if (cleaned === '' || cleaned === '-') {
        onChange(undefined);
        return;
      }

      const num = parseFloat(cleaned);
      if (!isNaN(num)) {
        // Validar limites
        let validNum = num;
        if (min !== undefined && num < min) validNum = min;
        if (max !== undefined && num > max) validNum = max;
        onChange(validNum);
      }
    },
    [onChange, min, max]
  );

  const handleIncrement = useCallback(() => {
    const current = value ?? 0;
    const newValue = current + step;
    if (max === undefined || newValue <= max) {
      onChange(newValue);
      setInputText(String(newValue));
    }
  }, [value, step, max, onChange]);

  const handleDecrement = useCallback(() => {
    const current = value ?? 0;
    const newValue = current - step;
    if (min === undefined || newValue >= min) {
      onChange(newValue);
      setInputText(String(newValue));
    }
  }, [value, step, min, onChange]);

  return (
    <View style={styles.container}>
      {/* Botao decrementar */}
      <TouchableOpacity
        style={[
          styles.stepButton,
          {
            backgroundColor: colors.background.secondary,
            borderColor: colors.border.light,
          },
        ]}
        onPress={handleDecrement}
        disabled={readOnly || (min !== undefined && (value ?? 0) <= min)}
      >
        <Ionicons
          name="remove"
          size={20}
          color={readOnly ? colors.text.tertiary : colors.text.primary}
        />
      </TouchableOpacity>

      {/* Input */}
      <TextInput
        style={[
          styles.input,
          {
            borderColor: isFocused ? colors.primary[500] : colors.border.light,
            backgroundColor: readOnly ? colors.background.secondary : colors.background.primary,
            color: colors.text.primary,
          },
        ]}
        value={inputText}
        onChangeText={handleChangeText}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          setIsFocused(false);
          // Formatar ao sair do campo
          if (value !== undefined) {
            setInputText(String(value));
          }
        }}
        placeholder={placeholder || '0'}
        placeholderTextColor={colors.text.tertiary}
        keyboardType="numeric"
        editable={!readOnly}
        textAlign="center"
      />

      {/* Botao incrementar */}
      <TouchableOpacity
        style={[
          styles.stepButton,
          {
            backgroundColor: colors.background.secondary,
            borderColor: colors.border.light,
          },
        ]}
        onPress={handleIncrement}
        disabled={readOnly || (max !== undefined && (value ?? 0) >= max)}
      >
        <Ionicons
          name="add"
          size={20}
          color={readOnly ? colors.text.tertiary : colors.text.primary}
        />
      </TouchableOpacity>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 18,
    fontWeight: '500',
  },
});

export default NumberQuestion;
