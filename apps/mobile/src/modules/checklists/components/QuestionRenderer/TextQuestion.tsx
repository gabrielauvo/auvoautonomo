// @ts-nocheck
/**
 * TextQuestion
 *
 * Renderizador para perguntas de texto curto e longo.
 */

import React, { useState, useCallback } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { Text } from '../../../../design-system';
import { useColors } from '../../../../design-system/ThemeProvider';

// =============================================================================
// TYPES
// =============================================================================

export interface TextQuestionProps {
  value?: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  maxLength?: number;
  placeholder?: string;
  readOnly?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function TextQuestion({
  value,
  onChange,
  multiline = false,
  maxLength,
  placeholder,
  readOnly = false,
}: TextQuestionProps) {
  const colors = useColors();
  const [isFocused, setIsFocused] = useState(false);

  const handleChangeText = useCallback(
    (text: string) => {
      if (maxLength && text.length > maxLength) {
        text = text.substring(0, maxLength);
      }
      onChange(text);
    },
    [onChange, maxLength]
  );

  return (
    <View>
      <TextInput
        style={[
          styles.input,
          multiline && styles.multilineInput,
          {
            borderColor: isFocused ? colors.primary[500] : colors.border.light,
            backgroundColor: readOnly ? colors.background.secondary : colors.background.primary,
            color: colors.text.primary,
          },
        ]}
        value={value || ''}
        onChangeText={handleChangeText}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder || (multiline ? 'Digite sua resposta...' : 'Resposta')}
        placeholderTextColor={colors.text.tertiary}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        textAlignVertical={multiline ? 'top' : 'center'}
        editable={!readOnly}
        maxLength={maxLength}
      />
      {maxLength && (
        <Text variant="caption" color="tertiary" style={styles.charCount}>
          {(value || '').length}/{maxLength}
        </Text>
      )}
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  multilineInput: {
    minHeight: 100,
    paddingTop: 12,
  },
  charCount: {
    textAlign: 'right',
    marginTop: 4,
  },
});

export default TextQuestion;
