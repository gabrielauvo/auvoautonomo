'use client';

/**
 * Quote Items Table - Tabela de itens do orçamento
 *
 * Exibe itens com:
 * - Nome, tipo, quantidade, preço unitário
 * - Desconto e total por item
 * - Ações de edição e remoção (quando editável)
 */

import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Badge,
  Button,
  Skeleton,
} from '@/components/ui';
import { QuoteItem, QuoteItemType } from '@/services/quotes.service';
import { Pencil, Trash2, Package, Wrench, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuoteItemsTableProps {
  items: QuoteItem[];
  isEditable?: boolean;
  isLoading?: boolean;
  onEditItem?: (item: QuoteItem) => void;
  onRemoveItem?: (item: QuoteItem) => void;
}

// Configuração de ícones por tipo
const typeConfig: Record<
  QuoteItemType,
  { icon: React.ElementType; label: string; color: string }
> = {
  PRODUCT: {
    icon: Package,
    label: 'Produto',
    color: 'text-info',
  },
  SERVICE: {
    icon: Wrench,
    label: 'Serviço',
    color: 'text-success',
  },
  BUNDLE: {
    icon: Layers,
    label: 'Kit',
    color: 'text-warning',
  },
};

// Formatar valor em moeda
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

// Loading skeleton
function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex gap-4 p-4">
          <Skeleton className="h-10 w-10 rounded" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  );
}

// Item row component
function ItemRow({
  item,
  isEditable,
  onEditItem,
  onRemoveItem,
}: {
  item: QuoteItem;
  isEditable: boolean;
  onEditItem?: (item: QuoteItem) => void;
  onRemoveItem?: (item: QuoteItem) => void;
}) {
  const config = typeConfig[item.type];
  const Icon = config.icon;

  return (
    <TableRow>
      {/* Nome e tipo */}
      <TableCell>
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex items-center justify-center w-10 h-10 rounded-lg bg-gray-100',
              config.color
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="font-medium text-gray-900">{item.name}</p>
            <p className="text-xs text-gray-500">{config.label}</p>
          </div>
        </div>
      </TableCell>

      {/* Unidade */}
      <TableCell className="text-center">
        <span className="text-sm text-gray-600">{item.unit}</span>
      </TableCell>

      {/* Quantidade */}
      <TableCell className="text-center">
        <span className="text-sm font-medium">{item.quantity}</span>
      </TableCell>

      {/* Preço unitário */}
      <TableCell className="text-right">
        <span className="text-sm text-gray-600">{formatCurrency(item.unitPrice)}</span>
      </TableCell>

      {/* Desconto */}
      <TableCell className="text-right">
        {item.discountValue > 0 ? (
          <Badge variant="soft-error" size="xs">
            -{formatCurrency(item.discountValue)}
          </Badge>
        ) : (
          <span className="text-sm text-gray-400">-</span>
        )}
      </TableCell>

      {/* Total */}
      <TableCell className="text-right">
        <span className="text-sm font-semibold text-gray-900">
          {formatCurrency(item.totalPrice)}
        </span>
      </TableCell>

      {/* Ações */}
      {isEditable && (
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onEditItem?.(item)}
              aria-label="Editar item"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onRemoveItem?.(item)}
              aria-label="Remover item"
              className="text-error hover:text-error hover:bg-error-50"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      )}
    </TableRow>
  );
}

export function QuoteItemsTable({
  items,
  isEditable = false,
  isLoading = false,
  onEditItem,
  onRemoveItem,
}: QuoteItemsTableProps) {
  if (isLoading) {
    return <TableSkeleton />;
  }

  if (!items || items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-gray-200 rounded-lg">
        <Package className="h-10 w-10 text-gray-300 mb-3" />
        <p className="text-sm text-gray-500">Nenhum item adicionado</p>
        <p className="text-xs text-gray-400 mt-1">
          Adicione produtos ou serviços ao orçamento
        </p>
      </div>
    );
  }

  // Calcular totais
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const totalDiscount = items.reduce((sum, item) => sum + item.discountValue, 0);
  const total = items.reduce((sum, item) => sum + item.totalPrice, 0);

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40%]">Item</TableHead>
            <TableHead className="w-[10%] text-center">Unidade</TableHead>
            <TableHead className="w-[10%] text-center">Qtd.</TableHead>
            <TableHead className="w-[15%] text-right">Preço Unit.</TableHead>
            <TableHead className="w-[10%] text-right">Desconto</TableHead>
            <TableHead className="w-[15%] text-right">Total</TableHead>
            {isEditable && <TableHead className="w-[80px]"></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              isEditable={isEditable}
              onEditItem={onEditItem}
              onRemoveItem={onRemoveItem}
            />
          ))}
        </TableBody>
      </Table>

      {/* Totais */}
      <div className="border-t bg-gray-50 px-4 py-3">
        <div className="flex justify-end">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal:</span>
              <span className="text-gray-700">{formatCurrency(subtotal)}</span>
            </div>
            {totalDiscount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Descontos:</span>
                <span className="text-error">-{formatCurrency(totalDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-semibold pt-2 border-t">
              <span className="text-gray-700">Total:</span>
              <span className="text-gray-900">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default QuoteItemsTable;
