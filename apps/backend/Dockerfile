# ============================================
# STAGE 1: Builder
# ============================================
FROM node:20-alpine AS builder

# Metadados
LABEL maintainer="DevOps Team"
LABEL description="Backend API - NestJS with Prisma"

# Instalar dependências necessárias para build
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    openssl \
    libc6-compat

# Definir diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./
COPY pnpm-lock.yaml* ./

# Instalar pnpm globalmente
RUN npm install -g pnpm@latest

# Instalar dependências (incluindo devDependencies para build)
RUN pnpm install --frozen-lockfile

# Copiar código fonte
COPY . .

# Gerar Prisma Client
RUN pnpm prisma:generate

# Build da aplicação
RUN pnpm build

# Remover devDependencies para reduzir tamanho
RUN pnpm install --prod --frozen-lockfile

# ============================================
# STAGE 2: Production
# ============================================
FROM node:20-alpine AS production

# Instalar apenas dependências runtime necessárias
RUN apk add --no-cache \
    openssl \
    dumb-init \
    curl

# Criar usuário não-root para segurança
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Definir diretório de trabalho
WORKDIR /app

# Copiar arquivos do builder
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json

# Instalar pnpm no ambiente de produção
RUN npm install -g pnpm@latest

# Mudar para usuário não-root
USER nestjs

# Expor porta da aplicação (Azure usa 8080 por padrão)
EXPOSE 8080

# Variável de ambiente para porta
ENV PORT=8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Usar dumb-init para lidar com sinais corretamente
ENTRYPOINT ["dumb-init", "--"]

# Comando para iniciar a aplicação
CMD ["node", "dist/main"]
