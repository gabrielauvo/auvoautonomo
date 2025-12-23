'use client';

/**
 * ThemeToggle Component
 *
 * Botão para alternar entre temas claro e escuro
 */

import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from '@/context';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  /** Show label next to icon */
  showLabel?: boolean;
  /** Additional class names */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

export function ThemeToggle({ showLabel = false, className, size = 'md' }: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-9 w-9',
    lg: 'h-10 w-10',
  };

  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  const cycleTheme = () => {
    if (theme === 'light') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('system');
    } else {
      setTheme('light');
    }
  };

  const getIcon = () => {
    if (theme === 'system') {
      return <Monitor className={iconSizes[size]} />;
    }
    return resolvedTheme === 'dark'
      ? <Moon className={iconSizes[size]} />
      : <Sun className={iconSizes[size]} />;
  };

  const getLabel = () => {
    if (theme === 'system') return 'Sistema';
    return resolvedTheme === 'dark' ? 'Escuro' : 'Claro';
  };

  return (
    <button
      type="button"
      onClick={cycleTheme}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg',
        'text-gray-600 dark:text-gray-300',
        'hover:bg-gray-100 dark:hover:bg-gray-800',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
        'transition-colors duration-200',
        !showLabel && sizeClasses[size],
        showLabel && 'px-3 py-2',
        className
      )}
      title={`Tema: ${getLabel()}. Clique para alternar.`}
      aria-label={`Alternar tema. Atual: ${getLabel()}`}
    >
      {getIcon()}
      {showLabel && <span className="text-sm font-medium">{getLabel()}</span>}
    </button>
  );
}

/**
 * ThemeDropdown Component
 *
 * Dropdown com opções de tema
 */
interface ThemeDropdownProps {
  className?: string;
}

export function ThemeDropdown({ className }: ThemeDropdownProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const options = [
    { value: 'light', label: 'Claro', icon: Sun },
    { value: 'dark', label: 'Escuro', icon: Moon },
    { value: 'system', label: 'Sistema', icon: Monitor },
  ] as const;

  return (
    <div className={cn('flex items-center gap-1 p-1 rounded-lg bg-gray-100 dark:bg-gray-800', className)}>
      {options.map((option) => {
        const Icon = option.icon;
        const isActive = theme === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setTheme(option.value)}
            className={cn(
              'flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all',
              isActive
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            )}
            title={option.label}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default ThemeToggle;
