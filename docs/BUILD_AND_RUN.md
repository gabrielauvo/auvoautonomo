# Build e Execução

## Pré-requisitos

### Obrigatórios
- Node.js 18+ (LTS)
- pnpm 8+
- PostgreSQL 14+ (ou Docker)
- Redis 7+ (ou Docker)

### Para Mobile
- Expo CLI (`npm install -g expo-cli`)
- iOS: Xcode 14+ (apenas macOS)
- Android: Android Studio + SDK

---

## Setup Inicial

### 1. Clonar e Instalar

```bash
# Clone o repositório
git clone <repo-url>
cd auvo-field-service

# Instalar dependências (pnpm workspaces)
pnpm install
```

### 2. Configurar Variáveis de Ambiente

```bash
# Backend
cp apps/backend/.env.example apps/backend/.env

# Mobile
cp apps/mobile/.env.example apps/mobile/.env

# Web
cp apps/web/.env.example apps/web/.env
```

### 3. Subir Infraestrutura (Docker)

```bash
# PostgreSQL + Redis
docker-compose up -d

# Verificar se está rodando
docker-compose ps
```

### 4. Configurar Banco de Dados

```bash
cd apps/backend

# Gerar cliente Prisma
pnpm prisma generate

# Executar migrations
pnpm prisma migrate dev

# (Opcional) Seed inicial
pnpm prisma db seed
```

---

## Executar em Desenvolvimento

### Backend (porta 3001)

```bash
cd apps/backend

# Modo desenvolvimento (hot reload)
pnpm dev

# Ou modo watch
pnpm start:dev
```

**Verificar:**
- API: http://localhost:3001
- Swagger: http://localhost:3001/api/docs
- Health: http://localhost:3001/health

### Web (porta 3000)

```bash
cd apps/web

# Modo desenvolvimento
pnpm dev
```

**Verificar:** http://localhost:3000

### Mobile (Expo)

```bash
cd apps/mobile

# Iniciar Metro bundler
pnpm start

# Ou com opções específicas
pnpm start --clear   # Limpa cache
pnpm start --ios     # Abre simulador iOS
pnpm start --android # Abre emulador Android
```

**Verificar:**
- Pressione `i` para iOS
- Pressione `a` para Android
- Escaneie QR code com Expo Go no dispositivo

---

## Build de Produção

### Backend

```bash
cd apps/backend

# Build
pnpm build

# Executar produção
pnpm start:prod
```

### Web

```bash
cd apps/web

# Build estático
pnpm build

# Preview local
pnpm start
```

### Mobile (EAS Build)

```bash
cd apps/mobile

# Login no Expo
eas login

# Build Android (APK/AAB)
eas build --platform android --profile production

# Build iOS (IPA)
eas build --platform ios --profile production

# Build ambas plataformas
eas build --platform all --profile production
```

---

## Docker em Produção

### Build das Imagens

```bash
# Backend
docker build -t auvo-backend:latest -f apps/backend/Dockerfile .

# Web
docker build -t auvo-web:latest -f apps/web/Dockerfile .
```

### Docker Compose Produção

```bash
# Subir tudo
docker-compose -f docker-compose.prod.yml up -d

# Verificar logs
docker-compose -f docker-compose.prod.yml logs -f

# Parar
docker-compose -f docker-compose.prod.yml down
```

---

## Comandos Úteis

### Workspace (raiz)

```bash
# Instalar dependências
pnpm install

# Rodar testes em todos os pacotes
pnpm test

# Lint em todos os pacotes
pnpm lint

# Build de todos os pacotes
pnpm build
```

### Backend

```bash
cd apps/backend

# Prisma Studio (visualizar DB)
pnpm prisma studio

# Nova migration
pnpm prisma migrate dev --name nome_da_migration

# Reset do banco (cuidado!)
pnpm prisma migrate reset

# Testes
pnpm test
pnpm test:e2e
pnpm test:cov
```

### Mobile

```bash
cd apps/mobile

# Limpar cache do Metro
pnpm start --clear

# Limpar cache completo (iOS/Android)
npx expo start -c

# Atualizar Expo SDK
npx expo upgrade

# Verificar dependências
npx expo-doctor
```

### Web

```bash
cd apps/web

# Testes
pnpm test
pnpm test:e2e

# Análise de bundle
pnpm analyze
```

---

## Pontos Comuns de Falha

### 1. Prisma Client não gerado

**Sintoma:** `Cannot find module '.prisma/client'`

**Solução:**
```bash
cd apps/backend
pnpm prisma generate
```

### 2. Metro bundler com cache corrompido

**Sintoma:** Erros estranhos no mobile, "module not found"

**Solução:**
```bash
cd apps/mobile
npx expo start -c
# Ou mais agressivo:
rm -rf node_modules/.cache
pnpm start --clear
```

### 3. PostgreSQL não conecta

**Sintoma:** `ECONNREFUSED 127.0.0.1:5432`

**Verificar:**
```bash
# Se usando Docker
docker-compose ps
docker-compose logs postgres

# Se local, verificar se está rodando
pg_isready -h localhost -p 5432
```

### 4. Redis não conecta

**Sintoma:** `Error: connect ECONNREFUSED 127.0.0.1:6379`

**Verificar:**
```bash
docker-compose logs redis
redis-cli ping
```

### 5. Expo build falha

**Sintomas variados**

**Soluções:**
```bash
# Verificar dependências
npx expo-doctor

# Limpar caches do EAS
eas build:list --status=errored

# Reinstalar node_modules
rm -rf node_modules
pnpm install
```

### 6. Conflitos de porta

**Sintoma:** `EADDRINUSE`

**Verificar e matar processo:**
```bash
# Linux/Mac
lsof -i :3000
kill -9 <PID>

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

---

## Configurações de IDE

### VSCode Recomendado

Extensões:
- Prisma
- ESLint
- Prettier
- Tailwind CSS IntelliSense
- ES7+ React/Redux/React-Native snippets

Settings (`.vscode/settings.json`):
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.preferences.importModuleSpecifier": "relative"
}
```

---

## Troubleshooting Avançado

### Logs do Backend

```bash
# Ver logs com debug
DEBUG=* pnpm start:dev

# Logs específicos do Prisma
DEBUG=prisma:* pnpm start:dev
```

### Inspecionar Banco SQLite (Mobile)

```bash
# Conectar no dispositivo/emulador
adb shell
cd /data/data/com.auvo.mobile/databases
sqlite3 auvo.db

# Ou usar Flipper para visualização
```

### Verificar Sync Engine (Mobile)

Ativar logs detalhados no código:
```typescript
// SyncEngine.ts já tem logs extensivos
// Verificar console do Metro/React Native Debugger
```
