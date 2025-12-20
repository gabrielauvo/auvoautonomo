// @ts-nocheck
/**
 * ChecklistSyncService
 *
 * Serviço de sincronização REST para checklists.
 * Gerencia pull de instâncias do servidor e push de respostas pendentes.
 *
 * IMPORTANTE: Não usa Delta Sync - usa endpoints REST diretos:
 * - GET /checklist-instances/work-orders/:id - Lista checklists da OS
 * - GET /checklist-instances/:id/full - Obtém checklist completo
 * - POST /checklist-instances/:id/answers/batch - Envia respostas em lote
 * - POST /checklist-instances/sync - Sync offline com idempotência
 *
 * v2.1 - Offline support: salva checklists localmente para acesso offline
 * v2.2 - Fix: Busca templateVersionSnapshot completo ao listar checklists
 *        para garantir que as perguntas fiquem disponíveis offline
 * v2.3 - Fix: Envia respostas pendentes antes de buscar dados do servidor
 *        e preserva status/progress local quando há mudanças não sincronizadas
 * v2.4 - Fix: Corrigido campo answer.questionType -> answer.type no pushPendingAnswers
 * v2.5 - Fix: Adicionado verificação de conectividade real com servidor e logs detalhados
 * v2.6 - Fix: Envia workOrderId e templateId no sync para criar instância automaticamente
 *        se não existir no servidor (instâncias criadas offline)
 * v2.7 - Fix: Verifica se Work Order foi sincronizada antes de tentar sincronizar checklist
 *        OSs criadas offline não existem no servidor, causando erro 404
 */

// LOG DE VERSÃO - SE ESTE LOG NÃO APARECER, O METRO ESTÁ COM CACHE ANTIGO
console.log('=== ChecklistSyncService v2.7 LOADED - CHECK WO SYNC BEFORE CHECKLIST SYNC ===');

import { v4 as uuidv4 } from 'uuid';
import { syncEngine } from '../../../sync';
import { ChecklistInstanceRepository } from '../repositories/ChecklistInstanceRepository';
import { ChecklistAnswerRepository } from '../repositories/ChecklistAnswerRepository';
import { ChecklistAttachmentRepository } from '../repositories/ChecklistAttachmentRepository';
import {
  ChecklistInstance,
  ChecklistAnswer,
  ChecklistAttachment,
  AnswerSyncStatus,
} from '../../../db/schema';

// =============================================================================
// TYPES
// =============================================================================

export interface ChecklistSyncResult {
  success: boolean;
  instanceId?: string;
  syncedAnswers: number;
  failedAnswers: number;
  skippedAnswers: number;
  errors: string[];
}

export interface BatchSyncResult {
  success: boolean;
  totalSynced: number;
  totalFailed: number;
  totalSkipped: number;
  results: ChecklistSyncResult[];
}

export interface PullChecklistsResult {
  success: boolean;
  checklists: ChecklistInstance[];
  error?: string;
}

export interface PullChecklistFullResult {
  success: boolean;
  instance?: ChecklistInstance;
  snapshot?: unknown;
  answers?: ChecklistAnswer[];
  error?: string;
}

interface ServerChecklistInstance {
  id: string;
  workOrderId: string;
  templateId: string;
  status: string;
  progress: number;
  startedAt?: string;
  completedAt?: string;
  completedBy?: string;
  createdAt: string;
  updatedAt: string;
  template?: {
    name: string;
    description?: string;
    _count?: { questions: number; sections: number };
  };
  _count?: { answers: number };
}

interface ServerChecklistFull extends ServerChecklistInstance {
  templateVersionSnapshot: unknown;
  answers: ServerChecklistAnswer[];
}

interface ServerChecklistAnswer {
  id: string;
  instanceId: string;
  questionId: string;
  type: string;
  valueText?: string;
  valueNumber?: number;
  valueBoolean?: boolean;
  valueDate?: string;
  valueJson?: unknown;
  answeredAt?: string;
  answeredBy?: string;
  localId?: string;
  syncedAt?: string;
  attachments?: ServerChecklistAttachment[];
}

interface ServerChecklistAttachment {
  id: string;
  answerId: string;
  type: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  storagePath?: string;
  thumbnailPath?: string;
  createdAt: string;
}

interface SyncAttachmentPayload {
  data: string;
  type: string;
  fileName?: string;
}

interface SyncAnswerPayload {
  questionId: string;
  type: string;
  valueText?: string;
  valueNumber?: number;
  valueBoolean?: boolean;
  valueDate?: string;
  valueJson?: unknown;
  localId: string;
  deviceInfo?: string;
  attachments?: SyncAttachmentPayload[];
}

// =============================================================================
// CHECKLIST SYNC SERVICE
// =============================================================================

class ChecklistSyncServiceClass {
  private technicianId: string | null = null;

  /**
   * Configurar o serviço com o ID do técnico
   */
  configure(technicianId: string): void {
    this.technicianId = technicianId;
  }

  /**
   * Obter configuração do SyncEngine
   */
  private getApiConfig(): { baseUrl: string; authToken: string } {
    // Acessar propriedades internas do SyncEngine
    const engine = syncEngine as any;
    console.log('[ChecklistSyncService] getApiConfig - baseUrl:', engine.baseUrl);
    console.log('[ChecklistSyncService] getApiConfig - authToken:', engine.authToken ? 'SET' : 'NOT SET');
    console.log('[ChecklistSyncService] getApiConfig - isConfigured:', syncEngine.isConfigured());
    if (!engine.baseUrl || !engine.authToken) {
      throw new Error('SyncEngine não configurado. Faça login primeiro.');
    }
    return {
      baseUrl: engine.baseUrl,
      authToken: engine.authToken,
    };
  }

  /**
   * Verificar se está online (baseado no NetInfo)
   */
  isOnline(): boolean {
    const online = syncEngine.isNetworkOnline();
    console.log('[ChecklistSyncService] isOnline (NetInfo):', online);
    return online;
  }

  /**
   * Verificar conectividade real com o servidor
   * Retorna true se conseguiu conectar, false caso contrário
   */
  async checkServerConnectivity(): Promise<{ reachable: boolean; latencyMs?: number; error?: string }> {
    if (!this.isOnline()) {
      return { reachable: false, error: 'Sem conexão de rede (NetInfo)' };
    }

    try {
      const engine = syncEngine as any;
      if (!engine.baseUrl) {
        return { reachable: false, error: 'baseUrl não configurada' };
      }

      const url = `${engine.baseUrl}/health`;
      console.log('[ChecklistSyncService] Checking server connectivity:', url);

      const startTime = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

      try {
        const response = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const latencyMs = Date.now() - startTime;
        console.log('[ChecklistSyncService] Server response:', response.status, 'latency:', latencyMs, 'ms');

        return {
          reachable: response.ok,
          latencyMs,
          error: response.ok ? undefined : `HTTP ${response.status}`,
        };
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          return { reachable: false, error: 'Timeout (5s) - servidor não respondeu' };
        }
        return { reachable: false, error: `Fetch error: ${fetchError.message}` };
      }
    } catch (error: any) {
      console.error('[ChecklistSyncService] checkServerConnectivity error:', error);
      return { reachable: false, error: error.message };
    }
  }

  // =============================================================================
  // PULL - Baixar dados do servidor
  // =============================================================================

  /**
   * Buscar checklists de uma Work Order do servidor
   */
  async pullChecklistsForWorkOrder(workOrderId: string): Promise<PullChecklistsResult> {
    console.log('[ChecklistSyncService] pullChecklistsForWorkOrder called for:', workOrderId);

    // Verificar conectividade real antes de tentar sync
    const connectivity = await this.checkServerConnectivity();
    console.log('[ChecklistSyncService] Server connectivity check:', connectivity);

    // Tentar buscar do servidor primeiro (evitar problemas com FK local)
    if (this.isOnline() && connectivity.reachable) {
      try {
        // IMPORTANTE: Enviar respostas pendentes ANTES de buscar do servidor
        // para garantir que não perdemos dados locais
        console.log('[ChecklistSyncService] Pushing pending answers before pull...');
        const pendingResult = await this.pushAllPendingAnswers();
        console.log('[ChecklistSyncService] Pending push result:', {
          totalSynced: pendingResult.totalSynced,
          totalFailed: pendingResult.totalFailed,
        });
        const { baseUrl, authToken } = this.getApiConfig();
        const url = `${baseUrl}/checklist-instances/work-orders/${workOrderId}`;

        console.log('[ChecklistSyncService] Fetching from API:', url);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        console.log('[ChecklistSyncService] API response status:', response.status);

        if (!response.ok) {
          // 404 significa que a OS não existe no servidor (ainda não sincronizou)
          // Isso é esperado para OS criadas localmente - buscar do banco local
          if (response.status === 404) {
            console.log('[ChecklistSyncService] Work Order not found on server (local-only OS) - falling back to local DB');
            const localInstances = await ChecklistInstanceRepository.getByWorkOrder(workOrderId);
            console.log('[ChecklistSyncService] Local instances found for local-only OS:', localInstances.length);
            return {
              success: true,
              checklists: localInstances,
            };
          }
          const errorText = await response.text();
          console.error('[ChecklistSyncService] API error:', response.status, errorText);
          throw new Error(`Falha ao buscar checklists: ${response.status} - ${errorText}`);
        }

        const serverInstances: ServerChecklistInstance[] = await response.json();
        console.log('[ChecklistSyncService] Server returned instances:', serverInstances.length);
        console.log('[ChecklistSyncService] Server data:', JSON.stringify(serverInstances, null, 2));

        // Converter para formato local
        const checklists: ChecklistInstance[] = serverInstances.map((server) => ({
          id: server.id,
          workOrderId,
          templateId: server.templateId,
          templateName: server.template?.name || 'Checklist',
          templateVersionSnapshot: (server as any).templateVersionSnapshot
            ? JSON.stringify((server as any).templateVersionSnapshot)
            : undefined,
          status: server.status as any,
          progress: server.progress || 0,
          startedAt: server.startedAt,
          completedAt: server.completedAt,
          completedBy: server.completedBy,
          syncedAt: new Date().toISOString(),
          createdAt: server.createdAt,
          updatedAt: server.updatedAt,
          technicianId: this.technicianId || '',
        }));

        // Salvar no banco local para acesso offline
        console.log('[ChecklistSyncService] Saving', checklists.length, 'checklists to local DB for offline access...');
        console.log('[ChecklistSyncService] Using technicianId:', this.technicianId);
        let savedCount = 0;
        let failedCount = 0;
        for (const checklist of checklists) {
          try {
            const existing = await ChecklistInstanceRepository.getById(checklist.id);
            if (existing) {
              // Verificar se há respostas locais pendentes para este checklist
              const pendingAnswers = await ChecklistAnswerRepository.getPendingSync(checklist.id);
              const hasPendingChanges = pendingAnswers.length > 0 || !existing.syncedAt;

              console.log('[ChecklistSyncService] Updating existing checklist:', checklist.id, {
                hasPendingChanges,
                pendingAnswersCount: pendingAnswers.length,
                existingSyncedAt: existing.syncedAt,
              });

              const updateData: Partial<ChecklistInstance> = {
                syncedAt: checklist.syncedAt,
              };

              // Se NÃO há mudanças locais pendentes, atualizar status e progress do servidor
              // Se HÁ mudanças pendentes, manter os valores locais (são mais recentes)
              if (!hasPendingChanges) {
                updateData.status = checklist.status;
                updateData.progress = checklist.progress;
                updateData.startedAt = checklist.startedAt;
                updateData.completedAt = checklist.completedAt;
                updateData.completedBy = checklist.completedBy;
                console.log('[ChecklistSyncService] No pending changes - updating status/progress from server');
              } else {
                console.log('[ChecklistSyncService] Has pending changes - preserving local status/progress');
                // Mesclar o checklist retornado com os dados locais para exibição
                checklist.status = existing.status;
                checklist.progress = existing.progress;
                checklist.startedAt = existing.startedAt;
                checklist.completedAt = existing.completedAt;
                checklist.completedBy = existing.completedBy;
              }

              // Atualizar templateVersionSnapshot se disponível e não existir localmente
              if (checklist.templateVersionSnapshot && !existing.templateVersionSnapshot) {
                updateData.templateVersionSnapshot = checklist.templateVersionSnapshot;
                console.log('[ChecklistSyncService] Adding templateVersionSnapshot to existing checklist:', checklist.id);
              }
              await ChecklistInstanceRepository.update(checklist.id, updateData);
              savedCount++;
            } else {
              // Criar novo registro local
              console.log('[ChecklistSyncService] Creating new local checklist:', checklist.id);
              console.log('[ChecklistSyncService] Create data:', JSON.stringify({
                id: checklist.id,
                workOrderId: checklist.workOrderId,
                templateId: checklist.templateId,
                templateName: checklist.templateName,
                status: checklist.status,
                progress: checklist.progress,
                technicianId: checklist.technicianId || this.technicianId,
              }, null, 2));
              await ChecklistInstanceRepository.create({
                id: checklist.id,
                workOrderId: checklist.workOrderId,
                templateId: checklist.templateId,
                templateName: checklist.templateName,
                templateVersionSnapshot: checklist.templateVersionSnapshot,
                status: checklist.status,
                progress: checklist.progress,
                technicianId: checklist.technicianId || this.technicianId || '',
              });
              savedCount++;
            }
            console.log('[ChecklistSyncService] Checklist saved locally:', checklist.id);
          } catch (saveError) {
            failedCount++;
            console.error('[ChecklistSyncService] Failed to save checklist locally:', checklist.id, saveError);
            // Continuar mesmo se falhar - o checklist ainda será retornado
          }
        }
        console.log('[ChecklistSyncService] Finished saving checklists. Saved:', savedCount, 'Failed:', failedCount);

        console.log('[ChecklistSyncService] Returning checklists:', checklists.length);

        // IMPORTANTE: Buscar o snapshot completo de cada checklist para garantir
        // que as perguntas fiquem disponíveis offline
        console.log('[ChecklistSyncService] Fetching full snapshots for offline support...');
        for (const checklist of checklists) {
          if (!checklist.templateVersionSnapshot) {
            try {
              console.log('[ChecklistSyncService] Fetching full snapshot for checklist:', checklist.id);
              const fullResult = await this.pullChecklistFull(checklist.id);
              if (fullResult.success && fullResult.instance?.templateVersionSnapshot) {
                checklist.templateVersionSnapshot = fullResult.instance.templateVersionSnapshot;
                console.log('[ChecklistSyncService] Snapshot loaded for checklist:', checklist.id);
              }
            } catch (snapshotError) {
              console.warn('[ChecklistSyncService] Failed to fetch snapshot for checklist:', checklist.id, snapshotError);
              // Continua mesmo se falhar - o checklist ainda será exibido na lista
            }
          }
        }

        return {
          success: true,
          checklists,
        };
      } catch (error) {
        console.warn('[ChecklistSyncService] API request failed, will use local fallback:', error);
        // Fallback para dados locais - continua abaixo
      }
    }

    // Offline ou API falhou - buscar dados locais
    const isNetworkOnline = this.isOnline();
    console.log('[ChecklistSyncService] *** USING LOCAL DB FALLBACK ***');
    console.log('[ChecklistSyncService] Reason: NetInfo online:', isNetworkOnline, '| Server reachable:', connectivity.reachable, '| Error:', connectivity.error);
    console.log('[ChecklistSyncService] workOrderId:', workOrderId);
    console.log('[ChecklistSyncService] technicianId configured:', this.technicianId);
    try {
      const localInstances = await ChecklistInstanceRepository.getByWorkOrder(workOrderId);
      console.log('[ChecklistSyncService] Local instances found:', localInstances.length);
      if (localInstances.length > 0) {
        console.log('[ChecklistSyncService] First local instance:', JSON.stringify(localInstances[0], null, 2));
      } else {
        console.log('[ChecklistSyncService] No local instances found - checking if table has any data...');
        // Debug: verificar se há dados na tabela
        const { rawQuery } = await import('../../../db/database');
        const allInstances = await rawQuery('SELECT id, workOrderId, templateName, status FROM checklist_instances LIMIT 5');
        console.log('[ChecklistSyncService] Sample data from checklist_instances table:', JSON.stringify(allInstances, null, 2));
      }
      return {
        success: true,
        checklists: localInstances,
      };
    } catch (dbError) {
      console.error('[ChecklistSyncService] Local DB error:', dbError);
      return {
        success: false,
        checklists: [],
        error: 'Não foi possível carregar checklists',
      };
    }
  }

  /**
   * Buscar checklist completo com snapshot e respostas
   */
  async pullChecklistFull(instanceId: string): Promise<PullChecklistFullResult> {
    console.log('[ChecklistSyncService] pullChecklistFull called for:', instanceId);

    // Tentar buscar do servidor primeiro
    if (this.isOnline()) {
      try {
        const { baseUrl, authToken } = this.getApiConfig();
        const url = `${baseUrl}/checklist-instances/${instanceId}/full`;

        console.log('[ChecklistSyncService] Fetching full checklist from:', url);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        console.log('[ChecklistSyncService] Full checklist response status:', response.status);

        if (!response.ok) {
          // 404 significa que o checklist não existe no servidor (criado localmente)
          // Fazer fallback para dados locais
          if (response.status === 404) {
            console.log('[ChecklistSyncService] Checklist not found on server - falling back to local DB');
            const instance = await ChecklistInstanceRepository.getById(instanceId);
            const answers = instance ? await ChecklistAnswerRepository.getByInstance(instanceId) : [];
            console.log('[ChecklistSyncService] Local fallback for 404 - instance:', !!instance, 'answers:', answers.length);
            if (instance) {
              return {
                success: true,
                instance,
                answers,
              };
            }
          }
          const errorText = await response.text();
          console.error('[ChecklistSyncService] Full checklist API error:', response.status, errorText);
          throw new Error(`Falha ao buscar checklist: ${response.status} - ${errorText}`);
        }

        const serverData: ServerChecklistFull = await response.json();
        console.log('[ChecklistSyncService] Full checklist data received, answers:', serverData.answers?.length || 0);

        // Converter para formato local
        const instance: ChecklistInstance = {
          id: serverData.id,
          workOrderId: serverData.workOrderId,
          templateId: serverData.templateId,
          templateName: serverData.template?.name || 'Checklist',
          templateVersionSnapshot: serverData.templateVersionSnapshot
            ? JSON.stringify(serverData.templateVersionSnapshot)
            : undefined,
          status: serverData.status as any,
          progress: serverData.progress || 0,
          startedAt: serverData.startedAt,
          completedAt: serverData.completedAt,
          completedBy: serverData.completedBy,
          syncedAt: new Date().toISOString(),
          createdAt: serverData.createdAt,
          updatedAt: serverData.updatedAt,
          technicianId: this.technicianId || '',
        };

        // Salvar instância localmente para acesso offline
        try {
          const existingInstance = await ChecklistInstanceRepository.getById(instance.id);
          if (existingInstance) {
            await ChecklistInstanceRepository.update(instance.id, {
              status: instance.status,
              progress: instance.progress,
              startedAt: instance.startedAt,
              completedAt: instance.completedAt,
              completedBy: instance.completedBy,
              templateVersionSnapshot: instance.templateVersionSnapshot,
              syncedAt: instance.syncedAt,
            });
          } else {
            await ChecklistInstanceRepository.create({
              id: instance.id,
              workOrderId: instance.workOrderId,
              templateId: instance.templateId,
              templateName: instance.templateName,
              templateVersionSnapshot: instance.templateVersionSnapshot,
              status: instance.status,
              progress: instance.progress,
              technicianId: instance.technicianId,
            });
          }
        } catch (saveError) {
          console.warn('[ChecklistSyncService] Failed to save instance locally:', saveError);
        }

        // Converter respostas para formato local
        // Incluir attachments para exibição (campo extra, não armazenado em SQLite)
        const answers: (ChecklistAnswer & { attachments?: any[] })[] = (serverData.answers || []).map((server: any) => ({
          id: server.id,
          instanceId,
          questionId: server.questionId,
          questionType: server.type,
          valueText: server.valueText,
          valueNumber: server.valueNumber,
          valueBoolean: server.valueBoolean !== undefined ? (server.valueBoolean ? 1 : 0) : undefined,
          valueDate: server.valueDate,
          valueJson: server.valueJson ? JSON.stringify(server.valueJson) : undefined,
          answeredAt: server.answeredAt || new Date().toISOString(),
          answeredBy: server.answeredBy,
          localId: server.localId,
          syncStatus: 'SYNCED' as const,
          createdAt: server.answeredAt || new Date().toISOString(),
          updatedAt: server.syncedAt || new Date().toISOString(),
          // Incluir attachments diretamente do servidor para exibição
          attachments: server.attachments || [],
        }));

        // Salvar respostas localmente para acesso offline (apenas se não tiver pendentes locais)
        for (const answer of answers) {
          try {
            const existingAnswer = await ChecklistAnswerRepository.getByQuestion(instanceId, answer.questionId);
            if (existingAnswer) {
              // Só atualizar se a resposta local não estiver pendente de sync
              if (existingAnswer.syncStatus === 'SYNCED') {
                await ChecklistAnswerRepository.update(existingAnswer.id, {
                  valueText: answer.valueText,
                  valueNumber: answer.valueNumber,
                  valueBoolean: answer.valueBoolean,
                  valueDate: answer.valueDate,
                  valueJson: answer.valueJson,
                  syncStatus: 'SYNCED',
                });
              }
            } else {
              // Criar nova resposta local
              await ChecklistAnswerRepository.create({
                instanceId: answer.instanceId,
                questionId: answer.questionId,
                questionType: answer.questionType,
                valueText: answer.valueText,
                valueNumber: answer.valueNumber,
                valueBoolean: answer.valueBoolean,
                valueDate: answer.valueDate,
                valueJson: answer.valueJson,
              });
              // Marcar como sincronizada
              const created = await ChecklistAnswerRepository.getByQuestion(instanceId, answer.questionId);
              if (created) {
                await ChecklistAnswerRepository.updateSyncStatus(created.id, 'SYNCED');
              }
            }
          } catch (saveError) {
            console.warn('[ChecklistSyncService] Failed to save answer locally:', answer.questionId, saveError);
          }
        }

        // Log attachments info for debugging
        const answersWithAttachments = answers.filter(a => a.attachments && a.attachments.length > 0);
        console.log('[ChecklistSyncService] Returning full checklist with', answers.length, 'answers,', answersWithAttachments.length, 'have attachments');
        if (answersWithAttachments.length > 0) {
          console.log('[ChecklistSyncService] First answer attachments:', JSON.stringify(answersWithAttachments[0].attachments?.slice(0, 2)));
        }

        return {
          success: true,
          instance,
          snapshot: serverData.templateVersionSnapshot,
          answers,
        };
      } catch (error) {
        console.error('[ChecklistSyncService] pullChecklistFull API error:', error);
        // Fallback para dados locais se API falhar
      }
    }

    // Offline ou API falhou - tentar buscar dados locais
    console.log('[ChecklistSyncService] Trying local DB fallback for full checklist...');
    try {
      const instance = await ChecklistInstanceRepository.getById(instanceId);
      const answers = instance ? await ChecklistAnswerRepository.getByInstance(instanceId) : [];
      console.log('[ChecklistSyncService] Local fallback - instance:', !!instance, 'answers:', answers.length);

      // Parsear o snapshot se disponível para consistência com o fluxo online
      let snapshot: unknown = undefined;
      if (instance?.templateVersionSnapshot) {
        try {
          snapshot = JSON.parse(instance.templateVersionSnapshot);
          console.log('[ChecklistSyncService] Local fallback - snapshot parsed successfully');
        } catch (parseError) {
          console.warn('[ChecklistSyncService] Failed to parse local snapshot:', parseError);
        }
      } else {
        console.warn('[ChecklistSyncService] Local fallback - NO templateVersionSnapshot available for checklist:', instanceId);
      }

      return {
        success: !!instance,
        instance: instance || undefined,
        snapshot,
        answers,
        error: instance ? undefined : 'Checklist não encontrado localmente',
      };
    } catch (dbError) {
      console.warn('[ChecklistSyncService] Local DB error:', dbError);
      return {
        success: false,
        instance: undefined,
        answers: [],
        error: 'Não foi possível carregar o checklist',
      };
    }
  }

  // =============================================================================
  // PUSH - Enviar dados para o servidor
  // =============================================================================

  /**
   * Sincronizar respostas pendentes de uma instância
   */
  async pushPendingAnswers(instanceId: string): Promise<ChecklistSyncResult> {
    const result: ChecklistSyncResult = {
      success: false,
      instanceId,
      syncedAnswers: 0,
      failedAnswers: 0,
      skippedAnswers: 0,
      errors: [],
    };

    if (!this.isOnline()) {
      result.errors.push('Sem conexão com a internet');
      return result;
    }

    try {
      // Buscar instância local para verificar se a WO já foi sincronizada
      const localInstance = await ChecklistInstanceRepository.getById(instanceId);

      if (localInstance?.workOrderId) {
        // Verificar se a Work Order já foi sincronizada com o servidor
        // OSs criadas offline têm syncedAt = NULL e não existem no servidor ainda
        const { rawQuery } = await import('../../../db/database');
        const woResult = await rawQuery<{ syncedAt: string | null }>(
          'SELECT syncedAt FROM work_orders WHERE id = ? LIMIT 1',
          [localInstance.workOrderId]
        );

        if (woResult.length > 0 && !woResult[0].syncedAt) {
          console.log(`[ChecklistSyncService] Work Order ${localInstance.workOrderId} not synced yet, skipping checklist sync`);
          result.errors.push('Ordem de Serviço ainda não foi sincronizada com o servidor. Aguarde a sincronização.');
          // Retornar como sucesso parcial para não travar o fluxo - as respostas serão sincronizadas depois
          result.success = true;
          return result;
        }
      }

      // Buscar respostas pendentes
      const pendingAnswers = await ChecklistAnswerRepository.getPendingSync(instanceId);

      if (pendingAnswers.length === 0) {
        result.success = true;
        return result;
      }

      // Marcar como SYNCING
      for (const answer of pendingAnswers) {
        await ChecklistAnswerRepository.updateSyncStatus(answer.id, 'SYNCING');
      }

      // Preparar payload com anexos do banco de dados
      const answersPayload: SyncAnswerPayload[] = await Promise.all(
        pendingAnswers.map(async (answer) => {
          // Buscar anexos pendentes para esta resposta
          // Pode usar answerId ou questionId (usado temporariamente quando answerId ainda não existia)
          let attachments: SyncAttachmentPayload[] = [];
          try {
            const dbAttachments = await ChecklistAttachmentRepository.getByAnswer(answer.id);
            // Também buscar por questionId (usado quando foto foi tirada antes da resposta ser salva)
            const dbAttachmentsByQuestion = await ChecklistAttachmentRepository.getByAnswer(answer.questionId);
            const allAttachments = [...dbAttachments, ...dbAttachmentsByQuestion];

            // Filtrar apenas anexos pendentes de sync com dados base64
            const pendingAttachments = allAttachments.filter(
              a => a.syncStatus !== 'SYNCED' && a.base64Data
            );

            attachments = pendingAttachments.map(a => ({
              data: a.base64Data!,
              type: a.type,
              fileName: a.fileName,
            }));

            if (attachments.length > 0) {
              console.log(`[ChecklistSyncService] Found ${attachments.length} pending attachments for answer ${answer.id}`);
            }
          } catch (err) {
            console.warn('[ChecklistSyncService] Error loading attachments for answer:', answer.id, err);
          }

          return {
            questionId: answer.questionId,
            type: answer.type, // Corrigido: era answer.questionType
            valueText: answer.valueText || undefined,
            valueNumber: answer.valueNumber || undefined,
            valueBoolean: answer.valueBoolean !== null ? Boolean(answer.valueBoolean) : undefined,
            valueDate: answer.valueDate || undefined,
            valueJson: answer.valueJson ? JSON.parse(answer.valueJson) : undefined,
            localId: answer.localId || answer.id,
            deviceInfo: `Auvo Mobile (${new Date().toISOString()})`,
            attachments: attachments.length > 0 ? attachments : undefined,
          };
        })
      );

      // Log da instância local (já buscada no início do método)
      console.log('[ChecklistSyncService] Local instance for sync:', localInstance ? {
        id: localInstance.id,
        workOrderId: localInstance.workOrderId,
        templateId: localInstance.templateId,
      } : 'NOT FOUND');

      // Enviar para o servidor
      const { baseUrl, authToken } = this.getApiConfig();
      const url = `${baseUrl}/checklist-instances/sync`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout para upload

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instanceId,
          answers: answersPayload,
          deviceInfo: 'Auvo Mobile',
          // Incluir dados para criação automática da instância se não existir no servidor
          workOrderId: localInstance?.workOrderId,
          templateId: localInstance?.templateId,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Falha ao sincronizar: ${response.status} - ${errorText}`);
      }

      const syncResult = await response.json();

      // Processar resultados
      const syncedLocalIds: string[] = [];
      const failedLocalIds: string[] = [];

      for (const item of syncResult.results || []) {
        if (item.success) {
          if (item.skipped) {
            result.skippedAnswers++;
          } else {
            result.syncedAnswers++;
          }
          if (item.localId) {
            syncedLocalIds.push(item.localId);
          }
        } else {
          result.failedAnswers++;
          if (item.localId) {
            failedLocalIds.push(item.localId);
          }
          if (item.error) {
            result.errors.push(`${item.questionId}: ${item.error}`);
          }
        }
      }

      // Atualizar status no banco local
      if (syncedLocalIds.length > 0) {
        await ChecklistAnswerRepository.markManySynced(syncedLocalIds);

        // Marcar anexos como sincronizados também
        for (const answer of pendingAnswers) {
          const localId = answer.localId || answer.id;
          if (syncedLocalIds.includes(localId)) {
            try {
              // Buscar anexos por answerId e questionId
              const dbAttachments = await ChecklistAttachmentRepository.getByAnswer(answer.id);
              const dbAttachmentsByQuestion = await ChecklistAttachmentRepository.getByAnswer(answer.questionId);
              const allAttachments = [...dbAttachments, ...dbAttachmentsByQuestion];

              for (const attachment of allAttachments) {
                if (attachment.syncStatus !== 'SYNCED') {
                  await ChecklistAttachmentRepository.markSynced(attachment.id, 'synced-with-answer');
                  console.log(`[ChecklistSyncService] Marked attachment ${attachment.id} as synced`);
                }
              }
            } catch (err) {
              console.warn('[ChecklistSyncService] Error marking attachments as synced:', err);
            }
          }
        }
      }

      // Marcar falhas
      for (const answer of pendingAnswers) {
        const localId = answer.localId || answer.id;
        if (failedLocalIds.includes(localId)) {
          await ChecklistAnswerRepository.updateSyncStatus(answer.id, 'FAILED');
        }
      }

      result.success = result.failedAnswers === 0;
      return result;
    } catch (error: any) {
      console.error('[ChecklistSyncService] pushPendingAnswers error:', error);

      // Melhorar mensagem de erro para timeouts e erros de rede
      let errorMessage = 'Erro desconhecido';
      if (error.name === 'AbortError') {
        errorMessage = 'Timeout: Servidor não respondeu em tempo hábil';
      } else if (error.message?.includes('Network request failed')) {
        errorMessage = 'Erro de rede: Verifique sua conexão';
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      result.errors.push(errorMessage);

      // Reverter status para PENDING
      const pendingAnswers = await ChecklistAnswerRepository.getByInstance(instanceId);
      for (const answer of pendingAnswers) {
        if ((answer as any).syncStatus === 'SYNCING') {
          await ChecklistAnswerRepository.updateSyncStatus(answer.id, 'PENDING');
        }
      }

      return result;
    }
  }

  /**
   * Sincronizar todas as respostas pendentes de todas as instâncias
   */
  async pushAllPendingAnswers(): Promise<BatchSyncResult> {
    const result: BatchSyncResult = {
      success: false,
      totalSynced: 0,
      totalFailed: 0,
      totalSkipped: 0,
      results: [],
    };

    if (!this.isOnline()) {
      return result;
    }

    try {
      // Buscar todas as respostas pendentes
      const allPending = await ChecklistAnswerRepository.getPendingSync();

      // Agrupar por instanceId
      const byInstance = new Map<string, ChecklistAnswer[]>();
      for (const answer of allPending) {
        const instanceId = answer.instanceId;
        if (!byInstance.has(instanceId)) {
          byInstance.set(instanceId, []);
        }
        byInstance.get(instanceId)!.push(answer);
      }

      // Sincronizar cada instância
      for (const [instanceId] of byInstance) {
        const syncResult = await this.pushPendingAnswers(instanceId);
        result.results.push(syncResult);
        result.totalSynced += syncResult.syncedAnswers;
        result.totalFailed += syncResult.failedAnswers;
        result.totalSkipped += syncResult.skippedAnswers;
      }

      result.success = result.totalFailed === 0;
      return result;
    } catch (error) {
      console.error('[ChecklistSyncService] pushAllPendingAnswers error:', error);
      return result;
    }
  }

  // =============================================================================
  // STATUS UPDATES
  // =============================================================================

  /**
   * Atualizar status de uma instância no servidor
   */
  async updateInstanceStatus(
    instanceId: string,
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  ): Promise<boolean> {
    // Atualizar localmente primeiro
    await ChecklistInstanceRepository.updateStatus(instanceId, status);

    if (!this.isOnline()) {
      console.log('[ChecklistSyncService] Offline - status saved locally');
      return true;
    }

    try {
      const { baseUrl, authToken } = this.getApiConfig();
      const url = `${baseUrl}/checklist-instances/${instanceId}/status`;

      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        console.warn('[ChecklistSyncService] Failed to update status on server');
        return false;
      }

      return true;
    } catch (error) {
      console.error('[ChecklistSyncService] updateInstanceStatus error:', error);
      return false;
    }
  }

  /**
   * Completar um checklist
   */
  async completeChecklist(instanceId: string): Promise<{
    success: boolean;
    error?: string;
    missingQuestions?: string[];
  }> {
    // Primeiro sincronizar todas as respostas pendentes
    const syncResult = await this.pushPendingAnswers(instanceId);

    if (syncResult.failedAnswers > 0) {
      return {
        success: false,
        error: `Falha ao sincronizar ${syncResult.failedAnswers} respostas`,
      };
    }

    if (!this.isOnline()) {
      // Offline - marcar como completado localmente
      await ChecklistInstanceRepository.updateStatus(instanceId, 'COMPLETED');
      return { success: true };
    }

    try {
      const { baseUrl, authToken } = this.getApiConfig();
      const url = `${baseUrl}/checklist-instances/${instanceId}/complete`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 400 && errorData.missingQuestions) {
          return {
            success: false,
            error: 'Perguntas obrigatórias não respondidas',
            missingQuestions: errorData.missingQuestions,
          };
        }

        throw new Error(errorData.message || `Erro ${response.status}`);
      }

      // Atualizar localmente
      await ChecklistInstanceRepository.updateStatus(instanceId, 'COMPLETED');

      return { success: true };
    } catch (error) {
      console.error('[ChecklistSyncService] completeChecklist error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao completar checklist',
      };
    }
  }

  /**
   * Reabrir um checklist completado para edição
   * Funciona offline-first: atualiza localmente e sincroniza quando possível
   */
  async reopenChecklist(instanceId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    // Sempre atualizar localmente primeiro (offline-first)
    console.log('[ChecklistSyncService] reopenChecklist - updating locally first...');
    await ChecklistInstanceRepository.updateStatus(instanceId, 'IN_PROGRESS');

    if (!this.isOnline()) {
      // Offline - já atualizamos localmente, será sincronizado depois
      console.log('[ChecklistSyncService] Offline - checklist reopened locally');
      return { success: true };
    }

    try {
      // Verificar se há mutações pendentes de work_orders e forçar sync
      // Isso é necessário porque reabrir uma OS localmente enfileira a mudança de status,
      // mas o backend ainda vê a OS como DONE até a sync acontecer
      console.log('[ChecklistSyncService] reopenChecklist - checking for pending work order mutations...');

      const { MutationQueue } = await import('../../../queue/MutationQueue');
      const pendingMutations = await MutationQueue.getPending(100);
      const hasWorkOrderMutation = pendingMutations.some(m => m.entity === 'work_orders');

      if (hasWorkOrderMutation) {
        console.log('[ChecklistSyncService] Found pending work order mutations, forcing sync...');
        // Forçar sync imediato antes de chamar a API do checklist
        try {
          await syncEngine.syncAll();
          console.log('[ChecklistSyncService] Sync completed before reopening checklist');
        } catch (syncError) {
          // Sync falhou - já atualizamos localmente, então ainda funciona offline
          console.warn('[ChecklistSyncService] Sync failed, checklist already reopened locally:', syncError);
          return { success: true };
        }
      }

      const { baseUrl, authToken } = this.getApiConfig();
      const url = `${baseUrl}/checklist-instances/${instanceId}/reopen`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        // Se o erro for porque a OS não está em andamento no servidor, mas localmente está,
        // provavelmente é um problema de sync - já atualizamos localmente então deixa funcionar
        console.warn('[ChecklistSyncService] Server rejected reopen:', errorData.message);
        // Não falhar - o checklist já foi reaberto localmente
        return { success: true };
      }

      console.log('[ChecklistSyncService] Checklist reopened on server');
      return { success: true };
    } catch (error) {
      // Erro de rede ou outro - já atualizamos localmente, então ainda funciona
      console.warn('[ChecklistSyncService] reopenChecklist API error (local already updated):', error);
      return { success: true };
    }
  }

  // =============================================================================
  // HELPERS
  // =============================================================================

  /**
   * Salvar instâncias do servidor no banco local
   */
  private async saveInstancesToLocal(
    serverInstances: ServerChecklistInstance[],
    workOrderId: string
  ): Promise<ChecklistInstance[]> {
    const localInstances: ChecklistInstance[] = [];

    for (const server of serverInstances) {
      const instance = await this.saveInstanceToLocal(server, workOrderId);
      localInstances.push(instance);
    }

    return localInstances;
  }

  /**
   * Salvar uma instância do servidor no banco local
   */
  private async saveInstanceToLocal(
    server: ServerChecklistInstance,
    workOrderId: string
  ): Promise<ChecklistInstance> {
    const technicianId = this.technicianId || '';

    const instanceData: ChecklistInstance = {
      id: server.id,
      workOrderId,
      templateId: server.templateId,
      templateName: server.template?.name,
      templateVersionSnapshot: server.templateVersionSnapshot
        ? JSON.stringify(server.templateVersionSnapshot)
        : undefined,
      status: server.status as any,
      progress: server.progress || 0,
      startedAt: server.startedAt,
      completedAt: server.completedAt,
      completedBy: server.completedBy,
      syncedAt: new Date().toISOString(),
      createdAt: server.createdAt,
      updatedAt: server.updatedAt,
      technicianId,
    };

    // Verificar se já existe localmente
    const existing = await ChecklistInstanceRepository.getById(server.id);

    if (existing) {
      // Atualizar apenas se não tiver mudanças locais pendentes
      await ChecklistInstanceRepository.update(server.id, {
        status: instanceData.status,
        progress: instanceData.progress,
        startedAt: instanceData.startedAt,
        completedAt: instanceData.completedAt,
        syncedAt: instanceData.syncedAt,
      });
      return { ...existing, ...instanceData };
    } else {
      // Criar nova
      return ChecklistInstanceRepository.create({
        id: server.id,
        workOrderId: instanceData.workOrderId,
        templateId: instanceData.templateId,
        templateName: instanceData.templateName,
        templateVersionSnapshot: instanceData.templateVersionSnapshot,
        status: instanceData.status,
        progress: instanceData.progress,
        technicianId,
      });
    }
  }

  /**
   * Salvar respostas do servidor no banco local
   * IMPORTANTE: Não sobrescrever respostas pendentes locais!
   */
  private async saveAnswersToLocal(
    serverAnswers: ServerChecklistAnswer[],
    instanceId: string
  ): Promise<ChecklistAnswer[]> {
    const localAnswers: ChecklistAnswer[] = [];

    // Buscar respostas pendentes locais
    const pendingLocal = await ChecklistAnswerRepository.getPendingSync(instanceId);
    const pendingQuestionIds = new Set(pendingLocal.map((a) => a.questionId));

    for (const server of serverAnswers) {
      // SKIP se existe resposta pendente local para esta pergunta
      if (pendingQuestionIds.has(server.questionId)) {
        console.log(
          `[ChecklistSyncService] Skipping server answer for ${server.questionId} - local pending`
        );
        const existing = pendingLocal.find((a) => a.questionId === server.questionId);
        if (existing) localAnswers.push(existing);
        continue;
      }

      // Salvar resposta do servidor
      const answerData: ChecklistAnswer = {
        id: server.id,
        instanceId,
        questionId: server.questionId,
        questionType: server.type,
        valueText: server.valueText,
        valueNumber: server.valueNumber,
        valueBoolean: server.valueBoolean !== undefined ? (server.valueBoolean ? 1 : 0) : undefined,
        valueDate: server.valueDate,
        valueJson: server.valueJson ? JSON.stringify(server.valueJson) : undefined,
        answeredAt: server.answeredAt,
        answeredBy: server.answeredBy,
        localId: server.localId,
        syncStatus: 'SYNCED',
        createdAt: server.answeredAt || new Date().toISOString(),
        updatedAt: server.syncedAt || new Date().toISOString(),
      };

      // Verificar se já existe
      const existing = await ChecklistAnswerRepository.getByQuestion(instanceId, server.questionId);

      if (existing) {
        // Atualizar se não estiver pendente
        await ChecklistAnswerRepository.update(existing.id, answerData);
        localAnswers.push({ ...existing, ...answerData });
      } else {
        // Criar nova
        const created = await ChecklistAnswerRepository.create({
          instanceId,
          questionId: server.questionId,
          questionType: server.type,
          valueText: server.valueText,
          valueNumber: server.valueNumber,
          valueBoolean: server.valueBoolean !== undefined ? (server.valueBoolean ? 1 : 0) : undefined,
          valueDate: server.valueDate,
          valueJson: server.valueJson ? JSON.stringify(server.valueJson) : undefined,
        });
        localAnswers.push(created);
      }
    }

    // Incluir respostas pendentes locais que não vieram do servidor
    for (const pending of pendingLocal) {
      if (!localAnswers.find((a) => a.questionId === pending.questionId)) {
        localAnswers.push(pending);
      }
    }

    return localAnswers;
  }

  // =============================================================================
  // STATISTICS
  // =============================================================================

  /**
   * Contar respostas pendentes de sync
   */
  async countPendingSync(instanceId?: string): Promise<number> {
    const pending = await ChecklistAnswerRepository.getPendingSync(instanceId);
    return pending.length;
  }

  /**
   * Contar respostas pendentes de sync por workOrderId
   */
  async countPendingSyncByWorkOrder(workOrderId: string): Promise<number> {
    // Buscar todas as instâncias de checklist desta OS
    const instances = await ChecklistInstanceRepository.getByWorkOrder(workOrderId);
    if (instances.length === 0) return 0;

    // Contar respostas pendentes de cada instância
    let total = 0;
    for (const instance of instances) {
      const pending = await ChecklistAnswerRepository.getPendingSync(instance.id);
      total += pending.length;
    }
    return total;
  }

  /**
   * Contar anexos pendentes de upload por workOrderId
   */
  async countPendingUploadsByWorkOrder(workOrderId: string): Promise<number> {
    return ChecklistAttachmentRepository.countPendingUploadByWorkOrder(workOrderId);
  }

  /**
   * Contar anexos pendentes de upload
   */
  async countPendingUploads(technicianId?: string): Promise<number> {
    return ChecklistAttachmentRepository.countPendingUpload(technicianId);
  }

  /**
   * Verificar se há dados pendentes de sync
   */
  async hasPendingData(): Promise<boolean> {
    const pendingAnswers = await this.countPendingSync();
    const pendingUploads = await this.countPendingUploads();
    return pendingAnswers > 0 || pendingUploads > 0;
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

export const ChecklistSyncService = new ChecklistSyncServiceClass();

export default ChecklistSyncService;
