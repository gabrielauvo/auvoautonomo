# Exemplos Práticos de Uso - Recursos de Segurança

## 1. SecureLogger - Logging Sem Expor Dados Sensíveis

### Exemplo Básico
```typescript
import { Injectable } from '@nestjs/common';
import { SecureLoggerService } from '@/common/logging';

@Injectable()
export class UserService {
  constructor(private readonly logger: SecureLoggerService) {
    this.logger.setContext(UserService.name);
  }

  async createUser(data: CreateUserDto) {
    // ✅ BOM - CPF, email, senha serão automaticamente sanitizados
    this.logger.log('Creating user', { data });

    // Código...
    const user = await this.prisma.user.create({ data });

    // ✅ BOM - Dados sensíveis são removidos do log
    this.logger.log('User created', { user });

    return user;
  }
}
```

### Exemplo com Erros
```typescript
async processPayment(paymentData: PaymentDto) {
  try {
    const result = await this.paymentGateway.charge(paymentData);

    // ✅ BOM - Número do cartão será redactado
    this.logger.log('Payment processed', { result });

    return result;
  } catch (error) {
    // ✅ BOM - Usa método específico para erros
    this.logger.logError('Payment failed', error, {
      userId: paymentData.userId,
      amount: paymentData.amount,
      // NÃO inclua cardNumber, cvv, etc aqui
    });

    throw error;
  }
}
```

### Exemplo Customizado
```typescript
// Adicionar campos sensíveis específicos do seu domínio
SecureLoggerService.addSensitiveField('numeroProntuario');
SecureLoggerService.addSensitiveField('registroMedico');

// Adicionar pattern customizado
SecureLoggerService.addSensitivePattern(
  /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g, // CNPJ
  'CNPJ:[REDACTED]'
);
```

---

## 2. Rate Limiting por Usuário

### Exemplo: Endpoint de Export (Operação Custosa)
```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRateLimit } from '@/common/rate-limit';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {

  // Limita a 5 exports por hora por usuário
  @Get('export/clients')
  @UserRateLimit({
    limit: 5,
    ttl: 3600000, // 1 hora em ms
    keyPrefix: 'export-clients',
    message: 'Limite de 5 exports por hora atingido. Aguarde para tentar novamente.'
  })
  async exportClients(@CurrentUser() user: User) {
    // Operação custosa de export
    return this.reportsService.exportClientsToExcel(user.id);
  }

  // Limita a 10 relatórios por hora
  @Get('financial')
  @UserRateLimit({
    limit: 10,
    ttl: 3600000,
    keyPrefix: 'report-financial'
  })
  async getFinancialReport(@CurrentUser() user: User) {
    return this.reportsService.generateFinancial(user.id);
  }
}
```

### Exemplo: Endpoint de Criação (Prevenir Spam)
```typescript
@Controller('work-orders')
@UseGuards(JwtAuthGuard)
export class WorkOrdersController {

  // Limita criação a 50 ordens por hora
  @Post()
  @UserRateLimit({
    limit: 50,
    ttl: 3600000,
    keyPrefix: 'create-work-order',
    message: 'Limite de criação de ordens atingido. Aguarde 1 hora.'
  })
  async create(@CurrentUser() user: User, @Body() dto: CreateWorkOrderDto) {
    return this.workOrdersService.create(user.id, dto);
  }
}
```

### Exemplo: Endpoint de Busca (Prevenir Scraping)
```typescript
@Controller('clients')
@UseGuards(JwtAuthGuard)
export class ClientsController {

  // Limita buscas a 200 por 15 minutos
  @Get()
  @UserRateLimit({
    limit: 200,
    ttl: 900000, // 15 min
    keyPrefix: 'search-clients'
  })
  async findAll(@CurrentUser() user: User, @Query() query: SearchDto) {
    return this.clientsService.findAll(user.id, query);
  }
}
```

### Exemplo: Endpoint Público (Rate Limit Agressivo)
```typescript
@Controller('public')
export class PublicController {

  // Sem autenticação = rate limit mais agressivo
  @Get('work-order/:shareKey')
  @UserRateLimit({
    limit: 20,
    ttl: 3600000, // 20 acessos por hora
    keyPrefix: 'public-wo-view'
  })
  async viewPublicWorkOrder(@Param('shareKey') shareKey: string) {
    return this.workOrdersService.findByShareKey(shareKey);
  }
}
```

---

## 3. Encryption Service com Key Rotation

### Exemplo: Salvar Dados Sensíveis
```typescript
import { Injectable } from '@nestjs/common';
import { EncryptionService } from '@/common/encryption';

@Injectable()
export class AsaasIntegrationService {
  constructor(
    private readonly encryption: EncryptionService,
    private readonly prisma: PrismaService
  ) {}

  async saveApiKey(userId: string, apiKey: string) {
    // ✅ Encrypt antes de salvar no banco
    const apiKeyEncrypted = this.encryption.encrypt(apiKey);

    await this.prisma.asaasIntegration.create({
      data: {
        userId,
        apiKeyEncrypted, // Salva criptografado
        isActive: true,
      }
    });
  }

  async getApiKey(userId: string): Promise<string> {
    const integration = await this.prisma.asaasIntegration.findUnique({
      where: { userId }
    });

    if (!integration) {
      throw new NotFoundException('Integration not found');
    }

    // ✅ Decrypt ao buscar do banco
    // Tenta todas as chaves automaticamente (key rotation)
    const apiKey = this.encryption.decrypt(integration.apiKeyEncrypted);

    return apiKey;
  }
}
```

### Exemplo: Re-encrypt Dados Antigos (Migration)
```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { EncryptionService } from '@/common/encryption';

@Injectable()
export class EncryptionMigrationService implements OnModuleInit {
  constructor(
    private readonly encryption: EncryptionService,
    private readonly prisma: PrismaService,
    private readonly logger: SecureLoggerService
  ) {}

  async onModuleInit() {
    // Verifica se há chaves antigas configuradas
    const keysInfo = this.encryption.getKeysCount();

    if (keysInfo.previous > 0) {
      this.logger.log('Key rotation detected, checking for old encrypted data...');
      await this.migrateOldData();
    }
  }

  async migrateOldData() {
    // Busca dados que podem estar com chave antiga
    const integrations = await this.prisma.asaasIntegration.findMany();

    let migrated = 0;

    for (const integration of integrations) {
      try {
        // Verifica se está usando chave antiga
        const isOldKey = !this.encryption.isUsingCurrentKey(
          integration.apiKeyEncrypted
        );

        if (isOldKey) {
          // Re-encrypt com chave atual
          const reEncrypted = this.encryption.reEncrypt(
            integration.apiKeyEncrypted
          );

          await this.prisma.asaasIntegration.update({
            where: { id: integration.id },
            data: { apiKeyEncrypted: reEncrypted }
          });

          migrated++;
        }
      } catch (error) {
        this.logger.logError(
          `Failed to re-encrypt data for integration ${integration.id}`,
          error
        );
      }
    }

    this.logger.log(`Re-encrypted ${migrated} records with current key`);
  }
}
```

### Exemplo: Rotação de Chaves (Processo Manual)
```bash
# 1. Gerar nova chave
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Output: abc123...xyz789 (64 chars)

# 2. Atualizar .env (mover chave atual para PREVIOUS)
# Antes:
# ENCRYPTION_KEY=chave_atual_antiga
# ENCRYPTION_KEY_PREVIOUS=

# Depois:
# ENCRYPTION_KEY=abc123...xyz789
# ENCRYPTION_KEY_PREVIOUS=chave_atual_antiga

# 3. Reiniciar aplicação
npm run start:prod

# 4. (Opcional) Re-encrypt dados antigos
# Use o EncryptionMigrationService acima
```

---

## 4. Health Checks - Kubernetes/Docker

### Exemplo: Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend-deployment
spec:
  replicas: 3
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
      - name: backend
        image: seu-backend:1.0.0
        ports:
        - containerPort: 3001

        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: backend-secrets
              key: database-url

        # Liveness: Reinicia se falhar
        livenessProbe:
          httpGet:
            path: /health/live
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3

        # Readiness: Remove do load balancer se falhar
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3001
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 2

        # Startup: Aguarda inicialização
        startupProbe:
          httpGet:
            path: /health/startup
            port: 3001
          initialDelaySeconds: 0
          periodSeconds: 10
          timeoutSeconds: 3
          failureThreshold: 30 # 5 minutos max

        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
```

### Exemplo: Docker Compose
```yaml
version: '3.8'

services:
  backend:
    build: ./apps/backend
    ports:
      - "3001:3001"
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://user:pass@db:5432/fieldflow
      REDIS_URL: redis://redis:6379
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy

    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health/ready"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  db:
    image: postgres:15-alpine
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
```

### Exemplo: Monitoramento com Script
```bash
#!/bin/bash
# check-health.sh

API_URL="http://localhost:3001"

# Verifica liveness
echo "Checking liveness..."
curl -f "${API_URL}/health/live" || exit 1

# Verifica readiness
echo "Checking readiness..."
curl -f "${API_URL}/health/ready" || exit 1

# Health completo
echo "Getting full health status..."
curl -s "${API_URL}/health" | jq

echo "✅ All health checks passed!"
```

---

## 5. Combinando Tudo - Exemplo Real

```typescript
import { Injectable } from '@nestjs/common';
import { SecureLoggerService } from '@/common/logging';
import { EncryptionService } from '@/common/encryption';
import { UserRateLimit } from '@/common/rate-limit';

@Injectable()
export class PaymentService {
  constructor(
    private readonly logger: SecureLoggerService,
    private readonly encryption: EncryptionService,
    private readonly prisma: PrismaService,
    private readonly asaasClient: AsaasHttpClient
  ) {
    this.logger.setContext(PaymentService.name);
  }

  // Rate limit: 10 pagamentos por hora por usuário
  @UserRateLimit({
    limit: 10,
    ttl: 3600000,
    keyPrefix: 'create-payment',
    message: 'Limite de criação de pagamentos atingido (10/hora)'
  })
  async createPayment(userId: string, data: CreatePaymentDto) {
    // ✅ Log sanitizado (cardNumber será redactado)
    this.logger.log('Creating payment', {
      userId,
      amount: data.amount,
      // Não loga cardNumber aqui
    });

    try {
      // Busca API key criptografada
      const integration = await this.prisma.asaasIntegration.findUnique({
        where: { userId }
      });

      if (!integration) {
        throw new NotFoundException('Asaas integration not configured');
      }

      // ✅ Decrypt API key (suporta key rotation)
      const apiKey = this.encryption.decrypt(integration.apiKeyEncrypted);

      // Cria pagamento no Asaas
      const payment = await this.asaasClient.createPayment(apiKey, {
        customer: data.customerId,
        value: data.amount,
        dueDate: data.dueDate,
      });

      // Salva no banco
      const saved = await this.prisma.payment.create({
        data: {
          userId,
          asaasPaymentId: payment.id,
          amount: data.amount,
          status: 'PENDING',
        }
      });

      // ✅ Log seguro (sem dados sensíveis)
      this.logger.log('Payment created successfully', {
        paymentId: saved.id,
        asaasId: payment.id,
        amount: data.amount,
      });

      return saved;

    } catch (error) {
      // ✅ Log de erro sem expor dados sensíveis
      this.logger.logError('Failed to create payment', error, {
        userId,
        amount: data.amount,
        // NÃO inclui apiKey, cardNumber, etc
      });

      throw error;
    }
  }
}
```

---

## 6. Testes Automatizados

### Exemplo: Testar Rate Limiting
```typescript
import { Test } from '@nestjs/testing';
import { HttpStatus, INestApplication } from '@nestjs/common';
import * as request from 'supertest';

describe('Rate Limiting (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    // Login para pegar token
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'password' });

    authToken = response.body.token;
  });

  it('should block after rate limit exceeded', async () => {
    const endpoint = '/api/expensive-operation';

    // Faz 10 requests (limite)
    for (let i = 0; i < 10; i++) {
      await request(app.getHttpServer())
        .get(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(HttpStatus.OK);
    }

    // 11ª request deve ser bloqueada
    const response = await request(app.getHttpServer())
      .get(endpoint)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(HttpStatus.TOO_MANY_REQUESTS);

    expect(response.body.message).toContain('Too many requests');
    expect(response.body.retryAfter).toBeDefined();
  });
});
```

### Exemplo: Testar Logging Seguro
```typescript
import { SecureLoggerService } from '@/common/logging';

describe('SecureLoggerService', () => {
  let logger: SecureLoggerService;

  beforeEach(() => {
    logger = new SecureLoggerService('TestContext');
  });

  it('should sanitize CPF in logs', () => {
    const spy = jest.spyOn(console, 'log');

    logger.log('User data', {
      name: 'João Silva',
      cpf: '123.456.789-00',
    });

    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('[REDACTED]')
    );
    expect(spy).not.toHaveBeenCalledWith(
      expect.stringContaining('123.456.789-00')
    );
  });

  it('should sanitize passwords', () => {
    const spy = jest.spyOn(console, 'log');

    logger.log('Login attempt', {
      email: 'user@example.com',
      password: 'senhaSecreta123',
    });

    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('[REDACTED]')
    );
    expect(spy).not.toHaveBeenCalledWith(
      expect.stringContaining('senhaSecreta123')
    );
  });
});
```

---

## Recursos Adicionais

- [SECURITY.md](../SECURITY.md) - Guia completo de segurança
- [INSTALL_SECURITY.md](../INSTALL_SECURITY.md) - Instruções de instalação
- [NestJS Security Best Practices](https://docs.nestjs.com/security/authentication)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
