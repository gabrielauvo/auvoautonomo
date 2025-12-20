# Project Overview

## Produto

**Auvo Field Service** - Sistema de gestão de serviços técnicos em campo (Field Service Management).

## Objetivo

Permitir que empresas de serviços técnicos (manutenção, instalação, reparos) gerenciem todo o ciclo de atendimento:
1. Cadastro de clientes e equipamentos
2. Orçamentos (Quotes)
3. Ordens de Serviço (Work Orders)
4. Checklists dinâmicos com fotos e assinaturas
5. Cobranças integradas (Asaas)
6. Faturas e relatórios financeiros

## Público-alvo

- Empresas de manutenção de ar-condicionado, refrigeração
- Prestadores de serviços de instalação e reparos
- Técnicos de campo autônomos
- Pequenas e médias empresas de serviços

## Modelo de Negócio

Sistema SaaS com planos:
- **FREE**: Limites básicos (10 clientes, 50 orçamentos, 100 OS)
- **PRO**: Limites expandidos + recursos avançados
- **TEAM**: Multi-usuário + automações financeiras

## Resumo da Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENTES                                │
├─────────────────┬─────────────────┬────────────────────────────┤
│   Mobile App    │    Web App      │     Webhook/API Externa    │
│   (Expo/RN)     │   (Next.js)     │        (Asaas)             │
└────────┬────────┴────────┬────────┴──────────┬─────────────────┘
         │                 │                   │
         └─────────────────┴───────────────────┘
                           │
                    ┌──────▼──────┐
                    │   Backend   │
                    │  (NestJS)   │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────▼─────┐ ┌────▼────┐ ┌────▼────┐
        │ PostgreSQL│ │  Redis  │ │ Storage │
        │  (Prisma) │ │ (Cache) │ │ (Files) │
        └───────────┘ └─────────┘ └─────────┘
```

## Principais Características

### Mobile (Offline-First)
- Sincronização 2-vias com delta sync
- Banco SQLite local (até 100k registros)
- Fila de mutações para operações offline
- Upload de fotos e assinaturas em background

### Backend
- API REST com autenticação JWT
- Sistema de planos com limites de uso
- Integração com gateway de pagamento (Asaas)
- Geração de PDFs assíncrona (BullMQ)
- Rate limiting e proteção contra ataques

### Web
- Dashboard administrativo
- Gestão completa do catálogo
- Relatórios e analytics
- Configuração de templates de documentos

## Escopo por Módulo

| Módulo | Backend | Web | Mobile |
|--------|---------|-----|--------|
| Auth | JWT + Google OAuth | Login/Registro | Login |
| Clients | CRUD + Sync | CRUD + Import CSV | Lista + Detalhes |
| Quotes | CRUD + PDF | CRUD + Envio | Criar + Assinar |
| Work Orders | CRUD + Status | CRUD + Timeline | Executar + Checklists |
| Checklists | Templates + Instâncias | Editor de Templates | Preenchimento Offline |
| Billing | Asaas Integration | Dashboard + Cobranças | Visualização |
| Catalog | CRUD Produtos/Serviços | CRUD + Kits | Seleção em Orçamentos |
| Reports | Analytics API | Dashboards | - |

## Convenções de Nomenclatura

- **Quote** = Orçamento
- **Work Order (WO)** = Ordem de Serviço (OS)
- **Checklist Instance** = Instância de checklist vinculada a uma OS
- **Checklist Template** = Modelo reutilizável de checklist
- **Client Payment** = Cobrança gerada via Asaas
- **Technician** = Técnico/Usuário do app mobile
