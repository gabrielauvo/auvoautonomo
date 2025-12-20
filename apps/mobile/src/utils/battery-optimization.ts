/**
 * Battery & Network Optimization
 *
 * Otimizações para economizar bateria e dados móveis em apps com 1M+ usuários.
 *
 * Features:
 * - Detecção de tipo de conexão (WiFi, Cellular, None)
 * - Sync adaptativo baseado no tipo de rede
 * - Redução de polling quando em background
 * - Configurações de economia de bateria
 */

import NetInfo, { NetInfoState, NetInfoStateType } from '@react-native-community/netinfo';
import { AppState, AppStateStatus } from 'react-native';

// =============================================================================
// TYPES
// =============================================================================

export type NetworkType = 'wifi' | 'cellular' | 'none' | 'unknown';
export type BatteryMode = 'normal' | 'saver' | 'extreme';

export interface NetworkInfo {
  type: NetworkType;
  isConnected: boolean;
  isInternetReachable: boolean | null;
  isExpensive: boolean; // Cellular é "caro" em termos de dados
}

export interface BatteryOptimizationConfig {
  // Sync intervals (em ms)
  wifiSyncInterval: number; // WiFi: sync frequente
  cellularSyncInterval: number; // Cellular: sync menos frequente
  backgroundSyncInterval: number; // Background: muito menos frequente

  // Upload configs
  allowCellularUpload: boolean; // Permitir upload em dados móveis
  maxCellularUploadSizeMB: number; // Tamanho máximo de upload em cellular

  // Imagem configs
  downloadImagesOnCellular: boolean; // Baixar imagens em dados móveis
  compressImagesOnCellular: boolean; // Comprimir mais em dados móveis
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_CONFIG: BatteryOptimizationConfig = {
  // Sync intervals
  wifiSyncInterval: 30000, // 30s em WiFi
  cellularSyncInterval: 120000, // 2min em Cellular
  backgroundSyncInterval: 300000, // 5min em Background

  // Upload
  allowCellularUpload: true, // Permitir mas com limite de tamanho
  maxCellularUploadSizeMB: 5, // Máximo 5MB em cellular

  // Imagens
  downloadImagesOnCellular: true, // Permitir mas com compressão
  compressImagesOnCellular: true, // Comprimir mais
};

// =============================================================================
// NETWORK MANAGER CLASS
// =============================================================================

class NetworkManager {
  private currentNetwork: NetworkInfo = {
    type: 'unknown',
    isConnected: false,
    isInternetReachable: null,
    isExpensive: false,
  };

  private appState: AppStateStatus = 'active';
  private config: BatteryOptimizationConfig = DEFAULT_CONFIG;
  private listeners: Set<(network: NetworkInfo) => void> = new Set();
  private appStateListeners: Set<(state: AppStateStatus) => void> = new Set();

  constructor() {
    this.initialize();
  }

  // =============================================================================
  // INITIALIZATION
  // =============================================================================

  private initialize(): void {
    // Monitorar mudanças de rede
    NetInfo.addEventListener((state) => {
      this.handleNetworkChange(state);
    });

    // Monitorar mudanças de app state (foreground/background)
    AppState.addEventListener('change', (nextAppState) => {
      this.handleAppStateChange(nextAppState);
    });

    // Buscar estado inicial
    NetInfo.fetch().then((state) => {
      this.handleNetworkChange(state);
    });
  }

  // =============================================================================
  // NETWORK MONITORING
  // =============================================================================

  private handleNetworkChange(state: NetInfoState): void {
    const networkType = this.parseNetworkType(state.type);
    const isExpensive = networkType === 'cellular';

    this.currentNetwork = {
      type: networkType,
      isConnected: state.isConnected ?? false,
      isInternetReachable: state.isInternetReachable,
      isExpensive,
    };

    // Notificar listeners
    this.listeners.forEach((listener) => {
      try {
        listener(this.currentNetwork);
      } catch (error) {
        console.error('[NetworkManager] Listener error:', error);
      }
    });
  }

  private parseNetworkType(type: NetInfoStateType): NetworkType {
    switch (type) {
      case 'wifi':
      case 'ethernet':
        return 'wifi';
      case 'cellular':
        return 'cellular';
      case 'none':
      case 'unknown':
        return 'none';
      default:
        return 'unknown';
    }
  }

  // =============================================================================
  // APP STATE MONITORING
  // =============================================================================

  private handleAppStateChange(nextAppState: AppStateStatus): void {
    const previousState = this.appState;
    this.appState = nextAppState;

    console.log(
      `[NetworkManager] App state changed: ${previousState} -> ${nextAppState}`
    );

    // Notificar listeners
    this.appStateListeners.forEach((listener) => {
      try {
        listener(nextAppState);
      } catch (error) {
        console.error('[NetworkManager] App state listener error:', error);
      }
    });
  }

  // =============================================================================
  // PUBLIC API
  // =============================================================================

  /**
   * Obter informações da rede atual
   */
  getNetworkInfo(): NetworkInfo {
    return { ...this.currentNetwork };
  }

  /**
   * Verificar se está em WiFi
   */
  isWiFi(): boolean {
    return this.currentNetwork.type === 'wifi';
  }

  /**
   * Verificar se está em Cellular
   */
  isCellular(): boolean {
    return this.currentNetwork.type === 'cellular';
  }

  /**
   * Verificar se tem conexão
   */
  isConnected(): boolean {
    return this.currentNetwork.isConnected;
  }

  /**
   * Verificar se a rede é "cara" (cellular)
   */
  isExpensiveNetwork(): boolean {
    return this.currentNetwork.isExpensive;
  }

  /**
   * Verificar se o app está em foreground
   */
  isAppActive(): boolean {
    return this.appState === 'active';
  }

  /**
   * Verificar se o app está em background
   */
  isAppInBackground(): boolean {
    return this.appState === 'background' || this.appState === 'inactive';
  }

  /**
   * Obter intervalo de sync recomendado baseado na rede e estado do app
   */
  getRecommendedSyncInterval(): number {
    // Se em background, usar intervalo longo
    if (this.isAppInBackground()) {
      return this.config.backgroundSyncInterval;
    }

    // Se em foreground, baseado no tipo de rede
    if (this.isWiFi()) {
      return this.config.wifiSyncInterval;
    }

    if (this.isCellular()) {
      return this.config.cellularSyncInterval;
    }

    // Offline ou desconhecido - usar intervalo longo
    return this.config.backgroundSyncInterval;
  }

  /**
   * Verificar se deve permitir upload baseado no tamanho e tipo de rede
   */
  shouldAllowUpload(fileSizeBytes: number): {
    allowed: boolean;
    reason?: string;
  } {
    // Sem conexão
    if (!this.isConnected()) {
      return {
        allowed: false,
        reason: 'Sem conexão com a internet',
      };
    }

    // WiFi - permitir sempre
    if (this.isWiFi()) {
      return { allowed: true };
    }

    // Cellular - verificar configuração e tamanho
    if (this.isCellular()) {
      if (!this.config.allowCellularUpload) {
        return {
          allowed: false,
          reason: 'Upload em dados móveis desabilitado',
        };
      }

      const fileSizeMB = fileSizeBytes / (1024 * 1024);
      if (fileSizeMB > this.config.maxCellularUploadSizeMB) {
        return {
          allowed: false,
          reason: `Arquivo muito grande para dados móveis (${fileSizeMB.toFixed(1)}MB). Máximo: ${this.config.maxCellularUploadSizeMB}MB`,
        };
      }

      return { allowed: true };
    }

    // Tipo desconhecido - permitir por padrão
    return { allowed: true };
  }

  /**
   * Verificar se deve baixar imagens
   */
  shouldDownloadImages(): boolean {
    if (this.isWiFi()) {
      return true;
    }

    if (this.isCellular()) {
      return this.config.downloadImagesOnCellular;
    }

    return false;
  }

  /**
   * Verificar se deve comprimir imagens mais agressivamente
   */
  shouldAggressivelyCompressImages(): boolean {
    return this.isCellular() && this.config.compressImagesOnCellular;
  }

  /**
   * Configurar comportamento
   */
  configure(config: Partial<BatteryOptimizationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Obter configuração atual
   */
  getConfig(): BatteryOptimizationConfig {
    return { ...this.config };
  }

  // =============================================================================
  // EVENT LISTENERS
  // =============================================================================

  /**
   * Registrar listener para mudanças de rede
   */
  onNetworkChange(listener: (network: NetworkInfo) => void): () => void {
    this.listeners.add(listener);
    // Chamar imediatamente com estado atual
    listener(this.currentNetwork);
    // Retornar função de cleanup
    return () => this.listeners.delete(listener);
  }

  /**
   * Registrar listener para mudanças de app state
   */
  onAppStateChange(listener: (state: AppStateStatus) => void): () => void {
    this.appStateListeners.add(listener);
    // Chamar imediatamente com estado atual
    listener(this.appState);
    // Retornar função de cleanup
    return () => this.appStateListeners.delete(listener);
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

export const networkManager = new NetworkManager();

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

export const getNetworkInfo = () => networkManager.getNetworkInfo();
export const isWiFi = () => networkManager.isWiFi();
export const isCellular = () => networkManager.isCellular();
export const isConnected = () => networkManager.isConnected();
export const isExpensiveNetwork = () => networkManager.isExpensiveNetwork();
export const isAppActive = () => networkManager.isAppActive();
export const isAppInBackground = () => networkManager.isAppInBackground();
export const getRecommendedSyncInterval = () => networkManager.getRecommendedSyncInterval();
export const shouldAllowUpload = (fileSizeBytes: number) => networkManager.shouldAllowUpload(fileSizeBytes);
export const shouldDownloadImages = () => networkManager.shouldDownloadImages();
export const shouldAggressivelyCompressImages = () => networkManager.shouldAggressivelyCompressImages();
export const onNetworkChange = (listener: (network: NetworkInfo) => void) => networkManager.onNetworkChange(listener);
export const onAppStateChange = (listener: (state: AppStateStatus) => void) => networkManager.onAppStateChange(listener);

// =============================================================================
// EXPORTS
// =============================================================================

export default networkManager;
