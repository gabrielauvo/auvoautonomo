/**
 * Combined Load Test
 *
 * Teste de carga combinado que simula uso real do sistema.
 * Executa sync, PDF e public links em paralelo com diferentes pesos.
 *
 * Este cenario e mais realista pois simula:
 * - Usuarios do app mobile sincronizando dados
 * - Usuarios do web gerando PDFs
 * - Clientes acessando links publicos
 *
 * Tudo acontecendo simultaneamente como em producao.
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';
import {
  config,
  getRandomToken,
  getRandomId,
  getAuthHeaders,
  getPublicHeaders,
  thresholds,
} from '../config.js';

// =============================================================================
// CUSTOM METRICS
// =============================================================================

const overallErrorRate = new Rate('overall_errors');
const syncOperations = new Counter('sync_operations_total');
const pdfOperations = new Counter('pdf_operations_total');
const publicOperations = new Counter('public_operations_total');

// Latencias por tipo
const syncLatency = new Trend('sync_latency', true);
const pdfLatency = new Trend('pdf_latency', true);
const publicLatency = new Trend('public_latency', true);

// =============================================================================
// K6 OPTIONS - CENARIOS PARALELOS
// =============================================================================

export const options = {
  scenarios: {
    // Usuarios mobile sincronizando (maior volume)
    mobile_sync: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 30 },   // Ramp up
        { duration: '5m', target: 30 },   // Steady
        { duration: '2m', target: 50 },   // Peak
        { duration: '3m', target: 50 },   // Steady at peak
        { duration: '1m', target: 0 },    // Ramp down
      ],
      exec: 'mobileSync',
      tags: { scenario: 'mobile_sync' },
    },

    // Usuarios web gerando PDFs (volume medio)
    web_pdf: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 10 },
        { duration: '5m', target: 10 },
        { duration: '2m', target: 20 },
        { duration: '3m', target: 20 },
        { duration: '1m', target: 0 },
      ],
      exec: 'webPdfGeneration',
      tags: { scenario: 'web_pdf' },
    },

    // Clientes acessando links publicos (volume variavel)
    public_access: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 20 },
        { duration: '5m', target: 20 },
        { duration: '2m', target: 40 },
        { duration: '3m', target: 40 },
        { duration: '1m', target: 0 },
      ],
      exec: 'publicAccess',
      tags: { scenario: 'public_access' },
    },
  },

  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    http_req_failed: ['rate<0.05'],
    errors: ['rate<0.05'],
    overall_errors: ['rate<0.05'],
    sync_latency: ['p(95)<2000'],
    pdf_latency: ['p(95)<10000'],
    public_latency: ['p(95)<500'],
  },
};

// =============================================================================
// MOBILE SYNC SCENARIO
// =============================================================================

export function mobileSync() {
  const token = getRandomToken();
  const headers = getAuthHeaders(token);

  group('Mobile Sync Cycle', () => {
    // Delta sync de todas as entidades
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // Ultima hora

    // Pull quotes
    let startTime = Date.now();
    let response = http.get(
      `${config.baseUrl}/sync/quotes?limit=100&since=${since}`,
      { headers, tags: { type: 'sync_pull' } }
    );
    syncLatency.add(Date.now() - startTime);
    syncOperations.add(1);

    let success = check(response, {
      'sync quotes ok': (r) => r.status === 200,
    });
    overallErrorRate.add(!success);

    sleep(0.2);

    // Pull work orders
    startTime = Date.now();
    response = http.get(
      `${config.baseUrl}/work-orders/sync?limit=100&since=${since}`,
      { headers, tags: { type: 'sync_pull' } }
    );
    syncLatency.add(Date.now() - startTime);
    syncOperations.add(1);

    success = check(response, {
      'sync work orders ok': (r) => r.status === 200,
    });
    overallErrorRate.add(!success);

    sleep(0.2);

    // Pull invoices
    startTime = Date.now();
    response = http.get(
      `${config.baseUrl}/sync/invoices?limit=100&since=${since}`,
      { headers, tags: { type: 'sync_pull' } }
    );
    syncLatency.add(Date.now() - startTime);
    syncOperations.add(1);

    success = check(response, {
      'sync invoices ok': (r) => r.status === 200,
    });
    overallErrorRate.add(!success);

    sleep(0.2);

    // Pull items
    startTime = Date.now();
    response = http.get(
      `${config.baseUrl}/sync/items?limit=100&since=${since}`,
      { headers, tags: { type: 'sync_pull' } }
    );
    syncLatency.add(Date.now() - startTime);
    syncOperations.add(1);

    success = check(response, {
      'sync items ok': (r) => r.status === 200,
    });
    overallErrorRate.add(!success);

    // Ocasionalmente faz push de mutacoes
    if (Math.random() > 0.7) {
      const mutations = [
        {
          mutationId: `mut_${randomString(16)}`,
          type: 'update',
          entityId: `wo_${randomString(12)}`,
          data: {
            status: 'IN_PROGRESS',
            clientUpdatedAt: new Date().toISOString(),
          },
        },
      ];

      startTime = Date.now();
      response = http.post(
        `${config.baseUrl}/work-orders/sync/mutations`,
        JSON.stringify({ mutations }),
        { headers, tags: { type: 'sync_push' } }
      );
      syncLatency.add(Date.now() - startTime);
      syncOperations.add(1);

      success = check(response, {
        'sync push ok': (r) => r.status === 200 || r.status === 201,
      });
      overallErrorRate.add(!success);
    }
  });

  sleep(randomIntBetween(3, 8));
}

// =============================================================================
// WEB PDF GENERATION SCENARIO
// =============================================================================

export function webPdfGeneration() {
  const token = getRandomToken();
  const headers = getAuthHeaders(token);
  const testData = config.testData;

  group('Web PDF Generation', () => {
    const entityChoice = Math.random();
    let entityType, entityId;

    if (entityChoice < 0.5) {
      entityType = 'quotes';
      entityId = getRandomId(testData.quoteIds);
    } else if (entityChoice < 0.8) {
      entityType = 'work-orders';
      entityId = getRandomId(testData.workOrderIds);
    } else {
      entityType = 'invoices';
      entityId = getRandomId(testData.invoiceIds);
    }

    // Gera PDF de forma assincrona
    const startTime = Date.now();
    const response = http.post(
      `${config.baseUrl}/${entityType}/${entityId}/generate-pdf-async`,
      JSON.stringify({}),
      { headers, tags: { type: 'pdf_async' } }
    );

    let success = check(response, {
      'pdf job created': (r) => r.status === 202,
    });
    overallErrorRate.add(!success);
    pdfOperations.add(1);

    if (success) {
      try {
        const jobId = JSON.parse(response.body).jobId;

        // Poll para status
        let completed = false;
        for (let i = 0; i < 15 && !completed; i++) {
          sleep(2);

          const statusResponse = http.get(
            `${config.baseUrl}/pdf-jobs/${jobId}`,
            { headers, tags: { type: 'pdf_status' } }
          );

          try {
            const status = JSON.parse(statusResponse.body).status;
            if (status === 'COMPLETED' || status === 'FAILED') {
              completed = true;
              pdfLatency.add(Date.now() - startTime);
            }
          } catch (e) {
            // ignore
          }
        }
      } catch (e) {
        // ignore
      }
    }
  });

  sleep(randomIntBetween(5, 15));
}

// =============================================================================
// PUBLIC ACCESS SCENARIO
// =============================================================================

export function publicAccess() {
  const headers = getPublicHeaders();
  const testData = config.testData;

  group('Public Link Access', () => {
    const accessChoice = Math.random();

    if (accessChoice < 0.5) {
      // Acessa orcamento publico
      const shareKey = getRandomId(testData.quoteShareKeys);

      const startTime = Date.now();
      const response = http.get(
        `${config.baseUrl}/public/quotes/${shareKey}`,
        { headers, tags: { type: 'public_quote' } }
      );
      publicLatency.add(Date.now() - startTime);
      publicOperations.add(1);

      const success = check(response, {
        'public quote ok': (r) => r.status === 200 || r.status === 429,
      });
      overallErrorRate.add(!success && response.status !== 429);

      // Simula leitura
      sleep(randomIntBetween(2, 5));

      // Pode buscar termos
      if (Math.random() > 0.6) {
        http.get(
          `${config.baseUrl}/public/quotes/${shareKey}/acceptance-terms`,
          { headers, tags: { type: 'public_terms' } }
        );
        publicOperations.add(1);
      }
    } else if (accessChoice < 0.7) {
      // Acessa OS publica
      const shareKey = getRandomId(testData.workOrderShareKeys);

      const startTime = Date.now();
      const response = http.get(
        `${config.baseUrl}/public/work-orders/${shareKey}`,
        { headers, tags: { type: 'public_wo' } }
      );
      publicLatency.add(Date.now() - startTime);
      publicOperations.add(1);

      const success = check(response, {
        'public work order ok': (r) => r.status === 200 || r.status === 429,
      });
      overallErrorRate.add(!success && response.status !== 429);
    } else {
      // Acessa pagamento publico
      const paymentToken = getRandomId(testData.paymentTokens);

      const startTime = Date.now();
      const response = http.get(
        `${config.baseUrl}/public/payments/${paymentToken}`,
        { headers, tags: { type: 'public_payment' } }
      );
      publicLatency.add(Date.now() - startTime);
      publicOperations.add(1);

      const success = check(response, {
        'public payment ok': (r) => r.status === 200 || r.status === 429,
      });
      overallErrorRate.add(!success && response.status !== 429);

      // Pode solicitar PIX ou boleto
      if (Math.random() > 0.5 && response.status === 200) {
        sleep(1);

        if (Math.random() > 0.4) {
          http.post(
            `${config.baseUrl}/public/payments/${paymentToken}/pix`,
            null,
            { headers, tags: { type: 'public_pix' } }
          );
        } else {
          http.post(
            `${config.baseUrl}/public/payments/${paymentToken}/boleto`,
            null,
            { headers, tags: { type: 'public_boleto' } }
          );
        }
        publicOperations.add(1);
      }
    }
  });

  sleep(randomIntBetween(1, 4));
}

// =============================================================================
// LIFECYCLE HOOKS
// =============================================================================

export function setup() {
  console.log('='.repeat(60));
  console.log('COMBINED LOAD TEST');
  console.log('='.repeat(60));
  console.log(`Base URL: ${config.baseUrl}`);
  console.log('');
  console.log('Scenarios:');
  console.log('  - mobile_sync: 30-50 VUs (mobile app sync)');
  console.log('  - web_pdf: 10-20 VUs (PDF generation)');
  console.log('  - public_access: 20-40 VUs (public links)');
  console.log('');
  console.log('Total duration: ~12 minutes');
  console.log('='.repeat(60));

  // Health check
  const response = http.get(`${config.baseUrl}/health`, { timeout: '10s' });
  if (response.status !== 200) {
    console.error('Server health check failed!');
  }

  return { startTime: Date.now() };
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log('='.repeat(60));
  console.log('COMBINED TEST COMPLETED');
  console.log(`Total duration: ${duration.toFixed(2)}s`);
  console.log('='.repeat(60));
}
