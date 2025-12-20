/**
 * ConditionalLogicEvaluator Tests
 *
 * Testes para avaliação de lógica condicional em checklists.
 */

import {
  evaluateQuestionVisibility,
  evaluateAllQuestions,
  getVisibleQuestions,
  areAllRequiredAnswered,
  calculateProgress,
} from '../../../src/modules/checklists/components/ConditionalLogicEvaluator';
import {
  ChecklistQuestion,
  ChecklistAnswer,
  ChecklistQuestionType,
} from '../../../src/db/schema';

// =============================================================================
// MOCK DATA
// =============================================================================

const createQuestion = (
  id: string,
  type: ChecklistQuestionType,
  isRequired: boolean,
  order: number,
  conditionalLogic?: any
): ChecklistQuestion => ({
  id,
  type,
  title: `Question ${id}`,
  isRequired,
  order,
  conditionalLogic,
});

const createAnswer = (
  questionId: string,
  type: ChecklistQuestionType,
  value: unknown
): ChecklistAnswer => ({
  id: `ans_${questionId}`,
  instanceId: 'instance_1',
  questionId,
  type,
  valueText: type === 'TEXT_SHORT' || type === 'TEXT_LONG' ? value as string : undefined,
  valueNumber: type === 'NUMBER' ? value as number : undefined,
  valueBoolean: type === 'CHECKBOX' ? value as boolean : undefined,
  valueJson: type === 'SELECT' || type === 'MULTI_SELECT' ? JSON.stringify(value) : undefined,
  answeredAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

// =============================================================================
// TESTS
// =============================================================================

describe('ConditionalLogicEvaluator', () => {
  describe('evaluateQuestionVisibility', () => {
    it('should return visible and original required when no conditional logic', () => {
      const question = createQuestion('q1', 'TEXT_SHORT', true, 1);
      const context = {
        questions: [question],
        answers: new Map<string, ChecklistAnswer>(),
      };

      const result = evaluateQuestionVisibility(question, context);

      expect(result.visible).toBe(true);
      expect(result.required).toBe(true);
    });

    it('should hide question when HIDE action condition is met', () => {
      const question = createQuestion('q2', 'TEXT_SHORT', true, 2, {
        rules: [{
          questionId: 'q1',
          operator: 'EQUALS',
          value: 'hide',
          action: 'HIDE',
        }],
      });

      const q1Answer = createAnswer('q1', 'TEXT_SHORT', 'hide');
      const context = {
        questions: [question],
        answers: new Map([['q1', q1Answer]]),
      };

      const result = evaluateQuestionVisibility(question, context);

      expect(result.visible).toBe(false);
      expect(result.required).toBe(false);
    });

    it('should show question when SHOW action condition is met', () => {
      const question = createQuestion('q2', 'TEXT_SHORT', false, 2, {
        rules: [{
          questionId: 'q1',
          operator: 'EQUALS',
          value: 'show',
          action: 'SHOW',
        }],
      });

      const q1Answer = createAnswer('q1', 'TEXT_SHORT', 'show');
      const context = {
        questions: [question],
        answers: new Map([['q1', q1Answer]]),
      };

      const result = evaluateQuestionVisibility(question, context);

      expect(result.visible).toBe(true);
    });

    it('should make question required when REQUIRE action condition is met', () => {
      const question = createQuestion('q2', 'TEXT_SHORT', false, 2, {
        rules: [{
          questionId: 'q1',
          operator: 'EQUALS',
          value: 'yes',
          action: 'REQUIRE',
        }],
      });

      const q1Answer = createAnswer('q1', 'TEXT_SHORT', 'yes');
      const context = {
        questions: [question],
        answers: new Map([['q1', q1Answer]]),
      };

      const result = evaluateQuestionVisibility(question, context);

      expect(result.required).toBe(true);
    });
  });

  describe('Operator evaluations', () => {
    const createConditionalQuestion = (operator: string, value: any) =>
      createQuestion('q2', 'TEXT_SHORT', true, 2, {
        rules: [{
          questionId: 'q1',
          operator,
          value,
          action: 'HIDE',
        }],
      });

    it('should evaluate EQUALS correctly', () => {
      const question = createConditionalQuestion('EQUALS', 'test');
      const answer = createAnswer('q1', 'TEXT_SHORT', 'test');
      const context = {
        questions: [question],
        answers: new Map([['q1', answer]]),
      };

      const result = evaluateQuestionVisibility(question, context);
      expect(result.visible).toBe(false);
    });

    it('should evaluate NOT_EQUALS correctly', () => {
      const question = createConditionalQuestion('NOT_EQUALS', 'test');
      const answer = createAnswer('q1', 'TEXT_SHORT', 'different');
      const context = {
        questions: [question],
        answers: new Map([['q1', answer]]),
      };

      const result = evaluateQuestionVisibility(question, context);
      expect(result.visible).toBe(false);
    });

    it('should evaluate GREATER_THAN correctly', () => {
      const q1 = createQuestion('q1', 'NUMBER', false, 1);
      const q2 = createQuestion('q2', 'TEXT_SHORT', true, 2, {
        rules: [{
          questionId: 'q1',
          operator: 'GREATER_THAN',
          value: 5,
          action: 'HIDE',
        }],
      });
      const answer = createAnswer('q1', 'NUMBER', 10);
      const context = {
        questions: [q1, q2],
        answers: new Map([['q1', answer]]),
      };

      const result = evaluateQuestionVisibility(q2, context);
      expect(result.visible).toBe(false);
    });

    it('should evaluate IS_EMPTY correctly', () => {
      const question = createConditionalQuestion('IS_EMPTY', null);
      const context = {
        questions: [question],
        answers: new Map<string, ChecklistAnswer>(),
      };

      const result = evaluateQuestionVisibility(question, context);
      expect(result.visible).toBe(false);
    });

    it('should evaluate CONTAINS correctly', () => {
      const question = createConditionalQuestion('CONTAINS', 'test');
      const answer = createAnswer('q1', 'TEXT_SHORT', 'this is a test string');
      const context = {
        questions: [question],
        answers: new Map([['q1', answer]]),
      };

      const result = evaluateQuestionVisibility(question, context);
      expect(result.visible).toBe(false);
    });

    it('should evaluate IN correctly', () => {
      const question = createQuestion('q2', 'TEXT_SHORT', true, 2, {
        rules: [{
          questionId: 'q1',
          operator: 'IN',
          value: ['a', 'b', 'c'],
          action: 'HIDE',
        }],
      });
      const answer = createAnswer('q1', 'TEXT_SHORT', 'b');
      const context = {
        questions: [question],
        answers: new Map([['q1', answer]]),
      };

      const result = evaluateQuestionVisibility(question, context);
      expect(result.visible).toBe(false);
    });
  });

  describe('AND/OR logic', () => {
    it('should evaluate AND logic correctly', () => {
      const question = createQuestion('q3', 'TEXT_SHORT', true, 3, {
        rules: [
          { questionId: 'q1', operator: 'EQUALS', value: 'yes', action: 'HIDE' },
          { questionId: 'q2', operator: 'EQUALS', value: 'yes', action: 'HIDE' },
        ],
        logic: 'AND',
      });

      const q1Answer = createAnswer('q1', 'TEXT_SHORT', 'yes');
      const q2Answer = createAnswer('q2', 'TEXT_SHORT', 'yes');
      const context = {
        questions: [question],
        answers: new Map([['q1', q1Answer], ['q2', q2Answer]]),
      };

      const result = evaluateQuestionVisibility(question, context);
      expect(result.visible).toBe(false);
    });

    it('should evaluate OR logic correctly', () => {
      const question = createQuestion('q3', 'TEXT_SHORT', true, 3, {
        rules: [
          { questionId: 'q1', operator: 'EQUALS', value: 'yes', action: 'HIDE' },
          { questionId: 'q2', operator: 'EQUALS', value: 'yes', action: 'HIDE' },
        ],
        logic: 'OR',
      });

      const q1Answer = createAnswer('q1', 'TEXT_SHORT', 'yes');
      const q2Answer = createAnswer('q2', 'TEXT_SHORT', 'no');
      const context = {
        questions: [question],
        answers: new Map([['q1', q1Answer], ['q2', q2Answer]]),
      };

      const result = evaluateQuestionVisibility(question, context);
      expect(result.visible).toBe(false);
    });
  });

  describe('getVisibleQuestions', () => {
    it('should filter out hidden questions', () => {
      const q1 = createQuestion('q1', 'TEXT_SHORT', true, 1);
      const q2 = createQuestion('q2', 'TEXT_SHORT', true, 2, {
        rules: [{
          questionId: 'q1',
          operator: 'EQUALS',
          value: 'hide',
          action: 'HIDE',
        }],
      });
      const q3 = createQuestion('q3', 'TEXT_SHORT', true, 3);

      const q1Answer = createAnswer('q1', 'TEXT_SHORT', 'hide');
      const answers = new Map([['q1', q1Answer]]);

      const visibleQuestions = getVisibleQuestions([q1, q2, q3], answers);

      expect(visibleQuestions).toHaveLength(2);
      expect(visibleQuestions.map(q => q.id)).toEqual(['q1', 'q3']);
    });

    it('should sort questions by order', () => {
      const q1 = createQuestion('q1', 'TEXT_SHORT', true, 3);
      const q2 = createQuestion('q2', 'TEXT_SHORT', true, 1);
      const q3 = createQuestion('q3', 'TEXT_SHORT', true, 2);

      const visibleQuestions = getVisibleQuestions([q1, q2, q3], new Map());

      expect(visibleQuestions.map(q => q.id)).toEqual(['q2', 'q3', 'q1']);
    });
  });

  describe('areAllRequiredAnswered', () => {
    it('should return complete when all required visible questions are answered', () => {
      const q1 = createQuestion('q1', 'TEXT_SHORT', true, 1);
      const q2 = createQuestion('q2', 'TEXT_SHORT', false, 2);
      const q3 = createQuestion('q3', 'TEXT_SHORT', true, 3);

      const q1Answer = createAnswer('q1', 'TEXT_SHORT', 'answer1');
      const q3Answer = createAnswer('q3', 'TEXT_SHORT', 'answer3');
      const answers = new Map([['q1', q1Answer], ['q3', q3Answer]]);

      const result = areAllRequiredAnswered([q1, q2, q3], answers);

      expect(result.complete).toBe(true);
      expect(result.missingQuestions).toHaveLength(0);
    });

    it('should return incomplete with missing questions', () => {
      const q1 = createQuestion('q1', 'TEXT_SHORT', true, 1);
      const q2 = createQuestion('q2', 'TEXT_SHORT', true, 2);

      const q1Answer = createAnswer('q1', 'TEXT_SHORT', 'answer1');
      const answers = new Map([['q1', q1Answer]]);

      const result = areAllRequiredAnswered([q1, q2], answers);

      expect(result.complete).toBe(false);
      expect(result.missingQuestions).toHaveLength(1);
      expect(result.missingQuestions[0].id).toBe('q2');
    });

    it('should not require hidden questions', () => {
      const q1 = createQuestion('q1', 'TEXT_SHORT', true, 1);
      const q2 = createQuestion('q2', 'TEXT_SHORT', true, 2, {
        rules: [{
          questionId: 'q1',
          operator: 'EQUALS',
          value: 'hide',
          action: 'HIDE',
        }],
      });

      const q1Answer = createAnswer('q1', 'TEXT_SHORT', 'hide');
      const answers = new Map([['q1', q1Answer]]);

      const result = areAllRequiredAnswered([q1, q2], answers);

      expect(result.complete).toBe(true);
    });
  });

  describe('calculateProgress', () => {
    it('should return 0 for no answers', () => {
      const q1 = createQuestion('q1', 'TEXT_SHORT', true, 1);
      const q2 = createQuestion('q2', 'TEXT_SHORT', true, 2);

      const progress = calculateProgress([q1, q2], new Map());

      expect(progress).toBe(0);
    });

    it('should return 100 for all answers', () => {
      const q1 = createQuestion('q1', 'TEXT_SHORT', true, 1);
      const q2 = createQuestion('q2', 'TEXT_SHORT', true, 2);

      const q1Answer = createAnswer('q1', 'TEXT_SHORT', 'answer1');
      const q2Answer = createAnswer('q2', 'TEXT_SHORT', 'answer2');
      const answers = new Map([['q1', q1Answer], ['q2', q2Answer]]);

      const progress = calculateProgress([q1, q2], answers);

      expect(progress).toBe(100);
    });

    it('should return 50 for half answers', () => {
      const q1 = createQuestion('q1', 'TEXT_SHORT', true, 1);
      const q2 = createQuestion('q2', 'TEXT_SHORT', true, 2);

      const q1Answer = createAnswer('q1', 'TEXT_SHORT', 'answer1');
      const answers = new Map([['q1', q1Answer]]);

      const progress = calculateProgress([q1, q2], answers);

      expect(progress).toBe(50);
    });

    it('should exclude SECTION_TITLE from progress calculation', () => {
      const q1 = createQuestion('q1', 'TEXT_SHORT', true, 1);
      const section = createQuestion('section1', 'SECTION_TITLE', false, 2);
      const q2 = createQuestion('q2', 'TEXT_SHORT', true, 3);

      const q1Answer = createAnswer('q1', 'TEXT_SHORT', 'answer1');
      const answers = new Map([['q1', q1Answer]]);

      const progress = calculateProgress([q1, section, q2], answers);

      expect(progress).toBe(50); // 1 of 2 questions (section not counted)
    });

    it('should return 100 for no questions', () => {
      const progress = calculateProgress([], new Map());
      expect(progress).toBe(100);
    });
  });
});
