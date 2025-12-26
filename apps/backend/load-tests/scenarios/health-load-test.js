/**
 * Health Endpoint Load Test
 *
 * Teste de carga simples no endpoint de health.
 * Util para verificar a capacidade basica do servidor.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Configuracao
const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:3001';

// Metricas
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time', true);
const requestCount = new Counter('requests');

// Cenarios
const scenarios = {
  smoke: {
    executor: 'constant-vus',
    vus: 1,
    duration: '10s',
  },
  load: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '10s', target: 20 },
      { duration: '20s', target: 20 },
      { duration: '10s', target: 50 },
      { duration: '20s', target: 50 },
      { duration: '10s', target: 0 },
    ],
  },
  stress: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '10s', target: 50 },
      { duration: '20s', target: 50 },
      { duration: '10s', target: 100 },
      { duration: '20s', target: 100 },
      { duration: '10s', target: 150 },
      { duration: '20s', target: 150 },
      { duration: '10s', target: 0 },
    ],
  },
};

// Seleciona cenario
const scenarioName = __ENV.SCENARIO || 'load';
const selectedScenario = scenarios[scenarioName] || scenarios.load;

export const options = {
  scenarios: {
    health_test: selectedScenario,
  },
  thresholds: {
    errors: ['rate<0.01'],              // < 1% erros
    response_time: ['p(95)<100'],       // 95% < 100ms
    http_req_duration: ['p(95)<100', 'p(99)<200'],
  },
};

export default function () {
  const startTime = Date.now();
  const response = http.get(`${BASE_URL}/health`);
  const duration = Date.now() - startTime;

  responseTime.add(duration);
  requestCount.add(1);

  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'body has status ok': (r) => {
      try {
        return JSON.parse(r.body).status === 'ok';
      } catch (e) {
        return false;
      }
    },
    'response time < 100ms': (r) => r.timings.duration < 100,
  });

  errorRate.add(!success);

  // Pequena pausa para nao sobrecarregar
  sleep(0.1);
}

export function setup() {
  console.log('='.repeat(50));
  console.log('HEALTH ENDPOINT LOAD TEST');
  console.log('='.repeat(50));
  console.log('Base URL:', BASE_URL);
  console.log('Scenario:', scenarioName);
  console.log('='.repeat(50));

  const response = http.get(`${BASE_URL}/health`, { timeout: '5s' });
  if (response.status !== 200) {
    throw new Error('Backend not accessible!');
  }
  console.log('Backend OK!');
  return { startTime: Date.now() };
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log('='.repeat(50));
  console.log('TEST COMPLETED');
  console.log('Duration:', duration.toFixed(2) + 's');
  console.log('='.repeat(50));
}
