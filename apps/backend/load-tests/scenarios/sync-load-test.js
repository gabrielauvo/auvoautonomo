/**
 * Sync Load Test
 *
 * Testa a sincronizacao offline-first entre app mobile e web.
 * Simula multiplos usuarios sincronizando dados simultaneamente.
 *
 * Endpoints testados:
 * - GET /sync/quotes (pull)
 * - POST /sync/quotes/mutations (push)
 * - GET /sync/invoices (pull)
 * - POST /sync/invoices/mutations (push)
 * - GET /sync/categories (pull)
 * - POST /sync/categories (push)
 * - GET /sync/items (pull)
 * - POST /sync/items (push)
 * - GET /work-orders/sync (pull)
 * - POST /work-orders/sync/mutations (push)
 *
 * Cenarios:
 * - Sync inicial completo (sem `since`)
 * - Delta sync (com `since`)
 * - Push de mutacoes (create/update/delete)
 * - Conflitos de sync (multiplos usuarios editando)
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';
import {
  config,
  getScenario,
  getRandomToken,
  getAuthHeaders,
  thresholds,
} from '../config.js';

// =============================================================================
// CUSTOM METRICS
// =============================================================================

// Taxas de erro por operacao
const syncPullErrorRate = new Rate('sync_pull_errors');
const syncPushErrorRate = new Rate('sync_push_errors');

// Trends de latencia por operacao
const syncPullDuration = new Trend('sync_pull_duration', true);
const syncPushDuration = new Trend('sync_push_duration', true);

// Contadores
const syncPullCount = new Counter('sync_pull_total');
const syncPushCount = new Counter('sync_push_total');
const recordsSynced = new Counter('records_synced_total');

// =============================================================================
// K6 OPTIONS
// =============================================================================

export const options = {
  scenarios: {
    sync_test: getScenario(),
  },
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    http_req_failed: ['rate<0.05'],
    sync_pull_errors: ['rate<0.05'],      // < 5% erro em pulls
    sync_push_errors: ['rate<0.02'],      // < 2% erro em pushes
    sync_pull_duration: ['p(95)<2000'],   // 95% pulls < 2s
    sync_push_duration: ['p(95)<3000'],   // 95% pushes < 3s
  },
};

// =============================================================================
// TEST DATA GENERATORS
// =============================================================================

/**
 * Gera uma mutacao de quote para push
 */
function generateQuoteMutation(type = 'create') {
  const mutationId = `mut_${randomString(16)}`;
  const now = new Date().toISOString();

  if (type === 'create') {
    return {
      mutationId,
      type: 'create',
      data: {
        id: `quote_${randomString(12)}`,
        clientId: `client_${randomString(8)}`,
        title: `Orcamento Load Test ${randomString(6)}`,
        status: 'DRAFT',
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        items: [
          {
            id: `item_${randomString(8)}`,
            description: 'Servico de teste',
            quantity: randomIntBetween(1, 10),
            unitPrice: randomIntBetween(100, 1000) * 100, // centavos
          },
        ],
        clientUpdatedAt: now,
      },
    };
  }

  if (type === 'update') {
    return {
      mutationId,
      type: 'update',
      entityId: `quote_${randomString(12)}`,
      data: {
        title: `Orcamento Atualizado ${randomString(6)}`,
        clientUpdatedAt: now,
      },
    };
  }

  return {
    mutationId,
    type: 'delete',
    entityId: `quote_${randomString(12)}`,
  };
}

/**
 * Gera uma mutacao de work order para push
 */
function generateWorkOrderMutation(type = 'create') {
  const mutationId = `mut_${randomString(16)}`;
  const now = new Date().toISOString();

  if (type === 'create') {
    return {
      mutationId,
      type: 'create',
      data: {
        id: `wo_${randomString(12)}`,
        clientId: `client_${randomString(8)}`,
        title: `OS Load Test ${randomString(6)}`,
        status: 'PENDING',
        scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        description: 'Ordem de servico criada pelo teste de carga',
        items: [],
        clientUpdatedAt: now,
      },
    };
  }

  if (type === 'update_status') {
    return {
      mutationId,
      type: 'update_status',
      entityId: `wo_${randomString(12)}`,
      data: {
        status: 'IN_PROGRESS',
        clientUpdatedAt: now,
      },
    };
  }

  return {
    mutationId,
    type: 'update',
    entityId: `wo_${randomString(12)}`,
    data: {
      title: `OS Atualizada ${randomString(6)}`,
      clientUpdatedAt: now,
    },
  };
}

/**
 * Gera uma mutacao de invoice para push
 */
function generateInvoiceMutation(type = 'create') {
  const mutationId = `mut_${randomString(16)}`;
  const now = new Date().toISOString();

  if (type === 'create') {
    return {
      mutationId,
      type: 'create',
      data: {
        id: `inv_${randomString(12)}`,
        clientId: `client_${randomString(8)}`,
        status: 'DRAFT',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        items: [
          {
            id: `item_${randomString(8)}`,
            description: 'Servico faturado',
            quantity: 1,
            unitPrice: randomIntBetween(500, 5000) * 100,
          },
        ],
        clientUpdatedAt: now,
      },
    };
  }

  return {
    mutationId,
    type: 'update',
    entityId: `inv_${randomString(12)}`,
    data: {
      status: 'SENT',
      clientUpdatedAt: now,
    },
  };
}

/**
 * Gera mutacao de item do catalogo
 */
function generateItemMutation(type = 'create') {
  const mutationId = `mut_${randomString(16)}`;
  const now = new Date().toISOString();

  if (type === 'create') {
    return {
      mutationId,
      type: 'create',
      data: {
        id: `prod_${randomString(12)}`,
        name: `Produto Load Test ${randomString(6)}`,
        type: 'SERVICE',
        price: randomIntBetween(50, 500) * 100,
        isActive: true,
        clientUpdatedAt: now,
      },
    };
  }

  return {
    mutationId,
    type: 'update',
    entityId: `prod_${randomString(12)}`,
    data: {
      price: randomIntBetween(50, 500) * 100,
      clientUpdatedAt: now,
    },
  };
}

// =============================================================================
// SYNC OPERATIONS
// =============================================================================

/**
 * Pull de quotes (delta sync)
 */
function pullQuotes(token, since = null) {
  const headers = getAuthHeaders(token);
  let url = `${config.baseUrl}/sync/quotes?limit=100`;

  if (since) {
    url += `&since=${since}`;
  }

  const startTime = Date.now();
  const response = http.get(url, { headers, tags: { type: 'sync_pull' } });
  const duration = Date.now() - startTime;

  syncPullDuration.add(duration);
  syncPullCount.add(1);

  const success = check(response, {
    'pull quotes status 200': (r) => r.status === 200,
    'pull quotes has data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data !== undefined;
      } catch (e) {
        return false;
      }
    },
  });

  syncPullErrorRate.add(!success);

  if (success) {
    try {
      const body = JSON.parse(response.body);
      recordsSynced.add(body.data ? body.data.length : 0);
    } catch (e) {
      // ignore
    }
  }

  return response;
}

/**
 * Push de mutacoes de quotes
 */
function pushQuoteMutations(token, mutations) {
  const headers = getAuthHeaders(token);
  const url = `${config.baseUrl}/sync/quotes/mutations`;

  const startTime = Date.now();
  const response = http.post(url, JSON.stringify({ mutations }), {
    headers,
    tags: { type: 'sync_push' },
  });
  const duration = Date.now() - startTime;

  syncPushDuration.add(duration);
  syncPushCount.add(1);

  const success = check(response, {
    'push quotes status 200/201': (r) => r.status === 200 || r.status === 201,
    'push quotes has results': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.results !== undefined || body.processed !== undefined;
      } catch (e) {
        return false;
      }
    },
  });

  syncPushErrorRate.add(!success);
  return response;
}

/**
 * Pull de work orders (delta sync)
 */
function pullWorkOrders(token, since = null) {
  const headers = getAuthHeaders(token);
  let url = `${config.baseUrl}/work-orders/sync?limit=100`;

  if (since) {
    url += `&since=${since}`;
  }

  const startTime = Date.now();
  const response = http.get(url, { headers, tags: { type: 'sync_pull' } });
  const duration = Date.now() - startTime;

  syncPullDuration.add(duration);
  syncPullCount.add(1);

  const success = check(response, {
    'pull work orders status 200': (r) => r.status === 200,
    'pull work orders has data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data !== undefined;
      } catch (e) {
        return false;
      }
    },
  });

  syncPullErrorRate.add(!success);

  if (success) {
    try {
      const body = JSON.parse(response.body);
      recordsSynced.add(body.data ? body.data.length : 0);
    } catch (e) {
      // ignore
    }
  }

  return response;
}

/**
 * Push de mutacoes de work orders
 */
function pushWorkOrderMutations(token, mutations) {
  const headers = getAuthHeaders(token);
  const url = `${config.baseUrl}/work-orders/sync/mutations`;

  const startTime = Date.now();
  const response = http.post(url, JSON.stringify({ mutations }), {
    headers,
    tags: { type: 'sync_push' },
  });
  const duration = Date.now() - startTime;

  syncPushDuration.add(duration);
  syncPushCount.add(1);

  const success = check(response, {
    'push work orders status 200/201': (r) => r.status === 200 || r.status === 201,
  });

  syncPushErrorRate.add(!success);
  return response;
}

/**
 * Pull de invoices
 */
function pullInvoices(token, since = null) {
  const headers = getAuthHeaders(token);
  let url = `${config.baseUrl}/sync/invoices?limit=100`;

  if (since) {
    url += `&since=${since}`;
  }

  const startTime = Date.now();
  const response = http.get(url, { headers, tags: { type: 'sync_pull' } });
  const duration = Date.now() - startTime;

  syncPullDuration.add(duration);
  syncPullCount.add(1);

  const success = check(response, {
    'pull invoices status 200': (r) => r.status === 200,
  });

  syncPullErrorRate.add(!success);
  return response;
}

/**
 * Push de mutacoes de invoices
 */
function pushInvoiceMutations(token, mutations) {
  const headers = getAuthHeaders(token);
  const url = `${config.baseUrl}/sync/invoices/mutations`;

  const startTime = Date.now();
  const response = http.post(url, JSON.stringify({ mutations }), {
    headers,
    tags: { type: 'sync_push' },
  });
  const duration = Date.now() - startTime;

  syncPushDuration.add(duration);
  syncPushCount.add(1);

  const success = check(response, {
    'push invoices status 200/201': (r) => r.status === 200 || r.status === 201,
  });

  syncPushErrorRate.add(!success);
  return response;
}

/**
 * Pull de items do catalogo
 */
function pullItems(token, since = null) {
  const headers = getAuthHeaders(token);
  let url = `${config.baseUrl}/sync/items?limit=100`;

  if (since) {
    url += `&since=${since}`;
  }

  const startTime = Date.now();
  const response = http.get(url, { headers, tags: { type: 'sync_pull' } });
  const duration = Date.now() - startTime;

  syncPullDuration.add(duration);
  syncPullCount.add(1);

  const success = check(response, {
    'pull items status 200': (r) => r.status === 200,
  });

  syncPullErrorRate.add(!success);
  return response;
}

/**
 * Push de mutacoes de items
 */
function pushItemMutations(token, mutations) {
  const headers = getAuthHeaders(token);
  const url = `${config.baseUrl}/sync/items`;

  const startTime = Date.now();
  const response = http.post(url, JSON.stringify({ mutations }), {
    headers,
    tags: { type: 'sync_push' },
  });
  const duration = Date.now() - startTime;

  syncPushDuration.add(duration);
  syncPushCount.add(1);

  const success = check(response, {
    'push items status 200/201': (r) => r.status === 200 || r.status === 201,
  });

  syncPushErrorRate.add(!success);
  return response;
}

/**
 * Pull de categories
 */
function pullCategories(token, since = null) {
  const headers = getAuthHeaders(token);
  let url = `${config.baseUrl}/sync/categories?limit=100`;

  if (since) {
    url += `&since=${since}`;
  }

  const response = http.get(url, { headers, tags: { type: 'sync_pull' } });
  syncPullCount.add(1);

  const success = check(response, {
    'pull categories status 200': (r) => r.status === 200,
  });

  syncPullErrorRate.add(!success);
  return response;
}

// =============================================================================
// MAIN TEST FUNCTION
// =============================================================================

export default function () {
  const token = getRandomToken();

  // Simula um ciclo completo de sync do app mobile
  group('Full Sync Cycle', () => {
    // 1. Initial pull de todas as entidades (sync inicial ou delta)
    const useDeltaSync = Math.random() > 0.3; // 70% delta, 30% full
    const sinceDate = useDeltaSync
      ? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // Ultimas 24h
      : null;

    group('Pull All Entities', () => {
      pullQuotes(token, sinceDate);
      sleep(0.1);

      pullWorkOrders(token, sinceDate);
      sleep(0.1);

      pullInvoices(token, sinceDate);
      sleep(0.1);

      pullItems(token, sinceDate);
      sleep(0.1);

      pullCategories(token, sinceDate);
    });

    sleep(randomIntBetween(1, 3));

    // 2. Simula edicoes offline e push
    group('Push Mutations', () => {
      // 50% chance de ter mutacoes para enviar
      if (Math.random() > 0.5) {
        // Quotes
        if (Math.random() > 0.6) {
          const quoteMutations = [
            generateQuoteMutation('create'),
            generateQuoteMutation('update'),
          ];
          pushQuoteMutations(token, quoteMutations);
          sleep(0.2);
        }

        // Work Orders
        if (Math.random() > 0.5) {
          const woMutations = [
            generateWorkOrderMutation('create'),
            generateWorkOrderMutation('update_status'),
          ];
          pushWorkOrderMutations(token, woMutations);
          sleep(0.2);
        }

        // Invoices
        if (Math.random() > 0.7) {
          const invMutations = [generateInvoiceMutation('create')];
          pushInvoiceMutations(token, invMutations);
          sleep(0.2);
        }

        // Items
        if (Math.random() > 0.8) {
          const itemMutations = [generateItemMutation('create')];
          pushItemMutations(token, itemMutations);
        }
      }
    });

    sleep(randomIntBetween(1, 2));

    // 3. Re-pull para confirmar sync (reconciliacao)
    group('Reconciliation Pull', () => {
      const recentSince = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // Ultimos 5 min
      pullQuotes(token, recentSince);
      pullWorkOrders(token, recentSince);
    });
  });

  // Pausa entre ciclos (simula usuario trabalhando offline)
  sleep(randomIntBetween(2, 5));
}

// =============================================================================
// LIFECYCLE HOOKS
// =============================================================================

export function setup() {
  console.log('='.repeat(60));
  console.log('SYNC LOAD TEST');
  console.log('='.repeat(60));
  console.log(`Base URL: ${config.baseUrl}`);
  console.log(`Scenario: ${__ENV.SCENARIO || 'load'}`);
  console.log('='.repeat(60));

  // Verificar se o servidor esta acessivel
  const response = http.get(`${config.baseUrl}/health`, { timeout: '10s' });
  if (response.status !== 200) {
    console.error('Server health check failed!');
  }

  return { startTime: Date.now() };
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log('='.repeat(60));
  console.log('TEST COMPLETED');
  console.log(`Total duration: ${duration.toFixed(2)}s`);
  console.log('='.repeat(60));
}
