# ============================================
# SCRIPT DE SETUP DE AMBIENTE
# ============================================
# Configura arquivos .env para desenvolvimento local
# Uso: .\scripts\setup-env.ps1
# ============================================

param(
    [string]$LocalIP = ""
)

$ROOT_DIR = Split-Path -Parent $PSScriptRoot

function Write-Success { param($msg) Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Info { param($msg) Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Warn { param($msg) Write-Host "[WARN] $msg" -ForegroundColor Yellow }

function Get-LocalIP {
    $ip = (Get-NetIPAddress -AddressFamily IPv4 |
           Where-Object { $_.InterfaceAlias -notmatch "Loopback" -and $_.IPAddress -notmatch "^169\." } |
           Select-Object -First 1).IPAddress
    return $ip
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "  SETUP DE AMBIENTE - MONOREPO" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""

# Detectar IP local
if (-not $LocalIP) {
    $LocalIP = Get-LocalIP
    if (-not $LocalIP) {
        $LocalIP = "localhost"
    }
}
Write-Info "IP Local detectado: $LocalIP"

# ============================================
# Backend .env
# ============================================

$backendEnvPath = "$ROOT_DIR\apps\backend\.env"
$backendEnvContent = @"
# ============================================
# Backend Environment - Development
# ============================================
# Gerado automaticamente em: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
# ============================================

# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/auvo?schema=public"

# Server
NODE_ENV=development
PORT=3001

# JWT
JWT_SECRET=auvo-jwt-secret-key-desenvolvimento-2024
JWT_EXPIRES_IN=7d

# Encryption
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# Redis (opcional para desenvolvimento)
REDIS_HOST=localhost
REDIS_PORT=6379

# CORS - Frontend URLs
FRONTEND_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3000,http://${LocalIP}:3000

# Google OAuth (opcional)
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
# GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback

# Throttle limits (desenvolvimento)
THROTTLE_TTL=60
THROTTLE_LIMIT=1000
"@

Write-Info "Criando $backendEnvPath..."
$backendEnvContent | Out-File -FilePath $backendEnvPath -Encoding UTF8 -Force
Write-Success "Backend .env criado"

# ============================================
# Web .env.local
# ============================================

$webEnvPath = "$ROOT_DIR\apps\web\.env.local"
$webEnvContent = @"
# ============================================
# Web Environment - Development
# ============================================
# Gerado automaticamente em: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
# ============================================

# API URL (backend)
NEXT_PUBLIC_API_URL=http://localhost:3001

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
"@

Write-Info "Criando $webEnvPath..."
$webEnvContent | Out-File -FilePath $webEnvPath -Encoding UTF8 -Force
Write-Success "Web .env.local criado"

# ============================================
# Mobile .env
# ============================================

$mobileEnvPath = "$ROOT_DIR\apps\mobile\.env"
$mobileEnvContent = @"
# ============================================
# Mobile Environment - Development
# ============================================
# Gerado automaticamente em: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
# IP Local: $LocalIP
# ============================================

# Environment
EXPO_PUBLIC_ENV=development

# API URL - Use o IP local para dispositivos fisicos
# Para emulador Android: use http://10.0.2.2:3001
# Para simulador iOS: use http://localhost:3001
# Para dispositivo fisico: use http://<SEU_IP>:3001
EXPO_PUBLIC_API_URL=http://${LocalIP}:3001

# Expo Router
EXPO_ROUTER_APP_ROOT=./app
"@

Write-Info "Criando $mobileEnvPath..."
$mobileEnvContent | Out-File -FilePath $mobileEnvPath -Encoding UTF8 -Force
Write-Success "Mobile .env criado"

# ============================================
# PDF Service .env (opcional)
# ============================================

$pdfEnvPath = "$ROOT_DIR\apps\pdf-service\.env"
if (-not (Test-Path $pdfEnvPath)) {
    $pdfEnvContent = @"
# ============================================
# PDF Service Environment - Development
# ============================================

DATABASE_URL="postgresql://postgres:postgres@localhost:5432/auvo?schema=public"
REDIS_HOST=localhost
REDIS_PORT=6379
PDF_SERVICE_PORT=3002
APP_URL=http://localhost:3001
STORAGE_PATH=./storage
"@
    Write-Info "Criando $pdfEnvPath..."
    $pdfEnvContent | Out-File -FilePath $pdfEnvPath -Encoding UTF8 -Force
    Write-Success "PDF Service .env criado"
}

# ============================================
# Summary
# ============================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  SETUP CONCLUIDO!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Arquivos criados/atualizados:" -ForegroundColor Cyan
Write-Host "  - apps/backend/.env" -ForegroundColor White
Write-Host "  - apps/web/.env.local" -ForegroundColor White
Write-Host "  - apps/mobile/.env" -ForegroundColor White
Write-Host ""
Write-Host "IP Local configurado: $LocalIP" -ForegroundColor Yellow
Write-Host ""
Write-Host "IMPORTANTE para dispositivo fisico:" -ForegroundColor Yellow
Write-Host "  O mobile esta configurado para conectar em: http://${LocalIP}:3001" -ForegroundColor White
Write-Host "  Certifique-se de que seu dispositivo esta na mesma rede." -ForegroundColor White
Write-Host ""
Write-Host "Proximo passo: .\scripts\dev.ps1 start" -ForegroundColor Cyan
Write-Host ""
