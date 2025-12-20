# Infraestrutura - Arquitetura para 1M+ Usuários

## Visão Geral

Esta documentação descreve a infraestrutura completa, otimizada para suportar **mais de 1 milhão de usuários** com alta disponibilidade, segurança e performance.

## Índice

- [Arquitetura](#arquitetura)
- [Componentes](#componentes)
- [Otimizações](#otimizações)
- [Segurança](#segurança)
- [Escalabilidade](#escalabilidade)
- [Monitoramento](#monitoramento)
- [Custos](#custos)

## Arquitetura

### Diagrama de Infraestrutura

```
                                   Internet
                                      │
                                      ▼
                        ┌─────────────────────────┐
                        │   CDN / CloudFlare      │
                        │   - Static Assets       │
                        │   - DDoS Protection     │
                        └──────────┬──────────────┘
                                   │
                        ┌──────────▼──────────────┐
                        │  Load Balancer (Nginx)  │
                        │  - SSL Termination      │
                        │  - Rate Limiting        │
                        │  - Gzip Compression     │
                        └──────────┬──────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
         ┌──────────▼─────────┐       ┌──────────▼─────────┐
         │  Frontend Cluster  │       │  Backend Cluster   │
         │  ┌──────────────┐  │       │  ┌──────────────┐  │
         │  │   Web #1     │  │       │  │  Backend #1  │  │
         │  │   Web #2     │  │       │  │  Backend #2  │  │
         │  │   Web #3     │  │       │  │  Backend #3  │  │
         │  │   Web #4     │  │       │  └──────────────┘  │
         │  └──────────────┘  │       │                    │
         │  Next.js           │       │  NestJS + Prisma   │
         │  4 replicas        │       │  3 replicas        │
         │  1GB RAM each      │       │  2GB RAM each      │
         └────────────────────┘       └──────────┬─────────┘
                                                  │
                                   ┌──────────────┴──────────────┐
                                   │                             │
                        ┌──────────▼─────────┐       ┌──────────▼─────────┐
                        │   PostgreSQL 16    │       │    Redis 7         │
                        │   - Primary DB     │       │    - Cache         │
                        │   - 4GB RAM        │       │    - Sessions      │
                        │   - Optimized      │       │    - Queue         │
                        │   - Backups        │       │    - 2GB RAM       │
                        └────────────────────┘       └────────────────────┘
```

### Fluxo de Requisição

1. **Usuário** → CDN (assets estáticos)
2. **CDN** → Load Balancer (requisições dinâmicas)
3. **Load Balancer** → Frontend (rotas públicas) ou Backend (API)
4. **Backend** → PostgreSQL (dados) + Redis (cache)
5. **Resposta** → Load Balancer → CDN → Usuário

## Componentes

### 1. Frontend (Next.js)

**Especificações:**
- Framework: Next.js 14
- Runtime: Node.js 20 Alpine
- Output: Standalone (reduz 80% do tamanho)
- Recursos: 512MB-1GB RAM, 0.5-1 CPU

**Otimizações:**
```javascript
// next.config.js
{
  output: 'standalone',           // Modo standalone
  compiler: {
    removeConsole: true,          // Remove console.logs
  },
  experimental: {
    optimizeCss: true,            // CSS otimizado
  },
  images: {
    formats: ['avif', 'webp'],    // Formatos modernos
    minimumCacheTTL: 60,          // Cache de imagens
  }
}
```

**Features:**
- Server-Side Rendering (SSR)
- Static Generation (SSG) onde possível
- Image Optimization automática
- Code Splitting por rota
- Prefetching de rotas

**Performance Esperada:**
- First Contentful Paint: < 1s
- Largest Contentful Paint: < 2.5s
- Time to Interactive: < 3.5s
- Cumulative Layout Shift: < 0.1

### 2. Backend (NestJS)

**Especificações:**
- Framework: NestJS 10
- ORM: Prisma
- Runtime: Node.js 20 Alpine
- Recursos: 1-2GB RAM, 1-2 CPU

**Otimizações:**
```typescript
// Database Connection Pool
{
  pool: {
    min: 2,
    max: 50,              // 50 conexões por instância
    idleTimeout: 10000,
    connectionTimeout: 30000
  }
}

// Redis Cache
{
  maxmemory: '1536mb',
  maxmemory_policy: 'allkeys-lru',
  ttl: {
    short: 300,         // 5 min
    medium: 3600,       // 1 hora
    long: 86400         // 24 horas
  }
}
```

**Features:**
- API RESTful + GraphQL (opcional)
- Authentication JWT
- Rate Limiting (100 req/s)
- Request/Response Logging
- Error Handling global
- Validation automática (class-validator)
- Swagger/OpenAPI docs

**Performance Esperada:**
- Response time (p95): < 100ms
- Throughput: 1000+ req/s por instância
- Memory usage: ~1GB estável
- CPU usage: < 60% em carga normal

### 3. PostgreSQL

**Versão:** 16 Alpine

**Configurações Otimizadas:**
```conf
# Connections
max_connections = 500

# Memory
shared_buffers = 1GB
effective_cache_size = 3GB
maintenance_work_mem = 256MB
work_mem = 2MB

# Checkpoint
checkpoint_completion_target = 0.9
wal_buffers = 16MB
min_wal_size = 2GB
max_wal_size = 8GB

# Parallelism
max_worker_processes = 8
max_parallel_workers = 8
max_parallel_workers_per_gather = 4

# Query Planner
random_page_cost = 1.1          # Para SSD
effective_io_concurrency = 200  # Para SSD
```

**Estratégias:**
- Connection Pooling (PgBouncer recomendado)
- Índices otimizados
- Particionamento de tabelas grandes
- Vacuum automático
- Replicas Read-Only (recomendado)

**Backup:**
- Backup diário automático
- Retenção: 30 dias
- Point-in-Time Recovery (PITR)
- Backup incremental

### 4. Redis

**Versão:** 7 Alpine

**Configurações:**
```conf
maxmemory 1536mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000

# Performance
tcp-backlog 511
timeout 300
tcp-keepalive 300
```

**Uso:**
- Cache de queries (70% dos hits)
- Session storage
- Rate limiting
- Job Queue (BullMQ)
- Pub/Sub para eventos

### 5. Nginx (Load Balancer)

**Configurações:**
```conf
worker_processes auto;
worker_connections 4096;

# Upstream
upstream backend {
  least_conn;
  server backend-1:3000;
  server backend-2:3000;
  server backend-3:3000;
  keepalive 32;
}

# Cache
proxy_cache_path /cache levels=1:2
                 keys_zone=api:10m
                 max_size=1g;

# Rate Limiting
limit_req_zone $binary_remote_addr
               zone=api:10m rate=20r/s;
```

**Features:**
- SSL/TLS Termination
- HTTP/2 Support
- Gzip Compression
- Static Cache
- Rate Limiting
- Request buffering

## Otimizações

### 1. Performance

#### Frontend
- **Code Splitting:** Cada rota carrega apenas o necessário
- **Lazy Loading:** Componentes carregados sob demanda
- **Image Optimization:** AVIF/WebP com lazy loading
- **Prefetching:** Links prefetchados no hover
- **Bundle Size:** < 200KB (gzipped)

#### Backend
- **Database Queries:** N+1 eliminado, joins otimizados
- **Caching:** 70%+ cache hit rate
- **Compression:** Gzip/Brotli para respostas
- **Connection Pooling:** Reutilização de conexões
- **Async Processing:** Jobs pesados em background

### 2. Caching Strategy

**Níveis de Cache:**

1. **CDN Cache** (CloudFlare)
   - Static assets: 1 ano
   - Images: 7 dias
   - HTML: sem cache

2. **Nginx Cache**
   - API responses: 5 min (selective)
   - Static files: 30 dias

3. **Redis Cache**
   - User sessions: 7 dias
   - API queries: 5-60 min
   - Rate limiting: 1 min

4. **Browser Cache**
   - Static assets: 1 ano
   - Images: 7 dias
   - HTML: sem cache

### 3. Database Optimization

**Índices:**
```sql
-- Índices compostos para queries frequentes
CREATE INDEX idx_users_email_status ON users(email, status);
CREATE INDEX idx_orders_user_created ON orders(user_id, created_at DESC);

-- Índices parciais para subsets
CREATE INDEX idx_active_users ON users(id) WHERE status = 'active';

-- Full-text search
CREATE INDEX idx_products_search ON products USING GIN(to_tsvector('english', name || ' ' || description));
```

**Particionamento:**
```sql
-- Particionar tabelas grandes por data
CREATE TABLE orders_2024_01 PARTITION OF orders
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

## Segurança

### 1. Containers

**Docker Best Practices:**
- Non-root user em todos os containers
- Read-only filesystem (onde possível)
- No capabilities desnecessários
- Resource limits (CPU, Memory)
- Health checks configurados

**Exemplo:**
```dockerfile
# Non-root user
RUN addgroup -g 1001 nodejs && \
    adduser -S nestjs -u 1001
USER nestjs

# Read-only filesystem
docker run --read-only ...

# Resource limits
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 2G
```

### 2. Network Security

**Isolamento:**
- Frontend: rede pública + frontend
- Backend: rede frontend + backend + database
- Database: apenas rede backend

**Firewall:**
```bash
# Apenas portas necessárias
- Frontend: 80, 443 (público)
- Backend: 3000 (interno)
- PostgreSQL: 5432 (interno)
- Redis: 6379 (interno)
```

### 3. Application Security

**Headers de Segurança:**
```javascript
{
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000',
  'Content-Security-Policy': '...',
  'Referrer-Policy': 'strict-origin-when-cross-origin'
}
```

**Authentication:**
- JWT com expiration curta (7 dias)
- Refresh tokens (30 dias)
- Bcrypt para passwords (rounds: 10)
- Rate limiting em login (5 req/min)

**Input Validation:**
- class-validator em todos os DTOs
- SQL injection: previne com Prisma ORM
- XSS: sanitização de inputs
- CSRF: tokens CSRF

### 4. Secrets Management

**NUNCA commitar:**
```bash
.env
.env.production
.env.local
*.key
*.pem
credentials.json
```

**Usar:**
- Docker Secrets
- Kubernetes Secrets
- AWS Secrets Manager
- HashiCorp Vault

## Escalabilidade

### 1. Horizontal Scaling

**Escalar Containers:**
```bash
# Aumentar réplicas
docker-compose -f docker-compose.prod.yml up -d \
  --scale backend=10 \
  --scale web=15

# Ou com deploy.replicas no docker-compose
```

**Auto-scaling (Kubernetes):**
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backend
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### 2. Vertical Scaling

**Aumentar Recursos:**
```yaml
deploy:
  resources:
    limits:
      cpus: '4'      # 2 → 4
      memory: 4G     # 2G → 4G
```

### 3. Database Scaling

**Read Replicas:**
```javascript
// Prisma com replicas
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// Read-only replica
const prismaRead = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_READ_URL,
    },
  },
});
```

**Sharding (para > 10M usuários):**
- Shard por região geográfica
- Shard por user_id hash
- Usar ferramentas: Citus, Vitess

### 4. Cache Scaling

**Redis Cluster:**
```conf
# 3 masters + 3 replicas
redis-cluster:
  nodes: 6
  replicas: 1
  maxmemory: 4GB per node
```

## Monitoramento

### 1. Métricas Essenciais

**Application:**
- Request rate (req/s)
- Response time (p50, p95, p99)
- Error rate (%)
- Throughput (MB/s)

**Infrastructure:**
- CPU usage (%)
- Memory usage (MB)
- Disk I/O (IOPS)
- Network I/O (MB/s)

**Business:**
- Active users
- Conversion rate
- Revenue
- User satisfaction (NPS)

### 2. Tools (Recomendados)

**APM:**
- New Relic
- DataDog
- Sentry (errors)

**Metrics:**
- Prometheus + Grafana
- CloudWatch (AWS)

**Logs:**
- ELK Stack (Elasticsearch, Logstash, Kibana)
- Splunk
- Papertrail

**Uptime:**
- UptimeRobot
- Pingdom
- StatusCake

### 3. Alertas

**Configurar alertas para:**
- CPU > 80% por 5 min
- Memory > 90% por 5 min
- Error rate > 5%
- Response time p95 > 500ms
- Disk space < 20%
- Database connections > 400

## Custos

### Estimativa para 1M Usuários Ativos

#### AWS (us-east-1)

| Serviço | Especificação | Custo/mês |
|---------|--------------|-----------|
| EC2 | 3x t3.xlarge (backend) | ~$400 |
| EC2 | 4x t3.large (frontend) | ~$300 |
| RDS | db.r6g.xlarge (PostgreSQL) | ~$350 |
| ElastiCache | cache.r6g.large (Redis) | ~$200 |
| ALB | Application Load Balancer | ~$50 |
| CloudFront | CDN (100TB transfer) | ~$800 |
| S3 | Storage (1TB) | ~$25 |
| **Total** | | **~$2,125/mês** |

#### DigitalOcean

| Serviço | Especificação | Custo/mês |
|---------|--------------|-----------|
| Droplets | 3x 4GB RAM (backend) | ~$180 |
| Droplets | 4x 2GB RAM (frontend) | ~$160 |
| Managed DB | PostgreSQL 16GB | ~$120 |
| Managed DB | Redis 4GB | ~$60 |
| Load Balancer | 1x LB | ~$12 |
| Spaces CDN | 1TB storage + CDN | ~$50 |
| **Total** | | **~$582/mês** |

#### Hetzner (Mais Barato)

| Serviço | Especificação | Custo/mês |
|---------|--------------|-----------|
| Dedicated | AX41 (AMD Ryzen) | ~$50 |
| Dedicated | AX41 (AMD Ryzen) | ~$50 |
| Dedicated | AX41 (AMD Ryzen) | ~$50 |
| Load Balancer | 1x LB | ~$5 |
| Object Storage | 1TB | ~$5 |
| **Total** | | **~$160/mês** |

### Redução de Custos

**Estratégias:**
1. Use Reserved Instances (AWS: -40%)
2. Use Spot Instances para workers (AWS: -70%)
3. Otimize cache (reduza queries DB)
4. Compressão de assets (reduza bandwidth)
5. Auto-scaling (pague só o necessário)
6. CloudFlare Free (CDN gratuito)

## Próximos Passos

### Para 10M+ Usuários

1. **Microserviços:** Separar backend em serviços menores
2. **Multi-Region:** Deploy em múltiplas regiões
3. **Database Sharding:** Particionar dados
4. **Message Queue:** RabbitMQ ou Kafka
5. **Service Mesh:** Istio para comunicação
6. **Kubernetes:** Orquestração avançada

### Para 100M+ Usuários

1. **Edge Computing:** CloudFlare Workers, AWS Lambda@Edge
2. **Global CDN:** Múltiplos POPs
3. **Database Federation:** Múltiplos clusters
4. **GraphQL Federation:** API unificada
5. **Event Sourcing:** CQRS pattern
6. **Chaos Engineering:** Netflix Chaos Monkey

## Conclusão

Esta infraestrutura oferece:

- **Performance:** < 100ms response time, 1000+ req/s
- **Escalabilidade:** Horizontal e vertical
- **Segurança:** Defense in depth
- **Confiabilidade:** 99.9% uptime
- **Custo:** $160-2000/mês dependendo do provider

**Trade-offs:**
- Complexidade aumentada
- Custo de manutenção
- Necessidade de DevOps expertise

**Recomendação:**
- Iniciar com configuração básica
- Escalar conforme necessidade
- Monitorar métricas constantemente
- Otimizar baseado em dados reais
