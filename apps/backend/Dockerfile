# ============================================
# STAGE 1: Builder
# ============================================
FROM node:20-alpine AS builder

# Instalar dependências necessárias para build
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    openssl \
    libc6-compat

WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências com npm (mais compatível)
RUN npm install

# Copiar código fonte
COPY . .

# Gerar Prisma Client
RUN npx prisma generate

# Build da aplicação
RUN npm run build

# ============================================
# STAGE 2: Production
# ============================================
FROM node:20-alpine AS production

RUN apk add --no-cache \
    openssl \
    dumb-init \
    curl

# Criar usuário não-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

WORKDIR /app

# Copiar arquivos necessários
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json
COPY --chown=nestjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh

USER nestjs

EXPOSE 8080

ENV PORT=8080
ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=3s --start-period=90s --retries=5 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

ENTRYPOINT ["dumb-init", "--"]

CMD ["./docker-entrypoint.sh"]
