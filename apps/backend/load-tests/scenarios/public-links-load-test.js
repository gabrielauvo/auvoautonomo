/**
 * Public Links Load Test
 *
 * Testa os endpoints publicos (sem autenticacao) para links compartilhaveis.
 * Simula clientes acessando orcamentos, ordens de servico e pagamentos.
 *
 * Endpoints testados:
 * - GET /public/quotes/:shareKey (visualizar orcamento)
 * - POST /public/quotes/:shareKey/sign-and-approve (aprovar orcamento)
 * - POST /public/quotes/:shareKey/reject (rejeitar orcamento)
 * - GET /public/quotes/:shareKey/acceptance-terms
 * - GET /public/work-orders/:shareKey (visualizar OS)
 * - GET /public/payments/:token (visualizar pagamento)
 * - POST /public/payments/:token/pix (obter QR code PIX)
 * - POST /public/payments/:token/boleto (obter boleto)
 *
 * Cenarios:
 * - Cliente visualizando orcamento
 * - Cliente aprovando/rejeitando orcamento
 * - Cliente visualizando ordem de servico
 * - Cliente acessando pagamento (PIX/Boleto)
 * - Rate limiting (testar throttle)
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';
import {
  config,
  getScenario,
  getRandomId,
  getPublicHeaders,
  thresholds,
} from '../config.js';

// =============================================================================
// CUSTOM METRICS
// =============================================================================

// Taxas de erro por tipo de endpoint
const publicQuoteErrorRate = new Rate('public_quote_errors');
const publicWorkOrderErrorRate = new Rate('public_work_order_errors');
const publicPaymentErrorRate = new Rate('public_payment_errors');
const rateLimitedRate = new Rate('rate_limited');

// Trends de latencia
const publicQuoteDuration = new Trend('public_quote_duration', true);
const publicWorkOrderDuration = new Trend('public_work_order_duration', true);
const publicPaymentDuration = new Trend('public_payment_duration', true);
const quoteApprovalDuration = new Trend('quote_approval_duration', true);

// Contadores
const publicQuoteViews = new Counter('public_quote_views_total');
const publicWorkOrderViews = new Counter('public_work_order_views_total');
const publicPaymentViews = new Counter('public_payment_views_total');
const quoteApprovals = new Counter('quote_approvals_total');
const quoteRejections = new Counter('quote_rejections_total');
const pixRequests = new Counter('pix_requests_total');
const boletoRequests = new Counter('boleto_requests_total');

// =============================================================================
// K6 OPTIONS
// =============================================================================

export const options = {
  scenarios: {
    public_links_test: getScenario(),
  },
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    http_req_failed: ['rate<0.50'],
    public_quote_errors: ['rate<0.50'],
    public_work_order_errors: ['rate<0.50'],
    public_payment_errors: ['rate<0.50'],
    rate_limited: ['rate<0.5'],
    public_quote_duration: ['p(95)<500'],
    public_work_order_duration: ['p(95)<500'],
    public_payment_duration: ['p(95)<500'],
    quote_approval_duration: ['p(95)<2000'],
  },
};

// =============================================================================
// PUBLIC QUOTE FUNCTIONS
// =============================================================================

/**
 * Visualiza um orcamento publico
 */
function viewPublicQuote(shareKey) {
  const headers = getPublicHeaders();
  const url = `${config.baseUrl}/public/quotes/${shareKey}`;

  const startTime = Date.now();
  const response = http.get(url, {
    headers,
    tags: { type: 'public', entity: 'quote' },
  });
  const duration = Date.now() - startTime;

  publicQuoteDuration.add(duration);
  publicQuoteViews.add(1);

  // Verifica rate limiting
  if (response.status === 429) {
    rateLimitedRate.add(1);
    return response;
  }

  const success = check(response, {
    'public quote status 200': (r) => r.status === 200,
    'public quote has data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.id !== undefined || body.quote !== undefined;
      } catch (e) {
        return false;
      }
    },
  });

  publicQuoteErrorRate.add(!success);
  rateLimitedRate.add(0);

  return response;
}

/**
 * Obtem termos de aceite do orcamento
 */
function getQuoteAcceptanceTerms(shareKey) {
  const headers = getPublicHeaders();
  const url = `${config.baseUrl}/public/quotes/${shareKey}/acceptance-terms`;

  const response = http.get(url, {
    headers,
    tags: { type: 'public', entity: 'quote_terms' },
  });

  if (response.status === 429) {
    rateLimitedRate.add(1);
    return response;
  }

  check(response, {
    'acceptance terms status 200': (r) => r.status === 200,
  });

  rateLimitedRate.add(0);
  return response;
}

/**
 * Aprova um orcamento com assinatura
 */
function signAndApproveQuote(shareKey) {
  const headers = getPublicHeaders();
  const url = `${config.baseUrl}/public/quotes/${shareKey}/sign-and-approve`;

  // Simula uma assinatura base64 (pequena para teste)
  const fakeSignature = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`;

  const body = {
    imageBase64: fakeSignature,
    signerName: `Cliente Teste ${randomString(6)}`,
    signerDocument: `123.456.789-${randomIntBetween(10, 99)}`,
    signerRole: 'Cliente',
  };

  const startTime = Date.now();
  const response = http.post(url, JSON.stringify(body), {
    headers,
    tags: { type: 'public', entity: 'quote_approve' },
  });
  const duration = Date.now() - startTime;

  quoteApprovalDuration.add(duration);

  if (response.status === 429) {
    rateLimitedRate.add(1);
    return response;
  }

  const success = check(response, {
    'quote approval status 200/201': (r) => r.status === 200 || r.status === 201,
  });

  if (success) {
    quoteApprovals.add(1);
  }

  publicQuoteErrorRate.add(!success && response.status !== 400); // 400 pode ser quote ja aprovado
  rateLimitedRate.add(0);

  return response;
}

/**
 * Rejeita um orcamento
 */
function rejectQuote(shareKey, reason = null) {
  const headers = getPublicHeaders();
  const url = `${config.baseUrl}/public/quotes/${shareKey}/reject`;

  const body = reason ? { reason } : {};

  const response = http.post(url, JSON.stringify(body), {
    headers,
    tags: { type: 'public', entity: 'quote_reject' },
  });

  if (response.status === 429) {
    rateLimitedRate.add(1);
    return response;
  }

  const success = check(response, {
    'quote rejection status 200/201': (r) => r.status === 200 || r.status === 201,
  });

  if (success) {
    quoteRejections.add(1);
  }

  rateLimitedRate.add(0);
  return response;
}

// =============================================================================
// PUBLIC WORK ORDER FUNCTIONS
// =============================================================================

/**
 * Visualiza uma ordem de servico publica
 */
function viewPublicWorkOrder(shareKey) {
  const headers = getPublicHeaders();
  const url = `${config.baseUrl}/public/work-orders/${shareKey}`;

  const startTime = Date.now();
  const response = http.get(url, {
    headers,
    tags: { type: 'public', entity: 'work_order' },
  });
  const duration = Date.now() - startTime;

  publicWorkOrderDuration.add(duration);
  publicWorkOrderViews.add(1);

  if (response.status === 429) {
    rateLimitedRate.add(1);
    return response;
  }

  const success = check(response, {
    'public work order status 200': (r) => r.status === 200,
    'public work order has data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.id !== undefined || body.workOrder !== undefined;
      } catch (e) {
        return false;
      }
    },
  });

  publicWorkOrderErrorRate.add(!success);
  rateLimitedRate.add(0);

  return response;
}

// =============================================================================
// PUBLIC PAYMENT FUNCTIONS
// =============================================================================

/**
 * Visualiza detalhes de um pagamento publico
 */
function viewPublicPayment(token) {
  const headers = getPublicHeaders();
  const url = `${config.baseUrl}/public/payments/${token}`;

  const startTime = Date.now();
  const response = http.get(url, {
    headers,
    tags: { type: 'public', entity: 'payment' },
  });
  const duration = Date.now() - startTime;

  publicPaymentDuration.add(duration);
  publicPaymentViews.add(1);

  if (response.status === 429) {
    rateLimitedRate.add(1);
    return response;
  }

  const success = check(response, {
    'public payment status 200': (r) => r.status === 200,
    'public payment has data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.value !== undefined || body.status !== undefined;
      } catch (e) {
        return false;
      }
    },
  });

  publicPaymentErrorRate.add(!success);
  rateLimitedRate.add(0);

  return response;
}

/**
 * Obtem dados do PIX para pagamento
 */
function getPixData(paymentToken) {
  const headers = getPublicHeaders();
  const url = `${config.baseUrl}/public/payments/${paymentToken}/pix`;

  const startTime = Date.now();
  const response = http.post(url, null, {
    headers,
    tags: { type: 'public', entity: 'payment_pix' },
  });
  const duration = Date.now() - startTime;

  publicPaymentDuration.add(duration);

  if (response.status === 429) {
    rateLimitedRate.add(1);
    return response;
  }

  const success = check(response, {
    'pix data status 200': (r) => r.status === 200,
    'pix has qrcode': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.pixCode || body.qrCode || body.qrCodeUrl;
      } catch (e) {
        return false;
      }
    },
  });

  if (success) {
    pixRequests.add(1);
  }

  publicPaymentErrorRate.add(!success && response.status !== 400);
  rateLimitedRate.add(0);

  return response;
}

/**
 * Obtem dados do boleto para pagamento
 */
function getBoletoData(paymentToken) {
  const headers = getPublicHeaders();
  const url = `${config.baseUrl}/public/payments/${paymentToken}/boleto`;

  const startTime = Date.now();
  const response = http.post(url, null, {
    headers,
    tags: { type: 'public', entity: 'payment_boleto' },
  });
  const duration = Date.now() - startTime;

  publicPaymentDuration.add(duration);

  if (response.status === 429) {
    rateLimitedRate.add(1);
    return response;
  }

  const success = check(response, {
    'boleto data status 200': (r) => r.status === 200,
    'boleto has url': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.invoiceUrl || body.bankSlipUrl || body.boletoUrl;
      } catch (e) {
        return false;
      }
    },
  });

  if (success) {
    boletoRequests.add(1);
  }

  publicPaymentErrorRate.add(!success && response.status !== 400);
  rateLimitedRate.add(0);

  return response;
}

// =============================================================================
// MAIN TEST FUNCTION
// =============================================================================

export default function () {
  const testData = config.testData;

  // Escolhe aleatoriamente qual cenario executar
  const scenarioChoice = Math.random();

  if (scenarioChoice < 0.4) {
    // 40% - Cliente visualizando e interagindo com orcamento
    group('Quote Journey', () => {
      const shareKey = getRandomId(testData.quoteShareKeys);

      // 1. Visualiza o orcamento
      viewPublicQuote(shareKey);
      sleep(randomIntBetween(2, 5)); // Cliente lendo

      // 2. Le os termos (opcional)
      if (Math.random() > 0.5) {
        getQuoteAcceptanceTerms(shareKey);
        sleep(randomIntBetween(1, 3));
      }

      // 3. Decide aprovar ou rejeitar (baixa probabilidade no teste)
      // Comentado para nao alterar dados reais em producao
      // if (Math.random() > 0.9) {
      //   if (Math.random() > 0.3) {
      //     signAndApproveQuote(shareKey);
      //   } else {
      //     rejectQuote(shareKey, 'Preco acima do esperado');
      //   }
      // }
    });
  } else if (scenarioChoice < 0.6) {
    // 20% - Cliente visualizando ordem de servico
    group('Work Order View', () => {
      const shareKey = getRandomId(testData.workOrderShareKeys);

      viewPublicWorkOrder(shareKey);
      sleep(randomIntBetween(1, 3)); // Cliente visualizando

      // Pode recarregar a pagina
      if (Math.random() > 0.7) {
        sleep(randomIntBetween(2, 5));
        viewPublicWorkOrder(shareKey);
      }
    });
  } else {
    // 40% - Cliente acessando pagamento
    group('Payment Journey', () => {
      const paymentToken = getRandomId(testData.paymentTokens);

      // 1. Visualiza detalhes do pagamento
      const paymentResponse = viewPublicPayment(paymentToken);
      sleep(randomIntBetween(1, 3));

      // 2. Escolhe forma de pagamento
      const paymentChoice = Math.random();

      if (paymentChoice < 0.6) {
        // 60% PIX
        getPixData(paymentToken);
      } else {
        // 40% Boleto
        getBoletoData(paymentToken);
      }

      // Cliente pode verificar status novamente
      if (Math.random() > 0.6) {
        sleep(randomIntBetween(5, 10));
        viewPublicPayment(paymentToken);
      }
    });
  }

  // Pausa entre usuarios (simula novos acessos)
  sleep(randomIntBetween(1, 3));
}

// =============================================================================
// RATE LIMIT TEST
// =============================================================================

/**
 * Cenario especial: Teste de rate limiting
 * Envia muitas requisicoes rapidamente para testar throttle
 */
export function rateLimitTest() {
  const testData = config.testData;
  const shareKey = getRandomId(testData.quoteShareKeys);

  group('Rate Limit Test', () => {
    let rateLimitedCount = 0;
    const totalRequests = 50;

    // Envia 50 requisicoes em sequencia rapida
    for (let i = 0; i < totalRequests; i++) {
      const response = viewPublicQuote(shareKey);
      if (response.status === 429) {
        rateLimitedCount++;
      }
      sleep(0.05); // 50ms entre requisicoes
    }

    check(null, {
      'rate limit: some requests blocked': () => rateLimitedCount > 0,
      'rate limit: not all blocked': () => rateLimitedCount < totalRequests,
    });

    console.log(`Rate limited: ${rateLimitedCount}/${totalRequests} requests`);
  });
}

// =============================================================================
// CONCURRENT ACCESS TEST
// =============================================================================

/**
 * Cenario especial: Multiplos acessos ao mesmo recurso
 * Simula varios clientes acessando o mesmo orcamento
 */
export function concurrentAccessTest() {
  const testData = config.testData;
  const shareKey = testData.quoteShareKeys[0]; // Mesmo share key para todos

  group('Concurrent Access', () => {
    // Todos acessam o mesmo orcamento
    viewPublicQuote(shareKey);

    // Simula leitura
    sleep(randomIntBetween(1, 2));

    // Pode tentar obter termos
    getQuoteAcceptanceTerms(shareKey);
  });
}

// =============================================================================
// LIFECYCLE HOOKS
// =============================================================================

export function setup() {
  console.log('='.repeat(60));
  console.log('PUBLIC LINKS LOAD TEST');
  console.log('='.repeat(60));
  console.log(`Base URL: ${config.baseUrl}`);
  console.log(`Scenario: ${__ENV.SCENARIO || 'load'}`);
  console.log(`Quote Share Keys: ${config.testData.quoteShareKeys.join(', ')}`);
  console.log(`Work Order Share Keys: ${config.testData.workOrderShareKeys.join(', ')}`);
  console.log(`Payment Tokens: ${config.testData.paymentTokens.join(', ')}`);
  console.log('='.repeat(60));
  console.log('');
  console.log('NOTE: Rate limiting is configured:');
  console.log('  - Quote view: 20 req/min');
  console.log('  - Quote approve/reject: 5 req/min');
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
