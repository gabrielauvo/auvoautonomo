@echo off
setlocal

echo ========================================
echo   Auvo Field - Android APK Builder
echo ========================================
echo.

REM Configurar variaveis de ambiente
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%PATH%"

REM Verificar se os diretorios existem
if not exist "%JAVA_HOME%" (
    echo ERRO: JAVA_HOME nao encontrado em %JAVA_HOME%
    echo Verifique se o Android Studio esta instalado
    goto :error
)

if not exist "%ANDROID_HOME%" (
    echo ERRO: ANDROID_HOME nao encontrado em %ANDROID_HOME%
    echo Verifique se o Android SDK esta instalado
    goto :error
)

echo Java Home: %JAVA_HOME%
echo Android Home: %ANDROID_HOME%
echo.

REM Ir para o diretorio do script
cd /d "%~dp0"
echo Diretorio: %CD%
echo.

REM Verificar versao do Java
echo Verificando Java...
"%JAVA_HOME%\bin\java" -version
echo.

REM Ir para pasta android e executar Gradle
cd android
echo Iniciando build RELEASE...
echo.
call gradlew.bat assembleRelease --stacktrace

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ========================================
    echo   BUILD FALHOU!
    echo ========================================
    cd ..
    goto :error
)

cd ..

echo.
echo ========================================
echo   BUILD CONCLUIDO COM SUCESSO!
echo ========================================
echo.
echo APK gerado em:
echo android\app\build\outputs\apk\release\app-release.apk
echo.

REM Copiar APK para pasta raiz
if exist "android\app\build\outputs\apk\release\app-release.apk" (
    copy "android\app\build\outputs\apk\release\app-release.apk" "auvo-field-release.apk" >nul
    echo Copiado para: auvo-field-release.apk
)

echo.
pause
exit /b 0

:error
echo.
pause
exit /b 1
