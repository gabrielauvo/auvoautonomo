# Google Business Growth & Attribution

## Visão Geral

Feature para conectar o Google Business Profile do cliente, coletar métricas de performance, fazer tracking de conversões e gerar insights acionáveis para crescimento do negócio.

**Status**: Em desenvolvimento
**Versão**: 1.0.0 (MVP)
**Última atualização**: 2025-12-24

---

## Índice

1. [Arquitetura](#arquitetura)
2. [Modelo de Dados](#modelo-de-dados)
3. [APIs Backend](#apis-backend)
4. [Jobs e Coleta de Métricas](#jobs-e-coleta-de-métricas)
5. [Tracking de Links](#tracking-de-links)
6. [Atribuição](#atribuição)
7. [Engine de Insights](#engine-de-insights)
8. [Telas Web](#telas-web)
9. [Telas Mobile](#telas-mobile)
10. [Segurança](#segurança)
11. [Observabilidade](#observabilidade)
12. [Plano de Testes](#plano-de-testes)
13. [Rollout](#rollout)
14. [Guia de Configuração](#guia-de-configuração)

---

## Arquitetura

### Diagrama de Alto Nível

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              GOOGLE CLOUD                                     │
│  ┌─────────────────┐  ┌─────────────────────────────────────────────────┐   │
│  │  Google OAuth   │  │  Business Profile APIs                          │   │
│  │  (consent)      │  │  - Performance API (métricas)                   │   │
│  │                 │  │  - Business Information API (locations)         │   │
│  └────────┬────────┘  └────────────────────┬────────────────────────────┘   │
└───────────┼────────────────────────────────┼────────────────────────────────┘
            │                                │
            │ OAuth2                         │ API calls
            │                                │
┌───────────▼────────────────────────────────▼────────────────────────────────┐
│                              BACKEND (NestJS)                                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │  GoogleOAuth    │  │  GoogleMetrics  │  │  GoogleGrowthDashboard      │  │
│  │  Module         │  │  Job (Cron)     │  │  Module                     │  │
│  │                 │  │                 │  │                             │  │
│  │  - /connect     │  │  - Daily sync   │  │  - /dashboard               │  │
│  │  - /callback    │  │  - Upsert events│  │  - /insights                │  │
│  │  - /disconnect  │  │  - Retry logic  │  │  - /attribution             │  │
│  └────────┬────────┘  └────────┬────────┘  └──────────────┬──────────────┘  │
│           │                    │                          │                  │
│  ┌────────▼────────────────────▼──────────────────────────▼──────────────┐  │
│  │                         PostgreSQL (Prisma)                            │  │
│  │  - GoogleIntegration    - DemandEvent       - AttributionLink         │  │
│  │  - GoogleToken (enc)    - GrowthInsight     - Quote.origin*           │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Tracking Endpoints                                                  │    │
│  │  - GET /wpp/{slug}  → registra evento + redirect wa.me              │    │
│  │  - GET /go/{slug}   → registra evento + redirect site               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────────┘
            │                                           │
            │ REST API                                  │ REST API
            │                                           │
┌───────────▼────────────────────┐      ┌──────────────▼─────────────────────┐
│         WEB (Next.js)          │      │          MOBILE (Expo)             │
│  ┌─────────────────────────┐   │      │  ┌─────────────────────────────┐   │
│  │  /settings/integrations │   │      │  │  Tela "Crescimento"         │   │
│  │  - Conectar Google      │   │      │  │  - Cards da semana          │   │
│  │  - Selecionar Location  │   │      │  │  - Gráfico simples          │   │
│  └─────────────────────────┘   │      │  │  - Insights                 │   │
│  ┌─────────────────────────┐   │      │  │  - Copiar links             │   │
│  │  /reports/growth        │   │      │  └─────────────────────────────┘   │
│  │  - Overview + Funil     │   │      │  ┌─────────────────────────────┐   │
│  │  - Ações detalhadas     │   │      │  │  Notificações               │   │
│  │  - Atribuição           │   │      │  │  - Quedas bruscas           │   │
│  │  - Insights             │   │      │  │  - Metas atingidas          │   │
│  └─────────────────────────┘   │      │  └─────────────────────────────┘   │
└────────────────────────────────┘      └─────────────────────────────────────┘
```

### Fluxo de Dados

1. **Conexão OAuth**: Usuário conecta Google Business Profile via OAuth2
2. **Seleção de Location**: Usuário escolhe qual perfil/unidade monitorar
3. **Coleta de Métricas**: Job diário puxa métricas da API do Google
4. **Tracking**: Links intermediários registram cliques (WhatsApp, Site)
5. **Atribuição**: Sistema associa leads/orçamentos às origens
6. **Insights**: Engine analisa padrões e gera recomendações
7. **Dashboard**: Usuário visualiza funil, métricas e insights

---

## Modelo de Dados

### Diagrama ER

```
┌─────────────────────────────────┐
│         User (existente)        │
├─────────────────────────────────┤
│ id: UUID (PK)                   │
│ email: String                   │
│ ...                             │
└───────────────┬─────────────────┘
                │ 1:1
                ▼
┌─────────────────────────────────┐
│       GoogleIntegration         │
├─────────────────────────────────┤
│ id: UUID (PK)                   │
│ userId: UUID (FK, unique)       │
│ googleAccountId: String         │
│ googleLocationId: String        │
│ googleLocationName: String      │
│ status: Enum                    │
│ scopes: String[]                │
│ lastSyncAt: DateTime?           │
│ lastSyncError: String?          │
│ createdAt: DateTime             │
│ updatedAt: DateTime             │
└───────────────┬─────────────────┘
                │ 1:1
                ▼
┌─────────────────────────────────┐
│         GoogleToken             │
├─────────────────────────────────┤
│ id: UUID (PK)                   │
│ integrationId: UUID (FK,unique) │
│ accessTokenEnc: String          │
│ refreshTokenEnc: String         │
│ expiresAt: DateTime             │
│ createdAt: DateTime             │
│ updatedAt: DateTime             │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│          DemandEvent            │
├─────────────────────────────────┤
│ id: UUID (PK)                   │
│ userId: UUID (FK)               │
│ source: Enum                    │
│ actionType: Enum                │
│ occurredAt: DateTime            │
│ periodType: Enum                │
│ periodStart: DateTime           │
│ periodEnd: DateTime             │
│ value: Int                      │
│ dimensions: JSON?               │
│ rawRef: String?                 │
│ createdAt: DateTime             │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│        AttributionLink          │
├─────────────────────────────────┤
│ id: UUID (PK)                   │
│ userId: UUID (FK)               │
│ slug: String (unique)           │
│ type: Enum                      │
│ targetUrl: String               │
│ clickCount: Int                 │
│ isActive: Boolean               │
│ createdAt: DateTime             │
│ updatedAt: DateTime             │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│         GrowthInsight           │
├─────────────────────────────────┤
│ id: UUID (PK)                   │
│ userId: UUID (FK)               │
│ type: Enum                      │
│ severity: Enum                  │
│ title: String                   │
│ description: String             │
│ recommendations: JSON           │
│ metrics: JSON                   │
│ isRead: Boolean                 │
│ isDismissed: Boolean            │
│ expiresAt: DateTime?            │
│ createdAt: DateTime             │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│      Quote (alterações)         │
├─────────────────────────────────┤
│ ...campos existentes...         │
│ + originSource: Enum?           │
│ + originMedium: String?         │
│ + originCampaign: String?       │
│ + originActionType: Enum?       │
│ + originConfidence: Enum?       │
│ + originEventId: UUID?          │
└─────────────────────────────────┘
```

### Enums

```typescript
// Status da integração Google
enum GoogleIntegrationStatus {
  PENDING      // Aguardando seleção de location
  CONNECTED    // Conectado e funcionando
  ERROR        // Erro na última sincronização
  DISCONNECTED // Desconectado pelo usuário
  REVOKED      // Token revogado pelo Google
}

// Fonte do evento de demanda
enum DemandEventSource {
  GOOGLE_BUSINESS  // Métricas do Google Business Profile
  TRACKING_LINK    // Nossos links de tracking
  MANUAL           // Entrada manual
}

// Tipo de ação
enum DemandActionType {
  CALL              // Ligação (click-to-call)
  ROUTE             // Solicitação de rota
  WEBSITE_CLICK     // Clique no site (Google)
  WHATSAPP_CLICK    // Clique WhatsApp (tracking)
  SITE_CLICK        // Clique site (tracking)
  PROFILE_VIEW      // Visualização do perfil
  SEARCH_IMPRESSION // Impressão na busca
  MAPS_IMPRESSION   // Impressão no Maps
}

// Tipo de período
enum DemandPeriodType {
  DAY
  WEEK
  MONTH
}

// Tipo de link de atribuição
enum AttributionLinkType {
  WHATSAPP
  WEBSITE
}

// Tipo de insight
enum GrowthInsightType {
  CONVERSION_DROP      // Queda de conversão
  ACTION_SPIKE         // Pico de ações
  LOW_CONVERSION_RATE  // Taxa de conversão baixa
  CHANNEL_COMPARISON   // Comparação de canais
  WEEKLY_SUMMARY       // Resumo semanal
  GOAL_ACHIEVED        // Meta atingida
}

// Severidade do insight
enum GrowthInsightSeverity {
  INFO
  WARNING
  CRITICAL
  SUCCESS
}

// Confiança da atribuição
enum AttributionConfidence {
  HIGH    // UTM explícito
  MEDIUM  // Evento nas últimas 24h
  LOW     // Evento nas últimas 72h
  NONE    // Sem dados de atribuição
}

// Origem do orçamento
enum QuoteOriginSource {
  GOOGLE_BUSINESS
  DIRECT
  REFERRAL
  SOCIAL_MEDIA
  OTHER
  UNKNOWN
}
```

### Prisma Schema (Adições)

```prisma
// Adicionar ao schema.prisma

model GoogleIntegration {
  id                 String                    @id @default(uuid())
  userId             String                    @unique
  googleAccountId    String?
  googleLocationId   String?
  googleLocationName String?
  status             GoogleIntegrationStatus   @default(PENDING)
  scopes             String[]
  lastSyncAt         DateTime?
  lastSyncError      String?
  createdAt          DateTime                  @default(now())
  updatedAt          DateTime                  @updatedAt

  user               User                      @relation(fields: [userId], references: [id], onDelete: Cascade)
  token              GoogleToken?

  @@index([userId])
  @@index([status])
  @@map("google_integrations")
}

model GoogleToken {
  id               String             @id @default(uuid())
  integrationId    String             @unique
  accessTokenEnc   String             // Encrypted
  refreshTokenEnc  String             // Encrypted
  expiresAt        DateTime
  createdAt        DateTime           @default(now())
  updatedAt        DateTime           @updatedAt

  integration      GoogleIntegration  @relation(fields: [integrationId], references: [id], onDelete: Cascade)

  @@map("google_tokens")
}

model DemandEvent {
  id           String            @id @default(uuid())
  userId       String
  source       DemandEventSource
  actionType   DemandActionType
  occurredAt   DateTime
  periodType   DemandPeriodType
  periodStart  DateTime
  periodEnd    DateTime
  value        Int               @default(1)
  dimensions   Json?
  rawRef       String?
  createdAt    DateTime          @default(now())

  user         User              @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, source, actionType, periodType, periodStart, periodEnd])
  @@index([userId])
  @@index([userId, occurredAt])
  @@index([userId, actionType])
  @@index([userId, source, occurredAt])
  @@map("demand_events")
}

model AttributionLink {
  id          String              @id @default(uuid())
  userId      String
  slug        String              @unique
  type        AttributionLinkType
  targetUrl   String
  clickCount  Int                 @default(0)
  isActive    Boolean             @default(true)
  createdAt   DateTime            @default(now())
  updatedAt   DateTime            @updatedAt

  user        User                @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([slug])
  @@map("attribution_links")
}

model GrowthInsight {
  id              String                @id @default(uuid())
  userId          String
  type            GrowthInsightType
  severity        GrowthInsightSeverity
  title           String
  description     String
  recommendations Json                  // Array de strings
  metrics         Json?                 // Dados numéricos do insight
  isRead          Boolean               @default(false)
  isDismissed     Boolean               @default(false)
  expiresAt       DateTime?
  createdAt       DateTime              @default(now())

  user            User                  @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([userId, isRead])
  @@index([userId, createdAt])
  @@map("growth_insights")
}

// Adicionar campos ao Quote existente
model Quote {
  // ... campos existentes ...

  // Campos de atribuição
  originSource          QuoteOriginSource?
  originMedium          String?
  originCampaign        String?
  originActionType      DemandActionType?
  originConfidence      AttributionConfidence?
  originEventId         String?
}

enum GoogleIntegrationStatus {
  PENDING
  CONNECTED
  ERROR
  DISCONNECTED
  REVOKED
}

enum DemandEventSource {
  GOOGLE_BUSINESS
  TRACKING_LINK
  MANUAL
}

enum DemandActionType {
  CALL
  ROUTE
  WEBSITE_CLICK
  WHATSAPP_CLICK
  SITE_CLICK
  PROFILE_VIEW
  SEARCH_IMPRESSION
  MAPS_IMPRESSION
}

enum DemandPeriodType {
  DAY
  WEEK
  MONTH
}

enum AttributionLinkType {
  WHATSAPP
  WEBSITE
}

enum GrowthInsightType {
  CONVERSION_DROP
  ACTION_SPIKE
  LOW_CONVERSION_RATE
  CHANNEL_COMPARISON
  WEEKLY_SUMMARY
  GOAL_ACHIEVED
}

enum GrowthInsightSeverity {
  INFO
  WARNING
  CRITICAL
  SUCCESS
}

enum AttributionConfidence {
  HIGH
  MEDIUM
  LOW
  NONE
}

enum QuoteOriginSource {
  GOOGLE_BUSINESS
  DIRECT
  REFERRAL
  SOCIAL_MEDIA
  OTHER
  UNKNOWN
}
```

---

## APIs Backend

### Módulo: GoogleOAuth

#### POST /google/connect
Inicia fluxo OAuth2 com Google.

**Request:**
```typescript
// Sem body - usa userId do token JWT
```

**Response:**
```typescript
{
  authUrl: string;  // URL para redirecionar usuário
  state: string;    // State para validação CSRF
}
```

#### GET /google/callback
Callback do OAuth2 (redirecionamento do Google).

**Query params:**
```typescript
{
  code: string;   // Authorization code
  state: string;  // State para validação
}
```

**Response:**
Redireciona para `/settings/integrations?google=success` ou `?google=error`

#### GET /google/locations
Lista locations/perfis disponíveis.

**Response:**
```typescript
{
  locations: Array<{
    id: string;
    name: string;
    address: string;
    isPrimary: boolean;
  }>;
}
```

#### POST /google/select-location
Seleciona location para monitorar.

**Request:**
```typescript
{
  locationId: string;
}
```

**Response:**
```typescript
{
  success: true;
  integration: GoogleIntegration;
}
```

#### POST /google/disconnect
Desconecta e revoga tokens.

**Response:**
```typescript
{
  success: true;
}
```

#### GET /google/status
Retorna status da integração.

**Response:**
```typescript
{
  isConnected: boolean;
  status: GoogleIntegrationStatus;
  locationName?: string;
  lastSyncAt?: string;
  lastSyncError?: string;
}
```

---

### Módulo: GoogleGrowthDashboard

#### GET /growth/overview
Dashboard principal com métricas agregadas.

**Query params:**
```typescript
{
  period?: 'week' | 'month' | 'quarter';  // default: 'month'
  startDate?: string;  // ISO date
  endDate?: string;    // ISO date
}
```

**Response:**
```typescript
{
  summary: {
    totalActions: number;
    totalQuotes: number;
    conversionRate: number;
    changeVsPrevious: number;  // percentual
  };
  funnel: {
    impressions: number;
    actions: number;
    quotes: number;
    closed: number;  // orçamentos fechados
  };
  byActionType: Array<{
    type: DemandActionType;
    count: number;
    quotes: number;
    conversionRate: number;
  }>;
  trend: Array<{
    date: string;
    actions: number;
    quotes: number;
  }>;
}
```

#### GET /growth/actions
Detalhamento de ações.

**Query params:**
```typescript
{
  period?: 'week' | 'month' | 'quarter';
  actionType?: DemandActionType;
  groupBy?: 'day' | 'week' | 'month';
}
```

**Response:**
```typescript
{
  data: Array<{
    date: string;
    type: DemandActionType;
    count: number;
    source: DemandEventSource;
  }>;
  totals: Record<DemandActionType, number>;
}
```

#### GET /growth/attribution
Orçamentos por origem.

**Query params:**
```typescript
{
  period?: 'week' | 'month' | 'quarter';
}
```

**Response:**
```typescript
{
  bySource: Array<{
    source: QuoteOriginSource;
    count: number;
    value: number;
    conversionRate: number;
  }>;
  byActionType: Array<{
    actionType: DemandActionType;
    count: number;
    value: number;
    avgConfidence: number;
  }>;
  recentQuotes: Array<{
    id: string;
    clientName: string;
    value: number;
    origin: QuoteOriginSource;
    actionType?: DemandActionType;
    confidence: AttributionConfidence;
    createdAt: string;
  }>;
}
```

#### GET /growth/insights
Lista insights gerados.

**Query params:**
```typescript
{
  includeRead?: boolean;   // default: false
  includeDismissed?: boolean;  // default: false
  limit?: number;  // default: 10
}
```

**Response:**
```typescript
{
  insights: Array<{
    id: string;
    type: GrowthInsightType;
    severity: GrowthInsightSeverity;
    title: string;
    description: string;
    recommendations: string[];
    metrics?: Record<string, number>;
    createdAt: string;
  }>;
  unreadCount: number;
}
```

#### PATCH /growth/insights/:id/read
Marca insight como lido.

#### PATCH /growth/insights/:id/dismiss
Descarta insight.

---

### Módulo: AttributionLinks

#### GET /attribution/links
Lista links de atribuição do usuário.

**Response:**
```typescript
{
  links: Array<{
    id: string;
    type: AttributionLinkType;
    slug: string;
    fullUrl: string;
    targetUrl: string;
    clickCount: number;
    isActive: boolean;
    createdAt: string;
  }>;
}
```

#### POST /attribution/links
Cria novo link de atribuição.

**Request:**
```typescript
{
  type: 'WHATSAPP' | 'WEBSITE';
  targetUrl?: string;  // Para WEBSITE. Para WHATSAPP, usa telefone do settings
}
```

**Response:**
```typescript
{
  link: AttributionLink;
  fullUrl: string;
}
```

#### DELETE /attribution/links/:id
Desativa link de atribuição.

---

### Tracking Endpoints (Públicos)

#### GET /wpp/:slug
Tracking de clique WhatsApp.

**Flow:**
1. Valida slug
2. Busca AttributionLink
3. Registra DemandEvent (WHATSAPP_CLICK)
4. Incrementa clickCount
5. Redireciona 302 para wa.me

**Response:** HTTP 302 Redirect

#### GET /go/:slug
Tracking de clique Website.

**Query params:**
```typescript
{
  to?: 'site';  // Tipo de destino
}
```

**Flow:**
1. Valida slug
2. Busca AttributionLink
3. Registra DemandEvent (SITE_CLICK)
4. Incrementa clickCount
5. Redireciona 302 para targetUrl

**Response:** HTTP 302 Redirect

---

## Jobs e Coleta de Métricas

### GoogleMetricsSyncJob

**Frequência:** Diário às 03:00 UTC

**Processo:**
```
1. Buscar todas GoogleIntegrations com status CONNECTED
2. Para cada integração:
   a. Verificar/renovar token se necessário
   b. Buscar métricas dos últimos 30 dias (diário)
   c. Buscar métricas das últimas 12 semanas (semanal)
   d. Buscar métricas dos últimos 12 meses (mensal)
   e. Upsert DemandEvents (idempotente por chave natural)
   f. Atualizar lastSyncAt
3. Em caso de erro:
   a. Registrar lastSyncError
   b. Se token inválido, atualizar status para ERROR/REVOKED
   c. Notificar usuário (email/push)
4. Gerar insights baseados nos dados coletados
```

**Métricas coletadas:**
- `METRIC_CALLS` → CALL
- `METRIC_DIRECTION_REQUESTS` → ROUTE
- `METRIC_WEBSITE_CLICKS` → WEBSITE_CLICK
- `METRIC_BUSINESS_IMPRESSIONS_DESKTOP_SEARCH` → SEARCH_IMPRESSION
- `METRIC_BUSINESS_IMPRESSIONS_MOBILE_SEARCH` → SEARCH_IMPRESSION
- `METRIC_BUSINESS_IMPRESSIONS_DESKTOP_MAPS` → MAPS_IMPRESSION
- `METRIC_BUSINESS_IMPRESSIONS_MOBILE_MAPS` → MAPS_IMPRESSION

**Idempotência:**
```sql
-- Chave natural para upsert
UNIQUE(userId, source, actionType, periodType, periodStart, periodEnd)
```

**Retry Policy:**
- Exponential backoff: 1min, 5min, 15min, 1h
- Max 4 tentativas por integração
- Circuit breaker por tenant após 3 falhas consecutivas

### InsightsGeneratorJob

**Frequência:** Diário às 06:00 UTC (após sync)

**Regras implementadas:**

1. **Queda Brusca de Ligações**
   ```
   IF calls_this_week < calls_last_week * 0.7
   THEN create CONVERSION_DROP insight (WARNING)
   ```

2. **Baixa Taxa de Conversão**
   ```
   IF total_actions > 50 AND quotes / actions < 0.05
   THEN create LOW_CONVERSION_RATE insight (WARNING)
   ```

3. **WhatsApp Converte Melhor**
   ```
   IF whatsapp_conversion_rate > call_conversion_rate * 1.5
   THEN create CHANNEL_COMPARISON insight (INFO)
   ```

4. **Pico de Ações**
   ```
   IF actions_today > avg_daily_actions * 2
   THEN create ACTION_SPIKE insight (INFO)
   ```

5. **Meta Atingida**
   ```
   IF quotes_this_month >= monthly_goal
   THEN create GOAL_ACHIEVED insight (SUCCESS)
   ```

---

## Tracking de Links

### Geração de Slugs

```typescript
// Formato: {prefixo}_{random}
// Exemplo: wpp_a1b2c3d4, site_x9y8z7w6

function generateSlug(type: AttributionLinkType): string {
  const prefix = type === 'WHATSAPP' ? 'wpp' : 'site';
  const random = nanoid(8);
  return `${prefix}_${random}`;
}
```

### Rate Limiting

```typescript
// Por IP + Tenant
ThrottlerModule.forRoot([
  {
    name: 'tracking',
    ttl: 60000,    // 1 minuto
    limit: 30      // 30 requests/minuto por IP
  }
])
```

### Anti-Abuse

- Validação de slug no banco
- Log de IPs suspeitos (muitos cliques)
- Honeypot para bots (parâmetro oculto)
- Bloqueio temporário após 100 cliques/hora

---

## Atribuição

### Fluxo de Atribuição

```
1. Ao criar orçamento:
   a. Verificar UTMs na requisição (utm_source, utm_medium, utm_campaign)
   b. Se tem UTM google_business:
      - originSource = GOOGLE_BUSINESS
      - originConfidence = HIGH
   c. Se não tem UTM:
      - Buscar DemandEvents das últimas 72h
      - Se encontrou nas últimas 24h: confidence = MEDIUM
      - Se encontrou entre 24-72h: confidence = LOW
      - Associar evento mais recente
   d. Salvar campos origin* no Quote
```

### Janela de Atribuição

| Intervalo | Confiança | Descrição |
|-----------|-----------|-----------|
| 0-24h | HIGH/MEDIUM | Atribuição provável |
| 24-48h | MEDIUM | Atribuição possível |
| 48-72h | LOW | Atribuição incerta |
| >72h | NONE | Sem atribuição |

---

## Engine de Insights

### Arquitetura

```typescript
// InsightsEngine
class InsightsEngine {
  private rules: InsightRule[];

  async generateInsights(userId: string): Promise<GrowthInsight[]> {
    const metrics = await this.fetchMetrics(userId);
    const insights: GrowthInsight[] = [];

    for (const rule of this.rules) {
      const result = await rule.evaluate(metrics);
      if (result) {
        insights.push(result);
      }
    }

    return insights;
  }
}

// Interface de regra
interface InsightRule {
  name: string;
  evaluate(metrics: Metrics): Promise<GrowthInsight | null>;
}
```

### Métricas Disponíveis

```typescript
interface Metrics {
  // Ações
  calls: { current: number; previous: number; trend: number[] };
  routes: { current: number; previous: number; trend: number[] };
  websiteClicks: { current: number; previous: number; trend: number[] };
  whatsappClicks: { current: number; previous: number; trend: number[] };

  // Conversão
  quotes: { current: number; previous: number };
  closedQuotes: { current: number; previous: number };

  // Taxas
  conversionRate: number;
  conversionByChannel: Record<DemandActionType, number>;

  // Período
  periodStart: Date;
  periodEnd: Date;
}
```

---

## Telas Web

### Estrutura de Rotas

```
/settings/integrations           # Conexão Google
/reports/growth                  # Layout com tabs
/reports/growth/overview         # Dashboard principal
/reports/growth/actions          # Detalhamento de ações
/reports/growth/attribution      # Atribuição de leads
/reports/growth/insights         # Lista de insights
/reports/growth/links            # Gerenciar links de tracking
```

### Componentes a Reutilizar

| Componente | Localização | Uso |
|------------|-------------|-----|
| KpiCard | `/components/reports/` | Cards de métricas |
| LineChart | `/components/reports/` | Gráfico de tendência |
| PieChart | `/components/reports/` | Distribuição por canal |
| Badge | `/components/ui/` | Status e labels |
| Card | `/components/ui/` | Containers |
| Button | `/components/ui/` | Ações |
| Skeleton | `/components/ui/` | Loading states |
| Alert | `/components/ui/` | Insights e avisos |

### Wireframes

#### Overview
```
┌─────────────────────────────────────────────────────────────┐
│  Crescimento (Google Business)                    [Período ▼]│
├─────────────────────────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐            │
│ │ Ações   │ │ Orçam.  │ │ Taxa    │ │ vs Ant. │            │
│ │ 234     │ │ 18      │ │ 7.7%    │ │ +12%    │            │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘            │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐│
│ │              FUNIL DE CONVERSÃO                         ││
│ │  Visualizações → Ações → Orçamentos → Fechamentos      ││
│ │     1.2k          234       18           12             ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌──────────────────────┐ ┌────────────────────────────────┐│
│ │ Por Canal            │ │ Tendência (30 dias)           ││
│ │ ● Ligações     45%   │ │ [====LINE CHART====]          ││
│ │ ● WhatsApp     30%   │ │                               ││
│ │ ● Rotas        15%   │ │                               ││
│ │ ● Site         10%   │ │                               ││
│ └──────────────────────┘ └────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

#### Insights
```
┌─────────────────────────────────────────────────────────────┐
│  Insights                                     [Mostrar: Todos]│
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐│
│ │ ⚠️ Queda nas Ligações                        [Descartar]││
│ │ Suas ligações caíram 35% esta semana.                   ││
│ │                                                         ││
│ │ Recomendações:                                          ││
│ │ • Verifique se o número está correto no perfil          ││
│ │ • Considere adicionar WhatsApp como alternativa         ││
│ │ • Responda ligações perdidas rapidamente                ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ ℹ️ WhatsApp Converte Melhor                  [Descartar]││
│ │ Taxa de conversão do WhatsApp é 2x maior que ligações.  ││
│ │                                                         ││
│ │ Recomendações:                                          ││
│ │ • Destaque o botão de WhatsApp no seu perfil            ││
│ │ • Use o link de tracking para medir melhor              ││
│ └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## Telas Mobile

### Estrutura

```
Mais → Crescimento (Google)
  ├── Cards da semana
  ├── Gráfico simples
  ├── Insights (3 mais recentes)
  └── Links de tracking
```

### Layout Mobile

```
┌─────────────────────────┐
│ ← Crescimento           │
├─────────────────────────┤
│ Esta semana             │
│ ┌─────────┬─────────┐  │
│ │ 📞 45   │ 💬 32   │  │
│ │ Ligações│WhatsApp │  │
│ ├─────────┼─────────┤  │
│ │ 🗺️ 28   │ 🌐 15   │  │
│ │ Rotas   │ Site    │  │
│ └─────────┴─────────┘  │
│                         │
│ Orçamentos: 8 (+12%)    │
│ [======BAR CHART======] │
│                         │
│ ─────────────────────── │
│ 💡 Insights             │
│ ┌─────────────────────┐│
│ │ ⚠️ Queda ligações   ││
│ │ -35% esta semana    ││
│ │            [Ver →]  ││
│ └─────────────────────┘│
│                         │
│ ─────────────────────── │
│ 🔗 Seus Links           │
│ ┌─────────────────────┐│
│ │ WhatsApp  [Copiar]  ││
│ │ Site      [Copiar]  ││
│ └─────────────────────┘│
│                         │
│ [Como configurar ↗]     │
└─────────────────────────┘
```

### Componentes Mobile

| Componente | Localização | Uso |
|------------|-------------|-----|
| Card | `/src/design-system/` | Containers |
| Button | `/src/design-system/` | Ações |
| Text | `/src/design-system/` | Tipografia |
| Badge | `/src/design-system/` | Labels |
| Skeleton | `/src/design-system/` | Loading |

---

## Segurança

### Armazenamento de Tokens

```typescript
// Tokens OAuth criptografados em repouso
// Usando módulo de encryption existente

class GoogleTokenService {
  constructor(private encryptionService: EncryptionService) {}

  async storeToken(integrationId: string, tokens: OAuthTokens) {
    const accessTokenEnc = this.encryptionService.encrypt(tokens.access_token);
    const refreshTokenEnc = this.encryptionService.encrypt(tokens.refresh_token);

    await this.prisma.googleToken.upsert({
      where: { integrationId },
      create: {
        integrationId,
        accessTokenEnc,
        refreshTokenEnc,
        expiresAt: new Date(tokens.expiry_date),
      },
      update: {
        accessTokenEnc,
        refreshTokenEnc,
        expiresAt: new Date(tokens.expiry_date),
      },
    });
  }
}
```

### Scopes OAuth

```typescript
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/business.manage',  // Gerenciar perfil
];

// NÃO solicitar scopes extras não necessários
```

### Validações

- CSRF state no OAuth callback
- Validação de tenant em todas as rotas
- Rate limiting em tracking endpoints
- Sanitização de URLs de redirect
- Logs sem tokens ou PII

---

## Observabilidade

### Logs Estruturados

```typescript
// Formato de log
{
  level: 'info',
  message: 'Google metrics sync completed',
  context: 'GoogleMetricsSyncJob',
  correlationId: 'uuid',
  userId: 'uuid',
  locationId: 'string',
  metricsCount: 42,
  durationMs: 1234,
  timestamp: 'ISO8601'
}
```

### Métricas (Sentry)

- `google.sync.duration` - Duração da sincronização
- `google.sync.success` - Taxa de sucesso
- `google.sync.errors` - Contagem de erros
- `tracking.clicks` - Cliques nos links
- `insights.generated` - Insights gerados

### Alertas

| Alerta | Condição | Ação |
|--------|----------|------|
| Sync Failed | 3 falhas consecutivas | Email + Slack |
| Token Expired | Token não renovável | Email ao usuário |
| High Error Rate | >10% erros/hora | Slack |
| Quota Exceeded | API quota Google | Slack + pausar sync |

---

## Plano de Testes

### Unit Tests

```typescript
// google-oauth.service.spec.ts
describe('GoogleOAuthService', () => {
  it('should generate valid auth URL with correct scopes');
  it('should exchange code for tokens');
  it('should refresh expired tokens');
  it('should handle revoked tokens');
  it('should encrypt tokens before storage');
});

// google-metrics.service.spec.ts
describe('GoogleMetricsService', () => {
  it('should fetch metrics for date range');
  it('should upsert events idempotently');
  it('should handle API errors gracefully');
  it('should respect rate limits');
});

// attribution.service.spec.ts
describe('AttributionService', () => {
  it('should attribute with UTM (HIGH confidence)');
  it('should attribute recent events (MEDIUM confidence)');
  it('should return NONE when no events found');
  it('should use correct time windows');
});

// insights-engine.spec.ts
describe('InsightsEngine', () => {
  it('should detect conversion drop');
  it('should detect low conversion rate');
  it('should compare channels');
  it('should not duplicate insights');
});

// tracking.controller.spec.ts
describe('TrackingController', () => {
  it('should redirect to WhatsApp with valid slug');
  it('should redirect to website with valid slug');
  it('should return 404 for invalid slug');
  it('should respect rate limits');
  it('should register demand event');
});
```

### Integration Tests

```typescript
// google-sync.integration.spec.ts
describe('Google Sync Pipeline', () => {
  it('should complete full sync cycle');
  it('should handle partial failures');
  it('should update integration status');
});

// dashboard.integration.spec.ts
describe('Growth Dashboard', () => {
  it('should return correct funnel metrics');
  it('should filter by date range');
  it('should aggregate by action type');
});
```

### E2E Tests

```typescript
// google-flow.e2e.spec.ts
describe('Google Integration Flow', () => {
  it('should complete OAuth flow');
  it('should select location');
  it('should show metrics after sync');
  it('should disconnect and clear data');
});
```

---

## Rollout

### Feature Flags

```typescript
// FeatureFlag: GOOGLE_GROWTH_ENABLED
// Controlado por tenant

const isEnabled = await featureFlags.isEnabled(
  'GOOGLE_GROWTH_ENABLED',
  { userId }
);
```

### Fases de Rollout

| Fase | % Usuários | Duração | Critérios |
|------|-----------|---------|-----------|
| Alpha | 1% | 1 semana | Usuários internos |
| Beta | 10% | 2 semanas | Early adopters |
| GA | 100% | - | Todos |

### Rollback Plan

1. Desabilitar feature flag
2. Jobs continuam mas não processam
3. Dados permanecem para análise
4. UI mostra mensagem "Em manutenção"

---

## Guia de Configuração

### Para o Usuário Final

#### Passo 1: Conectar conta Google
1. Acesse **Configurações > Integrações**
2. Clique em **Conectar Google Business**
3. Faça login com sua conta Google
4. Autorize o acesso ao seu perfil comercial

#### Passo 2: Selecionar perfil
1. Escolha o perfil/unidade que deseja monitorar
2. Confirme a seleção

#### Passo 3: Configurar links de tracking
1. Acesse **Crescimento > Links**
2. Copie o link de WhatsApp
3. Copie o link do Site (se aplicável)

#### Passo 4: Atualizar seu Perfil do Google
1. Acesse [Google Business Profile](https://business.google.com)
2. Edite seu perfil
3. No campo **WhatsApp**, cole o link copiado
4. No campo **Site**, cole o link copiado
5. Salve as alterações

#### Passo 5: Aguardar dados
- Métricas do Google são atualizadas diariamente
- Cliques nos links aparecem em tempo real
- Insights são gerados automaticamente

### Para Desenvolvedores

#### Variáveis de Ambiente

```env
# Google OAuth
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=https://api.yourapp.com/google/callback

# Feature Flag
GOOGLE_GROWTH_ENABLED=true
```

#### Comandos de Migração

```bash
# Criar migration
npx prisma migrate dev --name add_google_growth_tables

# Aplicar em produção
npx prisma migrate deploy

# Rollback (se necessário)
npx prisma migrate resolve --rolled-back add_google_growth_tables
```

---

## Changelog

### v1.0.0 (MVP)
- [ ] OAuth com Google Business Profile
- [ ] Coleta de métricas (calls, routes, clicks)
- [ ] Links de tracking (WhatsApp, Site)
- [ ] Dashboard Web com funil
- [ ] Tela mobile simplificada
- [ ] Engine de insights básica
- [ ] Atribuição de orçamentos

### v1.1.0 (Planejado)
- [ ] Inbox de Reviews
- [ ] Notificações de review novo
- [ ] Score de perfil

### v1.2.0 (Planejado)
- [ ] Posts agendados
- [ ] Respostas automáticas a reviews

---

## Referências

- [Google Business Profile API](https://developers.google.com/my-business/reference/rest)
- [Business Profile Performance API](https://developers.google.com/my-business/reference/performance/rest)
- [OAuth 2.0 for Web Server Apps](https://developers.google.com/identity/protocols/oauth2/web-server)
