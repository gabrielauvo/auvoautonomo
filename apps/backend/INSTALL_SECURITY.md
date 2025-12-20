# Instalação das Melhorias de Segurança

## Passo 1: Instalar Dependências

```bash
cd apps/backend

# Instalar todas as dependências de segurança
npm install helmet compression @nestjs/throttler @nestjs/terminus ioredis

# Ou com yarn
yarn add helmet compression @nestjs/throttler @nestjs/terminus ioredis
```

## Passo 2: Atualizar package.json

As seguintes dependências foram adicionadas:

```json
{
  "dependencies": {
    "helmet": "^7.1.0",
    "compression": "^1.7.4",
    "@nestjs/throttler": "^5.1.0",
    "@nestjs/terminus": "^10.2.0",
    "ioredis": "^5.8.2"
  }
}
```

## Passo 3: Atualizar app.module.ts

Adicione o SecureLoggerModule e HealthModule:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';

// Novos imports
import { SecureLoggerModule } from './common/logging';
import { HealthModule } from './health';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    // Rate Limiting Global (por IP)
    ThrottlerModule.forRoot([{
      ttl: 60000, // 1 minuto
      limit: 100, // 100 requests
    }]),

    // Logger Seguro (Global)
    SecureLoggerModule,

    // Health Checks
    HealthModule,

    // ... outros módulos
  ],
})
export class AppModule {}
```

## Passo 4: Configurar Variáveis de Ambiente

Adicione ao `.env`:

```bash
# Ambiente
NODE_ENV=development

# CORS (domínios permitidos separados por vírgula)
CORS_ORIGIN=http://localhost:3000,http://localhost:3001,http://localhost:8081

# Encryption Key Rotation
ENCRYPTION_KEY=64_caracteres_hexadecimais_aqui
ENCRYPTION_KEY_PREVIOUS=

# Redis (opcional, mas recomendado para produção)
REDIS_URL=redis://localhost:6379

# Asaas Webhook Token (para validar webhooks)
ASAAS_PLATFORM_WEBHOOK_TOKEN=token_seguro_gerado_por_voce
```

### Gerar Encryption Key

```bash
# Linux/Mac
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Windows (PowerShell)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Ou use o método da classe
# No terminal Node:
# > const { EncryptionService } = require('./dist/common/encryption/encryption.service');
# > EncryptionService.generateKey()
```

## Passo 5: Usar SecureLogger em Services

### Substituir Logger Padrão

**Antes:**
```typescript
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MeuService {
  private readonly logger = new Logger(MeuService.name);

  async minhaFuncao(user) {
    this.logger.log('User data', user); // ❌ Pode expor dados sensíveis
  }
}
```

**Depois:**
```typescript
import { Injectable } from '@nestjs/common';
import { SecureLoggerService } from '@/common/logging';

@Injectable()
export class MeuService {
  constructor(
    private readonly logger: SecureLoggerService
  ) {
    this.logger.setContext(MeuService.name);
  }

  async minhaFuncao(user) {
    this.logger.log('User data', user); // ✅ Sanitiza automaticamente CPF, senhas, etc
  }
}
```

## Passo 6: Adicionar Rate Limiting em Endpoints Críticos

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRateLimit } from '@/common/rate-limit';

@Controller('relatorios')
export class RelatoriosController {

  // Limita exports a 5 por hora por usuário
  @Get('export')
  @UserRateLimit({
    limit: 5,
    ttl: 3600000,
    keyPrefix: 'export',
    message: 'Você atingiu o limite de 5 exports por hora'
  })
  async exportar() {
    // ...
  }

  // Limita operações custosas a 10 por hora
  @Post('processar-massa')
  @UserRateLimit({
    limit: 10,
    ttl: 3600000,
    keyPrefix: 'bulk'
  })
  async processarEmMassa() {
    // ...
  }
}
```

## Passo 7: Configurar Health Checks no Docker/Kubernetes

### Docker Compose
```yaml
services:
  backend:
    build: ./apps/backend
    ports:
      - "3001:3001"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health/ready"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

### Kubernetes
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: backend
spec:
  containers:
  - name: backend
    image: seu-backend:latest
    ports:
    - containerPort: 3001

    livenessProbe:
      httpGet:
        path: /health/live
        port: 3001
      initialDelaySeconds: 30
      periodSeconds: 10

    readinessProbe:
      httpGet:
        path: /health/ready
        port: 3001
      initialDelaySeconds: 10
      periodSeconds: 5

    startupProbe:
      httpGet:
        path: /health/startup
        port: 3001
      failureThreshold: 30
      periodSeconds: 10
```

## Passo 8: Testar as Melhorias

### Testar Health Checks
```bash
# Liveness
curl http://localhost:3001/health/live

# Readiness
curl http://localhost:3001/health/ready

# Completo
curl http://localhost:3001/health
```

### Testar Rate Limiting
```bash
# Fazer 11 requisições rápidas (limite é 10/min)
for i in {1..11}; do
  curl -H "Authorization: Bearer SEU_TOKEN" \
       http://localhost:3001/api/endpoint
  sleep 0.1
done

# A 11ª deve retornar 429 Too Many Requests
```

### Testar Logging Seguro
```typescript
// Em qualquer service
this.logger.log('Test sensitive data', {
  cpf: '123.456.789-00',
  password: 'senhaSecreta123',
  cardNumber: '4111 1111 1111 1111',
  email: 'user@example.com'
});

// No console deve aparecer:
// {
//   cpf: '[REDACTED]',
//   password: '[REDACTED]',
//   cardNumber: '[REDACTED]',
//   email: '[REDACTED]'
// }
```

### Testar Key Rotation
```typescript
// No terminal Node/NestJS CLI
const { EncryptionService } = require('./dist/common/encryption/encryption.service');

// Gerar chave
const key = EncryptionService.generateKey();
console.log('Nova chave:', key);

// Testar encrypt/decrypt
const encrypted = encryptionService.encrypt('dados sensíveis');
const decrypted = encryptionService.decrypt(encrypted);

// Verificar se está usando chave atual
const isCurrent = encryptionService.isUsingCurrentKey(encrypted);
console.log('Usando chave atual?', isCurrent);
```

## Passo 9: Produção - Configurações Adicionais

### Nginx (se usar como proxy reverso)
```nginx
server {
    listen 80;
    server_name api.seudominio.com;

    # Trust proxy para rate limiting correto
    set_real_ip_from 0.0.0.0/0;
    real_ip_header X-Forwarded-For;

    location / {
        proxy_pass http://backend:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeout para operações longas
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
```

### PM2 (se usar)
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'backend',
    script: './dist/main.js',
    instances: 'max', // Usa todos os CPUs
    exec_mode: 'cluster',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001,
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

    // Graceful shutdown
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000,
  }]
};
```

## Passo 10: Monitoramento (Recomendado)

### Instalar Prometheus/Grafana
```bash
# Adicionar métricas
npm install @willsoto/nestjs-prometheus prom-client

# Ou
yarn add @willsoto/nestjs-prometheus prom-client
```

### Configurar Logs Estruturados
```typescript
// main.ts
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

const app = await NestFactory.create(AppModule, {
  logger: WinstonModule.createLogger({
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
        ),
      }),
    ],
  }),
});
```

## Troubleshooting

### Erro: "ENCRYPTION_KEY must be 64 characters"
```bash
# Gerar chave válida
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Erro: "Redis connection failed"
```bash
# Verificar se Redis está rodando
redis-cli ping
# Deve retornar: PONG

# Ou iniciar Redis
docker run -d -p 6379:6379 redis:alpine
```

### Erro: "CORS blocked"
```bash
# Verificar CORS_ORIGIN no .env
CORS_ORIGIN=http://localhost:3000,http://seudominio.com

# Reiniciar aplicação
npm run dev
```

### Health Check retorna 503
```bash
# Verificar Database
npx prisma db push

# Verificar Redis (opcional)
redis-cli ping

# Ver logs detalhados
curl http://localhost:3001/health | jq
```

## Conclusão

Todas as melhorias de segurança foram implementadas. Para suporte adicional, consulte:

- [SECURITY.md](./SECURITY.md) - Guia completo de segurança
- [docs/](../../docs/) - Documentação geral do projeto

---

**Importante:** Nunca commite arquivos `.env` com dados sensíveis no Git!
