/**
 * API Configuration
 *
 * Configuração da URL base da API.
 * Usa EXPO_PUBLIC_API_URL do .env como fonte única de verdade.
 */

// Get API URL from environment variable (set in .env)
// EXPO_PUBLIC_* variables are automatically available in process.env
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

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
