# Auvo Field - Android APK Builder (PowerShell)
# Execute este script no PowerShell como: .\build-apk.ps1

param(
    [switch]$Debug,
    [switch]$Clean,
    [switch]$Install
)

$ErrorActionPreference = "Stop"

Write-Host "========================================"
Write-Host "   Auvo Field - Android APK Builder"
Write-Host "========================================"
Write-Host ""

# Configurar variaveis de ambiente
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:PATH = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:PATH"

# Verificar JAVA_HOME
if (-not (Test-Path $env:JAVA_HOME)) {
    Write-Host "ERRO: JAVA_HOME nao encontrado em $env:JAVA_HOME" -ForegroundColor Red
    Write-Host "Verifique se o Android Studio esta instalado"
    exit 1
}

# Verificar ANDROID_HOME
if (-not (Test-Path $env:ANDROID_HOME)) {
    Write-Host "ERRO: ANDROID_HOME nao encontrado em $env:ANDROID_HOME" -ForegroundColor Red
    Write-Host "Verifique se o Android SDK esta instalado"
    exit 1
}

Write-Host "Java Home: $env:JAVA_HOME" -ForegroundColor Cyan
Write-Host "Android Home: $env:ANDROID_HOME" -ForegroundColor Cyan
Write-Host ""

# Ir para o diretorio do projeto
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir
Write-Host "Diretorio: $(Get-Location)" -ForegroundColor Cyan
Write-Host ""

# Verificar versao do Java
Write-Host "Verificando Java..." -ForegroundColor Yellow
& "$env:JAVA_HOME\bin\java" -version
Write-Host ""

# Limpar build anterior se solicitado
if ($Clean) {
    Write-Host "Limpando build anterior..." -ForegroundColor Yellow
    Set-Location android
    & .\gradlew.bat clean
    Set-Location ..
    Write-Host ""
}

# Definir tipo de build
if ($Debug) {
    $buildType = "Debug"
    $gradleTask = "assembleDebug"
    $apkPath = "app\build\outputs\apk\debug\app-debug.apk"
} else {
    $buildType = "Release"
    $gradleTask = "assembleRelease"
    $apkPath = "app\build\outputs\apk\release\app-release.apk"
}

Write-Host "Iniciando build $buildType..." -ForegroundColor Green
Write-Host ""

# Executar Gradle
Set-Location android
$startTime = Get-Date

try {
    & .\gradlew.bat $gradleTask --stacktrace
    $buildSuccess = $LASTEXITCODE -eq 0
} catch {
    $buildSuccess = $false
    Write-Host "Erro durante o build: $_" -ForegroundColor Red
}

$endTime = Get-Date
$duration = $endTime - $startTime

Set-Location ..

if (-not $buildSuccess) {
    Write-Host ""
    Write-Host "========================================"
    Write-Host "   BUILD FALHOU!" -ForegroundColor Red
    Write-Host "========================================"
    Write-Host ""
    Write-Host "Tempo: $($duration.TotalMinutes.ToString('F2')) minutos"
    exit 1
}

Write-Host ""
Write-Host "========================================"
Write-Host "   BUILD CONCLUIDO COM SUCESSO!" -ForegroundColor Green
Write-Host "========================================"
Write-Host ""
Write-Host "Tempo: $($duration.TotalMinutes.ToString('F2')) minutos" -ForegroundColor Cyan
Write-Host ""
Write-Host "APK gerado em:" -ForegroundColor Cyan
Write-Host "android\$apkPath" -ForegroundColor White
Write-Host ""

# Copiar APK para pasta raiz
$fullApkPath = "android\$apkPath"
if (Test-Path $fullApkPath) {
    $destName = if ($Debug) { "auvo-field-debug.apk" } else { "auvo-field-release.apk" }
    Copy-Item $fullApkPath $destName -Force
    Write-Host "Copiado para: $destName" -ForegroundColor Green

    # Mostrar tamanho do APK
    $apkSize = (Get-Item $destName).Length / 1MB
    Write-Host "Tamanho: $($apkSize.ToString('F2')) MB" -ForegroundColor Cyan
}

# Instalar no dispositivo se solicitado
if ($Install) {
    Write-Host ""
    Write-Host "Instalando APK no dispositivo..." -ForegroundColor Yellow
    & adb install -r $fullApkPath
    if ($LASTEXITCODE -eq 0) {
        Write-Host "APK instalado com sucesso!" -ForegroundColor Green
    } else {
        Write-Host "Falha ao instalar. Verifique se o dispositivo esta conectado." -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "========================================"
Write-Host "   USO DO SCRIPT" -ForegroundColor Cyan
Write-Host "========================================"
Write-Host ""
Write-Host "  .\build-apk.ps1           # Build Release"
Write-Host "  .\build-apk.ps1 -Debug    # Build Debug"
Write-Host "  .\build-apk.ps1 -Clean    # Limpar antes de buildar"
Write-Host "  .\build-apk.ps1 -Install  # Instalar apos build"
Write-Host ""
