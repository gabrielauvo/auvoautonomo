'use client';

/**
 * Inventory Movements Page
 *
 * Historico de movimentacoes de estoque:
 * - Filtros por produto, tipo, fonte, data
 * - Paginacao
 * - Detalhes de cada movimentacao
 */

import { useState } from 'react';
import { useTranslations } from '@/i18n';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  History,
  ArrowUpCircle,
  ArrowDownCircle,
  Filter,
  Package,
} from 'lucide-react';
import Link from 'next/link';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Skeleton,
  Input,
  SearchSelect,
} from '@/components/ui';
import {
  getInventoryMovements,
  MovementListResponse,
  MovementListQuery,
} from '@/services/inventory.service';

const TYPE_OPTIONS = [
  { value: '', label: 'Todos os tipos' },
  { value: 'ADJUSTMENT_IN', label: 'Entrada Manual' },
  { value: 'ADJUSTMENT_OUT', label: 'Saida Manual' },
  { value: 'WORK_ORDER_OUT', label: 'Baixa por OS' },
  { value: 'INITIAL', label: 'Saldo Inicial' },
] as const;

const SOURCE_OPTIONS = [
  { value: '', label: 'Todas as origens' },
  { value: 'MANUAL', label: 'Manual' },
  { value: 'WORK_ORDER', label: 'Ordem de Servico' },
  { value: 'IMPORT', label: 'Importacao' },
  { value: 'SYSTEM', label: 'Sistema' },
] as const;

export default function MovementsPage() {
  const { t } = useTranslations('inventory');

  // Filters
  const [type, setType] = useState<string>('');
  const [source, setSource] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(0);
  const limit = 20;

  // Build query
  const query: MovementListQuery = {
    limit,
    offset: page * limit,
  };
  if (type) query.type = type as any;
  if (source) query.source = source as any;
  if (startDate) query.startDate = startDate;
  if (endDate) query.endDate = endDate;

  // Fetch movements
  const { data: movements, isLoading } = useQuery<MovementListResponse>({
    queryKey: ['inventoryMovements', query],
    queryFn: () => getInventoryMovements(query),
  });

  const totalPages = movements ? Math.ceil(movements.total / limit) : 0;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/inventory">
          <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="h-4 w-4" />}>
            Voltar
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <History className="h-6 w-6" />
            {t('movements.title')}
          </h1>
          <p className="text-gray-500 mt-1">{t('movements.description')}</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                {t('movements.type')}
              </label>
              <SearchSelect
                options={TYPE_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
                value={type}
                onChange={(val) => {
                  setType(val);
                  setPage(0);
                }}
                placeholder="Todos os tipos"
                searchPlaceholder="Buscar tipo..."
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                {t('movements.source')}
              </label>
              <SearchSelect
                options={SOURCE_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
                value={source}
                onChange={(val) => {
                  setSource(val);
                  setPage(0);
                }}
                placeholder="Todas as origens"
                searchPlaceholder="Buscar origem..."
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Data inicial
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(0);
                }}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Data final
              </label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(0);
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Movements list */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : !movements || movements.items.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p>{t('movements.noMovements')}</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">
                        {t('movements.date')}
                      </th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">
                        Produto
                      </th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">
                        {t('movements.type')}
                      </th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">
                        {t('movements.source')}
                      </th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">
                        {t('movements.quantity')}
                      </th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">
                        {t('movements.balanceAfter')}
                      </th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">
                        {t('movements.notes')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {movements.items.map((mov) => (
                      <tr key={mov.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {formatDate(mov.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium">{mov.itemName}</span>
                          {mov.itemSku && (
                            <span className="text-xs text-gray-500 ml-2">
                              ({mov.itemSku})
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                              mov.type === 'ADJUSTMENT_IN' || mov.type === 'INITIAL'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {mov.quantity > 0 ? (
                              <ArrowUpCircle className="h-3 w-3" />
                            ) : (
                              <ArrowDownCircle className="h-3 w-3" />
                            )}
                            {t(`movements.types.${mov.type}`)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {t(`movements.sources.${mov.source}`)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`font-bold ${
                              mov.quantity > 0 ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {mov.quantity > 0 ? '+' : ''}
                            {mov.quantity.toFixed(mov.quantity % 1 === 0 ? 0 : 2)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-sm">
                          {mov.balanceAfter.toFixed(0)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                          {mov.notes || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <p className="text-sm text-gray-500">
                    Mostrando {page * limit + 1} a{' '}
                    {Math.min((page + 1) * limit, movements.total)} de {movements.total}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page >= totalPages - 1}
                    >
                      Proximo
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
