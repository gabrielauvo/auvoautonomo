/**
 * Testes para o ConditionalLogicEditor
 *
 * Cobre:
 * - Renderização inicial
 * - Expansão/colapso do editor
 * - Adição de regras
 * - Remoção de regras
 * - Seleção de pergunta fonte
 * - Seleção de operadores
 * - Seleção de ações
 * - Toggle AND/OR
 */

import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConditionalLogicEditor } from '../conditional-logic-editor';
import { ChecklistQuestion, ChecklistSection, ConditionalLogic } from '@/services/checklists.service';

// Mock data
const mockQuestions: Partial<ChecklistQuestion>[] = [
  {
    id: 'q1',
    title: 'Equipamento está funcionando?',
    type: 'SELECT',
    options: [
      { value: 'sim', label: 'Sim' },
      { value: 'nao', label: 'Não' },
    ],
  },
  {
    id: 'q2',
    title: 'Qual a temperatura?',
    type: 'NUMBER',
  },
  {
    id: 'q3',
    title: 'Verificação concluída?',
    type: 'CHECKBOX',
  },
  {
    id: 'q4',
    title: 'Observações',
    type: 'TEXT_LONG',
  },
];

const mockSections: Partial<ChecklistSection>[] = [
  { id: 's1', title: 'Seção de Verificação' },
  { id: 's2', title: 'Seção de Documentação' },
];

const currentQuestion: Partial<ChecklistQuestion> = {
  id: 'q-current',
  title: 'Pergunta com lógica condicional',
  type: 'TEXT_SHORT',
};

describe('ConditionalLogicEditor', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Renderização inicial', () => {
    it('deve renderizar o header do editor', () => {
      render(
        <ConditionalLogicEditor
          question={currentQuestion}
          allQuestions={mockQuestions}
          allSections={mockSections}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('Lógica Condicional')).toBeInTheDocument();
      expect(screen.getByText('Configurar quando esta pergunta aparece')).toBeInTheDocument();
    });

    it('deve mostrar contador de regras quando existem regras', () => {
      const questionWithLogic: Partial<ChecklistQuestion> = {
        ...currentQuestion,
        conditionalLogic: {
          rules: [
            { questionId: 'q1', operator: 'EQUALS', value: 'sim', action: 'SHOW' },
            { questionId: 'q2', operator: 'GREATER_THAN', value: 10, action: 'SHOW' },
          ],
          logic: 'AND',
        },
      };

      render(
        <ConditionalLogicEditor
          question={questionWithLogic}
          allQuestions={mockQuestions}
          allSections={mockSections}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('2 regras configuradas')).toBeInTheDocument();
    });

    it('deve mostrar "1 regra configurada" no singular', () => {
      const questionWithLogic: Partial<ChecklistQuestion> = {
        ...currentQuestion,
        conditionalLogic: {
          rules: [{ questionId: 'q1', operator: 'EQUALS', value: 'sim', action: 'SHOW' }],
          logic: 'AND',
        },
      };

      render(
        <ConditionalLogicEditor
          question={questionWithLogic}
          allQuestions={mockQuestions}
          allSections={mockSections}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('1 regra configurada')).toBeInTheDocument();
    });
  });

  describe('Expansão/colapso', () => {
    it('deve expandir ao clicar no header', async () => {
      render(
        <ConditionalLogicEditor
          question={currentQuestion}
          allQuestions={mockQuestions}
          allSections={mockSections}
          onChange={mockOnChange}
        />
      );

      const header = screen.getByText('Lógica Condicional').closest('div');
      fireEvent.click(header!);

      expect(screen.getByText('Adicionar Regra Condicional')).toBeInTheDocument();
    });

    it('deve expandir automaticamente quando tem regras', () => {
      const questionWithLogic: Partial<ChecklistQuestion> = {
        ...currentQuestion,
        conditionalLogic: {
          rules: [{ questionId: 'q1', operator: 'EQUALS', value: 'sim', action: 'SHOW' }],
          logic: 'AND',
        },
      };

      render(
        <ConditionalLogicEditor
          question={questionWithLogic}
          allQuestions={mockQuestions}
          allSections={mockSections}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('Adicionar Regra Condicional')).toBeInTheDocument();
    });
  });

  describe('Adição de regras', () => {
    it('deve adicionar nova regra ao clicar no botão', async () => {
      const user = userEvent.setup();

      render(
        <ConditionalLogicEditor
          question={currentQuestion}
          allQuestions={mockQuestions}
          allSections={mockSections}
          onChange={mockOnChange}
        />
      );

      // Expandir o editor
      const header = screen.getByText('Lógica Condicional').closest('div');
      fireEvent.click(header!);

      // Clicar em adicionar regra
      const addButton = screen.getByText('Adicionar Regra Condicional');
      await user.click(addButton);

      expect(mockOnChange).toHaveBeenCalledWith({
        rules: [
          {
            questionId: '',
            operator: 'EQUALS',
            value: '',
            action: 'SHOW',
          },
        ],
        logic: 'AND',
      });
    });
  });

  describe('Remoção de regras', () => {
    it('deve remover regra e chamar onChange com undefined quando última regra', async () => {
      const user = userEvent.setup();
      const questionWithLogic: Partial<ChecklistQuestion> = {
        ...currentQuestion,
        conditionalLogic: {
          rules: [{ questionId: 'q1', operator: 'EQUALS', value: 'sim', action: 'SHOW' }],
          logic: 'AND',
        },
      };

      render(
        <ConditionalLogicEditor
          question={questionWithLogic}
          allQuestions={mockQuestions}
          allSections={mockSections}
          onChange={mockOnChange}
        />
      );

      const removeButton = screen.getByText('Remover Regra');
      await user.click(removeButton);

      expect(mockOnChange).toHaveBeenCalledWith(undefined);
    });

    it('deve manter outras regras ao remover uma', async () => {
      const user = userEvent.setup();
      const questionWithLogic: Partial<ChecklistQuestion> = {
        ...currentQuestion,
        conditionalLogic: {
          rules: [
            { questionId: 'q1', operator: 'EQUALS', value: 'sim', action: 'SHOW' },
            { questionId: 'q2', operator: 'GREATER_THAN', value: 10, action: 'HIDE' },
          ],
          logic: 'AND',
        },
      };

      render(
        <ConditionalLogicEditor
          question={questionWithLogic}
          allQuestions={mockQuestions}
          allSections={mockSections}
          onChange={mockOnChange}
        />
      );

      const removeButtons = screen.getAllByText('Remover Regra');
      await user.click(removeButtons[0]);

      expect(mockOnChange).toHaveBeenCalledWith({
        rules: [{ questionId: 'q2', operator: 'GREATER_THAN', value: 10, action: 'HIDE' }],
        logic: 'AND',
      });
    });
  });

  describe('Toggle AND/OR', () => {
    it('deve mostrar toggle quando há múltiplas regras', () => {
      const questionWithLogic: Partial<ChecklistQuestion> = {
        ...currentQuestion,
        conditionalLogic: {
          rules: [
            { questionId: 'q1', operator: 'EQUALS', value: 'sim', action: 'SHOW' },
            { questionId: 'q2', operator: 'GREATER_THAN', value: 10, action: 'SHOW' },
          ],
          logic: 'AND',
        },
      };

      render(
        <ConditionalLogicEditor
          question={questionWithLogic}
          allQuestions={mockQuestions}
          allSections={mockSections}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('Aplicar quando:')).toBeInTheDocument();
      expect(screen.getByText('Todas as regras (E)')).toBeInTheDocument();
      expect(screen.getByText('Qualquer regra (OU)')).toBeInTheDocument();
    });

    it('deve alternar para OR ao clicar', async () => {
      const user = userEvent.setup();
      const questionWithLogic: Partial<ChecklistQuestion> = {
        ...currentQuestion,
        conditionalLogic: {
          rules: [
            { questionId: 'q1', operator: 'EQUALS', value: 'sim', action: 'SHOW' },
            { questionId: 'q2', operator: 'GREATER_THAN', value: 10, action: 'SHOW' },
          ],
          logic: 'AND',
        },
      };

      render(
        <ConditionalLogicEditor
          question={questionWithLogic}
          allQuestions={mockQuestions}
          allSections={mockSections}
          onChange={mockOnChange}
        />
      );

      const orButton = screen.getByText('Qualquer regra (OU)');
      await user.click(orButton);

      expect(mockOnChange).toHaveBeenCalledWith({
        rules: [
          { questionId: 'q1', operator: 'EQUALS', value: 'sim', action: 'SHOW' },
          { questionId: 'q2', operator: 'GREATER_THAN', value: 10, action: 'SHOW' },
        ],
        logic: 'OR',
      });
    });

    it('não deve mostrar toggle com apenas uma regra', () => {
      const questionWithLogic: Partial<ChecklistQuestion> = {
        ...currentQuestion,
        conditionalLogic: {
          rules: [{ questionId: 'q1', operator: 'EQUALS', value: 'sim', action: 'SHOW' }],
          logic: 'AND',
        },
      };

      render(
        <ConditionalLogicEditor
          question={questionWithLogic}
          allQuestions={mockQuestions}
          allSections={mockSections}
          onChange={mockOnChange}
        />
      );

      expect(screen.queryByText('Aplicar quando:')).not.toBeInTheDocument();
    });
  });

  describe('Labels de operadores', () => {
    it('deve mostrar operadores corretos para tipo SELECT', () => {
      const questionWithLogic: Partial<ChecklistQuestion> = {
        ...currentQuestion,
        conditionalLogic: {
          rules: [{ questionId: 'q1', operator: 'EQUALS', value: 'sim', action: 'SHOW' }],
          logic: 'AND',
        },
      };

      render(
        <ConditionalLogicEditor
          question={questionWithLogic}
          allQuestions={mockQuestions}
          allSections={mockSections}
          onChange={mockOnChange}
        />
      );

      // Verificar que os operadores para SELECT estão disponíveis
      expect(screen.getByRole('option', { name: 'é igual a' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'é diferente de' })).toBeInTheDocument();
    });
  });

  describe('Labels de ações', () => {
    it('deve mostrar todas as ações disponíveis', () => {
      const questionWithLogic: Partial<ChecklistQuestion> = {
        ...currentQuestion,
        conditionalLogic: {
          rules: [{ questionId: 'q1', operator: 'EQUALS', value: 'sim', action: 'SHOW' }],
          logic: 'AND',
        },
      };

      render(
        <ConditionalLogicEditor
          question={questionWithLogic}
          allQuestions={mockQuestions}
          allSections={mockSections}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByRole('option', { name: 'Mostrar esta pergunta' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Ocultar esta pergunta' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Tornar obrigatória' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Pular para' })).toBeInTheDocument();
    });
  });

  describe('Info alert', () => {
    it('deve mostrar alerta informativo quando não há regras', () => {
      render(
        <ConditionalLogicEditor
          question={currentQuestion}
          allQuestions={mockQuestions}
          allSections={mockSections}
          onChange={mockOnChange}
        />
      );

      // Expandir
      const header = screen.getByText('Lógica Condicional').closest('div');
      fireEvent.click(header!);

      expect(
        screen.getByText(
          'Configure quando esta pergunta deve aparecer com base nas respostas anteriores.'
        )
      ).toBeInTheDocument();
    });

    it('não deve mostrar alerta quando há regras', () => {
      const questionWithLogic: Partial<ChecklistQuestion> = {
        ...currentQuestion,
        conditionalLogic: {
          rules: [{ questionId: 'q1', operator: 'EQUALS', value: 'sim', action: 'SHOW' }],
          logic: 'AND',
        },
      };

      render(
        <ConditionalLogicEditor
          question={questionWithLogic}
          allQuestions={mockQuestions}
          allSections={mockSections}
          onChange={mockOnChange}
        />
      );

      expect(
        screen.queryByText(
          'Configure quando esta pergunta deve aparecer com base nas respostas anteriores.'
        )
      ).not.toBeInTheDocument();
    });
  });

  describe('Filtragem de perguntas', () => {
    it('não deve mostrar a pergunta atual na lista de perguntas fonte', () => {
      const allQuestionsWithCurrent = [...mockQuestions, currentQuestion];

      const questionWithLogic: Partial<ChecklistQuestion> = {
        ...currentQuestion,
        conditionalLogic: {
          rules: [{ questionId: '', operator: 'EQUALS', value: '', action: 'SHOW' }],
          logic: 'AND',
        },
      };

      render(
        <ConditionalLogicEditor
          question={questionWithLogic}
          allQuestions={allQuestionsWithCurrent}
          allSections={mockSections}
          onChange={mockOnChange}
        />
      );

      // A pergunta atual não deve aparecer nas opções
      expect(
        screen.queryByRole('option', { name: 'Pergunta com lógica condicional' })
      ).not.toBeInTheDocument();
    });
  });
});
