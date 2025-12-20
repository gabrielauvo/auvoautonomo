'use client';

/**
 * BarChart Component
 *
 * Gráfico de barras usando Recharts
 */

import {
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent, Skeleton } from '@/components/ui';

interface DataPoint {
  name: string;
  value: number;
  color?: string;
  [key: string]: string | number | undefined;
}

interface BarConfig {
  key: string;
  name: string;
  color: string;
}

interface BarChartProps {
  title: string;
  subtitle?: string;
  data: DataPoint[];
  bars?: BarConfig[];
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  loading?: boolean;
  horizontal?: boolean;
  formatYAxis?: (value: number) => string;
  formatTooltip?: (value: number, name: string) => string;
  className?: string;
}

/**
 * Formatador de número padrão
 */
function defaultFormatter(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value);
}

/**
 * Cores padrão para barras
 */
const DEFAULT_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
];

export function BarChart({
  title,
  subtitle,
  data,
  bars,
  height = 300,
  showGrid = true,
  showLegend = false,
  loading = false,
  horizontal = false,
  formatYAxis = defaultFormatter,
  formatTooltip,
  className,
}: BarChartProps) {
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
          {subtitle && <Skeleton className="h-4 w-32 mt-1" />}
        </CardHeader>
        <CardContent>
          <Skeleton className="w-full" style={{ height }} />
        </CardContent>
      </Card>
    );
  }

  // Single bar mode with colors per item
  const isSingleBar = !bars || bars.length === 0;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        {subtitle && (
          <p className="text-sm text-gray-500">{subtitle}</p>
        )}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <RechartsBarChart
            data={data}
            layout={horizontal ? 'vertical' : 'horizontal'}
            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
          >
            {showGrid && (
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            )}
            {horizontal ? (
              <>
                <XAxis
                  type="number"
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                  tickLine={false}
                  axisLine={{ stroke: '#E5E7EB' }}
                  tickFormatter={formatYAxis}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                  tickLine={false}
                  axisLine={false}
                  width={100}
                />
              </>
            ) : (
              <>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                  tickLine={false}
                  axisLine={{ stroke: '#E5E7EB' }}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatYAxis}
                />
              </>
            )}
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              }}
              formatter={(value, name) =>
                formatTooltip ? formatTooltip(Number(value) || 0, String(name)) : [formatYAxis(Number(value) || 0), String(name)]
              }
              labelStyle={{ fontWeight: 600, marginBottom: 4 }}
            />
            {showLegend && (
              <Legend
                wrapperStyle={{ paddingTop: 20 }}
                iconType="rect"
                iconSize={12}
              />
            )}
            {isSingleBar ? (
              <Bar dataKey="value" name="Valor" radius={[4, 4, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
                  />
                ))}
              </Bar>
            ) : (
              bars?.map((bar) => (
                <Bar
                  key={bar.key}
                  dataKey={bar.key}
                  name={bar.name}
                  fill={bar.color}
                  radius={[4, 4, 0, 0]}
                />
              ))
            )}
          </RechartsBarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export default BarChart;
