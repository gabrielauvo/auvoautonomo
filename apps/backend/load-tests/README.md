# Load Tests - Auvo API

Suíte de testes de carga para a API do Auvo usando [k6](https://k6.io/).

## Pré-requisitos

1. **Instalar k6:**
   ```bash
   # Windows (Chocolatey)
   choco install k6

   # Windows (winget)
   winget install k6

   # macOS
   brew install k6

   # Linux (Debian/Ubuntu)
   sudo gpg -k
   sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
   echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
   sudo apt-get update
   sudo apt-get install k6
   ```

2. **Configurar ambiente:**
   - Backend rodando (porta 3001 por padrão)
   - Tokens JWT válidos para autenticação
   - IDs de entidades para teste (quotes, work orders, invoices)
   - Share keys públicas para testes de links públicos

## Estrutura

```
load-tests/
├── config.js                       # Configuração centralizada
├── package.json                    # Scripts npm
├── README.md                       # Documentação
├── scenarios/
│   ├── sync-load-test.js          # Testes de sync (offline-first)
│   ├── pdf-load-test.js           # Testes de geração de PDF
│   └── public-links-load-test.js  # Testes de links públicos
└── utils/
    └── generate-report.js         # Gerador de relatórios (opcional)
```

## Cenários de Teste

### 1. Sync Load Test (`sync-load-test.js`)

Testa a sincronização offline-first entre app mobile e web.

**Endpoints testados:**
- `GET /sync/quotes` - Pull de orçamentos
- `POST /sync/quotes/mutations` - Push de mutações
- `GET /sync/invoices` - Pull de faturas
- `POST /sync/invoices/mutations` - Push de mutações
- `GET /sync/categories` - Pull de categorias
- `POST /sync/categories` - Push de categorias
- `GET /sync/items` - Pull de itens do catálogo
- `POST /sync/items` - Push de itens
- `GET /work-orders/sync` - Pull de ordens de serviço
- `POST /work-orders/sync/mutations` - Push de mutações

**Cenários simulados:**
- Sync inicial completo (sem `since`)
- Delta sync (com `since`)
- Push de mutações (create/update/delete)
- Conflitos de sync (múltiplos usuários editando)

### 2. PDF Load Test (`pdf-load-test.js`)

Testa a geração de PDFs para orçamentos, ordens de serviço e faturas.

**Endpoints testados:**
- `POST /quotes/:id/generate-pdf` - PDF síncrono
- `POST /work-orders/:id/generate-pdf` - PDF síncrono
- `POST /invoices/:id/generate-pdf` - PDF síncrono
- `POST /quotes/:id/generate-pdf-async` - PDF assíncrono
- `POST /work-orders/:id/generate-pdf-async` - PDF assíncrono
- `POST /invoices/:id/generate-pdf-async` - PDF assíncrono
- `GET /pdf-jobs/:id` - Status do job
- `GET /quotes/:id/pdf-status` - Status do PDF

**Cenários simulados:**
- Geração síncrona (download direto)
- Geração assíncrona (job queue)
- Polling de status de job
- Geração em lote de múltiplos PDFs

### 3. Public Links Load Test (`public-links-load-test.js`)

Testa os endpoints públicos (sem autenticação) para links compartilháveis.

**Endpoints testados:**
- `GET /public/quotes/:shareKey` - Visualizar orçamento
- `POST /public/quotes/:shareKey/sign-and-approve` - Aprovar orçamento
- `POST /public/quotes/:shareKey/reject` - Rejeitar orçamento
- `GET /public/quotes/:shareKey/acceptance-terms` - Termos de aceite
- `GET /public/work-orders/:shareKey` - Visualizar OS
- `GET /public/payments/:token` - Visualizar pagamento
- `POST /public/payments/:token/pix` - Obter QR code PIX
- `POST /public/payments/:token/boleto` - Obter boleto

**Cenários simulados:**
- Cliente visualizando e aprovando orçamento
- Cliente visualizando ordem de serviço
- Cliente acessando pagamento (PIX/Boleto)
- Teste de rate limiting

## Como Executar

### Configuração de Ambiente

Defina as variáveis de ambiente antes de executar:

```bash
# URL do backend
export BASE_URL=http://localhost:3001

# Tokens de autenticação (gere tokens válidos)
export TOKEN_USER1=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
export TOKEN_USER2=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
export TOKEN_USER3=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# IDs de entidades para teste
export QUOTE_IDS=quote-uuid-1,quote-uuid-2,quote-uuid-3
export WORK_ORDER_IDS=wo-uuid-1,wo-uuid-2,wo-uuid-3
export INVOICE_IDS=inv-uuid-1,inv-uuid-2,inv-uuid-3

# Share keys públicas
export QUOTE_SHARE_KEYS=abc123,def456
export WO_SHARE_KEYS=wo-share-1,wo-share-2
export PAYMENT_TOKENS=pay-token-1,pay-token-2
```

### Executar Testes

```bash
# Smoke test (verificação rápida)
npm run test:sync:smoke
npm run test:pdf:smoke
npm run test:public:smoke

# Load test (carga normal)
npm run test:sync:load
npm run test:pdf:load
npm run test:public:load

# Stress test (encontrar limites)
npm run test:sync:stress
npm run test:pdf:stress
npm run test:public:stress

# Spike test (picos repentinos)
npm run test:sync:spike

# Executar todos os testes
npm run test:all
npm run test:all:smoke
```

### Executar Diretamente com k6

```bash
# Com cenário específico
k6 run --env SCENARIO=smoke scenarios/sync-load-test.js
k6 run --env SCENARIO=load scenarios/pdf-load-test.js
k6 run --env SCENARIO=stress scenarios/public-links-load-test.js

# Com output JSON para análise
k6 run --out json=results.json scenarios/sync-load-test.js

# Com output para InfluxDB (para Grafana)
k6 run --out influxdb=http://localhost:8086/k6 scenarios/sync-load-test.js
```

## Tipos de Cenário

| Cenário | VUs | Duração | Uso |
|---------|-----|---------|-----|
| `smoke` | 1 | 30s | Verificação rápida |
| `load` | 20-50 | ~16min | Carga normal de produção |
| `stress` | 50-200 | ~28min | Encontrar limites do sistema |
| `spike` | 10→100→10 | ~7min | Testar picos repentinos |
| `soak` | 30 | 30min | Encontrar memory leaks |

## Thresholds (SLOs)

### Gerais
- 95% das requisições < 500ms
- 99% das requisições < 1s
- Taxa de erro < 1%

### Sync
- 95% dos pulls < 2s
- 95% dos pushes < 3s
- Taxa de erro em pulls < 5%
- Taxa de erro em pushes < 2%

### PDF
- 95% dos PDFs síncronos < 8s
- 95% das requisições async < 500ms
- 95% dos jobs completos < 30s
- Taxa de erro < 5%

### Public Links
- 95% das requisições < 500ms
- Rate limiting < 10%
- Taxa de erro < 5%

## Métricas Customizadas

### Sync
- `sync_pull_errors` - Taxa de erro em pulls
- `sync_push_errors` - Taxa de erro em pushes
- `sync_pull_duration` - Latência de pulls
- `sync_push_duration` - Latência de pushes
- `records_synced_total` - Total de registros sincronizados

### PDF
- `pdf_sync_errors` - Taxa de erro em PDFs síncronos
- `pdf_async_errors` - Taxa de erro em PDFs assíncronos
- `pdf_sync_duration` - Tempo de geração síncrona
- `pdf_job_completion_time` - Tempo total do job assíncrono
- `pdf_generated_total` - Total de PDFs gerados

### Public Links
- `public_quote_errors` - Taxa de erro em orçamentos
- `public_payment_errors` - Taxa de erro em pagamentos
- `rate_limited` - Taxa de requisições com rate limit
- `quote_approvals_total` - Total de aprovações

## Dicas

1. **Preparar dados de teste:**
   - Crie orçamentos, OS e faturas de teste
   - Gere share keys públicas
   - Anote os IDs para configurar as variáveis

2. **Ambiente isolado:**
   - Execute em ambiente de staging/dev
   - Evite executar em produção sem autorização

3. **Monitoramento:**
   - Configure Grafana + InfluxDB para dashboards em tempo real
   - Use `k6 cloud` para análise avançada

4. **Interpretação de resultados:**
   - `http_req_duration` - Latência das requisições
   - `http_req_failed` - Taxa de falhas
   - `vus` - Usuários virtuais ativos
   - `iterations` - Total de iterações completadas

## Troubleshooting

### Erro de conexão
```
ERRO: dial tcp: connection refused
```
Verifique se o backend está rodando e a URL está correta.

### Token inválido
```
status: 401
```
Gere novos tokens JWT válidos.

### Rate limiting excessivo
```
status: 429
```
Normal para testes de public links. Ajuste o intervalo entre requisições.

### Memory issues
```
WARN: memory usage high
```
Reduza o número de VUs ou aumente a memória disponível.
