'use client';

import * as React from 'react';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Search, ChevronDown, Check, X } from 'lucide-react';

const searchSelectVariants = cva(
  'flex w-full rounded-md border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 transition-colors cursor-pointer',
  {
    variants: {
      variant: {
        default:
          'border-gray-300 dark:border-gray-600 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary-100 dark:focus-within:ring-primary-900',
        filled:
          'border-transparent bg-gray-100 dark:bg-gray-700 focus-within:bg-white dark:focus-within:bg-gray-800 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary-100 dark:focus-within:ring-primary-900',
      },
      selectSize: {
        sm: 'h-8 text-sm',
        default: 'h-10 text-sm',
        lg: 'h-12 text-base',
      },
      state: {
        default: '',
        error: 'border-error focus-within:border-error focus-within:ring-error-100',
        success: 'border-success focus-within:border-success focus-within:ring-success-100',
      },
    },
    defaultVariants: {
      variant: 'default',
      selectSize: 'default',
      state: 'default',
    },
  }
);

export interface SearchSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SearchSelectProps extends VariantProps<typeof searchSelectVariants> {
  options: SearchSelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  error?: boolean;
  success?: boolean;
  errorMessage?: string;
  className?: string;
  clearable?: boolean;
  name?: string;
  id?: string;
  required?: boolean;
  'aria-label'?: string;
}

export function SearchSelect({
  options,
  value,
  onChange,
  onClear,
  placeholder = 'Selecione...',
  searchPlaceholder = 'Buscar...',
  emptyMessage = 'Nenhum resultado encontrado',
  disabled = false,
  error = false,
  success = false,
  errorMessage,
  className,
  variant,
  selectSize,
  state,
  clearable = false,
  name,
  id,
  required,
  'aria-label': ariaLabel,
}: SearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const computedState = error ? 'error' : success ? 'success' : state;

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const searchLower = search.toLowerCase();
    return options.filter((opt) =>
      opt.label.toLowerCase().includes(searchLower)
    );
  }, [options, search]);

  // Reset highlighted index when filtered options change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredOptions]);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-option]');
      const highlightedItem = items[highlightedIndex] as HTMLElement;
      if (highlightedItem) {
        highlightedItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    (optionValue: string) => {
      onChange?.(optionValue);
      setIsOpen(false);
      setSearch('');
    },
    [onChange]
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClear?.();
      onChange?.('');
    },
    [onChange, onClear]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
          e.preventDefault();
          setIsOpen(true);
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < filteredOptions.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredOptions.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredOptions[highlightedIndex] && !filteredOptions[highlightedIndex].disabled) {
            handleSelect(filteredOptions[highlightedIndex].value);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          setSearch('');
          break;
        case 'Tab':
          setIsOpen(false);
          setSearch('');
          break;
      }
    },
    [isOpen, filteredOptions, highlightedIndex, handleSelect]
  );

  const errorId = errorMessage ? `${id || 'search-select'}-error` : undefined;

  return (
    <div className="relative" ref={containerRef}>
      {/* Hidden input for form submission */}
      {name && (
        <input type="hidden" name={name} value={value || ''} />
      )}

      {/* Trigger button */}
      <div
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={`${id || 'search-select'}-listbox`}
        aria-label={ariaLabel || placeholder}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={errorId}
        aria-required={required}
        tabIndex={disabled ? -1 : 0}
        className={cn(
          searchSelectVariants({ variant, selectSize, state: computedState }),
          'flex items-center justify-between px-3',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
      >
        <span className={cn('truncate', !selectedOption && 'text-gray-400 dark:text-gray-500')}>
          {selectedOption?.label || placeholder}
        </span>
        <div className="flex items-center gap-1">
          {clearable && value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              aria-label="Limpar seleção"
            >
              <X className="h-3.5 w-3.5 text-gray-400" />
            </button>
          )}
          <ChevronDown
            className={cn(
              'h-4 w-4 text-gray-400 transition-transform',
              isOpen && 'rotate-180'
            )}
          />
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg overflow-hidden"
        >
          {/* Search input */}
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={searchPlaceholder}
                className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Options list */}
          <div
            ref={listRef}
            role="listbox"
            id={`${id || 'search-select'}-listbox`}
            aria-label={ariaLabel || placeholder}
            className="max-h-60 overflow-y-auto"
          >
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-6 text-sm text-gray-500 dark:text-gray-400 text-center">
                {emptyMessage}
              </div>
            ) : (
              filteredOptions.map((option, index) => (
                <div
                  key={option.value}
                  role="option"
                  data-option
                  aria-selected={option.value === value}
                  aria-disabled={option.disabled}
                  className={cn(
                    'flex items-center justify-between px-3 py-2.5 text-sm cursor-pointer transition-colors',
                    option.value === value && 'bg-primary-50 dark:bg-primary-900/20 text-primary',
                    index === highlightedIndex && option.value !== value && 'bg-gray-100 dark:bg-gray-700',
                    option.disabled && 'opacity-50 cursor-not-allowed',
                    !option.disabled && option.value !== value && 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  )}
                  onClick={() => !option.disabled && handleSelect(option.value)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  <span className="truncate">{option.label}</span>
                  {option.value === value && (
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Error message */}
      {errorMessage && (
        <p id={errorId} className="mt-1 text-xs text-error" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

export { searchSelectVariants };
