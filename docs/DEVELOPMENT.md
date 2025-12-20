# Guia de Desenvolvimento

Este documento descreve como configurar e executar o ambiente de desenvolvimento do monorepo.

## Pré-requisitos

- **Node.js** v20+
- **pnpm** v8+
- **Docker** e **Docker Compose**
- **PowerShell** (Windows) ou **Bash** (Linux/Mac)

## Estrutura do Projeto

```
monorepo/
├── apps/
│   ├── backend/      # NestJS API (porta 3001)
│   ├── web/          # Next.js Frontend (porta 3000)
│   ├── mobile/       # React Native/Expo (porta 19000)
│   └── pdf-service/  # Microserviço PDF (porta 3002)
├── packages/
│   ├── shared-types/ # Tipos TypeScript compartilhados
│   └── shared-utils/ # Utilitários compartilhados
├── scripts/          # Scripts de automação
└── docs/             # Documentação
```

## Início Rápido

### 1. Clonar e Instalar

```bash
git clone <repo-url>
cd monorepo
pnpm install
```

### 2. Configurar Ambiente

```powershell
# Windows PowerShell
.\scripts\setup-env.ps1
```

Este script configura automaticamente:
- `apps/backend/.env`
- `apps/web/.env.local`
- `apps/mobile/.env` (com IP local detectado)

### 3. Iniciar Desenvolvimento

```powershell
# Iniciar TUDO (infraestrutura + backend + web + mobile)
.\scripts\dev.ps1 start

# Ou iniciar individualmente
.\scripts\dev.ps1 infra    # Apenas PostgreSQL + Redis
.\scripts\dev.ps1 backend  # Apenas Backend
.\scripts\dev.ps1 web      # Apenas Web
.\scripts\dev.ps1 mobile   # Apenas Mobile/Expo
```

### 4. Verificar Status

```powershell
.\scripts\dev.ps1 status
```

### 5. Parar Serviços

```powershell
.\scripts\dev.ps1 stop
```

## Mapa de Portas

| Serviço        | Porta | URL                      |
|----------------|-------|--------------------------|
| Backend API    | 3001  | http://localhost:3001    |
| Web Frontend   | 3000  | http://localhost:3000    |
| Expo DevTools  | 19000 | exp://localhost:19000    |
| Metro Bundler  | 8081  | http://localhost:8081    |
| PostgreSQL     | 5432  | localhost:5432           |
| Redis          | 6379  | localhost:6379           |
| PDF Service    | 3002  | http://localhost:3002    |

## VS Code Tasks

Use `Ctrl+Shift+P` > "Tasks: Run Task" para acessar:

- **Dev: Start All** - Inicia todo o ambiente
- **Dev: Stop All** - Para todos os serviços
- **Dev: Status** - Mostra status dos serviços
- **Dev: Clean All Caches** - Limpa caches
- **Backend: Start** - Inicia apenas o backend
- **Web: Start** - Inicia apenas o web
- **Mobile: Start (Expo)** - Inicia apenas o Expo
- **Backend: Prisma Studio** - Abre o Prisma Studio
- **Health Check** - Verifica saúde dos serviços

## Comandos Make (Linux/Mac)

```bash
make dev-local        # Iniciar desenvolvimento local
make dev-local-stop   # Parar desenvolvimento local
make dev-local-status # Ver status
make dev-local-clean  # Limpar caches
make setup-env        # Configurar .env
```

## Desenvolvimento Mobile

### Dispositivo Físico

1. O script `setup-env.ps1` detecta seu IP local automaticamente
2. Certifique-se de que o dispositivo está na mesma rede Wi-Fi
3. Inicie o backend e execute o Expo
4. Escaneie o QR code com o app Expo Go

### Emulador Android

Altere `apps/mobile/.env`:
```env
EXPO_PUBLIC_API_URL=http://10.0.2.2:3001
```

### Simulador iOS

Altere `apps/mobile/.env`:
```env
EXPO_PUBLIC_API_URL=http://localhost:3001
```

## Resolução de Problemas

### Porta em uso (EADDRINUSE)

```powershell
# Ver processos em todas as portas
.\scripts\dev.ps1 status

# Parar tudo e limpar
.\scripts\dev.ps1 clean
```

### Cache do Metro corrompido

```powershell
# Limpar todos os caches
.\scripts\dev.ps1 clean

# Ou manualmente
Remove-Item -Recurse -Force apps/mobile/.expo
Remove-Item -Recurse -Force $env:TEMP\metro-*
```

### Backend não conecta ao banco

1. Verifique se Docker está rodando:
```powershell
docker ps
```

2. Inicie a infraestrutura:
```powershell
.\scripts\dev.ps1 infra
```

3. Aguarde o PostgreSQL ficar healthy:
```powershell
docker logs monorepo-postgres
```

### Erro de Prisma Client

```powershell
cd apps/backend
pnpm prisma generate
pnpm prisma migrate dev
```

## Variáveis de Ambiente

### Backend (.env)

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/auvo
NODE_ENV=development
PORT=3001
JWT_SECRET=seu-jwt-secret
JWT_EXPIRES_IN=7d
ENCRYPTION_KEY=sua-chave-64-chars
FRONTEND_URL=http://localhost:3000
```

### Web (.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Mobile (.env)

```env
EXPO_PUBLIC_ENV=development
EXPO_PUBLIC_API_URL=http://<SEU_IP>:3001
```

## Testes

```bash
# Backend
cd apps/backend
pnpm test           # Unit tests
pnpm test:watch     # Watch mode
pnpm test:coverage  # Com coverage
pnpm test:e2e       # E2E tests

# Web
cd apps/web
pnpm test

# Mobile
cd apps/mobile
pnpm test
```

## Database

```bash
# Rodar migrations
cd apps/backend
pnpm prisma migrate dev

# Abrir Prisma Studio (GUI)
pnpm prisma studio

# Gerar client após mudanças no schema
pnpm prisma generate

# Seed de dados
pnpm prisma db seed
```
