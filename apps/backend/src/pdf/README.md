# PDF Module - Geração de PDFs

## Visão Geral

O módulo PDF é responsável pela geração de documentos PDF para orçamentos e ordens de serviço. Os PDFs gerados são automaticamente salvos como anexos (Attachment) para histórico e compartilhamento.

## Funcionalidades

- Geração de PDF de Orçamento
- Geração de PDF de Ordem de Serviço
- Inclusão de assinatura digital no PDF da OS
- Inclusão de checklists no PDF da OS
- Armazenamento automático como Attachment

## Endpoints da API

### Gerar PDF de Orçamento

```
POST /quotes/:id/generate-pdf
```

**Query Params:**
- `download=true`: Retorna o arquivo diretamente (opcional)

**Resposta (sem download):**
```json
{
  "attachmentId": "uuid-do-attachment",
  "message": "PDF generated successfully"
}
```

**Resposta (com download=true):**
- Content-Type: application/pdf
- Content-Disposition: attachment; filename="orcamento_XXXXX.pdf"

### Gerar PDF de Ordem de Serviço

```
POST /work-orders/:id/generate-pdf
```

**Query Params:**
- `download=true`: Retorna o arquivo diretamente (opcional)

**Resposta (sem download):**
```json
{
  "attachmentId": "uuid-do-attachment",
  "message": "PDF generated successfully"
}
```

## Conteúdo dos PDFs

### PDF de Orçamento

1. **Cabeçalho**
   - Título "ORÇAMENTO"
   - Número do orçamento
   - Data de criação
   - Status

2. **Dados do Prestador**
   - Nome
   - Email

3. **Dados do Cliente**
   - Nome
   - Email
   - Telefone
   - Endereço completo

4. **Tabela de Itens**
   - Nome do item
   - Quantidade
   - Unidade
   - Preço unitário
   - Total

5. **Totais**
   - Subtotal
   - Desconto
   - **Total**

6. **Observações** (se houver)

7. **Rodapé**
   - Data/hora de geração

### PDF de Ordem de Serviço

1. **Cabeçalho**
   - Título "ORDEM DE SERVIÇO"
   - Número da OS
   - Data de criação
   - Status

2. **Dados do Prestador**
   - Nome
   - Email

3. **Dados do Cliente**
   - Nome
   - Email
   - Telefone

4. **Detalhes da OS**
   - Título
   - Descrição
   - Endereço de execução
   - Data agendada
   - Início/Fim da execução (se houver)

5. **Tabela de Itens/Serviços** (se houver)
   - Nome
   - Quantidade
   - Unidade
   - Preço unitário
   - Total

6. **Checklists** (se houver)
   - Título do checklist
   - Lista de itens com respostas

7. **Assinatura** (se houver)
   - Nome do assinante
   - Documento (CPF/CNPJ)
   - Função
   - Data/hora
   - Imagem da assinatura

8. **Observações** (se houver)

9. **Rodapé**
   - Data/hora de geração

## Metadados do Attachment

Quando um PDF é gerado, o Attachment criado tem os seguintes metadados:

```json
{
  "kind": "QUOTE_PDF" | "WORK_ORDER_PDF",
  "version": 1,
  "generatedAt": "2025-01-15T10:00:00.000Z"
}
```

## Exemplos de Uso

### Gerar e Salvar PDF de Orçamento

```bash
curl -X POST /quotes/uuid/generate-pdf \
  -H "Authorization: Bearer TOKEN"
```

### Gerar e Baixar PDF Diretamente

```bash
curl -X POST "/quotes/uuid/generate-pdf?download=true" \
  -H "Authorization: Bearer TOKEN" \
  -o orcamento.pdf
```

### Fluxo Completo: Gerar PDF + Criar Link Público

```bash
# 1. Gerar PDF
RESULT=$(curl -s -X POST /quotes/uuid/generate-pdf \
  -H "Authorization: Bearer TOKEN")

ATTACHMENT_ID=$(echo $RESULT | jq -r '.attachmentId')

# 2. Criar link público
curl -X POST /attachments/$ATTACHMENT_ID/public-link \
  -H "Authorization: Bearer TOKEN" \
  -d '{"expiresInDays": 7}'
```

## Tecnologia

- Biblioteca: **pdfkit**
- Formato: A4
- Margem: 50px

## Testes

```bash
npm test -- --testPathPattern=pdf
```
