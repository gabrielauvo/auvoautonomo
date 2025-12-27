/**
 * SignaturePad
 *
 * Componente de captura de assinatura digital.
 * Suporta captura em canvas com preview, clear, e exportação como base64 PNG.
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  SafeAreaView,
  TextInput,
  Alert,
  Dimensions,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import {
  Svg,
  Path,
  G,
  Rect,
} from 'react-native-svg';
import {
  PanGestureHandler,
  PanGestureHandlerGestureEvent,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import ViewShot from 'react-native-view-shot';
import { SIGNER_ROLES, SignerRole, validateSignature } from '../SignatureSyncConfig';
import { useTranslation } from '../../../i18n';

// =============================================================================
// TYPES
// =============================================================================

export interface SignatureData {
  signerName: string;
  signerDocument?: string;
  signerRole: SignerRole;
  signatureBase64: string;
  timestamp: string;
}

export interface SignaturePadProps {
  visible: boolean;
  onClose: () => void;
  onCapture: (data: SignatureData) => void;
  defaultSignerName?: string;
  defaultSignerRole?: SignerRole;
  requireDocument?: boolean;
  title?: string;
}

interface Point {
  x: number;
  y: number;
}

interface PathData {
  points: Point[];
  color: string;
  strokeWidth: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const STROKE_COLOR = '#000000';
const STROKE_WIDTH = 3;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CANVAS_WIDTH = SCREEN_WIDTH - 32;
const CANVAS_HEIGHT = Math.min(250, SCREEN_HEIGHT * 0.3);

// =============================================================================
// SIGNATURE CANVAS COMPONENT
// =============================================================================

interface SignatureCanvasProps {
  paths: PathData[];
  currentPath: PathData | null;
  onPathsChange: (paths: PathData[]) => void;
  onCurrentPathChange: (path: PathData | null) => void;
  width: number;
  height: number;
  viewShotRef: React.RefObject<ViewShot>;
  onDrawStart?: () => void;
  onDrawEnd?: () => void;
  signHereLabel: string;
}

const SignatureCanvas: React.FC<SignatureCanvasProps> = ({
  paths,
  currentPath,
  onPathsChange,
  onCurrentPathChange,
  width,
  height,
  viewShotRef,
  onDrawStart,
  onDrawEnd,
  signHereLabel,
}) => {
  const handleGestureStart = useCallback(() => {
    onDrawStart?.();
  }, [onDrawStart]);

  const handleGestureEvent = useCallback(
    (event: PanGestureHandlerGestureEvent) => {
      const { x, y } = event.nativeEvent;

      if (x < 0 || x > width || y < 0 || y > height) {
        // Out of bounds - finish current path
        if (currentPath && currentPath.points.length > 0) {
          onPathsChange([...paths, currentPath]);
          onCurrentPathChange(null);
        }
        return;
      }

      const point: Point = { x, y };

      if (!currentPath) {
        // Start new path
        onCurrentPathChange({
          points: [point],
          color: STROKE_COLOR,
          strokeWidth: STROKE_WIDTH,
        });
      } else {
        // Continue path
        onCurrentPathChange({
          ...currentPath,
          points: [...currentPath.points, point],
        });
      }
    },
    [currentPath, paths, onPathsChange, onCurrentPathChange, width, height]
  );

  const handleGestureEnd = useCallback(() => {
    if (currentPath && currentPath.points.length > 0) {
      onPathsChange([...paths, currentPath]);
      onCurrentPathChange(null);
    }
    onDrawEnd?.();
  }, [currentPath, paths, onPathsChange, onCurrentPathChange, onDrawEnd]);

  const pathToSvgPath = (pathData: PathData): string => {
    if (pathData.points.length === 0) return '';
    if (pathData.points.length === 1) {
      const p = pathData.points[0];
      return `M ${p.x} ${p.y} L ${p.x + 0.1} ${p.y + 0.1}`;
    }

    let d = `M ${pathData.points[0].x} ${pathData.points[0].y}`;
    for (let i = 1; i < pathData.points.length; i++) {
      const p = pathData.points[i];
      d += ` L ${p.x} ${p.y}`;
    }
    return d;
  };

  return (
    <GestureHandlerRootView style={{ width, height }}>
      <PanGestureHandler
        onGestureEvent={handleGestureEvent}
        onBegan={handleGestureStart}
        onEnded={handleGestureEnd}
        onCancelled={handleGestureEnd}
        onFailed={handleGestureEnd}
      >
        <View style={[styles.canvas, { width, height }]}>
          {/* ViewShot para capturar a assinatura como PNG */}
          <ViewShot
            ref={viewShotRef}
            options={{ format: 'png', quality: 1, result: 'base64' }}
            style={{ width, height, backgroundColor: 'white' }}
          >
            <Svg width={width} height={height}>
              {/* Fundo branco */}
              <Rect x="0" y="0" width={width} height={height} fill="white" />
              <G>
                {/* Existing paths */}
                {paths.map((pathData, index) => (
                  <Path
                    key={`path-${index}`}
                    d={pathToSvgPath(pathData)}
                    stroke={pathData.color}
                    strokeWidth={pathData.strokeWidth}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}

                {/* Current path */}
                {currentPath && (
                  <Path
                    d={pathToSvgPath(currentPath)}
                    stroke={currentPath.color}
                    strokeWidth={currentPath.strokeWidth}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
              </G>
            </Svg>
          </ViewShot>

          {/* Signing line - overlay */}
          <View style={styles.signLine} />
          <Text style={styles.signLineLabel}>{signHereLabel}</Text>
        </View>
      </PanGestureHandler>
    </GestureHandlerRootView>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const SignaturePad: React.FC<SignaturePadProps> = ({
  visible,
  onClose,
  onCapture,
  defaultSignerName = '',
  defaultSignerRole = SIGNER_ROLES.CLIENT,
  requireDocument = false,
  title,
}) => {
  const { t } = useTranslation();

  // Refs
  const viewShotRef = useRef<ViewShot>(null);

  // State
  const [paths, setPaths] = useState<PathData[]>([]);
  const [currentPath, setCurrentPath] = useState<PathData | null>(null);
  const [signerName, setSignerName] = useState(defaultSignerName);
  const [signerDocument, setSignerDocument] = useState('');
  const [signerRole, setSignerRole] = useState<SignerRole>(defaultSignerRole);
  const [errors, setErrors] = useState<string[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  // Use translated title if not provided
  const displayTitle = title || t('signature.title');

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setPaths([]);
      setCurrentPath(null);
      setSignerName(defaultSignerName);
      setSignerDocument('');
      setSignerRole(defaultSignerRole);
      setErrors([]);
      setIsDrawing(false);
    }
  }, [visible, defaultSignerName, defaultSignerRole]);

  // Handlers for drawing state
  const handleDrawStart = useCallback(() => {
    setIsDrawing(true);
  }, []);

  const handleDrawEnd = useCallback(() => {
    setIsDrawing(false);
  }, []);

  // Clear signature
  const handleClear = useCallback(() => {
    setPaths([]);
    setCurrentPath(null);
  }, []);

  // Capture signature
  const handleCapture = useCallback(async () => {
    // Validate
    const newErrors: string[] = [];

    if (!signerName.trim() || signerName.trim().length < 2) {
      newErrors.push(t('signature.nameRequired'));
    }

    if (requireDocument && !signerDocument.trim()) {
      newErrors.push(t('signature.documentRequired'));
    }

    if (paths.length === 0) {
      newErrors.push(t('signature.signatureRequired'));
    }

    if (newErrors.length > 0) {
      setErrors(newErrors);
      return;
    }

    // Capture signature as PNG base64 using ViewShot
    const signatureBase64 = await exportSignatureAsBase64();

    const data: SignatureData = {
      signerName: signerName.trim(),
      signerDocument: signerDocument.trim() || undefined,
      signerRole,
      signatureBase64,
      timestamp: new Date().toISOString(),
    };

    onCapture(data);
    onClose();
  }, [signerName, signerDocument, signerRole, paths, requireDocument, onCapture, onClose]);

  // Export signature as base64 PNG using ViewShot
  const exportSignatureAsBase64 = async (): Promise<string> => {
    try {
      if (!viewShotRef.current) {
        throw new Error('ViewShot ref not available');
      }

      // Capture the view as PNG base64
      const base64 = await viewShotRef.current.capture?.();
      if (!base64) {
        throw new Error('Failed to capture signature');
      }

      return `data:image/png;base64,${base64}`;
    } catch (error) {
      console.error('[SignaturePad] Error capturing signature:', error);
      throw error;
    }
  };

  // Close handler
  const handleClose = useCallback(() => {
    if (paths.length > 0) {
      Alert.alert(
        t('signature.discardSignatureTitle'),
        t('signature.discardSignatureMessage'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('signature.discard'), style: 'destructive', onPress: onClose },
        ]
      );
    } else {
      onClose();
    }
  }, [paths.length, onClose, t]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>{displayTitle}</Text>
          <View style={styles.placeholder} />
        </View>

        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            scrollEnabled={!isDrawing}
          >
            {/* Form */}
            <View style={styles.form}>
              {/* Signer Name */}
              <View style={styles.field}>
                <Text style={styles.label}>{t('signature.signerNameLabel')} *</Text>
                <TextInput
                  style={styles.input}
                  value={signerName}
                  onChangeText={setSignerName}
                  placeholder={t('signature.enterFullName')}
                  autoCapitalize="words"
                />
              </View>

              {/* Signer Document */}
              <View style={styles.field}>
                <Text style={styles.label}>
                  {t('signature.documentLabel')} {requireDocument ? '*' : t('signature.optional')}
                </Text>
                <TextInput
                  style={styles.input}
                  value={signerDocument}
                  onChangeText={setSignerDocument}
                  placeholder={t('signature.enterDocument')}
                  keyboardType="default"
                />
              </View>

              {/* Signer Role */}
              <View style={styles.field}>
                <Text style={styles.label}>{t('signature.roleLabel')} *</Text>
                <View style={styles.roleOptions}>
                  {Object.values(SIGNER_ROLES).map((role) => (
                    <TouchableOpacity
                      key={role}
                      style={[
                        styles.roleButton,
                        signerRole === role && styles.roleButtonSelected,
                      ]}
                      onPress={() => setSignerRole(role)}
                    >
                      <Text
                        style={[
                          styles.roleButtonText,
                          signerRole === role && styles.roleButtonTextSelected,
                        ]}
                      >
                        {role}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* Errors */}
            {errors.length > 0 && (
              <View style={styles.errorsContainer}>
                {errors.map((error, index) => (
                  <Text key={index} style={styles.errorText}>
                    • {error}
                  </Text>
                ))}
              </View>
            )}

            {/* Signature Canvas */}
            <View style={styles.canvasContainer}>
              <Text style={styles.canvasLabel}>{t('signature.signatureLabel')} *</Text>
              <SignatureCanvas
                paths={paths}
                currentPath={currentPath}
                onPathsChange={setPaths}
                onCurrentPathChange={setCurrentPath}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                viewShotRef={viewShotRef}
                onDrawStart={handleDrawStart}
                onDrawEnd={handleDrawEnd}
                signHereLabel={t('signature.signHere')}
              />
              <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
                <Text style={styles.clearButtonText}>{t('signature.clearSignature')}</Text>
              </TouchableOpacity>
            </View>

            {/* Actions - dentro do ScrollView */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={handleClose}
              >
                <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.confirmButton]}
                onPress={handleCapture}
              >
                <Text style={styles.confirmButtonText}>{t('signature.confirmSignature')}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: '#666',
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  placeholder: {
    width: 40,
  },
  form: {
    padding: 16,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  roleOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  roleButtonSelected: {
    borderColor: '#7C3AED',
    backgroundColor: '#F3E8FF',
  },
  roleButtonText: {
    fontSize: 14,
    color: '#666',
  },
  roleButtonTextSelected: {
    color: '#7C3AED',
    fontWeight: '600',
  },
  errorsContainer: {
    marginHorizontal: 16,
    padding: 12,
    backgroundColor: '#ffebee',
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#c62828',
    marginBottom: 4,
  },
  canvasContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  canvasLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  canvas: {
    backgroundColor: '#fafafa',
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 8,
    borderStyle: 'dashed',
    position: 'relative',
    overflow: 'hidden',
  },
  signLine: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: '#ccc',
  },
  signLineLabel: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 12,
    color: '#999',
  },
  clearButton: {
    alignSelf: 'flex-end',
    marginTop: 8,
    padding: 8,
  },
  clearButtonText: {
    fontSize: 14,
    color: '#e74c3c',
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  button: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#7C3AED',
  },
  confirmButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});

export default SignaturePad;
