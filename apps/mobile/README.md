# ProDesign Mobile

Aplicativo mobile React Native + Expo para gestão de autônomos.

## Arquitetura

```
apps/mobile/
├── app/                      # Expo Router - Telas e navegação
│   ├── (auth)/              # Stack de autenticação
│   │   ├── _layout.tsx
│   │   └── login.tsx
│   ├── (tabs)/              # Tabs principais
│   │   ├── _layout.tsx
│   │   ├── index.tsx        # Home/Dashboard
│   │   ├── agenda.tsx       # Agenda/Calendário
│   │   ├── os.tsx           # Ordens de Serviço
│   │   ├── clientes.tsx     # Clientes
│   │   └── mais.tsx         # Menu Mais
│   └── _layout.tsx          # Root Layout com providers
│
├── src/
│   ├── design-system/       # ProDesign Design System
│   │   ├── tokens.ts        # Cores, tipografia, espaçamento
│   │   ├── ThemeProvider.tsx
│   │   ├── components/      # Text, Button, Input, Card, Badge, Avatar, etc.
│   │   └── index.ts
│   │
│   ├── db/                  # Banquinho - Banco local SQLite
│   │   ├── schema.ts        # Schema das tabelas
│   │   ├── database.ts      # Manager do SQLite
│   │   ├── repositories/    # Repositórios por entidade
│   │   └── index.ts
│   │
│   ├── sync/                # Engine de Sincronização 2-vias
│   │   ├── types.ts         # Tipos do sistema de sync
│   │   ├── SyncEngine.ts    # Motor de sincronização
│   │   ├── useSyncStatus.ts # Hook React para status
│   │   └── index.ts
│   │
│   ├── queue/               # Fila de mutações offline
│   │   ├── MutationQueue.ts
│   │   └── index.ts
│   │
│   ├── services/            # Serviços da aplicação
│   │   ├── AuthService.ts   # Autenticação com SecureStore
│   │   ├── AuthProvider.tsx # Provider de autenticação
│   │   └── index.ts
│   │
│   ├── components/          # Componentes customizados
│   │   ├── OptimizedList.tsx # FlatList otimizada para 100k registros
│   │   └── index.ts
│   │
│   ├── modules/             # Módulos de funcionalidades
│   │   ├── clientes/
│   │   ├── os/
│   │   ├── orcamentos/
│   │   └── faturas/
│   │
│   ├── entities/            # Entidades de sync (configs)
│   ├── types/               # Tipos TypeScript globais
│   └── config/              # Configurações do app
│
├── __tests__/               # Testes unitários
│   ├── design-system/
│   ├── db/
│   ├── sync/
│   ├── queue/
│   └── services/
│
└── assets/                  # Imagens e fontes
```

## Principais Tecnologias

- **React Native 0.73** + **Expo 50**
- **Expo Router** - Navegação file-based
- **TypeScript** - Tipagem estática
- **SQLite** (expo-sqlite) - Banco local
- **SecureStore** - Armazenamento seguro de tokens
- **Jest** + **React Native Testing Library** - Testes

## Design System ProDesign

O design system é idêntico ao webapp, garantindo consistência visual:

```typescript
import { Text, Button, Input, Card, Badge, Avatar } from '@/design-system';

// Uso
<Text variant="h1">Título</Text>
<Button variant="primary" size="lg">Ação</Button>
<Card variant="elevated">Conteúdo</Card>
```

### Tokens disponíveis

- **colors**: primary, secondary, success, warning, error, info + semantic (background, text, border)
- **typography**: fontFamily, fontSize, fontWeight, lineHeight
- **spacing**: 0-32 (baseado em 4px)
- **borderRadius**: none, sm, default, md, lg, xl, 2xl, 3xl, full
- **shadows**: none, sm, default, md, lg, xl

## Banco de Dados Local (Banquinho)

SQLite otimizado para 100k+ registros:

```typescript
import { ClientRepository } from '@/db';

// Buscar com paginação
const { data, total, pages } = await ClientRepository.getPaginated(technicianId, 1, 50);

// Busca textual
const results = await ClientRepository.search(technicianId, 'João');
```

### Tabelas

- `clients` - Clientes
- `work_orders` - Ordens de Serviço
- `quotes` - Orçamentos
- `invoices` - Faturas
- `checklist_templates` - Templates de checklists
- `checklist_instances` - Instâncias de checklists (vinculadas a OS)
- `checklist_answers` - Respostas das perguntas
- `checklist_attachments` - Fotos, arquivos, assinaturas
- `signatures` - Assinaturas digitais
- `upload_queue` - Fila de uploads de mídia
- `sync_meta` - Metadados de sincronização
- `mutations_queue` - Fila de mutações offline

## Sincronização 2-vias

O SyncEngine gerencia a sincronização bidirecional:

```typescript
import { syncEngine, useSyncStatus } from '@/sync';

// Configurar
syncEngine.configure({
  baseUrl: 'https://api.prodesign.com',
  authToken: 'jwt-token',
  technicianId: 'tech-123',
});

// Registrar entidade
syncEngine.registerEntity({
  name: 'clients',
  tableName: 'clients',
  apiEndpoint: '/api/sync/clients',
  apiMutationEndpoint: '/api/sync/clients/mutations',
  cursorField: 'updatedAt',
  primaryKeys: ['id'],
  scopeField: 'technicianId',
  batchSize: 100,
  conflictResolution: 'last_write_wins',
});

// Sincronizar
await syncEngine.syncAll();

// Hook React
const { isSyncing, isOnline, pendingCount, sync } = useSyncStatus();
```

### Características

- **Delta sync** com cursores
- **Paginação** para grandes volumes
- **Fila de mutações** offline
- **Resolução de conflitos** (last-write-wins)
- **Escopo por técnico**

## Fila de Mutações

Operações offline são enfileiradas e sincronizadas quando online:

```typescript
import { MutationQueue } from '@/queue';

// Enfileirar mutação
await MutationQueue.enqueue('clients', 'client-123', 'create', { name: 'João' });

// Verificar pendentes
const count = await MutationQueue.countPending();
```

## Autenticação

SecureStore para armazenamento seguro:

```typescript
import { useAuth } from '@/services';

const { user, isAuthenticated, login, logout } = useAuth();

await login('email@example.com', 'senha');
```

## Lista Otimizada

Para listas com muitos itens:

```typescript
import { OptimizedList } from '@/components';

<OptimizedList
  data={clients}
  renderItem={({ item }) => <ClientCard client={item} />}
  keyExtractor={(item) => item.id}
  onLoadMore={loadMore}
  onRefresh={refresh}
  isLoading={isLoading}
  hasMore={hasMore}
  estimatedItemSize={80}
/>
```

## Scripts

```bash
# Desenvolvimento
npm run dev

# Testes
npm test
npm run test:watch
npm run test:coverage

# Build
npm run build

# Plataformas
npm run android
npm run ios
```

## Módulo de Clientes

### ClientService

Serviço offline-first para gerenciamento de clientes:

```typescript
import { ClientService } from '@/modules/clients/ClientService';

// Configurar
ClientService.configure('tech-123');

// Listar com paginação
const { data, total, pages } = await ClientService.listClients(1, 50);

// Buscar (local primeiro, fallback para API)
const { data, isLocal } = await ClientService.searchClients('João', 50);

// CRUD offline-first
await ClientService.createClient({ name: 'João Silva', phone: '11999999999' });
await ClientService.updateClient('client-id', { name: 'João Santos' });
await ClientService.deleteClient('client-id'); // soft delete
```

### Telas de Clientes

- `app/(tabs)/clientes.tsx` - Lista com busca e infinite scroll
- `app/clientes/novo.tsx` - Formulário de criação
- `app/clientes/[id].tsx` - Detalhes e edição

### Configuração de Sync

```typescript
// src/sync/entities/ClientSyncConfig.ts
export const ClientSyncConfig: SyncEntityConfig<SyncClient> = {
  name: 'clients',
  tableName: 'clients',
  apiEndpoint: '/clients/sync',
  apiMutationEndpoint: '/clients/sync/mutations',
  cursorField: 'updatedAt',
  primaryKeys: ['id'],
  scopeField: 'technicianId',
  batchSize: 100,
  conflictResolution: 'last_write_wins',
};
```

## Módulo de Ordens de Serviço

### WorkOrderService

Serviço offline-first para gerenciamento de Ordens de Serviço:

```typescript
import { workOrderService } from '@/modules/workorders';

// Configurar
workOrderService.setTechnicianId('tech-123');

// Buscar OS do dia (agenda)
const orders = await workOrderService.getWorkOrdersForDay('2024-01-15');

// Buscar por intervalo de datas
const weekOrders = await workOrderService.getWorkOrdersForDateRange('2024-01-15', '2024-01-21');

// Listar com filtros
const { items, total, hasMore } = await workOrderService.listWorkOrders(
  { status: 'SCHEDULED', searchQuery: 'manutenção' },
  { limit: 20, offset: 0 }
);

// Mudança de status (offline-first)
await workOrderService.startWorkOrder('wo-id');    // SCHEDULED -> IN_PROGRESS
await workOrderService.completeWorkOrder('wo-id'); // IN_PROGRESS -> DONE
await workOrderService.cancelWorkOrder('wo-id');   // -> CANCELED
```

### Status de Ordens de Serviço

| Status | Descrição | Transições Permitidas |
|--------|-----------|----------------------|
| `SCHEDULED` | Agendada | IN_PROGRESS, CANCELED |
| `IN_PROGRESS` | Em Andamento | DONE, CANCELED |
| `DONE` | Concluída | (terminal) |
| `CANCELED` | Cancelada | (terminal) |

### Regras de Negócio

- **OS DONE ou CANCELED não podem ser editadas**
- **OS IN_PROGRESS ou DONE não podem ser excluídas**
- **Transições de status são validadas**
- **Timestamps de execução são preenchidos automaticamente**

### Telas de Ordens de Serviço

- `WorkOrdersListScreen` - Lista com busca, filtro por status, paginação
- `WorkOrderDetailScreen` - Detalhes, mudança de status, info do cliente
- `AgendaScreen` - Navegação por dia/semana

## Módulo de Agenda

### AgendaScreen

Tela de agenda navegável:

```typescript
import { AgendaScreen } from '@/modules/agenda';

<AgendaScreen
  onWorkOrderPress={(wo) => navigation.navigate('WorkOrderDetail', { id: wo.id })}
  onSync={() => syncEngine.syncEntity('work_order')}
/>
```

### Características

- **Navegação por dia ou semana**
- **Setas para avançar/voltar**
- **Consulta DB local por intervalo de datas**
- **Pull to refresh para sincronizar**
- **Funciona completamente offline**
- **Indicadores visuais de status (cores do Design System)**

### Estratégia de Escopo de OS

O app usa escopo por janela de datas para não baixar 100k+ OS:

| Scope | Descrição |
|-------|-----------|
| `date_range` | -30 a +60 dias (padrão) |
| `assigned` | Apenas OS do técnico |
| `all` | Todas (não recomendado) |

### Sync de Ordens de Serviço

```typescript
// Backend endpoints
GET  /work-orders/sync            // Pull com delta, cursor, scope
POST /work-orders/sync/mutations  // Push batch com idempotência

// Parâmetros do Pull
{
  since: '2024-01-01T00:00:00Z',  // Delta sync
  cursor: 'base64...',            // Paginação
  limit: 100,                     // Max 500
  scope: 'date_range',            // all, assigned, date_range
  startDate: '2024-01-01',        // Para date_range
  endDate: '2024-03-01'           // Para date_range
}
```

## Testes

244 testes unitários cobrindo:

- Design System (tokens, componentes)
- Database Schema
- MutationQueue
- AuthService
- Sync Types
- SyncEngine (pagination, delta, push batch)
- ClientService (CRUD, offline queue)
- ClientesScreen (smoke tests)

```bash
npm test
```

## Estratégia de Escopo de Clientes

O web pode ter 100k+ clientes. Para não sobrecarregar o app, usamos estratégias de escopo:

| Scope | Descrição |
|-------|-----------|
| `all` | Todos os clientes (não recomendado para produção) |
| `recent` | Clientes modificados nos últimos 90 dias |
| `assigned` | Clientes com ordens de serviço do técnico |

O app usa `recent` por padrão, combinado com busca online para clientes não sincronizados.

## Testando Offline

### Como testar o funcionamento offline:

1. **Abra o app e faça login**
2. **Desligue o Wi-Fi/dados móveis**
3. **Crie um novo cliente** - deve funcionar normalmente
4. **Edite um cliente existente**
5. **Verifique o badge "Pendente"** na lista
6. **Ligue a internet**
7. **Aguarde a sincronização automática** (ou pull-to-refresh)
8. **Verifique no web** que as alterações aparecem

### Indicadores visuais:
- 🟢 **Online** - Conectado ao servidor
- 🔴 **Offline** - Sem conexão
- 🟡 **Pendente** - Mutações aguardando sync

## Backend Endpoints (Sync)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/clients/sync` | Pull com delta, cursor, scope |
| POST | `/clients/sync/mutations` | Push batch com idempotência |
| GET | `/clients/search?q=` | Busca online (fallback) |

### Parâmetros do Pull:
- `since` - ISO date para delta sync
- `cursor` - Cursor de paginação
- `limit` - Registros por página (max 500)
- `scope` - all, recent, assigned

## Módulo de Checklists

### ChecklistService

Serviço offline-first para gerenciamento de checklists avançados:

```typescript
import { checklistService, ChecklistRenderer, SignaturePad } from '@/modules/checklists';

// Criar instância de checklist para uma OS
const { data: instance } = await checklistService.createInstance({
  workOrderId: 'wo-123',
  templateId: 'template-abc',
  technicianId: 'tech-123',
});

// Salvar resposta
await checklistService.saveAnswer({
  instanceId: instance.id,
  questionId: 'q1',
  type: 'TEXT_SHORT',
  value: 'Resposta do técnico',
});

// Completar checklist
await checklistService.updateInstanceStatus(instance.id, 'COMPLETED', 'tech-123');
```

### Tipos de Perguntas Suportados

| Tipo | Descrição |
|------|-----------|
| `TEXT_SHORT` | Texto curto (até 255 caracteres) |
| `TEXT_LONG` | Texto longo (textarea) |
| `NUMBER` | Valor numérico |
| `DATE` | Data |
| `TIME` | Hora |
| `DATETIME` | Data e hora |
| `CHECKBOX` | Sim/Não (switch) |
| `SELECT` | Seleção única |
| `MULTI_SELECT` | Seleção múltipla |
| `PHOTO_REQUIRED` | Foto obrigatória |
| `PHOTO_OPTIONAL` | Foto opcional |
| `FILE_UPLOAD` | Upload de arquivo |
| `SIGNATURE_TECHNICIAN` | Assinatura do técnico |
| `SIGNATURE_CLIENT` | Assinatura do cliente |
| `SECTION_TITLE` | Título de seção |
| `RATING` | Avaliação (estrelas/números/emoji) |
| `SCALE` | Escala numérica |

### Lógica Condicional

Perguntas podem ter lógica condicional para mostrar/esconder baseado em respostas:

```typescript
// Exemplo: mostrar pergunta q2 apenas se q1 = "sim"
{
  conditionalLogic: {
    rules: [{
      questionId: 'q1',
      operator: 'EQUALS',
      value: 'sim',
      action: 'SHOW'
    }],
    logic: 'AND' // ou 'OR'
  }
}
```

**Operadores suportados:**
- `EQUALS`, `NOT_EQUALS`
- `GREATER_THAN`, `LESS_THAN`, `GREATER_THAN_OR_EQUAL`, `LESS_THAN_OR_EQUAL`
- `CONTAINS`, `NOT_CONTAINS`
- `IS_EMPTY`, `IS_NOT_EMPTY`
- `IN`, `NOT_IN`

**Ações suportadas:**
- `SHOW` - Mostrar pergunta
- `HIDE` - Esconder pergunta
- `REQUIRE` - Tornar obrigatória
- `SKIP_TO` - Pular para pergunta/seção

### ChecklistRenderer

Componente para renderizar checklist completo:

```tsx
import { ChecklistRenderer } from '@/modules/checklists';

<ChecklistRenderer
  instance={checklistInstance}
  answers={answers}
  onAnswerChange={(questionId, value) => handleAnswer(questionId, value)}
  onComplete={() => handleComplete()}
  onSave={() => handleSave()}
  showProgress={true}
/>
```

### SignaturePad

Componente de captura de assinatura digital:

```tsx
import { SignaturePad } from '@/modules/checklists';

<SignaturePad
  visible={showSignature}
  onClose={() => setShowSignature(false)}
  onCapture={(data) => {
    // data.signerName, data.signerRole, data.signatureBase64
    saveSignature(data);
  }}
  defaultSignerName="João Silva"
  defaultSignerRole="Cliente"
  requireDocument={true}
  title="Assinatura do Cliente"
/>
```

### Upload Queue (Mídia Resiliente)

Fila de uploads para fotos e assinaturas com retry automático:

```typescript
import { getUploadQueueService } from '@/modules/checklists';

const uploadQueue = getUploadQueueService('https://api.prodesign.com');
uploadQueue.setAuthToken(authToken);

// Enfileirar upload
await uploadQueue.enqueue({
  entityType: 'checklist_attachment',
  entityId: attachment.id,
  filePath: '/path/to/photo.jpg',
  fileName: 'photo.jpg',
  mimeType: 'image/jpeg',
  fileSize: 1024000,
});

// Monitorar progresso
uploadQueue.subscribe((event) => {
  if (event.type === 'upload_progress') {
    console.log(`${event.data.progress}% uploaded`);
  }
});

// Stats da fila
const stats = uploadQueue.getStats();
// { pending: 3, uploading: 1, completed: 10, failed: 0 }
```

### Status de Instância

| Status | Descrição | Transições |
|--------|-----------|------------|
| `PENDING` | Não iniciado | IN_PROGRESS, CANCELLED |
| `IN_PROGRESS` | Em preenchimento | COMPLETED, CANCELLED |
| `COMPLETED` | Finalizado | (terminal) |
| `CANCELLED` | Cancelado | (terminal) |

## Testes

293 testes unitários cobrindo:

- Design System (tokens, componentes)
- Database Schema
- MutationQueue
- AuthService
- Sync Types
- SyncEngine (pagination, delta, push batch)
- ClientService (CRUD, offline queue)
- ClientesScreen (smoke tests)
- WorkOrderService e WorkOrderSyncConfig
- **ConditionalLogicEvaluator** (lógica condicional de checklists)
- **ChecklistService** (CRUD, status transitions, attachments)

```bash
npm test
```

## Próximos Passos

1. ~~Implementar telas de CRUD completas~~ ✅ (Clientes)
2. ~~Integrar assinatura digital~~ ✅ (SignaturePad)
3. ~~Implementar checklists avançados~~ ✅ (ChecklistRenderer)
4. Configurar push notifications
5. Implementar geração de PDF
6. Adicionar testes E2E
7. ~~Implementar sync para Ordens de Serviço~~ ✅
8. Implementar sync para Orçamentos e Faturas
