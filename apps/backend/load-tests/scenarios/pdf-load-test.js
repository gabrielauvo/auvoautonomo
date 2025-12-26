/**
 * PDF Generation Load Test
 *
 * Testa a geracao de PDFs para orcamentos, ordens de servico e faturas.
 * Inclui testes para geracao sincrona e assincrona.
 *
 * Endpoints testados:
 * - POST /quotes/:id/generate-pdf (sincrono)
 * - POST /work-orders/:id/generate-pdf (sincrono)
 * - POST /invoices/:id/generate-pdf (sincrono)
 * - POST /quotes/:id/generate-pdf-async (assincrono)
 * - POST /work-orders/:id/generate-pdf-async (assincrono)
 * - POST /invoices/:id/generate-pdf-async (assincrono)
 * - GET /pdf-jobs/:id (status do job)
 * - GET /quotes/:id/pdf-status
 * - GET /work-orders/:id/pdf-status
 * - GET /invoices/:id/pdf-status
 *
 * Cenarios:
 * - Geracao sincrona (download direto)
 * - Geracao assincrona (job queue)
 * - Polling de status de job
 * - Carga concorrente em PDFs
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';
import {
  config,
  getScenario,
  getRandomToken,
  getRandomId,
  getAuthHeaders,
  thresholds,
} from '../config.js';

// =============================================================================
// CUSTOM METRICS
// =============================================================================

// Taxas de erro
const pdfSyncErrorRate = new Rate('pdf_sync_errors');
const pdfAsyncErrorRate = new Rate('pdf_async_errors');
const pdfStatusErrorRate = new Rate('pdf_status_errors');

// Trends de latencia
const pdfSyncDuration = new Trend('pdf_sync_duration', true);
const pdfAsyncRequestDuration = new Trend('pdf_async_request_duration', true);
const pdfJobCompletionTime = new Trend('pdf_job_completion_time', true);

// Contadores
const pdfGeneratedCount = new Counter('pdf_generated_total');
const pdfAsyncJobsCreated = new Counter('pdf_async_jobs_created');
const pdfAsyncJobsCompleted = new Counter('pdf_async_jobs_completed');

// Gauges
const pendingPdfJobs = new Gauge('pending_pdf_jobs');

// =============================================================================
// K6 OPTIONS
// =============================================================================

export const options = {
  scenarios: {
    pdf_test: getScenario(),
  },
  thresholds: {
    http_req_duration: ['p(95)<8000', 'p(99)<15000'],
    http_req_failed: ['rate<0.10'],
    pdf_sync_errors: ['rate<0.10'],                    // < 10% erro
    pdf_async_errors: ['rate<0.10'],                   // < 10% erro
    pdf_sync_duration: ['p(95)<8000', 'p(99)<15000'],  // PDF sync pode demorar
    pdf_async_request_duration: ['p(95)<500'],         // Criacao do job deve ser rapida
    pdf_job_completion_time: ['p(95)<30000'],          // Job completo em 30s
  },
};

// =============================================================================
// PDF GENERATION FUNCTIONS
// =============================================================================

/**
 * Gera PDF de quote de forma sincrona
 */
function generateQuotePdfSync(token, quoteId, download = false) {
  const headers = getAuthHeaders(token);
  const url = `${config.baseUrl}/quotes/${quoteId}/generate-pdf${download ? '?download=true' : ''}`;

  const startTime = Date.now();
  const response = http.post(url, null, {
    headers,
    tags: { type: 'pdf_sync', entity: 'quote' },
    timeout: '30s',
  });
  const duration = Date.now() - startTime;

  pdfSyncDuration.add(duration);

  const success = check(response, {
    'quote pdf sync status 200': (r) => r.status === 200,
    'quote pdf has content': (r) => {
      if (download) {
        return r.body && r.body.length > 1000; // PDF deve ter tamanho minimo
      }
      try {
        const body = JSON.parse(r.body);
        return body.url || body.attachmentId;
      } catch (e) {
        return false;
      }
    },
  });

  pdfSyncErrorRate.add(!success);
  if (success) pdfGeneratedCount.add(1);

  return response;
}

/**
 * Gera PDF de work order de forma sincrona
 */
function generateWorkOrderPdfSync(token, workOrderId, download = false) {
  const headers = getAuthHeaders(token);
  const url = `${config.baseUrl}/work-orders/${workOrderId}/generate-pdf${download ? '?download=true' : ''}`;

  const startTime = Date.now();
  const response = http.post(url, null, {
    headers,
    tags: { type: 'pdf_sync', entity: 'work_order' },
    timeout: '30s',
  });
  const duration = Date.now() - startTime;

  pdfSyncDuration.add(duration);

  const success = check(response, {
    'work order pdf sync status 200': (r) => r.status === 200,
  });

  pdfSyncErrorRate.add(!success);
  if (success) pdfGeneratedCount.add(1);

  return response;
}

/**
 * Gera PDF de invoice de forma sincrona
 */
function generateInvoicePdfSync(token, invoiceId, download = false) {
  const headers = getAuthHeaders(token);
  const url = `${config.baseUrl}/invoices/${invoiceId}/generate-pdf${download ? '?download=true' : ''}`;

  const startTime = Date.now();
  const response = http.post(url, null, {
    headers,
    tags: { type: 'pdf_sync', entity: 'invoice' },
    timeout: '30s',
  });
  const duration = Date.now() - startTime;

  pdfSyncDuration.add(duration);

  const success = check(response, {
    'invoice pdf sync status 200': (r) => r.status === 200,
  });

  pdfSyncErrorRate.add(!success);
  if (success) pdfGeneratedCount.add(1);

  return response;
}

/**
 * Solicita geracao assincrona de PDF de quote
 */
function requestQuotePdfAsync(token, quoteId) {
  const headers = getAuthHeaders(token);
  const url = `${config.baseUrl}/quotes/${quoteId}/generate-pdf-async`;

  const startTime = Date.now();
  const response = http.post(url, JSON.stringify({}), {
    headers,
    tags: { type: 'pdf_async', entity: 'quote' },
  });
  const duration = Date.now() - startTime;

  pdfAsyncRequestDuration.add(duration);

  const success = check(response, {
    'quote pdf async status 202': (r) => r.status === 202,
    'quote pdf async has jobId': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.jobId !== undefined;
      } catch (e) {
        return false;
      }
    },
  });

  pdfAsyncErrorRate.add(!success);

  if (success) {
    pdfAsyncJobsCreated.add(1);
    try {
      return JSON.parse(response.body).jobId;
    } catch (e) {
      return null;
    }
  }

  return null;
}

/**
 * Solicita geracao assincrona de PDF de work order
 */
function requestWorkOrderPdfAsync(token, workOrderId) {
  const headers = getAuthHeaders(token);
  const url = `${config.baseUrl}/work-orders/${workOrderId}/generate-pdf-async`;

  const startTime = Date.now();
  const response = http.post(url, JSON.stringify({}), {
    headers,
    tags: { type: 'pdf_async', entity: 'work_order' },
  });
  const duration = Date.now() - startTime;

  pdfAsyncRequestDuration.add(duration);

  const success = check(response, {
    'work order pdf async status 202': (r) => r.status === 202,
  });

  pdfAsyncErrorRate.add(!success);

  if (success) {
    pdfAsyncJobsCreated.add(1);
    try {
      return JSON.parse(response.body).jobId;
    } catch (e) {
      return null;
    }
  }

  return null;
}

/**
 * Solicita geracao assincrona de PDF de invoice
 */
function requestInvoicePdfAsync(token, invoiceId) {
  const headers = getAuthHeaders(token);
  const url = `${config.baseUrl}/invoices/${invoiceId}/generate-pdf-async`;

  const startTime = Date.now();
  const response = http.post(url, JSON.stringify({}), {
    headers,
    tags: { type: 'pdf_async', entity: 'invoice' },
  });
  const duration = Date.now() - startTime;

  pdfAsyncRequestDuration.add(duration);

  const success = check(response, {
    'invoice pdf async status 202': (r) => r.status === 202,
  });

  pdfAsyncErrorRate.add(!success);

  if (success) {
    pdfAsyncJobsCreated.add(1);
    try {
      return JSON.parse(response.body).jobId;
    } catch (e) {
      return null;
    }
  }

  return null;
}

/**
 * Verifica status de um job de PDF
 */
function checkPdfJobStatus(token, jobId) {
  const headers = getAuthHeaders(token);
  const url = `${config.baseUrl}/pdf-jobs/${jobId}`;

  const response = http.get(url, {
    headers,
    tags: { type: 'pdf_status' },
  });

  const success = check(response, {
    'pdf job status 200': (r) => r.status === 200,
  });

  pdfStatusErrorRate.add(!success);

  if (success) {
    try {
      const body = JSON.parse(response.body);
      return body.status; // PENDING, PROCESSING, COMPLETED, FAILED
    } catch (e) {
      return null;
    }
  }

  return null;
}

/**
 * Verifica status de PDF de uma entidade especifica
 */
function checkEntityPdfStatus(token, entityType, entityId) {
  const headers = getAuthHeaders(token);
  const url = `${config.baseUrl}/${entityType}/${entityId}/pdf-status`;

  const response = http.get(url, {
    headers,
    tags: { type: 'pdf_status', entity: entityType },
  });

  check(response, {
    [`${entityType} pdf status 200`]: (r) => r.status === 200,
  });

  return response;
}

/**
 * Aguarda conclusao de um job de PDF (polling)
 */
function waitForPdfJob(token, jobId, maxWaitMs = 30000) {
  const startTime = Date.now();
  const pollInterval = 1000; // 1 segundo entre polls

  while (Date.now() - startTime < maxWaitMs) {
    const status = checkPdfJobStatus(token, jobId);

    if (status === 'COMPLETED') {
      const completionTime = Date.now() - startTime;
      pdfJobCompletionTime.add(completionTime);
      pdfAsyncJobsCompleted.add(1);
      pdfGeneratedCount.add(1);
      return true;
    }

    if (status === 'FAILED') {
      return false;
    }

    sleep(pollInterval / 1000);
  }

  // Timeout
  return false;
}

// =============================================================================
// MAIN TEST FUNCTION
// =============================================================================

export default function () {
  const token = getRandomToken();
  const testData = config.testData;

  // Escolhe aleatoriamente entre sync e async
  const useAsync = Math.random() > 0.5;

  group('PDF Generation', () => {
    if (useAsync) {
      // Cenario: Geracao assincrona com polling
      group('Async PDF Generation', () => {
        const entityChoice = Math.random();
        let jobId = null;

        if (entityChoice < 0.4) {
          // 40% quotes
          const quoteId = getRandomId(testData.quoteIds);
          jobId = requestQuotePdfAsync(token, quoteId);
        } else if (entityChoice < 0.7) {
          // 30% work orders
          const woId = getRandomId(testData.workOrderIds);
          jobId = requestWorkOrderPdfAsync(token, woId);
        } else {
          // 30% invoices
          const invoiceId = getRandomId(testData.invoiceIds);
          jobId = requestInvoicePdfAsync(token, invoiceId);
        }

        // Aguarda conclusao do job
        if (jobId) {
          sleep(0.5);
          waitForPdfJob(token, jobId);
        }
      });
    } else {
      // Cenario: Geracao sincrona
      group('Sync PDF Generation', () => {
        const entityChoice = Math.random();
        const download = Math.random() > 0.7; // 30% download direto

        if (entityChoice < 0.4) {
          // 40% quotes
          const quoteId = getRandomId(testData.quoteIds);
          generateQuotePdfSync(token, quoteId, download);
        } else if (entityChoice < 0.7) {
          // 30% work orders
          const woId = getRandomId(testData.workOrderIds);
          generateWorkOrderPdfSync(token, woId, download);
        } else {
          // 30% invoices
          const invoiceId = getRandomId(testData.invoiceIds);
          generateInvoicePdfSync(token, invoiceId, download);
        }
      });
    }

    sleep(randomIntBetween(1, 3));

    // Ocasionalmente verifica status de PDFs existentes
    if (Math.random() > 0.7) {
      group('Check PDF Status', () => {
        const entityChoice = Math.random();

        if (entityChoice < 0.33) {
          checkEntityPdfStatus(token, 'quotes', getRandomId(testData.quoteIds));
        } else if (entityChoice < 0.66) {
          checkEntityPdfStatus(token, 'work-orders', getRandomId(testData.workOrderIds));
        } else {
          checkEntityPdfStatus(token, 'invoices', getRandomId(testData.invoiceIds));
        }
      });
    }
  });

  // Pausa entre requisicoes
  sleep(randomIntBetween(2, 5));
}

// =============================================================================
// BATCH PDF GENERATION TEST
// =============================================================================

/**
 * Cenario especial: Geracao em lote de multiplos PDFs
 * Simula um usuario gerando varios PDFs de uma vez
 */
export function batchPdfGeneration() {
  const token = getRandomToken();
  const testData = config.testData;

  group('Batch PDF Generation', () => {
    // Solicita 5 PDFs de uma vez (async)
    const jobIds = [];

    for (let i = 0; i < 5; i++) {
      const quoteId = getRandomId(testData.quoteIds);
      const jobId = requestQuotePdfAsync(token, quoteId);
      if (jobId) jobIds.push(jobId);
      sleep(0.2);
    }

    pendingPdfJobs.add(jobIds.length);

    // Aguarda todos completarem
    let completed = 0;
    for (const jobId of jobIds) {
      if (waitForPdfJob(token, jobId, 60000)) {
        completed++;
      }
    }

    pendingPdfJobs.add(-completed);

    check(null, {
      'batch: all PDFs completed': () => completed === jobIds.length,
      'batch: at least 80% completed': () => completed >= jobIds.length * 0.8,
    });
  });
}

// =============================================================================
// LIFECYCLE HOOKS
// =============================================================================

export function setup() {
  console.log('='.repeat(60));
  console.log('PDF GENERATION LOAD TEST');
  console.log('='.repeat(60));
  console.log(`Base URL: ${config.baseUrl}`);
  console.log(`Scenario: ${__ENV.SCENARIO || 'load'}`);
  console.log(`Quote IDs: ${config.testData.quoteIds.join(', ')}`);
  console.log(`Work Order IDs: ${config.testData.workOrderIds.join(', ')}`);
  console.log(`Invoice IDs: ${config.testData.invoiceIds.join(', ')}`);
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
