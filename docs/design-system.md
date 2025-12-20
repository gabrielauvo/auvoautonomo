# 🎨 Design System

Sistema de design completo para aplicações Web e Mobile do projeto.

---

## 📐 Fundamentos

### Grid System

**Desktop (1440px)**
- 12 colunas
- Container: 1120px
- Gutter: 32px
- Margin: 64px (cada lado)
- Column width: 78.67px

**Tablet (768px)**
- 8 colunas
- Container: 704px
- Gutter: 24px
- Margin: 32px
- Column width: 64px

**Mobile (375px)**
- 4 colunas
- Container: 343px
- Gutter: 16px
- Margin: 16px
- Column width: 69.75px

---

## 🎨 Paleta de Cores

### Cores Primárias

```css
/* Primary - Azul */
--primary-50:  #EFF6FF;
--primary-100: #DBEAFE;
--primary-200: #BFDBFE;
--primary-300: #93C5FD;
--primary-400: #60A5FA;
--primary-500: #3B82F6;  /* Base */
--primary-600: #2563EB;
--primary-700: #1D4ED8;
--primary-800: #1E40AF;
--primary-900: #1E3A8A;
--primary-950: #172554;
```

### Cores Secundárias

```css
/* Secondary - Roxo */
--secondary-50:  #FAF5FF;
--secondary-100: #F3E8FF;
--secondary-200: #E9D5FF;
--secondary-300: #D8B4FE;
--secondary-400: #C084FC;
--secondary-500: #A855F7;  /* Base */
--secondary-600: #9333EA;
--secondary-700: #7E22CE;
--secondary-800: #6B21A8;
--secondary-900: #581C87;
--secondary-950: #3B0764;
```

### Cores de Estado

```css
/* Success - Verde */
--success-50:  #F0FDF4;
--success-100: #DCFCE7;
--success-200: #BBF7D0;
--success-300: #86EFAC;
--success-400: #4ADE80;
--success-500: #22C55E;  /* Base */
--success-600: #16A34A;
--success-700: #15803D;
--success-800: #166534;
--success-900: #14532D;

/* Warning - Amarelo */
--warning-50:  #FFFBEB;
--warning-100: #FEF3C7;
--warning-200: #FDE68A;
--warning-300: #FCD34D;
--warning-400: #FBBF24;
--warning-500: #F59E0B;  /* Base */
--warning-600: #D97706;
--warning-700: #B45309;
--warning-800: #92400E;
--warning-900: #78350F;

/* Error - Vermelho */
--error-50:  #FEF2F2;
--error-100: #FEE2E2;
--error-200: #FECACA;
--error-300: #FCA5A5;
--error-400: #F87171;
--error-500: #EF4444;  /* Base */
--error-600: #DC2626;
--error-700: #B91C1C;
--error-800: #991B1B;
--error-900: #7F1D1D;

/* Info - Ciano */
--info-50:  #ECFEFF;
--info-100: #CFFAFE;
--info-200: #A5F3FC;
--info-300: #67E8F9;
--info-400: #22D3EE;
--info-500: #06B6D4;  /* Base */
--info-600: #0891B2;
--info-700: #0E7490;
--info-800: #155E75;
--info-900: #164E63;
```

### Cores Neutras

```css
/* Gray - Tons de cinza */
--gray-50:  #F9FAFB;
--gray-100: #F3F4F6;
--gray-200: #E5E7EB;
--gray-300: #D1D5DB;
--gray-400: #9CA3AF;
--gray-500: #6B7280;
--gray-600: #4B5563;
--gray-700: #374151;
--gray-800: #1F2937;
--gray-900: #111827;
--gray-950: #030712;

/* Backgrounds */
--bg-primary: #FFFFFF;
--bg-secondary: #F9FAFB;
--bg-tertiary: #F3F4F6;

/* Text */
--text-primary: #111827;
--text-secondary: #6B7280;
--text-tertiary: #9CA3AF;
--text-inverse: #FFFFFF;
```

---

## ✏️ Tipografia

### Famílias de Fonte

```css
/* Primária - Headings e UI */
--font-primary: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

/* Secundária - Body text */
--font-secondary: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

/* Monospace - Código */
--font-mono: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
```

### Escala de Tamanhos

```css
--text-xs:   0.75rem;   /* 12px */
--text-sm:   0.875rem;  /* 14px */
--text-base: 1rem;      /* 16px */
--text-lg:   1.125rem;  /* 18px */
--text-xl:   1.25rem;   /* 20px */
--text-2xl:  1.375rem;  /* 22px */
--text-3xl:  1.75rem;   /* 28px */
--text-4xl:  2.25rem;   /* 36px */
--text-5xl:  3rem;      /* 48px */
```

### Pesos de Fonte

```css
--font-light:    300;
--font-regular:  400;
--font-medium:   500;
--font-semibold: 600;
--font-bold:     700;
```

### Line Heights

```css
--leading-none:    1;
--leading-tight:   1.25;
--leading-snug:    1.375;
--leading-normal:  1.5;
--leading-relaxed: 1.625;
--leading-loose:   2;
```

### Estilos de Texto

#### Headings

```css
/* H1 */
font-family: var(--font-primary);
font-size: 1.75rem;      /* 28px */
font-weight: 500;        /* Medium */
line-height: 1.5rem;     /* 24px */
letter-spacing: 0;

/* H2 */
font-family: var(--font-primary);
font-size: 1.375rem;     /* 22px */
font-weight: 500;        /* Medium */
line-height: 1.5rem;     /* 24px */

/* H3 */
font-family: var(--font-primary);
font-size: 1.25rem;      /* 20px */
font-weight: 500;        /* Medium */
line-height: 1.5rem;     /* 24px */

/* H4 */
font-family: var(--font-primary);
font-size: 1.125rem;     /* 18px */
font-weight: 400;        /* Regular */
line-height: 1.5rem;     /* 24px */

/* H5 */
font-family: var(--font-primary);
font-size: 1rem;         /* 16px */
font-weight: 400;        /* Regular */
line-height: 1.5rem;     /* 24px */

/* H6 */
font-family: var(--font-primary);
font-size: 0.875rem;     /* 14px */
font-weight: 400;        /* Regular */
line-height: 1.5rem;     /* 24px */

/* H7 - Label */
font-family: var(--font-primary);
font-size: 0.75rem;      /* 12px */
font-weight: 400;        /* Regular */
line-height: 1.5rem;     /* 24px */
```

#### Body Text

```css
/* Body Large */
font-family: var(--font-secondary);
font-size: 1rem;         /* 16px */
line-height: 1.5rem;     /* 24px */

/* Body Regular */
font-family: var(--font-secondary);
font-size: 0.875rem;     /* 14px */
line-height: 1.5rem;     /* 24px */

/* Body Small */
font-family: var(--font-secondary);
font-size: 0.75rem;      /* 12px */
line-height: 1rem;       /* 16px */

/* Caption */
font-family: var(--font-secondary);
font-size: 0.75rem;      /* 12px */
font-style: italic;
line-height: 1rem;       /* 16px */
color: var(--text-secondary);
```

---

## 📏 Espaçamento

### Escala de Spacing

```css
--space-0:   0;
--space-1:   0.25rem;   /* 4px */
--space-2:   0.5rem;    /* 8px */
--space-3:   0.75rem;   /* 12px */
--space-4:   1rem;      /* 16px */
--space-5:   1.25rem;   /* 20px */
--space-6:   1.5rem;    /* 24px */
--space-8:   2rem;      /* 32px */
--space-10:  2.5rem;    /* 40px */
--space-12:  3rem;      /* 48px */
--space-16:  4rem;      /* 64px */
--space-20:  5rem;      /* 80px */
--space-24:  6rem;      /* 96px */
--space-32:  8rem;      /* 128px */
```

### Uso Semântico

```css
/* Padding de componentes */
--padding-xs:  var(--space-2);   /* 8px */
--padding-sm:  var(--space-3);   /* 12px */
--padding-md:  var(--space-4);   /* 16px */
--padding-lg:  var(--space-6);   /* 24px */
--padding-xl:  var(--space-8);   /* 32px */

/* Gap entre elementos */
--gap-xs:  var(--space-2);   /* 8px */
--gap-sm:  var(--space-3);   /* 12px */
--gap-md:  var(--space-4);   /* 16px */
--gap-lg:  var(--space-6);   /* 24px */
--gap-xl:  var(--space-8);   /* 32px */
```

---

## 🔘 Border Radius

```css
--radius-none: 0;
--radius-sm:   0.125rem;  /* 2px */
--radius-md:   0.25rem;   /* 4px */
--radius-DEFAULT: 0.375rem;  /* 6px */
--radius-lg:   0.5rem;    /* 8px */
--radius-xl:   0.75rem;   /* 12px */
--radius-2xl:  1rem;      /* 16px */
--radius-3xl:  1.5rem;    /* 24px */
--radius-full: 9999px;    /* Círculo */
```

---

## 🌑 Sombras (Shadows)

```css
/* Elevation 0 - No shadow */
--shadow-none: none;

/* Elevation 1 - Subtle */
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);

/* Elevation 2 - Cards */
--shadow-md:
  0 1px 3px 0 rgba(0, 0, 0, 0.1),
  0 1px 2px -1px rgba(0, 0, 0, 0.1);

/* Elevation 3 - Dropdowns */
--shadow-lg:
  0 4px 6px -1px rgba(0, 0, 0, 0.1),
  0 2px 4px -2px rgba(0, 0, 0, 0.1);

/* Elevation 4 - Modals */
--shadow-xl:
  0 10px 15px -3px rgba(0, 0, 0, 0.1),
  0 4px 6px -4px rgba(0, 0, 0, 0.1);

/* Elevation 5 - Overlays */
--shadow-2xl:
  0 20px 25px -5px rgba(0, 0, 0, 0.1),
  0 8px 10px -6px rgba(0, 0, 0, 0.1);

/* Inner shadow */
--shadow-inner: inset 0 2px 4px 0 rgba(0, 0, 0, 0.05);
```

---

## 🎯 Componentes

### Botões

#### Variantes

**Primary Button**
```css
background: var(--primary-600);
color: var(--text-inverse);
padding: 0.625rem 1.25rem;  /* 10px 20px */
border-radius: var(--radius-lg);
font-weight: var(--font-medium);
font-size: var(--text-sm);
box-shadow: var(--shadow-sm);

/* Hover */
background: var(--primary-700);
box-shadow: var(--shadow-md);

/* Active */
background: var(--primary-800);

/* Disabled */
background: var(--gray-300);
color: var(--gray-500);
cursor: not-allowed;
```

**Secondary Button**
```css
background: transparent;
color: var(--primary-600);
border: 1px solid var(--primary-600);
padding: 0.625rem 1.25rem;
border-radius: var(--radius-lg);
font-weight: var(--font-medium);
font-size: var(--text-sm);

/* Hover */
background: var(--primary-50);
border-color: var(--primary-700);
color: var(--primary-700);

/* Active */
background: var(--primary-100);
```

**Ghost Button**
```css
background: transparent;
color: var(--text-primary);
padding: 0.625rem 1.25rem;
border-radius: var(--radius-lg);
font-weight: var(--font-medium);
font-size: var(--text-sm);

/* Hover */
background: var(--gray-100);
```

#### Tamanhos

```css
/* Small */
padding: 0.5rem 1rem;      /* 8px 16px */
font-size: 0.75rem;         /* 12px */
min-height: 2rem;           /* 32px */

/* Medium (default) */
padding: 0.625rem 1.25rem;  /* 10px 20px */
font-size: 0.875rem;        /* 14px */
min-height: 2.5rem;         /* 40px */

/* Large */
padding: 0.75rem 1.5rem;    /* 12px 24px */
font-size: 1rem;            /* 16px */
min-height: 3rem;           /* 48px */
```

---

### Inputs

```css
/* Base Input */
background: var(--bg-primary);
border: 1px solid var(--gray-300);
border-radius: var(--radius-lg);
padding: 0.625rem 0.875rem;  /* 10px 14px */
font-size: var(--text-sm);
line-height: 1.5;
color: var(--text-primary);
min-height: 2.5rem;  /* 40px */

/* Focus */
border-color: var(--primary-500);
box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
outline: none;

/* Error */
border-color: var(--error-500);
box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);

/* Disabled */
background: var(--gray-100);
color: var(--gray-500);
cursor: not-allowed;

/* Placeholder */
color: var(--gray-400);
```

**Label**
```css
font-size: var(--text-sm);
font-weight: var(--font-medium);
color: var(--text-primary);
margin-bottom: var(--space-2);
```

**Helper Text**
```css
font-size: var(--text-xs);
color: var(--text-secondary);
margin-top: var(--space-1);
```

**Error Message**
```css
font-size: var(--text-xs);
color: var(--error-600);
margin-top: var(--space-1);
```

---

### Cards

```css
/* Base Card */
background: var(--bg-primary);
border: 1px solid var(--gray-200);
border-radius: var(--radius-xl);
padding: var(--space-6);
box-shadow: var(--shadow-md);

/* Hover (interactive) */
box-shadow: var(--shadow-lg);
border-color: var(--gray-300);
```

---

### Badges

```css
/* Base Badge */
display: inline-flex;
align-items: center;
padding: 0.125rem 0.5rem;  /* 2px 8px */
border-radius: var(--radius-full);
font-size: var(--text-xs);
font-weight: var(--font-medium);
line-height: 1.25rem;

/* Primary */
background: var(--primary-100);
color: var(--primary-700);

/* Success */
background: var(--success-100);
color: var(--success-700);

/* Warning */
background: var(--warning-100);
color: var(--warning-700);

/* Error */
background: var(--error-100);
color: var(--error-700);

/* Gray */
background: var(--gray-100);
color: var(--gray-700);
```

---

### Tabelas

```css
/* Table */
width: 100%;
border-collapse: collapse;

/* Table Head */
background: var(--gray-50);
border-bottom: 1px solid var(--gray-200);

/* Table Header Cell */
padding: 0.75rem 1rem;
text-align: left;
font-size: var(--text-xs);
font-weight: var(--font-semibold);
color: var(--text-secondary);
text-transform: uppercase;
letter-spacing: 0.05em;

/* Table Body Row */
border-bottom: 1px solid var(--gray-200);

/* Hover */
background: var(--gray-50);

/* Table Cell */
padding: 1rem;
font-size: var(--text-sm);
color: var(--text-primary);
```

---

### Modais

```css
/* Overlay */
background: rgba(0, 0, 0, 0.5);
position: fixed;
inset: 0;
z-index: 50;

/* Modal Container */
background: var(--bg-primary);
border-radius: var(--radius-2xl);
box-shadow: var(--shadow-2xl);
max-width: 32rem;  /* 512px */
width: 90%;
max-height: 90vh;
overflow: auto;

/* Modal Header */
padding: var(--space-6);
border-bottom: 1px solid var(--gray-200);

/* Modal Body */
padding: var(--space-6);

/* Modal Footer */
padding: var(--space-6);
border-top: 1px solid var(--gray-200);
display: flex;
justify-content: flex-end;
gap: var(--space-3);
```

---

## 📱 Breakpoints

```css
/* Mobile First */
--screen-sm: 640px;   /* Tablet */
--screen-md: 768px;   /* Tablet landscape / Small desktop */
--screen-lg: 1024px;  /* Desktop */
--screen-xl: 1280px;  /* Large desktop */
--screen-2xl: 1536px; /* Extra large */
```

---

## ⚡ Transições e Animações

```css
/* Duração */
--duration-fast: 150ms;
--duration-normal: 200ms;
--duration-slow: 300ms;

/* Easing */
--ease-in: cubic-bezier(0.4, 0, 1, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);

/* Transitions comuns */
transition: all var(--duration-normal) var(--ease-in-out);
```

---

## 📝 Uso do Design System

### Web (Tailwind)
Todos os tokens foram configurados no `tailwind.config.ts`.

**Exemplo de uso:**
```tsx
<button className="bg-primary-600 text-white px-5 py-2.5 rounded-lg font-medium text-sm shadow-sm hover:bg-primary-700 hover:shadow-md">
  Primary Button
</button>
```

### Mobile (React Native)
Os tokens estão em `src/theme/tokens.ts` e `src/theme/colors.ts`.

**Exemplo de uso:**
```tsx
<Button
  variant="primary"
  size="md"
  onPress={handlePress}
>
  Primary Button
</Button>
```

---

## 🎨 Acessibilidade

### Contraste de Cores

Todas as combinações de cores respeitam WCAG 2.1 Level AA:
- Texto normal: contraste mínimo 4.5:1
- Texto grande (>18px): contraste mínimo 3:1
- Elementos interativos: contraste mínimo 3:1

### Estados de Foco

Todos os elementos interativos têm estados de foco visíveis:
```css
/* Focus ring */
box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
outline: 2px solid var(--primary-500);
outline-offset: 2px;
```

### Tamanhos Mínimos de Toque

Mobile: mínimo 44x44px para elementos tocáveis
Desktop: mínimo 32x32px para elementos clicáveis

---

## 📚 Referências

- Design extraído do Figma (FILE_KEY: bMc9y6K3d05R7pxCUF9hHQ)
- Paleta baseada em Tailwind CSS v3
- Tipografia: Poppins (Google Fonts) + Open Sans
- Grid system: Bootstrap-inspired 12-column layout
- Nomenclatura: BEM + Tailwind conventions
