/**
 * ChecklistInstanceSyncConfig Tests
 *
 * Testes para configuração de sincronização de instâncias de checklist.
 */

import {
  ChecklistInstanceSyncConfig,
  VALID_INSTANCE_STATUS_TRANSITIONS,
  isValidInstanceStatusTransition,
  getAllowedNextInstanceStatuses,
  canEditInstance,
  isInstanceCompleted,
} from '../../../src/modules/checklists/ChecklistInstanceSyncConfig';
import { ChecklistInstance, ChecklistInstanceStatus } from '../../../src/db/schema';

describe('ChecklistInstanceSyncConfig', () => {
  describe('configuration properties', () => {
    it('should have correct entity name', () => {
      expect(ChecklistInstanceSyncConfig.name).toBe('checklist_instances');
    });

    it('should have correct table name', () => {
      expect(ChecklistInstanceSyncConfig.tableName).toBe('checklist_instances');
    });

    it('should have correct API endpoint', () => {
      expect(ChecklistInstanceSyncConfig.apiEndpoint).toBe('/checklist-instances/sync');
    });

    it('should have correct mutation endpoint', () => {
      expect(ChecklistInstanceSyncConfig.apiMutationEndpoint).toBe('/checklist-instances/sync/mutations');
    });

    it('should use updatedAt as cursor field', () => {
      expect(ChecklistInstanceSyncConfig.cursorField).toBe('updatedAt');
    });

    it('should have correct primary key', () => {
      expect(ChecklistInstanceSyncConfig.primaryKeys).toEqual(['id']);
    });

    it('should use technicianId as scope field', () => {
      expect(ChecklistInstanceSyncConfig.scopeField).toBe('technicianId');
    });

    it('should have batch size of 50', () => {
      expect(ChecklistInstanceSyncConfig.batchSize).toBe(50);
    });

    it('should use last_write_wins for conflict resolution', () => {
      expect(ChecklistInstanceSyncConfig.conflictResolution).toBe('last_write_wins');
    });
  });

  describe('transformFromServer', () => {
    it('should transform server instance to local format', () => {
      const serverData = {
        id: 'instance-1',
        technicianId: 'tech-1',
        workOrderId: 'wo-1',
        templateId: 'template-1',
        templateVersionSnapshot: '{"name": "Checklist", "questions": []}',
        status: 'PENDING',
        progress: 0,
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      };

      const result = ChecklistInstanceSyncConfig.transformFromServer(serverData);

      expect(result.id).toBe('instance-1');
      expect(result.technicianId).toBe('tech-1');
      expect(result.workOrderId).toBe('wo-1');
      expect(result.templateId).toBe('template-1');
      expect(result.status).toBe('PENDING');
      expect(result.progress).toBe(0);
    });

    it('should handle templateVersionSnapshot as object', () => {
      const serverData = {
        id: 'instance-1',
        technicianId: 'tech-1',
        workOrderId: 'wo-1',
        templateId: 'template-1',
        templateVersionSnapshot: { name: 'Checklist', questions: [] },
        status: 'IN_PROGRESS',
        progress: 50,
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      };

      const result = ChecklistInstanceSyncConfig.transformFromServer(serverData);

      expect(result.templateVersionSnapshot).toBe(JSON.stringify({ name: 'Checklist', questions: [] }));
    });

    it('should handle templateVersionSnapshot as string', () => {
      const serverData = {
        id: 'instance-1',
        technicianId: 'tech-1',
        workOrderId: 'wo-1',
        templateId: 'template-1',
        templateVersionSnapshot: '{"name": "Test"}',
        status: 'PENDING',
        progress: 0,
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      };

      const result = ChecklistInstanceSyncConfig.transformFromServer(serverData);

      expect(result.templateVersionSnapshot).toBe('{"name": "Test"}');
    });

    it('should handle completed instance', () => {
      const serverData = {
        id: 'instance-1',
        technicianId: 'tech-1',
        workOrderId: 'wo-1',
        templateId: 'template-1',
        templateVersionSnapshot: '{}',
        status: 'COMPLETED',
        progress: 100,
        startedAt: '2024-01-15T10:00:00.000Z',
        completedAt: '2024-01-15T11:00:00.000Z',
        completedBy: 'user-1',
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T11:00:00.000Z',
      };

      const result = ChecklistInstanceSyncConfig.transformFromServer(serverData);

      expect(result.status).toBe('COMPLETED');
      expect(result.progress).toBe(100);
      expect(result.completedAt).toBe('2024-01-15T11:00:00.000Z');
      expect(result.completedBy).toBe('user-1');
    });

    it('should handle missing progress as 0', () => {
      const serverData = {
        id: 'instance-1',
        technicianId: 'tech-1',
        workOrderId: 'wo-1',
        templateId: 'template-1',
        templateVersionSnapshot: '{}',
        status: 'PENDING',
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      };

      const result = ChecklistInstanceSyncConfig.transformFromServer(serverData);

      expect(result.progress).toBe(0);
    });

    it('should handle cancelled instance', () => {
      const serverData = {
        id: 'instance-1',
        technicianId: 'tech-1',
        workOrderId: 'wo-1',
        templateId: 'template-1',
        templateVersionSnapshot: '{}',
        status: 'CANCELLED',
        progress: 25,
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      };

      const result = ChecklistInstanceSyncConfig.transformFromServer(serverData);

      expect(result.status).toBe('CANCELLED');
    });
  });

  describe('transformToServer', () => {
    it('should transform local instance to server format', () => {
      const localItem: ChecklistInstance = {
        id: 'instance-1',
        technicianId: 'tech-1',
        workOrderId: 'wo-1',
        templateId: 'template-1',
        templateVersionSnapshot: '{"name": "Checklist"}',
        status: 'IN_PROGRESS',
        progress: 50,
        startedAt: '2024-01-15T10:00:00.000Z',
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:30:00.000Z',
      };

      const result = ChecklistInstanceSyncConfig.transformToServer(localItem) as Record<string, unknown>;

      expect(result.id).toBe('instance-1');
      expect(result.workOrderId).toBe('wo-1');
      expect(result.templateId).toBe('template-1');
      expect(result.status).toBe('IN_PROGRESS');
      expect(result.progress).toBe(50);
      expect(result.technicianId).toBe('tech-1');
    });

    it('should include all fields in server payload', () => {
      const localItem: ChecklistInstance = {
        id: 'instance-1',
        technicianId: 'tech-1',
        workOrderId: 'wo-1',
        templateId: 'template-1',
        templateVersionSnapshot: '{}',
        status: 'COMPLETED',
        progress: 100,
        startedAt: '2024-01-15T10:00:00.000Z',
        completedAt: '2024-01-15T11:00:00.000Z',
        completedBy: 'user-1',
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T11:00:00.000Z',
      };

      const result = ChecklistInstanceSyncConfig.transformToServer(localItem) as Record<string, unknown>;

      expect(result.completedAt).toBe('2024-01-15T11:00:00.000Z');
      expect(result.completedBy).toBe('user-1');
      expect(result.createdAt).toBe('2024-01-15T10:00:00.000Z');
      expect(result.updatedAt).toBe('2024-01-15T11:00:00.000Z');
    });
  });
});

describe('VALID_INSTANCE_STATUS_TRANSITIONS', () => {
  it('should define transitions for PENDING', () => {
    expect(VALID_INSTANCE_STATUS_TRANSITIONS.PENDING).toEqual(['IN_PROGRESS', 'CANCELLED']);
  });

  it('should define transitions for IN_PROGRESS', () => {
    expect(VALID_INSTANCE_STATUS_TRANSITIONS.IN_PROGRESS).toEqual(['COMPLETED', 'CANCELLED']);
  });

  it('should define COMPLETED as terminal state', () => {
    expect(VALID_INSTANCE_STATUS_TRANSITIONS.COMPLETED).toEqual([]);
  });

  it('should define CANCELLED as terminal state', () => {
    expect(VALID_INSTANCE_STATUS_TRANSITIONS.CANCELLED).toEqual([]);
  });
});

describe('isValidInstanceStatusTransition', () => {
  describe('from PENDING', () => {
    it('should allow PENDING -> IN_PROGRESS', () => {
      expect(isValidInstanceStatusTransition('PENDING', 'IN_PROGRESS')).toBe(true);
    });

    it('should allow PENDING -> CANCELLED', () => {
      expect(isValidInstanceStatusTransition('PENDING', 'CANCELLED')).toBe(true);
    });

    it('should NOT allow PENDING -> COMPLETED', () => {
      expect(isValidInstanceStatusTransition('PENDING', 'COMPLETED')).toBe(false);
    });

    it('should NOT allow PENDING -> PENDING', () => {
      expect(isValidInstanceStatusTransition('PENDING', 'PENDING')).toBe(false);
    });
  });

  describe('from IN_PROGRESS', () => {
    it('should allow IN_PROGRESS -> COMPLETED', () => {
      expect(isValidInstanceStatusTransition('IN_PROGRESS', 'COMPLETED')).toBe(true);
    });

    it('should allow IN_PROGRESS -> CANCELLED', () => {
      expect(isValidInstanceStatusTransition('IN_PROGRESS', 'CANCELLED')).toBe(true);
    });

    it('should NOT allow IN_PROGRESS -> PENDING', () => {
      expect(isValidInstanceStatusTransition('IN_PROGRESS', 'PENDING')).toBe(false);
    });

    it('should NOT allow IN_PROGRESS -> IN_PROGRESS', () => {
      expect(isValidInstanceStatusTransition('IN_PROGRESS', 'IN_PROGRESS')).toBe(false);
    });
  });

  describe('from COMPLETED (terminal)', () => {
    it('should NOT allow COMPLETED -> any status', () => {
      expect(isValidInstanceStatusTransition('COMPLETED', 'PENDING')).toBe(false);
      expect(isValidInstanceStatusTransition('COMPLETED', 'IN_PROGRESS')).toBe(false);
      expect(isValidInstanceStatusTransition('COMPLETED', 'CANCELLED')).toBe(false);
      expect(isValidInstanceStatusTransition('COMPLETED', 'COMPLETED')).toBe(false);
    });
  });

  describe('from CANCELLED (terminal)', () => {
    it('should NOT allow CANCELLED -> any status', () => {
      expect(isValidInstanceStatusTransition('CANCELLED', 'PENDING')).toBe(false);
      expect(isValidInstanceStatusTransition('CANCELLED', 'IN_PROGRESS')).toBe(false);
      expect(isValidInstanceStatusTransition('CANCELLED', 'COMPLETED')).toBe(false);
      expect(isValidInstanceStatusTransition('CANCELLED', 'CANCELLED')).toBe(false);
    });
  });

  describe('with invalid status', () => {
    it('should handle unknown current status', () => {
      expect(isValidInstanceStatusTransition('UNKNOWN' as ChecklistInstanceStatus, 'PENDING')).toBe(false);
    });
  });
});

describe('getAllowedNextInstanceStatuses', () => {
  it('should return allowed statuses from PENDING', () => {
    expect(getAllowedNextInstanceStatuses('PENDING')).toEqual(['IN_PROGRESS', 'CANCELLED']);
  });

  it('should return allowed statuses from IN_PROGRESS', () => {
    expect(getAllowedNextInstanceStatuses('IN_PROGRESS')).toEqual(['COMPLETED', 'CANCELLED']);
  });

  it('should return empty array for COMPLETED', () => {
    expect(getAllowedNextInstanceStatuses('COMPLETED')).toEqual([]);
  });

  it('should return empty array for CANCELLED', () => {
    expect(getAllowedNextInstanceStatuses('CANCELLED')).toEqual([]);
  });

  it('should handle unknown status', () => {
    expect(getAllowedNextInstanceStatuses('UNKNOWN' as ChecklistInstanceStatus)).toEqual([]);
  });
});

describe('canEditInstance', () => {
  it('should return true for PENDING', () => {
    expect(canEditInstance('PENDING')).toBe(true);
  });

  it('should return true for IN_PROGRESS', () => {
    expect(canEditInstance('IN_PROGRESS')).toBe(true);
  });

  it('should return false for COMPLETED', () => {
    expect(canEditInstance('COMPLETED')).toBe(false);
  });

  it('should return false for CANCELLED', () => {
    expect(canEditInstance('CANCELLED')).toBe(false);
  });
});

describe('isInstanceCompleted', () => {
  it('should return true for COMPLETED', () => {
    expect(isInstanceCompleted('COMPLETED')).toBe(true);
  });

  it('should return false for PENDING', () => {
    expect(isInstanceCompleted('PENDING')).toBe(false);
  });

  it('should return false for IN_PROGRESS', () => {
    expect(isInstanceCompleted('IN_PROGRESS')).toBe(false);
  });

  it('should return false for CANCELLED', () => {
    expect(isInstanceCompleted('CANCELLED')).toBe(false);
  });
});
