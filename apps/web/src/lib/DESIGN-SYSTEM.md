# Auvo Design System

Design System oficial do projeto Auvo, baseado no MaterialPro React v9 e adaptado para a identidade visual da marca.

## Cores

### Brand Colors (Auvo Purple)

A cor primaria e o roxo da logo Auvo `#7C3AED`.

```tsx
// Uso com Tailwind
<div className="bg-primary text-white">Primary</div>
<div className="bg-auvo-600">Logo color</div>

// Escala completa: 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950
```

### Paleta de Cores

| Cor | Uso | Exemplo |
|-----|-----|---------|
| `primary` | Acoes principais, botoes, links | `bg-primary`, `text-primary` |
| `secondary` | Acoes secundarias, destaques | `bg-secondary`, `text-secondary` |
| `success` | Sucesso, aprovado, concluido | `bg-success`, `text-success` |
| `warning` | Atencao, pendente, em andamento | `bg-warning`, `text-warning` |
| `error` | Erro, rejeitado, cancelado | `bg-error`, `text-error` |
| `info` | Informacao, enviado, agendado | `bg-info`, `text-info` |
| `gray` | Neutro, texto, bordas | `bg-gray-100`, `text-gray-500` |

### Status Colors

Cores pre-configuradas para status de entidades de negocio:

```tsx
// Quote Status
draft -> gray
sent -> info
approved -> success
rejected -> error
expired -> warning

// Work Order Status
scheduled -> info
in_progress -> warning
done -> success
canceled -> error

// Payment Status
pending -> warning
confirmed -> info
received -> success
overdue -> error
```

## Tipografia

### Fontes

- **Poppins**: Headings (h1-h6)
- **Inter**: Body text
- **JetBrains Mono**: Code, monospace

```tsx
<h1 className="font-primary">Heading</h1>
<p className="font-sans">Body text</p>
<code className="font-mono">code</code>
```

### Tamanhos

| Class | Size | Line Height |
|-------|------|-------------|
| `text-xs` | 0.75rem (12px) | 1rem |
| `text-sm` | 0.875rem (14px) | 1.25rem |
| `text-base` | 1rem (16px) | 1.5rem |
| `text-lg` | 1.125rem (18px) | 1.75rem |
| `text-xl` | 1.25rem (20px) | 1.75rem |
| `text-2xl` | 1.5rem (24px) | 2rem |
| `text-3xl` | 1.875rem (30px) | 2.25rem |
| `text-4xl` | 2.25rem (36px) | 2.5rem |

## Componentes

### Button

```tsx
import { Button } from '@/components/ui';

// Variants
<Button variant="default">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="success">Success</Button>
<Button variant="error">Error</Button>
<Button variant="outline">Outline</Button>
<Button variant="soft">Soft</Button>
<Button variant="ghost">Ghost</Button>

// Sizes
<Button size="xs">Extra Small</Button>
<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>
<Button size="xl">Extra Large</Button>
<Button size="icon"><Icon /></Button>

// States
<Button loading>Loading...</Button>
<Button disabled>Disabled</Button>
<Button fullWidth>Full Width</Button>

// Icons
<Button leftIcon={<PlusIcon />}>Add</Button>
<Button rightIcon={<ArrowIcon />}>Next</Button>
```

### Card

```tsx
import { Card, DashboardCard } from '@/components/ui';

// Basic Card
<Card variant="default" padding="default">
  Content
</Card>

// Dashboard Card (like MaterialPro)
<DashboardCard
  title="Revenue"
  subtitle="Last 30 days"
  action={<Button size="sm">View All</Button>}
  footer={<span>Updated 5m ago</span>}
>
  <p>$12,500</p>
</DashboardCard>

// Hover effects
<Card hover>Interactive</Card>
<Card hover="lift">Lifts on hover</Card>
<Card hover="glow">Auvo glow effect</Card>
```

### Badge / Status Badge

```tsx
import { Badge, StatusBadge } from '@/components/ui';

// Basic Badge
<Badge variant="default">Label</Badge>
<Badge variant="soft-success">Success</Badge>
<Badge variant="outline">Outline</Badge>

// With dot
<Badge variant="soft-warning" dot>Pending</Badge>

// Removable
<Badge removable onRemove={() => {}}>Tag</Badge>

// Status Badge (pre-configured)
<StatusBadge status="approved" />      // "Aprovado" (green)
<StatusBadge status="in_progress" />   // "Em Andamento" (yellow)
<StatusBadge status="done" />          // "Concluido" (green)
<StatusBadge status="pending" />       // "Pendente" (yellow)
```

### Input

```tsx
import { Input, Textarea, FormField } from '@/components/ui';

// Basic Input
<Input placeholder="Enter text..." />

// Variants
<Input variant="default" />
<Input variant="filled" />

// Sizes
<Input inputSize="sm" />
<Input inputSize="default" />
<Input inputSize="lg" />

// States
<Input error />
<Input success />

// With icons
<Input leftIcon={<SearchIcon />} placeholder="Search..." />
<Input rightIcon={<EyeIcon />} type="password" />

// Form Field (with label, error, hint)
<FormField label="Email" error="Invalid email" required>
  <Input type="email" error />
</FormField>

// Textarea
<Textarea placeholder="Description..." rows={4} />
```

### Avatar

```tsx
import { Avatar, AvatarGroup } from '@/components/ui';

// Basic Avatar
<Avatar src="/avatar.jpg" alt="User" />

// With fallback (initials)
<Avatar fallback="John Doe" />

// Sizes
<Avatar size="xs" />
<Avatar size="sm" />
<Avatar size="default" />
<Avatar size="lg" />
<Avatar size="xl" />

// Variants
<Avatar variant="primary" fallback="JD" />
<Avatar variant="success" fallback="OK" />

// Avatar Group
<AvatarGroup max={3}>
  <Avatar src="/user1.jpg" />
  <Avatar src="/user2.jpg" />
  <Avatar src="/user3.jpg" />
  <Avatar src="/user4.jpg" />
  <Avatar src="/user5.jpg" />
</AvatarGroup>
// Shows: [User1] [User2] [User3] [+2]
```

### Alert

```tsx
import { Alert } from '@/components/ui';

// Filled (default)
<Alert variant="success" title="Success!">
  Your changes have been saved.
</Alert>

// Standard (light background)
<Alert variant="standard-warning" title="Warning">
  Please review before submitting.
</Alert>

// Outlined
<Alert variant="outline-error">
  Something went wrong.
</Alert>

// Dismissible
<Alert variant="info" dismissible onDismiss={() => {}}>
  New feature available!
</Alert>
```

### Spinner / Loading

```tsx
import { Spinner, LoadingOverlay, Skeleton } from '@/components/ui';

// Spinner
<Spinner />
<Spinner size="lg" variant="white" />

// Loading Overlay (wraps content)
<LoadingOverlay loading={isLoading} text="Carregando...">
  <div>Content</div>
</LoadingOverlay>

// Full screen loading
<LoadingOverlay loading fullScreen text="Aguarde..." />

// Skeleton
<Skeleton width={200} height={20} />
<Skeleton variant="circle" width={40} height={40} />
<Skeleton variant="text" width="100%" />
```

## Shadows

```tsx
// Default shadows
<div className="shadow-sm" />
<div className="shadow" />
<div className="shadow-md" />
<div className="shadow-lg" />
<div className="shadow-xl" />

// Auvo brand shadows (purple glow)
<div className="shadow-auvo" />
<div className="shadow-auvo-lg" />
<div className="shadow-auvo-xl" />

// Card shadows
<div className="shadow-card hover:shadow-card-hover" />
```

## Animacoes

```tsx
// Built-in animations
<div className="animate-fade-in" />
<div className="animate-slide-in-up" />
<div className="animate-slide-in-down" />
<div className="animate-scale-in" />
<div className="animate-pulse-auvo" />  // Auvo purple pulse
```

## Utility Classes

```tsx
// Page layout
<div className="container" />
<div className="page-header">
  <h1 className="page-title">Title</h1>
  <p className="page-subtitle">Subtitle</p>
</div>

// Forms
<div className="form-section">
  <div className="form-row">
    <FormField>...</FormField>
    <FormField>...</FormField>
  </div>
</div>
<div className="form-actions">
  <Button variant="ghost">Cancel</Button>
  <Button>Save</Button>
</div>

// Stats
<div className="stat-card">
  <span className="stat-value">R$ 12.500</span>
  <span className="stat-label">Receita Total</span>
  <span className="stat-change stat-change-positive">+12%</span>
</div>

// Empty state
<div className="empty-state">
  <Icon className="empty-state-icon" />
  <h3 className="empty-state-title">Nenhum item</h3>
  <p className="empty-state-description">Comece adicionando um novo item.</p>
</div>

// Text utilities
<p className="truncate-2" />  // Max 2 lines
<h1 className="text-gradient-auvo">Auvo</h1>  // Purple gradient text

// Glass effect
<div className="glass" />  // Frosted glass
```

## Import Path

```tsx
// Import all components
import {
  Button,
  Card,
  DashboardCard,
  Badge,
  StatusBadge,
  Input,
  Textarea,
  FormField,
  Avatar,
  AvatarGroup,
  Alert,
  Spinner,
  LoadingOverlay,
  Skeleton,
} from '@/components/ui';

// Import design tokens
import { colors, typography, spacing } from '@/lib/design-tokens';
```

## Arquivos

```
apps/web/src/
├── components/
│   └── ui/
│       ├── index.ts          # Re-exports
│       ├── button.tsx
│       ├── card.tsx
│       ├── badge.tsx
│       ├── input.tsx
│       ├── avatar.tsx
│       ├── alert.tsx
│       └── spinner.tsx
├── lib/
│   ├── utils.ts              # cn() helper
│   ├── design-tokens.ts      # Color/typography tokens
│   └── DESIGN-SYSTEM.md      # This file
├── app/
│   └── globals.css           # Global styles
└── tailwind.config.ts        # Tailwind configuration
```
