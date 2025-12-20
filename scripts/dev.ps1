# ============================================
# SCRIPT DE DESENVOLVIMENTO - Windows PowerShell
# ============================================
# Uso: .\scripts\dev.ps1 [comando]
# Comandos: start, stop, restart, status, logs, clean
# ============================================

param(
    [Parameter(Position=0)]
    [ValidateSet("start", "stop", "restart", "status", "logs", "clean", "backend", "web", "mobile", "infra", "help")]
    [string]$Command = "help",

    [Parameter(Position=1)]
    [string]$Service = ""
)

# Cores para output
function Write-Success { param($msg) Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Info { param($msg) Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Warn { param($msg) Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Err { param($msg) Write-Host "[ERROR] $msg" -ForegroundColor Red }
function Write-Header { param($msg) Write-Host "`n========== $msg ==========" -ForegroundColor Magenta }

# Configuracao de portas
$PORTS = @{
    Backend = 3001
    Web = 3000
    Metro = 8081
    Expo = 19000
    Postgres = 5432
    Redis = 6379
    PdfService = 3002
}

$ROOT_DIR = Split-Path -Parent $PSScriptRoot

# ============================================
# Funcoes Utilitarias
# ============================================

function Test-Port {
    param([int]$Port)
    $connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    return $null -ne $connection
}

function Get-ProcessOnPort {
    param([int]$Port)
    $connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($connection) {
        return Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue
    }
    return $null
}

function Stop-ProcessOnPort {
    param([int]$Port, [string]$ServiceName)
    $process = Get-ProcessOnPort -Port $Port
    if ($process) {
        Write-Info "Parando processo na porta $Port (PID: $($process.Id), Nome: $($process.ProcessName))..."
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 500
        if (-not (Test-Port -Port $Port)) {
            Write-Success "Porta $Port liberada"
            return $true
        } else {
            Write-Err "Falha ao liberar porta $Port"
            return $false
        }
    }
    return $true
}

function Wait-ForPort {
    param([int]$Port, [int]$TimeoutSeconds = 30, [string]$ServiceName)
    Write-Info "Aguardando $ServiceName na porta $Port..."
    $elapsed = 0
    while ($elapsed -lt $TimeoutSeconds) {
        if (Test-Port -Port $Port) {
            Write-Success "$ServiceName iniciado na porta $Port"
            return $true
        }
        Start-Sleep -Seconds 1
        $elapsed++
    }
    Write-Err "Timeout aguardando $ServiceName na porta $Port"
    return $false
}

function Test-Docker {
    try {
        $null = docker info 2>&1
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

# ============================================
# Funcoes de Servicos
# ============================================

function Start-Infrastructure {
    Write-Header "INICIANDO INFRAESTRUTURA"

    if (-not (Test-Docker)) {
        Write-Err "Docker nao esta rodando. Inicie o Docker Desktop primeiro."
        return $false
    }

    Push-Location $ROOT_DIR
    try {
        Write-Info "Iniciando PostgreSQL e Redis..."
        docker-compose up -d postgres redis

        # Aguardar PostgreSQL
        Write-Info "Aguardando PostgreSQL ficar healthy..."
        $attempts = 0
        while ($attempts -lt 30) {
            $health = docker inspect --format='{{.State.Health.Status}}' monorepo-postgres 2>$null
            if ($health -eq "healthy") {
                Write-Success "PostgreSQL healthy"
                break
            }
            Start-Sleep -Seconds 1
            $attempts++
        }

        # Aguardar Redis
        Write-Info "Aguardando Redis..."
        $attempts = 0
        while ($attempts -lt 15) {
            $pong = docker exec monorepo-redis redis-cli ping 2>$null
            if ($pong -eq "PONG") {
                Write-Success "Redis healthy"
                break
            }
            Start-Sleep -Seconds 1
            $attempts++
        }

        return $true
    } finally {
        Pop-Location
    }
}

function Stop-Infrastructure {
    Write-Header "PARANDO INFRAESTRUTURA"
    Push-Location $ROOT_DIR
    try {
        docker-compose down
        Write-Success "Infraestrutura parada"
    } finally {
        Pop-Location
    }
}

function Start-Backend {
    Write-Header "INICIANDO BACKEND"

    # Verificar/liberar porta
    if (Test-Port -Port $PORTS.Backend) {
        Write-Warn "Porta $($PORTS.Backend) em uso. Liberando..."
        if (-not (Stop-ProcessOnPort -Port $PORTS.Backend -ServiceName "Backend")) {
            return $false
        }
    }

    Push-Location "$ROOT_DIR\apps\backend"
    try {
        # Verificar se prisma client existe
        if (-not (Test-Path "node_modules\.prisma")) {
            Write-Info "Gerando Prisma Client..."
            pnpm prisma generate
        }

        Write-Info "Iniciando NestJS..."
        Start-Process -FilePath "cmd" -ArgumentList "/c", "pnpm dev" -WindowStyle Normal

        if (Wait-ForPort -Port $PORTS.Backend -ServiceName "Backend" -TimeoutSeconds 45) {
            return $true
        }
        return $false
    } finally {
        Pop-Location
    }
}

function Start-Web {
    Write-Header "INICIANDO WEB"

    # Verificar/liberar porta
    if (Test-Port -Port $PORTS.Web) {
        Write-Warn "Porta $($PORTS.Web) em uso. Liberando..."
        if (-not (Stop-ProcessOnPort -Port $PORTS.Web -ServiceName "Web")) {
            return $false
        }
    }

    Push-Location "$ROOT_DIR\apps\web"
    try {
        Write-Info "Iniciando Next.js..."
        Start-Process -FilePath "cmd" -ArgumentList "/c", "pnpm dev" -WindowStyle Normal

        if (Wait-ForPort -Port $PORTS.Web -ServiceName "Web" -TimeoutSeconds 30) {
            return $true
        }
        return $false
    } finally {
        Pop-Location
    }
}

function Start-Mobile {
    Write-Header "INICIANDO MOBILE (EXPO)"

    # Limpar cache do Metro se necessario
    $metroCache = "$env:TEMP\metro-*"
    $expoCache = "$ROOT_DIR\apps\mobile\.expo"

    # Verificar/liberar portas
    foreach ($port in @($PORTS.Metro, $PORTS.Expo)) {
        if (Test-Port -Port $port) {
            Write-Warn "Porta $port em uso. Liberando..."
            Stop-ProcessOnPort -Port $port -ServiceName "Metro/Expo"
        }
    }

    Push-Location "$ROOT_DIR\apps\mobile"
    try {
        Write-Info "Iniciando Expo..."
        Start-Process -FilePath "cmd" -ArgumentList "/c", "npx expo start --port 19000 -c" -WindowStyle Normal

        Start-Sleep -Seconds 5
        Write-Success "Expo iniciado. Verifique a janela do terminal."
        return $true
    } finally {
        Pop-Location
    }
}

function Stop-AllServices {
    Write-Header "PARANDO TODOS OS SERVICOS"

    $portsToStop = @($PORTS.Backend, $PORTS.Web, $PORTS.Metro, $PORTS.Expo, $PORTS.PdfService)

    foreach ($port in $portsToStop) {
        if (Test-Port -Port $port) {
            Stop-ProcessOnPort -Port $port -ServiceName "Servico"
        }
    }

    # Parar todos os processos node restantes relacionados ao projeto
    Get-Process -Name "node" -ErrorAction SilentlyContinue | ForEach-Object {
        $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)" -ErrorAction SilentlyContinue).CommandLine
        if ($cmdLine -match "Nova pasta" -or $cmdLine -match "nest" -or $cmdLine -match "next" -or $cmdLine -match "expo") {
            Write-Info "Parando processo Node (PID: $($_.Id))..."
            Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
        }
    }

    Write-Success "Servicos parados"
}

function Get-Status {
    Write-Header "STATUS DOS SERVICOS"

    $services = @(
        @{Name="PostgreSQL"; Port=$PORTS.Postgres},
        @{Name="Redis"; Port=$PORTS.Redis},
        @{Name="Backend API"; Port=$PORTS.Backend},
        @{Name="Web Frontend"; Port=$PORTS.Web},
        @{Name="Metro Bundler"; Port=$PORTS.Metro},
        @{Name="Expo DevTools"; Port=$PORTS.Expo},
        @{Name="PDF Service"; Port=$PORTS.PdfService}
    )

    Write-Host ""
    Write-Host "Servico          Porta    Status" -ForegroundColor White
    Write-Host "---------------- -------- --------" -ForegroundColor Gray

    foreach ($svc in $services) {
        $status = if (Test-Port -Port $svc.Port) { "RUNNING" } else { "STOPPED" }
        $color = if ($status -eq "RUNNING") { "Green" } else { "Red" }
        $name = $svc.Name.PadRight(16)
        $port = $svc.Port.ToString().PadRight(8)
        Write-Host "$name $port " -NoNewline
        Write-Host $status -ForegroundColor $color
    }
    Write-Host ""
}

function Clear-AllCaches {
    Write-Header "LIMPANDO CACHES"

    # Parar servicos primeiro
    Stop-AllServices

    # Limpar cache do Metro
    $metroCache = "$env:TEMP\metro-*"
    if (Test-Path $metroCache) {
        Write-Info "Limpando cache do Metro..."
        Remove-Item -Path $metroCache -Recurse -Force -ErrorAction SilentlyContinue
    }

    # Limpar .expo
    $expoCache = "$ROOT_DIR\apps\mobile\.expo"
    if (Test-Path $expoCache) {
        Write-Info "Limpando cache do Expo..."
        Remove-Item -Path $expoCache -Recurse -Force -ErrorAction SilentlyContinue
    }

    # Limpar .next
    $nextCache = "$ROOT_DIR\apps\web\.next"
    if (Test-Path $nextCache) {
        Write-Info "Limpando cache do Next.js..."
        Remove-Item -Path $nextCache -Recurse -Force -ErrorAction SilentlyContinue
    }

    # Limpar dist do backend
    $backendDist = "$ROOT_DIR\apps\backend\dist"
    if (Test-Path $backendDist) {
        Write-Info "Limpando dist do Backend..."
        Remove-Item -Path $backendDist -Recurse -Force -ErrorAction SilentlyContinue
    }

    Write-Success "Caches limpos"
}

function Show-Help {
    Write-Host @"

========================================
  SCRIPT DE DESENVOLVIMENTO - MONOREPO
========================================

USO: .\scripts\dev.ps1 <comando>

COMANDOS:
  start     Iniciar TODOS os servicos (infra + backend + web + mobile)
  stop      Parar todos os servicos
  restart   Reiniciar todos os servicos
  status    Mostrar status de todos os servicos
  clean     Limpar todos os caches e parar servicos

  infra     Iniciar apenas infraestrutura (PostgreSQL + Redis)
  backend   Iniciar apenas o backend
  web       Iniciar apenas o frontend web
  mobile    Iniciar apenas o Expo/Mobile

  help      Mostrar esta ajuda

EXEMPLOS:
  .\scripts\dev.ps1 start      # Iniciar tudo
  .\scripts\dev.ps1 status     # Ver status
  .\scripts\dev.ps1 backend    # Iniciar so o backend
  .\scripts\dev.ps1 clean      # Limpar caches

PORTAS UTILIZADAS:
  Backend API:    3001
  Web Frontend:   3000
  PostgreSQL:     5432
  Redis:          6379
  Metro Bundler:  8081
  Expo DevTools:  19000
  PDF Service:    3002

"@
}

# ============================================
# Main
# ============================================

switch ($Command) {
    "start" {
        Write-Header "INICIANDO AMBIENTE DE DESENVOLVIMENTO"
        Start-Infrastructure
        Start-Sleep -Seconds 2
        Start-Backend
        Start-Sleep -Seconds 2
        Start-Web
        Start-Sleep -Seconds 2
        Start-Mobile
        Write-Host ""
        Get-Status
        Write-Success "Ambiente iniciado!"
        Write-Host ""
        Write-Host "URLs:" -ForegroundColor Cyan
        Write-Host "  Backend API:  http://localhost:3001" -ForegroundColor White
        Write-Host "  Web Frontend: http://localhost:3000" -ForegroundColor White
        Write-Host "  Expo:         exp://localhost:19000" -ForegroundColor White
    }
    "stop" {
        Stop-AllServices
        Stop-Infrastructure
    }
    "restart" {
        Stop-AllServices
        Stop-Infrastructure
        Start-Sleep -Seconds 2
        & $PSCommandPath start
    }
    "status" {
        Get-Status
    }
    "clean" {
        Clear-AllCaches
        Stop-Infrastructure
        Write-Success "Limpeza completa!"
    }
    "infra" {
        Start-Infrastructure
    }
    "backend" {
        Start-Backend
    }
    "web" {
        Start-Web
    }
    "mobile" {
        Start-Mobile
    }
    "help" {
        Show-Help
    }
}
