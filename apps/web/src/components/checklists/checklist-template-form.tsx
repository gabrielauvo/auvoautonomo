'use client';

/**
 * Checklist Template Form
 *
 * Formulário para criar/editar templates de checklist.
 * Suporta:
 * - Dados básicos (nome, descrição)
 * - Seções
 * - Perguntas com 17 tipos diferentes
 * - Arrastar e soltar para reordenar
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Textarea,
  Alert,
  Badge,
  Switch,
  Select,
  FormField,
} from '@/components/ui';
import {
  Plus,
  Save,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Settings,
  Type,
  Hash,
  Calendar,
  Clock,
  CheckSquare,
  List,
  Camera,
  FileUp,
  PenTool,
  Star,
  Sliders,
  HelpCircle,
  GitBranch,
} from 'lucide-react';
import { ConditionalLogicEditor } from './conditional-logic-editor';
import {
  useCreateChecklistTemplate,
  useUpdateChecklistTemplate,
  useCreateChecklistSection,
  useUpdateChecklistSection,
  useCreateChecklistQuestion,
  useUpdateChecklistQuestion,
} from '@/hooks/use-checklists';
import {
  ChecklistTemplate,
  ChecklistSection,
  ChecklistQuestion,
  ChecklistQuestionType,
  CreateChecklistSectionDto,
  CreateChecklistQuestionDto,
  QuestionOption,
  ConditionalLogic,
} from '@/services/checklists.service';

// ============================================
// TYPES
// ============================================

interface ChecklistTemplateFormProps {
  template?: ChecklistTemplate;
  isEditing?: boolean;
}

// Question type configuration
interface QuestionTypeConfig {
  type: ChecklistQuestionType;
  label: string;
  icon: React.ElementType;
  hasOptions: boolean;
  description: string;
}

const QUESTION_TYPES: QuestionTypeConfig[] = [
  { type: 'TEXT_SHORT', label: 'Texto Curto', icon: Type, hasOptions: false, description: 'Resposta em uma linha' },
  { type: 'TEXT_LONG', label: 'Texto Longo', icon: Type, hasOptions: false, description: 'Resposta em múltiplas linhas' },
  { type: 'NUMBER', label: 'Número', icon: Hash, hasOptions: false, description: 'Valor numérico' },
  { type: 'DATE', label: 'Data', icon: Calendar, hasOptions: false, description: 'Seleção de data' },
  { type: 'TIME', label: 'Hora', icon: Clock, hasOptions: false, description: 'Seleção de hora' },
  { type: 'DATETIME', label: 'Data e Hora', icon: Calendar, hasOptions: false, description: 'Data e hora' },
  { type: 'CHECKBOX', label: 'Caixa de Seleção', icon: CheckSquare, hasOptions: false, description: 'Sim ou Não' },
  { type: 'SELECT', label: 'Lista Suspensa', icon: List, hasOptions: true, description: 'Escolha única' },
  { type: 'MULTI_SELECT', label: 'Múltipla Escolha', icon: List, hasOptions: true, description: 'Várias opções' },
  { type: 'PHOTO_REQUIRED', label: 'Foto Obrigatória', icon: Camera, hasOptions: false, description: 'Foto necessária' },
  { type: 'PHOTO_OPTIONAL', label: 'Foto Opcional', icon: Camera, hasOptions: false, description: 'Foto opcional' },
  { type: 'FILE_UPLOAD', label: 'Upload de Arquivo', icon: FileUp, hasOptions: false, description: 'Envio de arquivo' },
  { type: 'SIGNATURE_TECHNICIAN', label: 'Assinatura Técnico', icon: PenTool, hasOptions: false, description: 'Assinatura do técnico' },
  { type: 'SIGNATURE_CLIENT', label: 'Assinatura Cliente', icon: PenTool, hasOptions: false, description: 'Assinatura do cliente' },
  { type: 'SECTION_TITLE', label: 'Título de Seção', icon: Type, hasOptions: false, description: 'Separador visual' },
  { type: 'RATING', label: 'Avaliação', icon: Star, hasOptions: false, description: 'Nota de 1 a 5' },
  { type: 'SCALE', label: 'Escala', icon: Sliders, hasOptions: false, description: 'Valor em escala' },
];

// ============================================
// QUESTION EDITOR COMPONENT
// ============================================

interface QuestionEditorProps {
  question: Partial<ChecklistQuestion>;
  onChange: (question: Partial<ChecklistQuestion>) => void;
  onDelete: () => void;
  isNew?: boolean;
  allQuestions?: Partial<ChecklistQuestion>[];
  allSections?: Partial<ChecklistSection>[];
}

function QuestionEditor({ question, onChange, onDelete, isNew, allQuestions = [], allSections = [] }: QuestionEditorProps) {
  const [expanded, setExpanded] = useState(isNew);
  const typeConfig = QUESTION_TYPES.find((t) => t.type === question.type) || QUESTION_TYPES[0];
  const hasConditionalLogic = Boolean(question.conditionalLogic?.rules?.length);
  const Icon = typeConfig.icon;

  const handleAddOption = () => {
    const currentOptions = question.options || [];
    const newOption: QuestionOption = {
      value: `option_${currentOptions.length + 1}`,
      label: `Opção ${currentOptions.length + 1}`,
      order: currentOptions.length,
    };
    onChange({ ...question, options: [...currentOptions, newOption] });
  };

  const handleRemoveOption = (index: number) => {
    const currentOptions = question.options || [];
    const newOptions = currentOptions.filter((_, i) => i !== index);
    onChange({ ...question, options: newOptions });
  };

  const handleUpdateOption = (index: number, field: 'label' | 'value', value: string) => {
    const currentOptions = question.options || [];
    const newOptions = currentOptions.map((opt, i) => {
      if (i === index) {
        return { ...opt, [field]: value };
      }
      return opt;
    });
    onChange({ ...question, options: newOptions });
  };

  return (
    <div className="border rounded-lg bg-white shadow-sm">
      {/* Header */}
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded(!expanded)}
      >
        <GripVertical className="h-4 w-4 text-gray-400 cursor-grab" />
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100">
          <Icon className="h-4 w-4 text-gray-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 truncate">
            {question.title || 'Nova Pergunta'}
          </p>
          <p className="text-xs text-gray-500">{typeConfig.label}</p>
        </div>
        {question.isRequired && (
          <Badge variant="soft-error" size="sm">
            Obrigatória
          </Badge>
        )}
        {hasConditionalLogic && (
          <Badge variant="soft" size="sm">
            <GitBranch className="h-3 w-3 mr-1" />
            Condicional
          </Badge>
        )}
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-400" />
        )}
      </div>

      {/* Content */}
      {expanded && (
        <div className="border-t p-4 space-y-4">
          {/* Title */}
          <FormField label="Título da Pergunta" required>
            <Input
              value={question.title || ''}
              onChange={(e) => onChange({ ...question, title: e.target.value })}
              placeholder="Ex: Qual é a temperatura do equipamento?"
            />
          </FormField>

          {/* Type */}
          <FormField label="Tipo de Pergunta">
            <Select
              value={question.type || 'TEXT_SHORT'}
              onChange={(e) => onChange({ ...question, type: e.target.value as ChecklistQuestionType })}
            >
              {QUESTION_TYPES.map((type) => (
                <option key={type.type} value={type.type}>
                  {type.label} - {type.description}
                </option>
              ))}
            </Select>
          </FormField>

          {/* Description */}
          <FormField label="Descrição (opcional)">
            <Textarea
              value={question.description || ''}
              onChange={(e) => onChange({ ...question, description: e.target.value })}
              placeholder="Instruções adicionais para o técnico..."
              rows={2}
            />
          </FormField>

          {/* Placeholder */}
          {['TEXT_SHORT', 'TEXT_LONG', 'NUMBER'].includes(question.type || '') && (
            <FormField label="Placeholder">
              <Input
                value={question.placeholder || ''}
                onChange={(e) => onChange({ ...question, placeholder: e.target.value })}
                placeholder="Texto de exemplo..."
              />
            </FormField>
          )}

          {/* Options for SELECT and MULTI_SELECT */}
          {typeConfig.hasOptions && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Opções
              </label>
              <div className="space-y-2">
                {(question.options || []).map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={option.label}
                      onChange={(e) => handleUpdateOption(index, 'label', e.target.value)}
                      placeholder="Texto da opção"
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleRemoveOption(index)}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddOption}
                  leftIcon={<Plus className="h-4 w-4" />}
                >
                  Adicionar Opção
                </Button>
              </div>
            </div>
          )}

          {/* Required toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Pergunta Obrigatória</p>
              <p className="text-xs text-gray-500">Técnico deve responder para concluir</p>
            </div>
            <Switch
              checked={question.isRequired || false}
              onCheckedChange={(checked) => onChange({ ...question, isRequired: checked })}
            />
          </div>

          {/* Conditional Logic - only show if not SECTION_TITLE */}
          {question.type !== 'SECTION_TITLE' && allQuestions.length > 0 && (
            <ConditionalLogicEditor
              question={question}
              allQuestions={allQuestions}
              allSections={allSections}
              onChange={(logic) => onChange({ ...question, conditionalLogic: logic })}
            />
          )}

          {/* Actions */}
          <div className="flex justify-end pt-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              leftIcon={<Trash2 className="h-4 w-4" />}
            >
              Excluir Pergunta
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// SECTION EDITOR COMPONENT
// ============================================

interface SectionEditorProps {
  section: Partial<ChecklistSection>;
  questions: Partial<ChecklistQuestion>[];
  onSectionChange: (section: Partial<ChecklistSection>) => void;
  onQuestionChange: (index: number, question: Partial<ChecklistQuestion>) => void;
  onQuestionDelete: (index: number) => void;
  onAddQuestion: () => void;
  onDelete: () => void;
  isNew?: boolean;
  allQuestions?: Partial<ChecklistQuestion>[];
  allSections?: Partial<ChecklistSection>[];
}

function SectionEditor({
  section,
  questions,
  onSectionChange,
  onQuestionChange,
  onQuestionDelete,
  onAddQuestion,
  onDelete,
  isNew,
  allQuestions = [],
  allSections = [],
}: SectionEditorProps) {
  const [expanded, setExpanded] = useState(isNew);

  return (
    <Card className="border-l-4 border-l-primary">
      {/* Header */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded(!expanded)}
      >
        <GripVertical className="h-5 w-5 text-gray-400 cursor-grab" />
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">
            {section.title || 'Nova Seção'}
          </h3>
          {section.description && (
            <p className="text-sm text-gray-500">{section.description}</p>
          )}
        </div>
        <Badge variant="soft-gray" size="sm">
          {questions.length} pergunta{questions.length !== 1 ? 's' : ''}
        </Badge>
        {expanded ? (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronRight className="h-5 w-5 text-gray-400" />
        )}
      </div>

      {/* Content */}
      {expanded && (
        <CardContent className="border-t space-y-4">
          {/* Section fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Título da Seção" required>
              <Input
                value={section.title || ''}
                onChange={(e) => onSectionChange({ ...section, title: e.target.value })}
                placeholder="Ex: Inspeção Visual"
              />
            </FormField>
            <FormField label="Descrição (opcional)">
              <Input
                value={section.description || ''}
                onChange={(e) => onSectionChange({ ...section, description: e.target.value })}
                placeholder="Instruções para esta seção..."
              />
            </FormField>
          </div>

          {/* Questions */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700">Perguntas desta Seção</h4>
            {questions.length === 0 ? (
              <div className="text-center py-6 bg-gray-50 rounded-lg border-2 border-dashed">
                <HelpCircle className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                <p className="text-gray-500 text-sm">Nenhuma pergunta nesta seção</p>
              </div>
            ) : (
              <div className="space-y-2">
                {questions.map((question, index) => (
                  <QuestionEditor
                    key={question.id || `new-${index}`}
                    question={question}
                    onChange={(q) => onQuestionChange(index, q)}
                    onDelete={() => onQuestionDelete(index)}
                    isNew={!question.id}
                    allQuestions={allQuestions}
                    allSections={allSections}
                  />
                ))}
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={onAddQuestion}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Adicionar Pergunta
            </Button>
          </div>

          {/* Delete section */}
          <div className="flex justify-end pt-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              leftIcon={<Trash2 className="h-4 w-4" />}
            >
              Excluir Seção
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ============================================
// MAIN FORM COMPONENT
// ============================================

export function ChecklistTemplateForm({ template, isEditing }: ChecklistTemplateFormProps) {
  const router = useRouter();

  // Form state
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [isActive, setIsActive] = useState(template?.isActive ?? true);

  // Sections and questions state
  const [sections, setSections] = useState<Partial<ChecklistSection>[]>(
    template?.sections || []
  );
  const [sectionQuestions, setSectionQuestions] = useState<Record<string, Partial<ChecklistQuestion>[]>>({});
  const [unsectionedQuestions, setUnsectionedQuestions] = useState<Partial<ChecklistQuestion>[]>([]);

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Computed: all questions for conditional logic
  const allQuestions = useMemo(() => {
    const allQs: Partial<ChecklistQuestion>[] = [...unsectionedQuestions];
    Object.values(sectionQuestions).forEach((qs) => {
      allQs.push(...qs);
    });
    return allQs;
  }, [sectionQuestions, unsectionedQuestions]);

  // Mutations
  const createTemplateMutation = useCreateChecklistTemplate();
  const updateTemplateMutation = useUpdateChecklistTemplate();
  const createSectionMutation = useCreateChecklistSection();
  const updateSectionMutation = useUpdateChecklistSection();
  const createQuestionMutation = useCreateChecklistQuestion();
  const updateQuestionMutation = useUpdateChecklistQuestion();

  // Initialize questions from template
  useEffect(() => {
    if (template) {
      const sectionQuestionsMap: Record<string, Partial<ChecklistQuestion>[]> = {};
      const unsectioned: Partial<ChecklistQuestion>[] = [];

      (template.questions || []).forEach((q) => {
        if (q.sectionId) {
          if (!sectionQuestionsMap[q.sectionId]) {
            sectionQuestionsMap[q.sectionId] = [];
          }
          sectionQuestionsMap[q.sectionId].push(q);
        } else {
          unsectioned.push(q);
        }
      });

      // Sort by order
      Object.keys(sectionQuestionsMap).forEach((key) => {
        sectionQuestionsMap[key].sort((a, b) => (a.order || 0) - (b.order || 0));
      });
      unsectioned.sort((a, b) => (a.order || 0) - (b.order || 0));

      setSectionQuestions(sectionQuestionsMap);
      setUnsectionedQuestions(unsectioned);
    }
  }, [template]);

  // Section handlers
  const handleAddSection = useCallback(() => {
    const newSection: Partial<ChecklistSection> = {
      id: `temp-${Date.now()}`,
      title: '',
      description: '',
      order: sections.length,
    };
    setSections([...sections, newSection]);
    setSectionQuestions({ ...sectionQuestions, [newSection.id!]: [] });
  }, [sections, sectionQuestions]);

  const handleUpdateSection = useCallback((index: number, section: Partial<ChecklistSection>) => {
    const newSections = [...sections];
    newSections[index] = section;
    setSections(newSections);
  }, [sections]);

  const handleDeleteSection = useCallback((index: number) => {
    const section = sections[index];
    if (section.id) {
      // Move questions to unsectioned
      const questionsToMove = sectionQuestions[section.id] || [];
      setUnsectionedQuestions([...unsectionedQuestions, ...questionsToMove]);

      // Remove section questions
      const newSectionQuestions = { ...sectionQuestions };
      delete newSectionQuestions[section.id];
      setSectionQuestions(newSectionQuestions);
    }

    const newSections = sections.filter((_, i) => i !== index);
    setSections(newSections);
  }, [sections, sectionQuestions, unsectionedQuestions]);

  // Question handlers
  const handleAddQuestion = useCallback((sectionId?: string) => {
    const newQuestion: Partial<ChecklistQuestion> = {
      id: `temp-${Date.now()}`,
      type: 'TEXT_SHORT',
      title: '',
      isRequired: false,
      order: 0,
    };

    if (sectionId) {
      const currentQuestions = sectionQuestions[sectionId] || [];
      newQuestion.order = currentQuestions.length;
      setSectionQuestions({
        ...sectionQuestions,
        [sectionId]: [...currentQuestions, newQuestion],
      });
    } else {
      newQuestion.order = unsectionedQuestions.length;
      setUnsectionedQuestions([...unsectionedQuestions, newQuestion]);
    }
  }, [sectionQuestions, unsectionedQuestions]);

  const handleUpdateQuestion = useCallback((
    sectionId: string | null,
    index: number,
    question: Partial<ChecklistQuestion>
  ) => {
    if (sectionId) {
      const currentQuestions = sectionQuestions[sectionId] || [];
      const newQuestions = [...currentQuestions];
      newQuestions[index] = question;
      setSectionQuestions({ ...sectionQuestions, [sectionId]: newQuestions });
    } else {
      const newQuestions = [...unsectionedQuestions];
      newQuestions[index] = question;
      setUnsectionedQuestions(newQuestions);
    }
  }, [sectionQuestions, unsectionedQuestions]);

  const handleDeleteQuestion = useCallback((sectionId: string | null, index: number) => {
    if (sectionId) {
      const currentQuestions = sectionQuestions[sectionId] || [];
      const newQuestions = currentQuestions.filter((_, i) => i !== index);
      setSectionQuestions({ ...sectionQuestions, [sectionId]: newQuestions });
    } else {
      const newQuestions = unsectionedQuestions.filter((_, i) => i !== index);
      setUnsectionedQuestions(newQuestions);
    }
  }, [sectionQuestions, unsectionedQuestions]);

  // Save handler
  const handleSave = useCallback(async () => {
    setError(null);
    setIsSaving(true);

    try {
      // Validate
      if (!name.trim()) {
        throw new Error('Nome do template é obrigatório');
      }

      // Count total questions
      let totalQuestions = unsectionedQuestions.length;
      Object.values(sectionQuestions).forEach((qs) => {
        totalQuestions += qs.length;
      });

      if (totalQuestions === 0) {
        throw new Error('Adicione pelo menos uma pergunta ao template');
      }

      // Validate questions
      const allQuestions = [
        ...unsectionedQuestions,
        ...Object.values(sectionQuestions).flat(),
      ];
      for (const q of allQuestions) {
        if (!q.title?.trim()) {
          throw new Error('Todas as perguntas devem ter um título');
        }
      }

      if (isEditing && template) {
        // Update existing template
        await updateTemplateMutation.mutateAsync({
          id: template.id,
          data: { name, description: description || undefined, isActive },
        });

        // Handle sections
        for (const section of sections) {
          if (section.id?.startsWith('temp-')) {
            // Create new section
            const created = await createSectionMutation.mutateAsync({
              templateId: template.id,
              data: { title: section.title!, description: section.description },
            });

            // Create questions for this section
            const questions = sectionQuestions[section.id] || [];
            for (let i = 0; i < questions.length; i++) {
              const q = questions[i];
              await createQuestionMutation.mutateAsync({
                templateId: template.id,
                data: {
                  sectionId: created.id,
                  type: q.type!,
                  title: q.title!,
                  description: q.description,
                  placeholder: q.placeholder,
                  isRequired: q.isRequired,
                  order: i,
                  options: q.options,
                  validations: q.validations,
                  metadata: q.metadata,
                },
              });
            }
          } else if (section.id) {
            // Update existing section
            await updateSectionMutation.mutateAsync({
              templateId: template.id,
              sectionId: section.id,
              data: { title: section.title, description: section.description },
            });

            // Handle questions in this section
            const questions = sectionQuestions[section.id] || [];
            for (let i = 0; i < questions.length; i++) {
              const q = questions[i];
              if (q.id?.startsWith('temp-')) {
                // Create new question
                await createQuestionMutation.mutateAsync({
                  templateId: template.id,
                  data: {
                    sectionId: section.id,
                    type: q.type!,
                    title: q.title!,
                    description: q.description,
                    placeholder: q.placeholder,
                    isRequired: q.isRequired,
                    order: i,
                    options: q.options,
                    validations: q.validations,
                    metadata: q.metadata,
                  },
                });
              } else if (q.id) {
                // Update existing question
                await updateQuestionMutation.mutateAsync({
                  templateId: template.id,
                  questionId: q.id,
                  data: {
                    type: q.type,
                    title: q.title,
                    description: q.description,
                    placeholder: q.placeholder,
                    isRequired: q.isRequired,
                    order: i,
                    options: q.options,
                    validations: q.validations,
                    metadata: q.metadata,
                  },
                });
              }
            }
          }
        }

        // Handle unsectioned questions
        for (let i = 0; i < unsectionedQuestions.length; i++) {
          const q = unsectionedQuestions[i];
          if (q.id?.startsWith('temp-')) {
            await createQuestionMutation.mutateAsync({
              templateId: template.id,
              data: {
                type: q.type!,
                title: q.title!,
                description: q.description,
                placeholder: q.placeholder,
                isRequired: q.isRequired,
                order: i,
                options: q.options,
                validations: q.validations,
                metadata: q.metadata,
              },
            });
          } else if (q.id) {
            await updateQuestionMutation.mutateAsync({
              templateId: template.id,
              questionId: q.id,
              data: {
                type: q.type,
                title: q.title,
                description: q.description,
                placeholder: q.placeholder,
                isRequired: q.isRequired,
                order: i,
                options: q.options,
                validations: q.validations,
                metadata: q.metadata,
              },
            });
          }
        }

        router.push(`/checklists/${template.id}`);
      } else {
        // Create new template with sections and ALL questions in a single request
        const filteredSections = sections.filter((s) => s.title?.trim());
        const sectionsToCreate: CreateChecklistSectionDto[] = filteredSections.map((s, i) => ({
          title: s.title!,
          description: s.description,
          order: i,
        }));

        // Gather all questions: unsectioned + section questions with sectionOrder
        const questionsToCreate: CreateChecklistQuestionDto[] = [];
        let globalOrder = 0;

        // Add unsectioned questions first
        unsectionedQuestions
          .filter((q) => q.title?.trim())
          .forEach((q) => {
            questionsToCreate.push({
              type: q.type!,
              title: q.title!,
              description: q.description,
              placeholder: q.placeholder,
              isRequired: q.isRequired,
              order: globalOrder++,
              options: q.options,
              validations: q.validations,
              metadata: q.metadata,
            });
          });

        // Add section questions with sectionOrder reference
        filteredSections.forEach((section, sectionIndex) => {
          if (section.id) {
            const questions = sectionQuestions[section.id] || [];
            questions
              .filter((q) => q.title?.trim())
              .forEach((q, qIndex) => {
                questionsToCreate.push({
                  sectionOrder: sectionIndex,
                  type: q.type!,
                  title: q.title!,
                  description: q.description,
                  placeholder: q.placeholder,
                  isRequired: q.isRequired,
                  order: qIndex,
                  options: q.options,
                  validations: q.validations,
                  metadata: q.metadata,
                });
              });
          }
        });

        const created = await createTemplateMutation.mutateAsync({
          name,
          description: description || undefined,
          isActive,
          sections: sectionsToCreate,
          questions: questionsToCreate,
        });

        router.push(`/checklists/${created.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar template');
    } finally {
      setIsSaving(false);
    }
  }, [
    name,
    description,
    isActive,
    sections,
    sectionQuestions,
    unsectionedQuestions,
    isEditing,
    template,
    router,
    createTemplateMutation,
    updateTemplateMutation,
    createSectionMutation,
    updateSectionMutation,
    createQuestionMutation,
    updateQuestionMutation,
  ]);

  return (
    <div className="space-y-6">
      {/* Error alert */}
      {error && (
        <Alert variant="error">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        </Alert>
      )}

      {/* Basic info */}
      <Card>
        <CardHeader>
          <CardTitle>Informações Básicas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField label="Nome do Template" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Checklist de Manutenção Preventiva"
            />
          </FormField>
          <FormField label="Descrição (opcional)">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o propósito deste checklist..."
              rows={3}
            />
          </FormField>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Template Ativo</p>
              <p className="text-xs text-gray-500">Templates inativos não aparecem para seleção</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </CardContent>
      </Card>

      {/* Sections */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Seções</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddSection}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Adicionar Seção
          </Button>
        </CardHeader>
        <CardContent>
          {sections.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed">
              <Settings className="h-12 w-12 mx-auto text-gray-400 mb-3" />
              <h3 className="text-gray-900 font-medium mb-1">Nenhuma seção criada</h3>
              <p className="text-gray-500 text-sm mb-4">
                Seções ajudam a organizar perguntas relacionadas
              </p>
              <Button
                variant="outline"
                onClick={handleAddSection}
                leftIcon={<Plus className="h-4 w-4" />}
              >
                Criar Primeira Seção
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {sections.map((section, index) => (
                <SectionEditor
                  key={section.id || index}
                  section={section}
                  questions={section.id ? sectionQuestions[section.id] || [] : []}
                  onSectionChange={(s) => handleUpdateSection(index, s)}
                  onQuestionChange={(qIndex, q) => handleUpdateQuestion(section.id || null, qIndex, q)}
                  onQuestionDelete={(qIndex) => handleDeleteQuestion(section.id || null, qIndex)}
                  onAddQuestion={() => handleAddQuestion(section.id || undefined)}
                  onDelete={() => handleDeleteSection(index)}
                  isNew={section.id?.startsWith('temp-')}
                  allQuestions={allQuestions}
                  allSections={sections}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Unsectioned questions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Perguntas Gerais</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAddQuestion()}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Adicionar Pergunta
          </Button>
        </CardHeader>
        <CardContent>
          {unsectionedQuestions.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed">
              <HelpCircle className="h-12 w-12 mx-auto text-gray-400 mb-3" />
              <h3 className="text-gray-900 font-medium mb-1">Nenhuma pergunta geral</h3>
              <p className="text-gray-500 text-sm mb-4">
                Perguntas que não pertencem a nenhuma seção específica
              </p>
              <Button
                variant="outline"
                onClick={() => handleAddQuestion()}
                leftIcon={<Plus className="h-4 w-4" />}
              >
                Criar Primeira Pergunta
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {unsectionedQuestions.map((question, index) => (
                <QuestionEditor
                  key={question.id || index}
                  question={question}
                  onChange={(q) => handleUpdateQuestion(null, index, q)}
                  onDelete={() => handleDeleteQuestion(null, index)}
                  isNew={question.id?.startsWith('temp-')}
                  allQuestions={allQuestions}
                  allSections={sections}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save button */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          disabled={isSaving}
          leftIcon={<Save className="h-4 w-4" />}
        >
          {isSaving ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Criar Template'}
        </Button>
      </div>
    </div>
  );
}

export default ChecklistTemplateForm;
