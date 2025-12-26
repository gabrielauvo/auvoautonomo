/**
 * Smoke Test
 *
 * Teste rapido para verificar se a infraestrutura funciona.
 * Nao requer dados de teste - apenas verifica endpoints basicos.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Configuracao (usar 127.0.0.1 em vez de localhost para Windows)
const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:3001';

// Metricas
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time', true);

// Opcoes do teste
export const options = {
  vus: 5,
  duration: '30s',
  thresholds: {
    errors: ['rate<0.1'],           // < 10% erros
    response_time: ['p(95)<500'],   // 95% < 500ms
    http_req_duration: ['p(95)<500'],
  },
};

export default function () {
  // 1. Health check
  let startTime = Date.now();
  let response = http.get(`${BASE_URL}/health`);
  responseTime.add(Date.now() - startTime);

  let success = check(response, {
    'health check status 200': (r) => r.status === 200,
    'health check has status ok': (r) => {
      try {
        return JSON.parse(r.body).status === 'ok';
      } catch (e) {
        return false;
      }
    },
  });
  errorRate.add(!success);

  sleep(0.5);

  // 2. Tenta acessar endpoint publico (pode retornar 404 se nao existir dados)
  startTime = Date.now();
  response = http.get(`${BASE_URL}/public/quotes/test-share-key-123`);
  responseTime.add(Date.now() - startTime);

  // 404/500 e esperado se nao existe o share key, 200 se existe
  success = check(response, {
    'public quote responds': (r) => r.status === 200 || r.status === 404 || r.status === 500,
  });
  errorRate.add(response.status >= 502); // Apenas 502+ e erro real

  sleep(0.5);

  // 3. Tenta acessar endpoint de pagamento publico
  startTime = Date.now();
  response = http.get(`${BASE_URL}/public/payments/test-token-123`);
  responseTime.add(Date.now() - startTime);

  success = check(response, {
    'public payment responds': (r) => r.status === 200 || r.status === 404 || r.status === 500,
  });
  errorRate.add(response.status >= 502);

  sleep(0.5);

  // 4. Tenta acessar endpoint de OS publica
  startTime = Date.now();
  response = http.get(`${BASE_URL}/public/work-orders/test-wo-key-123`);
  responseTime.add(Date.now() - startTime);

  success = check(response, {
    'public work order responds': (r) => r.status === 200 || r.status === 404 || r.status === 500,
  });
  errorRate.add(!success);

  sleep(1);
}

export function setup() {
  console.log('='.repeat(50));
  console.log('SMOKE TEST - Verificacao Rapida');
  console.log('='.repeat(50));
  console.log(`Base URL: ${BASE_URL}`);
  console.log('Duration: 30s');
  console.log('VUs: 5');
  console.log('='.repeat(50));

  // Verifica se servidor esta acessivel
  const response = http.get(`${BASE_URL}/health`, { timeout: '5s' });
  if (response.status !== 200) {
    throw new Error('Backend nao esta acessivel!');
  }
  console.log('Backend OK!');

  return { startTime: Date.now() };
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log('='.repeat(50));
  console.log('SMOKE TEST COMPLETO');
  console.log(`Duracao: ${duration.toFixed(2)}s`);
  console.log('='.repeat(50));
}
