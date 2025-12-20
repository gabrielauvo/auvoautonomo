# Auvo Web - Frontend Application

Frontend web do sistema Auvo, construído com Next.js 14 e integração completa com a API backend.

## Stack Tecnológica

- **Next.js 14** - Framework React com App Router
- **TypeScript** - Tipagem estática
- **Tailwind CSS** - Estilização utilitária
- **React Query** - Gerenciamento de estado servidor
- **Axios** - Cliente HTTP
- **Lucide React** - Ícones

## Estrutura do Projeto

```
src/
├── app/                    # App Router (Next.js 14)
│   ├── (auth)/             # Grupo de rotas de autenticação
│   │   └── login/          # Página de login
│   ├── (dashboard)/        # Grupo de rotas autenticadas
│   │   └── dashboard/      # Dashboard principal
│   ├── layout.tsx          # Layout raiz com providers
│   ├── page.tsx            # Página inicial (redirect)
│   └── globals.css         # Estilos globais
│
├── components/
│   ├── ui/                 # Design System (Button, Input, Card, etc.)
│   ├── layout/             # Componentes de layout
│   │   ├── app-layout.tsx  # Layout principal da aplicação
│   │   ├── sidebar.tsx     # Menu lateral de navegação
│   │   └── header.tsx      # Barra superior com usuário
│   └── auth/               # Componentes de autenticação
│       └── protected-route.tsx  # HOC para proteção de rotas
│
├── context/
│   ├── auth-context.tsx    # Contexto de autenticação
│   └── query-provider.tsx  # Provider do React Query
│
├── hooks/
│   └── use-analytics.ts    # Hooks para dados de analytics
│
├── services/
│   ├── api.ts              # Cliente HTTP configurado
│   ├── auth.service.ts     # Serviço de autenticação
│   ├── billing.service.ts  # Serviço de billing/planos
│   └── analytics.service.ts # Serviço de analytics
│
└── lib/
    └── utils.ts            # Utilitários (cn, etc.)
```

## Requisitos

- Node.js 18+
- pnpm (recomendado) ou npm
- Backend rodando em `http://localhost:3001`

## Instalação

```bash
# Na raiz do monorepo
pnpm install

# Ou apenas no app web
cd apps/web
pnpm install
```

## Desenvolvimento

```bash
# Iniciar servidor de desenvolvimento
pnpm dev

# A aplicação estará disponível em http://localhost:3000
```

## Build

```bash
# Build de produção
pnpm build

# Iniciar em produção
pnpm start
```

## Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz do projeto:

```env
# URL da API Backend
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

## Funcionalidades Implementadas

### Autenticação
- [x] Login com email/senha
- [x] Logout
- [x] Proteção de rotas (redirect para /login)
- [x] Persistência de token (cookies)
- [x] Interceptor de requisições (Bearer token)
- [x] Tratamento de erro 401 (sessão expirada)

### Layout
- [x] Sidebar responsiva com navegação
- [x] Header com informações do usuário
- [x] Badge de plano (FREE/PRO/TEAM)
- [x] Menu dropdown do usuário

### Dashboard
- [x] Cards de métricas (Orçamentos, OS, Receita, Clientes)
- [x] Status dos orçamentos por categoria
- [x] Status das OS por categoria
- [x] Resumo financeiro (recebido, pendente, atrasado)
- [x] Alerta de limite do plano FREE
- [x] Estados de loading (skeletons)
- [x] Tratamento de erros

### Design System
- [x] Button (variantes: primary, secondary, outline, ghost, danger)
- [x] Input (com label, erro, ícones)
- [x] Card (com hover effects)
- [x] Badge (variantes de cor)
- [x] Alert (success, error, warning, info)
- [x] Avatar
- [x] Spinner
- [x] Skeleton

## Integração com Backend

O frontend se comunica com a API através de serviços tipados:

```typescript
// Exemplo de uso
import { useAnalyticsOverview } from '@/hooks/use-analytics';

function Dashboard() {
  const { data, isLoading, error } = useAnalyticsOverview();

  if (isLoading) return <Spinner />;
  if (error) return <Alert variant="error">Erro ao carregar</Alert>;

  return <div>{data.quotes.total} orçamentos</div>;
}
```

## Rotas

| Rota | Descrição | Proteção |
|------|-----------|----------|
| `/` | Redirect para dashboard ou login | - |
| `/login` | Página de login | Pública |
| `/dashboard` | Dashboard principal | Autenticada |

## Cores e Tema

O design system usa as cores da marca Auvo:

```css
/* Cores principais */
--primary: #7C3AED (roxo Auvo)
--primary-hover: #6D28D9
--primary-light: #EDE9FE

/* Status */
--success: #10B981
--warning: #F59E0B
--error: #EF4444
--info: #3B82F6
```

## Boas Práticas

1. **Componentes**: Use componentes do design system (`@/components/ui`)
2. **Hooks**: Use hooks customizados para lógica reutilizável
3. **Services**: Centralize chamadas API em services tipados
4. **Context**: Use contexts para estado global (auth, theme)
5. **Types**: Mantenha tipos em arquivos separados ou nos services

## Scripts Disponíveis

```bash
pnpm dev        # Servidor de desenvolvimento
pnpm build      # Build de produção
pnpm start      # Iniciar build de produção
pnpm lint       # Verificar linting
pnpm type-check # Verificar tipos TypeScript
```

## Módulo de Clientes (Dia Web 2)

### Rotas

| Rota | Descrição | Proteção |
|------|-----------|----------|
| `/clients` | Listagem de clientes com busca e paginação | Autenticada |
| `/clients/new` | Formulário de criação de cliente | Autenticada |
| `/clients/:id` | Detalhes do cliente com timeline e KPIs | Autenticada |
| `/clients/:id/edit` | Formulário de edição de cliente | Autenticada |

### Componentes Principais

- **ClientListPage** (`app/(dashboard)/clients/page.tsx`)
  - Tabela responsiva com dados do cliente
  - Busca com debounce (300ms)
  - Paginação client-side (10 itens/página)
  - Persistência de busca/página na URL (`?q=&page=`)
  - Estados vazios e de loading
  - Banner de uso do plano (FREE)

- **ClientDetailsPage** (`app/(dashboard)/clients/[id]/page.tsx`)
  - Dados de contato com links clicáveis (tel:/mailto:)
  - KPIs resumidos (orçamentos, OS, valores)
  - Badge de status (Em dia / Inadimplente)
  - Ações rápidas (Editar, Criar Orçamento, Criar OS)

- **ClientForm** (`components/clients/client-form.tsx`)
  - Campos: nome, documento (CPF/CNPJ), telefone, email
  - Endereço: CEP, logradouro, cidade, estado
  - Observações
  - Validações e máscaras
  - Tratamento de erro de limite

- **ClientTimeline** (`components/clients/client-timeline.tsx`)
  - Histórico visual de eventos
  - Tipos: orçamentos, OS, pagamentos, checklists
  - Ícones e cores por tipo de evento
  - Formatação de valores e datas

### Integração com Backend

```typescript
// Endpoints utilizados
GET  /clients              // Listar clientes
GET  /clients/search?q=    // Buscar clientes
GET  /clients/:id          // Obter cliente
POST /clients              // Criar cliente (com UsageLimitGuard)
PATCH /clients/:id         // Atualizar cliente
DELETE /clients/:id        // Remover cliente
GET  /service-flow/client/:clientId/timeline  // Timeline do cliente
GET  /billing/plan         // Dados do plano (limites e uso)
```

### Hooks Disponíveis

```typescript
import {
  useClients,        // Lista de clientes com busca
  useClient,         // Cliente por ID
  useClientTimeline, // Timeline do cliente
  useClientSummary,  // KPIs do cliente
  useCreateClient,   // Mutation de criação
  useUpdateClient,   // Mutation de atualização
  useDeleteClient,   // Mutation de remoção
} from '@/hooks/use-clients';
```

### Tratamento de Limites PLG

- **PlanLimitBanner**: Mostra barra de progresso de uso do plano FREE
- **UpsellModal**: Modal exibido quando limite é atingido
- Intercepta erro `LIMIT_REACHED` no ClientForm
- Redireciona para `/settings/billing` para upgrade

### Componentes UI Adicionados

- **Table** (`components/ui/table.tsx`) - Tabela com estilos consistentes
- **Pagination** (`components/ui/pagination.tsx`) - Navegação de páginas
- **EmptyState** (`components/ui/empty-state.tsx`) - Estado vazio configurável

## Módulo de Orçamentos (Dia Web 3)

### Rotas

| Rota | Descrição | Proteção |
|------|-----------|----------|
| `/quotes` | Listagem de orçamentos com filtros | Autenticada |
| `/quotes/new` | Formulário de criação de orçamento | Autenticada |
| `/quotes/:id` | Detalhes do orçamento | Autenticada |
| `/quotes/:id/edit` | Formulário de edição (apenas DRAFT) | Autenticada |
| `/p/quotes/:id` | Link público do orçamento (futuro) | Pública |

### Fluxo de Status

```
DRAFT → SENT → APPROVED → (Converter para OS)
           ↘ REJECTED
           ↘ EXPIRED
```

### Componentes Principais

- **QuotesListPage** (`app/(dashboard)/quotes/page.tsx`)
  - Tabela responsiva com dados do orçamento
  - Filtro por status (Todos, Rascunho, Enviado, Aprovado, Rejeitado, Expirado)
  - Busca por cliente com debounce
  - Paginação client-side (10 itens/página)
  - Banner de uso do plano (FREE)

- **QuoteDetailsPage** (`app/(dashboard)/quotes/[id]/page.tsx`)
  - Header com status e data de criação
  - Dados do cliente (clicável para perfil)
  - Tabela de itens do orçamento
  - Resumo financeiro (subtotal, desconto, total)
  - Histórico de status (criado, enviado, aprovado/rejeitado)
  - **Ações:**
    - Editar (apenas DRAFT)
    - Download PDF
    - Copiar Link público
    - Enviar via WhatsApp
    - Marcar como Enviado
    - Aprovar (com modal de confirmação)
    - Rejeitar (com modal e campo de motivo)
    - Converter para OS (APPROVED)

- **QuoteForm** (`components/quotes/quote-form.tsx`)
  - Seleção de cliente com busca autocomplete
  - Itens do catálogo via modal de seleção
  - Itens manuais (sem catálogo)
  - Campo de validade
  - Desconto geral (R$)
  - Observações
  - Cálculo automático de totais
  - Tratamento de erro LIMIT_REACHED

- **CatalogSelectModal** (`components/quotes/catalog-select-modal.tsx`)
  - Busca por produtos/serviços
  - Filtros por tipo (Produto, Serviço, Kit)
  - Filtros por categoria
  - Seleção com ajuste de quantidade
  - Opção de adicionar item manual

- **QuoteStatusBadge** (`components/quotes/quote-status-badge.tsx`)
  - Badges coloridos por status
  - DRAFT (cinza), SENT (azul), APPROVED (verde), REJECTED (vermelho), EXPIRED (laranja)

- **QuoteItemsTable** (`components/quotes/quote-items-table.tsx`)
  - Tabela de itens com preço unitário, quantidade, desconto
  - Modo editável com botões de ação
  - Modo somente leitura para visualização

### Geração de PDF

O PDF é gerado pelo backend através do endpoint:
```
POST /quotes/:id/pdf  → Gera PDF e retorna attachmentId
GET  /quotes/:id/pdf  → Download do PDF gerado
```

### Link Público

- Botão "Copiar Link" copia URL pública para clipboard
- Formato: `{origin}/p/quotes/{quoteId}`
- Permite que cliente visualize orçamento sem login

### Envio via WhatsApp

1. Gera PDF (se não existir)
2. Cria link público para o attachment
3. Monta mensagem personalizada com dados do orçamento
4. Abre `wa.me` com a mensagem
5. Se estava em DRAFT, muda status para SENT

### Integração com Backend

```typescript
// Endpoints utilizados
GET    /quotes                    // Listar orçamentos
GET    /quotes/:id                // Obter orçamento
POST   /quotes                    // Criar orçamento (com UsageLimitGuard)
PATCH  /quotes/:id                // Atualizar orçamento
DELETE /quotes/:id                // Remover orçamento
PATCH  /quotes/:id/status         // Atualizar status (com reason opcional)
POST   /quotes/:id/items          // Adicionar item
PATCH  /quotes/:id/items/:itemId  // Atualizar item
DELETE /quotes/:id/items/:itemId  // Remover item
POST   /quotes/:id/pdf            // Gerar PDF
GET    /quotes/:id/pdf            // Download PDF
GET    /quotes/:id/attachments    // Listar attachments
POST   /attachments/:id/public    // Criar link público
GET    /catalog/items             // Listar itens do catálogo
GET    /catalog/categories        // Listar categorias
```

### Hooks Disponíveis

```typescript
import {
  // Queries
  useQuotes,           // Lista de orçamentos com filtros
  useQuote,            // Orçamento por ID
  useCatalogItems,     // Itens do catálogo
  useCatalogCategories,// Categorias do catálogo
  useQuoteAttachments, // Attachments do orçamento

  // Mutations
  useCreateQuote,      // Criar orçamento
  useUpdateQuote,      // Atualizar orçamento
  useDeleteQuote,      // Remover orçamento
  useUpdateQuoteStatus,// Atualizar status (com reason)
  useAddQuoteItem,     // Adicionar item
  useUpdateQuoteItem,  // Atualizar item
  useRemoveQuoteItem,  // Remover item
  useGenerateQuotePdf, // Gerar PDF
  useDownloadQuotePdf, // Download PDF
  useSendWhatsApp,     // Criar link e abrir WhatsApp
} from '@/hooks/use-quotes';
```

### Tratamento de Limites PLG

- **PlanLimitBanner**: Mostra na listagem o uso atual vs limite do plano
- **UpsellModal**: Exibido ao tentar criar orçamento além do limite
- Intercepta erro `LIMIT_REACHED` ou `limite` no QuoteForm
- Sugere upgrade para plano PRO ou TEAM

### Permissões de Ações

```typescript
// src/services/quotes.service.ts
canEditQuote(quote)          // status === 'DRAFT'
canSendQuote(quote)          // status === 'DRAFT'
canApproveRejectQuote(quote) // status === 'SENT'
canConvertToWorkOrder(quote) // status === 'APPROVED'
```

## Módulo Financeiro - Cobranças (Dia Web 5)

### Rotas

| Rota | Descrição | Proteção |
|------|-----------|----------|
| `/billing/charges` | Listagem de cobranças com filtros | Autenticada |
| `/billing/charges/new` | Criar nova cobrança | Autenticada |
| `/billing/charges/:id` | Detalhes da cobrança | Autenticada |
| `/billing/charges/:id/edit` | Editar cobrança (apenas PENDING) | Autenticada |

### Fluxo de Status

```
PENDING → CONFIRMED/RECEIVED/RECEIVED_IN_CASH (pago)
        ↘ OVERDUE (vencido)
        ↘ CANCELED
        ↘ REFUNDED (estornado)
```

### Componentes Principais

- **ChargesListPage** (`app/(dashboard)/billing/charges/page.tsx`)
  - Tabela responsiva com dados da cobrança
  - Filtro por status (Todas, Aguardando, Vencidas, Confirmadas, etc.)
  - Filtro por tipo (PIX, Boleto, Cartão)
  - Filtro por período (data início e fim)
  - Busca por cliente/ID com debounce
  - Paginação client-side
  - Banner de uso do plano (FREE)

- **ChargeDetailsPage** (`app/(dashboard)/billing/charges/[id]/page.tsx`)
  - Valor e status com badges
  - Dados do cliente (clicável)
  - Datas (criação, vencimento, pagamento)
  - IDs (interno, Asaas, referência externa)
  - Condições de pagamento (desconto, multa, juros)
  - Abas: Informações e Timeline
  - **Ações:**
    - Copiar PIX (com feedback "Copiado!")
    - Ver QR Code (modal)
    - Baixar Boleto PDF
    - Link de Pagamento
    - Enviar via WhatsApp
    - Registrar Pagamento Manual (modal)
    - Cancelar Cobrança (modal com motivo)
    - Editar (apenas PENDING)
    - Reenviar por Email

- **ChargeForm** (`components/billing/charge-form.tsx`)
  - Seleção de cliente com busca autocomplete
  - Valor e vencimento
  - Tipo de cobrança (PIX, Boleto, Cartão)
  - Descrição
  - Desconto (fixo ou percentual)
  - Multa por atraso (%)
  - Juros ao mês (%)
  - Tratamento de erro LIMIT_REACHED

- **ChargeStatusBadge** (`components/billing/charge-status-badge.tsx`)
  - PENDING (cinza), OVERDUE (vermelho), CONFIRMED (verde)
  - RECEIVED (verde), RECEIVED_IN_CASH (verde), REFUNDED (laranja), CANCELED (vermelho)

- **BillingTypeBadge** (`components/billing/billing-type-badge.tsx`)
  - PIX (verde), BOLETO (azul), CREDIT_CARD (laranja), UNDEFINED (cinza)

- **PixQRCodeModal** (`components/billing/pix-qrcode-modal.tsx`)
  - Imagem do QR Code
  - Código copia-e-cola
  - Botão copiar com feedback

- **ManualPaymentModal** (`components/billing/manual-payment-modal.tsx`)
  - Data do pagamento
  - Valor recebido
  - Método de pagamento
  - Observações

- **CancelChargeModal** (`components/billing/cancel-charge-modal.tsx`)
  - Campo de motivo obrigatório
  - Alerta de ação irreversível

- **WhatsAppShareButton** (`components/billing/whatsapp-share-button.tsx`)
  - Gera mensagem formatada
  - Inclui valor, vencimento, link de pagamento
  - Inclui código PIX copia-e-cola (se PIX)

- **ChargeTimeline** (`components/billing/charge-timeline.tsx`)
  - Histórico visual de eventos
  - Tipos: criação, envio, pagamento, cancelamento, webhook

### Integração com Backend/Asaas

```typescript
// Endpoints utilizados
GET    /billing/charges              // Listar cobranças
GET    /billing/charges/:id          // Obter cobrança
POST   /billing/charges              // Criar cobrança (Asaas)
PUT    /billing/charges/:id          // Atualizar cobrança
POST   /billing/charges/:id/cancel   // Cancelar (Asaas)
POST   /billing/charges/:id/receive-in-cash // Pagamento manual
POST   /billing/charges/:id/resend-email   // Reenviar email
GET    /billing/charges/:id/events   // Timeline de eventos
GET    /billing/charges/stats        // Estatísticas
GET    /clients/:id/charges          // Cobranças do cliente
```

**URLs retornadas pelo Asaas:**
- `invoiceUrl` - Link de pagamento geral
- `bankSlipUrl` - PDF do boleto
- `pixQrCodeUrl` - Imagem do QR Code PIX
- `pixCopiaECola` - Código PIX para copiar
- `transactionReceiptUrl` - Comprovante de pagamento

### Hooks Disponíveis

```typescript
import {
  // Queries
  useCharges,         // Lista com filtros e paginação
  useCharge,          // Cobrança por ID
  useChargeStats,     // Estatísticas
  useClientCharges,   // Cobranças de um cliente
  useChargeEvents,    // Timeline de eventos

  // Mutations
  useCreateCharge,    // Criar cobrança
  useUpdateCharge,    // Atualizar cobrança
  useCancelCharge,    // Cancelar cobrança
  useRegisterManualPayment, // Pagamento manual
  useResendChargeEmail,     // Reenviar email
} from '@/hooks/use-charges';
```

### Tratamento de Limites PLG

- **PlanLimitBanner**: Mostra uso de cobranças no plano FREE
- **UpsellModal**: Exibido ao tentar criar cobrança além do limite
- Intercepta erro `LIMIT_REACHED` ou `limite` no ChargeForm
- Desabilita botão "Nova Cobrança" quando no limite

### Permissões de Ações

```typescript
// src/services/charges.service.ts
canEditCharge(charge)           // status === 'PENDING'
canCancelCharge(charge)         // status === 'PENDING' || 'OVERDUE'
canRegisterManualPayment(charge)// status === 'PENDING' || 'OVERDUE'
isChargePaid(charge)            // CONFIRMED || RECEIVED || RECEIVED_IN_CASH
isChargeFinalized(charge)       // pago || REFUNDED || CANCELED
```

### Integração com Clientes

A página de detalhes do cliente (`/clients/:id`) possui aba "Financeiro" que exibe:
- Lista de cobranças do cliente
- Botão para criar nova cobrança pré-selecionando o cliente

## Módulo de Catálogo (Dia Web 9)

### Rotas

| Rota | Descrição | Proteção |
|------|-----------|----------|
| `/catalog` | Listagem do catálogo com filtros | Autenticada |
| `/catalog/new` | Formulário de criação de item | Autenticada |
| `/catalog/:id` | Detalhes do item | Autenticada |
| `/catalog/:id/edit` | Formulário de edição do item | Autenticada |

### Tipos de Item

```
PRODUCT  → Produto (item físico ou material)
SERVICE  → Serviço (mão de obra ou prestação de serviço)
BUNDLE   → Kit (combinação de produtos e/ou serviços)
```

### Componentes Principais

- **CatalogListPage** (`app/(dashboard)/catalog/page.tsx`)
  - Tabs de tipo (Todos, Produtos, Serviços, Kits)
  - Busca por nome, SKU ou descrição
  - Filtros por categoria e status (Ativos/Inativos)
  - Tabela com tipo, nome, SKU, categoria, unidade, preço, status
  - Paginação client-side (15 itens/página)
  - Persistência de filtros na URL

- **CatalogItemDetailsPage** (`app/(dashboard)/catalog/[id]/page.tsx`)
  - Informações básicas (nome, SKU, descrição, categoria)
  - Preços (base e custo)
  - Configurações (unidade, duração padrão para serviços)
  - Composição do kit (para BUNDLE)
  - **Ações:**
    - Editar
    - Ativar/Desativar
    - Excluir (apenas se não usado em orçamentos/OS)

- **CatalogItemForm** (`components/catalog/catalog-item-form.tsx`)
  - Seleção de tipo (PRODUCT, SERVICE, BUNDLE)
  - Campos: nome, SKU, descrição, categoria, unidade
  - Preços: preço base (venda) e preço de custo
  - Duração padrão (minutos) para serviços
  - Unidades pré-definidas + opção personalizada
  - Status ativo/inativo (na edição)
  - Validações de campos obrigatórios

- **KitCompositionEditor** (`components/catalog/kit-composition-editor.tsx`)
  - Lista de itens que compõem o kit
  - Adicionar item via modal de seleção (apenas PRODUCT/SERVICE)
  - Definir quantidade de cada item
  - Cálculo automático do preço total do kit
  - Remover itens do kit

### Integração com Modal de Seleção

O `CatalogSelectModal` existente em Orçamentos e OS usa os mesmos endpoints e hooks:
- Busca itens ativos do catálogo
- Filtra por tipo e categoria
- Permite adicionar item manual (sem catálogo)

### Integração com Backend

```typescript
// Endpoints utilizados (controller /products)
GET    /products/categories           // Listar categorias
GET    /products/categories/:id       // Obter categoria
POST   /products/categories           // Criar categoria
PUT    /products/categories/:id       // Atualizar categoria
DELETE /products/categories/:id       // Deletar categoria

GET    /products/items                // Listar itens
GET    /products/items/:id            // Obter item
POST   /products/items                // Criar item
PUT    /products/items/:id            // Atualizar item
DELETE /products/items/:id            // Deletar item

GET    /products/items/:id/bundle-items     // Itens do kit
POST   /products/items/:id/bundle-items     // Adicionar ao kit
DELETE /products/bundle-items/:id           // Remover do kit

GET    /products/stats                // Estatísticas do catálogo
```

### Hooks Disponíveis

```typescript
import {
  // Categorias
  useCategories,       // Lista de categorias
  useCategory,         // Categoria por ID
  useCreateCategory,   // Criar categoria
  useUpdateCategory,   // Atualizar categoria
  useDeleteCategory,   // Deletar categoria

  // Itens
  useCatalogItems,     // Lista de itens com filtros
  useCatalogItem,      // Item por ID
  useCreateItem,       // Criar item
  useUpdateItem,       // Atualizar item
  useDeleteItem,       // Deletar item
  useToggleItemStatus, // Ativar/desativar

  // Composição de Kit
  useBundleItems,      // Itens de um kit
  useAddBundleItem,    // Adicionar ao kit
  useRemoveBundleItem, // Remover do kit

  // Estatísticas
  useCatalogStats,     // Contagens por tipo
} from '@/hooks/use-catalog';
```

### Service Helpers

```typescript
// src/services/catalog.service.ts
formatItemType(type)        // 'PRODUCT' → 'Produto'
getItemTypeBadgeColor(type) // 'PRODUCT' → 'info'
calculateBundlePrice(items) // Soma preço × quantidade
canDeleteItem(item)         // Verifica se não está em uso
```

### Testes

```bash
# Executar testes do módulo
pnpm test -- --testPathPattern="catalog"

# Testes disponíveis:
# - catalog.service.test.ts (helpers)
# - catalog-item-form.test.tsx (formulário)
# - kit-composition-editor.test.tsx (composição de kit)
```

### Componente UI Adicionado

- **Select** (`components/ui/input.tsx`) - Select estilizado com variantes

## Segurança (Enterprise-Grade para 1M+ Usuários)

### Implementações Realizadas

#### 1. Autenticação com HttpOnly Cookies
- ✅ Tokens armazenados em cookies HttpOnly (não acessíveis via JavaScript)
- ✅ Cookies com flags Secure e SameSite=Strict
- ✅ API routes para login/logout/refresh (`/api/auth/*`)
- ✅ Proteção contra XSS e CSRF
- ✅ Refresh token automático

#### 2. Proteção CSRF
- ✅ Token CSRF único por sessão
- ✅ Hook `useCSRFToken` para formulários
- ✅ Validação em todos POST/PUT/DELETE
- ✅ Rate limiting em geração de tokens

#### 3. Sanitização e Validação
- ✅ `lib/sanitize.ts` - Funções de sanitização
- ✅ Validação de HTML (remove scripts)
- ✅ Validação de URLs (previne javascript:, data:)
- ✅ Validação de uploads (MIME, extensão, tamanho)
- ✅ Prevenção de Path Traversal
- ✅ Prevenção de Open Redirect

#### 4. Headers de Segurança
- ✅ Content-Security-Policy (CSP)
- ✅ Strict-Transport-Security (HSTS)
- ✅ X-Frame-Options: DENY
- ✅ X-Content-Type-Options: nosniff
- ✅ Permissions-Policy

#### 5. Rate Limiting
- ✅ Login: 5 tentativas/minuto
- ✅ Upload: 10 uploads/minuto
- ✅ API geral: 100 req/minuto
- ✅ Rate limiting por IP

### Arquivos de Segurança

```
apps/web/
├── SECURITY.md                     # Guia completo de segurança
├── SECURITY-SUMMARY.md             # Resumo das implementações
├── src/
│   ├── app/api/
│   │   ├── auth/                   # API routes de autenticação
│   │   │   ├── login/route.ts
│   │   │   ├── logout/route.ts
│   │   │   └── refresh/route.ts
│   │   ├── csrf-token/route.ts     # Geração de tokens CSRF
│   │   └── example-secure/route.ts # Template de API segura
│   ├── lib/
│   │   ├── sanitize.ts             # Sanitização e validação
│   │   ├── security.ts             # CSRF, rate limiting
│   │   ├── middleware-helpers.ts   # Helpers para API routes
│   │   └── SECURITY-EXAMPLES.md    # Exemplos práticos
│   └── hooks/
│       └── use-csrf-token.ts       # Hook de CSRF
```

### Como Usar

#### Login Seguro
```typescript
import { login, logout } from '@/services/auth.service';

// Login - token vai para HttpOnly cookie
const { user } = await login({ email, password });

// Logout
await logout();
```

#### Formulário com CSRF
```tsx
import { useCSRFToken } from '@/hooks';

const { csrfToken } = useCSRFToken();

// Adicionar no header
fetch('/api/endpoint', {
  method: 'POST',
  headers: { 'X-CSRF-Token': csrfToken },
  body: JSON.stringify(data),
});
```

#### Upload Seguro
```typescript
import { validateFileUpload } from '@/lib/sanitize';

const validation = validateFileUpload(file, {
  maxSizeMB: 10,
  allowedExtensions: ['jpg', 'pdf'],
  allowedMimeTypes: ['image/*', 'application/pdf'],
});

if (!validation.valid) {
  throw new Error(validation.error);
}
```

#### API Route Segura
```typescript
import { withSecurity } from '@/lib/middleware-helpers';

export const POST = withSecurity(
  async (request) => {
    // Seu código aqui
    return successResponse({ ok: true });
  },
  {
    requireCSRF: true,
    rateLimit: 'api',
    allowedMethods: ['POST'],
  }
);
```

### Documentação Completa

Consulte os arquivos de documentação para detalhes completos:
- `SECURITY.md` - Guia completo
- `SECURITY-SUMMARY.md` - Resumo das implementações
- `src/lib/SECURITY-EXAMPLES.md` - Exemplos práticos

## Próximos Passos (Dias Seguintes)

- [x] Páginas CRUD de Clientes
- [x] Páginas de Orçamentos
- [x] Páginas de Ordens de Serviço
- [x] Páginas de Financeiro/Cobranças (Asaas)
- [x] Módulo de Catálogo
- [x] Segurança Enterprise-Grade (1M+ usuários)
- [ ] Relatórios e Analytics avançados
- [ ] Configurações de usuário
- [ ] Gestão de planos/billing
