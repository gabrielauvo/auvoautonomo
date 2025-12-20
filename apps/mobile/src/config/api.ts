/**
 * API Configuration
 *
 * Configuração da URL base da API.
 */

import Constants from 'expo-constants';

// Get API URL from environment or use default
const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3001';

/**
 * Get the base URL for API requests
 */
export function getApiBaseUrl(): string {
  return API_URL;
}

/**
 * Build full API URL
 */
export function buildApiUrl(path: string): string {
  return `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export default {
  getApiBaseUrl,
  buildApiUrl,
};
