/**
 * Sync Feature Flags
 *
 * Feature flags para otimizações de sincronização.
 * Todas as flags devem ter fallback para comportamento original.
 *
 * IMPORTANTE: Flags são read-only em runtime. Para mudar, requer rebuild.
 * Em produção, considere usar remote config (Firebase, LaunchDarkly, etc).
 */

// =============================================================================
// FEATURE FLAGS
// =============================================================================

export const SYNC_FLAGS = {
  // ===========================================================================
  // CHUNK PROCESSING (Item 1)
  // ===========================================================================

  /**
   * SYNC_OPT_CHUNK_PROCESSING
   *
   * Quando ativado, processa dados em chunks com yield entre eles
   * para evitar bloquear a main thread em lotes grandes.
   *
   * Default: true (otimização ativada)
   * Fallback: false (comportamento original - loop síncrono)
   */
  SYNC_OPT_CHUNK_PROCESSING: true,

  /**
   * Tamanho do chunk para processamento de dados
   * Valores menores = mais yields = menos blocking, mas mais overhead
   * Valores maiores = menos yields = mais blocking, mas menos overhead
   *
   * Recomendado: 100-200 para balance ideal
   */
  CHUNK_SIZE: 100,

  /**
   * Delay em ms entre chunks para liberar o event loop
   * 0 = setTimeout(0) que ainda libera o event loop
   * >0 = delay adicional (não recomendado em produção)
   */
  CHUNK_YIELD_DELAY_MS: 0,

  // ===========================================================================
  // PARALLEL ENTITIES (Item 2)
  // ===========================================================================

  /**
   * SYNC_OPT_PARALLEL_ENTITIES
   *
   * Quando ativado, sincroniza entidades independentes em paralelo
   * para reduzir o tempo total do syncAll().
   *
   * Entidades paralelizadas (sem dependências entre si):
   * - clients
   * - categories
   *
   * Entidades sequenciais (dependem das anteriores):
   * - catalogItems (depende de categories)
   * - quotes (depende de clients)
   * - work_orders (depende de clients + quotes)
   *
   * Default: true (otimização ativada)
   * Fallback: false (comportamento original - tudo sequencial)
   */
  SYNC_OPT_PARALLEL_ENTITIES: true,

  /**
   * Número máximo de entidades sincronizando em paralelo
   * Evita sobrecarregar a rede/CPU em dispositivos fracos
   *
   * Recomendado: 2-3 para balance entre velocidade e estabilidade
   * Valores altos podem causar race conditions no SQLite
   */
  MAX_PARALLEL_ENTITIES: 2,

  /**
   * Lista de entidades que podem ser sincronizadas em paralelo
   * Apenas entidades SEM dependências entre si devem estar aqui
   *
   * Formato: array de nomes de entidades (config.name)
   */
  PARALLEL_SAFE_ENTITIES: ['clients', 'categories'] as readonly string[],

  /**
   * Lista de entidades que DEVEM rodar sequencialmente após as paralelas
   * Ordem é respeitada - cada uma espera a anterior terminar
   *
   * catalogItems depende de categories
   * quotes depende de clients
   * work_orders depende de clients + quotes
   */
  SEQUENTIAL_ENTITIES: ['catalogItems', 'quotes', 'work_orders'] as readonly string[],

  // ===========================================================================
  // CHECKLIST BATCH PULL (Item 3)
  // ===========================================================================

  /**
   * SYNC_OPT_CHECKLIST_BATCH_PULL
   *
   * Quando ativado, otimiza o sync de checklists para múltiplas OSs:
   * - Verifica conectividade UMA vez (não por OS)
   * - Push pending answers UMA vez (não por OS)
   * - Concorrência limitada (2-3 simultâneos em vez de 5)
   * - Retry individual com backoff exponencial
   * - Cancelamento se offline detectado
   * - Métricas detalhadas
   *
   * Default: true (otimização ativada)
   * Fallback: false (comportamento original - 5 paralelos sem retry)
   */
  SYNC_OPT_CHECKLIST_BATCH_PULL: true,

  /**
   * Máximo de OSs sincronizando checklists em paralelo
   * Valores baixos = mais lento, mas mais estável em redes ruins
   * Valores altos = mais rápido, mas pode sobrecarregar rede/servidor
   *
   * Recomendado: 2-3 para 3G, 4-5 para 4G/WiFi
   */
  CHECKLIST_PULL_CONCURRENCY: 3,

  /**
   * Número máximo de retries por OS em caso de falha
   * Usa backoff exponencial: 1s, 2s, 4s
   */
  CHECKLIST_PULL_MAX_RETRIES: 2,

  /**
   * Delay base em ms para backoff exponencial
   * Retry 1: delay * 1 = 1000ms
   * Retry 2: delay * 2 = 2000ms
   */
  CHECKLIST_PULL_RETRY_DELAY_MS: 1000,

  /**
   * Timeout em ms para cada request de checklist
   * Deve ser suficiente para redes lentas, mas não travar o sync
   */
  CHECKLIST_PULL_TIMEOUT_MS: 30000,

  // ===========================================================================
  // FILESYSTEM ATTACHMENTS (Item 4)
  // ===========================================================================

  /**
   * SYNC_OPT_FS_ATTACHMENTS
   *
   * Quando ativado, armazena anexos de checklist no filesystem em vez do SQLite:
   * - Evita OOM ao carregar anexos grandes do DB
   * - Reduz tamanho do banco de dados
   * - Melhora performance de queries
   * - Permite limpeza seletiva de arquivos
   *
   * Arquivos são salvos em: {documentDirectory}/attachments/{id}.{ext}
   * DB guarda apenas: filePath, mimeType, sizeBytes, sha256
   *
   * Default: true (otimização ativada)
   * Fallback: false (comportamento original - base64Data no SQLite)
   *
   * MIGRAÇÃO: Ao iniciar o app, registros antigos com base64Data são
   * migrados automaticamente para filesystem em chunks de 5.
   */
  SYNC_OPT_FS_ATTACHMENTS: true,

  /**
   * Diretório base para armazenamento de anexos
   * Relativo ao documentDirectory do Expo
   */
  FS_ATTACHMENTS_DIR: 'attachments',

  /**
   * Tamanho do chunk para migração de base64Data
   * Processa N registros por vez para não bloquear UI
   */
  FS_MIGRATION_CHUNK_SIZE: 5,

  /**
   * Delay entre chunks de migração (ms)
   * Libera event loop para UI responsiva durante migração
   */
  FS_MIGRATION_CHUNK_DELAY_MS: 100,

  /**
   * Se true, calcula hash SHA256 dos arquivos para verificação de integridade
   * Útil para detectar corrupção, mas adiciona overhead de CPU
   */
  FS_ATTACHMENTS_VERIFY_HASH: false,

  /**
   * Se true, deleta arquivos do filesystem após upload bem sucedido
   * Economiza espaço em disco
   */
  FS_ATTACHMENTS_DELETE_AFTER_SYNC: true,

  // ===========================================================================
  // EVENT-DRIVEN PENDING COUNT (Item 5)
  // ===========================================================================

  /**
   * SYNC_OPT_EVENT_PENDING_COUNT
   *
   * Quando ativado, usa eventos em vez de polling para atualizar contagem
   * de mutações pendentes no UI:
   * - Elimina queries a cada 5s (polling)
   * - Atualização instantânea quando mutações são adicionadas/removidas
   * - Economia de bateria e CPU
   *
   * Funcionamento:
   * - MutationQueue emite eventos: mutation_added, mutation_completed, etc.
   * - useSyncStatus assina eventos e atualiza estado
   * - Query inicial no mount do hook (cold start)
   *
   * Default: true (otimização ativada)
   * Fallback: false (comportamento original - polling 5s)
   */
  SYNC_OPT_EVENT_PENDING_COUNT: true,

  /**
   * Intervalo de polling fallback em ms
   * Usado apenas quando SYNC_OPT_EVENT_PENDING_COUNT = false
   */
  PENDING_COUNT_POLL_INTERVAL_MS: 5000,

  // ===========================================================================
  // BULK INSERT OPTIMIZATION (Item 6)
  // ===========================================================================

  /**
   * SYNC_OPT_BULK_INSERT
   *
   * Quando ativado, usa inserções em chunks menores com transações separadas:
   * - Reduz tempo de lock da tabela
   * - Permite recuperação parcial em caso de erro
   * - Usa bisect para isolar registros inválidos
   * - Métricas por chunk
   *
   * Estratégia:
   * 1. Divide registros em chunks de BULK_INSERT_CHUNK_SIZE
   * 2. Cada chunk é uma transação separada
   * 3. Se chunk falhar, usa bisect para isolar registro ruim
   * 4. Registros válidos são salvos, inválidos são reportados
   *
   * Default: true (otimização ativada)
   * Fallback: false (comportamento original - INSERT único gigante)
   */
  SYNC_OPT_BULK_INSERT: true,

  /**
   * Número de registros por chunk de INSERT
   * Valores menores = mais transações = mais overhead, mas menos lock
   * Valores maiores = menos transações = menos overhead, mas mais lock
   *
   * Recomendado: 50-100 para balance ideal
   * SQLite bind limit é ~999 vars, então chunk * cols < 999
   */
  BULK_INSERT_CHUNK_SIZE: 50,

  /**
   * Nível mínimo de bisect para isolar registro inválido
   * Quando chunk falha, divide até ter no máximo N registros
   * Então tenta um por um para identificar o(s) inválido(s)
   *
   * 1 = isola até o registro individual (mais preciso, mais lento)
   * 5 = para quando chunk tem ≤5 registros (menos preciso, mais rápido)
   */
  BULK_INSERT_BISECT_MIN_SIZE: 1,

  /**
   * Se true, continua processando chunks após falha em um chunk
   * Se false, para no primeiro erro
   */
  BULK_INSERT_CONTINUE_ON_ERROR: true,

  /**
   * Se true, loga cada registro inválido encontrado
   */
  BULK_INSERT_LOG_INVALID_RECORDS: true,

  // ===========================================================================
  // FAST PUSH PATH (Item 7)
  // ===========================================================================

  /**
   * SYNC_OPT_FAST_PUSH_ONLY
   *
   * Quando ativado, ao criar mutações offline, faz apenas push rápido:
   * - Push imediato das mutações pendentes (após debounce de coalescing)
   * - Sync completo é agendado em baixa prioridade (throttled)
   * - Evita pulls desnecessários em cada mutação
   *
   * Fluxo com fast push:
   * 1. Usuário cria/edita dados offline → MutationQueue.enqueue()
   * 2. Debounce de FAST_PUSH_DEBOUNCE_MS agrupa mutações próximas
   * 3. pushOnly() envia apenas mutações (sem pull)
   * 4. Sync completo é agendado para depois (throttled)
   *
   * Fluxo original (flag desativada):
   * 1. Mutação enfileirada → debounce 2s → syncAll() completo
   *
   * Default: true (otimização ativada)
   * Fallback: false (comportamento original - syncAll a cada mutação)
   */
  SYNC_OPT_FAST_PUSH_ONLY: true,

  /**
   * Debounce para agrupar mutações próximas em um único push
   * Se usuário cria 5 clientes em 2 segundos, espera esse tempo
   * após a última mutação antes de disparar o push
   *
   * Valores baixos = push mais responsivo, mais requests
   * Valores altos = mais coalescing, menos requests, mais latência
   *
   * Recomendado: 1000-2000ms
   */
  FAST_PUSH_DEBOUNCE_MS: 1500,

  /**
   * Intervalo mínimo entre syncs completos (throttle)
   * Evita syncs completos muito frequentes que consomem bateria/dados
   *
   * Após um sync completo, não inicia outro até passar esse tempo
   * Durante esse período, apenas fast push é executado
   *
   * Recomendado: 300000-600000ms (5-10 minutos)
   */
  FULL_SYNC_THROTTLE_MS: 300000, // 5 minutos

  /**
   * Se true, agenda sync completo em background após fast push
   * Se false, sync completo só ocorre manualmente ou ao reconectar
   *
   * O sync agendado respeita o throttle e condições:
   * - Espera FULL_SYNC_THROTTLE_MS desde o último sync
   * - Pode aguardar WiFi se FULL_SYNC_PREFER_WIFI = true
   */
  FAST_PUSH_SCHEDULE_FULL_SYNC: true,

  /**
   * Se true, sync completo agendado prefere aguardar WiFi
   * Economia de dados móveis para pull de grandes volumes
   *
   * Nota: Fast push sempre executa (dados pequenos)
   */
  FULL_SYNC_PREFER_WIFI: false,

  /**
   * Máximo de mutações no buffer antes de forçar push imediato
   * Evita acumular muitas mutações se debounce for longo
   *
   * Se buffer atingir esse tamanho, push é disparado imediatamente
   * ignorando o debounce restante
   */
  FAST_PUSH_MAX_BUFFER_SIZE: 20,
} as const;

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type SyncFlags = typeof SYNC_FLAGS;

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Verifica se uma flag está ativada
 * Útil para testes e override via mock
 */
export function isSyncFlagEnabled(flag: keyof SyncFlags): boolean {
  return Boolean(SYNC_FLAGS[flag]);
}

/**
 * Obtém o valor de uma flag
 */
export function getSyncFlagValue<K extends keyof SyncFlags>(flag: K): SyncFlags[K] {
  return SYNC_FLAGS[flag];
}
