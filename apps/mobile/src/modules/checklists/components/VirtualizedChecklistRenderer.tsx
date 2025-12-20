// @ts-nocheck
/**
 * VirtualizedChecklistRenderer
 *
 * Renderizador de checklists otimizado para 500+ perguntas.
 * Usa FlashList para virtualização e performance.
 */

import React, { useCallback, useMemo, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Text } from '../../../design-system';
import { useColors, useSpacing } from '../../../design-system/ThemeProvider';
import { QuestionRenderer } from './QuestionRenderer';
import { ChecklistAnswer } from '../../../db/schema';
import { getApiBaseUrl } from '../../../config/api';

// =============================================================================
// TYPES
// =============================================================================

export interface ChecklistQuestion {
  id: string;
  title: string;
  description?: string;
  type: QuestionType;
  isRequired: boolean;
  order: number;
  sectionId?: string;
  options?: QuestionOption[];
  validations?: QuestionValidations;
  conditionalLogic?: ConditionalLogic;
}

export interface ChecklistSection {
  id: string;
  title: string;
  description?: string;
  order: number;
}

export type QuestionType =
  | 'TEXT_SHORT'
  | 'TEXT_LONG'
  | 'NUMBER'
  | 'CHECKBOX'
  | 'SELECT'
  | 'MULTI_SELECT'
  | 'DATE'
  | 'TIME'
  | 'DATETIME'
  | 'PHOTO'
  | 'PHOTO_REQUIRED'
  | 'PHOTO_OPTIONAL'
  | 'FILE_UPLOAD'
  | 'SIGNATURE'
  | 'SIGNATURE_TECHNICIAN'
  | 'SIGNATURE_CLIENT'
  | 'RATING'
  | 'SCALE'
  | 'SECTION_TITLE';

export interface QuestionOption {
  id: string;
  label: string;
  value: string;
}

export interface QuestionValidations {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  customMessage?: string;
}

export interface ConditionalLogic {
  rules: ConditionalRule[];
  logic: 'AND' | 'OR';
}

export interface ConditionalRule {
  questionId: string;
  operator: string;
  value: unknown;
}

export interface AnswerValue {
  valueText?: string;
  valueNumber?: number;
  valueBoolean?: boolean;
  valueDate?: string;
  valueJson?: unknown;
}

type ListItem =
  | { type: 'section'; data: ChecklistSection }
  | { type: 'question'; data: ChecklistQuestion; answer?: ChecklistAnswer };

export interface VirtualizedChecklistRendererProps {
  questions: ChecklistQuestion[];
  sections: ChecklistSection[];
  answers: Map<string, ChecklistAnswer>;
  onAnswerChange: (questionId: string, value: AnswerValue) => void;
  onPhotoCapture?: (questionId: string) => void;
  onSignatureCapture?: (questionId: string) => void;
  readOnly?: boolean;
  showProgress?: boolean;
}

// =============================================================================
// SECTION HEADER
// =============================================================================

const SectionHeader = React.memo(function SectionHeader({
  section,
}: {
  section: ChecklistSection;
}) {
  const colors = useColors();
  const spacing = useSpacing();

  return (
    <View
      style={[
        styles.sectionHeader,
        {
          backgroundColor: colors.background.secondary,
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[3],
          marginTop: spacing[2],
        },
      ]}
    >
      <Text variant="body" weight="semibold">
        {section.title}
      </Text>
      {section.description && (
        <Text variant="caption" color="secondary" style={{ marginTop: 4 }}>
          {section.description}
        </Text>
      )}
    </View>
  );
});

// =============================================================================
// QUESTION ITEM
// =============================================================================

const QuestionItem = React.memo(
  function QuestionItem({
    question,
    answer,
    onAnswerChange,
    onPhotoCapture,
    onSignatureCapture,
    readOnly,
  }: {
    question: ChecklistQuestion;
    answer?: ChecklistAnswer;
    onAnswerChange: (questionId: string, value: AnswerValue) => void;
    onPhotoCapture?: (questionId: string) => void;
    onSignatureCapture?: (questionId: string) => void;
    readOnly?: boolean;
  }) {
    const colors = useColors();
    const spacing = useSpacing();

    const handleChange = useCallback(
      (value: AnswerValue) => {
        onAnswerChange(question.id, value);
      },
      [question.id, onAnswerChange]
    );

    const handlePhotoCapture = useCallback(() => {
      onPhotoCapture?.(question.id);
    }, [question.id, onPhotoCapture]);

    const handleSignatureCapture = useCallback(() => {
      onSignatureCapture?.(question.id);
    }, [question.id, onSignatureCapture]);

    // Extrair valor da resposta
    const currentValue: AnswerValue = useMemo(() => {
      if (!answer) return {};

      // Para perguntas de foto, extrair URLs dos attachments se disponíveis
      let valueJson = answer.valueJson ? JSON.parse(answer.valueJson) : undefined;

      // Se tem attachments do servidor e é pergunta de foto, usar as URLs
      if (answer.attachments && answer.attachments.length > 0 &&
          (question.type === 'PHOTO' || question.type === 'PHOTO_REQUIRED' || question.type === 'PHOTO_OPTIONAL' || question.type === 'FILE_UPLOAD')) {
        // Extrair URLs públicas dos attachments
        // Se publicUrl começa com /, adicionar baseUrl da API
        const baseUrl = getApiBaseUrl();
        valueJson = answer.attachments.map((att: any) => {
          const url = att.publicUrl || att.storagePath;
          if (url && url.startsWith('/')) {
            return `${baseUrl}${url}`;
          }
          return url;
        }).filter(Boolean);
      }

      return {
        valueText: answer.valueText || undefined,
        valueNumber: answer.valueNumber || undefined,
        valueBoolean: answer.valueBoolean !== undefined ? Boolean(answer.valueBoolean) : undefined,
        valueDate: answer.valueDate || undefined,
        valueJson,
      };
    }, [answer, question.type]);

    return (
      <View
        style={[
          styles.questionItem,
          {
            padding: spacing[4],
            borderBottomWidth: 1,
            borderBottomColor: colors.border.light,
          },
        ]}
      >
        {/* Header da pergunta */}
        <View style={styles.questionHeader}>
          <Text variant="body" weight="medium">
            {question.title}
            {question.isRequired && (
              <Text variant="body" style={{ color: colors.error[500] }}>
                {' *'}
              </Text>
            )}
          </Text>
        </View>

        {/* Descricao */}
        {question.description && (
          <Text variant="caption" color="secondary" style={{ marginTop: 4, marginBottom: 8 }}>
            {question.description}
          </Text>
        )}

        {/* Renderizador especifico do tipo */}
        <View style={{ marginTop: spacing[2] }}>
          <QuestionRenderer
            type={question.type}
            value={currentValue}
            options={question.options}
            validations={question.validations}
            onChange={handleChange}
            onPhotoCapture={handlePhotoCapture}
            onSignatureCapture={handleSignatureCapture}
            readOnly={readOnly}
          />
        </View>
      </View>
    );
  },
  (prevProps, nextProps) => {
    // Otimizacao: so re-render se dados mudaram
    return (
      prevProps.question.id === nextProps.question.id &&
      prevProps.answer?.id === nextProps.answer?.id &&
      prevProps.answer?.updatedAt === nextProps.answer?.updatedAt &&
      prevProps.readOnly === nextProps.readOnly
    );
  }
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function VirtualizedChecklistRenderer({
  questions,
  sections,
  answers,
  onAnswerChange,
  onPhotoCapture,
  onSignatureCapture,
  readOnly = false,
  showProgress = true,
}: VirtualizedChecklistRendererProps) {
  const colors = useColors();
  const spacing = useSpacing();
  const listRef = useRef<FlashList<ListItem>>(null);

  // Criar lista combinada de secoes e perguntas
  const listItems: ListItem[] = useMemo(() => {
    const items: ListItem[] = [];

    // Mapear secoes por ID
    const sectionsMap = new Map(sections.map((s) => [s.id, s]));

    // Agrupar perguntas por secao
    const questionsBySection = new Map<string | undefined, ChecklistQuestion[]>();

    for (const question of questions) {
      // Ignorar SECTION_TITLE como tipo de pergunta (sera tratado como secao)
      if (question.type === 'SECTION_TITLE') continue;

      const sectionId = question.sectionId;
      if (!questionsBySection.has(sectionId)) {
        questionsBySection.set(sectionId, []);
      }
      questionsBySection.get(sectionId)!.push(question);
    }

    // Ordenar secoes
    const sortedSections = [...sections].sort((a, b) => a.order - b.order);

    // Adicionar perguntas sem secao primeiro
    const noSectionQuestions = questionsBySection.get(undefined) || [];
    for (const question of noSectionQuestions.sort((a, b) => a.order - b.order)) {
      items.push({
        type: 'question',
        data: question,
        answer: answers.get(question.id),
      });
    }

    // Adicionar secoes com suas perguntas
    for (const section of sortedSections) {
      items.push({ type: 'section', data: section });

      const sectionQuestions = questionsBySection.get(section.id) || [];
      for (const question of sectionQuestions.sort((a, b) => a.order - b.order)) {
        items.push({
          type: 'question',
          data: question,
          answer: answers.get(question.id),
        });
      }
    }

    // Filter duplicates to avoid key collision
    const seen = new Set<string>();
    return items.filter(item => {
      const key = item.type === 'section' ? `section-${item.data.id}` : `question-${item.data.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [questions, sections, answers]);

  // Calcular progresso
  const progress = useMemo(() => {
    const answerableQuestions = questions.filter((q) => q.type !== 'SECTION_TITLE');
    const answeredCount = answerableQuestions.filter((q) => answers.has(q.id)).length;
    return {
      answered: answeredCount,
      total: answerableQuestions.length,
      percentage: answerableQuestions.length > 0
        ? Math.round((answeredCount / answerableQuestions.length) * 100)
        : 0,
    };
  }, [questions, answers]);

  // Renderizar item
  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item.type === 'section') {
        return <SectionHeader section={item.data} />;
      }
      return (
        <QuestionItem
          question={item.data}
          answer={item.answer}
          onAnswerChange={onAnswerChange}
          onPhotoCapture={onPhotoCapture}
          onSignatureCapture={onSignatureCapture}
          readOnly={readOnly}
        />
      );
    },
    [onAnswerChange, onPhotoCapture, onSignatureCapture, readOnly]
  );

  // Key extractor
  const keyExtractor = useCallback((item: ListItem) => {
    return item.type === 'section' ? `section-${item.data.id}` : `question-${item.data.id}`;
  }, []);

  // Estimar tamanho do item para FlashList
  const getItemType = useCallback((item: ListItem) => {
    return item.type;
  }, []);

  return (
    <View style={styles.container}>
      {/* Progress bar */}
      {showProgress && (
        <View style={[styles.progressContainer, { backgroundColor: colors.background.secondary }]}>
          <View style={styles.progressInfo}>
            <Text variant="caption" color="secondary">
              {progress.answered} de {progress.total} respondidas
            </Text>
            <Text variant="caption" weight="semibold">
              {progress.percentage}%
            </Text>
          </View>
          <View style={[styles.progressBar, { backgroundColor: colors.border.light }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: colors.primary[500],
                  width: `${progress.percentage}%`,
                },
              ]}
            />
          </View>
        </View>
      )}

      {/* Lista virtualizada */}
      <FlashList
        ref={listRef}
        data={listItems}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemType={getItemType}
        estimatedItemSize={120}
        contentContainerStyle={{ paddingBottom: spacing[20] }}
      />
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  progressContainer: {
    padding: 16,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  sectionHeader: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  questionItem: {
    backgroundColor: '#FFFFFF',
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
});

export default VirtualizedChecklistRenderer;
