/**
 * Config Module
 *
 * Exporta configurações centralizadas.
 */

export { getApiBaseUrl, buildApiUrl } from './api';
export { SYNC_FLAGS, isSyncFlagEnabled, getSyncFlagValue } from './syncFlags';
export type { SyncFlags } from './syncFlags';
