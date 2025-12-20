/**
 * Testes para os hooks de Checklists
 *
 * Cobre:
 * - useChecklistTemplates
 * - useChecklistTemplate
 * - useCreateChecklistTemplate
 * - useUpdateChecklistTemplate
 * - useDeleteChecklistTemplate
 * - useDuplicateChecklistTemplate
 * - useChecklistInstances
 * - useChecklistInstance
 * - useCreateChecklistInstance
 * - useDeleteChecklistInstance
 * - useSubmitChecklistAnswer
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useChecklistTemplates,
  useChecklistTemplate,
  useCreateChecklistTemplate,
  useUpdateChecklistTemplate,
  useDeleteChecklistTemplate,
  useDuplicateChecklistTemplate,
  useChecklistInstances,
  useChecklistInstance,
  useCreateChecklistInstance,
  useDeleteChecklistInstance,
  useSubmitChecklistAnswer,
  useSubmitChecklistAnswersBatch,
  checklistKeys,
} from '../use-checklists';
import { checklistsService, ChecklistTemplate, ChecklistInstance } from '@/services/checklists.service';

// Mock the checklists service
jest.mock('@/services/checklists.service', () => ({
  checklistsService: {
    listTemplates: jest.fn(),
    getTemplateById: jest.fn(),
    createTemplate: jest.fn(),
    updateTemplate: jest.fn(),
    deleteTemplate: jest.fn(),
    duplicateTemplate: jest.fn(),
    listInstancesByWorkOrder: jest.fn(),
    getInstanceById: jest.fn(),
    createInstance: jest.fn(),
    deleteInstance: jest.fn(),
    updateInstanceStatus: jest.fn(),
    submitAnswer: jest.fn(),
    submitAnswersBatch: jest.fn(),
    uploadAttachment: jest.fn(),
  },
}));

const mockChecklistsService = checklistsService as jest.Mocked<typeof checklistsService>;

// Create wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// Mock data
const mockTemplate: ChecklistTemplate = {
  id: 'template-1',
  userId: 'user-1',
  name: 'Checklist de Manutenção',
  description: 'Checklist para manutenção preventiva',
  version: 1,
  isActive: true,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  sections: [],
  questions: [],
  _count: { instances: 5, questions: 10, sections: 2 },
};

const mockTemplates: ChecklistTemplate[] = [
  mockTemplate,
  {
    id: 'template-2',
    userId: 'user-1',
    name: 'Checklist de Instalação',
    description: 'Checklist para instalação de equipamentos',
    version: 1,
    isActive: true,
    createdAt: '2024-01-02T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
    _count: { instances: 3, questions: 8, sections: 1 },
  },
];

const mockInstance: ChecklistInstance = {
  id: 'instance-1',
  templateId: 'template-1',
  workOrderId: 'work-order-1',
  status: 'IN_PROGRESS',
  createdAt: '2024-01-10T00:00:00.000Z',
  updatedAt: '2024-01-10T00:00:00.000Z',
  template: mockTemplate,
  answers: [],
  _count: { answers: 5 },
};

const mockInstances: ChecklistInstance[] = [
  mockInstance,
  {
    id: 'instance-2',
    templateId: 'template-2',
    workOrderId: 'work-order-1',
    status: 'NOT_STARTED',
    createdAt: '2024-01-11T00:00:00.000Z',
    updatedAt: '2024-01-11T00:00:00.000Z',
    _count: { answers: 0 },
  },
];

describe('useChecklists hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // QUERY KEYS TESTS
  // ============================================

  describe('checklistKeys', () => {
    it('should have correct structure for all keys', () => {
      expect(checklistKeys.all).toEqual(['checklists']);
      expect(checklistKeys.templates()).toEqual(['checklists', 'templates']);
      expect(checklistKeys.template('123')).toEqual(['checklists', 'templates', '123']);
      expect(checklistKeys.instances('wo-1')).toEqual(['checklists', 'instances', 'wo-1']);
      expect(checklistKeys.instance('inst-1')).toEqual(['checklists', 'instance', 'inst-1']);
    });
  });

  // ============================================
  // TEMPLATE QUERIES TESTS
  // ============================================

  describe('useChecklistTemplates', () => {
    it('should fetch templates list', async () => {
      mockChecklistsService.listTemplates.mockResolvedValueOnce(mockTemplates);

      const { result } = renderHook(() => useChecklistTemplates(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockTemplates);
      expect(mockChecklistsService.listTemplates).toHaveBeenCalledWith(false);
    });

    it('should fetch templates including inactive', async () => {
      mockChecklistsService.listTemplates.mockResolvedValueOnce(mockTemplates);

      const { result } = renderHook(() => useChecklistTemplates(true), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockChecklistsService.listTemplates).toHaveBeenCalledWith(true);
    });

    it('should handle error state', async () => {
      mockChecklistsService.listTemplates.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useChecklistTemplates(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeDefined();
    });
  });

  describe('useChecklistTemplate', () => {
    it('should fetch single template by id', async () => {
      mockChecklistsService.getTemplateById.mockResolvedValueOnce(mockTemplate);

      const { result } = renderHook(() => useChecklistTemplate('template-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockTemplate);
      expect(mockChecklistsService.getTemplateById).toHaveBeenCalledWith('template-1');
    });

    it('should not fetch when id is undefined', () => {
      renderHook(() => useChecklistTemplate(undefined), {
        wrapper: createWrapper(),
      });

      expect(mockChecklistsService.getTemplateById).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // TEMPLATE MUTATIONS TESTS
  // ============================================

  describe('useCreateChecklistTemplate', () => {
    it('should create template successfully', async () => {
      mockChecklistsService.createTemplate.mockResolvedValueOnce(mockTemplate);

      const { result } = renderHook(() => useCreateChecklistTemplate(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          name: 'Novo Checklist',
          description: 'Descrição do checklist',
        });
      });

      expect(mockChecklistsService.createTemplate).toHaveBeenCalledWith({
        name: 'Novo Checklist',
        description: 'Descrição do checklist',
      });
    });
  });

  describe('useUpdateChecklistTemplate', () => {
    it('should update template successfully', async () => {
      mockChecklistsService.updateTemplate.mockResolvedValueOnce({
        ...mockTemplate,
        name: 'Updated Name',
      });

      const { result } = renderHook(() => useUpdateChecklistTemplate(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          id: 'template-1',
          data: { name: 'Updated Name' },
        });
      });

      expect(mockChecklistsService.updateTemplate).toHaveBeenCalledWith('template-1', {
        name: 'Updated Name',
      });
    });
  });

  describe('useDeleteChecklistTemplate', () => {
    it('should delete template successfully', async () => {
      mockChecklistsService.deleteTemplate.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useDeleteChecklistTemplate(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync('template-1');
      });

      expect(mockChecklistsService.deleteTemplate).toHaveBeenCalledWith('template-1');
    });
  });

  describe('useDuplicateChecklistTemplate', () => {
    it('should duplicate template with custom name', async () => {
      const duplicatedTemplate = {
        ...mockTemplate,
        id: 'template-3',
        name: 'Checklist Duplicado',
      };
      mockChecklistsService.duplicateTemplate.mockResolvedValueOnce(duplicatedTemplate);

      const { result } = renderHook(() => useDuplicateChecklistTemplate(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          id: 'template-1',
          name: 'Checklist Duplicado',
        });
      });

      expect(mockChecklistsService.duplicateTemplate).toHaveBeenCalledWith(
        'template-1',
        'Checklist Duplicado'
      );
    });

    it('should duplicate template without custom name', async () => {
      mockChecklistsService.duplicateTemplate.mockResolvedValueOnce(mockTemplate);

      const { result } = renderHook(() => useDuplicateChecklistTemplate(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({ id: 'template-1' });
      });

      expect(mockChecklistsService.duplicateTemplate).toHaveBeenCalledWith('template-1', undefined);
    });
  });

  // ============================================
  // INSTANCE QUERIES TESTS
  // ============================================

  describe('useChecklistInstances', () => {
    it('should fetch instances by work order id', async () => {
      mockChecklistsService.listInstancesByWorkOrder.mockResolvedValueOnce(mockInstances);

      const { result } = renderHook(() => useChecklistInstances('work-order-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockInstances);
      expect(mockChecklistsService.listInstancesByWorkOrder).toHaveBeenCalledWith('work-order-1');
    });

    it('should not fetch when workOrderId is undefined', () => {
      renderHook(() => useChecklistInstances(undefined), {
        wrapper: createWrapper(),
      });

      expect(mockChecklistsService.listInstancesByWorkOrder).not.toHaveBeenCalled();
    });
  });

  describe('useChecklistInstance', () => {
    it('should fetch single instance by id', async () => {
      mockChecklistsService.getInstanceById.mockResolvedValueOnce(mockInstance);

      const { result } = renderHook(() => useChecklistInstance('instance-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockInstance);
      expect(mockChecklistsService.getInstanceById).toHaveBeenCalledWith('instance-1');
    });

    it('should not fetch when instanceId is undefined', () => {
      renderHook(() => useChecklistInstance(undefined), {
        wrapper: createWrapper(),
      });

      expect(mockChecklistsService.getInstanceById).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // INSTANCE MUTATIONS TESTS
  // ============================================

  describe('useCreateChecklistInstance', () => {
    it('should create instance successfully', async () => {
      mockChecklistsService.createInstance.mockResolvedValueOnce(mockInstance);

      const { result } = renderHook(() => useCreateChecklistInstance(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          workOrderId: 'work-order-1',
          data: { templateId: 'template-1' },
        });
      });

      expect(mockChecklistsService.createInstance).toHaveBeenCalledWith('work-order-1', {
        templateId: 'template-1',
      });
    });
  });

  describe('useDeleteChecklistInstance', () => {
    it('should delete instance successfully', async () => {
      mockChecklistsService.deleteInstance.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useDeleteChecklistInstance(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          instanceId: 'instance-1',
          workOrderId: 'work-order-1',
        });
      });

      expect(mockChecklistsService.deleteInstance).toHaveBeenCalledWith('instance-1');
    });
  });

  // ============================================
  // ANSWER MUTATIONS TESTS
  // ============================================

  describe('useSubmitChecklistAnswer', () => {
    it('should submit answer successfully', async () => {
      const mockAnswer = {
        id: 'answer-1',
        instanceId: 'instance-1',
        questionId: 'question-1',
        value: 'Sim',
        answeredAt: '2024-01-15T10:00:00.000Z',
      };
      mockChecklistsService.submitAnswer.mockResolvedValueOnce(mockAnswer);

      const { result } = renderHook(() => useSubmitChecklistAnswer(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          instanceId: 'instance-1',
          data: { questionId: 'question-1', value: 'Sim' },
        });
      });

      expect(mockChecklistsService.submitAnswer).toHaveBeenCalledWith('instance-1', {
        questionId: 'question-1',
        value: 'Sim',
      });
    });
  });

  describe('useSubmitChecklistAnswersBatch', () => {
    it('should submit batch answers successfully', async () => {
      const mockAnswers = [
        { id: 'answer-1', instanceId: 'instance-1', questionId: 'question-1', value: 'Sim' },
        { id: 'answer-2', instanceId: 'instance-1', questionId: 'question-2', value: 10 },
      ];
      mockChecklistsService.submitAnswersBatch.mockResolvedValueOnce(mockAnswers);

      const { result } = renderHook(() => useSubmitChecklistAnswersBatch(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          instanceId: 'instance-1',
          data: {
            answers: [
              { questionId: 'question-1', value: 'Sim' },
              { questionId: 'question-2', value: 10 },
            ],
          },
        });
      });

      expect(mockChecklistsService.submitAnswersBatch).toHaveBeenCalledWith('instance-1', {
        answers: [
          { questionId: 'question-1', value: 'Sim' },
          { questionId: 'question-2', value: 10 },
        ],
      });
    });
  });
});
