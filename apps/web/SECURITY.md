# Segurança do Frontend - Apps/Web

## Visão Geral

Este documento descreve as medidas de segurança implementadas no frontend Next.js para suportar 1M+ usuários de forma segura.

## Índice

1. [Autenticação Segura](#autenticação-segura)
2. [Proteção CSRF](#proteção-csrf)
3. [Sanitização de Inputs](#sanitização-de-inputs)
4. [Validação de Uploads](#validação-de-uploads)
5. [Headers de Segurança](#headers-de-segurança)
6. [Prevenção de Open Redirect](#prevenção-de-open-redirect)
7. [Rate Limiting](#rate-limiting)

---

## Autenticação Segura

### HttpOnly Cookies

**Problema**: Tokens em localStorage são vulneráveis a ataques XSS.

**Solução**: Tokens armazenados em cookies HttpOnly gerenciados pelo servidor.

#### API Routes Criadas

```typescript
// Login - POST /api/auth/login
// Armazena token em cookie HttpOnly, Secure, SameSite=Strict

// Logout - POST /api/auth/logout
// Remove cookies de autenticação

// Refresh - POST /api/auth/refresh
// Renova access token usando refresh token
```

#### Como Usar

```typescript
import { login, logout } from '@/services/auth.service';

// Login
const { user } = await login({ email, password });
// Token é armazenado automaticamente em HttpOnly cookie

// Logout
await logout();
// Cookies são removidos
```

#### Configuração

```typescript
// apps/web/src/services/api.ts
export const api = axios.create({
  withCredentials: true, // Envia cookies automaticamente
});
```

### Migração de Código Legado

Se você tem código que usa `getToken()` ou `setToken()`:

```typescript
// ❌ ANTIGO (inseguro)
const token = getToken();
api.defaults.headers.Authorization = `Bearer ${token}`;

// ✅ NOVO (seguro)
// Não precisa fazer nada! O cookie é enviado automaticamente
await api.get('/endpoint');
```

---

## Proteção CSRF

### Token CSRF

**Problema**: Ataques CSRF permitem que sites maliciosos façam requisições autenticadas.

**Solução**: Token CSRF único por sessão, validado no servidor.

#### API Route

```typescript
// GET /api/csrf-token
// Retorna token CSRF e armazena em cookie HttpOnly
```

#### Hook useCSRFToken

```typescript
import { useCSRFToken } from '@/hooks';

function MyForm() {
  const { csrfToken, loading, error } = useCSRFToken();

  const handleSubmit = async (data) => {
    await fetch('/api/endpoint', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken, // ⚠️ IMPORTANTE
      },
      body: JSON.stringify(data),
    });
  };

  if (loading) return <div>Carregando...</div>;
  if (error) return <div>Erro ao carregar token</div>;

  return <form onSubmit={handleSubmit}>...</form>;
}
```

#### Helpers

```typescript
import { addCSRFHeader, addCSRFToFormData } from '@/hooks';

// Para headers
const headers = addCSRFHeader(
  { 'Content-Type': 'application/json' },
  csrfToken
);

// Para FormData
const formData = addCSRFToFormData(new FormData(), csrfToken);
```

### Onde Usar CSRF

✅ **Sempre use em**:
- Formulários de POST/PUT/DELETE
- Uploads de arquivos
- Ações que modificam dados

❌ **Não precisa em**:
- Requisições GET (idempotentes)
- APIs públicas sem autenticação

---

## Sanitização de Inputs

### Biblioteca de Sanitização

Localização: `apps/web/src/lib/sanitize.ts`

#### Sanitizar HTML

```typescript
import { sanitizeHtml } from '@/lib/sanitize';

const userInput = '<script>alert("xss")</script><p>Hello</p>';
const safe = sanitizeHtml(userInput); // '<p>Hello</p>'
```

#### Validar URLs

```typescript
import { sanitizeUrl } from '@/lib/sanitize';

// Previne javascript:, data:, etc
const url = sanitizeUrl('javascript:alert(1)'); // null
const url = sanitizeUrl('https://example.com'); // 'https://example.com'
```

#### Validar Redirects (Previne Open Redirect)

```typescript
import { validateRedirectUrl } from '@/lib/sanitize';

// Apenas permite URLs internas
const url = validateRedirectUrl('/dashboard'); // '/dashboard'
const url = validateRedirectUrl('https://evil.com'); // null

// Com whitelist de domínios
const url = validateRedirectUrl(
  'https://auvo.com',
  ['auvo.com']
); // 'https://auvo.com'
```

#### Sanitizar Nomes de Arquivo

```typescript
import { sanitizeFileName } from '@/lib/sanitize';

const filename = sanitizeFileName('../../etc/passwd'); // 'etc_passwd'
const filename = sanitizeFileName('<script>.pdf'); // 'script.pdf'
```

---

## Validação de Uploads

### Validação Completa de Arquivos

```typescript
import { validateFileUpload } from '@/lib/sanitize';

const result = validateFileUpload(file, {
  maxSizeMB: 10,
  allowedExtensions: ['jpg', 'png', 'pdf'],
  allowedMimeTypes: ['image/*', 'application/pdf'],
});

if (!result.valid) {
  console.error(result.error);
  return;
}

// Usa nome sanitizado
const safeFile = new File([file], result.sanitizedName, { type: file.type });
```

### Exemplo em Service

```typescript
// apps/web/src/services/work-orders.service.ts
export async function uploadWorkOrderAttachment(
  workOrderId: string,
  file: File
): Promise<Attachment> {
  const { validateFileUpload } = await import('@/lib/sanitize');

  // Validação de segurança
  const validation = validateFileUpload(file, {
    maxSizeMB: 10,
    allowedExtensions: ['jpg', 'jpeg', 'png', 'pdf'],
    allowedMimeTypes: ['image/*', 'application/pdf'],
  });

  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Nome sanitizado
  const safeFile = new File([file], validation.sanitizedName, {
    type: file.type
  });

  // Upload
  const formData = new FormData();
  formData.append('file', safeFile);
  // ...
}
```

### Validações Aplicadas

- ✅ Tipo MIME (previne spoofing)
- ✅ Extensão do arquivo
- ✅ Tamanho máximo
- ✅ Nome do arquivo (path traversal)
- ✅ Null bytes no nome

---

## Headers de Segurança

### Content Security Policy (CSP)

Localização: `apps/web/next.config.js`

```javascript
const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' ${isDev ? "'unsafe-eval' 'unsafe-inline'" : ''};
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https:;
  font-src 'self' data:;
  connect-src 'self' ${API_URL} https://wa.me;
  frame-src 'none';
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  object-src 'none';
  upgrade-insecure-requests;
`;
```

### Headers Aplicados

```javascript
{
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()...',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Content-Security-Policy': '...'
}
```

### O que cada header faz

| Header | Proteção |
|--------|----------|
| X-Content-Type-Options | MIME sniffing attacks |
| X-Frame-Options | Clickjacking |
| X-XSS-Protection | XSS (navegadores antigos) |
| Referrer-Policy | Vazamento de informações |
| Permissions-Policy | Abuso de APIs do browser |
| Strict-Transport-Security | Man-in-the-middle (HTTP) |
| Content-Security-Policy | XSS, injection, data theft |

---

## Prevenção de Open Redirect

### Problema

```typescript
// ❌ VULNERÁVEL
const redirect = req.query.next;
window.location.href = redirect; // https://evil.com
```

### Solução

```typescript
import { validateRedirectUrl } from '@/lib/sanitize';

// ✅ SEGURO
const next = req.query.next as string;
const safeUrl = validateRedirectUrl(next, ['auvo.com']);

if (safeUrl) {
  window.location.href = safeUrl;
} else {
  window.location.href = '/dashboard'; // fallback
}
```

### Regras

1. URLs internas (`/path`) sempre permitidas
2. URLs externas precisam estar na whitelist
3. Previne `..` (path traversal)
4. Apenas http/https permitidos
5. Não permite credenciais na URL

---

## Rate Limiting

### Implementação

Localização: `apps/web/src/lib/security.ts`

```typescript
import { rateLimiters } from '@/lib/security';

// Verifica rate limit
if (!rateLimiters.login.check(clientIP)) {
  return res.status(429).json({
    message: 'Muitas tentativas. Aguarde 1 minuto.'
  });
}
```

### Limiters Disponíveis

```typescript
rateLimiters.api;      // 100 req/min (geral)
rateLimiters.login;    // 5 tentativas/min
rateLimiters.upload;   // 10 uploads/min
rateLimiters.csrf;     // 20 req/min
```

### Como Adicionar em API Route

```typescript
import { rateLimiters, getClientIP } from '@/lib/security';

export async function POST(request: NextRequest) {
  const clientIP = getClientIP(request.headers);

  if (!rateLimiters.api.check(clientIP)) {
    return NextResponse.json(
      { message: 'Too many requests' },
      { status: 429 }
    );
  }

  // ... resto do código
}
```

---

## Outras Funcionalidades de Segurança

### Validação de Email

```typescript
import { isValidEmail } from '@/lib/security';

if (!isValidEmail(email)) {
  throw new Error('Email inválido');
}
```

### Validação de UUID

```typescript
import { isValidUUID } from '@/lib/security';

if (!isValidUUID(id)) {
  throw new Error('ID inválido');
}
```

### Validação de Senha Forte

```typescript
import { validateStrongPassword } from '@/lib/security';

const result = validateStrongPassword(password);

if (!result.valid) {
  console.error(result.errors);
  // ['Senha deve ter no mínimo 8 caracteres', ...]
}
```

### Mascaramento de Dados Sensíveis

```typescript
import { maskSensitiveData } from '@/lib/security';

const masked = maskSensitiveData('12345678901', 'cpf');
// '***.***.***-01'

const masked = maskSensitiveData('user@example.com', 'email');
// 'u***@example.com'
```

---

## Checklist de Segurança

Antes de fazer deploy, verifique:

### Autenticação
- [ ] Login usa `/api/auth/login` (HttpOnly cookies)
- [ ] Logout usa `/api/auth/logout`
- [ ] Refresh token implementado
- [ ] `withCredentials: true` no axios
- [ ] Não usa `localStorage` para tokens

### CSRF
- [ ] Hook `useCSRFToken` em formulários POST/PUT/DELETE
- [ ] Token enviado no header `X-CSRF-Token`
- [ ] Validação no servidor (backend)

### Uploads
- [ ] Validação de tipo MIME
- [ ] Validação de extensão
- [ ] Tamanho máximo definido
- [ ] Nome de arquivo sanitizado
- [ ] Usa `validateFileUpload()`

### URLs e Redirects
- [ ] URLs externas validadas com `sanitizeUrl()`
- [ ] Redirects validados com `validateRedirectUrl()`
- [ ] Whitelist de domínios definida

### Headers
- [ ] CSP configurado em `next.config.js`
- [ ] HSTS habilitado em produção
- [ ] `poweredByHeader: false`

### Rate Limiting
- [ ] Rate limiting em login
- [ ] Rate limiting em uploads
- [ ] Rate limiting em APIs sensíveis

---

## Recursos Adicionais

### Arquivos Importantes

```
apps/web/
├── src/
│   ├── app/
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── login/route.ts
│   │       │   ├── logout/route.ts
│   │       │   └── refresh/route.ts
│   │       └── csrf-token/route.ts
│   ├── lib/
│   │   ├── sanitize.ts       # Sanitização e validação
│   │   └── security.ts       # CSRF, rate limiting, etc
│   ├── hooks/
│   │   └── use-csrf-token.ts # Hook de CSRF
│   └── services/
│       ├── api.ts            # Cliente HTTP (withCredentials)
│       └── auth.service.ts   # Autenticação
├── next.config.js            # Headers de segurança
└── SECURITY.md               # Este arquivo
```

### Links Úteis

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security](https://nextjs.org/docs/advanced-features/security-headers)
- [CSP Generator](https://report-uri.com/home/generate)

---

## Suporte

Para dúvidas ou reportar vulnerabilidades, entre em contato com a equipe de segurança.

**IMPORTANTE**: Nunca faça commit de:
- Tokens de produção
- Chaves de API
- Senhas ou secrets
- Dados sensíveis de usuários
