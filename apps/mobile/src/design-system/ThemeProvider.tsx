// @ts-nocheck
/**
 * ProDesign Theme Provider
 *
 * Provedor de contexto para o tema do aplicativo.
 * Fornece acesso aos tokens de design em toda a aplicação.
 */

import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { theme, Theme, colors } from './tokens';

// =============================================================================
// TYPES
// =============================================================================

type ColorScheme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  colorScheme: ColorScheme;
  isDark: boolean;
}

// =============================================================================
// DARK THEME OVERRIDES
// =============================================================================

const darkColors = {
  ...colors,
  // Brand Colors - Auvo Purple (adjusted for dark mode visibility)
  auvo: {
    50: '#1E1B4B',
    100: '#2E2667',
    200: '#4C3D91',
    300: '#6D5DB8',
    400: '#8B7BD4',
    500: '#A78BFA',  // Lighter for dark bg
    600: '#B9A4FC',
    700: '#C4B5FD',
    800: '#DDD6FE',
    900: '#EDE9FE',
  },
  // Primary - Auvo Purple (adjusted for dark mode)
  primary: {
    50: '#1E1B4B',
    100: '#2E2667',
    200: '#4C3D91',
    300: '#6D5DB8',
    400: '#8B7BD4',
    500: '#A78BFA',  // Lighter main primary
    600: '#B9A4FC',  // Buttons - very visible
    700: '#C4B5FD',
    800: '#DDD6FE',
    900: '#EDE9FE',
  },
  // Gray scale adjusted for dark mode
  gray: {
    50: '#0F172A',   // Darkest
    100: '#1E293B',
    200: '#334155',
    300: '#475569',
    400: '#64748B',
    500: '#94A3B8',
    600: '#CBD5E1',
    700: '#E2E8F0',
    800: '#F1F5F9',
    900: '#F8FAFC',  // Lightest
  },
  // Success - Brighter greens for dark mode
  success: {
    50: '#052E16',
    100: '#064E3B',
    200: '#065F46',
    300: '#047857',
    400: '#059669',
    500: '#10B981',  // Main
    600: '#34D399',  // Brighter
    700: '#6EE7B7',
    800: '#A7F3D0',
    900: '#D1FAE5',
  },
  // Error - Brighter reds for dark mode
  error: {
    50: '#450A0A',
    100: '#7F1D1D',
    200: '#991B1B',
    300: '#B91C1C',
    400: '#DC2626',
    500: '#EF4444',  // Main
    600: '#F87171',  // Brighter
    700: '#FCA5A5',
    800: '#FECACA',
    900: '#FEE2E2',
  },
  // Warning - Brighter ambers for dark mode
  warning: {
    50: '#451A03',
    100: '#78350F',
    200: '#92400E',
    300: '#B45309',
    400: '#D97706',
    500: '#F59E0B',  // Main
    600: '#FBBF24',  // Brighter
    700: '#FCD34D',
    800: '#FDE68A',
    900: '#FEF3C7',
  },
  // Info - Brighter blues for dark mode
  info: {
    50: '#0C1929',
    100: '#1E3A5F',
    200: '#1E40AF',
    300: '#1D4ED8',
    400: '#2563EB',
    500: '#3B82F6',  // Main
    600: '#60A5FA',  // Brighter
    700: '#93C5FD',
    800: '#BFDBFE',
    900: '#DBEAFE',
  },
  // Secondary - Cyan/Teal (adjusted for dark mode)
  secondary: {
    50: '#042F2E',
    100: '#134E4A',
    200: '#115E59',
    300: '#0D9488',
    400: '#14B8A6',
    500: '#2DD4BF',  // Brighter
    600: '#5EEAD4',
    700: '#99F6E4',
    800: '#CCFBF1',
    900: '#F0FDFA',
  },
  background: {
    primary: '#0F172A',     // Slate-900 - main dark bg
    secondary: '#1E293B',   // Slate-800
    tertiary: '#334155',    // Slate-700
  },
  text: {
    primary: '#F8FAFC',     // Slate-50 - very readable
    secondary: '#CBD5E1',   // Slate-300
    tertiary: '#94A3B8',    // Slate-400
    inverse: '#0F172A',
  },
  border: {
    light: '#334155',       // Slate-700
    default: '#475569',     // Slate-600
    dark: '#64748B',        // Slate-500
  },
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};

// =============================================================================
// CONTEXT
// =============================================================================

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// =============================================================================
// PROVIDER
// =============================================================================

interface ThemeProviderProps {
  children: ReactNode;
  forcedColorScheme?: ColorScheme;
}

export function ThemeProvider({ children, forcedColorScheme }: ThemeProviderProps) {
  const systemColorScheme = useColorScheme();
  const colorScheme = forcedColorScheme ?? (systemColorScheme || 'light');
  const isDark = colorScheme === 'dark';

  const value = useMemo<ThemeContextValue>(() => ({
    theme: {
      ...theme,
      colors: isDark ? darkColors : colors,
    },
    colorScheme,
    isDark,
  }), [colorScheme, isDark]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// =============================================================================
// HOOK
// =============================================================================

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// =============================================================================
// UTILITY HOOK - Get specific token values
// =============================================================================

export function useColors() {
  const { theme } = useTheme();
  return theme.colors;
}

export function useSpacing() {
  return theme.spacing;
}

export function useTypography() {
  return theme.typography;
}

export function useShadows() {
  return theme.shadows;
}

export function useBorderRadius() {
  return theme.borderRadius;
}
