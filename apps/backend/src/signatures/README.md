# Signatures Module - Assinatura Digital Simples

## Visão Geral

O módulo Signatures implementa um sistema de assinatura digital simples para aceite de orçamentos e conclusão de ordens de serviço. Captura a imagem da assinatura (desenho na tela), metadados do assinante e informações de contexto (IP, User-Agent, timestamp).

## Estrutura de Dados

### Signature

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | Identificador único |
| userId | UUID | Proprietário (prestador) |
| clientId | UUID | Cliente que assinou |
| workOrderId | UUID? | OS assinada (opcional) |
| quoteId | UUID? | Orçamento assinado (opcional) |
| attachmentId | UUID | Imagem da assinatura |
| signerName | String | Nome do assinante |
| signerDocument | String? | CPF/CNPJ |
| signerRole | String? | Função (Cliente, Responsável, etc.) |
| ipAddress | String? | IP do dispositivo |
| userAgent | String? | Navegador/App |
| signedAt | DateTime | Data/hora da assinatura |
| hash | String? | Hash SHA256 para integridade |

## Endpoints da API

### Assinar Ordem de Serviço

```
POST /work-orders/:workOrderId/signature
```

**Body:**
```json
{
  "imageBase64": "data:image/png;base64,iVBORw0KGgo...",
  "signerName": "João da Silva",
  "signerDocument": "123.456.789-00",
  "signerRole": "Cliente"
}
```

**Resposta:**
```json
{
  "id": "sig-uuid",
  "workOrderId": "wo-uuid",
  "signerName": "João da Silva",
  "signerDocument": "123.456.789-00",
  "signerRole": "Cliente",
  "signedAt": "2025-01-15T10:00:00Z",
  "attachmentId": "att-uuid",
  "hash": "sha256-hash"
}
```

### Assinar Orçamento (Aceite)

```
POST /quotes/:quoteId/signature
```

**Body:**
```json
{
  "imageBase64": "data:image/png;base64,iVBORw0KGgo...",
  "signerName": "Maria Santos",
  "signerDocument": "987.654.321-00"
}
```

**Resposta:**
```json
{
  "id": "sig-uuid",
  "quoteId": "quote-uuid",
  "signerName": "Maria Santos",
  "signerDocument": "987.654.321-00",
  "signerRole": "Cliente",
  "signedAt": "2025-01-15T10:00:00Z",
  "attachmentId": "att-uuid",
  "hash": "sha256-hash",
  "quoteStatus": "APPROVED"
}
```

> **Nota:** Ao assinar um orçamento, o status é automaticamente alterado para `APPROVED`.

### Buscar Assinatura por ID

```
GET /signatures/:id
```

### Buscar Assinatura de OS

```
GET /work-orders/:workOrderId/signature
```

### Buscar Assinatura de Orçamento

```
GET /quotes/:quoteId/signature
```

### Verificar Integridade

```
GET /signatures/:id/verify
```

**Resposta:**
```json
{
  "valid": true,
  "signature": { ... }
}
```

## Fluxo de Assinatura

### Para Ordem de Serviço

1. Técnico conclui o serviço
2. Cliente desenha assinatura na tela (canvas)
3. App converte desenho para base64
4. App envia POST /work-orders/:id/signature
5. Backend:
   - Valida que a OS pertence ao usuário
   - Verifica que não existe assinatura anterior
   - Salva imagem como Attachment tipo SIGNATURE
   - Cria registro Signature com hash
   - Opcionalmente atualiza status da OS

### Para Orçamento

1. Cliente visualiza o orçamento
2. Cliente aceita e desenha assinatura
3. App converte desenho para base64
4. App envia POST /quotes/:id/signature
5. Backend:
   - Valida que o orçamento pertence ao usuário
   - Verifica que não existe assinatura anterior
   - Salva imagem como Attachment tipo SIGNATURE
   - Cria registro Signature com hash
   - Atualiza status do orçamento para APPROVED

## Metadados Capturados

Além dos dados fornecidos pelo usuário, o sistema captura automaticamente:

| Dado | Origem | Descrição |
|------|--------|-----------|
| ipAddress | Request | IP do dispositivo |
| userAgent | Header | Navegador/App |
| signedAt | Server | Timestamp do servidor |
| hash | Server | SHA256 do payload |

## Hash de Integridade

O hash é calculado sobre:

```json
{
  "workOrderId": "...",  // ou quoteId
  "signerName": "...",
  "signerDocument": "...",
  "signedAt": "ISO-timestamp",
  "attachmentId": "..."
}
```

Usando SHA256, permitindo verificar se os dados foram alterados após a assinatura.

## Regras de Negócio

1. **Uma assinatura por documento**: Cada OS ou Orçamento pode ter apenas uma assinatura
2. **Imutabilidade**: Assinaturas não podem ser editadas ou removidas
3. **Rastreabilidade**: IP e User-Agent são registrados
4. **Aprovação automática**: Assinatura de orçamento muda status para APPROVED

## Integração com PDF

Quando um PDF de OS é gerado, se houver assinatura:
- Dados do assinante são incluídos no PDF
- Imagem da assinatura é inserida no documento

## Exemplos de Uso

### Frontend: Capturar Assinatura com Canvas

```javascript
// HTML: <canvas id="signature-pad"></canvas>

const canvas = document.getElementById('signature-pad');
const imageBase64 = canvas.toDataURL('image/png');

// Enviar para o backend
fetch('/api/work-orders/uuid/signature', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer token'
  },
  body: JSON.stringify({
    imageBase64,
    signerName: 'João Silva',
    signerDocument: '123.456.789-00',
    signerRole: 'Cliente'
  })
});
```

### Verificar Assinatura

```bash
curl -X GET /signatures/uuid/verify \
  -H "Authorization: Bearer TOKEN"
```

## Testes

```bash
npm test -- --testPathPattern=signatures
```
