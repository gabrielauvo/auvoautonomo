/**
 * Setup Test Data Script
 *
 * Script Node.js para preparar dados de teste antes de executar os load tests.
 * Cria entidades de teste e gera as variáveis de ambiente necessárias.
 *
 * Uso:
 *   node utils/setup-test-data.js
 *
 * Ou com variáveis customizadas:
 *   BASE_URL=http://localhost:3001 TOKEN=your-jwt-token node utils/setup-test-data.js
 */

const https = require('https');
const http = require('http');

// Configuração
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const TOKEN = process.env.TOKEN || process.env.TOKEN_USER1;

if (!TOKEN) {
  console.error('ERROR: TOKEN environment variable is required');
  console.error('Usage: TOKEN=your-jwt-token node utils/setup-test-data.js');
  process.exit(1);
}

const httpModule = BASE_URL.startsWith('https') ? https : http;

/**
 * Faz uma requisição HTTP
 */
function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
      },
    };

    const req = httpModule.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
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
 * Cria um cliente de teste
 */
async function createTestClient() {
  const client = {
    name: `Cliente Load Test ${Date.now()}`,
    email: `loadtest-${Date.now()}@test.com`,
    phone: `119${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`,
  };

  const response = await request('POST', '/clients', client);
  if (response.status === 201 || response.status === 200) {
    console.log(`✓ Cliente criado: ${response.data.id}`);
    return response.data.id;
  }
  console.error(`✗ Erro ao criar cliente: ${response.status}`);
  return null;
}

/**
 * Cria um orçamento de teste
 */
async function createTestQuote(clientId) {
  const quote = {
    clientId,
    title: `Orçamento Load Test ${Date.now()}`,
    status: 'DRAFT',
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    items: [
      {
        description: 'Serviço de teste para load test',
        quantity: 1,
        unitPrice: 10000, // R$ 100,00
      },
    ],
  };

  const response = await request('POST', '/quotes', quote);
  if (response.status === 201 || response.status === 200) {
    console.log(`✓ Orçamento criado: ${response.data.id}`);
    return response.data.id;
  }
  console.error(`✗ Erro ao criar orçamento: ${response.status}`);
  return null;
}

/**
 * Cria uma ordem de serviço de teste
 */
async function createTestWorkOrder(clientId) {
  const workOrder = {
    clientId,
    title: `OS Load Test ${Date.now()}`,
    status: 'PENDING',
    scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    description: 'Ordem de serviço criada para teste de carga',
  };

  const response = await request('POST', '/work-orders', workOrder);
  if (response.status === 201 || response.status === 200) {
    console.log(`✓ Ordem de serviço criada: ${response.data.id}`);
    return response.data.id;
  }
  console.error(`✗ Erro ao criar OS: ${response.status}`);
  return null;
}

/**
 * Cria uma fatura de teste
 */
async function createTestInvoice(clientId) {
  const invoice = {
    clientId,
    status: 'DRAFT',
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    items: [
      {
        description: 'Serviço faturado - Load Test',
        quantity: 1,
        unitPrice: 15000, // R$ 150,00
      },
    ],
  };

  const response = await request('POST', '/invoices', invoice);
  if (response.status === 201 || response.status === 200) {
    console.log(`✓ Fatura criada: ${response.data.id}`);
    return response.data.id;
  }
  console.error(`✗ Erro ao criar fatura: ${response.status}`);
  return null;
}

/**
 * Gera share key para um orçamento
 */
async function generateQuoteShareKey(quoteId) {
  const response = await request('POST', `/quotes/${quoteId}/share`);
  if (response.status === 200 || response.status === 201) {
    const shareKey = response.data.shareKey || response.data.key;
    console.log(`✓ Share key gerada para quote: ${shareKey}`);
    return shareKey;
  }
  console.error(`✗ Erro ao gerar share key: ${response.status}`);
  return null;
}

/**
 * Gera share key para uma ordem de serviço
 */
async function generateWorkOrderShareKey(workOrderId) {
  const response = await request('POST', `/work-orders/${workOrderId}/share`);
  if (response.status === 200 || response.status === 201) {
    const shareKey = response.data.shareKey || response.data.key;
    console.log(`✓ Share key gerada para OS: ${shareKey}`);
    return shareKey;
  }
  console.error(`✗ Erro ao gerar share key: ${response.status}`);
  return null;
}

/**
 * Main
 */
async function main() {
  console.log('='.repeat(60));
  console.log('SETUP TEST DATA FOR LOAD TESTS');
  console.log('='.repeat(60));
  console.log(`Base URL: ${BASE_URL}`);
  console.log('');

  const results = {
    clientIds: [],
    quoteIds: [],
    workOrderIds: [],
    invoiceIds: [],
    quoteShareKeys: [],
    workOrderShareKeys: [],
  };

  // Criar 3 conjuntos de dados de teste
  for (let i = 0; i < 3; i++) {
    console.log(`\n--- Conjunto ${i + 1} ---`);

    // Cliente
    const clientId = await createTestClient();
    if (clientId) results.clientIds.push(clientId);

    // Orçamento
    if (clientId) {
      const quoteId = await createTestQuote(clientId);
      if (quoteId) {
        results.quoteIds.push(quoteId);
        const shareKey = await generateQuoteShareKey(quoteId);
        if (shareKey) results.quoteShareKeys.push(shareKey);
      }
    }

    // Ordem de Serviço
    if (clientId) {
      const workOrderId = await createTestWorkOrder(clientId);
      if (workOrderId) {
        results.workOrderIds.push(workOrderId);
        const shareKey = await generateWorkOrderShareKey(workOrderId);
        if (shareKey) results.workOrderShareKeys.push(shareKey);
      }
    }

    // Fatura
    if (clientId) {
      const invoiceId = await createTestInvoice(clientId);
      if (invoiceId) results.invoiceIds.push(invoiceId);
    }
  }

  // Gerar output
  console.log('\n' + '='.repeat(60));
  console.log('ENVIRONMENT VARIABLES');
  console.log('='.repeat(60));
  console.log('\nCopie e cole as variáveis abaixo:\n');

  console.log(`export QUOTE_IDS="${results.quoteIds.join(',')}"`);
  console.log(`export WORK_ORDER_IDS="${results.workOrderIds.join(',')}"`);
  console.log(`export INVOICE_IDS="${results.invoiceIds.join(',')}"`);
  console.log(`export QUOTE_SHARE_KEYS="${results.quoteShareKeys.join(',')}"`);
  console.log(`export WO_SHARE_KEYS="${results.workOrderShareKeys.join(',')}"`);

  console.log('\n' + '='.repeat(60));
  console.log('JSON OUTPUT');
  console.log('='.repeat(60));
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
