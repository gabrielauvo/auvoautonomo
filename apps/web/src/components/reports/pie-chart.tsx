'use client';

/**
 * PieChart Component
 *
 * Gráfico de pizza/donut usando Recharts
 */

import {
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent, Skeleton } from '@/components/ui';

interface DataPoint {
  name: string;
  value: number;
  color?: string;
  [key: string]: string | number | undefined;
}

interface PieChartProps {
  title: string;
  subtitle?: string;
  data: DataPoint[];
  height?: number;
  showLegend?: boolean;
  loading?: boolean;
  donut?: boolean;
  formatValue?: (value: number) => string;
  className?: string;
  /** Label for tooltip value */
  valueLabel?: string;
  /** Label for center total in donut mode */
  totalLabel?: string;
}

/**
 * Formatador de número padrão
 */
function defaultFormatter(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value);
}

/**
 * Cores padrão para fatias
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

export function PieChart({
  title,
  subtitle,
  data,
  height = 300,
  showLegend = true,
  loading = false,
  donut = false,
  formatValue = defaultFormatter,
  className,
  valueLabel = 'Valor',
  totalLabel = 'Total',
}: PieChartProps) {
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

  const total = data.reduce((sum, item) => sum + item.value, 0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderCustomLabel = (props: any) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;

    if (percent < 0.05) return null; // Don't show label for slices < 5%

    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="#fff"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={12}
        fontWeight={600}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        {subtitle && (
          <p className="text-sm text-gray-500">{subtitle}</p>
        )}
      </CardHeader>
      <CardContent className="relative">
        <ResponsiveContainer width="100%" height={height}>
          <RechartsPieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={donut ? '60%' : 0}
              outerRadius="80%"
              paddingAngle={2}
              dataKey="value"
              labelLine={false}
              label={renderCustomLabel}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              }}
              formatter={(value) => [
                formatValue(typeof value === 'number' ? value : 0),
                valueLabel,
              ]}
              labelStyle={{ fontWeight: 600, marginBottom: 4 }}
            />
            {showLegend && (
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                iconSize={8}
                formatter={(value) => (
                  <span className="text-sm text-gray-600">{value}</span>
                )}
              />
            )}
          </RechartsPieChart>
        </ResponsiveContainer>
        {donut && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{formatValue(total)}</p>
              <p className="text-xs text-gray-500">{totalLabel}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default PieChart;
