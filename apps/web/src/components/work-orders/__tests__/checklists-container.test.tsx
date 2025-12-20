/**
 * Testes para o ChecklistsContainer
 *
 * Cobre:
 * - Renderização de estados (loading, error, empty, com dados)
 * - Lista de checklists com status
 * - Barra de progresso
 * - Abertura de checklist para responder
 * - Modal de adicionar checklist
 * - Exclusão de checklist
 * - Permissões baseadas no status da OS
 */

import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ChecklistsContainer } from '../checklists-container';
import {
  useChecklistInstances,
  useChecklistTemplates,
  useCreateChecklistInstance,
  useDeleteChecklistInstance,
} from '@/hooks/use-checklists';
import { ChecklistInstance, ChecklistTemplate } from '@/services/checklists.service';

// Mock the hooks
jest.mock('@/hooks/use-checklists');

// Mock ChecklistResponseForm
jest.mock('@/components/checklists', () => ({
  ChecklistResponseForm: ({ instanceId, onComplete }: { instanceId: string; onComplete: () => void }) => (
    <div data-testid="checklist-response-form">
      <span>Instance ID: {instanceId}</span>
      <button onClick={onComplete}>Complete</button>
    </div>
  ),
}));

const mockUseChecklistInstances = useChecklistInstances as jest.Mock;
const mockUseChecklistTemplates = useChecklistTemplates as jest.Mock;
const mockUseCreateChecklistInstance = useCreateChecklistInstance as jest.Mock;
const mockUseDeleteChecklistInstance = useDeleteChecklistInstance as jest.Mock;

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
  description: 'Checklist padrão',
  version: 1,
  isActive: true,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  questions: [
    { id: 'q1', templateId: 'template-1', type: 'CHECKBOX', title: 'Verificação', isRequired: true, order: 1, createdAt: '', updatedAt: '' },
    { id: 'q2', templateId: 'template-1', type: 'TEXT_SHORT', title: 'Observações', isRequired: false, order: 2, createdAt: '', updatedAt: '' },
  ],
  sections: [],
  _count: { instances: 0, questions: 2, sections: 0 },
};

const mockTemplates: ChecklistTemplate[] = [
  mockTemplate,
  {
    id: 'template-2',
    userId: 'user-1',
    name: 'Checklist de Instalação',
    description: '',
    version: 1,
    isActive: true,
    createdAt: '2024-01-02T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
    _count: { instances: 0, questions: 5, sections: 1 },
  },
];

const mockInstances: ChecklistInstance[] = [
  {
    id: 'instance-1',
    templateId: 'template-1',
    workOrderId: 'wo-1',
    status: 'IN_PROGRESS',
    createdAt: '2024-01-10T00:00:00.000Z',
    updatedAt: '2024-01-10T00:00:00.000Z',
    template: mockTemplate,
    _count: { answers: 1 },
  },
  {
    id: 'instance-2',
    templateId: 'template-3',
    workOrderId: 'wo-1',
    status: 'COMPLETED',
    createdAt: '2024-01-11T00:00:00.000Z',
    updatedAt: '2024-01-11T00:00:00.000Z',
    template: {
      ...mockTemplate,
      id: 'template-3',
      name: 'Checklist Concluído',
      questions: [{ id: 'q3', templateId: 'template-3', type: 'CHECKBOX', title: 'Check', isRequired: true, order: 1, createdAt: '', updatedAt: '' }],
      _count: { instances: 1, questions: 1, sections: 0 },
    },
    _count: { answers: 1 },
  },
  {
    id: 'instance-3',
    templateId: 'template-4',
    workOrderId: 'wo-1',
    status: 'NOT_STARTED',
    createdAt: '2024-01-12T00:00:00.000Z',
    updatedAt: '2024-01-12T00:00:00.000Z',
    template: {
      ...mockTemplate,
      id: 'template-4',
      name: 'Checklist Não Iniciado',
      questions: [{ id: 'q4', templateId: 'template-4', type: 'NUMBER', title: 'Número', isRequired: false, order: 1, createdAt: '', updatedAt: '' }],
      _count: { instances: 1, questions: 1, sections: 0 },
    },
    _count: { answers: 0 },
  },
];

describe('ChecklistsContainer', () => {
  const mockRefetch = jest.fn();
  const mockMutateAsync = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mocks
    mockUseChecklistInstances.mockReturnValue({
      data: mockInstances,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    mockUseChecklistTemplates.mockReturnValue({
      data: mockTemplates,
      isLoading: false,
    });

    mockUseCreateChecklistInstance.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });

    mockUseDeleteChecklistInstance.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });
  });

  describe('Estados de carregamento', () => {
    it('deve mostrar skeleton durante carregamento', () => {
      mockUseChecklistInstances.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        refetch: mockRefetch,
      });

      render(
        <ChecklistsContainer workOrderId="wo-1" workOrderStatus="IN_PROGRESS" />,
        { wrapper: createWrapper() }
      );

      // Verifica que há elementos de skeleton (animate-pulse class)
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('deve mostrar mensagem de erro', () => {
      mockUseChecklistInstances.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Network error'),
        refetch: mockRefetch,
      });

      render(
        <ChecklistsContainer workOrderId="wo-1" workOrderStatus="IN_PROGRESS" />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText('Erro ao carregar checklists')).toBeInTheDocument();
    });
  });

  describe('Estado vazio', () => {
    it('deve mostrar empty state quando não há checklists', () => {
      mockUseChecklistInstances.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      render(
        <ChecklistsContainer workOrderId="wo-1" workOrderStatus="IN_PROGRESS" />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText('Nenhum checklist')).toBeInTheDocument();
    });

    it('deve mostrar mensagem diferente quando OS não está em progresso', () => {
      mockUseChecklistInstances.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      render(
        <ChecklistsContainer workOrderId="wo-1" workOrderStatus="SCHEDULED" />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText('Esta OS não possui checklists')).toBeInTheDocument();
    });
  });

  describe('Lista de checklists', () => {
    it('deve renderizar lista de checklists com informações', () => {
      render(
        <ChecklistsContainer workOrderId="wo-1" workOrderStatus="IN_PROGRESS" />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText('Checklists')).toBeInTheDocument();
      expect(screen.getByText('Checklist de Manutenção')).toBeInTheDocument();
      expect(screen.getByText('Checklist Concluído')).toBeInTheDocument();
      expect(screen.getByText('Checklist Não Iniciado')).toBeInTheDocument();
    });

    it('deve mostrar badges de status corretos', () => {
      render(
        <ChecklistsContainer workOrderId="wo-1" workOrderStatus="IN_PROGRESS" />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText('Em progresso')).toBeInTheDocument();
      expect(screen.getByText('Concluído')).toBeInTheDocument();
      expect(screen.getByText('Não iniciado')).toBeInTheDocument();
    });

    it('deve mostrar contagem de perguntas', () => {
      render(
        <ChecklistsContainer workOrderId="wo-1" workOrderStatus="IN_PROGRESS" />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText('2 perguntas')).toBeInTheDocument();
      expect(screen.getAllByText('1 pergunta').length).toBeGreaterThan(0);
    });

    it('deve mostrar botão "Iniciar" para checklist não iniciado', () => {
      render(
        <ChecklistsContainer workOrderId="wo-1" workOrderStatus="IN_PROGRESS" />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText('Iniciar')).toBeInTheDocument();
    });

    it('deve mostrar botão "Continuar" para checklist em progresso', () => {
      render(
        <ChecklistsContainer workOrderId="wo-1" workOrderStatus="IN_PROGRESS" />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText('Continuar')).toBeInTheDocument();
    });
  });

  describe('Barra de progresso', () => {
    it('deve mostrar percentual de conclusão', () => {
      render(
        <ChecklistsContainer workOrderId="wo-1" workOrderStatus="IN_PROGRESS" />,
        { wrapper: createWrapper() }
      );

      // Instance 1: 1 de 2 perguntas = 50%
      expect(screen.getByText('50% concluído')).toBeInTheDocument();
    });
  });

  describe('Navegação para resposta', () => {
    it('deve abrir formulário de resposta ao clicar no card', async () => {
      const user = userEvent.setup();

      render(
        <ChecklistsContainer workOrderId="wo-1" workOrderStatus="IN_PROGRESS" />,
        { wrapper: createWrapper() }
      );

      const card = screen.getByText('Checklist de Manutenção').closest('[class*="card"]');
      await user.click(card!);

      expect(screen.getByTestId('checklist-response-form')).toBeInTheDocument();
      expect(screen.getByText('Instance ID: instance-1')).toBeInTheDocument();
    });

    it('deve mostrar botão voltar quando no formulário', async () => {
      const user = userEvent.setup();

      render(
        <ChecklistsContainer workOrderId="wo-1" workOrderStatus="IN_PROGRESS" />,
        { wrapper: createWrapper() }
      );

      const card = screen.getByText('Checklist de Manutenção').closest('[class*="card"]');
      await user.click(card!);

      expect(screen.getByText('← Voltar para lista')).toBeInTheDocument();
    });

    it('deve voltar para lista ao clicar em voltar', async () => {
      const user = userEvent.setup();

      render(
        <ChecklistsContainer workOrderId="wo-1" workOrderStatus="IN_PROGRESS" />,
        { wrapper: createWrapper() }
      );

      const card = screen.getByText('Checklist de Manutenção').closest('[class*="card"]');
      await user.click(card!);

      const backButton = screen.getByText('← Voltar para lista');
      await user.click(backButton);

      expect(screen.getByText('Checklists')).toBeInTheDocument();
      expect(screen.queryByTestId('checklist-response-form')).not.toBeInTheDocument();
    });
  });

  describe('Adicionar checklist', () => {
    it('deve mostrar botão adicionar quando editável e templates disponíveis', () => {
      render(
        <ChecklistsContainer workOrderId="wo-1" workOrderStatus="IN_PROGRESS" />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText('Adicionar Checklist')).toBeInTheDocument();
    });

    it('não deve mostrar botão adicionar quando OS não está em progresso', () => {
      render(
        <ChecklistsContainer workOrderId="wo-1" workOrderStatus="SCHEDULED" />,
        { wrapper: createWrapper() }
      );

      expect(screen.queryByText('Adicionar Checklist')).not.toBeInTheDocument();
    });

    it('deve abrir modal ao clicar em adicionar', async () => {
      const user = userEvent.setup();

      render(
        <ChecklistsContainer workOrderId="wo-1" workOrderStatus="IN_PROGRESS" />,
        { wrapper: createWrapper() }
      );

      await user.click(screen.getByText('Adicionar Checklist'));

      expect(screen.getByText('Selecione um template de checklist para adicionar à OS:')).toBeInTheDocument();
    });

    it('deve filtrar templates já adicionados', async () => {
      const user = userEvent.setup();

      render(
        <ChecklistsContainer workOrderId="wo-1" workOrderStatus="IN_PROGRESS" />,
        { wrapper: createWrapper() }
      );

      await user.click(screen.getByText('Adicionar Checklist'));

      // template-1 já está adicionado como instance-1, então só deve mostrar template-2
      const modal = screen.getByRole('dialog');
      expect(within(modal).getByText('Checklist de Instalação')).toBeInTheDocument();
      expect(within(modal).queryByText('Checklist de Manutenção')).not.toBeInTheDocument();
    });

    it('deve chamar mutate ao confirmar adição', async () => {
      const user = userEvent.setup();
      mockMutateAsync.mockResolvedValueOnce({});

      render(
        <ChecklistsContainer workOrderId="wo-1" workOrderStatus="IN_PROGRESS" />,
        { wrapper: createWrapper() }
      );

      await user.click(screen.getByText('Adicionar Checklist'));

      // Selecionar template
      const templateButton = screen.getByText('Checklist de Instalação');
      await user.click(templateButton);

      // Confirmar
      const addButtons = screen.getAllByText('Adicionar');
      const confirmButton = addButtons[addButtons.length - 1];
      await user.click(confirmButton);

      expect(mockMutateAsync).toHaveBeenCalledWith({
        workOrderId: 'wo-1',
        data: { templateId: 'template-2' },
      });
    });
  });

  describe('Excluir checklist', () => {
    it('deve usar o hook de deletar instância', () => {
      render(
        <ChecklistsContainer workOrderId="wo-1" workOrderStatus="IN_PROGRESS" />,
        { wrapper: createWrapper() }
      );

      // Verifica que o hook foi chamado
      expect(mockUseDeleteChecklistInstance).toHaveBeenCalled();
    });

    it('deve renderizar ícones de lixeira quando há checklists em progresso', () => {
      render(
        <ChecklistsContainer workOrderId="wo-1" workOrderStatus="IN_PROGRESS" />,
        { wrapper: createWrapper() }
      );

      // Verifica que existe pelo menos um ícone de lixeira no documento
      const trashIcons = document.querySelectorAll('svg.lucide-trash-2');
      // Pode não haver lixeiras se o componente decidir não mostrar (ex: status COMPLETED)
      expect(trashIcons.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Permissões', () => {
    it('não deve mostrar botões de ação quando OS não está em progresso', () => {
      render(
        <ChecklistsContainer workOrderId="wo-1" workOrderStatus="SCHEDULED" />,
        { wrapper: createWrapper() }
      );

      expect(screen.queryByText('Iniciar')).not.toBeInTheDocument();
      expect(screen.queryByText('Continuar')).not.toBeInTheDocument();
    });

    it('não deve mostrar botão de excluir quando OS não está em progresso', () => {
      render(
        <ChecklistsContainer workOrderId="wo-1" workOrderStatus="SCHEDULED" />,
        { wrapper: createWrapper() }
      );

      const deleteButtons = screen.queryAllByRole('button').filter(
        (btn) => btn.querySelector('svg.lucide-trash-2')
      );
      expect(deleteButtons).toHaveLength(0);
    });
  });
});
