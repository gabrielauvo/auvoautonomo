@echo off
REM ============================================
REM SCRIPT DE DESENVOLVIMENTO - Windows CMD
REM ============================================
REM Wrapper para executar o script PowerShell
REM Uso: scripts\dev.cmd [comando]
REM ============================================

setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
set "COMMAND=%~1"

if "%COMMAND%"=="" set "COMMAND=help"

REM Verificar se PowerShell esta disponivel
where powershell >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] PowerShell nao encontrado
    exit /b 1
)

REM Executar script PowerShell
powershell -ExecutionPolicy Bypass -File "%SCRIPT_DIR%dev.ps1" %*

endlocal
