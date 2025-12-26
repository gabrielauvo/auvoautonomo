/**
 * Fetch Real Data from Database
 *
 * Este script conecta diretamente ao banco de dados via Prisma
 * para buscar dados reais de usuários e entidades.
 */

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Secret do .env do backend
const JWT_SECRET = 'auvo-jwt-secret-key-desenvolvimento-2024';

/**
 * Base64 URL encode
 */
function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Cria uma assinatura HMAC SHA256
 */
function sign(data, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Gera um JWT token
 */
function generateJWT(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + 7 * 24 * 60 * 60 };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = sign(`${encodedHeader}.${encodedPayload}`, JWT_SECRET);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

async function main() {
  console.log('='.repeat(60));
  console.log('FETCHING REAL DATA FROM DATABASE');
  console.log('='.repeat(60));
  console.log('');

  try {
    // Buscar usuários
    console.log('Buscando usuários...');
    const users = await prisma.user.findMany({ take: 3 });
    console.log(`  Encontrados: ${users.length} usuários`);

    if (users.length === 0) {
      console.log('\n⚠ Nenhum usuário encontrado no banco!');
      console.log('  Execute os testes e2e primeiro para popular o banco.');
      await prisma.$disconnect();
      return;
    }

    // Gerar tokens para usuários reais
    const tokens = users.map((user) => ({
      userId: user.id,
      email: user.email,
      token: generateJWT({ sub: user.id, email: user.email }),
    }));

    console.log('\nTokens gerados:');
    tokens.forEach((t, i) => {
      console.log(`  ${i + 1}. ${t.email}: ${t.token.substring(0, 50)}...`);
    });

    // Buscar quotes
    console.log('\nBuscando orçamentos...');
    const quotes = await prisma.quote.findMany({
      take: 5,
      where: { userId: users[0].id },
      select: { id: true, shareKey: true },
    });
    console.log(`  Encontrados: ${quotes.length} orçamentos`);

    // Buscar work orders
    console.log('Buscando ordens de serviço...');
    const workOrders = await prisma.workOrder.findMany({
      take: 5,
      where: { userId: users[0].id },
      select: { id: true, shareKey: true },
    });
    console.log(`  Encontradas: ${workOrders.length} ordens de serviço`);

    // Buscar invoices/payments
    console.log('Buscando faturas/pagamentos...');
    let invoices = [];
    try {
      invoices = await prisma.invoice.findMany({
        take: 5,
        where: { userId: users[0].id },
        select: { id: true },
      });
    } catch (e) {
      // Tenta clientPayment
      invoices = await prisma.clientPayment.findMany({
        take: 5,
        where: { userId: users[0].id },
        select: { id: true, paymentToken: true },
      });
    }
    console.log(`  Encontradas: ${invoices.length} faturas/pagamentos`);

    // Montar dados de teste
    const testData = {
      tokens: tokens.map((t) => t.token),
      quoteIds: quotes.map((q) => q.id),
      workOrderIds: workOrders.map((wo) => wo.id),
      invoiceIds: invoices.map((i) => i.id),
      quoteShareKeys: quotes.filter((q) => q.shareKey).map((q) => q.shareKey),
      workOrderShareKeys: workOrders.filter((wo) => wo.shareKey).map((wo) => wo.shareKey),
      paymentTokens: invoices.filter((i) => i.paymentToken).map((i) => i.paymentToken),
    };

    // Gerar config.js
    const configContent = `/**
 * Configuração dos Load Tests
 *
 * Arquivo gerado automaticamente por fetch-real-data.js
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

    const configPath = path.join(__dirname, '..', 'config.js');
    fs.writeFileSync(configPath, configContent);

    console.log('\n' + '='.repeat(60));
    console.log('RESUMO');
    console.log('='.repeat(60));
    console.log(`Tokens: ${testData.tokens.length}`);
    console.log(`Quotes: ${testData.quoteIds.length}`);
    console.log(`Work Orders: ${testData.workOrderIds.length}`);
    console.log(`Invoices: ${testData.invoiceIds.length}`);
    console.log(`Quote Share Keys: ${testData.quoteShareKeys.length}`);
    console.log(`WO Share Keys: ${testData.workOrderShareKeys.length}`);
    console.log(`Payment Tokens: ${testData.paymentTokens.length}`);

    console.log('\n✓ Config atualizado: ' + configPath);
    console.log('\nPronto para executar os testes!');
  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
