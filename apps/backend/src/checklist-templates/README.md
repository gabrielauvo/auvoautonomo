# Checklists System - Advanced Documentation

## Overview

Sistema inteligente de checklists com suporte a **perguntas condicionais** (dynamic forms). Permite criar templates reutilizáveis com perguntas adaptativas baseadas em respostas anteriores, similar a Typeform ou Google Forms com lógica condicional.

## Architecture

```
ChecklistTemplate (Templates reutilizáveis)
  ↓ has many
ChecklistTemplateItem (Perguntas com conditions)
  ↓ referenced by
WorkOrderChecklist (Instância de execução em OS)
  ↓ has many
WorkOrderChecklistAnswer (Respostas validadas)
```

## Entities

### 1. ChecklistTemplate
```typescript
{
  id: string;
  userId: string;
  title: string;
  description?: string;
  items: ChecklistTemplateItem[];
  createdAt: Date;
  updatedAt: Date;
}
```

### 2. ChecklistTemplateItem
```typescript
{
  id: string;
  templateId: string;
  order: number;
  label: string;
  type: ChecklistItemType;  // TEXT | NUMERIC | BOOLEAN | PHOTO | SELECT
  options?: string[];        // Required for SELECT
  isRequired: boolean;
  condition?: ItemCondition; // ⭐ CONDITIONAL LOGIC
  createdAt: Date;
  updatedAt: Date;
}
```

### 3. WorkOrderChecklist
```typescript
{
  id: string;
  workOrderId: string;
  templateId: string;
  title: string;           // Snapshot from template
  answers: WorkOrderChecklistAnswer[];
  createdAt: Date;
  updatedAt: Date;
}
```

### 4. WorkOrderChecklistAnswer
```typescript
{
  id: string;
  workOrderChecklistId: string;
  templateItemId: string;
  type: ChecklistItemType;
  valueText?: string;
  valueNumber?: number;
  valueBoolean?: boolean;
  valuePhoto?: string;
  valueSelect?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

## Question Types

| Type | Description | Value Field | Example |
|------|-------------|-------------|---------|
| TEXT | Free text | valueText | "Filtro substituído" |
| NUMERIC | Number | valueNumber | 220.5 |
| BOOLEAN | Yes/No | valueBoolean | true |
| PHOTO | Photo URL | valuePhoto | "https://..." |
| SELECT | Multiple choice | valueSelect | "Aprovado" |

## Conditional Logic (⭐ Advanced Feature)

### Simple Condition
```json
{
  "dependsOnItemId": "item-uuid-123",
  "operator": "EQUALS",
  "value": true
}
```

**Meaning**: Show this question only if item-uuid-123 was answered with `true`.

### Operators Supported

| Operator | Description | Example |
|----------|-------------|---------|
| EQUALS | Exact match | value === expected |
| NOT_EQUALS | Different | value !== expected |
| GREATER_THAN | Numeric comparison | value > expected |
| LESS_THAN | Numeric comparison | value < expected |
| GREATER_THAN_OR_EQUAL | Numeric comparison | value >= expected |
| LESS_THAN_OR_EQUAL | Numeric comparison | value <= expected |
| IN | Value in array | ['A', 'B'].includes(value) |
| NOT_IN | Value not in array | !['A', 'B'].includes(value) |

### Compound Conditions (AND/OR)

```json
{
  "logic": "AND",
  "conditions": [
    {
      "dependsOnItemId": "Q1",
      "operator": "EQUALS",
      "value": "Sim"
    },
    {
      "dependsOnItemId": "Q2",
      "operator": "GREATER_THAN",
      "value": 220
    }
  ]
}
```

**Meaning**: Show this question only if Q1 = "Sim" AND Q2 > 220.

## API Endpoints

### Templates CRUD

```
POST   /checklist-templates
GET    /checklist-templates
GET    /checklist-templates/:id
PUT    /checklist-templates/:id
DELETE /checklist-templates/:id
```

### Template Items

```
POST   /checklist-templates/:id/items
GET    /checklist-templates/:id/items
PUT    /checklist-templates/:id/items/:itemId
DELETE /checklist-templates/:id/items/:itemId
```

### Checklist Execution (in Work Orders)

```
POST   /work-orders/:osId/checklists
GET    /work-orders/:osId/checklists
GET    /work-orders/:osId/checklists/:id
POST   /work-orders/:osId/checklists/:id/answers
DELETE /work-orders/:osId/checklists/:id
```

## Example: Air Conditioner Maintenance Checklist

### Step 1: Create Template

```http
POST /checklist-templates
{
  "title": "Manutenção Preventiva - Ar-condicionado",
  "description": "Checklist completo para manutenção preventiva"
}
```

### Step 2: Add Questions

**Q1: Is the filter clean?**
```http
POST /checklist-templates/{templateId}/items
{
  "order": 1,
  "label": "O filtro está limpo?",
  "type": "BOOLEAN",
  "isRequired": true
}
```

**Q2: Was filter replaced? (conditional - only if Q1 = false)**
```http
POST /checklist-templates/{templateId}/items
{
  "order": 2,
  "label": "O filtro foi substituído?",
  "type": "BOOLEAN",
  "isRequired": true,
  "condition": {
    "dependsOnItemId": "{q1-id}",
    "operator": "EQUALS",
    "value": false
  }
}
```

**Q3: Voltage measurement**
```http
POST /checklist-templates/{templateId}/items
{
  "order": 3,
  "label": "Qual a voltagem medida?",
  "type": "NUMERIC",
  "isRequired": true
}
```

**Q4: Is voltage normal? (conditional - only if Q3 < 200 or > 240)**
```http
POST /checklist-templates/{templateId}/items
{
  "order": 4,
  "label": "Voltagem anormal detectada. Ação corretiva necessária?",
  "type": "SELECT",
  "options": ["Sim - Ajustar rede", "Sim - Substituir transformador", "Não - Dentro da tolerância"],
  "isRequired": true,
  "condition": {
    "logic": "OR",
    "conditions": [
      {
        "dependsOnItemId": "{q3-id}",
        "operator": "LESS_THAN",
        "value": 200
      },
      {
        "dependsOnItemId": "{q3-id}",
        "operator": "GREATER_THAN",
        "value": 240
      }
    ]
  }
}
```

**Q5: Photo of service**
```http
POST /checklist-templates/{templateId}/items
{
  "order": 5,
  "label": "Foto do equipamento após manutenção",
  "type": "PHOTO",
  "isRequired": false
}
```

### Step 3: Execute in Work Order

```http
POST /work-orders/{woId}/checklists
{
  "templateId": "{template-id}"
}
```

### Step 4: Submit Answers

```http
POST /work-orders/{woId}/checklists/{checklistId}/answers
{
  "answers": [
    {
      "templateItemId": "{q1-id}",
      "type": "BOOLEAN",
      "valueBoolean": false
    },
    {
      "templateItemId": "{q2-id}",
      "type": "BOOLEAN",
      "valueBoolean": true
    },
    {
      "templateItemId": "{q3-id}",
      "type": "NUMERIC",
      "valueNumber": 180
    },
    {
      "templateItemId": "{q4-id}",
      "type": "SELECT",
      "valueSelect": "Sim - Ajustar rede"
    },
    {
      "templateItemId": "{q5-id}",
      "type": "PHOTO",
      "valuePhoto": "https://storage.example.com/photo123.jpg"
    }
  ]
}
```

## Validation Rules

### On Answer Submission

1. ✅ **Type Match**: Answer type must match item type
2. ✅ **Condition Check**: Item must be visible (condition = true)
3. ✅ **Required Fields**: If isRequired + condition met → answer is mandatory
4. ✅ **SELECT Options**: Answer must be in options array
5. ✅ **Value Presence**: Correct value field must be filled

### Condition Evaluation

The backend evaluates conditions using `ConditionEvaluator`:

```typescript
const conditionMet = ConditionEvaluator.evaluate(
  item.condition,
  answersMap
);

if (!conditionMet && answerProvided) {
  throw BadRequestException("Item not visible");
}

if (conditionMet && item.isRequired && !answerProvided) {
  throw BadRequestException("Required item missing");
}
```

## Frontend Implementation Guide

### 1. Fetch Checklist
```typescript
GET /work-orders/{woId}/checklists/{checklistId}
// Returns: template items + conditions + existing answers
```

### 2. Build Answers Map
```typescript
const answersMap = new Map();
checklist.answers.forEach(answer => {
  const value = extractValue(answer);
  answersMap.set(answer.templateItemId, value);
});
```

### 3. Evaluate Visibility
```typescript
checklist.template.items.forEach(item => {
  const isVisible = evaluateCondition(item.condition, answersMap);
  if (isVisible) {
    renderQuestion(item);
  }
});
```

### 4. On Answer Change
```typescript
function onAnswerChange(itemId, value) {
  answersMap.set(itemId, value);

  // Re-evaluate all conditions
  reevaluateVisibility();

  // Optionally auto-save
  submitAnswers([...answersMap.entries()]);
}
```

### 5. Submit Batch
```typescript
POST /work-orders/{woId}/checklists/{checklistId}/answers
{
  "answers": Array.from(answersMap.entries()).map(([itemId, value]) => ({
    templateItemId: itemId,
    type: getItemType(itemId),
    [getValueField(type)]: value
  }))
}
```

## Business Rules

- ✅ Templates belong to user (ownership)
- ✅ Items cannot exist without template (cascade delete)
- ✅ SELECT type MUST have options
- ✅ Other types MUST NOT have options
- ✅ Condition structure validated on creation
- ✅ Answers reference templateItemId (no snapshot of questions)
- ✅ Conditions evaluated on EVERY answer submission
- ✅ Required items validated with condition context
- ✅ Unique constraint: one answer per item per checklist

## Security

- 🔒 All endpoints require JWT authentication
- 🔒 Templates validated against userId
- 🔒 Work orders validated against userId
- 🔒 Cross-user access prevented
- 🔒 Condition validation prevents injection

## Performance Considerations

- Answers are upserted (create or update)
- Conditions evaluated in-memory (no DB queries)
- Template items ordered by `order` field
- Indexes on templateId, workOrderId, checklistId

---

**Last Updated**: 2025-12-09 (Day 8 - Advanced Implementation)
