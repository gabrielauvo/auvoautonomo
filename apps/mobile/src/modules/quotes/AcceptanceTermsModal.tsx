/**
 * AcceptanceTermsModal
 *
 * Modal para exibir os termos de aceite do orcamento.
 * O cliente deve ler e aceitar os termos antes de assinar.
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../design-system/components/Text';
import { colors, spacing, borderRadius, shadows } from '../../design-system/tokens';
import { useTranslation } from '../../i18n';

// =============================================================================
// TYPES
// =============================================================================

export interface AcceptanceTermsData {
  required: boolean;
  termsContent: string | null;
  version: number;
  termsHash: string | null;
}

interface AcceptanceTermsModalProps {
  visible: boolean;
  termsData: AcceptanceTermsData | null;
  onAccept: () => void;
  onCancel: () => void;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const AcceptanceTermsModal: React.FC<AcceptanceTermsModalProps> = ({
  visible,
  termsData,
  onAccept,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [isAccepted, setIsAccepted] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Reset state when modal opens
  React.useEffect(() => {
    if (visible) {
      setHasScrolledToBottom(false);
      setIsAccepted(false);
    }
  }, [visible]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
      const paddingToBottom = 50;
      const isAtBottom =
        layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;

      if (isAtBottom && !hasScrolledToBottom) {
        setHasScrolledToBottom(true);
      }
    },
    [hasScrolledToBottom]
  );

  const handleAccept = () => {
    if (hasScrolledToBottom && isAccepted) {
      onAccept();
    }
  };

  const canAccept = hasScrolledToBottom && isAccepted;

  if (!termsData?.termsContent) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCancel}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onCancel}>
            <Ionicons name="close" size={24} color={colors.text.secondary} />
          </TouchableOpacity>
          <Text variant="h4" weight="bold" style={styles.headerTitle}>
            {t('quotes.acceptanceTermsTitle') || 'Termos de Aceite'}
          </Text>
          <View style={styles.headerRight} />
        </View>

        {/* Instructions */}
        <View style={styles.instructions}>
          <Ionicons name="document-text-outline" size={24} color={colors.primary[600]} />
          <Text variant="bodySmall" color="secondary" style={styles.instructionsText}>
            {t('quotes.acceptanceTermsInstructions') ||
              'Leia atentamente os termos abaixo. Voce deve rolar ate o final para poder aceitar.'}
          </Text>
        </View>

        {/* Terms Content */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={true}
        >
          <Text variant="body" style={styles.termsText}>
            {termsData.termsContent}
          </Text>

          {/* Scroll indicator at bottom */}
          {!hasScrolledToBottom && (
            <View style={styles.scrollIndicator}>
              <Ionicons name="chevron-down" size={20} color={colors.gray[400]} />
              <Text variant="caption" color="tertiary">
                {t('quotes.scrollToRead') || 'Role para ler todos os termos'}
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Acceptance Checkbox */}
        <View style={styles.acceptanceSection}>
          <TouchableOpacity
            style={[
              styles.checkbox,
              !hasScrolledToBottom && styles.checkboxDisabled,
              isAccepted && styles.checkboxChecked,
            ]}
            onPress={() => hasScrolledToBottom && setIsAccepted(!isAccepted)}
            disabled={!hasScrolledToBottom}
          >
            {isAccepted && <Ionicons name="checkmark" size={16} color={colors.white} />}
          </TouchableOpacity>
          <Text
            variant="bodySmall"
            color={hasScrolledToBottom ? 'primary' : 'tertiary'}
            style={styles.acceptanceText}
          >
            {t('quotes.acceptTermsCheckbox') ||
              'Li e aceito os termos e condicoes apresentados acima'}
          </Text>
        </View>

        {/* Version info */}
        {termsData.version > 0 && (
          <View style={styles.versionInfo}>
            <Text variant="caption" color="tertiary">
              {t('quotes.termsVersion') || 'Versao'}: {termsData.version}
            </Text>
          </View>
        )}

        {/* Footer Buttons */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text variant="body" weight="semibold" style={{ color: colors.gray[600] }}>
              {t('common.cancel') || 'Cancelar'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.acceptButton, !canAccept && styles.acceptButtonDisabled]}
            onPress={handleAccept}
            disabled={!canAccept}
          >
            <Ionicons
              name="checkmark-circle"
              size={20}
              color={canAccept ? colors.white : colors.gray[400]}
            />
            <Text
              variant="body"
              weight="bold"
              style={{
                color: canAccept ? colors.white : colors.gray[400],
                marginLeft: spacing[2],
              }}
            >
              {t('quotes.acceptAndContinue') || 'Aceitar e Continuar'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  closeButton: {
    padding: spacing[2],
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
  instructions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: colors.primary[50],
    borderBottomWidth: 1,
    borderBottomColor: colors.primary[100],
  },
  instructionsText: {
    flex: 1,
    marginLeft: spacing[3],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing[4],
    paddingBottom: spacing[8],
  },
  termsText: {
    lineHeight: 24,
    color: colors.text.primary,
  },
  scrollIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing[4],
    gap: spacing[2],
  },
  acceptanceSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    backgroundColor: colors.background.secondary,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.gray[300],
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  checkboxDisabled: {
    borderColor: colors.gray[200],
    backgroundColor: colors.gray[100],
  },
  checkboxChecked: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  acceptanceText: {
    flex: 1,
  },
  versionInfo: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[2],
    backgroundColor: colors.background.secondary,
  },
  footer: {
    flexDirection: 'row',
    padding: spacing[4],
    gap: spacing[3],
    backgroundColor: colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    ...shadows.lg,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing[4],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray[100],
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  acceptButton: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: spacing[4],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success[600],
    ...shadows.sm,
  },
  acceptButtonDisabled: {
    backgroundColor: colors.gray[200],
  },
});

export default AcceptanceTermsModal;
