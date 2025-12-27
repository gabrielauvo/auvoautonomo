/**
 * SignatureSection
 *
 * Componente para exibir e capturar assinatura de finalização de OS.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Text } from '../../../design-system/components/Text';
import { Card } from '../../../design-system/components/Card';
import { colors, spacing, borderRadius } from '../../../design-system/tokens';
import { SignaturePad, SignatureData } from '../../checklists/components/SignaturePad';
import { WorkOrderSignatureService } from '../services/WorkOrderSignatureService';
import { Signature } from '../../../db/schema';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '../../../i18n';

// =============================================================================
// TYPES
// =============================================================================

interface SignatureSectionProps {
  workOrderId: string;
  clientId: string;
  clientName?: string;
  status: string;
  onSignatureCaptured?: (signature: Signature) => void;
  readOnly?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function SignatureSection({
  workOrderId,
  clientId,
  clientName,
  status,
  onSignatureCaptured,
  readOnly = false,
}: SignatureSectionProps) {
  const { t } = useTranslation();
  const [signature, setSignature] = useState<Signature | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPad, setShowPad] = useState(false);
  const [saving, setSaving] = useState(false);

  // Carregar assinatura existente
  useEffect(() => {
    loadSignature();
  }, [workOrderId]);

  const loadSignature = useCallback(async () => {
    try {
      setLoading(true);
      const existing = await WorkOrderSignatureService.getSignature(workOrderId);
      setSignature(existing);
    } catch (error) {
      console.error('[SignatureSection] Error loading signature:', error);
    } finally {
      setLoading(false);
    }
  }, [workOrderId]);

  // Capturar assinatura
  const handleCapture = useCallback(async (data: SignatureData) => {
    try {
      setSaving(true);

      const newSignature = await WorkOrderSignatureService.captureSignature({
        workOrderId,
        clientId,
        signerName: data.signerName,
        signerDocument: data.signerDocument,
        signerRole: data.signerRole,
        signatureBase64: data.signatureBase64,
      });

      setSignature(newSignature);
      onSignatureCaptured?.(newSignature);

      Alert.alert(t('common.success'), t('workOrders.signatureCaptured'));
    } catch (error) {
      console.error('[SignatureSection] Error capturing signature:', error);
      Alert.alert(t('common.error'), t('workOrders.signatureSaveError'));
    } finally {
      setSaving(false);
      setShowPad(false);
    }
  }, [workOrderId, clientId, onSignatureCaptured, t]);

  // Deletar assinatura (apenas se não sincronizada)
  const handleDelete = useCallback(async () => {
    if (!signature) return;

    if (signature.syncedAt) {
      Alert.alert(t('workOrders.warning'), t('workOrders.cannotDeleteSyncedSignature'));
      return;
    }

    Alert.alert(
      t('workOrders.deleteSignature'),
      t('workOrders.deleteSignatureConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await WorkOrderSignatureService.deleteSignature(signature.id);
              setSignature(null);
            } catch (error) {
              Alert.alert(t('common.error'), t('workOrders.signatureDeleteError'));
            }
          },
        },
      ]
    );
  }, [signature, t]);

  // Renderizar estado de carregamento
  if (loading) {
    return (
      <Card style={styles.card}>
        <View style={styles.header}>
          <Text variant="subtitle" weight="semibold">{t('signature.title')}</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary[500]} />
        </View>
      </Card>
    );
  }

  // OS concluída ou cancelada - apenas visualização
  const isCompleted = status === 'DONE' || status === 'CANCELED';
  const canCapture = !readOnly && !isCompleted && !signature;
  const canDelete = !readOnly && signature && !signature.syncedAt && !isCompleted;

  return (
    <>
      <Card style={styles.card}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="create-outline" size={20} color={colors.gray[600]} />
            <Text variant="subtitle" weight="semibold" style={styles.headerTitle}>
              {t('signature.title')}
            </Text>
          </View>
          {signature?.syncedAt && (
            <View style={styles.syncBadge}>
              <Ionicons name="cloud-done" size={14} color={colors.success[600]} />
              <Text variant="caption" color="success" style={styles.syncText}>
                {t('workOrders.synced')}
              </Text>
            </View>
          )}
          {signature && !signature.syncedAt && (
            <View style={[styles.syncBadge, styles.pendingBadge]}>
              <Ionicons name="cloud-offline" size={14} color={colors.warning[600]} />
              <Text variant="caption" style={[styles.syncText, { color: colors.warning[600] }]}>
                {t('common.pending')}
              </Text>
            </View>
          )}
        </View>

        {/* Assinatura existente */}
        {signature ? (
          <View style={styles.signatureContainer}>
            {/* Preview da assinatura */}
            <View style={styles.signaturePreview}>
              {signature.signatureBase64 ? (
                <Image
                  source={{ uri: `data:image/png;base64,${signature.signatureBase64}` }}
                  style={styles.signatureImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.noImagePlaceholder}>
                  <Ionicons name="image-outline" size={32} color={colors.gray[400]} />
                  <Text variant="caption" color="tertiary">{t('workOrders.imageNotAvailable')}</Text>
                </View>
              )}
            </View>

            {/* Informações do assinante */}
            <View style={styles.signerInfo}>
              <View style={styles.infoRow}>
                <Ionicons name="person-outline" size={16} color={colors.gray[500]} />
                <Text variant="body" style={styles.infoText}>{signature.signerName}</Text>
              </View>
              {signature.signerDocument && (
                <View style={styles.infoRow}>
                  <Ionicons name="card-outline" size={16} color={colors.gray[500]} />
                  <Text variant="caption" color="secondary" style={styles.infoText}>
                    {signature.signerDocument}
                  </Text>
                </View>
              )}
              <View style={styles.infoRow}>
                <Ionicons name="briefcase-outline" size={16} color={colors.gray[500]} />
                <Text variant="caption" color="secondary" style={styles.infoText}>
                  {signature.signerRole}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="time-outline" size={16} color={colors.gray[500]} />
                <Text variant="caption" color="tertiary" style={styles.infoText}>
                  {new Date(signature.signedAt).toLocaleString('pt-BR')}
                </Text>
              </View>
            </View>

            {/* Botão de excluir */}
            {canDelete && (
              <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={18} color={colors.error[500]} />
                <Text variant="caption" style={{ color: colors.error[500], marginLeft: 4 }}>
                  {t('common.delete')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          // Sem assinatura - mostrar botão de captura
          <View style={styles.emptyContainer}>
            {canCapture ? (
              <>
                <Ionicons name="create" size={48} color={colors.gray[300]} />
                <Text variant="body" color="secondary" style={styles.emptyText}>
                  {t('workOrders.noSignatureCollected')}
                </Text>
                <TouchableOpacity
                  style={styles.captureButton}
                  onPress={() => setShowPad(true)}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <>
                      <Ionicons name="pencil" size={18} color={colors.white} />
                      <Text variant="body" weight="semibold" style={styles.captureButtonText}>
                        {t('workOrders.collectSignature')}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Ionicons name="create-outline" size={48} color={colors.gray[300]} />
                <Text variant="body" color="tertiary" style={styles.emptyText}>
                  {isCompleted
                    ? t('workOrders.completedWithoutSignature')
                    : t('workOrders.signatureNotAvailable')}
                </Text>
              </>
            )}
          </View>
        )}
      </Card>

      {/* Modal de captura de assinatura */}
      <SignaturePad
        visible={showPad}
        onClose={() => setShowPad(false)}
        onCapture={handleCapture}
        defaultSignerName={clientName || ''}
        defaultSignerRole="Cliente"
        requireDocument={false}
        title={t('workOrders.finalizationSignature')}
      />
    </>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing[4],
    padding: spacing[4],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    marginLeft: spacing[2],
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success[50],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
  },
  pendingBadge: {
    backgroundColor: colors.warning[50],
  },
  syncText: {
    marginLeft: 4,
  },
  loadingContainer: {
    padding: spacing[6],
    alignItems: 'center',
  },
  signatureContainer: {
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
    paddingTop: spacing[3],
  },
  signaturePreview: {
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.lg,
    padding: spacing[2],
    marginBottom: spacing[3],
    alignItems: 'center',
    minHeight: 120,
    justifyContent: 'center',
  },
  signatureImage: {
    width: '100%',
    height: 100,
  },
  noImagePlaceholder: {
    alignItems: 'center',
    padding: spacing[4],
  },
  signerInfo: {
    gap: spacing[2],
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    marginLeft: spacing[2],
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[2],
    marginTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
  },
  emptyContainer: {
    alignItems: 'center',
    padding: spacing[6],
  },
  emptyText: {
    marginTop: spacing[2],
    marginBottom: spacing[4],
    textAlign: 'center',
  },
  captureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
  },
  captureButtonText: {
    color: colors.white,
    marginLeft: spacing[2],
  },
});

export default SignatureSection;
