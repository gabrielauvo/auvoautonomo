# Plano de Deploy - Azure

## Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AZURE CLOUD                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐     ┌──────────────────────────────────────────────────┐  │
│  │   Azure DNS  │     │           Azure Front Door (CDN + WAF)           │  │
│  │              │────►│                                                  │  │
│  │ yourdomain.  │     │  - SSL/TLS termination                          │  │
│  │    com       │     │  - Global load balancing                        │  │
│  └──────────────┘     │  - DDoS protection                              │  │
│                       └──────────────┬───────────────────────────────────┘  │
│                                      │                                       │
│            ┌─────────────────────────┼─────────────────────────┐            │
│            │                         │                         │            │
│            ▼                         ▼                         ▼            │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │  App Service    │    │  App Service    │    │  Static Web App │         │
│  │  (Backend API)  │    │  (PDF Service)  │    │  (Web Frontend) │         │
│  │                 │    │                 │    │                 │         │
│  │  - NestJS       │    │  - NestJS       │    │  - Next.js SSG  │         │
│  │  - Port 3001    │    │  - Port 3002    │    │  - CDN enabled  │         │
│  │  - B2/P1v2      │    │  - B1           │    │  - Free/Standard│         │
│  └────────┬────────┘    └────────┬────────┘    └─────────────────┘         │
│           │                      │                                          │
│           │         ┌────────────┴────────────┐                            │
│           │         │                         │                            │
│           ▼         ▼                         ▼                            │
│  ┌─────────────────────┐           ┌─────────────────────┐                 │
│  │  Azure Database     │           │  Azure Cache        │                 │
│  │  for PostgreSQL     │           │  for Redis          │                 │
│  │                     │           │                     │                 │
│  │  - Flexible Server  │           │  - Basic C0/C1      │                 │
│  │  - 2 vCores         │           │  - 250MB-1GB        │                 │
│  │  - 4GB RAM          │           │                     │                 │
│  └─────────────────────┘           └─────────────────────┘                 │
│                                                                              │
│  ┌─────────────────────┐           ┌─────────────────────┐                 │
│  │  Azure Blob Storage │           │  Azure Key Vault    │                 │
│  │                     │           │                     │                 │
│  │  - Uploads/PDFs     │           │  - Secrets          │                 │
│  │  - Backups          │           │  - Certificates     │                 │
│  └─────────────────────┘           └─────────────────────┘                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           MOBILE (EXTERNO)                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │   App Store     │    │   Google Play   │    │   Expo/EAS      │         │
│  │   (iOS)         │    │   (Android)     │    │   (OTA Updates) │         │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## FASE 1: Preparação (Dia 1-2)

### 1.1 Criar Conta e Configurar Azure

- [ ] Criar conta Azure (se não existir)
- [ ] Criar Resource Group: `rg-monorepo-prod`
- [ ] Definir região principal: `Brazil South` ou `East US`
- [ ] Configurar Azure CLI local

```bash
# Instalar Azure CLI
winget install Microsoft.AzureCLI

# Login
az login

# Criar Resource Group
az group create --name rg-monorepo-prod --location brazilsouth
```

### 1.2 Configurar Azure Container Registry (ACR)

```bash
# Criar Container Registry
az acr create \
  --resource-group rg-monorepo-prod \
  --name acrmonorepo \
  --sku Basic \
  --admin-enabled true
```

### 1.3 Criar Azure Key Vault

```bash
# Criar Key Vault para secrets
az keyvault create \
  --name kv-monorepo-prod \
  --resource-group rg-monorepo-prod \
  --location brazilsouth

# Adicionar secrets
az keyvault secret set --vault-name kv-monorepo-prod --name "JWT-SECRET" --value "sua-chave"
az keyvault secret set --vault-name kv-monorepo-prod --name "ENCRYPTION-KEY" --value "sua-chave"
az keyvault secret set --vault-name kv-monorepo-prod --name "DATABASE-PASSWORD" --value "sua-senha"
```

---

## FASE 2: Database e Cache (Dia 2-3)

### 2.1 Azure Database for PostgreSQL

```bash
# Criar servidor PostgreSQL Flexible
az postgres flexible-server create \
  --resource-group rg-monorepo-prod \
  --name psql-monorepo-prod \
  --location brazilsouth \
  --admin-user adminuser \
  --admin-password <STRONG_PASSWORD> \
  --sku-name Standard_B2s \
  --tier Burstable \
  --storage-size 32 \
  --version 16

# Criar database
az postgres flexible-server db create \
  --resource-group rg-monorepo-prod \
  --server-name psql-monorepo-prod \
  --database-name monorepo_prod

# Configurar firewall para Azure Services
az postgres flexible-server firewall-rule create \
  --resource-group rg-monorepo-prod \
  --name psql-monorepo-prod \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

### 2.2 Azure Cache for Redis

```bash
# Criar Redis Cache
az redis create \
  --resource-group rg-monorepo-prod \
  --name redis-monorepo-prod \
  --location brazilsouth \
  --sku Basic \
  --vm-size C0
```

### 2.3 Azure Blob Storage

```bash
# Criar Storage Account
az storage account create \
  --name stmonorepo \
  --resource-group rg-monorepo-prod \
  --location brazilsouth \
  --sku Standard_LRS

# Criar containers
az storage container create --name uploads --account-name stmonorepo
az storage container create --name pdfs --account-name stmonorepo
az storage container create --name backups --account-name stmonorepo
```

---

## FASE 3: Backend API (Dia 3-4)

### 3.1 Criar App Service Plan

```bash
# Criar App Service Plan (Linux)
az appservice plan create \
  --name asp-monorepo-prod \
  --resource-group rg-monorepo-prod \
  --is-linux \
  --sku B2
```

### 3.2 Criar Web App para Backend

```bash
# Criar Web App
az webapp create \
  --resource-group rg-monorepo-prod \
  --plan asp-monorepo-prod \
  --name api-monorepo-prod \
  --runtime "NODE:20-lts" \
  --https-only true

# Configurar variáveis de ambiente
az webapp config appsettings set \
  --resource-group rg-monorepo-prod \
  --name api-monorepo-prod \
  --settings \
    NODE_ENV=production \
    PORT=8080 \
    DATABASE_URL="postgresql://adminuser:<PASSWORD>@psql-monorepo-prod.postgres.database.azure.com:5432/monorepo_prod?sslmode=require" \
    REDIS_URL="rediss://redis-monorepo-prod.redis.cache.windows.net:6380" \
    JWT_SECRET="@Microsoft.KeyVault(VaultName=kv-monorepo-prod;SecretName=JWT-SECRET)" \
    FRONTEND_URL="https://www.yourdomain.com" \
    CORS_ORIGIN="https://www.yourdomain.com"
```

### 3.3 Configurar Deployment

```bash
# Configurar deployment do ACR
az webapp config container set \
  --resource-group rg-monorepo-prod \
  --name api-monorepo-prod \
  --container-image-name acrmonorepo.azurecr.io/backend:latest \
  --container-registry-url https://acrmonorepo.azurecr.io
```

---

## FASE 4: Frontend Web (Dia 4-5)

### Opção A: Azure Static Web Apps (Recomendado para Next.js)

```bash
# Criar Static Web App
az staticwebapp create \
  --name swa-monorepo-prod \
  --resource-group rg-monorepo-prod \
  --source https://github.com/your-org/monorepo \
  --location brazilsouth \
  --branch main \
  --app-location "apps/web" \
  --output-location ".next" \
  --sku Standard
```

### Opção B: App Service (se precisar SSR completo)

```bash
az webapp create \
  --resource-group rg-monorepo-prod \
  --plan asp-monorepo-prod \
  --name web-monorepo-prod \
  --runtime "NODE:20-lts"
```

---

## FASE 5: CI/CD com GitHub Actions (Dia 5-6)

### 5.1 Workflow Backend

Criar arquivo: `.github/workflows/azure-backend.yml`

```yaml
name: Deploy Backend to Azure

on:
  push:
    branches: [main]
    paths:
      - 'apps/backend/**'
      - '.github/workflows/azure-backend.yml'

env:
  AZURE_WEBAPP_NAME: api-monorepo-prod
  ACR_NAME: acrmonorepo

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Login to Azure
        uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - name: Login to ACR
        run: az acr login --name ${{ env.ACR_NAME }}

      - name: Build and push image
        run: |
          cd apps/backend
          docker build -t ${{ env.ACR_NAME }}.azurecr.io/backend:${{ github.sha }} .
          docker push ${{ env.ACR_NAME }}.azurecr.io/backend:${{ github.sha }}
          docker tag ${{ env.ACR_NAME }}.azurecr.io/backend:${{ github.sha }} ${{ env.ACR_NAME }}.azurecr.io/backend:latest
          docker push ${{ env.ACR_NAME }}.azurecr.io/backend:latest

      - name: Deploy to App Service
        uses: azure/webapps-deploy@v2
        with:
          app-name: ${{ env.AZURE_WEBAPP_NAME }}
          images: ${{ env.ACR_NAME }}.azurecr.io/backend:${{ github.sha }}

      - name: Run migrations
        run: |
          az webapp config appsettings set \
            --name ${{ env.AZURE_WEBAPP_NAME }} \
            --resource-group rg-monorepo-prod \
            --settings RUN_MIGRATIONS=true
```

### 5.2 Workflow Frontend

Criar arquivo: `.github/workflows/azure-web.yml`

```yaml
name: Deploy Web to Azure Static Web Apps

on:
  push:
    branches: [main]
    paths:
      - 'apps/web/**'
      - '.github/workflows/azure-web.yml'

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install and build
        run: |
          pnpm install --frozen-lockfile
          pnpm --filter @monorepo/web build
        env:
          NEXT_PUBLIC_API_URL: https://api-monorepo-prod.azurewebsites.net

      - name: Deploy to Azure Static Web Apps
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: upload
          app_location: apps/web
          output_location: .next
```

---

## FASE 6: Domínio e SSL (Dia 6)

### 6.1 Configurar Domínio Customizado

```bash
# Adicionar domínio ao App Service
az webapp config hostname add \
  --webapp-name api-monorepo-prod \
  --resource-group rg-monorepo-prod \
  --hostname api.yourdomain.com

# Habilitar SSL gerenciado
az webapp config ssl bind \
  --name api-monorepo-prod \
  --resource-group rg-monorepo-prod \
  --certificate-thumbprint <THUMBPRINT> \
  --ssl-type SNI
```

### 6.2 Configurar Azure DNS (opcional)

```bash
# Criar DNS Zone
az network dns zone create \
  --resource-group rg-monorepo-prod \
  --name yourdomain.com

# Adicionar records
az network dns record-set cname set-record \
  --resource-group rg-monorepo-prod \
  --zone-name yourdomain.com \
  --record-set-name api \
  --cname api-monorepo-prod.azurewebsites.net
```

---

## FASE 7: Mobile (Contínuo)

### 7.1 Configurar EAS para produção

```bash
# Atualizar eas.json
cd apps/mobile

# Build de produção
eas build --profile production --platform all

# Submit para lojas
eas submit --platform android
eas submit --platform ios
```

### 7.2 Atualizar URL da API no mobile

```env
# apps/mobile/.env.production
EXPO_PUBLIC_ENV=production
EXPO_PUBLIC_API_URL=https://api.yourdomain.com
```

---

## Estimativa de Custos (Mensal)

| Serviço | SKU | Custo Estimado |
|---------|-----|----------------|
| App Service (Backend) | B2 | ~$55/mês |
| App Service (PDF) | B1 | ~$13/mês |
| Static Web App | Standard | ~$9/mês |
| PostgreSQL Flexible | B2s | ~$35/mês |
| Redis Cache | C0 Basic | ~$16/mês |
| Blob Storage | Standard LRS | ~$5/mês |
| Azure DNS | Zone + queries | ~$1/mês |
| Container Registry | Basic | ~$5/mês |
| **TOTAL** | | **~$139/mês** |

### Otimizações de Custo

1. **Dev/Test pricing**: Use Azure Dev/Test para ambientes não-prod
2. **Reserved instances**: 1 ano = ~40% desconto
3. **Auto-scaling**: Escale para baixo fora do horário comercial
4. **Spot instances**: Para workloads tolerantes a interrupção

---

## Checklist Final

### Pré-Deploy
- [ ] Conta Azure ativa com billing configurado
- [ ] Azure CLI instalado e autenticado
- [ ] Secrets configurados no GitHub
- [ ] Domínio registrado (se customizado)

### Infraestrutura
- [ ] Resource Group criado
- [ ] PostgreSQL Flexible Server provisionado
- [ ] Redis Cache provisionado
- [ ] Storage Account criado
- [ ] Key Vault configurado com secrets
- [ ] Container Registry criado

### Aplicações
- [ ] App Service Plan criado
- [ ] Backend Web App deployado
- [ ] Static Web App configurado
- [ ] Health checks funcionando
- [ ] Logs configurados

### CI/CD
- [ ] GitHub Actions workflows configurados
- [ ] Secrets do Azure no GitHub
- [ ] Deploy automático funcionando
- [ ] Rollback testado

### Segurança
- [ ] SSL/TLS habilitado
- [ ] Firewall rules configuradas
- [ ] CORS configurado
- [ ] Rate limiting ativo

### Monitoramento
- [ ] Application Insights configurado
- [ ] Alertas de disponibilidade
- [ ] Log Analytics workspace
- [ ] Backup automático do banco

---

## Próximos Passos

1. **Revisar plano** - Validar se atende aos requisitos
2. **Estimar custos finais** - Usar Azure Pricing Calculator
3. **Criar ambiente de staging primeiro** - Testar antes de prod
4. **Documentar runbooks** - Procedimentos de operação
5. **Configurar alertas** - Monitoramento proativo
