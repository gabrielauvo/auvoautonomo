# Filesystem Attachments (Item 4)

## Overview

Esta otimização remove o armazenamento de `base64Data` do SQLite para anexos de checklists, migrando para o filesystem. Resolve problemas de OOM (Out of Memory) ao carregar múltiplos anexos grandes.

## Problema Original

O armazenamento de `base64Data` diretamente no SQLite causava:

```
ANTES:
┌─────────────────────────────────────────────────────────────────────┐
│  SQLite checklist_attachments                                        │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ id: "att-123"                                                   ││
│  │ base64Data: "iVBORw0KGgoAAAANSUhEUg..." (2-10 MB por anexo!)   ││
│  │ mimeType: "image/jpeg"                                          ││
│  │ syncStatus: "PENDING"                                           ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘

Problemas:
- OOM ao carregar múltiplos anexos (10 anexos × 5MB = 50MB na memória)
- Database bloat (SQLite com 500MB+ para poucos anexos)
- Queries lentas devido ao tamanho das rows
- Backup/restore lento
```

## Solução Implementada

### Diagrama de Fluxo

```
DEPOIS:
┌─────────────────────────────────────────────────────────────────────┐
│  Filesystem                                                          │
│  {documentDirectory}/attachments/                                    │
│  ├── att-123.jpg  (arquivo binário, 2MB)                            │
│  ├── att-456.png  (assinatura, 50KB)                                │
│  └── att-789.jpg  (foto, 3MB)                                       │
└─────────────────────────────────────────────────────────────────────┘
                    │
                    │ localPath referência
                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  SQLite checklist_attachments (leve!)                                │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ id: "att-123"                                                   ││
│  │ localPath: "/docs/attachments/att-123.jpg"                      ││
│  │ fileSize: 2097152                                               ││
│  │ mimeType: "image/jpeg"                                          ││
│  │ base64Data: NULL (removido após migração!)                      ││
│  │ syncStatus: "PENDING"                                           ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘

Benefícios:
- Sem OOM: arquivos lidos sob demanda
- DB leve: apenas metadados (~500 bytes por row)
- Queries rápidas
- Stream possível para upload
```

### Fluxo de Captura (Novo)

```
Usuário captura foto
        │
        ▼
┌───────────────────────┐
│  Base64 do Image      │
│  Picker/Camera        │
└───────────────────────┘
        │
        ▼
┌───────────────────────┐      ┌─────────────────────────────┐
│  AttachmentUploadSvc  │ ───► │  AttachmentStorageService   │
│  uploadBase64()       │      │  saveFromBase64()           │
└───────────────────────┘      └─────────────────────────────┘
        │                                    │
        │                                    ▼
        │                       ┌─────────────────────────────┐
        │                       │  FileSystem.writeAsync()    │
        │                       │  /attachments/att-123.jpg   │
        │                       └─────────────────────────────┘
        │                                    │
        ▼                                    ▼
┌───────────────────────┐      ┌─────────────────────────────┐
│  DB: localPath set    │ ◄─── │  Return: {filePath, size}   │
│  base64Data = NULL    │      │                             │
└───────────────────────┘      └─────────────────────────────┘
```

### Fluxo de Upload (Modificado)

```
Sync Trigger
     │
     ▼
┌─────────────────────────────┐
│  AttachmentUploadService    │
│  uploadPendingAttachments() │
└─────────────────────────────┘
     │
     │  Para cada attachment PENDING:
     ▼
┌─────────────────────────────┐
│  Verificar fonte de dados   │
│                             │
│  1. localPath existe?       │──► Sim: readAsBase64(localPath)
│     │                       │
│     ▼ Não                   │
│  2. base64Data existe?      │──► Sim: usar base64Data (legado)
│     │                       │
│     ▼ Não                   │
│  3. ERRO: sem dados         │
└─────────────────────────────┘
     │
     ▼
┌─────────────────────────────┐
│  POST /attachments          │
│  { base64Data, mimeType }   │
└─────────────────────────────┘
     │
     │  Sucesso?
     ▼
┌─────────────────────────────┐
│  Se usou filesystem:        │
│  - deleteFile(localPath)    │
│  - Update: localPath = NULL │
│  - Update: syncStatus=SYNC  │
└─────────────────────────────┘
```

### Arquivos Modificados/Criados

| Arquivo | Mudança |
|---------|---------|
| `src/config/syncFlags.ts` | Novas flags FS_ATTACHMENTS_* |
| `src/modules/checklists/services/AttachmentStorageService.ts` | Novo serviço |
| `src/modules/checklists/services/AttachmentUploadService.ts` | Modificado para usar filesystem |
| `__tests__/modules/checklists/AttachmentStorageService.test.ts` | Novos testes |

### Feature Flags

```typescript
// src/config/syncFlags.ts
export const SYNC_FLAGS = {
  // Ativar/desativar armazenamento em filesystem
  SYNC_OPT_FS_ATTACHMENTS: true,

  // Nome do diretório de anexos
  FS_ATTACHMENTS_DIR: 'attachments',

  // Migração em chunks para não bloquear UI
  FS_MIGRATION_CHUNK_SIZE: 5,
  FS_MIGRATION_CHUNK_DELAY_MS: 100,

  // Verificar integridade via SHA256 (mais lento)
  FS_ATTACHMENTS_VERIFY_HASH: false,

  // Deletar arquivo após sync bem sucedido
  FS_ATTACHMENTS_DELETE_AFTER_SYNC: true,
};
```

## API do AttachmentStorageService

### Operações Básicas

```typescript
import { AttachmentStorageService } from '@/modules/checklists/services/AttachmentStorageService';

// Inicializar (cria diretório se necessário)
await AttachmentStorageService.initialize();

// Salvar base64 como arquivo
const result = await AttachmentStorageService.saveFromBase64(
  'attachment-123',      // ID do anexo
  'SGVsbG8gV29ybGQ=',   // base64Data
  'image/jpeg'           // mimeType
);
// result = { filePath, sizeBytes, sha256?, mimeType }

// Ler arquivo como base64
const base64 = await AttachmentStorageService.readAsBase64(filePath);

// Verificar se arquivo existe
const exists = await AttachmentStorageService.exists(filePath);

// Deletar arquivo
const deleted = await AttachmentStorageService.deleteFile(filePath);
```

### Migração

```typescript
// Verificar se há migração pendente
const hasPending = await AttachmentStorageService.hasPendingMigration();
const count = await AttachmentStorageService.countPendingMigration();

// Executar migração com callback de progresso
const result = await AttachmentStorageService.migrateBase64ToFilesystem(
  (progress) => {
    console.log(`${progress.processed}/${progress.total}: ${progress.currentId}`);
  }
);
// result = { migrated: 10, failed: 1, errors: [...] }
```

### Limpeza

```typescript
// Limpar arquivos de anexos já sincronizados
const cleanedSync = await AttachmentStorageService.cleanupSyncedAttachments();

// Limpar arquivos órfãos (existem no filesystem mas não no DB)
const cleanedOrphan = await AttachmentStorageService.cleanupOrphanedFiles();

// Estatísticas de uso
const stats = await AttachmentStorageService.getStorageStats();
// stats = { totalFiles, totalSizeBytes, pendingUpload, synced }
```

### Integridade

```typescript
// Calcular hash SHA256
const hash = await AttachmentStorageService.calculateHash(filePath);

// Verificar integridade
const isValid = await AttachmentStorageService.verifyIntegrity(filePath, expectedHash);
```

## Migração de Dados Existentes

### Estratégia

1. Na abertura do app, verificar se há registros com `base64Data` não nulo e `localPath` nulo
2. Processar em chunks de 5 com delay de 100ms entre chunks (não bloqueia UI)
3. Para cada registro:
   - Salvar `base64Data` como arquivo no filesystem
   - Atualizar registro: `localPath = filePath`, `base64Data = NULL`
4. Logar progresso e erros

### Executar Migração

```typescript
// No AppProvider ou SyncEngine
import { AttachmentUploadService } from '@/modules/checklists/services/AttachmentUploadService';

// Verificar e executar migração
if (await AttachmentUploadService.hasPendingMigration()) {
  console.log('Starting attachment migration...');
  const result = await AttachmentUploadService.runMigration((progress) => {
    console.log(`Migration: ${progress.processed}/${progress.total}`);
  });
  console.log(`Migration complete: ${result.migrated} migrated, ${result.failed} failed`);
}
```

### Logs da Migração

```
[AttachmentStorageService] Initialized
[AttachmentStorageService] Starting migration of 50 records
[AttachmentStorageService] Saved att-001: 2097152 bytes
[AttachmentStorageService] Saved att-002: 1548576 bytes
...
[AttachmentStorageService] Migration complete: 48 migrated, 2 failed
```

## Validação Manual

### 1. Verificar Logs

Após fazer upload de anexo, procure nos logs:

```
[AttachmentStorageService] Saved attachment-xxx: 2097152 bytes
[AttachmentUploadService] Using filesystem for upload: att-xxx
[AttachmentStorageService] Deleted: /path/attachments/att-xxx.jpg
```

### 2. Simular 3G

**Android:**
1. Configurações → Rede → Tipo de rede preferida → 3G
2. Capturar foto em checklist
3. Fechar e reabrir app
4. Verificar se anexo persiste e faz upload na próxima sync

**iOS Simulator:**
1. Xcode → Device → Condition → Network Link → 3G
2. Repetir passos acima

### 3. Verificar Armazenamento

```bash
# Via adb (Android)
adb shell
run-as com.auvo.app
ls -la files/attachments/

# Via Xcode (iOS)
# Window → Devices → App → Download Container
# Verificar Documents/attachments/
```

### 4. Verificar Database

```sql
-- Anexos novos devem ter localPath, sem base64Data
SELECT id, localPath, fileSize, base64Data IS NOT NULL as hasBase64
FROM checklist_attachments
ORDER BY createdAt DESC
LIMIT 10;

-- Estatísticas
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN localPath IS NOT NULL THEN 1 ELSE 0 END) as withLocalPath,
  SUM(CASE WHEN base64Data IS NOT NULL THEN 1 ELSE 0 END) as withBase64
FROM checklist_attachments;
```

### 5. Teste de Reinício

1. Capturar anexo offline
2. Force-close o app
3. Reabrir app
4. Verificar que anexo ainda está visível
5. Conectar internet
6. Verificar upload bem sucedido

## Rollback

### Opção 1: Desabilitar via Flag

```typescript
// src/config/syncFlags.ts
SYNC_OPT_FS_ATTACHMENTS: false,  // Volta ao comportamento original
```

Com a flag desabilitada:
- Novos anexos voltam a usar base64Data no SQLite
- Anexos já migrados continuam funcionando (preferência por localPath mantida)
- Nenhuma perda de dados

### Opção 2: Reverter Migração (se necessário)

```typescript
// Script de reversão (executar manualmente)
import { rawQuery, getDatabase } from '@/db/database';
import * as FileSystem from 'expo-file-system';

async function revertMigration() {
  const db = await getDatabase();

  // Buscar anexos com localPath
  const attachments = await rawQuery(
    `SELECT id, localPath FROM checklist_attachments WHERE localPath IS NOT NULL`
  );

  for (const att of attachments) {
    try {
      // Ler arquivo
      const base64 = await FileSystem.readAsStringAsync(att.localPath, {
        encoding: FileSystem.EncodingType.Base64
      });

      // Restaurar base64Data
      await db.runAsync(
        `UPDATE checklist_attachments SET base64Data = ?, localPath = NULL WHERE id = ?`,
        [base64, att.id]
      );

      // Deletar arquivo
      await FileSystem.deleteAsync(att.localPath, { idempotent: true });

      console.log(`Reverted: ${att.id}`);
    } catch (error) {
      console.error(`Failed to revert ${att.id}:`, error);
    }
  }
}
```

### Opção 3: Reverter Commit

```bash
git log --oneline --grep="filesystem attachments"
git revert <commit-hash>
```

## Riscos e Mitigações

### Risk 1: Arquivo deletado antes do upload

**Problema:** Usuário limpa cache/storage antes de sync.

**Mitigação:**
- Arquivos ficam em `documentDirectory` (não é cache)
- iOS/Android não deletam automaticamente
- Cleanup só ocorre após upload bem sucedido

### Risk 2: Falha ao salvar arquivo

**Problema:** Disco cheio ou erro de I/O.

**Mitigação:**
- Fallback para base64Data no SQLite se filesystem falhar
- Log de erro para debugging
- Feature flag permite desabilitar

### Risk 3: Migração incompleta

**Problema:** App fecha durante migração.

**Mitigação:**
- Migração é idempotente (pode ser executada múltiplas vezes)
- Processamento em chunks pequenos
- Progresso salvo por registro individual

### Risk 4: Arquivos órfãos acumulam

**Problema:** Delete do DB mas arquivo permanece.

**Mitigação:**
- `cleanupOrphanedFiles()` remove arquivos sem registro no DB
- Chamado periodicamente no sync
- Seguro: verifica existência no DB antes de deletar

## Métricas Disponíveis

### StorageStats

```typescript
const stats = await AttachmentStorageService.getStorageStats();

{
  totalFiles: 25,          // Arquivos no diretório
  totalSizeBytes: 52428800, // 50 MB
  pendingUpload: 10,       // Com syncStatus PENDING/FAILED
  synced: 15               // Com syncStatus SYNCED
}
```

### MigrationResult

```typescript
{
  migrated: 48,            // Registros migrados com sucesso
  failed: 2,               // Falhas
  errors: [
    { id: 'att-123', error: 'Disk full' },
    { id: 'att-456', error: 'Invalid base64' }
  ]
}
```

## Testes

### Arquivos de Teste

- `__tests__/modules/checklists/AttachmentStorageService.test.ts`

### Cenários Testados

1. Inicialização e criação de diretório
2. Salvar base64 como arquivo (JPEG, PNG)
3. Ler arquivo como base64
4. Deletar arquivo
5. Migração com sucesso
6. Migração com erros parciais
7. Limpeza de anexos sincronizados
8. Limpeza de arquivos órfãos
9. Estatísticas de armazenamento
10. Verificação de integridade (SHA256)

### Executar Testes

```bash
cd apps/mobile
pnpm test -- AttachmentStorageService
```

## Próximos Passos

1. **Monitorar em produção** por 1-2 semanas
2. **Verificar uso de disco** em devices reais
3. **Considerar compressão** de imagens antes de salvar
4. **Implementar streaming upload** para arquivos grandes (evitar carregar 100% na memória)
5. **Adicionar retry** em falhas de I/O do filesystem
