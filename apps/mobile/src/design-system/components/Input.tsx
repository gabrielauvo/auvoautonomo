// @ts-nocheck
/**
 * ProDesign Input Component
 *
 * Campo de entrada com suporte a ícones, erros e estados.
 */

import React, { useState } from 'react';
import {
  TextInput,
  TextInputProps,
  View,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useColors } from '../ThemeProvider';
import { spacing, borderRadius, typography } from '../tokens';
import { Text } from './Text';

// =============================================================================
// TYPES
// =============================================================================

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
  disabled?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function Input({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  onRightIconPress,
  disabled = false,
  style,
  ...props
}: InputProps) {
  const colors = useColors();
  const [isFocused, setIsFocused] = useState(false);

  const borderColor = (() => {
    if (error) return colors.error[500];
    if (isFocused) return colors.primary[500];
    return colors.border.default;
  })();

  const backgroundColor = disabled ? colors.background.secondary : colors.background.primary;

  return (
    <View style={styles.container}>
      {label && (
        <Text variant="label" style={styles.label}>
          {label}
        </Text>
      )}

      <View
        style={[
          styles.inputContainer,
          {
            borderColor,
            backgroundColor,
          },
        ]}
      >
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}

        <TextInput
          style={[
            styles.input,
            {
              color: disabled ? colors.text.tertiary : colors.text.primary,
            },
            leftIcon && styles.inputWithLeftIcon,
            rightIcon && styles.inputWithRightIcon,
            style,
          ]}
          placeholderTextColor={colors.text.tertiary}
          editable={!disabled}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />

        {rightIcon && (
          <TouchableOpacity
            style={styles.rightIcon}
            onPress={onRightIconPress}
            disabled={!onRightIconPress}
          >
            {rightIcon}
          </TouchableOpacity>
        )}
      </View>

      {error && (
        <Text variant="caption" color="error" style={styles.error}>
          {error}
        </Text>
      )}

      {hint && !error && (
        <Text variant="caption" color="tertiary" style={styles.hint}>
          {hint}
        </Text>
      )}
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    marginBottom: spacing[1.5],
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    height: 44,
    paddingHorizontal: spacing[3],
    fontSize: typography.fontSize.base,
  },
  inputWithLeftIcon: {
    paddingLeft: 0,
  },
  inputWithRightIcon: {
    paddingRight: 0,
  },
  leftIcon: {
    paddingLeft: spacing[3],
  },
  rightIcon: {
    paddingRight: spacing[3],
  },
  error: {
    marginTop: spacing[1],
  },
  hint: {
    marginTop: spacing[1],
  },
});

export default Input;
