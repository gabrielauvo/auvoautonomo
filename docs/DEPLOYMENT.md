# Guia de Deploy

Este documento descreve a estratégia de deploy para produção.

## Visão Geral

```
┌─────────────────────────────────────────────────────────────────┐
│                        PIPELINE DE DEPLOY                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Push/PR]  →  [CI Tests]  →  [Build Images]  →  [Deploy]       │
│      │             │               │               │             │
│      ▼             ▼               ▼               ▼             │
│   GitHub      Backend/Web      Docker GHCR    Production        │
│   Actions     Mobile Tests    (tagged images)   Server          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Ambientes

| Ambiente    | Branch/Tag       | URL                        | Trigger         |
|-------------|------------------|----------------------------|-----------------|
| Development | Local            | localhost                  | Manual          |
| Preview     | develop          | preview.yourdomain.com     | Push to develop |
| Staging     | main             | staging.yourdomain.com     | Push to main    |
| Production  | v*.*.* (tags)    | yourdomain.com             | Release tag     |

## CI/CD Workflows

### 1. CI (Pull Requests)

**Arquivo:** `.github/workflows/ci.yml`

Executa em cada PR:
- Detecta quais apps mudaram
- Roda lint e type check
- Executa testes unitários
- Executa testes E2E (backend)
- Upload de coverage

### 2. Deploy Production

**Arquivo:** `.github/workflows/deploy-production.yml`

Trigger: Tag `v*.*.*`

1. Roda todos os testes
2. Build das imagens Docker
3. Push para GitHub Container Registry (GHCR)
4. SSH no servidor de produção
5. Pull das novas imagens
6. Zero-downtime deploy
7. Health check
8. Rollback automático se falhar

### 3. Mobile CI/CD

**Arquivo:** `.github/workflows/mobile.yml`

- **Push to develop/main:** Build de preview (APK)
- **Release tag:** Build de produção (AAB) + submit às lojas

## Secrets Necessários

Configure em: GitHub → Settings → Secrets and variables → Actions

### Deploy Server

```
PRODUCTION_HOST       # IP ou hostname do servidor
PRODUCTION_USER       # Usuário SSH
PRODUCTION_SSH_KEY    # Chave privada SSH
PRODUCTION_SSH_PORT   # Porta SSH (default: 22)
```

### Docker Registry

```
# GHCR usa GITHUB_TOKEN automaticamente
# Para outros registries:
DOCKER_REGISTRY_URL
DOCKER_REGISTRY_USER
DOCKER_REGISTRY_PASSWORD
```

### Mobile (Expo/EAS)

```
EXPO_TOKEN            # Token do Expo
APPLE_ID              # Apple ID para iOS
ASC_APP_ID            # App Store Connect App ID
APPLE_TEAM_ID         # Apple Team ID
GOOGLE_PLAY_SERVICE_ACCOUNT_KEY  # JSON da service account
```

### Notificações (opcional)

```
SLACK_WEBHOOK         # Webhook do Slack para notificações
```

## Deploy Manual

### Via Script

```bash
# Build e deploy
./scripts/deploy.sh deploy

# Com versão específica
./scripts/deploy.sh -t minor deploy

# Rollback
./scripts/deploy.sh rollback 1.0.0
```

### Via Make

```bash
make deploy           # Deploy padrão
make deploy-minor     # Incrementa versão minor
make deploy-major     # Incrementa versão major
make rollback VERSION=1.0.0
```

### Via Docker Compose

```bash
# Produção
docker-compose -f docker-compose.prod.yml up -d --build

# Ver logs
docker-compose -f docker-compose.prod.yml logs -f

# Parar
docker-compose -f docker-compose.prod.yml down
```

## Configuração do Servidor

### Requisitos

- Ubuntu 22.04+ ou similar
- Docker e Docker Compose
- Git
- 4GB RAM mínimo
- 20GB disco mínimo

### Setup Inicial

```bash
# Instalar Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Instalar Docker Compose
sudo apt install docker-compose-plugin

# Clonar repositório
cd /opt
git clone <repo-url> monorepo
cd monorepo

# Configurar variáveis de ambiente
cp .env.example .env.production
# Editar .env.production com valores reais

# Iniciar
docker-compose -f docker-compose.prod.yml up -d
```

### Nginx Reverse Proxy

```nginx
# /etc/nginx/sites-available/monorepo

upstream backend {
    server 127.0.0.1:3001;
    keepalive 64;
}

upstream web {
    server 127.0.0.1:3000;
    keepalive 64;
}

# API
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Web
server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://web;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Backup e Restore

### Backup do Banco

```bash
# Via Make
make db-backup

# Manual
docker-compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U postgres monorepo_prod > backup-$(date +%Y%m%d).sql
```

### Restore do Banco

```bash
docker-compose -f docker-compose.prod.yml exec -T postgres \
  psql -U postgres monorepo_prod < backup-20240101.sql
```

## Monitoramento

### Health Checks

```bash
# Via script
./scripts/health-check.sh

# Endpoints
curl http://localhost:3001/health  # Backend
curl http://localhost:3000/        # Web
```

### Logs

```bash
# Todos os serviços
docker-compose -f docker-compose.prod.yml logs -f

# Serviço específico
docker-compose -f docker-compose.prod.yml logs -f backend

# Últimas 100 linhas
docker-compose -f docker-compose.prod.yml logs --tail=100 backend
```

### Recursos

```bash
# Uso de recursos
docker stats

# Disco
df -h

# Memória
free -h
```

## Rollback

### Automático

O workflow de deploy faz rollback automático se o health check falhar.

### Manual

```bash
# Via script
./scripts/deploy.sh rollback 1.0.0

# Via Docker
docker-compose -f docker-compose.prod.yml down
git checkout v1.0.0
docker-compose -f docker-compose.prod.yml up -d
```

## Checklist de Deploy

- [ ] Todos os testes passando
- [ ] Variáveis de ambiente configuradas
- [ ] Migrations aplicadas
- [ ] Backup do banco feito
- [ ] Changelog atualizado
- [ ] Tag criada (semver)
- [ ] Health checks configurados
- [ ] Monitoramento ativo
- [ ] Rollback testado
