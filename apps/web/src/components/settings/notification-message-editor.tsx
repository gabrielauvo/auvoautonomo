'use client';

/**
 * NotificationMessageEditor Component
 *
 * Editor de mensagens com suporte a placeholders
 */

import { useState } from 'react';
import { Info, Copy, Check, RotateCcw } from 'lucide-react';
import { Textarea, Button, Alert } from '@/components/ui';
import { AVAILABLE_PLACEHOLDERS } from '@/services/settings.service';
import { cn } from '@/lib/utils';

interface NotificationMessageEditorProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  description?: string;
  defaultValue?: string;
  rows?: number;
  disabled?: boolean;
}

export function NotificationMessageEditor({
  value,
  onChange,
  label,
  description,
  defaultValue,
  rows = 4,
  disabled = false,
}: NotificationMessageEditorProps) {
  const [copiedPlaceholder, setCopiedPlaceholder] = useState<string | null>(null);

  const insertPlaceholder = (placeholder: string) => {
    const text = `{${placeholder}}`;
    onChange(value + text);
  };

  const copyPlaceholder = async (placeholder: string) => {
    const text = `{${placeholder}}`;
    await navigator.clipboard.writeText(text);
    setCopiedPlaceholder(placeholder);
    setTimeout(() => setCopiedPlaceholder(null), 1500);
  };

  const resetToDefault = () => {
    if (defaultValue) {
      onChange(defaultValue);
    }
  };

  // Highlight placeholders no texto
  const highlightedValue = value.replace(
    /\{([^}]+)\}/g,
    '<span class="text-primary font-medium">{$1}</span>'
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
        {defaultValue && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetToDefault}
            disabled={disabled}
            className="text-xs"
            leftIcon={<RotateCcw className="h-3 w-3" />}
          >
            Restaurar padrão
          </Button>
        )}
      </div>

      {description && (
        <p className="text-xs text-gray-500">{description}</p>
      )}

      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        disabled={disabled}
        placeholder="Digite sua mensagem..."
      />

      {/* Placeholders */}
      <div className="p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <Info className="h-4 w-4 text-gray-400" />
          <span className="text-xs font-medium text-gray-600">
            Variáveis disponíveis
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {AVAILABLE_PLACEHOLDERS.map((ph) => (
            <div
              key={ph.key}
              className="group relative"
            >
              <button
                type="button"
                onClick={() => insertPlaceholder(ph.key)}
                disabled={disabled}
                className={cn(
                  'px-2 py-1 text-xs font-mono rounded border transition-colors',
                  'bg-white hover:bg-primary-50 hover:border-primary hover:text-primary',
                  disabled && 'opacity-50 cursor-not-allowed'
                )}
              >
                {`{${ph.key}}`}
              </button>

              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                {ph.description}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
              </div>

              {/* Copy button */}
              <button
                type="button"
                onClick={() => copyPlaceholder(ph.key)}
                disabled={disabled}
                className="absolute -top-1 -right-1 p-0.5 bg-gray-200 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-300"
              >
                {copiedPlaceholder === ph.key ? (
                  <Check className="h-3 w-3 text-success" />
                ) : (
                  <Copy className="h-3 w-3 text-gray-500" />
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div className="p-3 border rounded-lg">
        <p className="text-xs font-medium text-gray-500 mb-1">Preview:</p>
        <div
          className="text-sm text-gray-700 whitespace-pre-wrap"
          dangerouslySetInnerHTML={{ __html: highlightedValue || '<span class="text-gray-400">Digite uma mensagem acima</span>' }}
        />
      </div>
    </div>
  );
}

export default NotificationMessageEditor;
