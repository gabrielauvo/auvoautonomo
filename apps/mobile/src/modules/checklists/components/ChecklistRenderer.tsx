/**
 * ChecklistRenderer
 *
 * Componente principal para renderização de checklists.
 * Suporta lógica condicional, seções, e diferentes tipos de perguntas.
 */

import React, { useMemo, useCallback, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useTranslation, useLocale } from '../../../i18n';
import {
  ChecklistTemplate,
  ChecklistInstance,
  ChecklistAnswer,
  ChecklistQuestion,
  ChecklistSection,
} from '../../../db/schema';
import {
  evaluateAllQuestions,
  calculateProgress,
  areAllRequiredAnswered,
  QuestionVisibility,
} from './ConditionalLogicEvaluator';
import {
  QUESTION_RENDERERS,
  SectionTitleRenderer,
  QuestionRendererProps,
} from './QuestionRenderers';
import { getAnswerValue, setAnswerValue, validateAnswer } from '../ChecklistAnswerSyncConfig';

// =============================================================================
// TYPES
// =============================================================================

export interface ChecklistRendererProps {
  instance: ChecklistInstance;
  answers: ChecklistAnswer[];
  onAnswerChange: (questionId: string, value: unknown) => void;
  onComplete?: () => void;
  onSave?: () => void;
  disabled?: boolean;
  showProgress?: boolean;
}

interface QuestionWithVisibility {
  question: ChecklistQuestion;
  visibility: QuestionVisibility;
  answer?: ChecklistAnswer;
  error?: string;
}

interface SectionWithQuestions {
  section?: ChecklistSection;
  questions: QuestionWithVisibility[];
}

// Tipo para itens da lista virtualizada
type ListItem =
  | { type: 'section'; data: ChecklistSection }
  | { type: 'question'; data: QuestionWithVisibility };

// =============================================================================
// HOOKS
// =============================================================================

function useChecklistData(instance: ChecklistInstance, answers: ChecklistAnswer[]) {
  return useMemo(() => {
    // Parse template snapshot
    let template: ChecklistTemplate;
    try {
      template = JSON.parse(instance.templateVersionSnapshot) as ChecklistTemplate;
    } catch {
      return null;
    }

    // Build answers map
    const answersMap = new Map<string, ChecklistAnswer>();
    answers.forEach(a => answersMap.set(a.questionId, a));

    // Evaluate visibility
    const visibilityMap = evaluateAllQuestions(template.questions, answersMap);

    // Calculate progress
    const progress = calculateProgress(template.questions, answersMap);

    // Group questions by section
    const sections: SectionWithQuestions[] = [];
    const questionsBySection = new Map<string | undefined, QuestionWithVisibility[]>();

    // Sort questions by order
    const sortedQuestions = [...template.questions].sort((a, b) => a.order - b.order);

    for (const question of sortedQuestions) {
      const sectionId = question.sectionId;
      const visibility = visibilityMap.get(question.id) || { visible: true, required: question.isRequired };

      // Skip hidden questions
      if (!visibility.visible) continue;

      const questionWithVisibility: QuestionWithVisibility = {
        question,
        visibility,
        answer: answersMap.get(question.id),
      };

      if (!questionsBySection.has(sectionId)) {
        questionsBySection.set(sectionId, []);
      }
      questionsBySection.get(sectionId)!.push(questionWithVisibility);
    }

    // Build sections array
    const sortedSections = [...(template.sections || [])].sort((a, b) => a.order - b.order);

    // Add unsectioned questions first
    const unsectionedQuestions = questionsBySection.get(undefined);
    if (unsectionedQuestions && unsectionedQuestions.length > 0) {
      sections.push({ questions: unsectionedQuestions });
    }

    // Add sectioned questions
    for (const section of sortedSections) {
      const sectionQuestions = questionsBySection.get(section.id);
      if (sectionQuestions && sectionQuestions.length > 0) {
        sections.push({ section, questions: sectionQuestions });
      }
    }

    // Check completion
    const { complete, missingQuestions } = areAllRequiredAnswered(template.questions, answersMap);

    return {
      template,
      sections,
      progress,
      isComplete: complete,
      missingQuestions,
      totalQuestions: sortedQuestions.filter(q => q.type !== 'SECTION_TITLE').length,
      answeredQuestions: answers.filter(a => {
        const q = template.questions.find(q => q.id === a.questionId);
        if (!q || q.type === 'SECTION_TITLE') return false;
        const v = getAnswerValue(a);
        return v !== null && v !== undefined && v !== '';
      }).length,
    };
  }, [instance.templateVersionSnapshot, answers]);
}

// =============================================================================
// COMPONENTS
// =============================================================================

const ProgressBar: React.FC<{ progress: number; progressLabel: string }> = ({ progress, progressLabel }) => (
  <View style={styles.progressContainer}>
    <View style={styles.progressBar}>
      <View style={[styles.progressFill, { width: `${progress}%` }]} />
    </View>
    <Text style={styles.progressText}>{progressLabel}</Text>
  </View>
);

const QuestionItem: React.FC<{
  item: QuestionWithVisibility;
  onAnswerChange: (value: unknown) => void;
  disabled: boolean;
  unsupportedTypeMessage: string;
}> = ({ item, onAnswerChange, disabled, unsupportedTypeMessage }) => {
  const { question, visibility, answer, error } = item;

  // Get renderer for question type
  const Renderer = QUESTION_RENDERERS[question.type];
  if (!Renderer) {
    return (
      <View style={styles.unsupportedQuestion}>
        <Text style={styles.unsupportedText}>
          {unsupportedTypeMessage}
        </Text>
      </View>
    );
  }

  // Get current value
  const value = answer ? getAnswerValue(answer) : undefined;

  return (
    <Renderer
      question={question}
      value={value}
      onChange={onAnswerChange}
      isRequired={visibility.required}
      disabled={disabled}
      error={error}
    />
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const ChecklistRenderer: React.FC<ChecklistRendererProps> = ({
  instance,
  answers,
  onAnswerChange,
  onComplete,
  onSave,
  disabled = false,
  showProgress = true,
}) => {
  const { t } = useTranslation();
  const locale = useLocale();
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const data = useChecklistData(instance, answers);

  // Flatten sections into list items for FlashList
  const listItems: ListItem[] = useMemo(() => {
    if (!data) return [];

    const items: ListItem[] = [];
    const seen = new Set<string>();

    for (const section of data.sections) {
      // Add section header if exists
      if (section.section) {
        const sectionKey = `section-${section.section.id}`;
        if (!seen.has(sectionKey)) {
          seen.add(sectionKey);
          items.push({ type: 'section', data: section.section });
        }
      }

      // Add questions
      for (const questionItem of section.questions) {
        if (questionItem.question.type === 'SECTION_TITLE') continue;

        const questionKey = `question-${questionItem.question.id}`;
        if (!seen.has(questionKey)) {
          seen.add(questionKey);
          items.push({
            type: 'question',
            data: {
              ...questionItem,
              error: errors.get(questionItem.question.id),
            },
          });
        }
      }
    }

    return items;
  }, [data, errors]);

  // Handle answer change
  const handleAnswerChange = useCallback((questionId: string, value: unknown) => {
    // Clear error for this question
    setErrors(prev => {
      const next = new Map(prev);
      next.delete(questionId);
      return next;
    });

    onAnswerChange(questionId, value);
  }, [onAnswerChange]);

  // Render item for FlashList
  const renderListItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item.type === 'section') {
        return (
          <SectionTitleRenderer
            question={{
              id: item.data.id,
              type: 'SECTION_TITLE',
              title: item.data.title,
              description: item.data.description,
              isRequired: false,
              order: item.data.order,
            }}
          />
        );
      }

      return (
        <QuestionItem
          item={item.data}
          onAnswerChange={(value) => handleAnswerChange(item.data.question.id, value)}
          disabled={disabled || instance.status === 'COMPLETED' || instance.status === 'CANCELLED'}
          unsupportedTypeMessage={t('checklists.unsupportedType', { type: item.data.question.type })}
        />
      );
    },
    [disabled, instance.status, t, handleAnswerChange]
  );

  // Key extractor for FlashList
  const keyExtractor = useCallback((item: ListItem) => {
    return item.type === 'section' ? `section-${item.data.id}` : `question-${item.data.question.id}`;
  }, []);

  // Get item type for FlashList optimization
  const getItemType = useCallback((item: ListItem) => {
    return item.type;
  }, []);

  // Handle complete
  const handleComplete = useCallback(() => {
    if (!data) return;

    // Validate all required questions
    const newErrors = new Map<string, string>();
    for (const q of data.missingQuestions) {
      newErrors.set(q.id, t('checklists.requiredField'));
    }

    if (newErrors.size > 0) {
      setErrors(newErrors);
      return;
    }

    onComplete?.();
  }, [data, onComplete, t]);

  // Loading or error state
  if (!data) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>{t('checklists.loadingChecklist')}</Text>
      </View>
    );
  }

  const { template, sections, progress, isComplete, answeredQuestions, totalQuestions } = data;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{template.name}</Text>
        {template.description && (
          <Text style={styles.subtitle}>{template.description}</Text>
        )}
        <Text style={styles.stats}>
          {t('checklists.questionsAnswered', { answered: answeredQuestions, total: totalQuestions })}
        </Text>
      </View>

      {/* Progress */}
      {showProgress && <ProgressBar progress={progress} progressLabel={t('checklists.progressComplete', { progress })} />}

      {/* Questions - Virtualized FlashList for performance */}
      <FlashList
        data={listItems}
        renderItem={renderListItem}
        keyExtractor={keyExtractor}
        getItemType={getItemType}
        estimatedItemSize={120}
        contentContainerStyle={{ paddingBottom: 100 }}
        extraData={errors}
      />

      {/* Actions */}
      {instance.status !== 'COMPLETED' && instance.status !== 'CANCELLED' && (
        <View style={styles.actionsContainer}>
          {onSave && (
            <TouchableOpacity
              style={[styles.button, styles.saveButton]}
              onPress={onSave}
              disabled={disabled}
            >
              <Text style={styles.saveButtonText}>{t('checklists.saveDraft')}</Text>
            </TouchableOpacity>
          )}

          {onComplete && (
            <TouchableOpacity
              style={[
                styles.button,
                styles.completeButton,
                !isComplete && styles.completeButtonDisabled,
              ]}
              onPress={handleComplete}
              disabled={disabled}
            >
              <Text style={styles.completeButtonText}>
                {isComplete ? t('checklists.finishChecklist') : t('checklists.fillRequiredFields')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Completed Badge */}
      {instance.status === 'COMPLETED' && (
        <View style={styles.completedBadge}>
          <Text style={styles.completedText}>{t('checklists.checklistCompleted')}</Text>
          {instance.completedAt && (
            <Text style={styles.completedDate}>
              {new Date(instance.completedAt).toLocaleDateString(locale.locale)}
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  stats: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
  progressContainer: {
    padding: 16,
    backgroundColor: '#f8f9fa',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4caf50',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  questionsContainer: {
    flex: 1,
  },
  unsupportedQuestion: {
    padding: 16,
    backgroundColor: '#fff3cd',
    margin: 16,
    borderRadius: 8,
  },
  unsupportedText: {
    color: '#856404',
  },
  actionsContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  saveButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  completeButton: {
    backgroundColor: '#4caf50',
  },
  completeButtonDisabled: {
    backgroundColor: '#bdbdbd',
  },
  completeButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  completedBadge: {
    padding: 16,
    backgroundColor: '#e8f5e9',
    alignItems: 'center',
  },
  completedText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4caf50',
  },
  completedDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
});

export default ChecklistRenderer;
