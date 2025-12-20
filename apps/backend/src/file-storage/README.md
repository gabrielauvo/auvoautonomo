# File Storage Module - Upload de Arquivos e Anexos

## Visão Geral

O módulo FileStorage implementa um sistema completo de upload, armazenamento e gerenciamento de arquivos para a aplicação. Suporta fotos, documentos e assinaturas digitais.

## Estrutura de Dados

### Attachment

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | Identificador único |
| userId | UUID | Proprietário do arquivo |
| clientId | UUID? | Cliente associado (opcional) |
| quoteId | UUID? | Orçamento associado (opcional) |
| workOrderId | UUID? | OS associada (opcional) |
| type | AttachmentType | PHOTO, DOCUMENT, SIGNATURE |
| mimeType | String | Tipo MIME do arquivo |
| fileNameOriginal | String | Nome original do arquivo |
| fileSize | Int | Tamanho em bytes |
| storagePath | String | Caminho interno no storage |
| publicUrl | String? | URL pública (se gerada) |
| metadata | Json? | Metadados extras |
| createdAt | DateTime | Data de criação |
| createdByUserId | UUID | Quem fez o upload |

### PublicLink

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | Identificador único |
| attachmentId | UUID | Arquivo vinculado |
| token | String | Token único para acesso |
| expiresAt | DateTime? | Data de expiração |
| accessCount | Int | Contador de acessos |
| lastAccessAt | DateTime? | Último acesso |

## Endpoints da API

### Upload de Arquivo

```
POST /attachments
Content-Type: multipart/form-data
```

**Form Data:**
- `file`: Arquivo (obrigatório)
- `type`: PHOTO | DOCUMENT | SIGNATURE
- `clientId`: UUID (opcional)
- `quoteId`: UUID (opcional)
- `workOrderId`: UUID (opcional)
- `description`: String (opcional)
- `category`: String (opcional)

**Resposta:**
```json
{
  "id": "uuid",
  "type": "PHOTO",
  "mimeType": "image/png",
  "fileNameOriginal": "foto.png",
  "fileSize": 102400,
  "metadata": { "description": "Foto do equipamento" },
  "createdAt": "2025-01-15T10:00:00Z"
}
```

### Buscar Arquivo

```
GET /attachments/:id
```

### Listar por Orçamento

```
GET /attachments/by-quote/:quoteId
```

### Listar por OS

```
GET /attachments/by-work-order/:workOrderId
```

### Listar por Cliente

```
GET /attachments/by-client/:clientId
```

### Download (Autenticado)

```
GET /attachments/:id/download
```

### Deletar Arquivo

```
DELETE /attachments/:id
```

### Criar Link Público

```
POST /attachments/:id/public-link
```

**Body:**
```json
{
  "expiresInDays": 7
}
```

**Resposta:**
```json
{
  "id": "link-uuid",
  "token": "random-token-64-chars",
  "url": "https://app.com/api/public/files/random-token",
  "expiresAt": "2025-01-22T10:00:00Z"
}
```

### Revogar Link Público

```
DELETE /attachments/public-links/:linkId
```

### Acesso Público (Sem Autenticação)

```
GET /public/files/:token
```

## Validações

### Tipos Permitidos

**Imagens (PHOTO/SIGNATURE):**
- image/jpeg
- image/png
- image/gif
- image/webp

**Documentos (DOCUMENT):**
- application/pdf
- application/msword
- application/vnd.openxmlformats-officedocument.wordprocessingml.document
- application/vnd.ms-excel
- application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
- text/plain
- Todos os tipos de imagem

### Tamanho Máximo

- 10MB por arquivo

## Storage Provider

O módulo utiliza uma abstração de storage que permite trocar o backend de armazenamento:

### LocalStorageProvider (Padrão)

- Armazena arquivos no sistema de arquivos local
- Caminho: `./storage/{userId}/{year}/{month}/{filename}`
- Configurável via `STORAGE_PATH` env var

### Interface StorageProvider

```typescript
interface StorageProvider {
  upload(params: UploadParams): Promise<UploadResult>;
  getSignedUrl?(storagePath: string, expiresIn?: number): Promise<string>;
  delete?(storagePath: string): Promise<void>;
  getBuffer(storagePath: string): Promise<Buffer>;
  exists(storagePath: string): Promise<boolean>;
}
```

Para usar S3/GCS no futuro, implemente esta interface.

## Exemplos de Uso

### Upload de Foto

```bash
curl -X POST /attachments \
  -H "Authorization: Bearer TOKEN" \
  -F "file=@foto.jpg" \
  -F "type=PHOTO" \
  -F "workOrderId=uuid-os" \
  -F "description=Foto antes do serviço" \
  -F "category=before_service"
```

### Gerar Link Público

```bash
curl -X POST /attachments/uuid/public-link \
  -H "Authorization: Bearer TOKEN" \
  -d '{"expiresInDays": 30}'
```

### Acessar Link Público

```bash
curl https://app.com/api/public/files/token-aqui
```

## Integração com Outros Módulos

- **Quotes**: Anexos podem ser vinculados a orçamentos
- **WorkOrders**: Anexos podem ser vinculados a OS
- **Signatures**: Imagens de assinatura são armazenadas como attachments
- **PDF**: PDFs gerados são salvos como attachments tipo DOCUMENT

## Testes

```bash
npm test -- --testPathPattern=file-storage
```
