# ============================================
# STAGE 1: Dependencies
# ============================================
FROM node:20-alpine AS deps

# Metadados
LABEL maintainer="DevOps Team"
LABEL description="Frontend Web - Next.js"

# Instalar libc6-compat para compatibilidade
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./
COPY pnpm-lock.yaml* ./

# Instalar pnpm
RUN npm install -g pnpm@latest

# Instalar dependências
RUN pnpm install --frozen-lockfile

# ============================================
# STAGE 2: Builder
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar node_modules do stage anterior
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Instalar pnpm
RUN npm install -g pnpm@latest

# Variáveis de ambiente necessárias para o build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build da aplicação Next.js com standalone output
RUN pnpm build

# ============================================
# STAGE 3: Production Runner
# ============================================
FROM node:20-alpine AS runner

# Instalar apenas o necessário
RUN apk add --no-cache \
    dumb-init \
    curl

WORKDIR /app

# Criar usuário não-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Variáveis de ambiente de produção
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copiar arquivos necessários do builder
# Next.js standalone mode copia apenas o necessário
COPY --from=builder /app/public ./public

# Copiar standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Mudar para usuário não-root
USER nextjs

# Expor porta
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || curl -f http://localhost:3000/ || exit 1

# Usar dumb-init para lidar com sinais
ENTRYPOINT ["dumb-init", "--"]

# Iniciar aplicação
CMD ["node", "server.js"]
