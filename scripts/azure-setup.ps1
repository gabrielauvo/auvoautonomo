# =============================================================================
# SCRIPT DE SETUP AZURE - Para Iniciantes
# =============================================================================
# Este script vai guiar você pelo processo de deploy na Azure
# Execute com: powershell -ExecutionPolicy Bypass -File scripts\azure-setup.ps1
# =============================================================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   SETUP AZURE - Monorepo" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Funcoes auxiliares
function Write-Step { param($num, $msg) Write-Host "[$num] $msg" -ForegroundColor Yellow }
function Write-Success { param($msg) Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Err { param($msg) Write-Host "[ERRO] $msg" -ForegroundColor Red }
function Write-Info { param($msg) Write-Host "[INFO] $msg" -ForegroundColor Cyan }

# =============================================================================
# VERIFICAR PRE-REQUISITOS
# =============================================================================

Write-Step "1/8" "Verificando pre-requisitos..."

# Verificar Azure CLI
$azVersion = az --version 2>$null
if (-not $azVersion) {
    Write-Err "Azure CLI nao encontrado!"
    Write-Host ""
    Write-Host "Para instalar, abra o navegador e acesse:" -ForegroundColor Yellow
    Write-Host "https://aka.ms/installazurecliwindows" -ForegroundColor White
    Write-Host ""
    Write-Host "Depois de instalar, execute este script novamente." -ForegroundColor Yellow
    exit 1
}
Write-Success "Azure CLI instalado"

# Verificar Terraform
$tfVersion = terraform --version 2>$null
if (-not $tfVersion) {
    Write-Err "Terraform nao encontrado!"
    Write-Host ""
    Write-Host "Para instalar:" -ForegroundColor Yellow
    Write-Host "1. Acesse: https://developer.hashicorp.com/terraform/downloads" -ForegroundColor White
    Write-Host "2. Baixe a versao Windows AMD64" -ForegroundColor White
    Write-Host "3. Extraia para C:\terraform" -ForegroundColor White
    Write-Host "4. Adicione C:\terraform ao PATH do sistema" -ForegroundColor White
    Write-Host ""
    exit 1
}
Write-Success "Terraform instalado"

# =============================================================================
# LOGIN NA AZURE
# =============================================================================

Write-Host ""
Write-Step "2/8" "Fazendo login na Azure..."
Write-Host ""
Write-Host "Uma janela do navegador vai abrir." -ForegroundColor Yellow
Write-Host "Faca login com sua conta Microsoft." -ForegroundColor Yellow
Write-Host ""

$loginResult = az login 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Err "Falha no login. Tente novamente."
    exit 1
}
Write-Success "Login realizado com sucesso!"

# Pegar informacoes da conta
$account = az account show --query "{name:name, id:id}" -o json | ConvertFrom-Json
Write-Info "Conta: $($account.name)"
Write-Info "Subscription ID: $($account.id)"

# =============================================================================
# COLETAR SENHAS
# =============================================================================

Write-Host ""
Write-Step "3/8" "Configurando senhas..."
Write-Host ""
Write-Host "Voce precisa criar 3 senhas para sua aplicacao." -ForegroundColor Yellow
Write-Host "IMPORTANTE: Anote essas senhas em um lugar seguro!" -ForegroundColor Red
Write-Host ""

# Senha do banco
Write-Host "SENHA DO BANCO DE DADOS:" -ForegroundColor Cyan
Write-Host "  - Minimo 8 caracteres" -ForegroundColor Gray
Write-Host "  - Precisa ter: maiuscula, minuscula, numero e simbolo" -ForegroundColor Gray
Write-Host "  - Exemplo: MinhaS3nh@Forte!" -ForegroundColor Gray
$dbPassword = Read-Host "Digite a senha do banco"

if ($dbPassword.Length -lt 8) {
    Write-Err "Senha muito curta! Precisa ter no minimo 8 caracteres."
    exit 1
}

# JWT Secret
Write-Host ""
Write-Host "JWT SECRET (para autenticacao):" -ForegroundColor Cyan
Write-Host "  - Uma frase longa qualquer (minimo 32 caracteres)" -ForegroundColor Gray
Write-Host "  - Exemplo: MinhaAplicacaoSuperSecreta2024ComMuitosCaracteres" -ForegroundColor Gray
$jwtSecret = Read-Host "Digite o JWT secret"

if ($jwtSecret.Length -lt 32) {
    Write-Err "JWT Secret muito curto! Precisa ter no minimo 32 caracteres."
    exit 1
}

# Encryption Key (gerar automaticamente)
$encryptionKey = -join ((48..57) + (97..102) | Get-Random -Count 64 | ForEach-Object {[char]$_})
Write-Host ""
Write-Success "Chave de criptografia gerada automaticamente"

# Definir variaveis de ambiente
$env:TF_VAR_postgres_admin_pass = $dbPassword
$env:TF_VAR_jwt_secret = $jwtSecret
$env:TF_VAR_encryption_key = $encryptionKey

Write-Success "Senhas configuradas!"

# =============================================================================
# INICIALIZAR TERRAFORM
# =============================================================================

Write-Host ""
Write-Step "4/8" "Inicializando Terraform..."

$terraformDir = Join-Path $PSScriptRoot "..\infra\terraform"
Push-Location $terraformDir

terraform init
if ($LASTEXITCODE -ne 0) {
    Write-Err "Falha ao inicializar Terraform"
    Pop-Location
    exit 1
}
Write-Success "Terraform inicializado!"

# =============================================================================
# PLANEJAR INFRAESTRUTURA
# =============================================================================

Write-Host ""
Write-Step "5/8" "Planejando infraestrutura..."
Write-Host ""
Write-Host "Isso mostra o que sera criado na Azure." -ForegroundColor Yellow
Write-Host ""

terraform plan -var-file=environments/prod/terraform.tfvars -out=tfplan
if ($LASTEXITCODE -ne 0) {
    Write-Err "Erro no planejamento. Verifique as mensagens acima."
    Pop-Location
    exit 1
}
Write-Success "Planejamento concluido!"

# =============================================================================
# CONFIRMAR E APLICAR
# =============================================================================

Write-Host ""
Write-Step "6/8" "Criando recursos na Azure..."
Write-Host ""
Write-Host "========================================" -ForegroundColor Red
Write-Host "   ATENCAO: ISTO VAI CUSTAR DINHEIRO!" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Red
Write-Host ""
Write-Host "Custo estimado: ~$125/mes" -ForegroundColor Yellow
Write-Host "Voce tem 30 dias gratis + $200 de credito" -ForegroundColor Yellow
Write-Host ""

$confirm = Read-Host "Deseja continuar? (digite 'sim' para confirmar)"
if ($confirm -ne "sim") {
    Write-Info "Operacao cancelada."
    Pop-Location
    exit 0
}

Write-Host ""
Write-Host "Criando recursos... Isso pode levar 15-20 minutos." -ForegroundColor Yellow
Write-Host "Nao feche esta janela!" -ForegroundColor Red
Write-Host ""

terraform apply -auto-approve tfplan
if ($LASTEXITCODE -ne 0) {
    Write-Err "Erro ao criar recursos. Verifique as mensagens acima."
    Pop-Location
    exit 1
}

Write-Success "Recursos criados com sucesso!"

# =============================================================================
# MOSTRAR RESULTADOS
# =============================================================================

Write-Host ""
Write-Step "7/8" "Obtendo informacoes..."

$outputs = terraform output -json | ConvertFrom-Json

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   DEPLOY CONCLUIDO COM SUCESSO!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "SEUS ENDERECOS:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  API (Backend):" -ForegroundColor Yellow
Write-Host "  $($outputs.backend_url.value)" -ForegroundColor White
Write-Host ""
Write-Host "  Site (Frontend):" -ForegroundColor Yellow
Write-Host "  $($outputs.frontend_url.value)" -ForegroundColor White
Write-Host ""
Write-Host "  Banco de Dados:" -ForegroundColor Yellow
Write-Host "  $($outputs.database_server.value)" -ForegroundColor White
Write-Host ""

# =============================================================================
# SALVAR INFORMACOES
# =============================================================================

Write-Step "8/8" "Salvando informacoes..."

$infoFile = Join-Path $PSScriptRoot "..\AZURE-INFO.txt"
@"
========================================
INFORMACOES DA SUA APLICACAO AZURE
Criado em: $(Get-Date)
========================================

URLS:
- API (Backend): $($outputs.backend_url.value)
- Site (Frontend): $($outputs.frontend_url.value)
- Banco de Dados: $($outputs.database_server.value)

SENHAS (GUARDE EM LOCAL SEGURO!):
- Senha do Banco: $dbPassword
- JWT Secret: $jwtSecret
- Encryption Key: $encryptionKey

SUBSCRIPTION ID: $($account.id)

PROXIMO PASSO:
1. Configure os secrets no GitHub (veja GUIA-AZURE-INICIANTE.md)
2. Faca push do codigo para o GitHub
3. O deploy sera automatico!

========================================
"@ | Out-File -FilePath $infoFile -Encoding UTF8

Write-Success "Informacoes salvas em: AZURE-INFO.txt"
Write-Host ""
Write-Host "IMPORTANTE: Guarde o arquivo AZURE-INFO.txt em local seguro!" -ForegroundColor Red
Write-Host "Ele contem suas senhas." -ForegroundColor Red
Write-Host ""

Pop-Location

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   PROXIMO PASSO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Agora voce precisa:" -ForegroundColor Yellow
Write-Host "1. Criar uma conta no GitHub (se nao tiver)" -ForegroundColor White
Write-Host "2. Enviar seu codigo para o GitHub" -ForegroundColor White
Write-Host "3. Configurar os secrets no GitHub" -ForegroundColor White
Write-Host ""
Write-Host "Siga as instrucoes em: GUIA-AZURE-INICIANTE.md" -ForegroundColor Cyan
Write-Host ""
