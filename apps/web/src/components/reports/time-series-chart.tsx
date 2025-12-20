'use client';

/**
 * TimeSeriesChart Component
 *
 * Gráfico de linha/área para séries temporais usando Recharts
 */

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent, Skeleton } from '@/components/ui';
import { cn } from '@/lib/utils';

interface DataPoint {
  date: string;
  label: string;
  [key: string]: string | number;
}

interface SeriesConfig {
  key: string;
  name: string;
  color: string;
  type?: 'line' | 'area';
}

interface TimeSeriesChartProps {
  title: string;
  subtitle?: string;
  data: DataPoint[];
  series: SeriesConfig[];
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  loading?: boolean;
  formatYAxis?: (value: number) => string;
  formatTooltip?: (value: number, name: string) => string;
  className?: string;
}

/**
 * Formatador de moeda padrão
 */
function defaultCurrencyFormatter(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Formatador de número padrão
 */
function defaultNumberFormatter(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value);
}

export function TimeSeriesChart({
  title,
  subtitle,
  data,
  series,
  height = 300,
  showGrid = true,
  showLegend = true,
  loading = false,
  formatYAxis = defaultNumberFormatter,
  formatTooltip,
  className,
}: TimeSeriesChartProps) {
  const hasAreaSeries = series.some((s) => s.type === 'area');
  const ChartComponent = hasAreaSeries ? AreaChart : LineChart;

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
          <ChartComponent data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            {showGrid && (
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            )}
            <XAxis
              dataKey="label"
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
                iconType="circle"
                iconSize={8}
              />
            )}
            {series.map((s) =>
              s.type === 'area' ? (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.name}
                  stroke={s.color}
                  fill={s.color}
                  fillOpacity={0.1}
                  strokeWidth={2}
                />
              ) : (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.name}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={{ fill: s.color, strokeWidth: 0, r: 3 }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                />
              )
            )}
          </ChartComponent>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export default TimeSeriesChart;
