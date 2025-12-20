# Setup e Desenvolvimento

Guia completo para configurar o ambiente de desenvolvimento do Auvo Field.

## Indice

1. [Requisitos](#requisitos)
2. [Instalacao](#instalacao)
3. [Configuracao de Ambiente](#configuracao-de-ambiente)
4. [Rodando os Projetos](#rodando-os-projetos)
5. [Banco de Dados](#banco-de-dados)
6. [Testes](#testes)
7. [Fluxo de Desenvolvimento](#fluxo-de-desenvolvimento)

---

## Requisitos

### Sistema Operacional

- Windows 10/11, macOS, ou Linux

### Software Obrigatorio

| Software | Versao Minima | Verificar |
|----------|---------------|-----------|
| Node.js | 18.x | `node --version` |
| pnpm | 8.x | `pnpm --version` |
| Git | 2.x | `git --version` |
| Docker | 20.x | `docker --version` |
| Docker Compose | 2.x | `docker compose version` |

### Para Mobile

| Software | Versao | Notas |
|----------|--------|-------|
| Expo CLI | 52.x | Via npx ou global |
| Android Studio | Latest | Para emulador Android |
| Xcode | 15.x | macOS apenas, para iOS |

### Extensoes VS Code (Recomendado)

- ESLint
- Prettier
- Prisma
- Tailwind CSS IntelliSense
- React Native Tools

---

## Instalacao

### 1. Clone o Repositorio

```bash
git clone https://github.com/auvo/auvo-field.git
cd auvo-field
```

### 2. Instale as Dependencias

```bash
# Instala todas as dependencias do monorepo
pnpm install
```

### 3. Suba os Servicos Docker

```bash
# PostgreSQL + Redis
docker compose up -d
```

Verifique se estao rodando:

```bash
docker compose ps

# Deve mostrar:
# postgres    running    0.0.0.0:5432->5432/tcp
# redis       running    0.0.0.0:6379->6379/tcp
```

### 4. Configure o Backend

```bash
cd apps/backend

# Copie o arquivo de exemplo
cp .env.example .env

# Execute as migrations do Prisma
npx prisma migrate dev

# Execute o seed (dados iniciais)
npx prisma db seed
```

### 5. Configure o Web

```bash
cd apps/web

# Copie o arquivo de exemplo (se existir)
cp .env.example .env.local
```

### 6. Configure o Mobile

```bash
cd apps/mobile

# Copie o arquivo de exemplo
cp .env.example .env
```

---

## Configuracao de Ambiente

### Backend (.env)

```bash
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/myapp?schema=public"

# Server
PORT=3001
NODE_ENV=development

# Auth
JWT_SECRET=seu-segredo-jwt-aqui
JWT_EXPIRES_IN=24h

# Encryption
ENCRYPTION_KEY=sua-chave-de-32-caracteres-aqui

# Google OAuth (opcional)
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback

# Asaas (opcional, para pagamentos)
ASAAS_API_KEY=xxx
ASAAS_SANDBOX=true

# Storage
STORAGE_PATH=./storage

# Frontend URL (para CORS)
FRONTEND_URL=http://localhost:3000
```

### Web (.env.local)

```bash
# API
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Mobile (.env)

```bash
# Environment
EXPO_PUBLIC_ENV=development

# API
EXPO_PUBLIC_API_URL=http://192.168.1.100:3001

# Expo (para builds EAS)
EXPO_TOKEN=xxx
EAS_PROJECT_ID=xxx
```

**Importante para Mobile**: Use o IP da sua maquina, nao `localhost`, pois o emulador/dispositivo precisa acessar a rede.

Para descobrir seu IP:
- Windows: `ipconfig`
- macOS/Linux: `ifconfig` ou `ip addr`

---

## Rodando os Projetos

### Opcao 1: Todos em Paralelo

```bash
# Na raiz do projeto
pnpm dev
```

Isso inicia:
- Backend em http://localhost:3001
- Web em http://localhost:3000

### Opcao 2: Individualmente

**Backend:**

```bash
cd apps/backend
pnpm dev
```

**Web:**

```bash
cd apps/web
pnpm dev
```

**Mobile:**

```bash
cd apps/mobile
npx expo start
```

Opcoes do Expo:
- `a` - Abrir no Android
- `i` - Abrir no iOS (macOS)
- `w` - Abrir no navegador
- `r` - Recarregar

### URLs de Acesso

| Servico | URL |
|---------|-----|
| Backend API | http://localhost:3001 |
| Swagger Docs | http://localhost:3001/api |
| Web Dashboard | http://localhost:3000 |
| Expo DevTools | exp://localhost:8081 |
| Prisma Studio | http://localhost:5555 |

---

## Banco de Dados

### Comandos Prisma Uteis

```bash
cd apps/backend

# Ver schema no navegador
npx prisma studio

# Criar nova migration
npx prisma migrate dev --name nome_da_migration

# Aplicar migrations em producao
npx prisma migrate deploy

# Resetar banco (CUIDADO: apaga dados!)
npx prisma migrate reset

# Gerar cliente Prisma
npx prisma generate

# Formatar schema
npx prisma format
```

### Resetar Banco Completamente

```bash
# Para os containers
docker compose down

# Remove volumes (dados)
docker compose down -v

# Sobe novamente
docker compose up -d

# Recria migrations
cd apps/backend
npx prisma migrate dev
npx prisma db seed
```

### Acessar PostgreSQL Diretamente

```bash
# Via Docker
docker exec -it auvo-postgres psql -U postgres -d myapp

# Ou via cliente local
psql -h localhost -U postgres -d myapp
```

---

## Testes

### Rodar Todos os Testes

```bash
# Na raiz
pnpm test
```

### Por Projeto

**Backend:**

```bash
cd apps/backend
pnpm test              # Unit tests
pnpm test:e2e          # E2E tests
pnpm test:cov          # Com coverage
```

**Web:**

```bash
cd apps/web
pnpm test
pnpm test:watch        # Watch mode
pnpm test:coverage
```

**Mobile:**

```bash
cd apps/mobile
pnpm test
```

### Estrutura de Testes

```
apps/
├── backend/
│   ├── src/
│   │   └── **/*.spec.ts    # Unit tests junto ao codigo
│   └── test/
│       └── **/*.e2e-spec.ts # E2E tests
├── web/
│   └── __tests__/          # Testes React
└── mobile/
    └── __tests__/          # Testes React Native
```

---

## Fluxo de Desenvolvimento

### Criando uma Feature

1. **Crie uma branch**

```bash
git checkout -b feature/nome-da-feature
```

2. **Desenvolva no Backend** (se necessario)

```bash
cd apps/backend

# Se precisar de nova tabela
npx prisma migrate dev --name add_nova_tabela

# Implemente service, controller, etc
```

3. **Desenvolva no Web/Mobile**

```bash
# Web
cd apps/web
# Crie components, pages, hooks...

# Mobile
cd apps/mobile
# Crie screens, modules, etc...
```

4. **Teste localmente**

```bash
# Testes automatizados
pnpm test

# Testes manuais
pnpm dev
```

5. **Commit e Push**

```bash
git add .
git commit -m "feat: descricao da feature"
git push origin feature/nome-da-feature
```

### Convenções de Commit

Usamos [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` Nova feature
- `fix:` Correcao de bug
- `docs:` Documentacao
- `refactor:` Refatoracao
- `test:` Testes
- `chore:` Tarefas de manutencao

### Sincronizando com Main

```bash
git checkout main
git pull origin main
git checkout feature/nome-da-feature
git rebase main
```

---

## Troubleshooting

### Erro: "Cannot connect to database"

1. Verifique se Docker esta rodando: `docker compose ps`
2. Verifique a DATABASE_URL no .env
3. Tente reiniciar: `docker compose restart postgres`

### Erro: "Network request failed" no Mobile

1. Verifique se o backend esta rodando
2. Use o IP da maquina, nao localhost
3. Verifique firewall/antivirus
4. Teste: `curl http://SEU_IP:3001/health`

### Erro: "Module not found"

1. Delete node_modules: `rm -rf node_modules`
2. Delete lockfile: `rm pnpm-lock.yaml`
3. Reinstale: `pnpm install`

### Prisma Client desatualizado

```bash
cd apps/backend
npx prisma generate
```

### Expo Cache

```bash
cd apps/mobile
npx expo start --clear
```

### Reset completo do Mobile

```bash
cd apps/mobile
rm -rf node_modules
rm -rf .expo
pnpm install
npx expo start --clear
```

---

## Scripts Uteis

### Package.json Raiz

```bash
pnpm dev              # Roda tudo em paralelo
pnpm build            # Build de todos os pacotes
pnpm test             # Testes de todos os pacotes
pnpm lint             # Lint de todos os pacotes
pnpm format           # Formata todo o codigo
```

### Backend

```bash
pnpm dev              # Development mode
pnpm build            # Build para producao
pnpm start            # Roda build
pnpm test             # Testes
pnpm lint             # ESLint
```

### Web

```bash
pnpm dev              # Development mode
pnpm build            # Build Next.js
pnpm start            # Roda build
pnpm test             # Testes Jest
```

### Mobile

```bash
npx expo start        # Inicia Expo
npx expo start --clear # Com cache limpo
eas build --platform android --profile preview
eas build --platform ios --profile preview
```

---

*Ultima atualizacao: 2025-12-17*
