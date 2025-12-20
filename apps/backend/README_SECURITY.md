# 🔒 Backend Security - Guia Rápido

## ⚡ Quick Start

### 1. Instalar Dependências
```bash
cd apps/backend
npm install
```

### 2. Configurar Variáveis de Ambiente
```bash
# Copiar .env.example para .env
cp .env.example .env

# Gerar encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Adicionar ao .env:
ENCRYPTION_KEY=sua_chave_gerada_64_chars
CORS_ORIGIN=http://localhost:3000,http://localhost:8081
NODE_ENV=development
```

### 3. Iniciar Aplicação
```bash
npm run dev
```

### 4. Testar Health Checks
```bash
curl http://localhost:3001/health
curl http://localhost:3001/health/live
curl http://localhost:3001/health/ready
```

---

## 📚 Documentação Completa

- **[SECURITY.md](./SECURITY.md)** - Guia completo de segurança
- **[INSTALL_SECURITY.md](./INSTALL_SECURITY.md)** - Instruções detalhadas de instalação
- **[SECURITY_IMPROVEMENTS.md](./SECURITY_IMPROVEMENTS.md)** - Resumo das melhorias
- **[SECURITY_EXAMPLES.md](./src/common/SECURITY_EXAMPLES.md)** - Exemplos práticos de uso

---

## 🚀 Recursos Implementados

### ✅ 1. Helmet + Compression (main.ts)
- Headers de segurança (XSS, clickjacking)
- Compressão gzip (~70% redução de bandwidth)
- CORS restritivo
- Graceful shutdown

### ✅ 2. SecureLogger
```typescript
import { SecureLoggerService } from '@/common/logging';

constructor(private logger: SecureLoggerService) {}

// Sanitiza automaticamente CPF, senhas, tokens, cartões
this.logger.log('User data', { user });
```

### ✅ 3. Encryption com Key Rotation
```typescript
import { EncryptionService } from '@/common/encryption';

// Encrypt com chave atual
const encrypted = this.encryption.encrypt('dados sensíveis');

// Decrypt (tenta todas as chaves)
const decrypted = this.encryption.decrypt(encrypted);
```

### ✅ 4. Rate Limiting por Usuário
```typescript
import { UserRateLimit } from '@/common/rate-limit';

@UserRateLimit({ limit: 10, ttl: 60000 })
@Get('endpoint')
async method() { ... }
```

### ✅ 5. Health Checks
- `/health/live` - Liveness probe (K8s)
- `/health/ready` - Readiness probe (K8s)
- `/health` - Status completo

---

## 🔧 Configuração Rápida

### Variáveis de Ambiente Mínimas
```bash
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://user:pass@localhost:5432/db
JWT_SECRET=seu_secret_aqui
ENCRYPTION_KEY=64_caracteres_hex
CORS_ORIGIN=http://localhost:3000
```

### Gerar Chaves
```bash
# Encryption Key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# JWT Secret (pode ser qualquer string longa)
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

---

## 📦 Dependências Adicionadas

```json
{
  "dependencies": {
    "helmet": "^7.1.0",
    "compression": "^1.7.4",
    "@nestjs/throttler": "^5.1.2",
    "@nestjs/terminus": "^10.2.3"
  },
  "devDependencies": {
    "@types/compression": "^1.7.5"
  }
}
```

---

## 🎯 Para Desenvolvedores

### Usar SecureLogger em Novos Services
```typescript
import { Injectable } from '@nestjs/common';
import { SecureLoggerService } from '@/common/logging';

@Injectable()
export class MyService {
  constructor(private readonly logger: SecureLoggerService) {
    this.logger.setContext(MyService.name);
  }

  async myMethod(data: any) {
    // ✅ Dados sensíveis sanitizados automaticamente
    this.logger.log('Processing data', { data });
  }
}
```

### Adicionar Rate Limit em Endpoints
```typescript
import { UserRateLimit } from '@/common/rate-limit';

@Controller('api')
export class MyController {

  // Limite: 100 requests por 15 minutos
  @Get('list')
  @UserRateLimit({ limit: 100, ttl: 900000 })
  async list() { ... }

  // Limite: 5 exports por hora
  @Get('export')
  @UserRateLimit({
    limit: 5,
    ttl: 3600000,
    message: 'Limite de 5 exports por hora atingido'
  })
  async export() { ... }
}
```

### Criptografar Dados Sensíveis
```typescript
import { EncryptionService } from '@/common/encryption';

@Injectable()
export class MyService {
  constructor(private readonly encryption: EncryptionService) {}

  async saveApiKey(apiKey: string) {
    // ✅ Encrypt antes de salvar
    const encrypted = this.encryption.encrypt(apiKey);
    await this.prisma.table.create({
      data: { apiKeyEncrypted: encrypted }
    });
  }

  async getApiKey(id: string) {
    const record = await this.prisma.table.findUnique({ where: { id } });
    // ✅ Decrypt ao buscar
    return this.encryption.decrypt(record.apiKeyEncrypted);
  }
}
```

---

## 🐳 Docker / Kubernetes

### Docker Compose
```yaml
services:
  backend:
    build: .
    ports:
      - "3001:3001"
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://...
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health/ready"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Kubernetes
```yaml
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
```

---

## 📊 Checklist de Segurança

### Desenvolvimento
- [ ] Dependências instaladas
- [ ] `.env` configurado
- [ ] `ENCRYPTION_KEY` gerada
- [ ] Health checks funcionando

### Produção
- [ ] `NODE_ENV=production`
- [ ] CORS restrito aos domínios corretos
- [ ] JWT_SECRET forte (64+ chars)
- [ ] Encryption key rotacionada periodicamente
- [ ] Redis configurado (rate limiting)
- [ ] Health checks configurados no K8s
- [ ] Monitoramento ativo
- [ ] Logs sem dados sensíveis

---

## 🚨 Troubleshooting

### Erro: "ENCRYPTION_KEY must be 64 characters"
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Erro: "CORS blocked"
```bash
# Adicionar domínio ao .env
CORS_ORIGIN=http://localhost:3000,https://app.seudominio.com
```

### Health Check retorna 503
```bash
# Verificar Database
npx prisma db push

# Verificar Redis (opcional)
docker run -d -p 6379:6379 redis:alpine
```

### Rate Limit não funciona
```bash
# Verificar se guard está registrado globalmente
# Ou use decorator @UserRateLimit em cada endpoint
```

---

## 📞 Suporte

- Leia primeiro: [SECURITY.md](./SECURITY.md)
- Exemplos práticos: [SECURITY_EXAMPLES.md](./src/common/SECURITY_EXAMPLES.md)
- Instalação: [INSTALL_SECURITY.md](./INSTALL_SECURITY.md)

Para questões críticas de segurança:
- **NÃO** abra issue pública
- Entre em contato direto com a equipe

---

## 🎓 Recursos Externos

- [NestJS Security](https://docs.nestjs.com/security/authentication)
- [Helmet.js](https://helmetjs.github.io/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [LGPD](https://www.gov.br/cidadania/pt-br/acesso-a-informacao/lgpd)

---

**Desenvolvido com segurança em mente para escalar até 1M+ usuários** 🚀🔒
