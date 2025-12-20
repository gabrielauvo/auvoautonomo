# Auvo Field - Documentacao Tecnica

Sistema de gestao de servicos de campo (Field Service Management) para tecnicos autonomos e pequenas empresas.

## Indice

### Documentacao Geral
- [Visao Geral do Sistema](#visao-geral)
- [Arquitetura Geral](./architecture.md)
- [Arquitetura Offline-First](./offline-sync.md)
- [Setup e Desenvolvimento](./setup.md)

### Documentacao por Modulo
- [Backend](./backend-modules.md)
- [Planos e Limites](./plans-and-limits.md)
- [Integracao Asaas](./asaas-integration.md)
- [Design System](./design-system.md)
- [Reports](./reports-module.md)
- [Settings](./settings-module.md)

### Auditorias e Relatorios
- [Auditorias Anteriores](./audits/)
- [Relatorio Final Dia 9](./DIA-9-RELATORIO-FINAL.md)
- [Sumario Tecnico](./summary.md)

---

## Visao Geral

### O que e o Auvo Field?

Auvo Field e uma plataforma completa para gestao de servicos de campo que permite:

- **Gestao de Clientes**: Cadastro, importacao em massa, historico completo
- **Orcamentos**: Criacao, envio, aprovacao com assinatura digital
- **Ordens de Servico**: Agendamento, execucao, checklists, fotos, GPS
- **Faturamento**: Cobrancas automaticas, integracao Asaas (PIX, Boleto, Cartao)
- **Relatorios**: Analytics financeiro e operacional
- **Mobile Offline-First**: App que funciona 100% offline com sincronizacao automatica

### Publico-Alvo

- Tecnicos autonomos (eletricistas, encanadores, etc.)
- Pequenas empresas de servicos de campo
- Prestadores de manutencao

### Arquitetura de Alto Nivel

```
+--------------------+     +--------------------+     +--------------------+
|                    |     |                    |     |                    |
|   Mobile App       |     |   Web Dashboard    |     |   PDF Service      |
|   (Expo/RN)        |     |   (Next.js)        |     |   (NestJS)         |
|                    |     |                    |     |                    |
+--------+-----------+     +--------+-----------+     +--------+-----------+
         |                          |                          |
         |   SQLite                 |                          |
         |   (offline)              |                          |
         |                          |                          |
         +------------+-------------+-------------+------------+
                      |                           |
                      v                           v
              +-------+-------+           +-------+-------+
              |               |           |               |
              |  Backend API  |           |    Redis      |
              |  (NestJS)     +---------->+   (BullMQ)    |
              |               |           |               |
              +-------+-------+           +---------------+
                      |
                      v
              +-------+-------+
              |               |
              |  PostgreSQL   |
              |  (Prisma)     |
              |               |
              +---------------+
```

### Principais Decisoes Arquiteturais

| Decisao | Justificativa |
|---------|---------------|
| **Monorepo (pnpm workspaces)** | Compartilhamento de tipos, consistencia de versoes |
| **NestJS no Backend** | Arquitetura modular, DI nativo, TypeScript first |
| **Prisma ORM** | Type-safe, migrations automaticas, bom DX |
| **SQLite no Mobile** | Performance offline, consultas complexas locais |
| **Delta Sync com Cursor** | Eficiencia em dados grandes, resumable |
| **Last-Write-Wins** | Simplicidade, adequado para single-user |
| **Soft Delete** | Auditoria, recuperacao de dados, sync consistente |

### Trade-offs Conhecidos

1. **Last-Write-Wins vs Merge**
   - Escolhemos simplicidade sobre resolucao complexa
   - Adequado porque cada tecnico gerencia seus proprios dados
   - Pode perder alteracoes em cenarios de edicao simultanea

2. **SQLite vs Realm/WatermelonDB**
   - SQLite e mais simples e bem suportado pelo Expo
   - Nao tem change tracking automatico
   - Requer implementacao manual de sync

3. **Base64 para Uploads**
   - Simplifica upload offline (salva localmente)
   - Aumenta tamanho em ~33%
   - Compressao mitiga parcialmente

4. **Denormalizacao no Mobile**
   - Melhora performance de leitura offline
   - Aumenta complexidade de sync
   - Necessario para UX sem rede

---

## Estrutura do Monorepo

```
auvo-field/
├── apps/
│   ├── backend/          # API NestJS (porta 3001)
│   ├── web/              # Dashboard Next.js (porta 3000)
│   ├── mobile/           # App Expo/React Native
│   └── pdf-service/      # Microservico PDF (BullMQ)
├── packages/
│   ├── shared-types/     # Tipos TypeScript compartilhados
│   └── shared-utils/     # Utilidades compartilhadas
├── docs/                 # Esta documentacao
├── docker-compose.yml    # PostgreSQL + Redis
├── pnpm-workspace.yaml   # Configuracao workspaces
└── package.json          # Scripts globais
```

---

## Stack Tecnologico

### Backend
| Tecnologia | Versao | Uso |
|------------|--------|-----|
| NestJS | 10.3.0 | Framework |
| Prisma | 5.8.0 | ORM |
| PostgreSQL | 16 | Database |
| Redis | 7 | Cache/Queue |
| BullMQ | 5.66.0 | Job Queue |
| Passport | 0.7.0 | Auth |
| JWT | - | Tokens |

### Web
| Tecnologia | Versao | Uso |
|------------|--------|-----|
| Next.js | 14.1.0 | Framework |
| React | 18.2.0 | UI |
| TailwindCSS | 3.4.1 | Styling |
| React Query | 5.90.12 | Data Fetching |
| Zustand | 5.0.9 | State |
| Axios | 1.13.2 | HTTP |

### Mobile
| Tecnologia | Versao | Uso |
|------------|--------|-----|
| Expo | 52.0.0 | Platform |
| React Native | 0.76.9 | UI |
| Expo SQLite | 15.1.4 | Database |
| Expo Router | 4.0.22 | Navigation |

---

## Links Rapidos

- **Swagger API**: http://localhost:3001/api
- **Web Dashboard**: http://localhost:3000
- **Expo DevTools**: exp://localhost:8081

---

*Ultima atualizacao: 2025-12-17*
