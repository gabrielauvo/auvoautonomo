'use client';

/**
 * WorkOrderItemsTable - Tabela de itens da OS
 *
 * Exibe os itens da ordem de serviço com:
 * - Nome, tipo, quantidade, preço
 * - Modo editável com ações
 * - Modo somente leitura
 */

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui';
import { Button, Badge, Skeleton } from '@/components/ui';
import { Edit, Trash2, Package, Wrench, Layers } from 'lucide-react';
import { WorkOrderItem, WorkOrderItemType } from '@/services/work-orders.service';
import { cn } from '@/lib/utils';
import { useFormatting } from '@/context';

interface WorkOrderItemsTableProps {
  items: WorkOrderItem[];
  isEditable?: boolean;
  isLoading?: boolean;
  onEditItem?: (item: WorkOrderItem) => void;
  onRemoveItem?: (item: WorkOrderItem) => void;
}

// Configuração de tipos
const typeConfig: Record<
  WorkOrderItemType,
  { icon: React.ElementType; label: string; color: string }
> = {
  PRODUCT: { icon: Package, label: 'Produto', color: 'text-info' },
  SERVICE: { icon: Wrench, label: 'Serviço', color: 'text-success' },
  BUNDLE: { icon: Layers, label: 'Kit', color: 'text-warning' },
};


// Skeleton loader
function TableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

export function WorkOrderItemsTable({
  items,
  isEditable = false,
  isLoading = false,
  onEditItem,
  onRemoveItem,
}: WorkOrderItemsTableProps) {
  const { formatCurrency } = useFormatting();

  if (isLoading) {
    return <TableSkeleton />;
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Package className="h-12 w-12 text-gray-300 mb-3" />
        <p className="text-sm text-gray-500">Nenhum item adicionado</p>
        <p className="text-xs text-gray-400 mt-1">
          Adicione itens do catálogo ou crie itens manuais
        </p>
      </div>
    );
  }

  // Cálculos
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const totalDiscount = items.reduce((sum, item) => sum + item.discountValue, 0);
  const total = items.reduce((sum, item) => sum + item.totalPrice, 0);

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10"></TableHead>
            <TableHead>Item</TableHead>
            <TableHead className="text-right w-20">Qtd</TableHead>
            <TableHead className="text-right w-28">Unitário</TableHead>
            {totalDiscount > 0 && (
              <TableHead className="text-right w-24">Desc.</TableHead>
            )}
            <TableHead className="text-right w-28">Total</TableHead>
            {isEditable && <TableHead className="w-20"></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const config = typeConfig[item.type] || typeConfig.SERVICE;
            const Icon = config.icon;

            return (
              <TableRow key={item.id}>
                <TableCell>
                  <div className={cn('p-1.5 rounded', config.color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium text-gray-900">{item.name}</p>
                    <p className="text-xs text-gray-500">
                      {config.label} • {item.unit}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {item.quantity}
                </TableCell>
                <TableCell className="text-right text-gray-600">
                  {formatCurrency(item.unitPrice)}
                </TableCell>
                {totalDiscount > 0 && (
                  <TableCell className="text-right text-error">
                    {item.discountValue > 0
                      ? `-${formatCurrency(item.discountValue)}`
                      : '-'}
                  </TableCell>
                )}
                <TableCell className="text-right font-medium text-gray-900">
                  {formatCurrency(item.totalPrice)}
                </TableCell>
                {isEditable && (
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {onEditItem && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => onEditItem(item)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      {onRemoveItem && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => onRemoveItem(item)}
                          className="text-error hover:text-error hover:bg-error-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Resumo */}
      <div className="flex justify-end">
        <div className="w-64 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Subtotal:</span>
            <span className="text-gray-700">{formatCurrency(subtotal)}</span>
          </div>
          {totalDiscount > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">Desconto:</span>
              <span className="text-error">-{formatCurrency(totalDiscount)}</span>
            </div>
          )}
          <div className="flex justify-between pt-2 border-t text-base font-semibold">
            <span className="text-gray-700">Total:</span>
            <span className="text-gray-900">{formatCurrency(total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WorkOrderItemsTable;
