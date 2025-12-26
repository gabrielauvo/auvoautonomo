/**
 * Gera um JWT token válido para testes
 *
 * Este script cria tokens JWT usando o mesmo secret do backend
 * para permitir testes sem precisar passar pelo fluxo de registro.
 */

const crypto = require('crypto');

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
function generateJWT(payload, secret = JWT_SECRET) {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + 7 * 24 * 60 * 60, // 7 dias
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = sign(`${encodedHeader}.${encodedPayload}`, secret);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Gera um UUID v4 simples
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Gerar 3 tokens para usuários de teste
const users = [
  { id: generateUUID(), email: 'loadtest1@test.com' },
  { id: generateUUID(), email: 'loadtest2@test.com' },
  { id: generateUUID(), email: 'loadtest3@test.com' },
];

console.log('='.repeat(60));
console.log('JWT TOKENS PARA LOAD TESTS');
console.log('='.repeat(60));
console.log('');

const tokens = users.map((user, index) => {
  const token = generateJWT({ sub: user.id, email: user.email });
  console.log(`Token ${index + 1} (${user.email}):`);
  console.log(token);
  console.log('');
  return token;
});

console.log('='.repeat(60));
console.log('COPIE PARA config.js:');
console.log('='.repeat(60));
console.log('');
console.log('tokens: {');
console.log(`  user1: '${tokens[0]}',`);
console.log(`  user2: '${tokens[1]}',`);
console.log(`  user3: '${tokens[2]}',`);
console.log('},');
console.log('');

// Exportar para uso programático
if (typeof module !== 'undefined') {
  module.exports = { generateJWT, tokens, users };
}
