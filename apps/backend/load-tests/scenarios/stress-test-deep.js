/**
 * Deep Stress Test
 *
 * Teste de stress profundo que leva o sistema ao limite.
 * Testa múltiplos endpoints simultaneamente com carga crescente.
 *
 * Fases:
 * 1. Warm-up: 10 VUs por 1 minuto
 * 2. Carga normal: 50 VUs por 2 minutos
 * 3. Stress: 100 VUs por 2 minutos
 * 4. Pico: 150 VUs por 1 minuto
 * 5. Overload: 200 VUs por 1 minuto
 * 6. Recovery: volta para 50 VUs por 1 minuto
 * 7. Cool-down: 10 VUs por 1 minuto
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:3001';
const TOKEN = __ENV.TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0MmYyYTA0OC04ZjY5LTQyYzMtYTc3Ni0zNzZhMzQxOTFhNTUiLCJlbWFpbCI6ImdhYnJpZWxAYXV2by5jb20uYnIiLCJpYXQiOjE3NjY3NjIzMDMsImV4cCI6MTc2NzM2NzEwM30.9H-Ay1S1Xw-E4S-ZSu_PoBvQZulbjRp082Bny8xmojc';

// IDs reais do banco
const QUOTE_IDS = ['ea32cab8-f3fc-4b80-826e-a5e496297c45'];
const WORK_ORDER_IDS = [
  '4158821d-8edf-4fa6-8e4c-156ba1bf4816',
  '53bac44a-009f-4c70-ba94-e58438d29f78',
  '6f13eac7-8c0b-4542-ad94-857a21eb447b',
  'be6ddece-58fc-43fa-a5f7-e537c37f2865',
  'd298aca3-cf59-4b0a-a9cb-de73d7d797c1',
];
const QUOTE_SHARE_KEYS = ['szOnEI8nzab13iT5JfqiNA'];
const WO_SHARE_KEYS = ['-FIvASE3V_qIj9GUBibS0g', 'yty6UVm5txwIcZdXIHYUDw', 'nTkTIDkawGeU9wQi-C1Y_Q'];

// =============================================================================
// CUSTOM METRICS
// =============================================================================

// Error rates por tipo de operação
const healthErrors = new Rate('health_errors');
const authErrors = new Rate('auth_errors');
const quotesErrors = new Rate('quotes_errors');
const workOrdersErrors = new Rate('work_orders_errors');
const publicErrors = new Rate('public_errors');

// Latências por tipo
const healthLatency = new Trend('health_latency', true);
const authLatency = new Trend('auth_latency', true);
const quotesLatency = new Trend('quotes_latency', true);
const workOrdersLatency = new Trend('work_orders_latency', true);
const publicLatency = new Trend('public_latency', true);

// Contadores
const totalRequests = new Counter('total_requests');
const successfulRequests = new Counter('successful_requests');
const failedRequests = new Counter('failed_requests');

// Gauges
const activeVUs = new Gauge('active_vus');
const currentPhase = new Gauge('current_phase');

// =============================================================================
// K6 OPTIONS - STRESS PROFILE
// =============================================================================

const SCENARIO = __ENV.SCENARIO || 'stress';

const scenarios = {
  // Teste rápido para validação
  quick: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '30s', target: 10 },
      { duration: '1m', target: 20 },
      { duration: '30s', target: 50 },
      { duration: '1m', target: 50 },
      { duration: '30s', target: 0 },
    ],
  },
  // Stress test padrão
  stress: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '1m', target: 10 },    // Warm-up
      { duration: '2m', target: 50 },    // Carga normal
      { duration: '2m', target: 100 },   // Stress
      { duration: '1m', target: 150 },   // Pico
      { duration: '1m', target: 200 },   // Overload
      { duration: '1m', target: 50 },    // Recovery
      { duration: '1m', target: 0 },     // Cool-down
    ],
  },
  // Stress extremo
  extreme: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '1m', target: 50 },
      { duration: '2m', target: 100 },
      { duration: '2m', target: 200 },
      { duration: '2m', target: 300 },
      { duration: '1m', target: 400 },
      { duration: '1m', target: 500 },
      { duration: '2m', target: 100 },
      { duration: '1m', target: 0 },
    ],
  },
  // Spike test
  spike: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '30s', target: 10 },
      { duration: '10s', target: 200 },  // Spike instantâneo
      { duration: '1m', target: 200 },   // Sustenta o pico
      { duration: '10s', target: 10 },   // Queda rápida
      { duration: '1m', target: 10 },    // Recuperação
      { duration: '30s', target: 0 },
    ],
  },
  // Soak test (longa duração)
  soak: {
    executor: 'constant-vus',
    vus: 50,
    duration: '30m',
  },
};

export const options = {
  scenarios: {
    stress_test: scenarios[SCENARIO] || scenarios.stress,
  },
  thresholds: {
    http_req_duration: ['p(95)<3000', 'p(99)<5000'],
    http_req_failed: ['rate<0.15'],           // 15% erro tolerado em stress
    health_errors: ['rate<0.01'],             // Health deve ser sempre estável
    health_latency: ['p(95)<100'],            // Health < 100ms
    auth_errors: ['rate<0.10'],
    quotes_errors: ['rate<0.20'],
    work_orders_errors: ['rate<0.20'],
    public_errors: ['rate<0.20'],
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getAuthHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + TOKEN,
  };
}

function getRandomItem(arr) {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

// =============================================================================
// TEST OPERATIONS
// =============================================================================

/**
 * Health check - deve ser sempre rápido e estável
 */
function testHealth() {
  const start = Date.now();
  const response = http.get(BASE_URL + '/health', {
    tags: { type: 'health' },
  });
  const duration = Date.now() - start;

  healthLatency.add(duration);
  totalRequests.add(1);

  const success = check(response, {
    'health status 200': function(r) { return r.status === 200; },
    'health has ok status': function(r) {
      try {
        return JSON.parse(r.body).status === 'ok';
      } catch (e) {
        return false;
      }
    },
  });

  healthErrors.add(!success);
  if (success) {
    successfulRequests.add(1);
  } else {
    failedRequests.add(1);
  }

  return success;
}

/**
 * Auth - verifica autenticação
 */
function testAuth() {
  const start = Date.now();
  const response = http.get(BASE_URL + '/auth/me', {
    headers: getAuthHeaders(),
    tags: { type: 'auth' },
  });
  const duration = Date.now() - start;

  authLatency.add(duration);
  totalRequests.add(1);

  const success = check(response, {
    'auth status 200': function(r) { return r.status === 200; },
    'auth has user id': function(r) {
      try {
        return JSON.parse(r.body).id !== undefined;
      } catch (e) {
        return false;
      }
    },
  });

  authErrors.add(!success);
  if (success) {
    successfulRequests.add(1);
  } else {
    failedRequests.add(1);
  }

  return success;
}

/**
 * Quotes - lista e busca orçamentos
 */
function testQuotes() {
  const start = Date.now();
  const response = http.get(BASE_URL + '/quotes', {
    headers: getAuthHeaders(),
    tags: { type: 'quotes_list' },
  });
  const duration = Date.now() - start;

  quotesLatency.add(duration);
  totalRequests.add(1);

  const success = check(response, {
    'quotes list status 200': function(r) { return r.status === 200; },
  });

  quotesErrors.add(!success);
  if (success) {
    successfulRequests.add(1);
  } else {
    failedRequests.add(1);
  }

  // Busca um quote específico
  if (success && QUOTE_IDS.length > 0) {
    sleep(0.1);
    const quoteId = getRandomItem(QUOTE_IDS);
    const detailStart = Date.now();
    const detailResponse = http.get(BASE_URL + '/quotes/' + quoteId, {
      headers: getAuthHeaders(),
      tags: { type: 'quotes_detail' },
    });
    quotesLatency.add(Date.now() - detailStart);
    totalRequests.add(1);

    const detailSuccess = check(detailResponse, {
      'quote detail status 200': function(r) { return r.status === 200; },
    });

    quotesErrors.add(!detailSuccess);
    if (detailSuccess) {
      successfulRequests.add(1);
    } else {
      failedRequests.add(1);
    }
  }

  return success;
}

/**
 * Work Orders - lista e busca ordens de serviço
 */
function testWorkOrders() {
  const start = Date.now();
  const response = http.get(BASE_URL + '/work-orders', {
    headers: getAuthHeaders(),
    tags: { type: 'work_orders_list' },
  });
  const duration = Date.now() - start;

  workOrdersLatency.add(duration);
  totalRequests.add(1);

  const success = check(response, {
    'work orders list status 200': function(r) { return r.status === 200; },
  });

  workOrdersErrors.add(!success);
  if (success) {
    successfulRequests.add(1);
  } else {
    failedRequests.add(1);
  }

  // Busca uma work order específica
  if (success && WORK_ORDER_IDS.length > 0) {
    sleep(0.1);
    const woId = getRandomItem(WORK_ORDER_IDS);
    const detailStart = Date.now();
    const detailResponse = http.get(BASE_URL + '/work-orders/' + woId, {
      headers: getAuthHeaders(),
      tags: { type: 'work_orders_detail' },
    });
    workOrdersLatency.add(Date.now() - detailStart);
    totalRequests.add(1);

    const detailSuccess = check(detailResponse, {
      'work order detail status 200': function(r) { return r.status === 200; },
    });

    workOrdersErrors.add(!detailSuccess);
    if (detailSuccess) {
      successfulRequests.add(1);
    } else {
      failedRequests.add(1);
    }
  }

  return success;
}

/**
 * Public endpoints - acesso sem autenticação
 */
function testPublicEndpoints() {
  // Testa quote público
  if (QUOTE_SHARE_KEYS.length > 0) {
    const shareKey = getRandomItem(QUOTE_SHARE_KEYS);
    const start = Date.now();
    const response = http.get(BASE_URL + '/public/quotes/' + shareKey, {
      tags: { type: 'public_quote' },
    });
    publicLatency.add(Date.now() - start);
    totalRequests.add(1);

    const success = check(response, {
      'public quote responds': function(r) {
        return r.status === 200 || r.status === 404 || r.status === 429;
      },
    });

    publicErrors.add(!success && response.status >= 500);
    if (success) {
      successfulRequests.add(1);
    } else {
      failedRequests.add(1);
    }
  }

  sleep(0.2);

  // Testa work order público
  if (WO_SHARE_KEYS.length > 0) {
    const shareKey = getRandomItem(WO_SHARE_KEYS);
    const start = Date.now();
    const response = http.get(BASE_URL + '/public/work-orders/' + shareKey, {
      tags: { type: 'public_work_order' },
    });
    publicLatency.add(Date.now() - start);
    totalRequests.add(1);

    const success = check(response, {
      'public work order responds': function(r) {
        return r.status === 200 || r.status === 404 || r.status === 429;
      },
    });

    publicErrors.add(!success && response.status >= 500);
    if (success) {
      successfulRequests.add(1);
    } else {
      failedRequests.add(1);
    }
  }
}

/**
 * Clients - lista clientes
 */
function testClients() {
  const start = Date.now();
  const response = http.get(BASE_URL + '/clients', {
    headers: getAuthHeaders(),
    tags: { type: 'clients' },
  });
  const duration = Date.now() - start;

  totalRequests.add(1);

  const success = check(response, {
    'clients list status 200': function(r) { return r.status === 200; },
  });

  if (success) {
    successfulRequests.add(1);
  } else {
    failedRequests.add(1);
  }

  return success;
}

/**
 * Items - lista items/serviços
 */
function testItems() {
  const start = Date.now();
  const response = http.get(BASE_URL + '/items', {
    headers: getAuthHeaders(),
    tags: { type: 'items' },
  });

  totalRequests.add(1);

  const success = check(response, {
    'items list status 200': function(r) { return r.status === 200; },
  });

  if (success) {
    successfulRequests.add(1);
  } else {
    failedRequests.add(1);
  }

  return success;
}

// =============================================================================
// MAIN TEST FUNCTION
// =============================================================================

export default function() {
  activeVUs.add(__VU);

  // Distribuição de operações baseada em uso real
  const operation = Math.random();

  group('Stress Test Operations', function() {
    if (operation < 0.15) {
      // 15% - Health checks (monitoramento)
      testHealth();
    } else if (operation < 0.25) {
      // 10% - Auth
      testAuth();
    } else if (operation < 0.40) {
      // 15% - Quotes
      testQuotes();
    } else if (operation < 0.55) {
      // 15% - Work Orders
      testWorkOrders();
    } else if (operation < 0.70) {
      // 15% - Public endpoints
      testPublicEndpoints();
    } else if (operation < 0.85) {
      // 15% - Clients
      testClients();
    } else {
      // 15% - Items
      testItems();
    }
  });

  // Pausa variável baseada na carga
  sleep(randomIntBetween(1, 3) / 10); // 0.1 a 0.3 segundos
}

// =============================================================================
// LIFECYCLE HOOKS
// =============================================================================

export function setup() {
  console.log('='.repeat(60));
  console.log('DEEP STRESS TEST');
  console.log('='.repeat(60));
  console.log('Base URL: ' + BASE_URL);
  console.log('Scenario: ' + SCENARIO);
  console.log('');
  console.log('Test Phases:');
  if (SCENARIO === 'stress') {
    console.log('  1. Warm-up: 10 VUs (1 min)');
    console.log('  2. Normal: 50 VUs (2 min)');
    console.log('  3. Stress: 100 VUs (2 min)');
    console.log('  4. Peak: 150 VUs (1 min)');
    console.log('  5. Overload: 200 VUs (1 min)');
    console.log('  6. Recovery: 50 VUs (1 min)');
    console.log('  7. Cool-down: 10 VUs (1 min)');
  }
  console.log('');
  console.log('Total estimated duration: ~9 minutes');
  console.log('='.repeat(60));

  // Verificação inicial
  var healthResponse = http.get(BASE_URL + '/health', { timeout: '10s' });
  if (healthResponse.status !== 200) {
    console.error('WARNING: Health check failed! Backend may not be ready.');
  } else {
    console.log('Backend health: OK');
  }

  var authResponse = http.get(BASE_URL + '/auth/me', {
    headers: getAuthHeaders(),
    timeout: '10s',
  });
  if (authResponse.status !== 200) {
    console.error('WARNING: Auth check failed! Token may be invalid.');
  } else {
    console.log('Authentication: OK');
  }

  console.log('');
  console.log('Starting stress test...');
  console.log('='.repeat(60));

  return { startTime: Date.now() };
}

export function teardown(data) {
  var duration = (Date.now() - data.startTime) / 1000;
  console.log('');
  console.log('='.repeat(60));
  console.log('STRESS TEST COMPLETED');
  console.log('='.repeat(60));
  console.log('Total duration: ' + duration.toFixed(2) + 's');
  console.log('='.repeat(60));
}
