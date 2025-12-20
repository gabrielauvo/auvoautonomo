'use client';

/**
 * ChecklistSection - Seção de checklist da OS
 *
 * Exibe e permite preencher checklists:
 * - Tipos: TEXT, NUMERIC, BOOLEAN, PHOTO, SELECT
 * - Campos obrigatórios marcados
 * - Modo edição e visualização
 */

import { useState } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Textarea,
  FormField,
  Badge,
  Skeleton,
  Alert,
} from '@/components/ui';
import {
  ClipboardCheck,
  CheckCircle,
  Circle,
  Camera,
  ChevronDown,
  ChevronUp,
  Save,
  AlertCircle,
} from 'lucide-react';
import {
  WorkOrderChecklist,
  ChecklistTemplateItem,
  ChecklistAnswer,
  ChecklistAnswerDto,
  ChecklistItemType,
} from '@/services/work-orders.service';
import { cn } from '@/lib/utils';

interface ChecklistSectionProps {
  checklist: WorkOrderChecklist;
  isEditable?: boolean;
  isLoading?: boolean;
  onSubmitAnswers?: (answers: ChecklistAnswerDto[]) => Promise<void>;
}

// Componente para item do tipo BOOLEAN
function BooleanItem({
  item,
  value,
  onChange,
  disabled,
}: {
  item: ChecklistTemplateItem;
  value: boolean | undefined;
  onChange: (value: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-700">{item.label}</span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(true)}
          className={cn(
            'flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
            value === true
              ? 'bg-success-100 text-success'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          )}
        >
          <CheckCircle className="h-4 w-4" />
          Sim
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(false)}
          className={cn(
            'flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
            value === false
              ? 'bg-error-100 text-error'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          )}
        >
          <Circle className="h-4 w-4" />
          Não
        </button>
      </div>
    </div>
  );
}

// Componente para item do tipo TEXT
function TextItem({
  item,
  value,
  onChange,
  disabled,
}: {
  item: ChecklistTemplateItem;
  value: string | undefined;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <FormField
      label={
        <span className="flex items-center gap-1">
          {item.label}
          {item.isRequired && <span className="text-error">*</span>}
        </span>
      }
    >
      <Textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Digite sua resposta..."
        rows={2}
        disabled={disabled}
      />
    </FormField>
  );
}

// Componente para item do tipo NUMERIC
function NumericItem({
  item,
  value,
  onChange,
  disabled,
}: {
  item: ChecklistTemplateItem;
  value: number | undefined;
  onChange: (value: number) => void;
  disabled: boolean;
}) {
  return (
    <FormField
      label={
        <span className="flex items-center gap-1">
          {item.label}
          {item.isRequired && <span className="text-error">*</span>}
        </span>
      }
    >
      <Input
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        placeholder="0"
        disabled={disabled}
      />
    </FormField>
  );
}

// Componente para item do tipo SELECT
function SelectItem({
  item,
  value,
  onChange,
  disabled,
}: {
  item: ChecklistTemplateItem;
  value: string | undefined;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <FormField
      label={
        <span className="flex items-center gap-1">
          {item.label}
          {item.isRequired && <span className="text-error">*</span>}
        </span>
      }
    >
      <div className="flex flex-wrap gap-2">
        {item.options?.map((option) => (
          <button
            key={option}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
              value === option
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </FormField>
  );
}

// Componente para item do tipo PHOTO
function PhotoItem({
  item,
  value,
  onChange,
  disabled,
}: {
  item: ChecklistTemplateItem;
  value: string | undefined;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <FormField
      label={
        <span className="flex items-center gap-1">
          {item.label}
          {item.isRequired && <span className="text-error">*</span>}
        </span>
      }
    >
      <div className="space-y-2">
        {value && (
          <div className="relative w-32 h-32 rounded-lg overflow-hidden border">
            <img
              src={value}
              alt="Foto"
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          leftIcon={<Camera className="h-4 w-4" />}
          onClick={() => {
            // TODO: Implementar captura/upload de foto
            const url = prompt('URL da foto:');
            if (url) onChange(url);
          }}
        >
          {value ? 'Trocar foto' : 'Adicionar foto'}
        </Button>
      </div>
    </FormField>
  );
}

export function ChecklistSection({
  checklist,
  isEditable = false,
  isLoading = false,
  onSubmitAnswers,
}: ChecklistSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [answers, setAnswers] = useState<Record<string, ChecklistAnswerDto>>(() => {
    // Inicializa com respostas existentes
    const initial: Record<string, ChecklistAnswerDto> = {};
    checklist.answers?.forEach((answer) => {
      initial[answer.templateItemId] = {
        templateItemId: answer.templateItemId,
        type: answer.type,
        valueText: answer.valueText,
        valueNumber: answer.valueNumber,
        valueBoolean: answer.valueBoolean,
        valuePhoto: answer.valuePhoto,
        valueSelect: answer.valueSelect,
      };
    });
    return initial;
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const template = checklist.template;
  const items = template?.items || [];

  // Atualizar resposta
  const updateAnswer = (itemId: string, type: ChecklistItemType, value: unknown) => {
    setAnswers((prev) => ({
      ...prev,
      [itemId]: {
        templateItemId: itemId,
        type,
        ...(type === 'TEXT' && { valueText: value as string }),
        ...(type === 'NUMERIC' && { valueNumber: value as number }),
        ...(type === 'BOOLEAN' && { valueBoolean: value as boolean }),
        ...(type === 'PHOTO' && { valuePhoto: value as string }),
        ...(type === 'SELECT' && { valueSelect: value as string }),
      },
    }));
  };

  // Validar campos obrigatórios
  const validateRequired = (): boolean => {
    for (const item of items) {
      if (item.isRequired) {
        const answer = answers[item.id];
        if (!answer) return false;

        switch (item.type) {
          case 'TEXT':
            if (!answer.valueText?.trim()) return false;
            break;
          case 'NUMERIC':
            if (answer.valueNumber === undefined) return false;
            break;
          case 'BOOLEAN':
            if (answer.valueBoolean === undefined) return false;
            break;
          case 'PHOTO':
            if (!answer.valuePhoto) return false;
            break;
          case 'SELECT':
            if (!answer.valueSelect) return false;
            break;
        }
      }
    }
    return true;
  };

  // Salvar respostas
  const handleSave = async () => {
    if (!validateRequired()) {
      setError('Preencha todos os campos obrigatórios');
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      await onSubmitAnswers?.(Object.values(answers));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setIsSaving(false);
    }
  };

  // Contar respostas preenchidas
  const answeredCount = Object.keys(answers).length;
  const totalCount = items.length;
  const progress = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-3">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">
                {template?.title || 'Checklist'}
              </CardTitle>
              {template?.description && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {template.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={progress === 100 ? 'soft-success' : 'soft-gray'}>
              {answeredCount}/{totalCount}
            </Badge>
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-400" />
            )}
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          {/* Barra de progresso */}
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                progress === 100 ? 'bg-success' : 'bg-primary'
              )}
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Erro */}
          {error && (
            <Alert variant="error">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            </Alert>
          )}

          {/* Itens do checklist */}
          <div className="space-y-4">
            {items
              .sort((a, b) => a.order - b.order)
              .map((item) => {
                const answer = answers[item.id];

                return (
                  <div
                    key={item.id}
                    className="p-3 bg-gray-50 rounded-lg"
                  >
                    {item.type === 'BOOLEAN' && (
                      <BooleanItem
                        item={item}
                        value={answer?.valueBoolean}
                        onChange={(v) => updateAnswer(item.id, 'BOOLEAN', v)}
                        disabled={!isEditable}
                      />
                    )}
                    {item.type === 'TEXT' && (
                      <TextItem
                        item={item}
                        value={answer?.valueText}
                        onChange={(v) => updateAnswer(item.id, 'TEXT', v)}
                        disabled={!isEditable}
                      />
                    )}
                    {item.type === 'NUMERIC' && (
                      <NumericItem
                        item={item}
                        value={answer?.valueNumber}
                        onChange={(v) => updateAnswer(item.id, 'NUMERIC', v)}
                        disabled={!isEditable}
                      />
                    )}
                    {item.type === 'SELECT' && (
                      <SelectItem
                        item={item}
                        value={answer?.valueSelect}
                        onChange={(v) => updateAnswer(item.id, 'SELECT', v)}
                        disabled={!isEditable}
                      />
                    )}
                    {item.type === 'PHOTO' && (
                      <PhotoItem
                        item={item}
                        value={answer?.valuePhoto}
                        onChange={(v) => updateAnswer(item.id, 'PHOTO', v)}
                        disabled={!isEditable}
                      />
                    )}
                  </div>
                );
              })}
          </div>

          {/* Botão salvar */}
          {isEditable && onSubmitAnswers && (
            <div className="flex justify-end pt-2">
              <Button
                onClick={handleSave}
                loading={isSaving}
                leftIcon={<Save className="h-4 w-4" />}
              >
                Salvar Respostas
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default ChecklistSection;
