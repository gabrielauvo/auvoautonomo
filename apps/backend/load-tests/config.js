/**
 * Configuração dos Load Tests
 *
 * Arquivo gerado automaticamente por fetch-real-data.js
 * Gerado em: 2025-12-26T15:18:23.785Z
 */

// =============================================================================
// ENVIRONMENT CONFIGURATION
// =============================================================================

export const config = {
  // Base URL do backend (usar 127.0.0.1 em vez de localhost para Windows)
  baseUrl: __ENV.BASE_URL || 'http://127.0.0.1:3001',

  // Tokens de autenticacao para diferentes usuarios de teste
  // Gerados em: 2025-12-26T16:05:35Z - Validos por 7 dias
  tokens: {
    user1: __ENV.TOKEN_USER1 || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0MmYyYTA0OC04ZjY5LTQyYzMtYTc3Ni0zNzZhMzQxOTFhNTUiLCJlbWFpbCI6ImdhYnJpZWxAYXV2by5jb20uYnIiLCJpYXQiOjE3NjY3NjQ3MzUsImV4cCI6MTc2NzM2OTUzNX0.qHqzNvnfvQqrtOlElSU29GsmMJCE59WK05CTWmVwXy8',
    user2: __ENV.TOKEN_USER2 || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0ODFiMTNjMy1hNjE3LTQwZWUtYWI1Ny0zNDA2NmY4NWQ0MWEiLCJlbWFpbCI6InRlc3RAdGVzdC5jb20iLCJpYXQiOjE3NjY3NjQ3MzUsImV4cCI6MTc2NzM2OTUzNX0.MDktYYGLJxgtLq4TMQatNDGCGQBwLUdBaYLEKVIsxPs',
    user3: __ENV.TOKEN_USER3 || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkYWUzOTBlOC0wY2ZiLTQzN2UtODBmMy1jZWQzZTRkOGFiNzMiLCJlbWFpbCI6InRlc3RlQHRlc3RlLmNvbSIsImlhdCI6MTc2Njc2NDczNSwiZXhwIjoxNzY3MzY5NTM1fQ.Bj4O_Dvo_ed68x-cBj6IKPiMOZGdEM-eAbIhhGiemso',
  },

  // IDs de entidades para teste
  testData: {
    quoteIds: ["ea32cab8-f3fc-4b80-826e-a5e496297c45"],
    workOrderIds: ["4158821d-8edf-4fa6-8e4c-156ba1bf4816","53bac44a-009f-4c70-ba94-e58438d29f78","6f13eac7-8c0b-4542-ad94-857a21eb447b","be6ddece-58fc-43fa-a5f7-e537c37f2865","d298aca3-cf59-4b0a-a9cb-de73d7d797c1"],
    invoiceIds: [],
    quoteShareKeys: ["szOnEI8nzab13iT5JfqiNA"],
    workOrderShareKeys: ["-FIvASE3V_qIj9GUBibS0g","yty6UVm5txwIcZdXIHYUDw","nTkTIDkawGeU9wQi-C1Y_Q"],
    paymentTokens: [],
  },
};

// =============================================================================
// SCENARIO CONFIGURATIONS
// =============================================================================

const scenarios = {
  smoke: {
    executor: 'constant-vus',
    vus: 1,
    duration: '30s',
  },
  load: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '1m', target: 10 },
      { duration: '3m', target: 10 },
      { duration: '1m', target: 20 },
      { duration: '3m', target: 20 },
      { duration: '1m', target: 0 },
    ],
  },
  stress: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '1m', target: 20 },
      { duration: '2m', target: 20 },
      { duration: '1m', target: 50 },
      { duration: '2m', target: 50 },
      { duration: '1m', target: 100 },
      { duration: '2m', target: 100 },
      { duration: '2m', target: 0 },
    ],
  },
  spike: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '30s', target: 5 },
      { duration: '30s', target: 100 },
      { duration: '1m', target: 100 },
      { duration: '30s', target: 5 },
      { duration: '30s', target: 0 },
    ],
  },
};

/**
 * Retorna o cenario selecionado via variavel de ambiente
 */
export function getScenario() {
  const scenarioName = __ENV.SCENARIO || 'load';
  return scenarios[scenarioName] || scenarios.load;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Retorna um token aleatorio para simular multiplos usuarios
 */
export function getRandomToken() {
  const tokens = Object.values(config.tokens).filter((t) => t && t.length > 10);
  if (tokens.length === 0) {
    throw new Error('No valid tokens configured!');
  }
  return tokens[Math.floor(Math.random() * tokens.length)];
}

/**
 * Retorna um ID aleatorio de uma lista
 */
export function getRandomId(ids) {
  if (!ids || ids.length === 0) {
    return 'test-id-placeholder';
  }
  return ids[Math.floor(Math.random() * ids.length)];
}

/**
 * Retorna headers de autenticacao
 */
export function getAuthHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Retorna headers para requisicoes publicas
 */
export function getPublicHeaders() {
  return {
    'Content-Type': 'application/json',
  };
}

// =============================================================================
// THRESHOLDS (SLOs)
// =============================================================================

export const thresholds = {
  http_req_duration: ['p(95)<2000', 'p(99)<5000'],
  http_req_failed: ['rate<0.05'],
  errors: ['rate<0.05'],
};
