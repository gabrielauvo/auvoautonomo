# Auvo Field - Release Playbook

Este documento descreve o processo completo de build, assinatura e distribuição do aplicativo Auvo Field.

## Sumário

1. [Pré-requisitos](#1-pré-requisitos)
2. [Configuração Inicial](#2-configuração-inicial)
3. [Perfis de Build](#3-perfis-de-build)
4. [Build Android](#4-build-android)
5. [Build iOS](#5-build-ios)
6. [CI/CD](#6-cicd)
7. [Distribuição](#7-distribuição)
8. [Versionamento](#8-versionamento)
9. [Credenciais](#9-credenciais)
10. [Troubleshooting](#10-troubleshooting)
11. [Checklist de Release](#11-checklist-de-release)

---

## 1. Pré-requisitos

### Contas Necessárias

| Serviço | URL | Propósito |
|---------|-----|-----------|
| Expo | https://expo.dev | EAS Build e Submit |
| Apple Developer | https://developer.apple.com | iOS builds e TestFlight |
| App Store Connect | https://appstoreconnect.apple.com | Distribuição iOS |
| Google Play Console | https://play.google.com/console | Distribuição Android |

### Ferramentas Locais

```bash
# Node.js 20+
node --version

# pnpm
npm install -g pnpm

# EAS CLI
npm install -g eas-cli

# Login no Expo
eas login
```

---

## 2. Configuração Inicial

### 2.1 Configurar projeto no Expo

```bash
# Na pasta apps/mobile
cd apps/mobile

# Criar projeto no Expo (apenas primeira vez)
eas init

# Verificar configuração
eas config
```

### 2.2 Configurar credenciais

```bash
# Android - gera e armazena keystore no EAS
eas credentials --platform android

# iOS - configura certificados e provisioning profiles
eas credentials --platform ios
```

### 2.3 Variáveis de ambiente

Copie `.env.example` para `.env.local` e configure:

```bash
cp .env.example .env.local
```

Para CI/CD, configure os secrets no GitHub:
- `EXPO_TOKEN`
- `APPLE_ID`
- `ASC_APP_ID`
- `APPLE_TEAM_ID`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_KEY`

---

## 3. Perfis de Build

### Resumo dos Perfis

| Perfil | Ambiente | Android | iOS | Uso |
|--------|----------|---------|-----|-----|
| `development` | dev | APK (debug) | Simulator | Desenvolvimento local |
| `preview` | preview | APK (release) | Internal | QA e testes |
| `preview-aab` | preview | AAB | - | Play Store Internal |
| `production` | prod | AAB | App Store | Release final |

### Variáveis por Perfil

| Variável | development | preview | production |
|----------|-------------|---------|------------|
| `EXPO_PUBLIC_ENV` | development | preview | production |
| `EXPO_PUBLIC_API_URL` | localhost:3001 | api-preview.auvo.app | api.auvo.app |

---

## 4. Build Android

### 4.1 APK para teste (Preview)

```bash
# Gera APK release para instalação direta
eas build --profile preview --platform android

# Ou usando o script
./scripts/build-android.sh preview
```

### 4.2 AAB para Play Store

```bash
# Gera AAB para upload no Play Console
eas build --profile production --platform android

# Ou usando o script
./scripts/build-android.sh production
```

### 4.3 Listar builds

```bash
# Ver builds recentes
eas build:list --platform android

# Ver detalhes de um build
eas build:view [BUILD_ID]
```

### 4.4 Download do APK/AAB

```bash
# Download pelo CLI
eas build:download --platform android

# Ou pelo link no output do build
```

---

## 5. Build iOS

### 5.1 Simulator (Development)

```bash
eas build --profile development --platform ios
```

### 5.2 Internal Distribution (Preview)

```bash
# Para testers internos via link
eas build --profile preview --platform ios
```

### 5.3 App Store (Production)

```bash
# Para TestFlight e App Store
eas build --profile production --platform ios
```

### 5.4 Submit para TestFlight

```bash
# Após build production
eas submit --platform ios --profile production
```

---

## 6. CI/CD

### 6.1 Trigger automático

| Evento | Ação |
|--------|------|
| Push para `main`/`develop` | Build preview |
| Pull Request | Lint + Testes |
| Release tag | Build production + Submit |

### 6.2 Build manual

1. Vá para **Actions** no GitHub
2. Selecione **Mobile CI/CD**
3. Clique em **Run workflow**
4. Escolha profile e platform

### 6.3 Secrets necessários

Configure em **Settings > Secrets and variables > Actions**:

```
EXPO_TOKEN=...
APPLE_ID=...
ASC_APP_ID=...
APPLE_TEAM_ID=...
GOOGLE_PLAY_SERVICE_ACCOUNT_KEY=...
```

---

## 7. Distribuição

### 7.1 Android - Play Console

1. Acesse [Play Console](https://play.google.com/console)
2. Selecione o app
3. Vá em **Release > Testing > Internal testing**
4. Crie um novo release
5. Upload do AAB
6. Adicione testers

Ou via CLI:
```bash
eas submit --platform android --profile production
```

### 7.2 iOS - TestFlight

1. Build vai automaticamente para TestFlight após `eas submit`
2. Acesse [App Store Connect](https://appstoreconnect.apple.com)
3. Aguarde processamento (~30 min)
4. Adicione testers externos se necessário

### 7.3 Links diretos (Preview)

Para builds preview, EAS gera links de download:
- Android: Link para APK
- iOS: Link para instalação (requer device registrado)

---

## 8. Versionamento

### 8.1 Política de versão

```
version: MAJOR.MINOR.PATCH (ex: 1.2.3)
buildNumber: Auto-incrementado pelo EAS
```

### 8.2 Quando incrementar

| Mudança | Ação |
|---------|------|
| Breaking change | MAJOR (1.0.0 → 2.0.0) |
| Nova feature | MINOR (1.0.0 → 1.1.0) |
| Bug fix | PATCH (1.0.0 → 1.0.1) |

### 8.3 Atualizar versão

```bash
# Editar app.config.ts
version: '1.1.0'

# buildNumber é auto-incrementado pelo EAS
```

---

## 9. Credenciais

### 9.1 Onde ficam armazenadas

| Credencial | Local | Acesso |
|------------|-------|--------|
| Android Keystore | EAS Credentials | `eas credentials -p android` |
| iOS Cert/Profile | EAS Credentials | `eas credentials -p ios` |
| Apple API Key | GitHub Secrets | `ASC_API_KEY` |
| Play Service Account | GitHub Secrets | `GOOGLE_PLAY_SERVICE_ACCOUNT_KEY` |

### 9.2 Backup de credenciais

```bash
# Download keystore (backup)
eas credentials --platform android
# Escolha "Download credentials"

# IMPORTANTE: Guarde em local seguro (1Password, etc.)
```

### 9.3 Recuperar credenciais

```bash
# Ver credenciais atuais
eas credentials --platform android

# Resetar e recriar
eas credentials --platform android
# Escolha "Remove credentials"
# Depois rode um build para recriar
```

---

## 10. Troubleshooting

### 10.1 Build falhou

```bash
# Ver logs detalhados
eas build:view [BUILD_ID]

# Problemas comuns:
# - Dependência nativa faltando → verificar plugins
# - Keystore inválido → resetar credentials
# - Provisioning expirado → renovar no Apple Developer
```

### 10.2 Submit rejeitado

| Erro | Solução |
|------|---------|
| Missing Compliance | Marcar como "No encryption" no App Store Connect |
| Invalid bundle | Verificar bundleIdentifier |
| Provisioning mismatch | Resetar credentials iOS |

### 10.3 App não instala

- Android: Verificar se "Fontes desconhecidas" está ativado
- iOS: Verificar se device está no provisioning profile

---

## 11. Checklist de Release

### 11.1 Pré-release

- [ ] Versão atualizada em `app.config.ts`
- [ ] CHANGELOG atualizado
- [ ] Testes passando (`pnpm test`)
- [ ] Build local funcionando
- [ ] Deep links testados
- [ ] Push notifications testadas
- [ ] Sync offline testado

### 11.2 Build

- [ ] Build preview gerado e testado
- [ ] QA aprovou o build
- [ ] Build production gerado

### 11.3 Distribuição

- [ ] Android: AAB enviado ao Play Console
- [ ] Android: Internal testing aprovado
- [ ] iOS: Build no TestFlight
- [ ] iOS: Testers notificados

### 11.4 Pós-release

- [ ] Tag criada no Git (`v1.0.0`)
- [ ] Release notes publicadas
- [ ] Monitoramento de crashes ativo
- [ ] Equipe notificada

---

## Comandos Rápidos

```bash
# Build preview Android (APK)
eas build --profile preview --platform android

# Build preview iOS
eas build --profile preview --platform ios

# Build production Android (AAB)
eas build --profile production --platform android

# Build production iOS
eas build --profile production --platform ios

# Submit Android
eas submit --platform android --profile production

# Submit iOS
eas submit --platform ios --profile production

# Ver credenciais
eas credentials --platform [android|ios]

# Listar builds
eas build:list

# Testes
pnpm test

# Lint
pnpm lint
```

---

## Contatos

- **Expo**: support@expo.dev
- **Apple Developer**: developer.apple.com/contact
- **Google Play**: support.google.com/googleplay/android-developer

---

*Última atualização: 2025-12-13*
