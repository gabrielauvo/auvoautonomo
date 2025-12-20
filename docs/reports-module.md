# Dashboard & Reports Module

## Overview

The Dashboard & Reports module provides comprehensive analytics and reporting capabilities for the Auvo platform. It includes a main dashboard with KPIs and detailed reports for financial, sales, operations, and client data.

## Features

- **Main Dashboard** (`/dashboard`) - Overview with key metrics
- **Reports Overview** (`/reports`) - Summary of all reports with quick navigation
- **Financial Report** (`/reports/finance`) - Revenue, payments, and overdue analysis
- **Sales Report** (`/reports/sales`) - Quotes, conversions, and top services
- **Operations Report** (`/reports/operations`) - Work orders, completion rates, and productivity
- **Clients Report** (`/reports/clients`) - Client base, retention, and top clients

## PLG Integration

The module implements Product-Led Growth (PLG) strategy:

- **FREE Plan**: Basic dashboard with limited data
- **PRO Plan**: Full access to all reports, charts, and export features

Reports are protected with `ProFeatureOverlay` component that shows blurred preview and upgrade CTA for FREE users.

## Architecture

```
apps/web/src/
├── app/(dashboard)/
│   ├── dashboard/
│   │   └── page.tsx           # Main dashboard
│   └── reports/
│       ├── layout.tsx         # Reports layout with navigation
│       ├── page.tsx           # Reports overview
│       ├── finance/
│       │   └── page.tsx       # Financial report
│       ├── sales/
│       │   └── page.tsx       # Sales report
│       ├── operations/
│       │   └── page.tsx       # Operations report
│       └── clients/
│           └── page.tsx       # Clients report
├── components/reports/
│   ├── index.ts               # Exports
│   ├── kpi-card.tsx           # KPI display card
│   ├── report-filter-bar.tsx  # Period filter with URL sync
│   ├── time-series-chart.tsx  # Line/area charts
│   ├── bar-chart.tsx          # Bar charts
│   ├── pie-chart.tsx          # Pie/donut charts
│   └── pro-feature-overlay.tsx # PLG overlay for FREE users
├── services/
│   ├── analytics.service.ts   # Basic analytics API
│   └── reports.service.ts     # Detailed reports API
├── hooks/
│   ├── use-analytics.ts       # Analytics hooks
│   └── use-reports.ts         # Reports hooks with filters
└── types/
    └── reports.ts             # TypeScript interfaces
```

## Components

### KpiCard

Display key performance indicators with optional change indicator.

```tsx
<KpiCard
  title="Revenue"
  value={125000}
  change={12.5}
  changeLabel="vs. last month"
  format="currency"
  icon={<DollarSign />}
  loading={false}
/>
```

**Props:**
- `title`: string - Label for the KPI
- `value`: number | string - The value to display
- `change`: number - Percentage change (positive/negative)
- `changeLabel`: string - Label for the change
- `format`: 'number' | 'currency' | 'percent' - Value formatting
- `icon`: ReactNode - Icon to display
- `loading`: boolean - Shows skeleton when true

### ReportFilterBar

Period filter bar that syncs with URL query parameters.

```tsx
<ReportFilterBar
  onRefresh={() => refetch()}
  onExport={(format) => handleExport(format)}
  showExport={isPro}
  isLoading={isLoading}
/>
```

**Props:**
- `onRefresh`: () => void - Refresh callback
- `onExport`: (format: 'csv' | 'pdf') => void - Export callback
- `showExport`: boolean - Show export buttons
- `isLoading`: boolean - Disable buttons during loading

**URL Parameters:**
- `period`: 'today' | 'yesterday' | 'last7days' | 'last30days' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'custom'
- `startDate`: string (for custom period)
- `endDate`: string (for custom period)
- `groupBy`: 'day' | 'week' | 'month' | 'year'

### TimeSeriesChart

Line and area charts using Recharts.

```tsx
<TimeSeriesChart
  title="Revenue by Period"
  data={revenueData}
  series={[
    { key: 'received', name: 'Received', color: '#10B981', type: 'area' },
    { key: 'pending', name: 'Pending', color: '#F59E0B', type: 'line' },
  ]}
  height={300}
  formatYAxis={(v) => formatCurrency(v)}
/>
```

### BarChart

Vertical or horizontal bar charts.

```tsx
<BarChart
  title="Revenue by Payment Method"
  data={paymentData}
  horizontal={false}
  height={300}
/>
```

### PieChart

Pie or donut charts.

```tsx
<PieChart
  title="Distribution by Status"
  data={statusData}
  donut={true}
  height={300}
  formatValue={formatCurrency}
/>
```

### ProFeatureOverlay

PLG overlay for FREE plan restrictions.

```tsx
<ProFeatureOverlay
  title="Advanced Reports"
  description="Upgrade to access detailed analytics."
>
  <ProtectedContent />
</ProFeatureOverlay>
```

## Services

### reportsService

```typescript
// Dashboard overview
const overview = await reportsService.getDashboardOverview(filters);

// Finance report
const finance = await reportsService.getFinanceReport(filters);

// Sales report
const sales = await reportsService.getSalesReport(filters);

// Operations report
const operations = await reportsService.getOperationsReport(filters);

// Clients report
const clients = await reportsService.getClientsReport(filters);

// Export to file
const blob = await reportsService.exportReport('finance', 'csv', filters);
```

## Hooks

### useFinanceReport

```typescript
const { data, isLoading, error, refetch } = useFinanceReport(filters, enabled);
```

### useSalesReport

```typescript
const { data, isLoading, error, refetch } = useSalesReport(filters, enabled);
```

### useOperationsReport

```typescript
const { data, isLoading, error, refetch } = useOperationsReport(filters, enabled);
```

### useClientsReport

```typescript
const { data, isLoading, error, refetch } = useClientsReport(filters, enabled);
```

### useReportFilters

```typescript
const filters = useReportFilters(searchParams);
// Returns: { period, startDate, endDate, groupBy }
```

## API Endpoints

The module expects the following backend endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/reports/dashboard` | GET | Dashboard overview |
| `/reports/finance` | GET | Financial report |
| `/reports/sales` | GET | Sales report |
| `/reports/operations` | GET | Operations report |
| `/reports/clients` | GET | Clients report |
| `/reports/{type}/export` | GET | Export report (CSV/PDF) |

**Query Parameters:**
- `period`: Period preset
- `startDate`: Start date (ISO format)
- `endDate`: End date (ISO format)
- `groupBy`: Data grouping

## Testing

Run tests with:

```bash
npm test -- --testPathPattern="reports"
```

Test files:
- `src/components/reports/__tests__/kpi-card.test.tsx`
- `src/components/reports/__tests__/report-filter-bar.test.tsx`
- `src/components/reports/__tests__/pro-feature-overlay.test.tsx`
- `src/services/__tests__/reports.service.test.ts`
- `src/hooks/__tests__/use-reports.test.tsx`

## Dependencies

- `recharts` - Chart library
- `date-fns` - Date utilities
- `@tanstack/react-query` - Data fetching

## Design System Compliance

All components follow Auvo Design System:
- Color palette: Primary, Success, Warning, Error
- Typography: Inter font family
- Spacing: Tailwind spacing scale
- Components: Card, Button, Badge, Table, etc.
