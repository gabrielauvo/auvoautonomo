import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Auvo Design System - Input Component
 *
 * Baseado no MaterialPro MuiOutlinedInput
 */
const inputVariants = cva(
  'flex w-full rounded-md border bg-white text-gray-900 transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-400 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'border-gray-300 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary-100',
        filled:
          'border-transparent bg-gray-100 focus-visible:bg-white focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary-100',
        ghost:
          'border-transparent bg-transparent focus-visible:bg-gray-50 focus-visible:border-gray-200',
      },
      inputSize: {
        sm: 'h-8 px-3 text-sm',
        default: 'h-10 px-3 text-sm',
        lg: 'h-12 px-4 text-base',
      },
      state: {
        default: '',
        error: 'border-error focus-visible:border-error focus-visible:ring-error-100',
        success: 'border-success focus-visible:border-success focus-visible:ring-success-100',
      },
    },
    defaultVariants: {
      variant: 'default',
      inputSize: 'default',
      state: 'default',
    },
  }
);

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  error?: boolean;
  success?: boolean;
  errorMessage?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      variant,
      inputSize,
      state,
      leftIcon,
      rightIcon,
      error,
      success,
      errorMessage,
      ariaLabel,
      ariaDescribedBy,
      ...props
    },
    ref
  ) => {
    const computedState = error ? 'error' : success ? 'success' : state;
    const errorId = errorMessage ? `${props.id || 'input'}-error` : undefined;
    const describedBy = ariaDescribedBy || errorId;

    // Atributos ARIA para acessibilidade
    const ariaProps = {
      'aria-label': ariaLabel || (!props.placeholder && !props.name ? 'Campo de entrada' : undefined),
      'aria-invalid': error ? 'true' as const : undefined,
      'aria-describedby': describedBy,
      'role': type === 'text' || type === 'email' || type === 'tel' ? 'textbox' : undefined,
    };

    if (leftIcon || rightIcon) {
      return (
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true">
              {leftIcon}
            </div>
          )}
          <input
            type={type}
            className={cn(
              inputVariants({ variant, inputSize, state: computedState }),
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              className
            )}
            ref={ref}
            {...ariaProps}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true">
              {rightIcon}
            </div>
          )}
          {errorMessage && (
            <p id={errorId} className="mt-1 text-xs text-error" role="alert">
              {errorMessage}
            </p>
          )}
        </div>
      );
    }

    return (
      <>
        <input
          type={type}
          className={cn(
            inputVariants({ variant, inputSize, state: computedState }),
            className
          )}
          ref={ref}
          {...ariaProps}
          {...props}
        />
        {errorMessage && (
          <p id={errorId} className="mt-1 text-xs text-error" role="alert">
            {errorMessage}
          </p>
        )}
      </>
    );
  }
);

Input.displayName = 'Input';

// Textarea
const textareaVariants = cva(
  'flex min-h-[80px] w-full rounded-md border bg-white px-3 py-2 text-sm text-gray-900 transition-colors placeholder:text-gray-400 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 resize-none',
  {
    variants: {
      variant: {
        default:
          'border-gray-300 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary-100',
        filled:
          'border-transparent bg-gray-100 focus-visible:bg-white focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary-100',
      },
      state: {
        default: '',
        error: 'border-error focus-visible:border-error focus-visible:ring-error-100',
        success: 'border-success focus-visible:border-success focus-visible:ring-success-100',
      },
    },
    defaultVariants: {
      variant: 'default',
      state: 'default',
    },
  }
);

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    VariantProps<typeof textareaVariants> {
  error?: boolean;
  success?: boolean;
  errorMessage?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, variant, state, error, success, errorMessage, ariaLabel, ariaDescribedBy, ...props }, ref) => {
    const computedState = error ? 'error' : success ? 'success' : state;
    const errorId = errorMessage ? `${props.id || 'textarea'}-error` : undefined;
    const describedBy = ariaDescribedBy || errorId;

    const ariaProps = {
      'aria-label': ariaLabel || (!props.placeholder && !props.name ? 'Campo de texto' : undefined),
      'aria-invalid': error ? 'true' as const : undefined,
      'aria-describedby': describedBy,
    };

    return (
      <>
        <textarea
          className={cn(textareaVariants({ variant, state: computedState }), className)}
          ref={ref}
          {...ariaProps}
          {...props}
        />
        {errorMessage && (
          <p id={errorId} className="mt-1 text-xs text-error" role="alert">
            {errorMessage}
          </p>
        )}
      </>
    );
  }
);

Textarea.displayName = 'Textarea';

// Form Field wrapper
export interface FormFieldProps {
  label?: React.ReactNode;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
}

const FormField = ({
  label,
  error,
  hint,
  required,
  children,
  className,
  htmlFor,
}: FormFieldProps) => {
  const fieldId = htmlFor || `field-${React.useId()}`;
  const errorId = error ? `${fieldId}-error` : undefined;
  const hintId = hint ? `${fieldId}-hint` : undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-error ml-0.5" aria-label="obrigatório">*</span>}
        </label>
      )}
      {children}
      {error && (
        <p id={errorId} className="text-xs text-error" role="alert">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={hintId} className="text-xs text-gray-500">
          {hint}
        </p>
      )}
    </div>
  );
};

FormField.displayName = 'FormField';

// Select
const selectVariants = cva(
  'flex w-full rounded-md border bg-white text-gray-900 transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 appearance-none cursor-pointer bg-no-repeat',
  {
    variants: {
      variant: {
        default:
          'border-gray-300 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary-100',
        filled:
          'border-transparent bg-gray-100 focus-visible:bg-white focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary-100',
      },
      selectSize: {
        sm: 'h-8 px-3 pr-8 text-sm',
        default: 'h-10 px-3 pr-8 text-sm',
        lg: 'h-12 px-4 pr-10 text-base',
      },
      state: {
        default: '',
        error: 'border-error focus-visible:border-error focus-visible:ring-error-100',
        success: 'border-success focus-visible:border-success focus-visible:ring-success-100',
      },
    },
    defaultVariants: {
      variant: 'default',
      selectSize: 'default',
      state: 'default',
    },
  }
);

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'>,
    VariantProps<typeof selectVariants> {
  error?: boolean;
  success?: boolean;
  errorMessage?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, variant, selectSize, state, error, success, errorMessage, ariaLabel, ariaDescribedBy, children, ...props }, ref) => {
    const computedState = error ? 'error' : success ? 'success' : state;
    const errorId = errorMessage ? `${props.id || 'select'}-error` : undefined;
    const describedBy = ariaDescribedBy || errorId;

    const ariaProps = {
      'aria-label': ariaLabel || (!props.name ? 'Campo de seleção' : undefined),
      'aria-invalid': error ? 'true' as const : undefined,
      'aria-describedby': describedBy,
    };

    return (
      <>
        <div className="relative">
          <select
            className={cn(selectVariants({ variant, selectSize, state: computedState }), className)}
            ref={ref}
            {...ariaProps}
            {...props}
          >
            {children}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" aria-hidden="true">
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        {errorMessage && (
          <p id={errorId} className="mt-1 text-xs text-error" role="alert">
            {errorMessage}
          </p>
        )}
      </>
    );
  }
);

Select.displayName = 'Select';

export { Input, Textarea, FormField, Select, inputVariants, textareaVariants, selectVariants };
