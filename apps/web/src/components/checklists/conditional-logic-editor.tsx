'use client';

/**
 * Conditional Logic Editor
 *
 * Componente para configurar lógica condicional em perguntas de checklist.
 * Permite definir regras como:
 * - "Mostrar pergunta B se pergunta A = 'Sim'"
 * - "Tornar obrigatória se valor > 10"
 * - "Pular para seção X se opção Y selecionada"
 */

import { useState } from 'react';
import {
  Button,
  Input,
  Select,
  Badge,
  FormField,
} from '@/components/ui';
import {
  Plus,
  Trash2,
  GitBranch,
  ChevronDown,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import {
  ChecklistQuestion,
  ChecklistSection,
  ConditionalLogic,
  ConditionalRule,
  ConditionOperator,
  ConditionAction,
} from '@/services/checklists.service';

// ============================================
// TYPES
// ============================================

interface ConditionalLogicEditorProps {
  question: Partial<ChecklistQuestion>;
  allQuestions: Partial<ChecklistQuestion>[];
  allSections: Partial<ChecklistSection>[];
  onChange: (logic: ConditionalLogic | undefined) => void;
}

// Operator labels
const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  EQUALS: 'é igual a',
  NOT_EQUALS: 'é diferente de',
  GREATER_THAN: 'é maior que',
  LESS_THAN: 'é menor que',
  GREATER_THAN_OR_EQUAL: 'é maior ou igual a',
  LESS_THAN_OR_EQUAL: 'é menor ou igual a',
  CONTAINS: 'contém',
  NOT_CONTAINS: 'não contém',
  IS_EMPTY: 'está vazio',
  IS_NOT_EMPTY: 'não está vazio',
  IN: 'está em',
  NOT_IN: 'não está em',
};

// Action labels
const ACTION_LABELS: Record<ConditionAction, string> = {
  SHOW: 'Mostrar esta pergunta',
  HIDE: 'Ocultar esta pergunta',
  REQUIRE: 'Tornar obrigatória',
  SKIP_TO: 'Pular para',
};

// Get available operators based on question type
function getOperatorsForType(type?: string): ConditionOperator[] {
  switch (type) {
    case 'NUMBER':
    case 'RATING':
    case 'SCALE':
      return [
        'EQUALS',
        'NOT_EQUALS',
        'GREATER_THAN',
        'LESS_THAN',
        'GREATER_THAN_OR_EQUAL',
        'LESS_THAN_OR_EQUAL',
        'IS_EMPTY',
        'IS_NOT_EMPTY',
      ];
    case 'CHECKBOX':
      return ['EQUALS', 'NOT_EQUALS'];
    case 'SELECT':
      return ['EQUALS', 'NOT_EQUALS', 'IS_EMPTY', 'IS_NOT_EMPTY'];
    case 'MULTI_SELECT':
      return ['CONTAINS', 'NOT_CONTAINS', 'IS_EMPTY', 'IS_NOT_EMPTY', 'IN', 'NOT_IN'];
    case 'TEXT_SHORT':
    case 'TEXT_LONG':
      return ['EQUALS', 'NOT_EQUALS', 'CONTAINS', 'NOT_CONTAINS', 'IS_EMPTY', 'IS_NOT_EMPTY'];
    case 'DATE':
    case 'TIME':
    case 'DATETIME':
      return ['EQUALS', 'NOT_EQUALS', 'GREATER_THAN', 'LESS_THAN', 'IS_EMPTY', 'IS_NOT_EMPTY'];
    default:
      return ['EQUALS', 'NOT_EQUALS', 'IS_EMPTY', 'IS_NOT_EMPTY'];
  }
}

// Check if operator requires a value
function operatorRequiresValue(operator: ConditionOperator): boolean {
  return !['IS_EMPTY', 'IS_NOT_EMPTY'].includes(operator);
}

// ============================================
// RULE EDITOR COMPONENT
// ============================================

interface RuleEditorProps {
  rule: ConditionalRule;
  allQuestions: Partial<ChecklistQuestion>[];
  allSections: Partial<ChecklistSection>[];
  currentQuestionId?: string;
  onChange: (rule: ConditionalRule) => void;
  onDelete: () => void;
}

function RuleEditor({
  rule,
  allQuestions,
  allSections,
  currentQuestionId,
  onChange,
  onDelete,
}: RuleEditorProps) {
  const selectedQuestion = allQuestions.find((q) => q.id === rule.questionId);
  const availableOperators = getOperatorsForType(selectedQuestion?.type);
  const showValueInput = operatorRequiresValue(rule.operator);
  const showTargetSelector = rule.action === 'SKIP_TO';

  // Filter out current question and questions that come before it
  const availableSourceQuestions = allQuestions.filter((q) => {
    if (!q.id) return false;
    if (q.id === currentQuestionId) return false;
    // Only show questions that can have conditions applied
    return q.type !== 'SECTION_TITLE';
  });

  // Get options for the selected source question
  const sourceQuestionOptions = selectedQuestion?.options || [];

  return (
    <div className="p-3 bg-gray-50 rounded-lg border space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Source Question */}
        <FormField label="Se a pergunta">
          <Select
            value={rule.questionId || ''}
            onChange={(e) => onChange({ ...rule, questionId: e.target.value, value: undefined })}
          >
            <option value="">Selecione uma pergunta...</option>
            {availableSourceQuestions.map((q) => (
              <option key={q.id} value={q.id}>
                {q.title || 'Pergunta sem título'}
              </option>
            ))}
          </Select>
        </FormField>

        {/* Operator */}
        <FormField label="Condição">
          <Select
            value={rule.operator}
            onChange={(e) => onChange({ ...rule, operator: e.target.value as ConditionOperator })}
            disabled={!rule.questionId}
          >
            {availableOperators.map((op) => (
              <option key={op} value={op}>
                {OPERATOR_LABELS[op]}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      {/* Value */}
      {showValueInput && rule.questionId && (
        <div>
          {sourceQuestionOptions.length > 0 ? (
            <FormField label="Valor">
              <Select
                value={String(rule.value || '')}
                onChange={(e) => onChange({ ...rule, value: e.target.value })}
              >
                <option value="">Selecione um valor...</option>
                {sourceQuestionOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </FormField>
          ) : selectedQuestion?.type === 'CHECKBOX' ? (
            <FormField label="Valor">
              <Select
                value={String(rule.value || '')}
                onChange={(e) => onChange({ ...rule, value: e.target.value === 'true' })}
              >
                <option value="">Selecione...</option>
                <option value="true">Sim</option>
                <option value="false">Não</option>
              </Select>
            </FormField>
          ) : (
            <FormField label="Valor">
              <Input
                type={['NUMBER', 'RATING', 'SCALE'].includes(selectedQuestion?.type || '') ? 'number' : 'text'}
                value={String(rule.value || '')}
                onChange={(e) => {
                  const val = ['NUMBER', 'RATING', 'SCALE'].includes(selectedQuestion?.type || '')
                    ? parseFloat(e.target.value)
                    : e.target.value;
                  onChange({ ...rule, value: val });
                }}
                placeholder="Digite o valor..."
              />
            </FormField>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Action */}
        <FormField label="Então">
          <Select
            value={rule.action}
            onChange={(e) => onChange({ ...rule, action: e.target.value as ConditionAction })}
          >
            {Object.entries(ACTION_LABELS).map(([action, label]) => (
              <option key={action} value={action}>
                {label}
              </option>
            ))}
          </Select>
        </FormField>

        {/* Target (for SKIP_TO action) */}
        {showTargetSelector && (
          <FormField label="Destino">
            <Select
              value={rule.targetQuestionId || rule.targetSectionId || ''}
              onChange={(e) => {
                const value = e.target.value;
                const isSection = allSections.some((s) => s.id === value);
                onChange({
                  ...rule,
                  targetQuestionId: isSection ? undefined : value,
                  targetSectionId: isSection ? value : undefined,
                });
              }}
            >
              <option value="">Selecione o destino...</option>
              <optgroup label="Seções">
                {allSections.map((s) => (
                  <option key={`section-${s.id}`} value={s.id}>
                    📁 {s.title || 'Seção sem título'}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Perguntas">
                {allQuestions
                  .filter((q) => q.id !== currentQuestionId)
                  .map((q) => (
                    <option key={`question-${q.id}`} value={q.id}>
                      ❓ {q.title || 'Pergunta sem título'}
                    </option>
                  ))}
              </optgroup>
            </Select>
          </FormField>
        )}
      </div>

      {/* Delete button */}
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
          leftIcon={<Trash2 className="h-4 w-4" />}
        >
          Remover Regra
        </Button>
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function ConditionalLogicEditor({
  question,
  allQuestions,
  allSections,
  onChange,
}: ConditionalLogicEditorProps) {
  const [expanded, setExpanded] = useState(Boolean(question.conditionalLogic?.rules?.length));
  const logic = question.conditionalLogic || { rules: [], logic: 'AND' };
  const hasRules = logic.rules.length > 0;

  const handleAddRule = () => {
    const newRule: ConditionalRule = {
      questionId: '',
      operator: 'EQUALS',
      value: '',
      action: 'SHOW',
    };
    onChange({
      ...logic,
      rules: [...logic.rules, newRule],
    });
    setExpanded(true);
  };

  const handleUpdateRule = (index: number, rule: ConditionalRule) => {
    const newRules = [...logic.rules];
    newRules[index] = rule;
    onChange({ ...logic, rules: newRules });
  };

  const handleDeleteRule = (index: number) => {
    const newRules = logic.rules.filter((_, i) => i !== index);
    if (newRules.length === 0) {
      onChange(undefined);
    } else {
      onChange({ ...logic, rules: newRules });
    }
  };

  const handleLogicChange = (logicType: 'AND' | 'OR') => {
    onChange({ ...logic, logic: logicType });
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-3 p-3 bg-gradient-to-r from-purple-50 to-indigo-50 cursor-pointer hover:from-purple-100 hover:to-indigo-100 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <GitBranch className="h-5 w-5 text-purple-600" />
        <div className="flex-1">
          <p className="font-medium text-gray-900">Lógica Condicional</p>
          <p className="text-xs text-gray-500">
            {hasRules
              ? `${logic.rules.length} regra${logic.rules.length > 1 ? 's' : ''} configurada${logic.rules.length > 1 ? 's' : ''}`
              : 'Configurar quando esta pergunta aparece'}
          </p>
        </div>
        {hasRules && (
          <Badge variant="soft" size="sm">
            {logic.logic || 'AND'}
          </Badge>
        )}
        {expanded ? (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronRight className="h-5 w-5 text-gray-400" />
        )}
      </div>

      {/* Content */}
      {expanded && (
        <div className="p-4 space-y-4 border-t">
          {/* Info alert */}
          {!hasRules && (
            <div className="flex items-start gap-2 p-3 bg-blue-50 text-blue-700 rounded-lg text-sm">
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Lógica Condicional</p>
                <p className="text-blue-600">
                  Configure quando esta pergunta deve aparecer com base nas respostas anteriores.
                </p>
              </div>
            </div>
          )}

          {/* Logic type selector (if multiple rules) */}
          {logic.rules.length > 1 && (
            <div className="flex items-center gap-2 p-2 bg-gray-100 rounded-lg">
              <span className="text-sm text-gray-600">Aplicar quando:</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => handleLogicChange('AND')}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    logic.logic === 'AND' || !logic.logic
                      ? 'bg-white text-primary font-medium shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Todas as regras (E)
                </button>
                <button
                  type="button"
                  onClick={() => handleLogicChange('OR')}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    logic.logic === 'OR'
                      ? 'bg-white text-primary font-medium shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Qualquer regra (OU)
                </button>
              </div>
            </div>
          )}

          {/* Rules */}
          {logic.rules.length > 0 && (
            <div className="space-y-3">
              {logic.rules.map((rule, index) => (
                <div key={index}>
                  {index > 0 && (
                    <div className="flex items-center justify-center my-2">
                      <Badge variant="soft-gray" size="xs">
                        {logic.logic === 'OR' ? 'OU' : 'E'}
                      </Badge>
                    </div>
                  )}
                  <RuleEditor
                    rule={rule}
                    allQuestions={allQuestions}
                    allSections={allSections}
                    currentQuestionId={question.id}
                    onChange={(r) => handleUpdateRule(index, r)}
                    onDelete={() => handleDeleteRule(index)}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Add rule button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddRule}
            leftIcon={<Plus className="h-4 w-4" />}
            className="w-full"
          >
            Adicionar Regra Condicional
          </Button>
        </div>
      )}
    </div>
  );
}

export default ConditionalLogicEditor;
