/**
 * QuestionRenderers
 *
 * Componentes de renderização para cada tipo de pergunta de checklist.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ScrollView,
  Platform,
} from 'react-native';
import {
  ChecklistQuestion,
  ChecklistQuestionType,
  QuestionOption,
} from '../../../db/schema';

// =============================================================================
// TYPES
// =============================================================================

export interface QuestionRendererProps {
  question: ChecklistQuestion;
  value: unknown;
  onChange: (value: unknown) => void;
  isRequired: boolean;
  disabled?: boolean;
  error?: string;
}

// =============================================================================
// COMMON COMPONENTS
// =============================================================================

const QuestionLabel: React.FC<{
  title: string;
  description?: string;
  isRequired: boolean;
  error?: string;
}> = ({ title, description, isRequired, error }) => (
  <View style={styles.labelContainer}>
    <Text style={styles.label}>
      {title}
      {isRequired && <Text style={styles.required}> *</Text>}
    </Text>
    {description && <Text style={styles.description}>{description}</Text>}
    {error && <Text style={styles.error}>{error}</Text>}
  </View>
);

// =============================================================================
// TEXT RENDERERS
// =============================================================================

export const TextShortRenderer: React.FC<QuestionRendererProps> = ({
  question,
  value,
  onChange,
  isRequired,
  disabled,
  error,
}) => (
  <View style={styles.questionContainer}>
    <QuestionLabel
      title={question.title}
      description={question.description}
      isRequired={isRequired}
      error={error}
    />
    <TextInput
      style={[styles.textInput, disabled && styles.disabled]}
      value={value as string || ''}
      onChangeText={onChange}
      placeholder={question.placeholder || 'Digite sua resposta...'}
      editable={!disabled}
      maxLength={question.validations?.maxLength || 255}
    />
  </View>
);

export const TextLongRenderer: React.FC<QuestionRendererProps> = ({
  question,
  value,
  onChange,
  isRequired,
  disabled,
  error,
}) => (
  <View style={styles.questionContainer}>
    <QuestionLabel
      title={question.title}
      description={question.description}
      isRequired={isRequired}
      error={error}
    />
    <TextInput
      style={[styles.textArea, disabled && styles.disabled]}
      value={value as string || ''}
      onChangeText={onChange}
      placeholder={question.placeholder || 'Digite sua resposta...'}
      editable={!disabled}
      multiline
      numberOfLines={4}
      textAlignVertical="top"
      maxLength={question.validations?.maxLength || 2000}
    />
  </View>
);

// =============================================================================
// NUMBER RENDERER
// =============================================================================

export const NumberRenderer: React.FC<QuestionRendererProps> = ({
  question,
  value,
  onChange,
  isRequired,
  disabled,
  error,
}) => {
  const handleChange = useCallback((text: string) => {
    const num = parseFloat(text);
    if (text === '' || text === '-') {
      onChange(undefined);
    } else if (!isNaN(num)) {
      onChange(num);
    }
  }, [onChange]);

  return (
    <View style={styles.questionContainer}>
      <QuestionLabel
        title={question.title}
        description={question.description}
        isRequired={isRequired}
        error={error}
      />
      <TextInput
        style={[styles.textInput, styles.numberInput, disabled && styles.disabled]}
        value={value !== undefined && value !== null ? String(value) : ''}
        onChangeText={handleChange}
        placeholder={question.placeholder || 'Digite um número...'}
        editable={!disabled}
        keyboardType="numeric"
      />
      {question.validations && (
        <Text style={styles.hint}>
          {question.validations.min !== undefined && `Min: ${question.validations.min}`}
          {question.validations.min !== undefined && question.validations.max !== undefined && ' | '}
          {question.validations.max !== undefined && `Max: ${question.validations.max}`}
        </Text>
      )}
    </View>
  );
};

// =============================================================================
// CHECKBOX RENDERER
// =============================================================================

export const CheckboxRenderer: React.FC<QuestionRendererProps> = ({
  question,
  value,
  onChange,
  isRequired,
  disabled,
  error,
}) => (
  <View style={styles.questionContainer}>
    <View style={styles.checkboxRow}>
      <Switch
        value={Boolean(value)}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: '#767577', true: '#81b0ff' }}
        thumbColor={value ? '#2196F3' : '#f4f3f4'}
      />
      <View style={styles.checkboxLabel}>
        <Text style={styles.label}>
          {question.title}
          {isRequired && <Text style={styles.required}> *</Text>}
        </Text>
        {question.description && (
          <Text style={styles.description}>{question.description}</Text>
        )}
      </View>
    </View>
    {error && <Text style={styles.error}>{error}</Text>}
  </View>
);

// =============================================================================
// SELECT RENDERERS
// =============================================================================

export const SelectRenderer: React.FC<QuestionRendererProps> = ({
  question,
  value,
  onChange,
  isRequired,
  disabled,
  error,
}) => {
  const options = question.options || [];

  return (
    <View style={styles.questionContainer}>
      <QuestionLabel
        title={question.title}
        description={question.description}
        isRequired={isRequired}
        error={error}
      />
      <View style={styles.optionsContainer}>
        {options.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.optionButton,
              value === option.value && styles.optionButtonSelected,
              disabled && styles.disabled,
            ]}
            onPress={() => !disabled && onChange(option.value)}
            disabled={disabled}
          >
            <Text
              style={[
                styles.optionText,
                value === option.value && styles.optionTextSelected,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

export const MultiSelectRenderer: React.FC<QuestionRendererProps> = ({
  question,
  value,
  onChange,
  isRequired,
  disabled,
  error,
}) => {
  const options = question.options || [];
  const selectedValues = (value as string[]) || [];

  const toggleOption = useCallback((optionValue: string) => {
    if (disabled) return;

    const newValues = selectedValues.includes(optionValue)
      ? selectedValues.filter(v => v !== optionValue)
      : [...selectedValues, optionValue];

    onChange(newValues);
  }, [selectedValues, onChange, disabled]);

  return (
    <View style={styles.questionContainer}>
      <QuestionLabel
        title={question.title}
        description={question.description}
        isRequired={isRequired}
        error={error}
      />
      <View style={styles.optionsContainer}>
        {options.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.optionButton,
              selectedValues.includes(option.value) && styles.optionButtonSelected,
              disabled && styles.disabled,
            ]}
            onPress={() => toggleOption(option.value)}
            disabled={disabled}
          >
            <Text
              style={[
                styles.optionText,
                selectedValues.includes(option.value) && styles.optionTextSelected,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

// =============================================================================
// RATING RENDERER
// =============================================================================

export const RatingRenderer: React.FC<QuestionRendererProps> = ({
  question,
  value,
  onChange,
  isRequired,
  disabled,
  error,
}) => {
  const maxRating = question.metadata?.scaleMax || 5;
  const ratingType = question.metadata?.ratingType || 'stars';

  const renderItem = (index: number) => {
    const isSelected = (value as number) >= index + 1;
    const symbol = ratingType === 'emoji' ? '😊' : ratingType === 'numbers' ? String(index + 1) : '★';

    return (
      <TouchableOpacity
        key={index}
        style={[styles.ratingItem, disabled && styles.disabled]}
        onPress={() => !disabled && onChange(index + 1)}
        disabled={disabled}
      >
        <Text
          style={[
            styles.ratingSymbol,
            isSelected && styles.ratingSymbolSelected,
          ]}
        >
          {symbol}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.questionContainer}>
      <QuestionLabel
        title={question.title}
        description={question.description}
        isRequired={isRequired}
        error={error}
      />
      <View style={styles.ratingContainer}>
        {Array.from({ length: maxRating }, (_, i) => renderItem(i))}
      </View>
    </View>
  );
};

// =============================================================================
// SCALE RENDERER
// =============================================================================

export const ScaleRenderer: React.FC<QuestionRendererProps> = ({
  question,
  value,
  onChange,
  isRequired,
  disabled,
  error,
}) => {
  const min = question.metadata?.scaleMin || 1;
  const max = question.metadata?.scaleMax || 10;
  const labels = question.metadata?.scaleLabels;

  const scaleValues = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  return (
    <View style={styles.questionContainer}>
      <QuestionLabel
        title={question.title}
        description={question.description}
        isRequired={isRequired}
        error={error}
      />
      {labels && (
        <View style={styles.scaleLabels}>
          <Text style={styles.scaleLabelText}>{labels.min}</Text>
          <Text style={styles.scaleLabelText}>{labels.max}</Text>
        </View>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.scaleContainer}>
          {scaleValues.map((scaleValue) => (
            <TouchableOpacity
              key={scaleValue}
              style={[
                styles.scaleItem,
                value === scaleValue && styles.scaleItemSelected,
                disabled && styles.disabled,
              ]}
              onPress={() => !disabled && onChange(scaleValue)}
              disabled={disabled}
            >
              <Text
                style={[
                  styles.scaleText,
                  value === scaleValue && styles.scaleTextSelected,
                ]}
              >
                {scaleValue}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

// =============================================================================
// DATE/TIME RENDERERS (Placeholder - use date picker library)
// =============================================================================

export const DateRenderer: React.FC<QuestionRendererProps> = ({
  question,
  value,
  onChange,
  isRequired,
  disabled,
  error,
}) => {
  // In a real app, use @react-native-community/datetimepicker
  return (
    <View style={styles.questionContainer}>
      <QuestionLabel
        title={question.title}
        description={question.description}
        isRequired={isRequired}
        error={error}
      />
      <TouchableOpacity
        style={[styles.dateButton, disabled && styles.disabled]}
        disabled={disabled}
      >
        <Text style={styles.dateButtonText}>
          {value ? String(value) : 'Selecionar data...'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export const TimeRenderer: React.FC<QuestionRendererProps> = DateRenderer;
export const DateTimeRenderer: React.FC<QuestionRendererProps> = DateRenderer;

// =============================================================================
// SECTION TITLE RENDERER
// =============================================================================

export const SectionTitleRenderer: React.FC<{ question: ChecklistQuestion }> = ({
  question,
}) => (
  <View style={styles.sectionContainer}>
    <Text style={styles.sectionTitle}>{question.title}</Text>
    {question.description && (
      <Text style={styles.sectionDescription}>{question.description}</Text>
    )}
  </View>
);

// =============================================================================
// PHOTO/FILE PLACEHOLDER (implemented in task 5)
// =============================================================================

export const PhotoRenderer: React.FC<QuestionRendererProps> = ({
  question,
  value,
  onChange,
  isRequired,
  disabled,
  error,
}) => (
  <View style={styles.questionContainer}>
    <QuestionLabel
      title={question.title}
      description={question.description || question.metadata?.photoInstructions}
      isRequired={isRequired}
      error={error}
    />
    <TouchableOpacity
      style={[styles.photoButton, disabled && styles.disabled]}
      disabled={disabled}
    >
      <Text style={styles.photoButtonText}>📷 Tirar/Selecionar Foto</Text>
    </TouchableOpacity>
    {question.validations?.minPhotos && (
      <Text style={styles.hint}>
        Mínimo: {question.validations.minPhotos} foto(s)
      </Text>
    )}
  </View>
);

// =============================================================================
// SIGNATURE PLACEHOLDER (implemented in task 6)
// =============================================================================

export const SignatureRenderer: React.FC<QuestionRendererProps> = ({
  question,
  value,
  onChange,
  isRequired,
  disabled,
  error,
}) => (
  <View style={styles.questionContainer}>
    <QuestionLabel
      title={question.title}
      description={question.description || question.metadata?.signatureInstructions}
      isRequired={isRequired}
      error={error}
    />
    <TouchableOpacity
      style={[styles.signatureButton, disabled && styles.disabled]}
      disabled={disabled}
    >
      <Text style={styles.signatureButtonText}>✍️ Capturar Assinatura</Text>
    </TouchableOpacity>
  </View>
);

// =============================================================================
// RENDERER MAP
// =============================================================================

export const QUESTION_RENDERERS: Record<
  ChecklistQuestionType,
  React.FC<QuestionRendererProps>
> = {
  TEXT_SHORT: TextShortRenderer,
  TEXT_LONG: TextLongRenderer,
  NUMBER: NumberRenderer,
  DATE: DateRenderer,
  TIME: TimeRenderer,
  DATETIME: DateTimeRenderer,
  CHECKBOX: CheckboxRenderer,
  SELECT: SelectRenderer,
  MULTI_SELECT: MultiSelectRenderer,
  PHOTO_REQUIRED: PhotoRenderer,
  PHOTO_OPTIONAL: PhotoRenderer,
  SIGNATURE_TECHNICIAN: SignatureRenderer,
  SIGNATURE_CLIENT: SignatureRenderer,
  SECTION_TITLE: () => null, // Handled separately
  RATING: RatingRenderer,
  SCALE: ScaleRenderer,
};

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  questionContainer: {
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  labelContainer: {
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  required: {
    color: '#e74c3c',
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  error: {
    fontSize: 12,
    color: '#e74c3c',
    marginTop: 4,
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    minHeight: 100,
  },
  numberInput: {
    width: 150,
  },
  disabled: {
    opacity: 0.6,
    backgroundColor: '#f5f5f5',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxLabel: {
    flex: 1,
    marginLeft: 12,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  optionButtonSelected: {
    borderColor: '#2196F3',
    backgroundColor: '#e3f2fd',
  },
  optionText: {
    fontSize: 14,
    color: '#333',
  },
  optionTextSelected: {
    color: '#2196F3',
    fontWeight: '600',
  },
  ratingContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  ratingItem: {
    padding: 8,
  },
  ratingSymbol: {
    fontSize: 28,
    color: '#ddd',
  },
  ratingSymbolSelected: {
    color: '#ffc107',
  },
  scaleLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  scaleLabelText: {
    fontSize: 12,
    color: '#666',
  },
  scaleContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  scaleItem: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scaleItemSelected: {
    borderColor: '#2196F3',
    backgroundColor: '#2196F3',
  },
  scaleText: {
    fontSize: 14,
    color: '#333',
  },
  scaleTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  dateButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#333',
  },
  photoButton: {
    borderWidth: 2,
    borderColor: '#2196F3',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  photoButtonText: {
    fontSize: 16,
    color: '#2196F3',
  },
  signatureButton: {
    borderWidth: 2,
    borderColor: '#4caf50',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  signatureButtonText: {
    fontSize: 16,
    color: '#4caf50',
  },
  sectionContainer: {
    marginTop: 24,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f5f5f5',
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
});
