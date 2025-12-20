// @ts-nocheck
/**
 * QuoteSignatureScreen
 *
 * Tela para coletar assinatura digital do cliente em um orçamento.
 * Quando assinado, o orçamento é automaticamente aprovado.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../design-system/components/Text';
import { Card } from '../../design-system/components/Card';
import { colors, spacing, borderRadius, shadows } from '../../design-system/tokens';
import { QuoteWithItems } from './QuoteService';
import { QuoteSignatureService } from './QuoteSignatureService';
import { SignaturePad, SignatureData } from '../checklists/components/SignaturePad';
import { useTranslation } from '../../i18n';

// =============================================================================
// TYPES
// =============================================================================

interface QuoteSignatureScreenProps {
  quote: QuoteWithItems;
  onSignatureComplete?: (quoteId: string) => void;
  onCancel?: () => void;
}

// =============================================================================
// HELPERS
// =============================================================================

function formatCurrency(value: number, locale: string): string {
  const currency = locale === 'pt-BR' ? 'BRL' : locale === 'es' ? 'EUR' : 'USD';
  return new Intl.NumberFormat(locale === 'pt-BR' ? 'pt-BR' : locale === 'es' ? 'es-ES' : 'en-US', {
    style: 'currency',
    currency,
  }).format(value);
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const QuoteSignatureScreen: React.FC<QuoteSignatureScreenProps> = ({
  quote,
  onSignatureComplete,
  onCancel,
}) => {
  const { t, locale } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [signaturePadVisible, setSignaturePadVisible] = useState(false);

  const handleOpenSignaturePad = () => {
    setSignaturePadVisible(true);
  };

  const handleSignatureCapture = async (data: SignatureData) => {
    try {
      setLoading(true);

      // Criar assinatura usando o service
      await QuoteSignatureService.createSignature({
        quoteId: quote.id,
        signerName: data.signerName,
        signerDocument: data.signerDocument,
        signerRole: data.signerRole,
        signatureBase64: data.signatureBase64,
      });

      Alert.alert(
        t('quotes.signatureSuccess') || 'Assinatura Coletada',
        t('quotes.signatureSuccessMessage') || 'O orçamento foi aprovado com sucesso!',
        [
          {
            text: 'OK',
            onPress: () => onSignatureComplete?.(quote.id),
          },
        ]
      );
    } catch (error: any) {
      console.error('[QuoteSignatureScreen] Error saving signature:', error);
      Alert.alert(
        t('common.error'),
        error.message || t('quotes.signatureError') || 'Erro ao salvar assinatura'
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text variant="body" color="secondary" style={{ marginTop: spacing[4] }}>
          {t('quotes.savingSignature') || 'Salvando assinatura...'}
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text variant="h4" weight="bold" style={styles.headerTitle}>
          {t('quotes.collectSignature') || 'Coletar Assinatura'}
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Quote Summary */}
        <Card variant="elevated" style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View style={styles.summaryIcon}>
              <Ionicons name="document-text-outline" size={24} color={colors.primary[600]} />
            </View>
            <View style={styles.summaryInfo}>
              <Text variant="caption" color="secondary">
                {t('quotes.quote') || 'Orçamento'}
              </Text>
              <Text variant="body" weight="semibold">
                {quote.clientName || t('quotes.client') || 'Cliente'}
              </Text>
            </View>
          </View>

          <View style={styles.summaryDivider} />

          {/* Items Summary */}
          <View style={styles.itemsSummary}>
            <Text variant="caption" color="secondary" style={styles.itemsSummaryTitle}>
              {t('quotes.items') || 'Itens'} ({quote.items.length})
            </Text>
            {quote.items.slice(0, 3).map((item, index) => (
              <View key={item.id} style={styles.itemRow}>
                <Text variant="bodySmall" numberOfLines={1} style={styles.itemName}>
                  {item.quantity}x {item.name}
                </Text>
                <Text variant="bodySmall" weight="semibold">
                  {formatCurrency(item.totalPrice, locale)}
                </Text>
              </View>
            ))}
            {quote.items.length > 3 && (
              <Text variant="caption" color="tertiary" style={styles.moreItems}>
                +{quote.items.length - 3} {t('quotes.moreItems') || 'mais itens'}
              </Text>
            )}
          </View>

          <View style={styles.summaryDivider} />

          {/* Total */}
          <View style={styles.totalRow}>
            <Text variant="body" weight="bold">
              {t('common.total') || 'Total'}
            </Text>
            <Text variant="h3" weight="bold" style={{ color: colors.success[600] }}>
              {formatCurrency(quote.totalValue, locale)}
            </Text>
          </View>
        </Card>

        {/* Terms */}
        <Card style={styles.termsCard}>
          <Ionicons name="information-circle-outline" size={20} color={colors.primary[600]} />
          <View style={styles.termsContent}>
            <Text variant="bodySmall" weight="semibold" color="primary">
              {t('quotes.signatureTermsTitle') || 'Termos da Assinatura'}
            </Text>
            <Text variant="caption" color="secondary" style={styles.termsText}>
              {t('quotes.signatureTermsMessage') ||
                'Ao assinar este documento, você declara que leu e concorda com os termos do orçamento apresentado. A assinatura digital tem valor legal.'}
            </Text>
          </View>
        </Card>

        {/* Instructions */}
        <View style={styles.instructions}>
          <Text variant="body" weight="semibold" align="center">
            {t('quotes.signatureInstructions') || 'Peça ao cliente para assinar o orçamento'}
          </Text>
          <Text variant="bodySmall" color="secondary" align="center" style={styles.instructionsSubtext}>
            {t('quotes.signatureInstructionsSubtext') ||
              'A assinatura será salva localmente e sincronizada quando houver conexão'}
          </Text>
        </View>
      </ScrollView>

      {/* Footer with Sign Button */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text variant="body" weight="semibold" style={{ color: colors.gray[600] }}>
            {t('common.cancel') || 'Cancelar'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.signButton} onPress={handleOpenSignaturePad}>
          <Ionicons name="create-outline" size={20} color={colors.white} />
          <Text variant="body" weight="bold" style={{ color: colors.white, marginLeft: spacing[2] }}>
            {t('quotes.sign') || 'Assinar Agora'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Signature Pad Modal */}
      <SignaturePad
        visible={signaturePadVisible}
        onClose={() => setSignaturePadVisible(false)}
        onCapture={handleSignatureCapture}
        defaultSignerName=""
        defaultSignerRole="Cliente"
        requireDocument={false}
        title={t('quotes.clientSignature') || 'Assinatura do Cliente'}
      />
    </SafeAreaView>
  );
};

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  backButton: {
    padding: spacing[2],
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing[4],
    paddingBottom: spacing[20],
  },
  summaryCard: {
    marginBottom: spacing[3],
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  summaryInfo: {
    flex: 1,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.border.light,
    marginVertical: spacing[3],
  },
  itemsSummary: {
    gap: spacing[2],
  },
  itemsSummaryTitle: {
    marginBottom: spacing[1],
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemName: {
    flex: 1,
    marginRight: spacing[2],
  },
  moreItems: {
    textAlign: 'center',
    marginTop: spacing[1],
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  termsCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing[4],
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[100],
  },
  termsContent: {
    flex: 1,
    marginLeft: spacing[3],
  },
  termsText: {
    marginTop: spacing[1],
    lineHeight: 18,
  },
  instructions: {
    paddingVertical: spacing[4],
  },
  instructionsSubtext: {
    marginTop: spacing[2],
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
  signButton: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: spacing[4],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success[600],
    ...shadows.sm,
  },
});

export default QuoteSignatureScreen;
