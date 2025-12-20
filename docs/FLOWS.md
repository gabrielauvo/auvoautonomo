# Fluxos Funcionais

## 1. Autenticação

### 1.1 Login com Email/Senha

```
┌─────────┐      ┌─────────┐      ┌─────────┐
│ Mobile/ │      │ Backend │      │  Prisma │
│  Web    │      │  Auth   │      │   DB    │
└────┬────┘      └────┬────┘      └────┬────┘
     │                │                │
     │ POST /auth/login               │
     │ {email, password}              │
     ├───────────────>│               │
     │                │ findUser(email)│
     │                ├──────────────>│
     │                │<──────────────│
     │                │               │
     │                │ bcrypt.compare │
     │                │               │
     │                │ JWT.sign()    │
     │<───────────────│               │
     │ {user, token}  │               │
```

### 1.2 Login com Google OAuth

```
┌─────────┐      ┌─────────┐      ┌─────────┐
│   Web   │      │ Backend │      │ Google  │
└────┬────┘      └────┬────┘      └────┬────┘
     │                │                │
     │ Redirect to Google             │
     ├───────────────────────────────>│
     │                │                │
     │ Callback with code             │
     │<───────────────────────────────│
     │                │                │
     │ GET /auth/google/callback      │
     ├───────────────>│               │
     │                │ Validate code │
     │                ├──────────────>│
     │                │<──────────────│
     │                │               │
     │                │ Find/Create   │
     │                │ User          │
     │                │               │
     │<───────────────│               │
     │ Redirect + JWT │               │
```

### 1.3 Token Refresh (Mobile)

```
AuthService.refreshAccessToken()
    │
    ├─ getRefreshToken() → SecureStore
    │
    ├─ POST /auth/refresh {refreshToken}
    │
    └─ saveTokens({accessToken, refreshToken})
```

---

## 2. Fluxo Quote → Work Order → Payment

### 2.1 Estado de Quote

```
DRAFT ──────> SENT ──────> APPROVED ──────> EXPIRED
   │            │              │
   │            │              │
   └───────────────────────> REJECTED
```

### 2.2 Conversão Quote → Work Order

```
┌─────────┐      ┌─────────┐      ┌─────────┐
│ Mobile  │      │ Backend │      │   DB    │
└────┬────┘      └────┬────┘      └────┬────┘
     │                │                │
     │ POST /work-orders              │
     │ {clientId, quoteId}            │
     ├───────────────>│               │
     │                │               │
     │                │ Validações:   │
     │                │ 1. Quote.status == APPROVED
     │                │ 2. Quote.userId == currentUser
     │                │ 3. Quote.clientId == clientId
     │                │ 4. Quote não tem WO existente
     │                │               │
     │                │ Create WO     │
     │                │ + copy items  │
     │                ├──────────────>│
     │                │<──────────────│
     │<───────────────│               │
     │ {workOrder}    │               │
```

### 2.3 Estado de Work Order

```
SCHEDULED ──────> IN_PROGRESS ──────> DONE
     │                  │
     │                  │
     └──────────────────┴──────> CANCELED
```

**Regras de transição:**
- `SCHEDULED → IN_PROGRESS`: Seta `executionStart` automaticamente
- `IN_PROGRESS → DONE`: Seta `executionEnd` automaticamente
- `DONE` ou `CANCELED`: Estados finais, sem retorno

### 2.4 Execução em Campo (Mobile)

```
Técnico abre OS
       │
       ▼
Inicia execução (IN_PROGRESS)
       │
       ├── Preenche checklists
       │      │
       │      ├── Responde perguntas
       │      ├── Tira fotos
       │      └── Coleta assinatura
       │
       ├── Pausas de trabalho
       │      │
       │      └── ExecutionSession (work/break)
       │
       ▼
Finaliza OS (DONE)
       │
       ▼
Sincroniza com servidor
```

---

## 3. Sincronização Mobile (Offline-First)

### 3.1 Inicialização do SyncEngine

```
App.start()
    │
    ├─ AuthService.getUser()
    │
    ├─ SyncEngine.configure({baseUrl, authToken, technicianId})
    │
    ├─ SyncEngine.registerEntity(workOrdersConfig)
    ├─ SyncEngine.registerEntity(clientsConfig)
    ├─ SyncEngine.registerEntity(quotesConfig)
    │
    └─ SyncEngine.syncAll()
```

### 3.2 Fluxo de Sync Completo

```
syncAll()
    │
    ├─ 1. pushPendingMutations()
    │      │
    │      ├─ MutationQueue.getPending()
    │      ├─ Agrupar por entidade
    │      ├─ Ordenar por prioridade (clients → quotes → workOrders)
    │      └─ POST /mutations/batch
    │
    ├─ 2. Para cada entidade registrada:
    │      │
    │      ├─ getSyncMeta(entity)
    │      ├─ pullFromServer(cursor, since)
    │      ├─ saveToLocalDb(data)
    │      └─ updateSyncMeta(entity, newCursor)
    │
    ├─ 3. syncChecklistTemplates()
    │
    ├─ 4. syncChecklistsForAllWorkOrders()
    │
    ├─ 5. syncExecutionSessionsForAllWorkOrders()
    │
    └─ 6. syncChecklistAttachments()
```

### 3.3 Push de Mutação Individual

```
Usuário edita OS offline
        │
        ▼
WorkOrderRepository.update()
        │
        ├─ SQLite: UPDATE work_orders
        │
        └─ MutationQueue.add({
             entity: 'work_orders',
             entityId: 'wo_123',
             operation: 'UPDATE',
             payload: {...}
           })

[Quando online]
        │
        ▼
SyncEngine.pushPendingMutations()
        │
        ├─ Busca mutação da fila
        ├─ POST /work-orders/sync/mutations
        ├─ Se sucesso: MutationQueue.markCompleted()
        └─ Se erro: MutationQueue.markFailed() (retry depois)
```

### 3.4 Resolução de Conflitos

```
Pull do servidor
       │
       ▼
Verificar se há mutação local pendente
       │
       ├─ SIM: Ignorar dados do servidor (manter local)
       │
       └─ NÃO: Sobrescrever com dados do servidor
```

---

## 4. Checklists

### 4.1 Estrutura Hierárquica

```
ChecklistTemplate
    │
    ├── ChecklistSection (ordenado)
    │       │
    │       └── ChecklistQuestion (ordenado)
    │               │
    │               └── conditionalLogic (JSON)
    │
    └── ChecklistInstance (vinculado a WorkOrder)
            │
            └── ChecklistAnswer
                    │
                    └── ChecklistAttachment (fotos, assinaturas)
```

### 4.2 Fluxo de Preenchimento (Mobile)

```
Abrir Checklist da OS
        │
        ▼
pullChecklistFull(instanceId)
        │
        ├─ [Online] GET /checklist-instances/:id/full
        │               │
        │               └─ Retorna: instance + snapshot + answers
        │
        └─ [Offline] SQLite: checklist_instances + checklist_answers

        │
        ▼
Técnico responde pergunta
        │
        ├─ ChecklistAnswerRepository.create/update()
        │     │
        │     └─ syncStatus = 'PENDING'
        │
        └─ Se tem foto/assinatura:
              │
              └─ ChecklistAttachmentRepository.create()
                    │
                    └─ syncStatus = 'PENDING', base64Data = '...'

        │
        ▼
Sync automático (quando online)
        │
        ├─ ChecklistSyncService.pushPendingAnswers()
        │     │
        │     └─ POST /checklist-instances/sync
        │           │
        │           └─ Envia answers + attachments em base64
        │
        └─ AttachmentUploadService.processQueue()
              │
              └─ Upload de fotos/assinaturas para S3
```

### 4.3 Lógica Condicional

```json
{
  "questionId": "q_123",
  "conditionalLogic": {
    "action": "SHOW",
    "conditions": [
      {
        "questionId": "q_parent",
        "operator": "EQUALS",
        "value": "YES"
      }
    ],
    "logicType": "AND"
  }
}
```

**Operadores suportados:**
- `EQUALS`, `NOT_EQUALS`
- `GREATER_THAN`, `LESS_THAN`
- `CONTAINS`, `NOT_CONTAINS`
- `IS_EMPTY`, `IS_NOT_EMPTY`

---

## 5. Pagamentos (Asaas)

### 5.1 Fluxo de Cobrança

```
Criar cobrança
       │
       ▼
POST /client-payments
{clientId, value, dueDate, billingType}
       │
       ▼
AsaasService.createPayment()
       │
       ├─ POST https://api.asaas.com/v3/payments
       │
       └─ Retorna: {id, pixQrCode, invoiceUrl, ...}

       │
       ▼
ClientPayment criado
{status: 'PENDING', asaasId: '...'}
```

### 5.2 Webhook de Atualização

```
Asaas envia webhook
       │
       ▼
POST /webhooks/asaas
       │
       ├─ Validar assinatura
       │
       ├─ Encontrar ClientPayment por asaasId
       │
       └─ Atualizar status:
            │
            ├─ PAYMENT_CONFIRMED → 'CONFIRMED'
            ├─ PAYMENT_RECEIVED → 'RECEIVED'
            ├─ PAYMENT_OVERDUE → 'OVERDUE'
            └─ PAYMENT_REFUNDED → 'REFUNDED'
```

### 5.3 Estados de Pagamento

```
PENDING ──────> CONFIRMED ──────> RECEIVED
    │               │
    │               └──────> REFUNDED
    │
    └──────> OVERDUE ──────> CONFIRMED
                │
                └──────> CANCELED
```

---

## 6. Geração de PDF (Assíncrono)

### 6.1 Fluxo de Geração

```
Usuário solicita PDF
       │
       ▼
POST /pdf-jobs
{type: 'QUOTE', entityId: 'q_123'}
       │
       ▼
PdfJobService.create()
       │
       ├─ Criar registro PdfJob (status: PENDING)
       │
       └─ BullMQ: queue.add('pdf-generation', job)

[Worker processa]
       │
       ▼
PdfProcessor.process()
       │
       ├─ Buscar dados da entidade
       ├─ PDFKit: gerar documento
       ├─ S3: upload do arquivo
       └─ PdfJob.update({status: 'COMPLETED', url: '...'})

[Usuário consulta]
       │
       ▼
GET /pdf-jobs/:id
       │
       └─ {status: 'COMPLETED', url: 'https://s3.../file.pdf'}
```

---

## 7. Importação de Clientes (CSV)

### 7.1 Fluxo de Importação

```
Upload CSV
       │
       ▼
POST /client-import/upload
       │
       ├─ Salvar arquivo temporariamente
       │
       └─ Retornar preview das primeiras linhas

[Usuário confirma]
       │
       ▼
POST /client-import/process
{mappings: {...}, skipDuplicates: true}
       │
       ├─ Criar ImportJob (status: PROCESSING)
       │
       └─ BullMQ: queue.add('import-clients', job)

[Worker processa]
       │
       ▼
ImportProcessor.process()
       │
       ├─ Ler CSV linha a linha
       ├─ Validar cada registro
       ├─ Criar/atualizar clientes
       └─ ImportJob.update({
            status: 'COMPLETED',
            totalProcessed: 150,
            totalErrors: 2,
            errors: [...]
          })
```

---

## 8. Rate Limiting

### Limites Configurados

| Endpoint | Limite |
|----------|--------|
| Global | 10 req/s por IP |
| Auth | 5 req/min (login) |
| Mutations | 100 req/min |
| File Upload | 20 req/min |

### Resposta quando excede

```json
{
  "statusCode": 429,
  "message": "Too Many Requests",
  "retryAfter": 60
}
```
