/**
 * ChecklistRenderer
 *
 * Componente principal para renderização de checklists.
 * Suporta lógica condicional, seções, e diferentes tipos de perguntas.
 */

import React, { useMemo, useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
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

const ProgressBar: React.FC<{ progress: number }> = ({ progress }) => (
  <View style={styles.progressContainer}>
    <View style={styles.progressBar}>
      <View style={[styles.progressFill, { width: `${progress}%` }]} />
    </View>
    <Text style={styles.progressText}>{progress}% completo</Text>
  </View>
);

const QuestionItem: React.FC<{
  item: QuestionWithVisibility;
  onAnswerChange: (value: unknown) => void;
  disabled: boolean;
}> = ({ item, onAnswerChange, disabled }) => {
  const { question, visibility, answer, error } = item;

  // Get renderer for question type
  const Renderer = QUESTION_RENDERERS[question.type];
  if (!Renderer) {
    return (
      <View style={styles.unsupportedQuestion}>
        <Text style={styles.unsupportedText}>
          Tipo não suportado: {question.type}
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
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const data = useChecklistData(instance, answers);

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

  // Handle complete
  const handleComplete = useCallback(() => {
    if (!data) return;

    // Validate all required questions
    const newErrors = new Map<string, string>();
    for (const q of data.missingQuestions) {
      newErrors.set(q.id, 'Campo obrigatório');
    }

    if (newErrors.size > 0) {
      setErrors(newErrors);
      return;
    }

    onComplete?.();
  }, [data, onComplete]);

  // Loading or error state
  if (!data) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Carregando checklist...</Text>
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
          {answeredQuestions} de {totalQuestions} perguntas respondidas
        </Text>
      </View>

      {/* Progress */}
      {showProgress && <ProgressBar progress={progress} />}

      {/* Questions */}
      <ScrollView style={styles.questionsContainer}>
        {/* Filter sections to avoid duplicate keys */}
        {sections.filter((section, index, self) =>
          index === self.findIndex(s => (s.section?.id || `unsectioned-${index}`) === (section.section?.id || `unsectioned-${index}`))
        ).map((section, sectionIndex) => (
          <View key={section.section?.id || `unsectioned-${sectionIndex}`}>
            {/* Section Header */}
            {section.section && (
              <SectionTitleRenderer
                question={{
                  id: section.section.id,
                  type: 'SECTION_TITLE',
                  title: section.section.title,
                  description: section.section.description,
                  isRequired: false,
                  order: section.section.order,
                }}
              />
            )}

            {/* Questions - filter duplicates to avoid key collision */}
            {section.questions.filter((item, index, self) =>
              index === self.findIndex(q => q.question.id === item.question.id)
            ).map((item) => {
              // Skip section titles (rendered above)
              if (item.question.type === 'SECTION_TITLE') return null;

              return (
                <QuestionItem
                  key={item.question.id}
                  item={{
                    ...item,
                    error: errors.get(item.question.id),
                  }}
                  onAnswerChange={(value) => handleAnswerChange(item.question.id, value)}
                  disabled={disabled || instance.status === 'COMPLETED' || instance.status === 'CANCELLED'}
                />
              );
            })}
          </View>
        ))}

        {/* Spacer for bottom buttons */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Actions */}
      {instance.status !== 'COMPLETED' && instance.status !== 'CANCELLED' && (
        <View style={styles.actionsContainer}>
          {onSave && (
            <TouchableOpacity
              style={[styles.button, styles.saveButton]}
              onPress={onSave}
              disabled={disabled}
            >
              <Text style={styles.saveButtonText}>Salvar Rascunho</Text>
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
                {isComplete ? 'Finalizar Checklist' : 'Preencha os campos obrigatórios'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Completed Badge */}
      {instance.status === 'COMPLETED' && (
        <View style={styles.completedBadge}>
          <Text style={styles.completedText}>✓ Checklist Finalizado</Text>
          {instance.completedAt && (
            <Text style={styles.completedDate}>
              {new Date(instance.completedAt).toLocaleDateString('pt-BR')}
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
