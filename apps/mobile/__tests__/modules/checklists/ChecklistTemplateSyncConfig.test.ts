/**
 * ChecklistTemplateSyncConfig Tests
 *
 * Testes para configuração de sincronização de templates de checklist.
 */

import { ChecklistTemplateSyncConfig } from '../../../src/modules/checklists/ChecklistTemplateSyncConfig';

describe('ChecklistTemplateSyncConfig', () => {
  describe('configuration properties', () => {
    it('should have correct entity name', () => {
      expect(ChecklistTemplateSyncConfig.name).toBe('checklist_templates');
    });

    it('should have correct table name', () => {
      expect(ChecklistTemplateSyncConfig.tableName).toBe('checklist_templates');
    });

    it('should have correct API endpoint', () => {
      expect(ChecklistTemplateSyncConfig.apiEndpoint).toBe('/checklist-templates/sync');
    });

    it('should have correct mutation endpoint', () => {
      expect(ChecklistTemplateSyncConfig.apiMutationEndpoint).toBe('/checklist-templates/sync/mutations');
    });

    it('should use updatedAt as cursor field', () => {
      expect(ChecklistTemplateSyncConfig.cursorField).toBe('updatedAt');
    });

    it('should have correct primary key', () => {
      expect(ChecklistTemplateSyncConfig.primaryKeys).toEqual(['id']);
    });

    it('should use technicianId as scope field', () => {
      expect(ChecklistTemplateSyncConfig.scopeField).toBe('technicianId');
    });

    it('should have batch size of 50', () => {
      expect(ChecklistTemplateSyncConfig.batchSize).toBe(50);
    });

    it('should use server_wins for conflict resolution', () => {
      expect(ChecklistTemplateSyncConfig.conflictResolution).toBe('server_wins');
    });
  });

  describe('transformFromServer', () => {
    it('should transform server template to local format', () => {
      const serverData = {
        id: 'template-1',
        technicianId: 'tech-1',
        name: 'Checklist de Inspeção',
        description: 'Inspeção completa',
        version: 1,
        isActive: true,
        sections: [{ id: 's1', name: 'Seção 1' }],
        questions: [{ id: 'q1', text: 'Pergunta 1' }],
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      };

      const result = ChecklistTemplateSyncConfig.transformFromServer(serverData);

      expect(result.id).toBe('template-1');
      expect(result.technicianId).toBe('tech-1');
      expect(result.name).toBe('Checklist de Inspeção');
      expect(result.description).toBe('Inspeção completa');
      expect(result.version).toBe(1);
      expect(result.isActive).toBe(1); // Converted to integer
    });

    it('should handle isActive true as 1', () => {
      const serverData = {
        id: 'template-1',
        technicianId: 'tech-1',
        name: 'Test',
        version: 1,
        isActive: true,
        sections: [],
        questions: [],
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      };

      const result = ChecklistTemplateSyncConfig.transformFromServer(serverData);

      expect(result.isActive).toBe(1);
    });

    it('should handle isActive false as 0', () => {
      const serverData = {
        id: 'template-1',
        technicianId: 'tech-1',
        name: 'Test',
        version: 1,
        isActive: false,
        sections: [],
        questions: [],
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      };

      const result = ChecklistTemplateSyncConfig.transformFromServer(serverData);

      expect(result.isActive).toBe(0);
    });

    it('should handle isActive as 0 integer as 0', () => {
      const serverData = {
        id: 'template-1',
        technicianId: 'tech-1',
        name: 'Test',
        version: 1,
        isActive: 0 as unknown as boolean,
        sections: [],
        questions: [],
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      };

      const result = ChecklistTemplateSyncConfig.transformFromServer(serverData);

      expect(result.isActive).toBe(0);
    });

    it('should handle missing sections and questions', () => {
      const serverData = {
        id: 'template-1',
        technicianId: 'tech-1',
        name: 'Test',
        version: 1,
        isActive: true,
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      };

      const result = ChecklistTemplateSyncConfig.transformFromServer(serverData);

      expect(result.sections).toEqual([]);
      expect(result.questions).toEqual([]);
    });

    it('should preserve sections and questions arrays', () => {
      const sections = [
        { id: 's1', name: 'Seção 1', order: 1 },
        { id: 's2', name: 'Seção 2', order: 2 },
      ];
      const questions = [
        { id: 'q1', text: 'Pergunta 1', type: 'TEXT_SHORT' },
        { id: 'q2', text: 'Pergunta 2', type: 'NUMBER' },
      ];

      const serverData = {
        id: 'template-1',
        technicianId: 'tech-1',
        name: 'Test',
        version: 1,
        isActive: true,
        sections,
        questions,
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      };

      const result = ChecklistTemplateSyncConfig.transformFromServer(serverData);

      expect(result.sections).toEqual(sections);
      expect(result.questions).toEqual(questions);
    });

    it('should handle missing description', () => {
      const serverData = {
        id: 'template-1',
        technicianId: 'tech-1',
        name: 'Test',
        version: 1,
        isActive: true,
        sections: [],
        questions: [],
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      };

      const result = ChecklistTemplateSyncConfig.transformFromServer(serverData);

      expect(result.description).toBeUndefined();
    });
  });

  describe('transformToServer', () => {
    it('should transform local template to server format', () => {
      const localItem = {
        id: 'template-1',
        technicianId: 'tech-1',
        name: 'Checklist de Inspeção',
        description: 'Inspeção completa',
        version: 2,
        isActive: 1,
        sections: [{ id: 's1', name: 'Seção 1' }],
        questions: [{ id: 'q1', text: 'Pergunta 1' }],
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T11:00:00.000Z',
      };

      const result = ChecklistTemplateSyncConfig.transformToServer(localItem as any) as Record<string, unknown>;

      expect(result.id).toBe('template-1');
      expect(result.technicianId).toBe('tech-1');
      expect(result.name).toBe('Checklist de Inspeção');
      expect(result.version).toBe(2);
      expect(result.isActive).toBe(1);
    });

    it('should include all fields in server payload', () => {
      const localItem = {
        id: 'template-1',
        technicianId: 'tech-1',
        name: 'Test',
        description: 'Description',
        version: 1,
        isActive: 0,
        sections: [],
        questions: [],
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      };

      const result = ChecklistTemplateSyncConfig.transformToServer(localItem as any) as Record<string, unknown>;

      expect(result.description).toBe('Description');
      expect(result.sections).toEqual([]);
      expect(result.questions).toEqual([]);
      expect(result.createdAt).toBe('2024-01-15T10:00:00.000Z');
      expect(result.updatedAt).toBe('2024-01-15T10:00:00.000Z');
    });
  });
});
