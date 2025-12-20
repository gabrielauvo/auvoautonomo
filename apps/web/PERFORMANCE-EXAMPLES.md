# Performance Optimizations - Exemplos Práticos

## Como Aplicar as Otimizações no Seu Código

---

## 1. Debounce em Inputs de Busca

### Exemplo: Campo de busca de clientes

```tsx
'use client';

import { useState } from 'react';
import { useDebounce } from '@/hooks/use-debounce';
import { useClients } from '@/hooks/use-clients';
import { Input } from '@/components/ui';
import { Search } from 'lucide-react';

export function ClientSearch() {
  const [search, setSearch] = useState('');

  // O valor só é atualizado 300ms após parar de digitar
  const debouncedSearch = useDebounce(search, 300);

  // A query só é executada com o valor debounced
  const { data: clients, isLoading } = useClients(debouncedSearch);

  return (
    <div>
      <Input
        placeholder="Buscar clientes..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        leftIcon={<Search className="h-4 w-4" />}
      />

      {/* Mostra loading enquanto debouncing */}
      {isLoading && <p>Buscando...</p>}

      {/* Renderiza resultados */}
      {clients?.map(client => (
        <ClientCard key={client.id} client={client} />
      ))}
    </div>
  );
}
```

### Exemplo: Debounce de callback (para auto-save)

```tsx
import { useDebouncedCallback } from '@/hooks/use-debounce';

export function AutoSaveForm() {
  const [formData, setFormData] = useState({ name: '', email: '' });

  // Salva automaticamente 1s após última edição
  const saveForm = useDebouncedCallback(
    async (data) => {
      await api.saveForm(data);
      toast.success('Salvo automaticamente!');
    },
    1000
  );

  const handleChange = (field: string, value: string) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);
    saveForm(newData); // Só executa após 1s sem mudanças
  };

  return (
    <form>
      <Input
        value={formData.name}
        onChange={(e) => handleChange('name', e.target.value)}
      />
    </form>
  );
}
```

---

## 2. VirtualizedList para Listas Grandes

### Exemplo: Lista de 1000+ clientes

```tsx
import { VirtualizedList } from '@/components/ui';

export function ClientsList({ clients }: { clients: Client[] }) {
  // Se tiver menos de 100 items, renderiza normal
  if (clients.length < 100) {
    return (
      <div className="space-y-2">
        {clients.map(client => (
          <ClientRow key={client.id} client={client} />
        ))}
      </div>
    );
  }

  // Se tiver 100+ items, usa virtualização
  return (
    <VirtualizedList
      items={clients}
      itemHeight={72} // Altura de cada ClientRow
      height={600} // Altura do container
      renderItem={(client, index) => (
        <ClientRow key={client.id} client={client} />
      )}
      // Infinite scroll (opcional)
      onEndReached={() => loadMoreClients()}
      endReachedThreshold={200}
      isLoading={isLoadingMore}
    />
  );
}

// Componente de cada item deve ter altura fixa
function ClientRow({ client }: { client: Client }) {
  return (
    <div className="h-[72px] flex items-center gap-4 p-4 border-b">
      <Avatar src={client.avatar} fallback={client.name} />
      <div className="flex-1">
        <p className="font-medium">{client.name}</p>
        <p className="text-sm text-gray-500">{client.email}</p>
      </div>
    </div>
  );
}
```

### Exemplo: Grid virtualizado (catálogo de produtos)

```tsx
import { VirtualizedGrid } from '@/components/ui';

export function ProductCatalog({ products }: { products: Product[] }) {
  return (
    <VirtualizedGrid
      items={products}
      itemHeight={280} // Altura de cada card
      itemsPerRow={3} // 3 colunas
      height={800}
      gap={16}
      renderItem={(product, index) => (
        <ProductCard key={product.id} product={product} />
      )}
    />
  );
}

function ProductCard({ product }: { product: Product }) {
  return (
    <div className="h-[280px] border rounded-lg p-4">
      <img src={product.image} className="h-40 w-full object-cover" />
      <h3 className="mt-2 font-medium">{product.name}</h3>
      <p className="text-lg font-bold">{formatCurrency(product.price)}</p>
    </div>
  );
}
```

---

## 3. React.memo e useMemo

### Exemplo: Componente que recebe props complexas

```tsx
import { memo, useMemo } from 'react';

interface ChartProps {
  data: DataPoint[];
  type: 'line' | 'bar';
  config: ChartConfig;
}

// Memo evita re-render se props não mudarem
export const Chart = memo(function Chart({ data, type, config }: ChartProps) {
  // useMemo para cálculos pesados
  const processedData = useMemo(() => {
    return data.map(point => ({
      ...point,
      value: calculateValue(point), // Função pesada
    }));
  }, [data]); // Só recalcula se 'data' mudar

  const chartOptions = useMemo(() => ({
    ...config,
    colors: generateColors(data.length),
  }), [config, data.length]);

  return <ChartLibrary data={processedData} options={chartOptions} />;
});

// Comparação customizada (opcional)
export const ChartWithCustomCompare = memo(
  Chart,
  (prevProps, nextProps) => {
    // Retorna true se props são iguais (não deve re-renderizar)
    return (
      prevProps.type === nextProps.type &&
      prevProps.data.length === nextProps.data.length &&
      JSON.stringify(prevProps.config) === JSON.stringify(nextProps.config)
    );
  }
);
```

### Exemplo: useCallback para handlers

```tsx
import { useState, useCallback } from 'react';

export function DataTable({ items }: { items: Item[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState('name');

  // Sem useCallback, esta função é recriada a cada render
  // Com useCallback, só recria se selectedId mudar
  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    logAnalytics('item_selected', { id });
  }, []); // Array vazio = função nunca muda

  const handleSort = useCallback((field: string) => {
    setSortBy(field);
  }, []); // Nunca muda

  // Sorted items memoizados
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) =>
      a[sortBy].localeCompare(b[sortBy])
    );
  }, [items, sortBy]);

  return (
    <div>
      <SortControls onSort={handleSort} />
      {sortedItems.map(item => (
        <TableRow
          key={item.id}
          item={item}
          isSelected={item.id === selectedId}
          onSelect={handleSelect} // Função estável
        />
      ))}
    </div>
  );
}

// TableRow usa memo para não re-renderizar desnecessariamente
const TableRow = memo(function TableRow({
  item,
  isSelected,
  onSelect,
}: {
  item: Item;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      className={isSelected ? 'bg-blue-50' : ''}
      onClick={() => onSelect(item.id)}
    >
      {item.name}
    </div>
  );
});
```

---

## 4. Loading States

### Exemplo: Página com skeleton

```tsx
import { ListSkeleton, CardSkeleton } from '@/components/ui';

export function DashboardPage() {
  const { data: stats, isLoading: loadingStats } = useStats();
  const { data: items, isLoading: loadingItems } = useItems();

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-4">
        {loadingStats ? (
          // Skeleton enquanto carrega
          Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))
        ) : (
          stats.map(stat => (
            <KpiCard key={stat.id} {...stat} />
          ))
        )}
      </div>

      {/* Lista de items */}
      {loadingItems ? (
        <ListSkeleton count={5} />
      ) : (
        <ItemsList items={items} />
      )}
    </div>
  );
}
```

### Exemplo: Loading overlay para ações

```tsx
import { useState } from 'react';
import { GlobalLoadingSpinner } from '@/components/ui';

export function FormPage() {
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.save(formData);
      toast.success('Salvo!');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <GlobalLoadingSpinner show={isSaving} />

      <form onSubmit={handleSave}>
        {/* form fields */}
        <Button type="submit" disabled={isSaving}>
          Salvar
        </Button>
      </form>
    </>
  );
}
```

---

## 5. Next.js Image

### Exemplo: Avatar com next/image

```tsx
import Image from 'next/image';

export function UserAvatar({ user }: { user: User }) {
  return (
    <div className="relative h-12 w-12 rounded-full overflow-hidden">
      <Image
        src={user.avatar || '/default-avatar.png'}
        alt={user.name}
        fill
        className="object-cover"
        sizes="48px" // Tamanho real do avatar
        priority={false} // Lazy load por padrão
      />
    </div>
  );
}
```

### Exemplo: Hero image com placeholder blur

```tsx
import Image from 'next/image';
import heroImage from '@/public/hero.jpg';

export function Hero() {
  return (
    <div className="relative h-[500px] w-full">
      <Image
        src={heroImage}
        alt="Hero"
        fill
        className="object-cover"
        priority // Carrega imediatamente
        placeholder="blur" // Blur enquanto carrega
        sizes="100vw"
      />
    </div>
  );
}
```

---

## 6. Dynamic Imports

### Exemplo: Modal pesado com lazy loading

```tsx
import { useState } from 'react';
import { DynamicModal } from '@/components/ui/dynamic-modal';

// Modal só é baixado quando isOpen vira true
const PdfPreviewModal = DynamicModal(
  () => import('@/components/pdf/pdf-preview-modal')
);

export function InvoiceCard({ invoice }: { invoice: Invoice }) {
  const [showPdf, setShowPdf] = useState(false);

  return (
    <div>
      <Button onClick={() => setShowPdf(true)}>
        Ver PDF
      </Button>

      {/* Componente só é baixado quando abrir */}
      <PdfPreviewModal
        isOpen={showPdf}
        onClose={() => setShowPdf(false)}
        invoiceId={invoice.id}
      />
    </div>
  );
}
```

### Exemplo: Tab com conteúdo pesado

```tsx
import { useState } from 'react';
import dynamic from 'next/dynamic';

// Charts são carregados sob demanda
const SalesChart = dynamic(() => import('@/components/charts/sales-chart'), {
  loading: () => <CardSkeleton />,
  ssr: false, // Não renderiza no servidor
});

const AnalyticsChart = dynamic(() => import('@/components/charts/analytics-chart'), {
  loading: () => <CardSkeleton />,
  ssr: false,
});

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<'sales' | 'analytics'>('sales');

  return (
    <div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="sales">Vendas</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="sales">
          {/* Chart só carrega quando tab é ativa */}
          {activeTab === 'sales' && <SalesChart />}
        </TabsContent>

        <TabsContent value="analytics">
          {activeTab === 'analytics' && <AnalyticsChart />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

---

## Checklist de Performance

Antes de fazer deploy, verifique:

### Inputs de Busca
- [ ] Todos os inputs de busca usam `useDebounce`
- [ ] Delay de 300-500ms configurado
- [ ] Loading state visível durante busca

### Listas
- [ ] Listas com 100+ items usam `VirtualizedList`
- [ ] Height dos items é fixo
- [ ] Infinite scroll implementado se necessário

### Componentes
- [ ] Componentes pesados usam `React.memo`
- [ ] Cálculos complexos usam `useMemo`
- [ ] Handlers passados como props usam `useCallback`

### Imagens
- [ ] Todas as imagens usam `next/image`
- [ ] `sizes` configurado corretamente
- [ ] `priority` definido para images above-the-fold

### Code Splitting
- [ ] Modais pesados usam `DynamicModal`
- [ ] Charts usam `dynamic()`
- [ ] Páginas de admin/settings são lazy loaded

### Loading States
- [ ] `ProgressBar` no layout
- [ ] Skeletons em todas as páginas
- [ ] Loading feedback em ações assíncronas

---

## Medindo Impacto

### Antes de otimizar:
```bash
# Faça um build e meça
npm run build
# Anote: Bundle size, Build time

# Teste performance
# Lighthouse score
# Time to Interactive
```

### Depois de otimizar:
```bash
# Build novamente
npm run build
# Compare: Bundle size, Build time

# Teste performance novamente
# Verifique melhoria em Lighthouse
```

### Métricas esperadas:
- Bundle size: -30 a -50%
- Time to Interactive: -40 a -60%
- Lighthouse Performance: +15 a +25 pontos
- Re-renders: -70 a -90% em listas

---

## Dicas Finais

1. **Priorize**: Otimize páginas mais acessadas primeiro
2. **Meça sempre**: Use React DevTools Profiler
3. **Lazy load**: Componentes pesados e raramente usados
4. **Memoize**: Cálculos complexos e componentes
5. **Debounce**: Inputs de busca e auto-save
6. **Virtualize**: Listas com 100+ items
7. **Next/Image**: Sempre use para imagens
8. **Code split**: Modais, charts, admin pages

**Performance é iterativo - continue melhorando!**
