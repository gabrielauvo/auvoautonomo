# Guia de Deploy - Infraestrutura de Produção

## Visão Geral

Esta infraestrutura foi projetada para suportar **1M+ usuários** com alta disponibilidade, segurança e performance.

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                     Load Balancer (Nginx)                   │
│                    (Opcional - não incluído)                │
└──────────────────────────┬──────────────────────────────────┘
                           │
           ┌───────────────┴───────────────┐
           │                               │
           ▼                               ▼
┌──────────────────────┐        ┌──────────────────────┐
│  Frontend (Next.js)  │        │  Backend (NestJS)    │
│  - 4 replicas        │        │  - 3 replicas        │
│  - 1GB RAM each      │        │  - 2GB RAM each      │
│  - Non-root user     │        │  - Non-root user     │
└──────────┬───────────┘        └──────────┬───────────┘
           │                               │
           └───────────────┬───────────────┘
                           │
           ┌───────────────┴───────────────┐
           │                               │
           ▼                               ▼
┌──────────────────────┐        ┌──────────────────────┐
│  PostgreSQL 16       │        │  Redis 7             │
│  - 4GB RAM           │        │  - 2GB RAM           │
│  - Optimized         │        │  - LRU Cache         │
│  - Persistent        │        │  - Persistent        │
└──────────────────────┘        └──────────────────────┘
```

## Componentes

### 1. Backend (NestJS)

**Dockerfile:** `apps/backend/Dockerfile`

**Características:**
- Multi-stage build (reduz tamanho em ~70%)
- Node 20 Alpine (imagem mínima)
- Non-root user (segurança)
- Health check integrado
- Prisma Client otimizado

**Recursos em Produção:**
- CPU: 1-2 cores
- RAM: 1-2GB
- Réplicas: 3 instâncias

### 2. Frontend (Next.js)

**Dockerfile:** `apps/web/Dockerfile`

**Características:**
- Standalone output (reduz tamanho em ~80%)
- Multi-stage build
- Static assets otimizados
- Read-only filesystem
- Cache otimizado

**Recursos em Produção:**
- CPU: 0.5-1 core
- RAM: 512MB-1GB
- Réplicas: 4 instâncias

### 3. PostgreSQL

**Configurações Otimizadas:**
- max_connections: 500
- shared_buffers: 1GB
- effective_cache_size: 3GB
- Parallel workers: 8

### 4. Redis

**Configurações:**
- maxmemory: 1.5GB
- maxmemory-policy: allkeys-lru
- Persistence: AOF + RDB
- TCP keepalive: 300s

## Setup Inicial

### 1. Pré-requisitos

```bash
# Instalar Docker e Docker Compose
docker --version  # >= 20.10
docker-compose --version  # >= 2.0
```

### 2. Configurar Variáveis de Ambiente

```bash
# Copiar template
cp .env.example .env.production

# Editar com valores reais
nano .env.production
```

**Variáveis OBRIGATÓRIAS:**
```env
# Database
POSTGRES_PASSWORD=SENHA_FORTE_AQUI

# JWT
JWT_SECRET=STRING_MUITO_LONGO_E_ALEATORIO_MINIMO_64_CHARS

# URLs
NEXT_PUBLIC_API_URL=https://api.seudominio.com
NEXT_PUBLIC_APP_URL=https://seudominio.com
CORS_ORIGIN=https://seudominio.com

# Docker Registry
DOCKER_REGISTRY=ghcr.io
DOCKER_NAMESPACE=sua-organizacao
```

### 3. Build das Imagens

```bash
# Desenvolvimento
docker-compose up -d --build

# Produção
docker-compose -f docker-compose.prod.yml build
```

## Deploy

### Opção 1: Script Automatizado (Recomendado)

```bash
# Dar permissão de execução
chmod +x scripts/deploy.sh

# Deploy completo
./scripts/deploy.sh deploy

# Deploy com versão específica
./scripts/deploy.sh -v 2.0.0 deploy

# Deploy com incremento minor
./scripts/deploy.sh -t minor deploy

# Dry run (testar sem executar)
./scripts/deploy.sh --dry-run deploy

# Pular testes
./scripts/deploy.sh --skip-tests deploy
```

**O script faz:**
1. Verifica pré-requisitos
2. Executa testes
3. Faz backup do banco
4. Build das imagens
5. Tag das imagens (versão, data, commit SHA)
6. Push para registry
7. Deploy com zero-downtime
8. Verifica health dos serviços
9. Cleanup de imagens antigas

### Opção 2: Manual

```bash
# 1. Build
docker-compose -f docker-compose.prod.yml build

# 2. Tag
docker tag mycompany/backend:latest ghcr.io/mycompany/backend:1.0.0
docker tag mycompany/web:latest ghcr.io/mycompany/web:1.0.0

# 3. Push
docker push ghcr.io/mycompany/backend:1.0.0
docker push ghcr.io/mycompany/web:1.0.0

# 4. Deploy
VERSION=1.0.0 docker-compose -f docker-compose.prod.yml up -d
```

## Operações

### Logs

```bash
# Ver logs em tempo real
docker-compose -f docker-compose.prod.yml logs -f

# Logs de um serviço específico
docker-compose -f docker-compose.prod.yml logs -f backend

# Últimas 100 linhas
docker-compose -f docker-compose.prod.yml logs --tail=100 backend
```

### Escalar Serviços

```bash
# Aumentar réplicas
docker-compose -f docker-compose.prod.yml up -d --scale backend=5 --scale web=6

# Ou editar deploy.replicas no docker-compose.prod.yml
```

### Backup do Banco

```bash
# Manual
docker-compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U postgres monorepo_prod > backup-$(date +%Y%m%d).sql

# Com o script
./scripts/deploy.sh backup

# Restaurar
docker-compose -f docker-compose.prod.yml exec -T postgres \
  psql -U postgres monorepo_prod < backup-20240101.sql
```

### Rollback

```bash
# Com script
./scripts/deploy.sh rollback 1.5.0

# Manual
VERSION=1.5.0 docker-compose -f docker-compose.prod.yml up -d
```

### Monitoramento

```bash
# Status dos containers
docker-compose -f docker-compose.prod.yml ps

# Estatísticas em tempo real
docker-compose -f docker-compose.prod.yml stats

# Health checks
docker inspect --format='{{.State.Health.Status}}' monorepo-prod-backend
```

### Executar Comandos

```bash
# Migrations
docker-compose -f docker-compose.prod.yml exec backend \
  pnpm prisma migrate deploy

# Seed
docker-compose -f docker-compose.prod.yml exec backend \
  pnpm prisma db seed

# Shell
docker-compose -f docker-compose.prod.yml exec backend sh
```

## Otimizações para 1M+ Usuários

### 1. Banco de Dados

**PostgreSQL:**
- Connection pooling: 50 conexões por instância
- Índices otimizados
- Particionamento de tabelas grandes
- Replicas read-only (não incluído)

```sql
-- Monitorar conexões
SELECT count(*) FROM pg_stat_activity;

-- Queries lentas
SELECT query, mean_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### 2. Cache

**Redis:**
- Cache de queries frequentes
- Session storage
- Rate limiting
- Job queue (BullMQ)

**Estratégia:**
- Cache-aside pattern
- TTL curto para dados dinâmicos (5min)
- TTL longo para dados estáticos (24h)

### 3. CDN (Recomendado)

Configure um CDN para servir:
- Assets estáticos (`_next/static/*`)
- Imagens otimizadas
- Fonts

**Providers sugeridos:**
- Cloudflare
- AWS CloudFront
- Vercel Edge Network

### 4. Load Balancer

Use Nginx ou um Load Balancer gerenciado:
- Rate limiting
- SSL termination
- Gzip compression
- Cache de assets

```bash
# Com Nginx incluído
docker-compose -f docker-compose.prod.yml up -d nginx
```

### 5. Horizontal Scaling

```bash
# Adicionar mais workers
docker-compose -f docker-compose.prod.yml up -d \
  --scale backend=10 \
  --scale web=15
```

### 6. Monitoring & Observability

**Adicione (não incluído):**
- Prometheus + Grafana
- Sentry para error tracking
- DataDog / New Relic APM
- ELK Stack para logs

## Segurança

### 1. Checklist de Produção

- [ ] Todas as senhas alteradas dos defaults
- [ ] JWT_SECRET com 64+ caracteres aleatórios
- [ ] SSL/TLS configurado
- [ ] Firewall configurado
- [ ] Non-root users nos containers
- [ ] Read-only filesystems onde possível
- [ ] Security headers configurados
- [ ] Rate limiting ativo
- [ ] Backup automático configurado
- [ ] Logs centralizados
- [ ] Monitoring ativo
- [ ] Secrets não commitados no Git

### 2. Variáveis Sensíveis

```bash
# NUNCA commitar .env.production
echo ".env.production" >> .gitignore

# Usar secrets management
# - Docker Secrets
# - Kubernetes Secrets
# - AWS Secrets Manager
# - Vault
```

### 3. Network Security

```yaml
# Isolamento de redes
- Frontend só acessa Backend
- Backend acessa Database e Redis
- Database isolada do mundo externo
```

## Performance

### Métricas Esperadas

**Backend:**
- Response time: < 100ms (p95)
- Throughput: 1000+ req/s por instância
- Memory: ~1GB por instância

**Frontend:**
- FCP: < 1s
- LCP: < 2.5s
- TTI: < 3.5s

**Database:**
- Query time: < 10ms (p95)
- Connections: < 400 de 500

### Testes de Carga

```bash
# Instalar k6
brew install k6  # macOS
# ou
apt install k6  # Linux

# Executar teste
k6 run scripts/load-test.js
```

## Troubleshooting

### Container não inicia

```bash
# Ver logs de erro
docker-compose -f docker-compose.prod.yml logs backend

# Verificar health
docker inspect monorepo-prod-backend

# Entrar no container
docker-compose -f docker-compose.prod.yml exec backend sh
```

### Banco de dados lento

```sql
-- Ver queries ativas
SELECT * FROM pg_stat_activity WHERE state = 'active';

-- Matar query lenta
SELECT pg_terminate_backend(pid);

-- Rebuild índices
REINDEX DATABASE monorepo_prod;
```

### Memory issues

```bash
# Ver uso de memória
docker stats

# Limitar memória
# Editar deploy.resources no docker-compose.prod.yml
```

### Disco cheio

```bash
# Limpar imagens antigas
docker image prune -a

# Limpar volumes não usados
docker volume prune

# Limpar tudo (CUIDADO!)
docker system prune -a --volumes
```

## CI/CD

### GitHub Actions (exemplo)

```yaml
name: Deploy to Production

on:
  push:
    tags:
      - 'v*'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Login to Registry
        run: echo "${{ secrets.GITHUB_TOKEN }}" | docker login ghcr.io -u ${{ github.actor }} --password-stdin

      - name: Deploy
        run: |
          chmod +x scripts/deploy.sh
          ./scripts/deploy.sh deploy
        env:
          VERSION: ${{ github.ref_name }}
```

## Custos Estimados

**Para 1M usuários ativos:**

**AWS (estimativa):**
- EC2 (t3.xlarge x 3): ~$400/mês
- RDS PostgreSQL (db.r6g.xlarge): ~$350/mês
- ElastiCache Redis: ~$200/mês
- ALB: ~$50/mês
- CloudFront + S3: ~$100/mês
- **Total: ~$1100/mês**

**Alternativas mais baratas:**
- DigitalOcean: ~$500/mês
- Hetzner: ~$300/mês
- OVH: ~$250/mês

## Suporte

Para problemas:
1. Verificar logs
2. Consultar esta documentação
3. Abrir issue no repositório
4. Contatar DevOps team

## Referências

- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [NestJS Performance](https://docs.nestjs.com/techniques/performance)
- [PostgreSQL Tuning](https://www.postgresql.org/docs/current/runtime-config.html)
