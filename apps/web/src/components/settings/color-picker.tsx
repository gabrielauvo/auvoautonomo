'use client';

/**
 * ColorPicker Component
 *
 * Seletor de cores para branding
 */

import { useState, useRef, useEffect } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
  presetColors?: string[];
  disabled?: boolean;
}

const DEFAULT_PRESET_COLORS = [
  '#7C3AED', // Primary (roxo Auvo)
  '#6D28D9', // Purple
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#8B5CF6', // Violet
  '#14B8A6', // Teal
  '#F97316', // Orange
  '#1F2937', // Gray dark
];

export function ColorPicker({
  value,
  onChange,
  label,
  presetColors = DEFAULT_PRESET_COLORS,
  disabled = false,
}: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customColor, setCustomColor] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fechar ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sincronizar cor customizada
  useEffect(() => {
    setCustomColor(value);
  }, [value]);

  const handlePresetClick = (color: string) => {
    onChange(color);
    setIsOpen(false);
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value;
    setCustomColor(newColor);
    onChange(newColor);
  };

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {label}
        </label>
      )}

      {/* Trigger */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'flex items-center gap-3 w-full px-3 py-2 border rounded-lg transition-colors',
          'hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <div
          className="w-6 h-6 rounded border shadow-sm"
          style={{ backgroundColor: value }}
        />
        <span className="text-sm font-mono text-gray-700 uppercase">{value}</span>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-2 p-3 bg-white border rounded-lg shadow-lg w-64">
          {/* Preset colors */}
          <div className="grid grid-cols-6 gap-2 mb-3">
            {presetColors.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => handlePresetClick(color)}
                className={cn(
                  'w-8 h-8 rounded-full border-2 transition-transform hover:scale-110',
                  value === color ? 'border-gray-900 ring-2 ring-offset-1 ring-gray-900' : 'border-transparent'
                )}
                style={{ backgroundColor: color }}
              >
                {value === color && (
                  <Check className="h-4 w-4 mx-auto text-white drop-shadow" />
                )}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="border-t my-2" />

          {/* Custom color */}
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={customColor}
              onChange={handleCustomChange}
              className="w-10 h-10 rounded cursor-pointer border-0 p-0"
            />
            <input
              type="text"
              value={customColor}
              onChange={(e) => {
                const val = e.target.value;
                if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                  setCustomColor(val);
                  if (val.length === 7) {
                    onChange(val);
                  }
                }
              }}
              placeholder="#000000"
              className="flex-1 px-2 py-1.5 border rounded text-sm font-mono uppercase"
              maxLength={7}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default ColorPicker;
