# Monorepo - Backend, Web e Mobile

Monorepo completo com Backend (NestJS), Web (Next.js) e Mobile (Expo), utilizando pnpm workspaces.

## Stack Tecnológica

### Backend
- **Framework**: NestJS
- **Database**: PostgreSQL (via Docker Compose)
- **ORM**: Prisma
- **Authentication**: JWT + Passport
- **Testing**: Jest + Supertest

### Web
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS + ShadCN UI
- **Testing**: Jest + Testing Library

### Mobile
- **Framework**: Expo + React Native
- **Router**: Expo Router
- **Testing**: Jest + Testing Library React Native

### Shared Packages
- **@monorepo/shared-types**: Tipos TypeScript compartilhados
- **@monorepo/shared-utils**: Utilitários compartilhados

## Estrutura do Projeto

```
.
├── apps/
│   ├── backend/          # API NestJS
│   │   ├── Dockerfile    # Docker para produção
│   │   └── .dockerignore # Arquivos ignorados
│   ├── web/              # Aplicação Next.js
│   │   ├── Dockerfile    # Docker para produção
│   │   └── .dockerignore # Arquivos ignorados
│   └── mobile/           # Aplicação Expo
├── packages/
│   ├── shared-types/     # Tipos compartilhados
│   └── shared-utils/     # Utilitários compartilhados
├── scripts/
│   ├── deploy.sh         # Script de deploy automatizado
│   └── health-check.sh   # Verificação de saúde
├── nginx/
│   └── nginx.conf        # Configuração do load balancer
├── docs/                 # Documentação
├── docker-compose.yml    # Ambiente de desenvolvimento
├── docker-compose.prod.yml # Ambiente de produção
├── Makefile              # Atalhos para comandos
├── DEPLOY.md             # Guia de deploy
├── INFRASTRUCTURE.md     # Documentação de infraestrutura
└── pnpm-workspace.yaml   # Configuração do workspace
```

## Pré-requisitos

- Node.js >= 20
- pnpm >= 8
- Docker e Docker Compose >= 2.0

## Quick Start

### Desenvolvimento Local

```bash
# 1. Instalar dependências
pnpm install

# 2. Iniciar infraestrutura (PostgreSQL + Redis)
docker-compose up -d

# 3. Configurar e rodar backend
cd apps/backend
cp .env.example .env
pnpm prisma:generate
pnpm prisma:migrate
pnpm dev

# 4. Rodar frontend (nova aba)
cd apps/web
pnpm dev
```

### Usando Makefile (Recomendado)

```bash
# Iniciar tudo
make dev

# Ver logs
make logs

# Parar tudo
make dev-down
```

## Deploy em Produção

Para deploy completo com suporte a 1M+ usuários, consulte a documentação:

- **[DEPLOY.md](./DEPLOY.md)** - Guia completo de deploy
- **[INFRASTRUCTURE.md](./INFRASTRUCTURE.md)** - Arquitetura e otimizações

### Deploy Rápido

```bash
# 1. Configurar ambiente
cp .env.example .env.production
# Editar .env.production com valores reais

# 2. Deploy automatizado
chmod +x scripts/deploy.sh
./scripts/deploy.sh deploy

# 3. Ou usando Makefile
make deploy
```

## Infraestrutura e Containers

### Ambiente de Desenvolvimento

```bash
# Iniciar PostgreSQL + Redis
docker-compose up -d

# Ver status
docker-compose ps

# Ver logs
docker-compose logs -f

# Parar
docker-compose down
```

### Ambiente de Produção

A infraestrutura de produção inclui:

- **Backend:** 3 réplicas (NestJS)
- **Frontend:** 4 réplicas (Next.js standalone)
- **PostgreSQL:** Otimizado para alta carga
- **Redis:** Cache e sessões
- **Nginx:** Load balancer (opcional)

```bash
# Build e deploy
docker-compose -f docker-compose.prod.yml up -d --build

# Escalar serviços
docker-compose -f docker-compose.prod.yml up -d \
  --scale backend=5 \
  --scale web=8

# Monitorar recursos
docker stats
```

### Características dos Dockerfiles

**Backend:**
- Multi-stage build (builder + production)
- Node 20 Alpine (imagem mínima)
- Non-root user (segurança)
- Health check integrado
- Tamanho final: ~150MB

**Frontend:**
- Next.js standalone output (80% menor)
- Multi-stage build
- Read-only filesystem
- Tamanho final: ~120MB

## Testes

### Rodar todos os testes
```bash
pnpm test
```

### Rodar testes em watch mode
```bash
pnpm test:watch
```

### Gerar coverage
```bash
pnpm test:coverage
```

### Testes específicos por app
```bash
# Backend
cd apps/backend && pnpm test

# Web
cd apps/web && pnpm test

# Mobile
cd apps/mobile && pnpm test

# Shared Utils
cd packages/shared-utils && pnpm test
```

## Lint e Formatação

```bash
# Lint
pnpm lint

# Format
pnpm format
```

## Build

```bash
# Build todos os projetos
pnpm build

# Build específico
cd apps/backend && pnpm build
cd apps/web && pnpm build
cd apps/mobile && pnpm build
```

## Scripts Úteis

### Backend
- `pnpm prisma:studio` - Abre Prisma Studio
- `pnpm prisma:generate` - Gera Prisma Client
- `pnpm prisma:migrate` - Roda migrations
- `pnpm prisma:seed` - Popula banco com dados iniciais (planos)

## Docker

### Comandos úteis

```bash
# Iniciar banco
docker-compose up -d

# Ver logs
docker-compose logs -f

# Parar banco
docker-compose down

# Parar e remover volumes
docker-compose down -v
```

## Variáveis de Ambiente

### Backend (.env)
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/myapp?schema=public"
NODE_ENV=development
PORT=3001
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d
```

## Funcionalidades Implementadas

### Backend (Dia 1 e 2)
- ✅ **Auth Module**: Registro, login e autenticação JWT
- ✅ **Plans Module**: Sistema de planos (Free, Pro, Team) com limites
- ✅ **Usage Limits**: Guard automático para verificar limites antes de criar recursos
- ✅ **Prisma Models**: 10 entidades completas (User, Plan, Client, Item, Equipment, Quote, QuoteItem, WorkOrder, Invoice, SyncLog)
- ✅ **Testes Unitários**: Auth e Plans modules testados
- ✅ **Documentação**: architecture.md, plans-and-limits.md, usage-example.md

### Endpoints Disponíveis
```
POST /auth/register - Registro de usuário
POST /auth/login - Login e geração de token
GET /auth/me - Dados do usuário autenticado

GET /plans - Listar todos os planos
GET /plans/my-plan - Plano atual do usuário
GET /plans/usage - Uso atual vs limites
```

## Próximos Passos (Dia 3+)

- [ ] Implementar módulo Clients (CRUD + Equipment)
- [ ] Implementar módulo Quotes (CRUD + Items + PDF)
- [ ] Implementar módulo WorkOrders (CRUD + Status)
- [ ] Implementar módulo Invoices (CRUD + Payment tracking)
- [ ] Implementar módulo Items (Catálogo de serviços/produtos)
- [ ] Adicionar geração de PDF (orçamentos e faturas)
- [ ] Implementar sincronização offline (mobile)
- [ ] Adicionar Swagger/OpenAPI documentation
- [ ] Adicionar CI/CD
- [ ] Configurar deploy

## Contribuindo

1. Clone o repositório
2. Crie uma branch para sua feature
3. Faça commit das suas alterações
4. Abra um Pull Request

## Licença

MIT
