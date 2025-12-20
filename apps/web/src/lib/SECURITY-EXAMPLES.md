# Exemplos de Uso - Funcionalidades de Segurança

Este documento contém exemplos práticos de como usar as funcionalidades de segurança implementadas.

## Índice

1. [Formulários com CSRF](#formulários-com-csrf)
2. [Upload de Arquivos](#upload-de-arquivos)
3. [Validação de Inputs](#validação-de-inputs)
4. [Redirects Seguros](#redirects-seguros)
5. [Autenticação](#autenticação)

---

## Formulários com CSRF

### Exemplo 1: Formulário de Criação

```tsx
'use client';

import { useState } from 'react';
import { useCSRFToken } from '@/hooks';

export function CreateClientForm() {
  const { csrfToken, loading } = useCSRFToken();
  const [formData, setFormData] = useState({ name: '', email: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!csrfToken) {
      alert('Token CSRF não disponível');
      return;
    }

    try {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken, // ⚠️ IMPORTANTE
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Erro ao criar cliente');

      const data = await response.json();
      console.log('Cliente criado:', data);
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) return <div>Carregando...</div>;

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        placeholder="Nome"
      />
      <input
        type="email"
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        placeholder="Email"
      />
      <button type="submit">Criar Cliente</button>
    </form>
  );
}
```

### Exemplo 2: Formulário com Helper

```tsx
import { useCSRFToken, addCSRFHeader } from '@/hooks';

export function UpdateProfileForm() {
  const { csrfToken } = useCSRFToken();

  const handleSubmit = async (data: any) => {
    const headers = addCSRFHeader(
      { 'Content-Type': 'application/json' },
      csrfToken
    );

    await fetch('/api/profile', {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });
  };

  // ...
}
```

---

## Upload de Arquivos

### Exemplo 1: Upload com Validação

```tsx
'use client';

import { useState } from 'react';
import { validateFileUpload } from '@/lib/sanitize';
import { useCSRFToken, addCSRFToFormData } from '@/hooks';

export function AvatarUpload() {
  const { csrfToken } = useCSRFToken();
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validação de segurança
    const validation = validateFileUpload(file, {
      maxSizeMB: 5,
      allowedExtensions: ['jpg', 'jpeg', 'png'],
      allowedMimeTypes: ['image/jpeg', 'image/png'],
    });

    if (!validation.valid) {
      setError(validation.error || 'Arquivo inválido');
      return;
    }

    try {
      // Arquivo com nome sanitizado
      const safeFile = new File(
        [file],
        validation.sanitizedName || file.name,
        { type: file.type }
      );

      // FormData com CSRF
      const formData = new FormData();
      formData.append('avatar', safeFile);
      const secureFormData = addCSRFToFormData(formData, csrfToken);

      const response = await fetch('/api/upload/avatar', {
        method: 'POST',
        body: secureFormData,
      });

      if (!response.ok) throw new Error('Erro ao fazer upload');

      const data = await response.json();
      console.log('Avatar atualizado:', data.avatarUrl);
    } catch (err) {
      setError('Erro ao fazer upload');
    }
  };

  return (
    <div>
      <input type="file" accept="image/*" onChange={handleFileChange} />
      {error && <p className="text-red-500">{error}</p>}
    </div>
  );
}
```

### Exemplo 2: Upload Múltiplo

```tsx
import { validateFileUpload } from '@/lib/sanitize';

export function DocumentUpload() {
  const handleFiles = async (files: FileList) => {
    const validFiles: File[] = [];
    const errors: string[] = [];

    // Valida cada arquivo
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      const validation = validateFileUpload(file, {
        maxSizeMB: 10,
        allowedExtensions: ['pdf', 'doc', 'docx'],
        allowedMimeTypes: ['application/pdf', 'application/msword'],
      });

      if (validation.valid) {
        const safeFile = new File(
          [file],
          validation.sanitizedName || file.name,
          { type: file.type }
        );
        validFiles.push(safeFile);
      } else {
        errors.push(`${file.name}: ${validation.error}`);
      }
    }

    if (errors.length > 0) {
      alert('Erros:\n' + errors.join('\n'));
    }

    // Upload dos arquivos válidos
    for (const file of validFiles) {
      await uploadFile(file);
    }
  };

  // ...
}
```

---

## Validação de Inputs

### Exemplo 1: Campo de Email

```tsx
import { isValidEmail } from '@/lib/security';

export function EmailInput() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const handleChange = (value: string) => {
    setEmail(value);

    if (value && !isValidEmail(value)) {
      setError('Email inválido');
    } else {
      setError('');
    }
  };

  return (
    <div>
      <input
        type="email"
        value={email}
        onChange={(e) => handleChange(e.target.value)}
      />
      {error && <span className="text-red-500">{error}</span>}
    </div>
  );
}
```

### Exemplo 2: Campo com Sanitização

```tsx
import { sanitizeHtml, removeControlCharacters } from '@/lib/sanitize';

export function RichTextEditor() {
  const [content, setContent] = useState('');

  const handleChange = (html: string) => {
    // Remove caracteres de controle
    const cleaned = removeControlCharacters(html);

    // Sanitiza HTML
    const safe = sanitizeHtml(cleaned);

    setContent(safe);
  };

  const handleSubmit = async () => {
    // content já está sanitizado
    await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
  };

  // ...
}
```

### Exemplo 3: Validação de Senha

```tsx
import { validateStrongPassword } from '@/lib/security';

export function PasswordInput() {
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const handleChange = (value: string) => {
    setPassword(value);

    const validation = validateStrongPassword(value);
    setErrors(validation.errors);
  };

  const isValid = errors.length === 0 && password.length > 0;

  return (
    <div>
      <input
        type="password"
        value={password}
        onChange={(e) => handleChange(e.target.value)}
      />
      {errors.length > 0 && (
        <ul className="text-red-500">
          {errors.map((err, i) => (
            <li key={i}>{err}</li>
          ))}
        </ul>
      )}
      <button disabled={!isValid}>Continuar</button>
    </div>
  );
}
```

---

## Redirects Seguros

### Exemplo 1: Redirect após Login

```tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { validateRedirectUrl } from '@/lib/sanitize';
import { login } from '@/services/auth.service';

export function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleLogin = async (credentials: any) => {
    await login(credentials);

    // Pega URL de redirect dos query params
    const next = searchParams.get('next');

    // Valida redirect
    const safeUrl = validateRedirectUrl(next || '/dashboard');

    // Redireciona para URL segura
    router.push(safeUrl || '/dashboard');
  };

  // ...
}
```

### Exemplo 2: Link Externo Seguro

```tsx
import { sanitizeUrl } from '@/lib/sanitize';

interface ExternalLinkProps {
  href: string;
  children: React.ReactNode;
}

export function ExternalLink({ href, children }: ExternalLinkProps) {
  const safeHref = sanitizeUrl(href, ['http:', 'https:']);

  if (!safeHref) {
    console.warn('URL inválida:', href);
    return <span>{children}</span>;
  }

  return (
    <a
      href={safeHref}
      target="_blank"
      rel="noopener noreferrer" // Importante!
      className="text-blue-600 hover:underline"
    >
      {children}
    </a>
  );
}
```

### Exemplo 3: Whitelist de Domínios

```tsx
import { validateRedirectUrl } from '@/lib/sanitize';

const ALLOWED_DOMAINS = [
  'auvo.com',
  'app.auvo.com',
  'docs.auvo.com',
];

export function SafeRedirect({ url }: { url: string }) {
  const handleRedirect = () => {
    const safeUrl = validateRedirectUrl(url, ALLOWED_DOMAINS);

    if (safeUrl) {
      window.location.href = safeUrl;
    } else {
      alert('Redirecionamento não permitido');
    }
  };

  return <button onClick={handleRedirect}>Ir para {url}</button>;
}
```

---

## Autenticação

### Exemplo 1: Login Component

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/services/auth.service';

export function LoginForm() {
  const router = useRouter();
  const [credentials, setCredentials] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      // Login com HttpOnly cookies
      const { user } = await login(credentials);

      console.log('Logged in as:', user.name);

      // Redireciona
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer login');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={credentials.email}
        onChange={(e) =>
          setCredentials({ ...credentials, email: e.target.value })
        }
        placeholder="Email"
        required
      />
      <input
        type="password"
        value={credentials.password}
        onChange={(e) =>
          setCredentials({ ...credentials, password: e.target.value })
        }
        placeholder="Senha"
        required
      />
      {error && <p className="text-red-500">{error}</p>}
      <button type="submit">Entrar</button>
    </form>
  );
}
```

### Exemplo 2: Logout Component

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { logout } from '@/services/auth.service';

export function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  return <button onClick={handleLogout}>Sair</button>;
}
```

### Exemplo 3: Protected Route

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getProfile } from '@/services/auth.service';

export function ProtectedPage({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Tenta carregar perfil (valida cookie automaticamente)
        await getProfile();
      } catch (error) {
        // Se falhar, redireciona para login
        router.push('/login?next=' + window.location.pathname);
      }
    };

    checkAuth();
  }, [router]);

  return <>{children}</>;
}
```

---

## Mascaramento de Dados

### Exemplo: Exibir CPF Mascarado

```tsx
import { maskSensitiveData } from '@/lib/security';

interface UserCardProps {
  user: {
    name: string;
    cpf: string;
    email: string;
  };
}

export function UserCard({ user }: UserCardProps) {
  return (
    <div className="p-4 border rounded">
      <h3>{user.name}</h3>
      <p>CPF: {maskSensitiveData(user.cpf, 'cpf')}</p>
      <p>Email: {maskSensitiveData(user.email, 'email')}</p>
    </div>
  );
}
```

---

## Combinando Funcionalidades

### Exemplo Completo: Formulário de Cadastro

```tsx
'use client';

import { useState } from 'react';
import { useCSRFToken, addCSRFHeader } from '@/hooks';
import {
  isValidEmail,
  validateStrongPassword,
  sanitizeFileName,
  validateFileUpload,
} from '@/lib/sanitize';

export function SignupForm() {
  const { csrfToken } = useCSRFToken();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });

  const [avatar, setAvatar] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Email
    if (!isValidEmail(formData.email)) {
      newErrors.email = 'Email inválido';
    }

    // Senha
    const passwordValidation = validateStrongPassword(formData.password);
    if (!passwordValidation.valid) {
      newErrors.password = passwordValidation.errors[0];
    }

    // Avatar
    if (avatar) {
      const validation = validateFileUpload(avatar, {
        maxSizeMB: 5,
        allowedExtensions: ['jpg', 'jpeg', 'png'],
        allowedMimeTypes: ['image/*'],
      });

      if (!validation.valid) {
        newErrors.avatar = validation.error || 'Avatar inválido';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      // 1. Cria usuário
      const headers = addCSRFHeader(
        { 'Content-Type': 'application/json' },
        csrfToken
      );

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers,
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Erro ao criar conta');

      const { userId } = await response.json();

      // 2. Upload avatar (se tiver)
      if (avatar) {
        const formData = new FormData();
        formData.append('avatar', avatar);
        formData.append('userId', userId);

        if (csrfToken) {
          formData.append('_csrf', csrfToken);
        }

        await fetch('/api/upload/avatar', {
          method: 'POST',
          body: formData,
        });
      }

      // Sucesso!
      window.location.href = '/dashboard';
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Nome completo"
          required
        />
      </div>

      <div>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          placeholder="Email"
          required
        />
        {errors.email && <span className="text-red-500">{errors.email}</span>}
      </div>

      <div>
        <input
          type="password"
          value={formData.password}
          onChange={(e) =>
            setFormData({ ...formData, password: e.target.value })
          }
          placeholder="Senha"
          required
        />
        {errors.password && (
          <span className="text-red-500">{errors.password}</span>
        )}
      </div>

      <div>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setAvatar(e.target.files?.[0] || null)}
        />
        {errors.avatar && <span className="text-red-500">{errors.avatar}</span>}
      </div>

      <button type="submit">Criar Conta</button>
    </form>
  );
}
```

---

## Dicas Finais

### ✅ Sempre Faça

1. Valide todos os inputs do usuário
2. Sanitize HTML antes de renderizar
3. Use CSRF em formulários POST/PUT/DELETE
4. Valide arquivos antes de upload
5. Valide redirects e URLs externas

### ❌ Nunca Faça

1. Confie em dados do cliente sem validação
2. Armazene tokens em localStorage
3. Use `dangerouslySetInnerHTML` sem sanitizar
4. Aceite qualquer tipo de arquivo em upload
5. Permita redirects para URLs arbitrárias

### 🔒 Segurança em Camadas

```
┌─────────────────────────────────┐
│   Frontend (Validação UX)       │
│   - Valida formato              │
│   - Sanitiza inputs             │
│   - CSRF tokens                 │
└─────────────────────────────────┘
           ↓ (HTTPS)
┌─────────────────────────────────┐
│   API Routes (Validação)        │
│   - Valida novamente            │
│   - Rate limiting               │
│   - Autentica/Autoriza          │
└─────────────────────────────────┘
           ↓
┌─────────────────────────────────┐
│   Backend (Validação Final)     │
│   - Validação de negócio        │
│   - Sanitiza antes de DB        │
│   - Logs de auditoria           │
└─────────────────────────────────┘
```

Nunca confie apenas na validação do frontend!
