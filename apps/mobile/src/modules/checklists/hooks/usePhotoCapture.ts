// @ts-nocheck
/**
 * usePhotoCapture
 *
 * Hook para captura de fotos usando a câmera ou galeria.
 * - Solicita permissões
 * - Abre câmera ou galeria
 * - Retorna URI da foto
 */

import { useState, useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform } from 'react-native';

// =============================================================================
// TYPES
// =============================================================================

export interface PhotoCaptureOptions {
  allowsEditing?: boolean;
  aspect?: [number, number];
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
}

export interface CapturedPhoto {
  uri: string;
  width: number;
  height: number;
  type?: string;
  fileName?: string;
  fileSize?: number;
}

export interface UsePhotoCaptureReturn {
  isCapturing: boolean;
  error: string | null;
  captureFromCamera: () => Promise<CapturedPhoto | null>;
  pickFromGallery: () => Promise<CapturedPhoto | null>;
  pickMultipleFromGallery: () => Promise<CapturedPhoto[]>;
  requestPermissions: () => Promise<boolean>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_OPTIONS: PhotoCaptureOptions = {
  allowsEditing: false,
  quality: 0.8,
  maxWidth: 1920,
  maxHeight: 1920,
};

// =============================================================================
// HOOK
// =============================================================================

export function usePhotoCapture(
  options: PhotoCaptureOptions = {}
): UsePhotoCaptureReturn {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  // State
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // =============================================================================
  // REQUEST PERMISSIONS
  // =============================================================================

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      // Permissão de câmera
      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
      if (cameraPermission.status !== 'granted') {
        Alert.alert(
          'Permissão Necessária',
          'Para tirar fotos, é necessário permitir o acesso à câmera nas configurações do app.',
          [{ text: 'OK' }]
        );
        return false;
      }

      // Permissão de galeria
      const mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (mediaPermission.status !== 'granted') {
        Alert.alert(
          'Permissão Necessária',
          'Para selecionar fotos, é necessário permitir o acesso à galeria nas configurações do app.',
          [{ text: 'OK' }]
        );
        return false;
      }

      return true;
    } catch (err) {
      console.error('[usePhotoCapture] requestPermissions error:', err);
      setError('Erro ao solicitar permissões');
      return false;
    }
  }, []);

  // =============================================================================
  // CAPTURE FROM CAMERA
  // =============================================================================

  const captureFromCamera = useCallback(async (): Promise<CapturedPhoto | null> => {
    setIsCapturing(true);
    setError(null);

    try {
      // Verificar permissão
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permissão Necessária',
          'Para tirar fotos, é necessário permitir o acesso à câmera.',
          [{ text: 'OK' }]
        );
        return null;
      }

      // Abrir câmera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: mergedOptions.allowsEditing,
        aspect: mergedOptions.aspect,
        quality: mergedOptions.quality,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return null;
      }

      const asset = result.assets[0];
      return {
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        type: asset.mimeType,
        fileName: asset.fileName,
        fileSize: asset.fileSize,
      };
    } catch (err) {
      console.error('[usePhotoCapture] captureFromCamera error:', err);
      setError(err instanceof Error ? err.message : 'Erro ao capturar foto');
      return null;
    } finally {
      setIsCapturing(false);
    }
  }, [mergedOptions]);

  // =============================================================================
  // PICK FROM GALLERY
  // =============================================================================

  const pickFromGallery = useCallback(async (): Promise<CapturedPhoto | null> => {
    setIsCapturing(true);
    setError(null);

    try {
      // Verificar permissão
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permissão Necessária',
          'Para selecionar fotos, é necessário permitir o acesso à galeria.',
          [{ text: 'OK' }]
        );
        return null;
      }

      // Abrir galeria
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: mergedOptions.allowsEditing,
        aspect: mergedOptions.aspect,
        quality: mergedOptions.quality,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return null;
      }

      const asset = result.assets[0];
      return {
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        type: asset.mimeType,
        fileName: asset.fileName,
        fileSize: asset.fileSize,
      };
    } catch (err) {
      console.error('[usePhotoCapture] pickFromGallery error:', err);
      setError(err instanceof Error ? err.message : 'Erro ao selecionar foto');
      return null;
    } finally {
      setIsCapturing(false);
    }
  }, [mergedOptions]);

  // =============================================================================
  // PICK MULTIPLE FROM GALLERY
  // =============================================================================

  const pickMultipleFromGallery = useCallback(async (): Promise<CapturedPhoto[]> => {
    setIsCapturing(true);
    setError(null);

    try {
      // Verificar permissão
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permissão Necessária',
          'Para selecionar fotos, é necessário permitir o acesso à galeria.',
          [{ text: 'OK' }]
        );
        return [];
      }

      // Abrir galeria com seleção múltipla
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: mergedOptions.quality,
        selectionLimit: 10, // Limitar a 10 fotos por vez
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return [];
      }

      return result.assets.map((asset) => ({
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        type: asset.mimeType,
        fileName: asset.fileName,
        fileSize: asset.fileSize,
      }));
    } catch (err) {
      console.error('[usePhotoCapture] pickMultipleFromGallery error:', err);
      setError(err instanceof Error ? err.message : 'Erro ao selecionar fotos');
      return [];
    } finally {
      setIsCapturing(false);
    }
  }, [mergedOptions]);

  // =============================================================================
  // RETURN
  // =============================================================================

  return {
    isCapturing,
    error,
    captureFromCamera,
    pickFromGallery,
    pickMultipleFromGallery,
    requestPermissions,
  };
}

export default usePhotoCapture;
