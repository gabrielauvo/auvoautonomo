// @ts-nocheck
/**
 * CheckboxQuestion
 *
 * Renderizador para perguntas de checkbox (sim/nao).
 */

import React, { useCallback } from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../../../design-system';
import { useColors } from '../../../../design-system/ThemeProvider';

// =============================================================================
// TYPES
// =============================================================================

export interface CheckboxQuestionProps {
  value?: boolean;
  onChange: (value: boolean) => void;
  label?: string;
  readOnly?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function CheckboxQuestion({
  value,
  onChange,
  label,
  readOnly = false,
}: CheckboxQuestionProps) {
  const colors = useColors();

  const handleToggle = useCallback(() => {
    if (!readOnly) {
      onChange(!value);
    }
  }, [value, onChange, readOnly]);

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handleToggle}
      disabled={readOnly}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.checkbox,
          {
            borderColor: value ? colors.primary[500] : colors.border.medium,
            backgroundColor: value ? colors.primary[500] : 'transparent',
          },
        ]}
      >
        {value && <Ionicons name="checkmark" size={18} color="#FFFFFF" />}
      </View>
      <Text
        variant="body"
        style={[
          styles.label,
          { color: readOnly ? colors.text.tertiary : colors.text.primary },
        ]}
      >
        {label || (value ? 'Sim' : 'Nao')}
      </Text>
    </TouchableOpacity>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginLeft: 12,
  },
});

export default CheckboxQuestion;
