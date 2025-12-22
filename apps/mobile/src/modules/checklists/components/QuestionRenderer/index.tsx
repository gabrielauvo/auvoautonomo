// @ts-nocheck
/**
 * QuestionRenderer
 *
 * Factory component que renderiza o tipo correto de pergunta.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '../../../../design-system';
import { useColors } from '../../../../design-system/ThemeProvider';
import { TextQuestion } from './TextQuestion';
import { NumberQuestion } from './NumberQuestion';
import { CheckboxQuestion } from './CheckboxQuestion';
import { SelectQuestion } from './SelectQuestion';
import { DateTimeQuestion } from './DateTimeQuestion';
import { PhotoQuestion } from './PhotoQuestion';
import { SignatureQuestion } from './SignatureQuestion';
import { RatingQuestion } from './RatingQuestion';
import { ScaleQuestion } from './ScaleQuestion';
import type { QuestionType, QuestionOption, QuestionValidations, AnswerValue } from '../VirtualizedChecklistRenderer';

// =============================================================================
// TYPES
// =============================================================================

export interface QuestionRendererProps {
  type: QuestionType;
  value: AnswerValue;
  options?: QuestionOption[];
  validations?: QuestionValidations;
  onChange: (value: AnswerValue) => void;
  onPhotoCapture?: () => void;
  onSignatureCapture?: () => void;
  readOnly?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function QuestionRenderer({
  type,
  value,
  options,
  validations,
  onChange,
  onPhotoCapture,
  onSignatureCapture,
  readOnly = false,
}: QuestionRendererProps) {
  const colors = useColors();

  // Renderizar componente baseado no tipo
  switch (type) {
    case 'TEXT_SHORT':
      return (
        <TextQuestion
          value={value.valueText}
          onChange={(text) => onChange({ valueText: text })}
          multiline={false}
          maxLength={validations?.maxLength}
          readOnly={readOnly}
        />
      );

    case 'TEXT_LONG':
      return (
        <TextQuestion
          value={value.valueText}
          onChange={(text) => onChange({ valueText: text })}
          multiline={true}
          maxLength={validations?.maxLength}
          readOnly={readOnly}
        />
      );

    case 'NUMBER':
      return (
        <NumberQuestion
          value={value.valueNumber}
          onChange={(num) => onChange({ valueNumber: num })}
          min={validations?.min}
          max={validations?.max}
          readOnly={readOnly}
        />
      );

    case 'CHECKBOX':
      return (
        <CheckboxQuestion
          value={value.valueBoolean}
          onChange={(checked) => onChange({ valueBoolean: checked })}
          readOnly={readOnly}
        />
      );

    case 'SELECT':
      return (
        <SelectQuestion
          value={value.valueText}
          options={options || []}
          onChange={(selected) => onChange({ valueText: selected })}
          multiple={false}
          readOnly={readOnly}
        />
      );

    case 'MULTI_SELECT':
      return (
        <SelectQuestion
          value={value.valueJson as string[] | undefined}
          options={options || []}
          onChange={(selected) => onChange({ valueJson: selected })}
          multiple={true}
          readOnly={readOnly}
        />
      );

    case 'DATE':
      return (
        <DateTimeQuestion
          value={value.valueDate}
          onChange={(date) => onChange({ valueDate: date })}
          mode="date"
          readOnly={readOnly}
        />
      );

    case 'TIME':
      return (
        <DateTimeQuestion
          value={value.valueDate}
          onChange={(date) => onChange({ valueDate: date })}
          mode="time"
          readOnly={readOnly}
        />
      );

    case 'DATETIME':
      return (
        <DateTimeQuestion
          value={value.valueDate}
          onChange={(date) => onChange({ valueDate: date })}
          mode="datetime"
          readOnly={readOnly}
        />
      );

    case 'PHOTO':
    case 'PHOTO_REQUIRED':
    case 'PHOTO_OPTIONAL':
      return (
        <PhotoQuestion
          value={value.valueJson as string[] | undefined}
          onChange={(photos) => onChange({ valueJson: photos })}
          onCapture={onPhotoCapture}
          readOnly={readOnly}
        />
      );

    case 'SIGNATURE':
    case 'SIGNATURE_TECHNICIAN':
    case 'SIGNATURE_CLIENT':
      return (
        <SignatureQuestion
          value={value.valueText}
          onChange={(signature) => onChange({ valueText: signature })}
          onCapture={onSignatureCapture}
          readOnly={readOnly}
        />
      );

    case 'RATING':
      return (
        <RatingQuestion
          value={value.valueNumber}
          onChange={(rating) => onChange({ valueNumber: rating })}
          maxRating={5}
          readOnly={readOnly}
        />
      );

    case 'SCALE':
      return (
        <ScaleQuestion
          value={value.valueNumber}
          onChange={(scale) => onChange({ valueNumber: scale })}
          min={validations?.min || 0}
          max={validations?.max || 10}
          readOnly={readOnly}
        />
      );

    case 'SECTION_TITLE':
      // Nao renderiza nada - secoes sao tratadas separadamente
      return null;

    default:
      return (
        <View style={[styles.unsupported, { backgroundColor: colors.warning[50] }]}>
          <Text variant="caption" style={{ color: colors.warning[600] }}>
            Tipo de pergunta nao suportado: {type}
          </Text>
        </View>
      );
  }
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  unsupported: {
    padding: 12,
    borderRadius: 8,
  },
});

export default QuestionRenderer;
