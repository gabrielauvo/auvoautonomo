# Guia de Segurança - Backend NestJS

## Configurações Implementadas para 1M+ Usuários

Este documento descreve todas as medidas de segurança implementadas no backend para suportar escala de produção com 1M+ usuários simultâneos.

---

## 1. Segurança da Aplicação (main.ts)

### Helmet - Security Headers
```typescript
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
  crossOriginEmbedderPolicy: false,
}));
```

**Proteção contra:**
- XSS (Cross-Site Scripting)
- Clickjacking
- MIME type sniffing
- DNS prefetching

### Compression - Performance
```typescript
app.use(compression({
  threshold: 1024, // Comprime respostas > 1KB
  level: 6, // Balance CPU/compressão
}));
```

**Benefícios:**
- Reduz bandwidth em ~70%
- Essencial para escala (1M+ users)
- Melhora latência

### CORS Restritivo
```typescript
app.enableCors({
  origin: (origin, callback) => {
    // Valida apenas domínios permitidos
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
});
```

**Variáveis de ambiente:**
```bash
CORS_ORIGIN=https://app.exemplo.com,https://admin.exemplo.com
```

### Graceful Shutdown
- Fecha conexões corretamente (DB, Redis)
- Essencial para K8s e deploys sem downtime
- Trata SIGTERM, SIGINT, erros não capturados

### Trust Proxy
```typescript
app.set('trust proxy', 1);
```

**Quando usar:**
- Atrás de load balancers (AWS ALB, GCP Load Balancer, Nginx)
- Necessário para rate limiting e logging correto do IP real

---

## 2. Logging Seguro (SecureLoggerService)

### Proteção Automática
```typescript
import { SecureLoggerService } from '@/common/logging';

constructor(private readonly logger: SecureLoggerService) {}

// Automaticamente sanitiza dados sensíveis
this.logger.log('User data', { user }); // CPF, senhas, tokens são removidos
```

### Campos Sensíveis Protegidos
- **Autenticação:** password, token, apiKey, secret
- **Documentos:** cpf, cnpj, rg, passport
- **Pagamento:** cardNumber, cvv, bankAccount, pix
- **Dados Pessoais:** email (opcional), phone, birthDate

### Patterns Detectados
- CPF: `000.000.000-00`
- CNPJ: `00.000.000/0000-00`
- Cartão: `0000 0000 0000 0000`
- Email: `user@domain.com`
- Tokens JWT: `Bearer eyJ...`

### Uso Recomendado
```typescript
// ✅ BOM - Sanitiza automaticamente
this.logger.log('Payment created', { payment });

// ✅ BOM - Força sanitização
this.logger.logSanitized('Sensitive data', data);

// ❌ EVITAR - Pode expor dados sensíveis
console.log('Payment:', payment);
```

---

## 3. Criptografia com Key Rotation (EncryptionService)

### Configuração de Chaves
```bash
# Chave atual (sempre usada para encrypt)
ENCRYPTION_KEY=64caracteres_hex...

# Chaves anteriores (para decrypt de dados antigos)
ENCRYPTION_KEY_PREVIOUS=chave1_antiga,chave2_antiga
```

### Gerar Chaves
```typescript
import { EncryptionService } from '@/common/encryption';

// Gera uma chave
const key = EncryptionService.generateKey();

// Gera par de chaves (current + previous)
const { current, previous } = EncryptionService.generateKeyPair();
```

### Processo de Rotação
1. Gerar nova chave:
```bash
# CLI
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

2. Mover chave atual para `ENCRYPTION_KEY_PREVIOUS`:
```bash
ENCRYPTION_KEY=nova_chave_aqui
ENCRYPTION_KEY_PREVIOUS=chave_atual_antiga,chave_anterior
```

3. Re-encrypt dados gradualmente (opcional):
```typescript
const reEncrypted = this.encryption.reEncrypt(oldEncryptedData);
```

### Métodos Disponíveis
```typescript
// Encrypt (usa chave atual)
const encrypted = this.encryption.encrypt('dados sensíveis');

// Decrypt (tenta todas as chaves)
const decrypted = this.encryption.decrypt(encrypted);

// Re-encrypt com chave atual
const reEncrypted = this.encryption.reEncrypt(oldData);

// Verifica se usa chave atual
const isCurrent = this.encryption.isUsingCurrentKey(encrypted);
```

---

## 4. Rate Limiting por Usuário

### Rate Limiting por IP (Global)
```typescript
// app.module.ts
ThrottlerModule.forRoot([{
  ttl: 60000, // 1 minuto
  limit: 100, // 100 requests
}])
```

### Rate Limiting por Usuário (Endpoints Específicos)
```typescript
import { UserRateLimit } from '@/common/rate-limit';

// 10 requisições por minuto
@UserRateLimit({ limit: 10, ttl: 60000 })
@Get('expensive-operation')
async expensiveOperation() { ... }

// 5 exports por hora
@UserRateLimit({
  limit: 5,
  ttl: 3600000,
  keyPrefix: 'export',
  message: 'Você pode exportar apenas 5 vezes por hora'
})
@Get('export')
async exportData() { ... }
```

### Limites Recomendados por Operação
```typescript
// Leitura (GET)
@UserRateLimit({ limit: 1000, ttl: 900000 }) // 1000/15min

// Escrita (POST/PUT/PATCH)
@UserRateLimit({ limit: 100, ttl: 900000 }) // 100/15min

// Operações custosas (export, import, reports)
@UserRateLimit({ limit: 10, ttl: 3600000 }) // 10/hora

// Operações críticas (delete, bulk)
@UserRateLimit({ limit: 20, ttl: 3600000 }) // 20/hora
```

### Versão Redis (Produção)
```typescript
// Para cluster multi-node, use RedisRateLimitGuard
import { RedisRateLimitGuard } from '@/common/rate-limit';

// app.module.ts
providers: [
  {
    provide: APP_GUARD,
    useClass: RedisRateLimitGuard,
  },
]
```

---

## 5. Health Checks (Kubernetes/Load Balancers)

### Endpoints Disponíveis

#### Liveness Probe
```bash
GET /health/live
```
- Verifica se aplicação está viva
- K8s reinicia pod se falhar
- NÃO verifica dependências externas

#### Readiness Probe
```bash
GET /health/ready
```
- Verifica se aplicação está pronta para tráfego
- K8s remove pod do load balancer se falhar
- Verifica: Database, Redis, Memória

#### Health Check Completo
```bash
GET /health
```
- Status detalhado de todos os componentes
- Útil para monitoramento (Datadog, New Relic)

#### Startup Probe
```bash
GET /health/startup
```
- Usado durante inicialização lenta
- K8s espera OK antes de iniciar liveness/readiness

### Configuração Kubernetes
```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 3001
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /health/ready
    port: 3001
  initialDelaySeconds: 10
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 2

startupProbe:
  httpGet:
    path: /health/startup
    port: 3001
  initialDelaySeconds: 0
  periodSeconds: 10
  timeoutSeconds: 3
  failureThreshold: 30
```

---

## 6. Variáveis de Ambiente Obrigatórias

### Produção
```bash
# Ambiente
NODE_ENV=production
PORT=3001

# Database
DATABASE_URL=postgresql://user:pass@host:5432/db?schema=public

# JWT
JWT_SECRET=seu_secret_super_seguro_64_caracteres_minimo

# Encryption (Key Rotation)
ENCRYPTION_KEY=64_caracteres_hex
ENCRYPTION_KEY_PREVIOUS=chave_antiga_1,chave_antiga_2

# CORS
CORS_ORIGIN=https://app.com,https://admin.app.com

# Redis (opcional mas recomendado)
REDIS_URL=redis://localhost:6379

# Asaas (se usar)
ASAAS_PLATFORM_API_KEY=sua_api_key
ASAAS_PLATFORM_WALLET_ID=seu_wallet_id
ASAAS_PLATFORM_WEBHOOK_TOKEN=token_seguro_para_validar_webhooks
```

### Desenvolvimento
```bash
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/fieldflow
JWT_SECRET=dev_secret_change_in_production
ENCRYPTION_KEY=generate_with_npm_run_generate_key
CORS_ORIGIN=http://localhost:3000,http://localhost:8081
```

---

## 7. Checklist de Segurança para Deploy

### Antes do Deploy
- [ ] Todas as variáveis de ambiente estão configuradas
- [ ] `NODE_ENV=production` está definido
- [ ] CORS está restrito aos domínios corretos
- [ ] JWT_SECRET é forte (64+ caracteres)
- [ ] ENCRYPTION_KEY está configurada
- [ ] Webhooks têm tokens de validação
- [ ] Swagger está desabilitado em produção (automático)
- [ ] Trust proxy está habilitado (automático em produção)

### Monitoramento
- [ ] Health checks estão funcionando
- [ ] Logs não expõem dados sensíveis
- [ ] Rate limiting está ativo
- [ ] Alertas configurados para:
  - CPU > 80%
  - Memória > 90%
  - Disk > 90%
  - Erros 5xx
  - Latência alta

### Backup e Recovery
- [ ] Backup automático do banco (diário)
- [ ] Backup das chaves de criptografia (seguro)
- [ ] Processo de restore testado
- [ ] Key rotation agendada (a cada 90 dias)

---

## 8. Instalação de Dependências

```bash
cd apps/backend

# Instalar dependências de segurança
npm install helmet compression @nestjs/throttler @nestjs/terminus ioredis

# Ou com yarn
yarn add helmet compression @nestjs/throttler @nestjs/terminus ioredis
```

---

## 9. Contatos e Suporte

Para questões de segurança críticas:
- **NÃO** abra issue pública
- Entre em contato direto com a equipe de segurança

---

## 10. Atualizações e Compliance

### Rotação de Chaves
- **Encryption Keys:** A cada 90 dias
- **JWT Secret:** A cada 180 dias
- **API Keys:** A cada 365 dias

### Compliance
- **LGPD:** Dados criptografados em repouso
- **PCI-DSS:** Dados de cartão NUNCA são armazenados (via Asaas)
- **GDPR:** Right to be forgotten implementado
- **SOC 2:** Logs auditáveis sem dados sensíveis

---

**Última atualização:** 2025-12-19
**Versão:** 1.0.0
