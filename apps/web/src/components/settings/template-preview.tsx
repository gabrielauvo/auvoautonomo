'use client';

/**
 * TemplatePreview Component
 *
 * Preview de templates de documentos (orçamento, OS, cobrança)
 */

import { useState } from 'react';
import { FileText, Wrench, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TemplatePreviewProps {
  type: 'quote' | 'workOrder' | 'charge';
  logoUrl?: string;
  logoPosition?: 'left' | 'center' | 'right';
  primaryColor: string;
  secondaryColor?: string;
  companyName?: string;
  showLogo?: boolean;
  headerText?: string;
  footerText?: string;
  className?: string;
}

export function TemplatePreview({
  type,
  logoUrl,
  logoPosition = 'left',
  primaryColor,
  secondaryColor,
  companyName = 'Sua Empresa',
  showLogo = true,
  headerText,
  footerText,
  className,
}: TemplatePreviewProps) {
  const [imageError, setImageError] = useState(false);

  const config = {
    quote: {
      icon: FileText,
      title: 'Orçamento',
      number: '#2024-0042',
    },
    workOrder: {
      icon: Wrench,
      title: 'Ordem de Serviço',
      number: 'OS-2024-0089',
    },
    charge: {
      icon: Receipt,
      title: 'Cobrança',
      number: 'COB-2024-0156',
    },
  }[type];

  const Icon = config.icon;

  const logoAlignClass = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
  }[logoPosition];

  return (
    <div
      className={cn(
        'border rounded-lg overflow-hidden bg-white shadow-sm',
        'transform scale-100 origin-top-left',
        className
      )}
    >
      {/* Header */}
      <div
        className="p-4"
        style={{ backgroundColor: primaryColor }}
      >
        <div className={cn('flex items-center gap-3', logoAlignClass)}>
          {showLogo && logoUrl && logoUrl.trim() && !imageError ? (
            <img
              src={logoUrl}
              alt="Logo"
              className="h-8 w-auto object-contain bg-white rounded px-2 py-1"
              onError={() => setImageError(true)}
              crossOrigin="anonymous"
            />
          ) : showLogo ? (
            <div className="h-8 w-8 bg-white/20 rounded flex items-center justify-center">
              <Icon className="h-5 w-5 text-white" />
            </div>
          ) : null}
          <div className={cn('text-white', logoPosition === 'center' && 'text-center')}>
            <p className="font-bold text-sm">{companyName}</p>
            {headerText && (
              <p className="text-xs opacity-80">{headerText}</p>
            )}
          </div>
        </div>
      </div>

      {/* Subheader */}
      <div
        className="px-4 py-2 border-b"
        style={{ backgroundColor: secondaryColor || primaryColor, opacity: 0.1 }}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium" style={{ color: primaryColor }}>
            {config.title}
          </span>
          <span className="text-xs text-gray-500">{config.number}</span>
        </div>
      </div>

      {/* Content Preview */}
      <div className="p-4 space-y-3">
        {/* Client info */}
        <div className="space-y-1">
          <div className="h-2 bg-gray-200 rounded w-24" />
          <div className="h-3 bg-gray-100 rounded w-40" />
        </div>

        {/* Table header */}
        <div
          className="flex gap-2 py-2 px-2 rounded text-xs font-medium text-white"
          style={{ backgroundColor: primaryColor }}
        >
          <span className="flex-1">Item</span>
          <span className="w-16 text-right">Qtd</span>
          <span className="w-20 text-right">Valor</span>
        </div>

        {/* Table rows */}
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-2 py-1.5 px-2 text-xs border-b">
            <div className="flex-1 h-2 bg-gray-100 rounded" />
            <div className="w-16 h-2 bg-gray-100 rounded" />
            <div className="w-20 h-2 bg-gray-100 rounded" />
          </div>
        ))}

        {/* Total */}
        <div className="flex justify-end pt-2">
          <div
            className="px-4 py-2 rounded font-bold text-white text-sm"
            style={{ backgroundColor: primaryColor }}
          >
            Total: R$ 1.250,00
          </div>
        </div>
      </div>

      {/* Footer */}
      {footerText && (
        <div
          className="px-4 py-2 text-center text-xs border-t"
          style={{ color: primaryColor }}
        >
          {footerText}
        </div>
      )}
    </div>
  );
}

export default TemplatePreview;
