/**
 * Bootstrap Load Tests
 *
 * Script completo que:
 * 1. Registra usuários de teste
 * 2. Cria entidades (clients, quotes, work-orders, invoices)
 * 3. Gera share keys para links públicos
 * 4. Atualiza o config.js com os dados reais
 *
 * Uso:
 *   node utils/bootstrap-tests.js
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuração
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3001';
const httpModule = BASE_URL.startsWith('https') ? https : http;

// Dados coletados
const testData = {
  tokens: [],
  users: [],
  clientIds: [],
  quoteIds: [],
  workOrderIds: [],
  invoiceIds: [],
  quoteShareKeys: [],
  workOrderShareKeys: [],
  paymentTokens: [],
};

/**
 * Faz uma requisição HTTP
 */
function request(method, urlPath, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = httpModule.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

/**
 * Verifica se o servidor está acessível
 */
async function checkHealth() {
  console.log('Verificando conexão com o servidor...');
  try {
    const response = await request('GET', '/health');
    if (response.status === 200) {
      console.log('✓ Servidor acessível\n');
      return true;
    }
  } catch (e) {
    // ignore
  }
  console.error('✗ Servidor não está acessível em', BASE_URL);
  console.error('  Certifique-se de que o backend está rodando.');
  return false;
}

/**
 * Registra um usuário de teste
 */
async function registerUser(index) {
  const timestamp = Date.now();
  const email = `loadtest${index}_${timestamp}@test.com`;
  const password = 'LoadTest123!@#';
  const name = `Load Test User ${index}`;

  console.log(`Registrando usuário ${index}: ${email}`);

  const response = await request('POST', '/auth/register', {
    email,
    password,
    name,
  });

  if (response.status === 201 || response.status === 200) {
    const token = response.data.token || response.data.access_token;
    const userId = response.data.user?.id || response.data.id;
    console.log(`✓ Usuário registrado: ${userId}`);
    return { token, userId, email };
  }

  // Tenta login se já existir
  if (response.status === 409 || response.status === 400) {
    console.log('  Usuário pode já existir, tentando login...');
    const loginResponse = await request('POST', '/auth/login', {
      email,
      password,
    });

    if (loginResponse.status === 200 || loginResponse.status === 201) {
      const token = loginResponse.data.token || loginResponse.data.access_token;
      const userId = loginResponse.data.user?.id || loginResponse.data.id;
      console.log(`✓ Login realizado: ${userId}`);
      return { token, userId, email };
    }
  }

  console.error(`✗ Erro ao registrar usuário: ${response.status}`, response.data);
  return null;
}

/**
 * Cria um item de serviço
 */
async function createItem(token) {
  const response = await request(
    'POST',
    '/items',
    {
      name: `Serviço Load Test ${Date.now()}`,
      type: 'SERVICE',
      unitPrice: 10000, // R$ 100,00
    },
    token
  );

  if (response.status === 201 || response.status === 200) {
    return response.data.id;
  }
  return null;
}

/**
 * Cria um cliente
 */
async function createClient(token) {
  const timestamp = Date.now();
  const response = await request(
    'POST',
    '/clients',
    {
      name: `Cliente Load Test ${timestamp}`,
      email: `cliente_${timestamp}@loadtest.com`,
      phone: `119${Math.floor(Math.random() * 100000000)
        .toString()
        .padStart(8, '0')}`,
    },
    token
  );

  if (response.status === 201 || response.status === 200) {
    console.log(`  ✓ Cliente criado: ${response.data.id}`);
    return response.data.id;
  }
  console.error(`  ✗ Erro ao criar cliente: ${response.status}`);
  return null;
}

/**
 * Cria um orçamento
 */
async function createQuote(token, clientId, itemId) {
  const response = await request(
    'POST',
    '/quotes',
    {
      clientId,
      items: itemId ? [{ itemId, quantity: 2 }] : undefined,
      title: `Orçamento Load Test ${Date.now()}`,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
    token
  );

  if (response.status === 201 || response.status === 200) {
    console.log(`  ✓ Orçamento criado: ${response.data.id}`);
    return response.data.id;
  }
  console.error(`  ✗ Erro ao criar orçamento: ${response.status}`);
  return null;
}

/**
 * Cria uma ordem de serviço
 */
async function createWorkOrder(token, clientId) {
  const response = await request(
    'POST',
    '/work-orders',
    {
      clientId,
      title: `OS Load Test ${Date.now()}`,
      description: 'Ordem de serviço para teste de carga',
      scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    token
  );

  if (response.status === 201 || response.status === 200) {
    console.log(`  ✓ Ordem de serviço criada: ${response.data.id}`);
    return response.data.id;
  }
  console.error(`  ✗ Erro ao criar OS: ${response.status}`);
  return null;
}

/**
 * Cria uma fatura/pagamento
 */
async function createInvoice(token, clientId, workOrderId) {
  // Tenta criar invoice
  let response = await request(
    'POST',
    '/invoices',
    {
      clientId,
      workOrderId,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      value: 15000, // R$ 150,00
      description: 'Fatura Load Test',
    },
    token
  );

  if (response.status === 201 || response.status === 200) {
    console.log(`  ✓ Fatura criada: ${response.data.id}`);
    return response.data.id;
  }

  // Tenta criar payment se invoice não existir
  response = await request(
    'POST',
    '/payments',
    {
      clientId,
      workOrderId,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      value: 15000,
      description: 'Pagamento Load Test',
      billingType: 'PIX',
    },
    token
  );

  if (response.status === 201 || response.status === 200) {
    console.log(`  ✓ Pagamento criado: ${response.data.id}`);
    return response.data.id;
  }

  console.error(`  ✗ Erro ao criar fatura/pagamento: ${response.status}`);
  return null;
}

/**
 * Gera share key para orçamento
 */
async function generateQuoteShareKey(token, quoteId) {
  // Tenta diferentes endpoints
  const endpoints = [
    `/quotes/${quoteId}/share`,
    `/quotes/${quoteId}/generate-share-link`,
    `/quotes/${quoteId}/public-link`,
  ];

  for (const endpoint of endpoints) {
    const response = await request('POST', endpoint, {}, token);
    if (response.status === 200 || response.status === 201) {
      const shareKey =
        response.data.shareKey ||
        response.data.key ||
        response.data.token ||
        response.data.link?.split('/').pop();
      if (shareKey) {
        console.log(`  ✓ Share key (quote): ${shareKey}`);
        return shareKey;
      }
    }
  }

  // Tenta GET se POST não funcionou
  const getResponse = await request('GET', `/quotes/${quoteId}`, null, token);
  if (getResponse.status === 200 && getResponse.data.shareKey) {
    console.log(`  ✓ Share key (quote): ${getResponse.data.shareKey}`);
    return getResponse.data.shareKey;
  }

  console.error(`  ✗ Não foi possível gerar share key para quote`);
  return null;
}

/**
 * Gera share key para ordem de serviço
 */
async function generateWorkOrderShareKey(token, workOrderId) {
  const endpoints = [
    `/work-orders/${workOrderId}/share`,
    `/work-orders/${workOrderId}/generate-share-link`,
    `/work-orders/${workOrderId}/public-link`,
  ];

  for (const endpoint of endpoints) {
    const response = await request('POST', endpoint, {}, token);
    if (response.status === 200 || response.status === 201) {
      const shareKey =
        response.data.shareKey ||
        response.data.key ||
        response.data.token ||
        response.data.link?.split('/').pop();
      if (shareKey) {
        console.log(`  ✓ Share key (OS): ${shareKey}`);
        return shareKey;
      }
    }
  }

  const getResponse = await request('GET', `/work-orders/${workOrderId}`, null, token);
  if (getResponse.status === 200 && getResponse.data.shareKey) {
    console.log(`  ✓ Share key (OS): ${getResponse.data.shareKey}`);
    return getResponse.data.shareKey;
  }

  console.error(`  ✗ Não foi possível gerar share key para OS`);
  return null;
}

/**
 * Busca entidades existentes
 */
async function fetchExistingEntities(token) {
  console.log('\nBuscando entidades existentes...');

  // Buscar quotes
  const quotesResponse = await request('GET', '/quotes?limit=5', null, token);
  if (quotesResponse.status === 200) {
    const quotes = quotesResponse.data.data || quotesResponse.data || [];
    for (const q of quotes.slice(0, 3)) {
      if (q.id && !testData.quoteIds.includes(q.id)) {
        testData.quoteIds.push(q.id);
        if (q.shareKey) testData.quoteShareKeys.push(q.shareKey);
      }
    }
    console.log(`  ✓ Encontrados ${quotes.length} orçamentos`);
  }

  // Buscar work orders
  const woResponse = await request('GET', '/work-orders?limit=5', null, token);
  if (woResponse.status === 200) {
    const workOrders = woResponse.data.data || woResponse.data || [];
    for (const wo of workOrders.slice(0, 3)) {
      if (wo.id && !testData.workOrderIds.includes(wo.id)) {
        testData.workOrderIds.push(wo.id);
        if (wo.shareKey) testData.workOrderShareKeys.push(wo.shareKey);
      }
    }
    console.log(`  ✓ Encontradas ${workOrders.length} ordens de serviço`);
  }

  // Buscar invoices/payments
  const invoicesResponse = await request('GET', '/invoices?limit=5', null, token);
  if (invoicesResponse.status === 200) {
    const invoices = invoicesResponse.data.data || invoicesResponse.data || [];
    for (const inv of invoices.slice(0, 3)) {
      if (inv.id && !testData.invoiceIds.includes(inv.id)) {
        testData.invoiceIds.push(inv.id);
      }
    }
    console.log(`  ✓ Encontradas ${invoices.length} faturas`);
  }
}

/**
 * Atualiza o arquivo config.js com os dados reais
 */
function updateConfigFile() {
  const configPath = path.join(__dirname, '..', 'config.js');

  const configContent = `/**
 * Configuração dos Load Tests
 *
 * Arquivo gerado automaticamente por bootstrap-tests.js
 * Gerado em: ${new Date().toISOString()}
 */

// =============================================================================
// ENVIRONMENT CONFIGURATION
// =============================================================================

export const config = {
  // Base URL do backend (usar 127.0.0.1 em vez de localhost para Windows)
  baseUrl: __ENV.BASE_URL || 'http://127.0.0.1:3001',

  // Tokens de autenticacao para diferentes usuarios de teste
  tokens: {
    user1: __ENV.TOKEN_USER1 || '${testData.tokens[0] || ''}',
    user2: __ENV.TOKEN_USER2 || '${testData.tokens[1] || testData.tokens[0] || ''}',
    user3: __ENV.TOKEN_USER3 || '${testData.tokens[2] || testData.tokens[0] || ''}',
  },

  // IDs de entidades para teste
  testData: {
    quoteIds: ${JSON.stringify(testData.quoteIds)},
    workOrderIds: ${JSON.stringify(testData.workOrderIds)},
    invoiceIds: ${JSON.stringify(testData.invoiceIds)},
    quoteShareKeys: ${JSON.stringify(testData.quoteShareKeys)},
    workOrderShareKeys: ${JSON.stringify(testData.workOrderShareKeys)},
    paymentTokens: ${JSON.stringify(testData.paymentTokens)},
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
    Authorization: \`Bearer \${token}\`,
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
`;

  fs.writeFileSync(configPath, configContent);
  console.log(`\n✓ Config atualizado: ${configPath}`);
}

/**
 * Main
 */
async function main() {
  console.log('='.repeat(60));
  console.log('BOOTSTRAP LOAD TESTS');
  console.log('='.repeat(60));
  console.log(`Base URL: ${BASE_URL}`);
  console.log('');

  // Verificar saúde do servidor
  const healthy = await checkHealth();
  if (!healthy) {
    process.exit(1);
  }

  // Registrar usuários de teste
  console.log('--- Registrando usuários de teste ---\n');
  for (let i = 1; i <= 3; i++) {
    const user = await registerUser(i);
    if (user) {
      testData.tokens.push(user.token);
      testData.users.push(user);
    }
  }

  if (testData.tokens.length === 0) {
    console.error('\n✗ Nenhum usuário foi registrado. Abortando.');
    process.exit(1);
  }

  const primaryToken = testData.tokens[0];

  // Buscar entidades existentes
  await fetchExistingEntities(primaryToken);

  // Criar novas entidades se necessário
  const needsMoreData =
    testData.quoteIds.length < 3 ||
    testData.workOrderIds.length < 3 ||
    testData.invoiceIds.length < 3;

  if (needsMoreData) {
    console.log('\n--- Criando entidades de teste ---\n');

    // Criar item
    const itemId = await createItem(primaryToken);

    for (let i = 0; i < 3; i++) {
      console.log(`\nConjunto ${i + 1}:`);

      // Cliente
      const clientId = await createClient(primaryToken);
      if (!clientId) continue;

      testData.clientIds.push(clientId);

      // Quote
      const quoteId = await createQuote(primaryToken, clientId, itemId);
      if (quoteId) {
        testData.quoteIds.push(quoteId);
        const shareKey = await generateQuoteShareKey(primaryToken, quoteId);
        if (shareKey) testData.quoteShareKeys.push(shareKey);
      }

      // Work Order
      const woId = await createWorkOrder(primaryToken, clientId);
      if (woId) {
        testData.workOrderIds.push(woId);
        const shareKey = await generateWorkOrderShareKey(primaryToken, woId);
        if (shareKey) testData.workOrderShareKeys.push(shareKey);
      }

      // Invoice
      const invoiceId = await createInvoice(primaryToken, clientId, woId);
      if (invoiceId) {
        testData.invoiceIds.push(invoiceId);
      }
    }
  }

  // Atualizar config
  updateConfigFile();

  // Resumo
  console.log('\n' + '='.repeat(60));
  console.log('RESUMO');
  console.log('='.repeat(60));
  console.log(`Tokens: ${testData.tokens.length}`);
  console.log(`Quotes: ${testData.quoteIds.length}`);
  console.log(`Work Orders: ${testData.workOrderIds.length}`);
  console.log(`Invoices: ${testData.invoiceIds.length}`);
  console.log(`Quote Share Keys: ${testData.quoteShareKeys.length}`);
  console.log(`WO Share Keys: ${testData.workOrderShareKeys.length}`);

  console.log('\n' + '='.repeat(60));
  console.log('PRONTO PARA EXECUTAR OS TESTES!');
  console.log('='.repeat(60));
  console.log('\nExecute:');
  console.log('  ./k6.exe run scenarios/sync-load-test.js -e SCENARIO=smoke');
  console.log('  ./k6.exe run scenarios/pdf-load-test.js -e SCENARIO=smoke');
  console.log('  ./k6.exe run scenarios/public-links-load-test.js -e SCENARIO=smoke');
  console.log('');
}

main().catch((error) => {
  console.error('Erro:', error);
  process.exit(1);
});
