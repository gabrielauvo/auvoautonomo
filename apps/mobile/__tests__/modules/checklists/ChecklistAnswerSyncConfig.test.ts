/**
 * ChecklistAnswerSyncConfig Tests
 *
 * Testes para configuração de sincronização de respostas de checklist.
 */

import {
  ChecklistAnswerSyncConfig,
  getAnswerValue,
  setAnswerValue,
  validateAnswer,
} from '../../../src/modules/checklists/ChecklistAnswerSyncConfig';
import { ChecklistAnswer, ChecklistQuestionType } from '../../../src/db/schema';

describe('ChecklistAnswerSyncConfig', () => {
  describe('configuration properties', () => {
    it('should have correct entity name', () => {
      expect(ChecklistAnswerSyncConfig.name).toBe('checklist_answers');
    });

    it('should have correct table name', () => {
      expect(ChecklistAnswerSyncConfig.tableName).toBe('checklist_answers');
    });

    it('should have correct API endpoint', () => {
      expect(ChecklistAnswerSyncConfig.apiEndpoint).toBe('/checklist-instances/answers/sync');
    });

    it('should have correct mutation endpoint', () => {
      expect(ChecklistAnswerSyncConfig.apiMutationEndpoint).toBe('/checklist-instances/sync');
    });

    it('should use updatedAt as cursor field', () => {
      expect(ChecklistAnswerSyncConfig.cursorField).toBe('updatedAt');
    });

    it('should have correct primary key', () => {
      expect(ChecklistAnswerSyncConfig.primaryKeys).toEqual(['id']);
    });

    it('should use instanceId as scope field', () => {
      expect(ChecklistAnswerSyncConfig.scopeField).toBe('instanceId');
    });

    it('should have batch size of 100', () => {
      expect(ChecklistAnswerSyncConfig.batchSize).toBe(100);
    });

    it('should use last_write_wins for conflict resolution', () => {
      expect(ChecklistAnswerSyncConfig.conflictResolution).toBe('last_write_wins');
    });
  });

  describe('transformFromServer', () => {
    it('should transform server answer to local format', () => {
      const serverData = {
        id: 'answer-1',
        instanceId: 'instance-1',
        questionId: 'q-1',
        type: 'TEXT_SHORT',
        valueText: 'Test answer',
        answeredAt: '2024-01-15T10:00:00.000Z',
        answeredBy: 'user-1',
        deviceInfo: 'iPhone 14',
        localId: 'local-1',
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      };

      const result = ChecklistAnswerSyncConfig.transformFromServer(serverData);

      expect(result.id).toBe('answer-1');
      expect(result.instanceId).toBe('instance-1');
      expect(result.questionId).toBe('q-1');
      expect(result.type).toBe('TEXT_SHORT');
      expect(result.valueText).toBe('Test answer');
      expect(result.syncStatus).toBe('SYNCED');
    });

    it('should handle valueJson as object', () => {
      const serverData = {
        id: 'answer-1',
        instanceId: 'instance-1',
        questionId: 'q-1',
        type: 'MULTI_SELECT',
        valueJson: { selected: ['a', 'b'] },
        answeredAt: '2024-01-15T10:00:00.000Z',
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      };

      const result = ChecklistAnswerSyncConfig.transformFromServer(serverData);

      expect(result.valueJson).toBe(JSON.stringify({ selected: ['a', 'b'] }));
    });

    it('should handle valueJson as string', () => {
      const serverData = {
        id: 'answer-1',
        instanceId: 'instance-1',
        questionId: 'q-1',
        type: 'MULTI_SELECT',
        valueJson: '["option1", "option2"]',
        answeredAt: '2024-01-15T10:00:00.000Z',
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      };

      const result = ChecklistAnswerSyncConfig.transformFromServer(serverData);

      expect(result.valueJson).toBe('["option1", "option2"]');
    });

    it('should handle numeric answer', () => {
      const serverData = {
        id: 'answer-1',
        instanceId: 'instance-1',
        questionId: 'q-1',
        type: 'NUMBER',
        valueNumber: 42,
        answeredAt: '2024-01-15T10:00:00.000Z',
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      };

      const result = ChecklistAnswerSyncConfig.transformFromServer(serverData);

      expect(result.valueNumber).toBe(42);
    });

    it('should handle boolean answer', () => {
      const serverData = {
        id: 'answer-1',
        instanceId: 'instance-1',
        questionId: 'q-1',
        type: 'CHECKBOX',
        valueBoolean: true,
        answeredAt: '2024-01-15T10:00:00.000Z',
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      };

      const result = ChecklistAnswerSyncConfig.transformFromServer(serverData);

      expect(result.valueBoolean).toBe(true);
    });

    it('should handle date answer', () => {
      const serverData = {
        id: 'answer-1',
        instanceId: 'instance-1',
        questionId: 'q-1',
        type: 'DATE',
        valueDate: '2024-01-15',
        answeredAt: '2024-01-15T10:00:00.000Z',
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      };

      const result = ChecklistAnswerSyncConfig.transformFromServer(serverData);

      expect(result.valueDate).toBe('2024-01-15');
    });
  });

  describe('transformToServer', () => {
    it('should transform local answer to server format', () => {
      const localItem: ChecklistAnswer = {
        id: 'answer-1',
        instanceId: 'instance-1',
        questionId: 'q-1',
        type: 'TEXT_SHORT',
        valueText: 'Test answer',
        answeredAt: '2024-01-15T10:00:00.000Z',
        answeredBy: 'user-1',
        deviceInfo: 'iPhone 14',
        localId: 'local-1',
        syncStatus: 'PENDING',
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      };

      const result = ChecklistAnswerSyncConfig.transformToServer(localItem) as Record<string, unknown>;

      expect(result.localId).toBe('local-1');
      expect(result.questionId).toBe('q-1');
      expect(result.valueText).toBe('Test answer');
      expect(result.answeredBy).toBe('user-1');
    });

    it('should use id as localId if localId is missing', () => {
      const localItem: ChecklistAnswer = {
        id: 'answer-1',
        instanceId: 'instance-1',
        questionId: 'q-1',
        type: 'TEXT_SHORT',
        valueText: 'Test',
        answeredAt: '2024-01-15T10:00:00.000Z',
        syncStatus: 'PENDING',
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      };

      const result = ChecklistAnswerSyncConfig.transformToServer(localItem) as Record<string, unknown>;

      expect(result.localId).toBe('answer-1');
    });

    it('should parse valueJson string to object', () => {
      const localItem: ChecklistAnswer = {
        id: 'answer-1',
        instanceId: 'instance-1',
        questionId: 'q-1',
        type: 'MULTI_SELECT',
        valueJson: '["a", "b", "c"]',
        answeredAt: '2024-01-15T10:00:00.000Z',
        syncStatus: 'PENDING',
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      };

      const result = ChecklistAnswerSyncConfig.transformToServer(localItem) as Record<string, unknown>;

      expect(result.valueJson).toEqual(['a', 'b', 'c']);
    });

    it('should handle invalid JSON in valueJson', () => {
      const localItem: ChecklistAnswer = {
        id: 'answer-1',
        instanceId: 'instance-1',
        questionId: 'q-1',
        type: 'TEXT_SHORT',
        valueJson: 'not valid json',
        answeredAt: '2024-01-15T10:00:00.000Z',
        syncStatus: 'PENDING',
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      };

      const result = ChecklistAnswerSyncConfig.transformToServer(localItem) as Record<string, unknown>;

      expect(result.valueJson).toBe('not valid json');
    });
  });
});

describe('getAnswerValue', () => {
  const baseAnswer: Partial<ChecklistAnswer> = {
    id: 'answer-1',
    instanceId: 'instance-1',
    questionId: 'q-1',
    answeredAt: '2024-01-15T10:00:00.000Z',
    syncStatus: 'SYNCED',
    createdAt: '2024-01-15T10:00:00.000Z',
    updatedAt: '2024-01-15T10:00:00.000Z',
  };

  it('should get TEXT_SHORT value', () => {
    const answer = { ...baseAnswer, type: 'TEXT_SHORT' as const, valueText: 'Hello' };
    expect(getAnswerValue(answer as ChecklistAnswer)).toBe('Hello');
  });

  it('should get TEXT_LONG value', () => {
    const answer = { ...baseAnswer, type: 'TEXT_LONG' as const, valueText: 'Long text' };
    expect(getAnswerValue(answer as ChecklistAnswer)).toBe('Long text');
  });

  it('should get NUMBER value', () => {
    const answer = { ...baseAnswer, type: 'NUMBER' as const, valueNumber: 42 };
    expect(getAnswerValue(answer as ChecklistAnswer)).toBe(42);
  });

  it('should get RATING value', () => {
    const answer = { ...baseAnswer, type: 'RATING' as const, valueNumber: 5 };
    expect(getAnswerValue(answer as ChecklistAnswer)).toBe(5);
  });

  it('should get SCALE value', () => {
    const answer = { ...baseAnswer, type: 'SCALE' as const, valueNumber: 7 };
    expect(getAnswerValue(answer as ChecklistAnswer)).toBe(7);
  });

  it('should get CHECKBOX value', () => {
    const answer = { ...baseAnswer, type: 'CHECKBOX' as const, valueBoolean: true };
    expect(getAnswerValue(answer as ChecklistAnswer)).toBe(true);
  });

  it('should get DATE value', () => {
    const answer = { ...baseAnswer, type: 'DATE' as const, valueDate: '2024-01-15' };
    expect(getAnswerValue(answer as ChecklistAnswer)).toBe('2024-01-15');
  });

  it('should get TIME value', () => {
    const answer = { ...baseAnswer, type: 'TIME' as const, valueDate: '10:30:00' };
    expect(getAnswerValue(answer as ChecklistAnswer)).toBe('10:30:00');
  });

  it('should get DATETIME value', () => {
    const answer = { ...baseAnswer, type: 'DATETIME' as const, valueDate: '2024-01-15T10:30:00' };
    expect(getAnswerValue(answer as ChecklistAnswer)).toBe('2024-01-15T10:30:00');
  });

  it('should get SELECT value as parsed JSON', () => {
    const answer = { ...baseAnswer, type: 'SELECT' as const, valueJson: '"option1"' };
    expect(getAnswerValue(answer as ChecklistAnswer)).toBe('option1');
  });

  it('should get MULTI_SELECT value as parsed JSON array', () => {
    const answer = { ...baseAnswer, type: 'MULTI_SELECT' as const, valueJson: '["a", "b"]' };
    expect(getAnswerValue(answer as ChecklistAnswer)).toEqual(['a', 'b']);
  });

  it('should get PHOTO_REQUIRED value as parsed JSON', () => {
    const answer = { ...baseAnswer, type: 'PHOTO_REQUIRED' as const, valueJson: '{"attachmentId": "att-1"}' };
    expect(getAnswerValue(answer as ChecklistAnswer)).toEqual({ attachmentId: 'att-1' });
  });

  it('should return null for SECTION_TITLE', () => {
    const answer = { ...baseAnswer, type: 'SECTION_TITLE' as const };
    expect(getAnswerValue(answer as ChecklistAnswer)).toBeNull();
  });

  it('should return null for SELECT without valueJson', () => {
    const answer = { ...baseAnswer, type: 'SELECT' as const, valueJson: undefined };
    expect(getAnswerValue(answer as ChecklistAnswer)).toBeNull();
  });

  it('should fallback to any value for unknown type', () => {
    const answer = { ...baseAnswer, type: 'UNKNOWN' as ChecklistQuestionType, valueText: 'fallback' };
    expect(getAnswerValue(answer as ChecklistAnswer)).toBe('fallback');
  });
});

describe('setAnswerValue', () => {
  it('should set TEXT_SHORT value', () => {
    const result = setAnswerValue('TEXT_SHORT', 'Hello');
    expect(result.valueText).toBe('Hello');
    expect(result.type).toBe('TEXT_SHORT');
    expect(result.answeredAt).toBeDefined();
  });

  it('should set TEXT_LONG value', () => {
    const result = setAnswerValue('TEXT_LONG', 'Long text here');
    expect(result.valueText).toBe('Long text here');
  });

  it('should set NUMBER value', () => {
    const result = setAnswerValue('NUMBER', 42);
    expect(result.valueNumber).toBe(42);
  });

  it('should set RATING value', () => {
    const result = setAnswerValue('RATING', 5);
    expect(result.valueNumber).toBe(5);
  });

  it('should set SCALE value', () => {
    const result = setAnswerValue('SCALE', 7);
    expect(result.valueNumber).toBe(7);
  });

  it('should set CHECKBOX value', () => {
    const result = setAnswerValue('CHECKBOX', true);
    expect(result.valueBoolean).toBe(true);
  });

  it('should set DATE value', () => {
    const result = setAnswerValue('DATE', '2024-01-15');
    expect(result.valueDate).toBe('2024-01-15');
  });

  it('should set TIME value', () => {
    const result = setAnswerValue('TIME', '10:30:00');
    expect(result.valueDate).toBe('10:30:00');
  });

  it('should set DATETIME value', () => {
    const result = setAnswerValue('DATETIME', '2024-01-15T10:30:00');
    expect(result.valueDate).toBe('2024-01-15T10:30:00');
  });

  it('should set SELECT value as JSON', () => {
    const result = setAnswerValue('SELECT', 'option1');
    expect(result.valueJson).toBe('"option1"');
  });

  it('should set MULTI_SELECT value as JSON array', () => {
    const result = setAnswerValue('MULTI_SELECT', ['a', 'b', 'c']);
    expect(result.valueJson).toBe('["a","b","c"]');
  });

  it('should set PHOTO_REQUIRED value as JSON', () => {
    const result = setAnswerValue('PHOTO_REQUIRED', { attachmentId: 'att-1' });
    expect(result.valueJson).toBe('{"attachmentId":"att-1"}');
  });

  it('should set PHOTO_OPTIONAL value as JSON', () => {
    const result = setAnswerValue('PHOTO_OPTIONAL', { attachmentId: 'att-1' });
    expect(result.valueJson).toBe('{"attachmentId":"att-1"}');
  });

  it('should set FILE_UPLOAD value as JSON', () => {
    const result = setAnswerValue('FILE_UPLOAD', { fileId: 'file-1' });
    expect(result.valueJson).toBe('{"fileId":"file-1"}');
  });

  it('should set SIGNATURE_TECHNICIAN value as JSON', () => {
    const result = setAnswerValue('SIGNATURE_TECHNICIAN', { signatureUrl: 'url' });
    expect(result.valueJson).toBe('{"signatureUrl":"url"}');
  });

  it('should set SIGNATURE_CLIENT value as JSON', () => {
    const result = setAnswerValue('SIGNATURE_CLIENT', { signatureUrl: 'url' });
    expect(result.valueJson).toBe('{"signatureUrl":"url"}');
  });

  it('should not set any value for SECTION_TITLE', () => {
    const result = setAnswerValue('SECTION_TITLE', null);
    expect(result.valueText).toBeUndefined();
    expect(result.valueNumber).toBeUndefined();
    expect(result.valueBoolean).toBeUndefined();
    expect(result.valueDate).toBeUndefined();
    expect(result.valueJson).toBeUndefined();
  });

  it('should reset all value fields to undefined', () => {
    const result = setAnswerValue('TEXT_SHORT', 'test');
    expect(result.valueNumber).toBeUndefined();
    expect(result.valueBoolean).toBeUndefined();
    expect(result.valueDate).toBeUndefined();
    expect(result.valueJson).toBeUndefined();
  });
});

describe('validateAnswer', () => {
  describe('required field validation', () => {
    it('should fail for required empty string', () => {
      const result = validateAnswer('TEXT_SHORT', '', true);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Campo obrigatório');
    });

    it('should fail for required null', () => {
      const result = validateAnswer('TEXT_SHORT', null, true);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Campo obrigatório');
    });

    it('should fail for required undefined', () => {
      const result = validateAnswer('TEXT_SHORT', undefined, true);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Campo obrigatório');
    });

    it('should pass for non-required empty', () => {
      const result = validateAnswer('TEXT_SHORT', '', false);
      expect(result.valid).toBe(true);
    });

    it('should pass for non-required null', () => {
      const result = validateAnswer('TEXT_SHORT', null, false);
      expect(result.valid).toBe(true);
    });

    it('should pass for non-required undefined', () => {
      const result = validateAnswer('TEXT_SHORT', undefined, false);
      expect(result.valid).toBe(true);
    });
  });

  describe('NUMBER validation', () => {
    it('should pass for valid number', () => {
      const result = validateAnswer('NUMBER', 42, true);
      expect(result.valid).toBe(true);
    });

    it('should pass for zero', () => {
      const result = validateAnswer('NUMBER', 0, true);
      expect(result.valid).toBe(true);
    });

    it('should pass for negative number', () => {
      const result = validateAnswer('NUMBER', -5, true);
      expect(result.valid).toBe(true);
    });

    it('should fail for NaN', () => {
      const result = validateAnswer('NUMBER', NaN, true);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Valor numérico inválido');
    });

    it('should fail for non-number', () => {
      const result = validateAnswer('NUMBER', 'not a number', true);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Valor numérico inválido');
    });
  });

  describe('RATING validation', () => {
    it('should pass for valid rating', () => {
      const result = validateAnswer('RATING', 5, true);
      expect(result.valid).toBe(true);
    });

    it('should fail for non-number rating', () => {
      const result = validateAnswer('RATING', 'five', true);
      expect(result.valid).toBe(false);
    });
  });

  describe('SCALE validation', () => {
    it('should pass for valid scale value', () => {
      const result = validateAnswer('SCALE', 7, true);
      expect(result.valid).toBe(true);
    });

    it('should fail for non-number scale', () => {
      const result = validateAnswer('SCALE', '7', true);
      expect(result.valid).toBe(false);
    });
  });

  describe('CHECKBOX validation', () => {
    it('should pass for true', () => {
      const result = validateAnswer('CHECKBOX', true, true);
      expect(result.valid).toBe(true);
    });

    it('should pass for false', () => {
      const result = validateAnswer('CHECKBOX', false, true);
      expect(result.valid).toBe(true);
    });

    it('should fail for non-boolean', () => {
      const result = validateAnswer('CHECKBOX', 'yes', true);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Valor booleano inválido');
    });

    it('should fail for number', () => {
      const result = validateAnswer('CHECKBOX', 1, true);
      expect(result.valid).toBe(false);
    });
  });

  describe('DATE validation', () => {
    it('should pass for valid date string', () => {
      const result = validateAnswer('DATE', '2024-01-15', true);
      expect(result.valid).toBe(true);
    });

    it('should pass for ISO date string', () => {
      const result = validateAnswer('DATE', '2024-01-15T10:30:00.000Z', true);
      expect(result.valid).toBe(true);
    });

    it('should fail for invalid date string', () => {
      const result = validateAnswer('DATE', 'not-a-date', true);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Data/hora inválida');
    });

    it('should fail for non-string date', () => {
      const result = validateAnswer('DATE', new Date(), true);
      expect(result.valid).toBe(false);
    });
  });

  describe('TIME validation', () => {
    it('should pass for valid time string', () => {
      const result = validateAnswer('TIME', '2024-01-15T10:30:00', true);
      expect(result.valid).toBe(true);
    });

    it('should fail for invalid time', () => {
      const result = validateAnswer('TIME', 'invalid', true);
      expect(result.valid).toBe(false);
    });
  });

  describe('DATETIME validation', () => {
    it('should pass for valid datetime string', () => {
      const result = validateAnswer('DATETIME', '2024-01-15T10:30:00', true);
      expect(result.valid).toBe(true);
    });

    it('should fail for invalid datetime', () => {
      const result = validateAnswer('DATETIME', 'invalid', true);
      expect(result.valid).toBe(false);
    });
  });

  describe('SELECT validation', () => {
    it('should pass for valid string selection', () => {
      const result = validateAnswer('SELECT', 'option1', true);
      expect(result.valid).toBe(true);
    });

    it('should fail for non-string selection', () => {
      const result = validateAnswer('SELECT', 123, true);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Seleção inválida');
    });

    it('should fail for array selection', () => {
      const result = validateAnswer('SELECT', ['a', 'b'], true);
      expect(result.valid).toBe(false);
    });
  });

  describe('MULTI_SELECT validation', () => {
    it('should pass for valid array selection', () => {
      const result = validateAnswer('MULTI_SELECT', ['a', 'b', 'c'], true);
      expect(result.valid).toBe(true);
    });

    it('should pass for empty array (if not required)', () => {
      const result = validateAnswer('MULTI_SELECT', [], false);
      expect(result.valid).toBe(true);
    });

    it('should fail for non-array', () => {
      const result = validateAnswer('MULTI_SELECT', 'single', true);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Seleção múltipla inválida');
    });
  });

  describe('text types validation', () => {
    it('should pass TEXT_SHORT with any string', () => {
      const result = validateAnswer('TEXT_SHORT', 'any text', true);
      expect(result.valid).toBe(true);
    });

    it('should pass TEXT_LONG with any string', () => {
      const result = validateAnswer('TEXT_LONG', 'any long text', true);
      expect(result.valid).toBe(true);
    });
  });
});
