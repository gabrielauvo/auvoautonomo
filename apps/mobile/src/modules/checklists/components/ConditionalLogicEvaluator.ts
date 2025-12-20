/**
 * ConditionalLogicEvaluator
 *
 * Avalia lógica condicional de perguntas de checklist.
 * Determina visibilidade e obrigatoriedade baseado em respostas anteriores.
 */

import {
  ChecklistQuestion,
  ChecklistAnswer,
  ConditionalLogic,
  ConditionalRule,
  ConditionOperator,
  ConditionAction,
} from '../../../db/schema';
import { getAnswerValue } from '../ChecklistAnswerSyncConfig';

// =============================================================================
// TYPES
// =============================================================================

export interface QuestionVisibility {
  visible: boolean;
  required: boolean;
  skipTo?: string;
}

export interface EvaluationContext {
  questions: ChecklistQuestion[];
  answers: Map<string, ChecklistAnswer>;
}

// =============================================================================
// OPERATOR EVALUATORS
// =============================================================================

function evaluateOperator(
  operator: ConditionOperator,
  actualValue: unknown,
  expectedValue: unknown,
): boolean {
  // Handle null/undefined
  if (actualValue === null || actualValue === undefined) {
    if (operator === 'IS_EMPTY') return true;
    if (operator === 'IS_NOT_EMPTY') return false;
    return false;
  }

  switch (operator) {
    case 'EQUALS':
      return actualValue === expectedValue;

    case 'NOT_EQUALS':
      return actualValue !== expectedValue;

    case 'GREATER_THAN':
      return typeof actualValue === 'number' &&
        typeof expectedValue === 'number' &&
        actualValue > expectedValue;

    case 'LESS_THAN':
      return typeof actualValue === 'number' &&
        typeof expectedValue === 'number' &&
        actualValue < expectedValue;

    case 'GREATER_THAN_OR_EQUAL':
      return typeof actualValue === 'number' &&
        typeof expectedValue === 'number' &&
        actualValue >= expectedValue;

    case 'LESS_THAN_OR_EQUAL':
      return typeof actualValue === 'number' &&
        typeof expectedValue === 'number' &&
        actualValue <= expectedValue;

    case 'CONTAINS':
      if (typeof actualValue === 'string' && typeof expectedValue === 'string') {
        return actualValue.toLowerCase().includes(expectedValue.toLowerCase());
      }
      if (Array.isArray(actualValue)) {
        return actualValue.includes(expectedValue);
      }
      return false;

    case 'NOT_CONTAINS':
      if (typeof actualValue === 'string' && typeof expectedValue === 'string') {
        return !actualValue.toLowerCase().includes(expectedValue.toLowerCase());
      }
      if (Array.isArray(actualValue)) {
        return !actualValue.includes(expectedValue);
      }
      return true;

    case 'IS_EMPTY':
      if (typeof actualValue === 'string') return actualValue.trim() === '';
      if (Array.isArray(actualValue)) return actualValue.length === 0;
      return false;

    case 'IS_NOT_EMPTY':
      if (typeof actualValue === 'string') return actualValue.trim() !== '';
      if (Array.isArray(actualValue)) return actualValue.length > 0;
      return true;

    case 'IN':
      if (Array.isArray(expectedValue)) {
        return expectedValue.includes(actualValue);
      }
      return false;

    case 'NOT_IN':
      if (Array.isArray(expectedValue)) {
        return !expectedValue.includes(actualValue);
      }
      return true;

    default:
      return false;
  }
}

// =============================================================================
// RULE EVALUATOR
// =============================================================================

function evaluateRule(
  rule: ConditionalRule,
  context: EvaluationContext,
): boolean {
  const answer = context.answers.get(rule.questionId);
  const actualValue = answer ? getAnswerValue(answer) : undefined;
  return evaluateOperator(rule.operator, actualValue, rule.value);
}

function evaluateConditionalLogic(
  logic: ConditionalLogic,
  context: EvaluationContext,
): { matched: boolean; action?: ConditionAction; targetQuestionId?: string; targetSectionId?: string } {
  if (!logic.rules || logic.rules.length === 0) {
    return { matched: false };
  }

  const logicMode = logic.logic || 'AND';
  const results = logic.rules.map(rule => ({
    matched: evaluateRule(rule, context),
    rule,
  }));

  let matched: boolean;
  if (logicMode === 'AND') {
    matched = results.every(r => r.matched);
  } else {
    matched = results.some(r => r.matched);
  }

  if (matched) {
    // Return the first matching rule's action
    const matchedRule = results.find(r => r.matched)?.rule;
    return {
      matched: true,
      action: matchedRule?.action,
      targetQuestionId: matchedRule?.targetQuestionId,
      targetSectionId: matchedRule?.targetSectionId,
    };
  }

  return { matched: false };
}

// =============================================================================
// MAIN EVALUATOR
// =============================================================================

/**
 * Evaluate visibility and required status for a single question
 */
export function evaluateQuestionVisibility(
  question: ChecklistQuestion,
  context: EvaluationContext,
): QuestionVisibility {
  // Default: visible and respect original required
  const result: QuestionVisibility = {
    visible: true,
    required: question.isRequired,
  };

  // No conditional logic? Return defaults
  if (!question.conditionalLogic) {
    return result;
  }

  const evaluation = evaluateConditionalLogic(question.conditionalLogic, context);

  if (!evaluation.matched) {
    // No conditions matched - keep defaults
    return result;
  }

  // Apply action
  switch (evaluation.action) {
    case 'SHOW':
      result.visible = true;
      break;

    case 'HIDE':
      result.visible = false;
      result.required = false; // Hidden questions can't be required
      break;

    case 'REQUIRE':
      result.required = true;
      break;

    case 'SKIP_TO':
      result.skipTo = evaluation.targetQuestionId || evaluation.targetSectionId;
      break;
  }

  return result;
}

/**
 * Evaluate all questions and return visibility map
 */
export function evaluateAllQuestions(
  questions: ChecklistQuestion[],
  answers: Map<string, ChecklistAnswer>,
): Map<string, QuestionVisibility> {
  const context: EvaluationContext = { questions, answers };
  const visibilityMap = new Map<string, QuestionVisibility>();

  for (const question of questions) {
    visibilityMap.set(question.id, evaluateQuestionVisibility(question, context));
  }

  return visibilityMap;
}

/**
 * Get visible questions in order
 */
export function getVisibleQuestions(
  questions: ChecklistQuestion[],
  answers: Map<string, ChecklistAnswer>,
): ChecklistQuestion[] {
  const visibilityMap = evaluateAllQuestions(questions, answers);

  return questions
    .filter(q => visibilityMap.get(q.id)?.visible !== false)
    .sort((a, b) => a.order - b.order);
}

/**
 * Check if all required visible questions are answered
 */
export function areAllRequiredAnswered(
  questions: ChecklistQuestion[],
  answers: Map<string, ChecklistAnswer>,
): { complete: boolean; missingQuestions: ChecklistQuestion[] } {
  const visibilityMap = evaluateAllQuestions(questions, answers);
  const missingQuestions: ChecklistQuestion[] = [];

  for (const question of questions) {
    const visibility = visibilityMap.get(question.id);

    // Skip hidden or non-required
    if (!visibility?.visible || !visibility?.required) {
      continue;
    }

    // Check if answered
    const answer = answers.get(question.id);
    if (!answer) {
      missingQuestions.push(question);
      continue;
    }

    // Check if value is valid (not empty)
    const value = getAnswerValue(answer);
    if (value === null || value === undefined || value === '') {
      missingQuestions.push(question);
    }
  }

  return {
    complete: missingQuestions.length === 0,
    missingQuestions,
  };
}

/**
 * Calculate checklist progress (0-100)
 */
export function calculateProgress(
  questions: ChecklistQuestion[],
  answers: Map<string, ChecklistAnswer>,
): number {
  const visibilityMap = evaluateAllQuestions(questions, answers);

  // Count visible questions (excluding section titles)
  const visibleQuestions = questions.filter(q => {
    if (q.type === 'SECTION_TITLE') return false;
    return visibilityMap.get(q.id)?.visible !== false;
  });

  if (visibleQuestions.length === 0) return 100;

  // Count answered questions
  const answeredCount = visibleQuestions.filter(q => {
    const answer = answers.get(q.id);
    if (!answer) return false;
    const value = getAnswerValue(answer);
    return value !== null && value !== undefined && value !== '';
  }).length;

  return Math.round((answeredCount / visibleQuestions.length) * 100);
}
