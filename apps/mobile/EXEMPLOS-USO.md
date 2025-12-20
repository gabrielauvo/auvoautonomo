# Exemplos Práticos de Uso - Otimizações Mobile

Este documento contém exemplos práticos de como usar as novas otimizações no código mobile.

---

## 1. Fazer Requisição HTTP com Timeout

### Antes (Problemático)
```typescript
// ❌ Sem timeout - pode travar indefinidamente
const response = await fetch('https://api.example.com/data', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ foo: 'bar' }),
});
```

### Depois (Otimizado)
```typescript
// ✅ Com timeout e retry
import { fetchWithTimeout } from '@/utils/fetch-with-timeout';

const response = await fetchWithTimeout('https://api.example.com/data', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ foo: 'bar' }),
  timeout: 30000, // 30s timeout
  retries: 2, // Retry até 2 vezes
  onRetry: (attempt, error) => {
    console.log(`Tentativa ${attempt} falhou: ${error.message}`);
  },
});
```

---

## 2. Upload de Arquivo com Validação

### Antes (Sem Validação)
```typescript
// ❌ Upload sem validar - pode falhar no servidor
const formData = new FormData();
formData.append('file', {
  uri: fileUri,
  type: 'image/jpeg',
  name: 'photo.jpg',
});

await fetch(uploadUrl, {
  method: 'POST',
  body: formData,
});
```

### Depois (Com Validação)
```typescript
// ✅ Validar antes de fazer upload
import { validateFile } from '@/utils/file-validation';
import { shouldAllowUpload } from '@/utils/battery-optimization';

// 1. Validar arquivo
const validation = await validateFile(
  { uri: fileUri, mimeType: 'image/jpeg' },
  {
    maxSizeMB: 10,
    allowedTypes: ['image'],
    validateImageContent: true, // Verifica magic bytes
  }
);

if (!validation.valid) {
  Alert.alert('Erro', validation.error);
  return;
}

// 2. Verificar se rede permite upload
const { allowed, reason } = shouldAllowUpload(validation.fileSize!);
if (!allowed) {
  Alert.alert('Upload bloqueado', reason);
  return;
}

// 3. Fazer upload
const formData = new FormData();
formData.append('file', {
  uri: fileUri,
  type: validation.mimeType,
  name: 'photo.jpg',
});

await fetchWithTimeout(uploadUrl, {
  method: 'POST',
  body: formData,
  timeout: 120000, // 2min para uploads
  retries: 2,
});
```

---

## 3. Sync Adaptativo Baseado em Rede

### Antes (Sync Fixo)
```typescript
// ❌ Sempre faz sync a cada 30s (gasta bateria em cellular)
useEffect(() => {
  const interval = setInterval(() => {
    syncEngine.syncAll();
  }, 30000);

  return () => clearInterval(interval);
}, []);
```

### Depois (Sync Inteligente)
```typescript
// ✅ Ajusta intervalo baseado em rede e app state
import { getRecommendedSyncInterval, onNetworkChange, onAppStateChange } from '@/utils/battery-optimization';

useEffect(() => {
  let intervalId: NodeJS.Timeout;

  const setupSync = () => {
    // Limpar intervalo anterior
    if (intervalId) clearInterval(intervalId);

    // Obter intervalo recomendado (30s WiFi, 2min Cellular, 5min Background)
    const interval = getRecommendedSyncInterval();

    // Configurar novo intervalo
    intervalId = setInterval(() => {
      syncEngine.syncAll();
    }, interval);
  };

  // Configurar sync inicial
  setupSync();

  // Reconfigurar quando rede mudar
  const unsubNetwork = onNetworkChange((network) => {
    console.log(`Rede mudou para ${network.type}`);
    setupSync();
  });

  // Reconfigurar quando app state mudar
  const unsubAppState = onAppStateChange((state) => {
    console.log(`App state mudou para ${state}`);
    setupSync();
  });

  return () => {
    if (intervalId) clearInterval(intervalId);
    unsubNetwork();
    unsubAppState();
  };
}, []);
```

---

## 4. Download de Imagens Inteligente

### Antes (Sempre Baixa)
```typescript
// ❌ Sempre baixa imagens (gasta dados em cellular)
const imageUrl = `https://api.example.com/images/${imageId}`;
return <Image source={{ uri: imageUrl }} />;
```

### Depois (Verifica Rede)
```typescript
// ✅ Só baixa se for apropriado
import { shouldDownloadImages, isWiFi } from '@/utils/battery-optimization';
import { imageCache } from '@/cache/ImageCache';

const ImageWithCache = ({ imageId }: { imageId: string }) => {
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadImage = async () => {
      const imageUrl = `https://api.example.com/images/${imageId}`;

      // Verificar se já está em cache
      const cached = await imageCache.getCachedUri(imageUrl);
      if (cached) {
        setLocalUri(cached);
        setLoading(false);
        return;
      }

      // Verificar se deve baixar
      if (!shouldDownloadImages()) {
        // Em cellular e configurado para não baixar
        setLoading(false);
        return;
      }

      // Baixar e cachear
      try {
        const uri = await imageCache.getOrDownload(imageUrl);
        setLocalUri(uri);
      } catch (error) {
        console.error('Erro ao baixar imagem:', error);
      } finally {
        setLoading(false);
      }
    };

    loadImage();
  }, [imageId]);

  if (loading) {
    return <ActivityIndicator />;
  }

  if (!localUri) {
    return <Text>Conecte ao WiFi para ver imagens</Text>;
  }

  return <Image source={{ uri: localUri }} />;
};
```

---

## 5. Compressão Adaptativa de Imagens

### Antes (Compressão Fixa)
```typescript
// ❌ Sempre comprime com a mesma qualidade
const compressedImage = await ImageManipulator.manipulateAsync(
  imageUri,
  [{ resize: { width: 800 } }],
  { compress: 0.7, format: SaveFormat.JPEG }
);
```

### Depois (Compressão Inteligente)
```typescript
// ✅ Comprime mais em cellular
import { shouldAggressivelyCompressImages } from '@/utils/battery-optimization';

const compressImage = async (imageUri: string) => {
  // Compressão adaptativa
  const quality = shouldAggressivelyCompressImages() ? 0.5 : 0.8;
  const maxWidth = shouldAggressivelyCompressImages() ? 600 : 1200;

  const compressedImage = await ImageManipulator.manipulateAsync(
    imageUri,
    [{ resize: { width: maxWidth } }],
    { compress: quality, format: SaveFormat.JPEG, base64: true }
  );

  return compressedImage;
};
```

---

## 6. Hook Customizado para Rede

```typescript
// Hook útil para componentes que dependem da rede
import { useState, useEffect } from 'react';
import { onNetworkChange, NetworkInfo } from '@/utils/battery-optimization';

export const useNetwork = () => {
  const [network, setNetwork] = useState<NetworkInfo>({
    type: 'unknown',
    isConnected: false,
    isInternetReachable: null,
    isExpensive: false,
  });

  useEffect(() => {
    const unsubscribe = onNetworkChange((info) => {
      setNetwork(info);
    });

    return unsubscribe;
  }, []);

  return {
    ...network,
    isWiFi: network.type === 'wifi',
    isCellular: network.type === 'cellular',
    isOffline: !network.isConnected,
  };
};

// Uso no componente
const MyComponent = () => {
  const { isWiFi, isCellular, isOffline } = useNetwork();

  if (isOffline) {
    return <Text>Você está offline</Text>;
  }

  if (isCellular) {
    return <Text>Usando dados móveis - sync reduzido</Text>;
  }

  return <Text>WiFi conectado - sync completo ativo</Text>;
};
```

---

## 7. Validação de Múltiplos Arquivos

```typescript
import { validateFile, formatFileSize } from '@/utils/file-validation';

const validateMultipleFiles = async (files: string[]) => {
  const results = await Promise.all(
    files.map(async (uri) => {
      const validation = await validateFile(
        { uri },
        { maxSizeMB: 10, allowedTypes: ['image', 'pdf'] }
      );
      return { uri, validation };
    })
  );

  const invalid = results.filter((r) => !r.validation.valid);

  if (invalid.length > 0) {
    const errors = invalid.map((r) => r.validation.error).join('\n');
    Alert.alert('Arquivos Inválidos', errors);
    return false;
  }

  const totalSize = results.reduce(
    (sum, r) => sum + (r.validation.fileSize || 0),
    0
  );

  console.log(`Total: ${formatFileSize(totalSize)}`);
  return true;
};
```

---

## 8. Cancelamento de Requisição

```typescript
import { fetchWithTimeout } from '@/utils/fetch-with-timeout';

// Criar AbortController para cancelar manualmente
const controller = new AbortController();

const fetchData = async () => {
  try {
    const response = await fetchWithTimeout('https://api.example.com/data', {
      signal: controller.signal,
      timeout: 30000,
    });
    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('Requisição cancelada pelo usuário');
    } else {
      console.error('Erro:', error);
    }
  }
};

// Cancelar depois de 5s (exemplo)
setTimeout(() => controller.abort(), 5000);

// Ou cancelar ao desmontar componente
useEffect(() => {
  const controller = new AbortController();
  fetchData(controller);

  return () => {
    controller.abort(); // Cancela se componente desmontar
  };
}, []);
```

---

## 9. Estatísticas de Cache

```typescript
import { imageCache } from '@/cache/ImageCache';

const CacheStats = () => {
  const [stats, setStats] = useState(imageCache.getStats());

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(imageCache.getStats());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const hitRate = (stats.hitRate * 100).toFixed(1);
  const totalSizeMB = (stats.totalSize / (1024 * 1024)).toFixed(1);

  return (
    <View>
      <Text>Itens em cache: {stats.itemCount}</Text>
      <Text>Tamanho total: {totalSizeMB}MB</Text>
      <Text>Taxa de acerto: {hitRate}%</Text>
      <Text>Hits: {stats.hitCount}</Text>
      <Text>Misses: {stats.missCount}</Text>
      <Button title="Limpar Cache" onPress={() => imageCache.clear()} />
    </View>
  );
};
```

---

## 10. Indicador de Tipo de Rede

```typescript
import { useNetwork } from '@/hooks/useNetwork'; // Hook do exemplo 6

const NetworkIndicator = () => {
  const { type, isConnected, isExpensive } = useNetwork();

  if (!isConnected) {
    return (
      <View style={styles.offline}>
        <Icon name="wifi-off" />
        <Text>Offline</Text>
      </View>
    );
  }

  if (isExpensive) {
    return (
      <View style={styles.cellular}>
        <Icon name="signal-cellular" />
        <Text>Dados Móveis - Sync Reduzido</Text>
      </View>
    );
  }

  return (
    <View style={styles.wifi}>
      <Icon name="wifi" />
      <Text>WiFi - Sync Completo</Text>
    </View>
  );
};
```

---

## Resumo

Estes exemplos mostram como usar as novas otimizações de forma prática:

1. **fetchWithTimeout:** Para todas as requisições HTTP
2. **file-validation:** Antes de uploads
3. **battery-optimization:** Para sync inteligente e economia de recursos
4. **imageCache:** Para cache eficiente de imagens

Todas as otimizações são **opcionais** e **retrocompatíveis** - você pode adotar gradualmente conforme necessário.
