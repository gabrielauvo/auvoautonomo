# ============================================
# Makefile - Atalhos para comandos comuns
# ============================================

.PHONY: help dev build up down logs test clean deploy

# Variáveis
DOCKER_COMPOSE = docker-compose
DOCKER_COMPOSE_PROD = docker-compose -f docker-compose.prod.yml

help: ## Mostrar esta ajuda
	@echo "Comandos disponíveis:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

# ============================================
# Desenvolvimento Local (Windows)
# ============================================

dev-local: ## Iniciar desenvolvimento local (Windows PowerShell)
	powershell -ExecutionPolicy Bypass -File scripts/dev.ps1 start

dev-local-stop: ## Parar desenvolvimento local
	powershell -ExecutionPolicy Bypass -File scripts/dev.ps1 stop

dev-local-status: ## Status do desenvolvimento local
	powershell -ExecutionPolicy Bypass -File scripts/dev.ps1 status

dev-local-clean: ## Limpar caches de desenvolvimento
	powershell -ExecutionPolicy Bypass -File scripts/dev.ps1 clean

setup-env: ## Configurar arquivos .env
	powershell -ExecutionPolicy Bypass -File scripts/setup-env.ps1

# ============================================
# Desenvolvimento Docker
# ============================================

dev: ## Iniciar ambiente de desenvolvimento (Docker)
	$(DOCKER_COMPOSE) up -d
	@echo "Ambiente de desenvolvimento iniciado"
	@echo "  - Backend: http://localhost:3001"
	@echo "  - Frontend: http://localhost:3000"
	@echo "  - Postgres: localhost:5432"
	@echo "  - Redis: localhost:6379"

dev-build: ## Build e iniciar desenvolvimento
	$(DOCKER_COMPOSE) up -d --build

dev-down: ## Parar ambiente de desenvolvimento
	$(DOCKER_COMPOSE) down

dev-logs: ## Ver logs de desenvolvimento
	$(DOCKER_COMPOSE) logs -f

# ============================================
# Produção
# ============================================

prod: ## Iniciar ambiente de produção
	$(DOCKER_COMPOSE_PROD) up -d

prod-build: ## Build e iniciar produção
	$(DOCKER_COMPOSE_PROD) up -d --build

prod-down: ## Parar ambiente de produção
	$(DOCKER_COMPOSE_PROD) down

prod-logs: ## Ver logs de produção
	$(DOCKER_COMPOSE_PROD) logs -f

# ============================================
# Build e Deploy
# ============================================

build: ## Build das imagens
	./scripts/deploy.sh build

deploy: ## Deploy completo
	./scripts/deploy.sh deploy

deploy-minor: ## Deploy com versão minor
	./scripts/deploy.sh -t minor deploy

deploy-major: ## Deploy com versão major
	./scripts/deploy.sh -t major deploy

rollback: ## Rollback (usage: make rollback VERSION=1.0.0)
	./scripts/deploy.sh rollback $(VERSION)

# ============================================
# Database
# ============================================

db-migrate: ## Executar migrations
	$(DOCKER_COMPOSE) exec backend pnpm prisma migrate dev

db-migrate-prod: ## Executar migrations em produção
	$(DOCKER_COMPOSE_PROD) exec backend pnpm prisma migrate deploy

db-seed: ## Popular banco com dados iniciais
	$(DOCKER_COMPOSE) exec backend pnpm prisma db seed

db-studio: ## Abrir Prisma Studio
	$(DOCKER_COMPOSE) exec backend pnpm prisma studio

db-backup: ## Criar backup do banco
	./scripts/deploy.sh backup

db-shell: ## Shell do PostgreSQL
	$(DOCKER_COMPOSE) exec postgres psql -U postgres monorepo

# ============================================
# Testes
# ============================================

test: ## Executar todos os testes
	$(DOCKER_COMPOSE) exec backend pnpm test
	$(DOCKER_COMPOSE) exec web pnpm test

test-backend: ## Executar testes do backend
	$(DOCKER_COMPOSE) exec backend pnpm test

test-frontend: ## Executar testes do frontend
	$(DOCKER_COMPOSE) exec web pnpm test

test-coverage: ## Executar testes com coverage
	$(DOCKER_COMPOSE) exec backend pnpm test:coverage
	$(DOCKER_COMPOSE) exec web pnpm test:coverage

test-e2e: ## Executar testes E2E
	$(DOCKER_COMPOSE) exec backend pnpm test:e2e

# ============================================
# Utilitários
# ============================================

logs: ## Ver logs (usage: make logs SERVICE=backend)
	$(DOCKER_COMPOSE) logs -f $(SERVICE)

logs-prod: ## Ver logs de produção
	$(DOCKER_COMPOSE_PROD) logs -f $(SERVICE)

shell-backend: ## Shell no container backend
	$(DOCKER_COMPOSE) exec backend sh

shell-web: ## Shell no container web
	$(DOCKER_COMPOSE) exec web sh

ps: ## Status dos containers
	$(DOCKER_COMPOSE) ps

ps-prod: ## Status dos containers em produção
	$(DOCKER_COMPOSE_PROD) ps

stats: ## Estatísticas de recursos
	docker stats

health: ## Verificar saúde dos serviços
	./scripts/health-check.sh

# ============================================
# Limpeza
# ============================================

clean: ## Limpar containers e volumes (CUIDADO!)
	$(DOCKER_COMPOSE) down -v

clean-images: ## Limpar imagens antigas
	docker image prune -a -f

clean-all: ## Limpar tudo (CUIDADO!)
	docker system prune -a --volumes -f

# ============================================
# Escalar
# ============================================

scale-up: ## Escalar serviços (usage: make scale-up BACKEND=5 WEB=6)
	$(DOCKER_COMPOSE_PROD) up -d --scale backend=$(BACKEND) --scale web=$(WEB)

# ============================================
# Monitoring
# ============================================

monitor: ## Monitorar recursos em tempo real
	watch -n 1 'docker stats --no-stream'
