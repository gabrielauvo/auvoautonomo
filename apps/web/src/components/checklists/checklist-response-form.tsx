'use client';

/**
 * Checklist Response Form
 *
 * Componente para responder checklists anexados a uma OS.
 * Suporta todos os 17 tipos de perguntas e upload de fotos/arquivos.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Textarea,
  Badge,
  Alert,
  Switch,
  Select,
  FormField,
} from '@/components/ui';
import {
  Save,
  Check,
  AlertCircle,
  Camera,
  Upload,
  Trash2,
  ChevronDown,
  ChevronRight,
  Clock,
  CheckCircle2,
  Circle,
  Star,
  Image,
  FileText,
  PenTool,
} from 'lucide-react';
import {
  useChecklistInstance,
  useSubmitChecklistAnswer,
  useSubmitChecklistAnswersBatch,
  useUpdateChecklistInstanceStatus,
  useCompleteChecklist,
} from '@/hooks/use-checklists';
import {
  ChecklistInstance,
  ChecklistQuestion,
  ChecklistAnswer,
  ChecklistQuestionType,
  SubmitAnswerDto,
} from '@/services/checklists.service';

// ============================================
// TYPES
// ============================================

interface ChecklistResponseFormProps {
  instanceId: string;
  workOrderId: string;
  onComplete?: () => void;
  readOnly?: boolean;
}

interface PhotoAttachment {
  id: string;
  publicUrl?: string;
  thumbnailUrl?: string;
  fileName: string;
}

// Helper para construir URL de foto
function getPhotoUrl(urlOrPath?: string): string | undefined {
  if (!urlOrPath) return undefined;
  // Se já é URL absoluta, usar diretamente
  if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
    return urlOrPath;
  }
  // Se é path relativo, adicionar baseUrl
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  return `${baseUrl}${urlOrPath.startsWith('/') ? urlOrPath : `/${urlOrPath}`}`;
}

interface AnswerState {
  [questionId: string]: {
    value: unknown;
    notes?: string;
    attachments?: PhotoAttachment[];
  };
}

// ============================================
// QUESTION INPUT COMPONENTS
// ============================================

interface QuestionInputProps {
  question: ChecklistQuestion;
  value: unknown;
  notes?: string;
  attachments?: PhotoAttachment[];
  onChange: (value: unknown, notes?: string) => void;
  readOnly?: boolean;
}

function TextShortInput({ question, value, onChange, readOnly }: QuestionInputProps) {
  return (
    <Input
      value={(value as string) || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={question.placeholder || 'Digite sua resposta...'}
      disabled={readOnly}
    />
  );
}

function TextLongInput({ question, value, onChange, readOnly }: QuestionInputProps) {
  return (
    <Textarea
      value={(value as string) || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={question.placeholder || 'Digite sua resposta...'}
      rows={4}
      disabled={readOnly}
    />
  );
}

function NumberInput({ question, value, onChange, readOnly }: QuestionInputProps) {
  return (
    <Input
      type="number"
      value={(value as number)?.toString() || ''}
      onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : null)}
      placeholder={question.placeholder || '0'}
      disabled={readOnly}
    />
  );
}

function DateInput({ question, value, onChange, readOnly }: QuestionInputProps) {
  return (
    <Input
      type="date"
      value={(value as string) || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={readOnly}
    />
  );
}

function TimeInput({ question, value, onChange, readOnly }: QuestionInputProps) {
  return (
    <Input
      type="time"
      value={(value as string) || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={readOnly}
    />
  );
}

function DateTimeInput({ question, value, onChange, readOnly }: QuestionInputProps) {
  return (
    <Input
      type="datetime-local"
      value={(value as string) || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={readOnly}
    />
  );
}

function CheckboxInput({ question, value, onChange, readOnly }: QuestionInputProps) {
  return (
    <div className="flex items-center gap-3">
      <Switch
        checked={(value as boolean) || false}
        onCheckedChange={(checked) => onChange(checked)}
        disabled={readOnly}
      />
      <span className="text-sm text-gray-600">
        {(value as boolean) ? 'Sim' : 'Não'}
      </span>
    </div>
  );
}

function SelectInput({ question, value, onChange, readOnly }: QuestionInputProps) {
  const options = question.options || [];
  return (
    <Select
      value={(value as string) || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={readOnly}
    >
      <option value="">Selecione uma opção...</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </Select>
  );
}

function MultiSelectInput({ question, value, onChange, readOnly }: QuestionInputProps) {
  const options = question.options || [];
  const selectedValues = (value as string[]) || [];

  const toggleOption = (optValue: string) => {
    if (readOnly) return;
    const newValues = selectedValues.includes(optValue)
      ? selectedValues.filter((v) => v !== optValue)
      : [...selectedValues, optValue];
    onChange(newValues);
  };

  return (
    <div className="space-y-2">
      {options.map((opt) => (
        <label
          key={opt.value}
          className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
            selectedValues.includes(opt.value)
              ? 'border-primary bg-primary-50'
              : 'border-gray-200 hover:bg-gray-50'
          } ${readOnly ? 'cursor-not-allowed opacity-60' : ''}`}
          onClick={() => toggleOption(opt.value)}
        >
          <div
            className={`w-5 h-5 rounded border flex items-center justify-center ${
              selectedValues.includes(opt.value)
                ? 'bg-primary border-primary text-white'
                : 'border-gray-300'
            }`}
          >
            {selectedValues.includes(opt.value) && <Check className="h-3 w-3" />}
          </div>
          <span className="text-sm">{opt.label}</span>
        </label>
      ))}
    </div>
  );
}

function RatingInput({ question, value, onChange, readOnly }: QuestionInputProps) {
  const rating = (value as number) || 0;
  const maxRating = 5;

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: maxRating }).map((_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => !readOnly && onChange(i + 1)}
          disabled={readOnly}
          className={`p-1 transition-colors ${readOnly ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <Star
            className={`h-8 w-8 ${
              i < rating
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-300'
            }`}
          />
        </button>
      ))}
      <span className="ml-2 text-sm text-gray-500">
        {rating > 0 ? `${rating}/5` : 'Não avaliado'}
      </span>
    </div>
  );
}

function ScaleInput({ question, value, onChange, readOnly }: QuestionInputProps) {
  const metadata = question.metadata || {};
  const min = metadata.scaleMin ?? 1;
  const max = metadata.scaleMax ?? 10;
  const labels = metadata.scaleLabels;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-gray-500">
        <span>{labels?.min || `${min}`}</span>
        <span>{labels?.max || `${max}`}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={(value as number) || min}
        onChange={(e) => onChange(parseInt(e.target.value))}
        disabled={readOnly}
        className="w-full"
      />
      <div className="text-center">
        <span className="text-lg font-semibold text-primary">
          {(value as number) || min}
        </span>
      </div>
    </div>
  );
}

function PhotoInput({ question, value, attachments, onChange, readOnly }: QuestionInputProps) {
  // valueJson pode conter URLs remotas ou caminhos locais
  const valuePhotos = (value as string[]) || [];
  // Separar fotos remotas (URLs http/https) das locais (file://)
  const remotePhotosFromValue = valuePhotos.filter((p) => p.startsWith('http://') || p.startsWith('https://'));
  // Use attachments from server if available
  const serverPhotos = attachments || [];

  // Só mostrar fotos locais se NÃO temos attachments do servidor
  // (quando há attachments, as fotos já foram sincronizadas)
  const localPhotos = serverPhotos.length > 0
    ? []
    : valuePhotos.filter((p) => !p.startsWith('http://') && !p.startsWith('https://'));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // For now, just store file names - actual upload would be handled separately
    const newPhotos = Array.from(files).map((f) => f.name);
    onChange([...valuePhotos, ...newPhotos]);
  };

  const removePhoto = (index: number) => {
    const newPhotos = localPhotos.filter((_, i) => i !== index);
    onChange([...remotePhotosFromValue, ...newPhotos]);
  };

  const hasPhotos = serverPhotos.length > 0 || remotePhotosFromValue.length > 0 || localPhotos.length > 0;

  return (
    <div className="space-y-3">
      {hasPhotos && (
        <div className="grid grid-cols-3 gap-2">
          {/* Fotos do servidor (attachments) */}
          {serverPhotos.map((photo, index) => {
            const photoUrl = getPhotoUrl(photo.publicUrl) || getPhotoUrl(photo.thumbnailUrl);
            return (
              <div
                key={`server-${photo.id}`}
                className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden"
              >
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt={photo.fileName || `Foto ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Image className="h-8 w-8 text-gray-400" />
                  </div>
                )}
              </div>
            );
          })}
          {/* Fotos remotas do valueJson (URLs http/https) */}
          {remotePhotosFromValue.map((photoUrl, index) => (
            <div
              key={`remote-${index}`}
              className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden"
            >
              <img
                src={photoUrl}
                alt={`Foto ${index + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Se falhar ao carregar, mostrar placeholder
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).parentElement?.classList.add('flex', 'items-center', 'justify-center');
                }}
              />
            </div>
          ))}
          {/* Fotos locais (caminhos file:// - não sincronizadas) */}
          {localPhotos.map((photo, index) => (
            <div
              key={`local-${index}`}
              className="relative aspect-square bg-gray-100 rounded-lg flex items-center justify-center"
            >
              <div className="flex flex-col items-center">
                <Image className="h-8 w-8 text-gray-400" />
                <span className="text-xs text-amber-600 mt-1">Não sincronizada</span>
              </div>
              <span className="absolute bottom-1 left-1 right-1 text-[10px] text-gray-400 truncate px-1">
                {photo.split('/').pop()}
              </span>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => removePhoto(index)}
                  className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {!readOnly && (
        <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary hover:bg-primary-50 transition-colors">
          <Camera className="h-5 w-5 text-gray-400" />
          <span className="text-sm text-gray-600">
            {question.type === 'PHOTO_REQUIRED' ? 'Adicionar Foto (obrigatório)' : 'Adicionar Foto'}
          </span>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
      )}
    </div>
  );
}

function FileUploadInput({ question, value, onChange, readOnly }: QuestionInputProps) {
  const files = (value as string[]) || [];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const newFiles = Array.from(fileList).map((f) => f.name);
    onChange([...files, ...newFiles]);
  };

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    onChange(newFiles);
  };

  return (
    <div className="space-y-3">
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg"
            >
              <FileText className="h-4 w-4 text-gray-400" />
              <span className="flex-1 text-sm truncate">{file}</span>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="p-1 text-red-500 hover:bg-red-50 rounded"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {!readOnly && (
        <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary hover:bg-primary-50 transition-colors">
          <Upload className="h-5 w-5 text-gray-400" />
          <span className="text-sm text-gray-600">Adicionar Arquivo</span>
          <input
            type="file"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
      )}
    </div>
  );
}

function SignatureInput({ question, value, onChange, readOnly }: QuestionInputProps) {
  const hasSignature = Boolean(value);

  return (
    <div className="space-y-3">
      {hasSignature ? (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-medium">Assinatura registrada</span>
          </div>
          {!readOnly && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="mt-2 text-sm text-red-600 hover:text-red-700"
            >
              Remover assinatura
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => !readOnly && onChange('signed-' + Date.now())}
          disabled={readOnly}
          className={`w-full p-6 border-2 border-dashed rounded-lg flex flex-col items-center gap-2 transition-colors ${
            readOnly
              ? 'border-gray-200 cursor-not-allowed'
              : 'border-gray-300 hover:border-primary hover:bg-primary-50 cursor-pointer'
          }`}
        >
          <PenTool className="h-8 w-8 text-gray-400" />
          <span className="text-sm text-gray-600">
            {question.type === 'SIGNATURE_TECHNICIAN'
              ? 'Assinar (Técnico)'
              : 'Assinar (Cliente)'}
          </span>
        </button>
      )}
    </div>
  );
}

function SectionTitleDisplay({ question }: { question: ChecklistQuestion }) {
  return (
    <div className="py-2">
      <h3 className="text-lg font-semibold text-gray-900">{question.title}</h3>
      {question.description && (
        <p className="text-sm text-gray-500 mt-1">{question.description}</p>
      )}
    </div>
  );
}

// ============================================
// QUESTION RENDERER
// ============================================

function QuestionInput(props: QuestionInputProps) {
  const { question } = props;

  switch (question.type) {
    case 'TEXT_SHORT':
      return <TextShortInput {...props} />;
    case 'TEXT_LONG':
      return <TextLongInput {...props} />;
    case 'NUMBER':
      return <NumberInput {...props} />;
    case 'DATE':
      return <DateInput {...props} />;
    case 'TIME':
      return <TimeInput {...props} />;
    case 'DATETIME':
      return <DateTimeInput {...props} />;
    case 'CHECKBOX':
      return <CheckboxInput {...props} />;
    case 'SELECT':
      return <SelectInput {...props} />;
    case 'MULTI_SELECT':
      return <MultiSelectInput {...props} />;
    case 'RATING':
      return <RatingInput {...props} />;
    case 'SCALE':
      return <ScaleInput {...props} />;
    case 'PHOTO_REQUIRED':
    case 'PHOTO_OPTIONAL':
      return <PhotoInput {...props} />;
    case 'FILE_UPLOAD':
      return <FileUploadInput {...props} />;
    case 'SIGNATURE_TECHNICIAN':
    case 'SIGNATURE_CLIENT':
      return <SignatureInput {...props} />;
    case 'SECTION_TITLE':
      return null;
    default:
      return <TextShortInput {...props} />;
  }
}

// ============================================
// MAIN COMPONENT
// ============================================

export function ChecklistResponseForm({
  instanceId,
  workOrderId,
  onComplete,
  readOnly = false,
}: ChecklistResponseFormProps) {
  const { data: instance, isLoading, error } = useChecklistInstance(instanceId);
  const submitAnswerMutation = useSubmitChecklistAnswer();
  const submitBatchMutation = useSubmitChecklistAnswersBatch();
  const updateStatusMutation = useUpdateChecklistInstanceStatus();
  const completeChecklistMutation = useCompleteChecklist();

  const [answers, setAnswers] = useState<AnswerState>({});
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Parse template from snapshot or template
  const template = useMemo(() => {
    if (!instance) return null;
    // Backend returns 'snapshot' from /full endpoint, not 'templateSnapshot'
    const snapshot = (instance as any).snapshot || instance.templateSnapshot;
    if (snapshot) {
      return snapshot as {
        sections?: Array<{ id: string; title: string; description?: string; order: number }>;
        questions?: ChecklistQuestion[];
      };
    }
    return instance.template;
  }, [instance]);

  const questions = template?.questions || [];
  const sections = template?.sections || [];

  // Helper to extract value from typed answer fields
  const extractAnswerValue = useCallback((answer: any): unknown => {
    if (!answer) return undefined;

    // Backend returns typed fields: valueText, valueNumber, valueBoolean, valueDate, valueJson
    if (answer.valueText !== undefined && answer.valueText !== null) {
      return answer.valueText;
    }
    if (answer.valueNumber !== undefined && answer.valueNumber !== null) {
      // Prisma Decimal comes as string, convert to number
      return typeof answer.valueNumber === 'string'
        ? parseFloat(answer.valueNumber)
        : answer.valueNumber;
    }
    if (answer.valueBoolean !== undefined && answer.valueBoolean !== null) {
      return answer.valueBoolean;
    }
    if (answer.valueDate !== undefined && answer.valueDate !== null) {
      // Format date for input fields
      const date = new Date(answer.valueDate);
      return date.toISOString().split('T')[0]; // YYYY-MM-DD format
    }
    if (answer.valueJson !== undefined && answer.valueJson !== null) {
      return answer.valueJson;
    }
    // Fallback to generic value field if present
    if (answer.value !== undefined) {
      return answer.value;
    }
    return undefined;
  }, []);

  // Initialize answers from existing responses
  useEffect(() => {
    if (instance?.answers) {
      const existingAnswers: AnswerState = {};
      instance.answers.forEach((answer: any) => {
        // Extract attachments for photo/file questions
        const attachments = answer.attachments?.map((att: any) => ({
          id: att.id,
          publicUrl: att.publicUrl,
          thumbnailUrl: att.thumbnailUrl,
          fileName: att.fileName,
        })) || [];

        existingAnswers[answer.questionId] = {
          value: extractAnswerValue(answer),
          notes: answer.notes,
          attachments,
        };
      });
      setAnswers(existingAnswers);
    }
  }, [instance?.answers, extractAnswerValue]);

  // Expand all sections by default
  useEffect(() => {
    if (sections.length > 0) {
      setExpandedSections(new Set(sections.map((s) => s.id)));
    }
  }, [sections]);

  // Group questions by section
  const groupedQuestions = useMemo(() => {
    const sectionMap = new Map<string | null, ChecklistQuestion[]>();
    sectionMap.set(null, []); // Unsectioned questions

    sections.forEach((section) => {
      sectionMap.set(section.id, []);
    });

    questions.forEach((q) => {
      const key = q.sectionId || null;
      const list = sectionMap.get(key) || [];
      list.push(q);
      sectionMap.set(key, list);
    });

    // Sort questions by order
    sectionMap.forEach((qs) => {
      qs.sort((a, b) => (a.order || 0) - (b.order || 0));
    });

    return sectionMap;
  }, [questions, sections]);

  // Calculate progress
  const progress = useMemo(() => {
    const requiredQuestions = questions.filter(
      (q) => q.isRequired && q.type !== 'SECTION_TITLE'
    );
    const answeredRequired = requiredQuestions.filter((q) => {
      const answer = answers[q.id];
      if (!answer) return false;
      const value = answer.value;
      if (value === null || value === undefined || value === '') return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return true;
    });

    return {
      total: requiredQuestions.length,
      completed: answeredRequired.length,
      percentage: requiredQuestions.length > 0
        ? Math.round((answeredRequired.length / requiredQuestions.length) * 100)
        : 100,
    };
  }, [questions, answers]);

  const handleAnswerChange = useCallback((questionId: string, value: unknown, notes?: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { value, notes },
    }));
  }, []);

  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  // Helper to convert generic value to typed fields expected by backend
  const convertAnswerToDto = useCallback((questionId: string, value: unknown, notes?: string): any => {
    const question = questions.find((q) => q.id === questionId);
    if (!question) return null;

    const dto: any = {
      questionId,
      type: question.type,
    };

    // Map value to correct field based on question type
    switch (question.type) {
      case 'TEXT_SHORT':
      case 'TEXT_LONG':
        dto.valueText = value as string;
        break;
      case 'NUMBER':
      case 'RATING':
      case 'SCALE':
        dto.valueNumber = typeof value === 'string' ? parseFloat(value) : value;
        break;
      case 'CHECKBOX':
        dto.valueBoolean = value as boolean;
        break;
      case 'DATE':
      case 'TIME':
      case 'DATETIME':
        dto.valueDate = value as string;
        break;
      case 'SELECT':
      case 'MULTI_SELECT':
      case 'PHOTO_REQUIRED':
      case 'PHOTO_OPTIONAL':
      case 'FILE_UPLOAD':
      case 'SIGNATURE_TECHNICIAN':
      case 'SIGNATURE_CLIENT':
      default:
        dto.valueJson = value;
        break;
    }

    if (notes) {
      dto.notes = notes;
    }

    return dto;
  }, [questions]);

  const handleSave = useCallback(async () => {
    setSaveError(null);
    setIsSaving(true);

    try {
      const answersToSubmit = Object.entries(answers)
        .filter(([_, answer]) => answer.value !== undefined && answer.value !== null && answer.value !== '')
        .map(([questionId, answer]) => convertAnswerToDto(questionId, answer.value, answer.notes))
        .filter(Boolean);

      if (answersToSubmit.length > 0) {
        await submitBatchMutation.mutateAsync({
          instanceId,
          data: { answers: answersToSubmit },
          workOrderId,
        });
      }

      // Update status to IN_PROGRESS if not started
      if (instance?.status === 'NOT_STARTED') {
        await updateStatusMutation.mutateAsync({
          instanceId,
          status: 'IN_PROGRESS',
          workOrderId,
        });
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar respostas');
    } finally {
      setIsSaving(false);
    }
  }, [answers, instanceId, workOrderId, instance?.status, submitBatchMutation, updateStatusMutation, convertAnswerToDto]);

  const handleComplete = useCallback(async () => {
    setSaveError(null);
    setIsSaving(true);

    try {
      // Save answers first
      const answersToSubmit = Object.entries(answers)
        .filter(([_, answer]) => answer.value !== undefined && answer.value !== null && answer.value !== '')
        .map(([questionId, answer]) => convertAnswerToDto(questionId, answer.value, answer.notes))
        .filter(Boolean);

      if (answersToSubmit.length > 0) {
        await submitBatchMutation.mutateAsync({
          instanceId,
          data: { answers: answersToSubmit },
          workOrderId,
        });
      }

      // Use completeChecklist endpoint which validates required questions on backend
      await completeChecklistMutation.mutateAsync({
        instanceId,
        workOrderId,
      });

      onComplete?.();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao completar checklist');
    } finally {
      setIsSaving(false);
    }
  }, [answers, instanceId, workOrderId, submitBatchMutation, completeChecklistMutation, onComplete, convertAnswerToDto]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center gap-2 text-gray-500">
            <Clock className="h-5 w-5 animate-spin" />
            <span>Carregando checklist...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !instance || !template) {
    return (
      <Alert variant="error">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          Erro ao carregar checklist
        </div>
      </Alert>
    );
  }

  const unsectionedQuestions = groupedQuestions.get(null) || [];

  return (
    <div className="space-y-4">
      {/* Header with progress */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-gray-900">
              {instance.template?.name || 'Checklist'}
            </h2>
            <Badge
              variant={
                instance.status === 'COMPLETED'
                  ? 'soft-success'
                  : instance.status === 'IN_PROGRESS'
                  ? 'soft-warning'
                  : 'soft-gray'
              }
            >
              {instance.status === 'COMPLETED'
                ? 'Concluído'
                : instance.status === 'IN_PROGRESS'
                ? 'Em Andamento'
                : 'Não Iniciado'}
            </Badge>
          </div>
          {!readOnly && instance.status !== 'COMPLETED' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">
                  {progress.completed} de {progress.total} obrigatórias
                </span>
                <span className="font-medium text-primary">{progress.percentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error alert */}
      {saveError && (
        <Alert variant="error">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {saveError}
          </div>
        </Alert>
      )}

      {/* Sections */}
      {sections
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map((section) => {
          const sectionQuestions = groupedQuestions.get(section.id) || [];
          const isExpanded = expandedSections.has(section.id);
          const sectionAnswered = sectionQuestions.filter(
            (q) => q.type !== 'SECTION_TITLE' && answers[q.id]?.value !== undefined
          ).length;

          return (
            <Card key={section.id} className="overflow-hidden">
              <div
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => toggleSection(section.id)}
              >
                {isExpanded ? (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{section.title}</h3>
                  {section.description && (
                    <p className="text-sm text-gray-500">{section.description}</p>
                  )}
                </div>
                <Badge variant="soft-gray" size="sm">
                  {sectionAnswered}/{sectionQuestions.filter((q) => q.type !== 'SECTION_TITLE').length}
                </Badge>
              </div>
              {isExpanded && (
                <CardContent className="border-t pt-4 space-y-6">
                  {sectionQuestions.map((question) => {
                    if (question.type === 'SECTION_TITLE') {
                      return <SectionTitleDisplay key={question.id} question={question} />;
                    }

                    return (
                      <div key={question.id} className="space-y-2">
                        <div className="flex items-start gap-2">
                          {answers[question.id]?.value !== undefined ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                          ) : (
                            <Circle className="h-5 w-5 text-gray-300 mt-0.5 flex-shrink-0" />
                          )}
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-900">
                              {question.title}
                              {question.isRequired && (
                                <span className="text-red-500 ml-1">*</span>
                              )}
                            </label>
                            {question.description && (
                              <p className="text-xs text-gray-500 mt-0.5">
                                {question.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="pl-7">
                          <QuestionInput
                            question={question}
                            value={answers[question.id]?.value}
                            notes={answers[question.id]?.notes}
                            attachments={answers[question.id]?.attachments}
                            onChange={(value, notes) => handleAnswerChange(question.id, value, notes)}
                            readOnly={readOnly || instance.status === 'COMPLETED'}
                          />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              )}
            </Card>
          );
        })}

      {/* Unsectioned questions */}
      {unsectionedQuestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Perguntas Gerais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {unsectionedQuestions.map((question) => {
              if (question.type === 'SECTION_TITLE') {
                return <SectionTitleDisplay key={question.id} question={question} />;
              }

              return (
                <div key={question.id} className="space-y-2">
                  <div className="flex items-start gap-2">
                    {answers[question.id]?.value !== undefined ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    ) : (
                      <Circle className="h-5 w-5 text-gray-300 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-900">
                        {question.title}
                        {question.isRequired && (
                          <span className="text-red-500 ml-1">*</span>
                        )}
                      </label>
                      {question.description && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {question.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="pl-7">
                    <QuestionInput
                      question={question}
                      value={answers[question.id]?.value}
                      notes={answers[question.id]?.notes}
                      attachments={answers[question.id]?.attachments}
                      onChange={(value, notes) => handleAnswerChange(question.id, value, notes)}
                      readOnly={readOnly || instance.status === 'COMPLETED'}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {!readOnly && instance.status !== 'COMPLETED' && (
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={isSaving}
            leftIcon={<Save className="h-4 w-4" />}
          >
            {isSaving ? 'Salvando...' : 'Salvar Rascunho'}
          </Button>
          <Button
            onClick={handleComplete}
            disabled={isSaving || progress.percentage < 100}
            leftIcon={<Check className="h-4 w-4" />}
          >
            {isSaving ? 'Finalizando...' : 'Finalizar Checklist'}
          </Button>
        </div>
      )}
    </div>
  );
}

export default ChecklistResponseForm;
