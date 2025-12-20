// @ts-nocheck
/**
 * DateTimeQuestion
 *
 * Renderizador para perguntas de data/hora.
 */

import React, { useState, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../../../design-system';
import { useColors } from '../../../../design-system/ThemeProvider';

// =============================================================================
// TYPES
// =============================================================================

export interface DateTimeQuestionProps {
  value?: string;
  onChange: (value: string) => void;
  mode: 'date' | 'time' | 'datetime';
  placeholder?: string;
  readOnly?: boolean;
}

// =============================================================================
// HELPERS
// =============================================================================

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateTime(date: Date): string {
  return `${formatDate(date)} ${formatTime(date)}`;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function DateTimeQuestion({
  value,
  onChange,
  mode,
  placeholder,
  readOnly = false,
}: DateTimeQuestionProps) {
  const colors = useColors();
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>(mode === 'time' ? 'time' : 'date');

  // Parse valor atual
  const currentDate = value ? new Date(value) : new Date();

  const handleChange = useCallback(
    (event: any, selectedDate?: Date) => {
      if (Platform.OS === 'android') {
        setShowPicker(false);
      }

      if (event.type === 'dismissed') {
        return;
      }

      if (selectedDate) {
        if (mode === 'datetime' && pickerMode === 'date') {
          // Datetime: primeiro seleciona data, depois hora
          setPickerMode('time');
          // Atualizar data mantendo a hora anterior
          const newDate = new Date(selectedDate);
          if (value) {
            const oldDate = new Date(value);
            newDate.setHours(oldDate.getHours(), oldDate.getMinutes());
          }
          onChange(newDate.toISOString());
          if (Platform.OS === 'android') {
            setShowPicker(true);
          }
        } else {
          // Data ou hora final
          onChange(selectedDate.toISOString());
          if (Platform.OS === 'ios') {
            setShowPicker(false);
          }
          // Reset picker mode para proxima vez
          if (mode === 'datetime') {
            setPickerMode('date');
          }
        }
      }
    },
    [mode, pickerMode, onChange, value]
  );

  const handlePress = useCallback(() => {
    if (!readOnly) {
      if (mode === 'datetime') {
        setPickerMode('date');
      }
      setShowPicker(true);
    }
  }, [readOnly, mode]);

  // Formatar valor para exibicao
  const displayValue = value
    ? mode === 'date'
      ? formatDate(new Date(value))
      : mode === 'time'
      ? formatTime(new Date(value))
      : formatDateTime(new Date(value))
    : null;

  // Icone baseado no modo
  const icon = mode === 'time' ? 'time-outline' : 'calendar-outline';

  return (
    <View>
      <TouchableOpacity
        style={[
          styles.button,
          {
            borderColor: colors.border.light,
            backgroundColor: readOnly ? colors.background.secondary : colors.background.primary,
          },
        ]}
        onPress={handlePress}
        disabled={readOnly}
      >
        <Ionicons name={icon} size={20} color={colors.text.tertiary} />
        <Text
          variant="body"
          style={[
            styles.buttonText,
            { color: displayValue ? colors.text.primary : colors.text.tertiary },
          ]}
        >
          {displayValue || placeholder || 'Selecionar'}
        </Text>
        {!readOnly && (
          <Ionicons name="chevron-down" size={20} color={colors.text.tertiary} />
        )}
      </TouchableOpacity>

      {showPicker && (
        <DateTimePicker
          value={currentDate}
          mode={mode === 'datetime' ? pickerMode : mode}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleChange}
          locale="pt-BR"
        />
      )}
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    gap: 8,
  },
  buttonText: {
    flex: 1,
  },
});

export default DateTimeQuestion;
