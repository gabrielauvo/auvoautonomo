# ============================================
# HEALTH CHECK - Verificacao de Servicos
# ============================================

param(
    [switch]$Verbose,
    [switch]$Wait
)

$PORTS = @{
    Backend = 3001
    Web = 3000
    Postgres = 5432
    Redis = 6379
}

function Test-ServiceHealth {
    param(
        [string]$Name,
        [int]$Port,
        [string]$HealthEndpoint = ""
    )

    $result = @{
        Name = $Name
        Port = $Port
        Status = "UNKNOWN"
        ResponseTime = 0
        Details = ""
    }

    # Check port
    $connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if (-not $connection) {
        $result.Status = "DOWN"
        $result.Details = "Port not listening"
        return $result
    }

    # If health endpoint provided, check it
    if ($HealthEndpoint) {
        try {
            $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
            $response = Invoke-WebRequest -Uri $HealthEndpoint -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
            $stopwatch.Stop()

            $result.ResponseTime = $stopwatch.ElapsedMilliseconds
            if ($response.StatusCode -eq 200) {
                $result.Status = "HEALTHY"
                $result.Details = "HTTP 200 OK"
            } else {
                $result.Status = "DEGRADED"
                $result.Details = "HTTP $($response.StatusCode)"
            }
        } catch {
            $result.Status = "UNHEALTHY"
            $result.Details = $_.Exception.Message
        }
    } else {
        $result.Status = "RUNNING"
        $result.Details = "Port is open"
    }

    return $result
}

function Show-HealthReport {
    $services = @(
        @{Name="PostgreSQL"; Port=5432; Health=""},
        @{Name="Redis"; Port=6379; Health=""},
        @{Name="Backend API"; Port=3001; Health="http://localhost:3001/health"},
        @{Name="Web Frontend"; Port=3000; Health="http://localhost:3000/"}
    )

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  HEALTH CHECK - $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""

    $allHealthy = $true

    foreach ($svc in $services) {
        $health = Test-ServiceHealth -Name $svc.Name -Port $svc.Port -HealthEndpoint $svc.Health

        $statusColor = switch ($health.Status) {
            "HEALTHY" { "Green" }
            "RUNNING" { "Green" }
            "DEGRADED" { "Yellow" }
            "UNHEALTHY" { "Red" }
            "DOWN" { "Red" }
            default { "Gray" }
        }

        if ($health.Status -in @("DOWN", "UNHEALTHY")) {
            $allHealthy = $false
        }

        $name = $health.Name.PadRight(16)
        $port = $health.Port.ToString().PadRight(6)
        $status = $health.Status.PadRight(10)

        Write-Host "  $name " -NoNewline
        Write-Host ":$port " -NoNewline -ForegroundColor Gray
        Write-Host $status -NoNewline -ForegroundColor $statusColor

        if ($Verbose -and $health.ResponseTime -gt 0) {
            Write-Host " ($($health.ResponseTime)ms)" -NoNewline -ForegroundColor Gray
        }
        Write-Host ""
    }

    Write-Host ""
    return $allHealthy
}

# Main
if ($Wait) {
    Write-Host "Aguardando servicos ficarem saudaveis..." -ForegroundColor Yellow
    $attempts = 0
    $maxAttempts = 60

    while ($attempts -lt $maxAttempts) {
        $healthy = Show-HealthReport
        if ($healthy) {
            Write-Host "Todos os servicos estao saudaveis!" -ForegroundColor Green
            exit 0
        }
        Start-Sleep -Seconds 2
        $attempts++
        Clear-Host
    }

    Write-Host "Timeout esperando servicos" -ForegroundColor Red
    exit 1
} else {
    $healthy = Show-HealthReport
    if (-not $healthy) {
        exit 1
    }
}
