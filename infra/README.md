# Infraestrutura Azure - Guia de Deploy

## Visão Geral

Este diretório contém toda a infraestrutura como código (IaC) para deploy na Azure.

```
infra/
├── terraform/
│   ├── main.tf              # Configuração principal
│   ├── variables.tf         # Variáveis
│   ├── modules/
│   │   ├── database/        # PostgreSQL + Redis
│   │   ├── storage/         # Blob Storage + ACR
│   │   ├── backend/         # App Service (NestJS)
│   │   └── frontend/        # Static Web App (Next.js)
│   └── environments/
│       ├── prod/            # Variáveis de produção
│       └── staging/         # Variáveis de staging
└── README.md
```

## Pré-requisitos

1. **Azure CLI** instalado e autenticado
2. **Terraform** >= 1.5.0
3. **Conta Azure** com permissões de Owner/Contributor

## Setup Inicial

### 1. Instalar ferramentas

```bash
# Azure CLI (Windows)
winget install Microsoft.AzureCLI

# Terraform (Windows)
winget install Hashicorp.Terraform

# Verificar instalação
az --version
terraform --version
```

### 2. Autenticar na Azure

```bash
# Login interativo
az login

# Verificar subscription
az account show

# Definir subscription (se necessário)
az account set --subscription "SUBSCRIPTION_ID"
```

### 3. Criar Service Principal para CI/CD

```bash
# Criar Service Principal
az ad sp create-for-rbac \
  --name "sp-monorepo-cicd" \
  --role contributor \
  --scopes /subscriptions/SUBSCRIPTION_ID \
  --sdk-auth

# Salve a saída JSON - será usado no GitHub Secrets
```

### 4. Configurar GitHub Secrets

Adicione estes secrets no GitHub (Settings → Secrets → Actions):

| Secret | Descrição |
|--------|-----------|
| `AZURE_CREDENTIALS` | JSON completo do Service Principal |
| `ARM_CLIENT_ID` | Client ID do Service Principal |
| `ARM_CLIENT_SECRET` | Client Secret do Service Principal |
| `ARM_SUBSCRIPTION_ID` | ID da Subscription |
| `ARM_TENANT_ID` | Tenant ID |
| `POSTGRES_ADMIN_PASS` | Senha do PostgreSQL |
| `JWT_SECRET` | Secret para JWT |
| `ENCRYPTION_KEY` | Chave de criptografia |
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | Token do Static Web App |
| `NEXT_PUBLIC_API_URL` | URL da API para o frontend |

## Deploy

### Opção 1: Via GitHub Actions (Recomendado)

1. Push para `main` em `infra/terraform/` dispara o workflow
2. Workflow executa `terraform plan`
3. Se aprovado, executa `terraform apply`

### Opção 2: Deploy Manual

```bash
cd infra/terraform

# Inicializar Terraform
terraform init

# Ver plano de execução
terraform plan -var-file=environments/prod/terraform.tfvars

# Aplicar (cuidado!)
terraform apply -var-file=environments/prod/terraform.tfvars

# Destruir (MUITO CUIDADO!)
terraform destroy -var-file=environments/prod/terraform.tfvars
```

### Variáveis Sensíveis

```bash
# Definir via variáveis de ambiente
export TF_VAR_postgres_admin_pass="SuaSenhaForte123!"
export TF_VAR_jwt_secret="seu-jwt-secret-muito-longo"
export TF_VAR_encryption_key="sua-chave-de-64-caracteres"

# Ou via arquivo .tfvars (NÃO COMMITAR!)
# Criar: environments/prod/secrets.tfvars
```

## Recursos Criados

| Recurso | Nome | Propósito |
|---------|------|-----------|
| Resource Group | rg-monorepo-prod | Container de recursos |
| Key Vault | kv-monorepo-prod | Secrets |
| PostgreSQL Flexible | psql-monorepo-prod | Database |
| Redis Cache | redis-monorepo-prod | Cache/Queue |
| Storage Account | stmonorepo | Blobs/Arquivos |
| Container Registry | acrmonorepo | Imagens Docker |
| App Service Plan | asp-monorepo-prod | Compute |
| Web App | api-monorepo-prod | Backend API |
| Static Web App | swa-monorepo-prod | Frontend |
| Log Analytics | log-monorepo-prod | Logs |
| App Insights | ai-monorepo-prod | Monitoramento |

## Custos Estimados

| Serviço | SKU | ~Custo/mês |
|---------|-----|------------|
| App Service | B2 | $55 |
| PostgreSQL | B2s | $35 |
| Redis | C0 Basic | $16 |
| Static Web App | Standard | $9 |
| Storage | LRS | $5 |
| Container Registry | Basic | $5 |
| **TOTAL** | | **~$125/mês** |

## Troubleshooting

### Erro: "Resource already exists"

```bash
# Importar recurso existente
terraform import azurerm_resource_group.main /subscriptions/.../resourceGroups/rg-monorepo-prod
```

### Erro: "Insufficient permissions"

```bash
# Verificar role assignments
az role assignment list --assignee CLIENT_ID
```

### Destruir e Recriar

```bash
# Destruir recurso específico
terraform destroy -target=module.backend

# Recriar
terraform apply -target=module.backend
```

## Manutenção

### Atualizar Imagem do Backend

```bash
# Via Azure CLI
az webapp config container set \
  --name api-monorepo-prod \
  --resource-group rg-monorepo-prod \
  --container-image-name acrmonorepo.azurecr.io/backend:v1.2.3
```

### Escalar App Service

```bash
# Aumentar SKU
az appservice plan update \
  --name asp-monorepo-prod \
  --resource-group rg-monorepo-prod \
  --sku P1v2
```

### Backup do Banco

```bash
# Criar backup manual
az postgres flexible-server backup create \
  --resource-group rg-monorepo-prod \
  --server-name psql-monorepo-prod \
  --backup-name manual-backup
```

## Links Úteis

- [Azure Portal](https://portal.azure.com)
- [Terraform Azure Provider](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs)
- [Azure CLI Reference](https://docs.microsoft.com/cli/azure/)
