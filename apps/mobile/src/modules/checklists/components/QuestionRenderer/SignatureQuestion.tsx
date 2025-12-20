// @ts-nocheck
/**
 * SignatureQuestion
 *
 * Renderizador para perguntas que requerem assinatura.
 */

import React, { useCallback } from 'react';
import { View, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../../../design-system';
import { useColors } from '../../../../design-system/ThemeProvider';

// =============================================================================
// TYPES
// =============================================================================

export interface SignatureQuestionProps {
  value?: string; // Base64 da assinatura
  onChange: (value: string | undefined) => void;
  onCapture?: () => void;
  readOnly?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function SignatureQuestion({
  value,
  onChange,
  onCapture,
  readOnly = false,
}: SignatureQuestionProps) {
  const colors = useColors();

  const handleCapture = useCallback(() => {
    if (onCapture) {
      onCapture();
    }
  }, [onCapture]);

  const handleClear = useCallback(() => {
    onChange(undefined);
  }, [onChange]);

  // Se tem assinatura, mostrar preview
  if (value) {
    return (
      <View style={styles.container}>
        <View style={[styles.signaturePreview, { borderColor: colors.border.light }]}>
          <Image
            source={{ uri: value.startsWith('data:') ? value : `data:image/png;base64,${value}` }}
            style={styles.signatureImage}
            resizeMode="contain"
          />
        </View>

        {!readOnly && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.background.secondary }]}
              onPress={handleCapture}
            >
              <Ionicons name="create-outline" size={18} color={colors.primary[500]} />
              <Text variant="caption" color="primary" style={{ marginLeft: 4 }}>
                Refazer
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.error[50] }]}
              onPress={handleClear}
            >
              <Ionicons name="trash-outline" size={18} color={colors.error[500]} />
              <Text variant="caption" style={{ marginLeft: 4, color: colors.error[500] }}>
                Limpar
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // Sem assinatura - mostrar botao para capturar
  return (
    <TouchableOpacity
      style={[
        styles.captureButton,
        {
          borderColor: colors.border.medium,
          backgroundColor: colors.background.secondary,
        },
      ]}
      onPress={handleCapture}
      disabled={readOnly}
    >
      <Ionicons name="create-outline" size={32} color={colors.primary[500]} />
      <Text variant="body" color="primary" style={{ marginTop: 8 }}>
        Toque para assinar
      </Text>
      <Text variant="caption" color="tertiary" style={{ marginTop: 4 }}>
        Use o dedo para desenhar sua assinatura
      </Text>
    </TouchableOpacity>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  signaturePreview: {
    height: 150,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  signatureImage: {
    width: '100%',
    height: '100%',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  captureButton: {
    height: 150,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default SignatureQuestion;
