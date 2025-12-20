/**
 * Auvo Design System - Tokens (Mobile)
 *
 * IMPORTANTE: Estes tokens são IDÊNTICOS aos do WEB (apps/web/src/lib/design-tokens.ts)
 * para garantir consistência visual entre plataformas.
 *
 * NÃO MODIFIQUE sem atualizar também o web!
 *
 * Baseado na identidade visual Auvo (roxo vibrante)
 */

// =============================================================================
// COLORS - Sincronizado com apps/web/src/lib/design-tokens.ts
// =============================================================================

export const colors = {
  // Brand Colors - Auvo Purple (IDÊNTICO ao web)
  auvo: {
    50: '#F5F3FF',
    100: '#EDE9FE',
    200: '#DDD6FE',
    300: '#C4B5FD',
    400: '#A78BFA',
    500: '#8B5CF6',  // Primary brand color
    600: '#7C3AED',  // Logo color
    700: '#6D28D9',
    800: '#5B21B6',
    900: '#4C1D95',
  },

  // Primary - Auvo Purple (IDÊNTICO ao web)
  primary: {
    50: '#F5F3FF',
    100: '#EDE9FE',
    200: '#DDD6FE',
    300: '#C4B5FD',
    400: '#A78BFA',
    500: '#8B5CF6',  // Main primary
    600: '#7C3AED',  // Logo color - DEFAULT
    700: '#6D28D9',
    800: '#5B21B6',
    900: '#4C1D95',
  },

  // Secondary - Cyan/Teal (IDÊNTICO ao web)
  secondary: {
    50: '#ECFEFF',
    100: '#CFFAFE',
    200: '#A5F3FC',
    300: '#67E8F9',
    400: '#22D3EE',
    500: '#06B6D4',  // Main secondary
    600: '#0891B2',
    700: '#0E7490',
    800: '#155E75',
    900: '#164E63',
  },

  // Gray - Neutral scale (IDÊNTICO ao web)
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },

  // Success - Green (IDÊNTICO ao web)
  success: {
    50: '#ECFDF5',
    100: '#D1FAE5',
    200: '#A7F3D0',
    300: '#6EE7B7',
    400: '#34D399',
    500: '#10B981',  // Main success
    600: '#059669',
    700: '#047857',
    800: '#065F46',
    900: '#064E3B',
  },

  // Warning - Amber (IDÊNTICO ao web)
  warning: {
    50: '#FFFBEB',
    100: '#FEF3C7',
    200: '#FDE68A',
    300: '#FCD34D',
    400: '#FBBF24',
    500: '#F59E0B',  // Main warning
    600: '#D97706',
    700: '#B45309',
    800: '#92400E',
    900: '#78350F',
  },

  // Error/Danger - Red (IDÊNTICO ao web)
  error: {
    50: '#FEF2F2',
    100: '#FEE2E2',
    200: '#FECACA',
    300: '#FCA5A5',
    400: '#F87171',
    500: '#EF4444',  // Main error
    600: '#DC2626',
    700: '#B91C1C',
    800: '#991B1B',
    900: '#7F1D1D',
  },

  // Info - Blue (IDÊNTICO ao web)
  info: {
    50: '#EFF6FF',
    100: '#DBEAFE',
    200: '#BFDBFE',
    300: '#93C5FD',
    400: '#60A5FA',
    500: '#3B82F6',  // Main info
    600: '#2563EB',
    700: '#1D4ED8',
    800: '#1E40AF',
    900: '#1E3A8A',
  },

  // Neutrals
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',

  // Semantic colors (adaptado para mobile)
  background: {
    primary: '#FFFFFF',       // web: paper
    secondary: '#F3F4F6',     // web: default
    tertiary: '#F9FAFB',      // web: subtle
  },

  text: {
    primary: '#1F2937',       // web: text.primary
    secondary: '#6B7280',     // web: text.secondary
    tertiary: '#9CA3AF',      // web: text.disabled
    inverse: '#FFFFFF',       // web: text.inverse
  },

  border: {
    light: '#F3F4F6',         // web: border.light
    default: '#E5E7EB',       // web: border.default
    dark: '#D1D5DB',          // web: border.dark
  },
} as const;

// =============================================================================
// TYPOGRAPHY - Sincronizado com apps/web/src/lib/design-tokens.ts
// =============================================================================

export const typography = {
  fontFamily: {
    // Mobile usa fonte do sistema, mas segue a mesma hierarquia do web
    // Web usa: Poppins (primary), Inter (secondary), JetBrains Mono (mono)
    primary: 'System',
    secondary: 'System',
    mono: 'monospace',
    // Aliases para compatibilidade
    sans: 'System',
  },

  // Valores em pixels (web usa rem, mobile usa px)
  // Mapeamento 1:1: xs=12px, sm=14px, base=16px, lg=18px, xl=20px, 2xl=24px, 3xl=30px, 4xl=36px, 5xl=48px
  fontSize: {
    xs: 12,       // web: 0.75rem
    sm: 14,       // web: 0.875rem
    base: 16,     // web: 1rem
    lg: 18,       // web: 1.125rem
    xl: 20,       // web: 1.25rem
    '2xl': 24,    // web: 1.5rem
    '3xl': 30,    // web: 1.875rem
    '4xl': 36,    // web: 2.25rem
    '5xl': 48,    // web: 3rem
  },

  // IDÊNTICO ao web
  fontWeight: {
    light: '300' as const,
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },

  // IDÊNTICO ao web
  lineHeight: {
    none: 1,
    tight: 1.25,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  },
} as const;

// =============================================================================
// SPACING - Sincronizado com apps/web/src/lib/design-tokens.ts
// =============================================================================

// Valores em pixels (web usa rem, mobile usa px)
// Mapeamento: 1 = 4px, 2 = 8px, 3 = 12px, 4 = 16px, etc.
export const spacing = {
  0: 0,
  0.5: 2,     // web: 0.125rem
  1: 4,       // web: 0.25rem
  1.5: 6,     // web: 0.375rem
  2: 8,       // web: 0.5rem
  2.5: 10,    // web: 0.625rem
  3: 12,      // web: 0.75rem
  3.5: 14,    // web: 0.875rem
  4: 16,      // web: 1rem
  5: 20,      // web: 1.25rem
  6: 24,      // web: 1.5rem
  7: 28,      // web: 1.75rem
  8: 32,      // web: 2rem
  9: 36,      // web: 2.25rem
  10: 40,     // web: 2.5rem
  11: 44,     // web: 2.75rem
  12: 48,     // web: 3rem
  14: 56,     // web: 3.5rem
  16: 64,     // web: 4rem
  20: 80,     // web: 5rem
  24: 96,     // web: 6rem
  28: 112,    // web: 7rem
  32: 128,    // web: 8rem
} as const;

// =============================================================================
// BORDER RADIUS - Sincronizado com apps/web/src/lib/design-tokens.ts
// =============================================================================

// Valores em pixels (web usa rem, mobile usa px)
export const borderRadius = {
  none: 0,
  sm: 2,        // web: 0.125rem
  default: 6,   // web: 0.375rem
  md: 8,        // web: 0.5rem
  lg: 12,       // web: 0.75rem
  xl: 16,       // web: 1rem
  '2xl': 24,    // web: 1.5rem
  '3xl': 32,    // web: 2rem
  full: 9999,
} as const;

// =============================================================================
// SHADOWS - Adaptado para React Native
// =============================================================================

// React Native requer formato diferente para shadows
// Valores baseados nos mesmos visuais do web
export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  default: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.1,
    shadowRadius: 25,
    elevation: 12,
  },
  '2xl': {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 25 },
    shadowOpacity: 0.25,
    shadowRadius: 50,
    elevation: 16,
  },
  // Auvo brand shadow (purple glow)
  auvo: {
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
} as const;

// =============================================================================
// Z-INDEX - Sincronizado com apps/web/src/lib/design-tokens.ts
// =============================================================================

export const zIndex = {
  hide: -1,
  base: 0,
  docked: 10,
  dropdown: 1000,
  sticky: 1100,
  banner: 1200,
  overlay: 1300,
  modal: 1400,
  popover: 1500,
  toast: 1700,
  tooltip: 1800,
} as const;

// =============================================================================
// ANIMATION/TRANSITIONS - Sincronizado com apps/web/src/lib/design-tokens.ts
// =============================================================================

export const animation = {
  duration: {
    fast: 150,      // web: 150ms
    default: 200,   // web: 200ms
    normal: 300,    // web: 300ms
    slow: 300,      // web: 300ms
    slower: 500,    // web: 500ms
  },
  easing: {
    default: 'ease-in-out',
    linear: 'linear',
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
  },
} as const;

// =============================================================================
// STATUS COLORS - Sincronizado com apps/web/src/lib/design-tokens.ts
// =============================================================================

export const statusColors = {
  // Quote Status
  quote: {
    DRAFT: colors.gray[400],
    SENT: colors.info[500],
    APPROVED: colors.success[500],
    REJECTED: colors.error[500],
    EXPIRED: colors.warning[500],
  },
  // Work Order Status
  workOrder: {
    SCHEDULED: colors.info[500],
    IN_PROGRESS: colors.warning[500],
    DONE: colors.success[500],
    CANCELED: colors.error[500],
  },
  // Payment Status
  payment: {
    PENDING: colors.warning[500],
    CONFIRMED: colors.info[500],
    RECEIVED: colors.success[500],
    OVERDUE: colors.error[500],
    REFUNDED: colors.gray[500],
    CANCELED: colors.gray[400],
  },
} as const;

// =============================================================================
// THEME OBJECT
// =============================================================================

export const theme = {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  zIndex,
  animation,
  statusColors,
} as const;

export type Theme = typeof theme;
export type Colors = typeof colors;
export type Typography = typeof typography;
export type Spacing = typeof spacing;
export type BorderRadius = typeof borderRadius;
export type Shadows = typeof shadows;
export type ZIndex = typeof zIndex;
export type StatusColors = typeof statusColors;

export default theme;
