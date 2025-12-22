'use client';

/**
 * Checklist Template Detail Page
 *
 * Exibe detalhes de um template de checklist:
 * - Informações básicas
 * - Seções e perguntas
 * - Estatísticas de uso
 * - Ações (editar, duplicar, excluir)
 */

import { useState, useCallback, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Skeleton,
  Alert,
  Modal,
  Input,
  FormField,
} from '@/components/ui';
import {
  ChevronLeft,
  Edit,
  Copy,
  Trash2,
  AlertCircle,
  FileText,
  CheckCircle,
  XCircle,
  Hash,
  Layers,
  Clock,
  Eye,
  Type,
  Calendar,
  CheckSquare,
  List,
  Camera,
  PenTool,
  Star,
  Sliders,
  HelpCircle,
} from 'lucide-react';
import {
  useChecklistTemplate,
  useDeleteChecklistTemplate,
  useDuplicateChecklistTemplate,
} from '@/hooks/use-checklists';
import { ChecklistQuestion, ChecklistQuestionType } from '@/services/checklists.service';
import { useTranslations } from '@/i18n';

// Question type icons
const QUESTION_TYPE_ICONS: Record<ChecklistQuestionType, React.ElementType> = {
  TEXT_SHORT: Type,
  TEXT_LONG: Type,
  NUMBER: Hash,
  DATE: Calendar,
  TIME: Clock,
  DATETIME: Calendar,
  CHECKBOX: CheckSquare,
  SELECT: List,
  MULTI_SELECT: List,
  PHOTO_REQUIRED: Camera,
  PHOTO_OPTIONAL: Camera,
  SIGNATURE_TECHNICIAN: PenTool,
  SIGNATURE_CLIENT: PenTool,
  SECTION_TITLE: Type,
  RATING: Star,
  SCALE: Sliders,
};

// Question type label keys (will be translated in component)
const QUESTION_TYPE_LABEL_KEYS: Record<ChecklistQuestionType, string> = {
  TEXT_SHORT: 'questionTypes.textShort',
  TEXT_LONG: 'questionTypes.textLong',
  NUMBER: 'questionTypes.number',
  DATE: 'questionTypes.date',
  TIME: 'questionTypes.time',
  DATETIME: 'questionTypes.datetime',
  CHECKBOX: 'questionTypes.checkbox',
  SELECT: 'questionTypes.select',
  MULTI_SELECT: 'questionTypes.multiSelect',
  PHOTO_REQUIRED: 'questionTypes.photoRequired',
  PHOTO_OPTIONAL: 'questionTypes.photoOptional',
  SIGNATURE_TECHNICIAN: 'questionTypes.signatureTechnician',
  SIGNATURE_CLIENT: 'questionTypes.signatureClient',
  SECTION_TITLE: 'questionTypes.sectionTitle',
  RATING: 'questionTypes.rating',
  SCALE: 'questionTypes.scale',
};

// Loading component
function ChecklistDetailLoading() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-20" />
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    </AppLayout>
  );
}

// Question card component
function QuestionCard({ question, index }: { question: ChecklistQuestion; index: number }) {
  const { t } = useTranslations('checklists');
  const Icon = QUESTION_TYPE_ICONS[question.type] || HelpCircle;
  const typeLabel = t(QUESTION_TYPE_LABEL_KEYS[question.type]) || question.type;

  return (
    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center justify-center w-8 h-8 bg-white rounded-lg shadow-sm">
        <span className="text-xs font-medium text-gray-500">{index + 1}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="h-4 w-4 text-gray-400" />
          <span className="text-xs text-gray-500">{typeLabel}</span>
          {question.isRequired && (
            <Badge variant="soft-error" size="sm">
              {t('required')}
            </Badge>
          )}
        </div>
        <p className="font-medium text-gray-900">{question.title}</p>
        {question.description && (
          <p className="text-sm text-gray-500 mt-1">{question.description}</p>
        )}
        {question.options && question.options.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {question.options.map((option, i) => (
              <Badge key={i} variant="soft-gray" size="sm">
                {option.label}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Main content component
function ChecklistDetailContent() {
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslations('checklists');
  const templateId = params.id as string;

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateName, setDuplicateName] = useState('');

  const { data: template, isLoading, error } = useChecklistTemplate(templateId);
  const deleteTemplateMutation = useDeleteChecklistTemplate();
  const duplicateTemplateMutation = useDuplicateChecklistTemplate();

  // Group questions by section
  const getGroupedQuestions = useCallback(() => {
    if (!template) return { sections: [], unsectioned: [] };

    const sectionMap = new Map<string, ChecklistQuestion[]>();
    const unsectioned: ChecklistQuestion[] = [];

    (template.questions || []).forEach((q) => {
      if (q.sectionId) {
        if (!sectionMap.has(q.sectionId)) {
          sectionMap.set(q.sectionId, []);
        }
        sectionMap.get(q.sectionId)!.push(q);
      } else {
        unsectioned.push(q);
      }
    });

    // Sort questions in each section
    sectionMap.forEach((questions) => {
      questions.sort((a, b) => (a.order || 0) - (b.order || 0));
    });
    unsectioned.sort((a, b) => (a.order || 0) - (b.order || 0));

    return {
      sections: (template.sections || [])
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map((section) => ({
          ...section,
          questions: sectionMap.get(section.id) || [],
        })),
      unsectioned,
    };
  }, [template]);

  const { sections, unsectioned } = getGroupedQuestions();

  const handleDelete = useCallback(async () => {
    try {
      await deleteTemplateMutation.mutateAsync(templateId);
      router.push('/checklists');
    } catch (error) {
      console.error('Failed to delete template:', error);
    }
  }, [templateId, deleteTemplateMutation, router]);

  const handleDuplicate = useCallback(async () => {
    try {
      const duplicated = await duplicateTemplateMutation.mutateAsync({
        id: templateId,
        name: duplicateName || `${template?.name} (${t('copy')})`,
      });
      setDuplicateModalOpen(false);
      router.push(`/checklists/${duplicated.id}`);
    } catch (error) {
      console.error('Failed to duplicate template:', error);
    }
  }, [templateId, duplicateName, template, duplicateTemplateMutation, router]);

  const openDuplicateModal = useCallback(() => {
    setDuplicateName(`${template?.name} (${t('copy')})`);
    setDuplicateModalOpen(true);
  }, [template, t]);

  if (isLoading) {
    return <ChecklistDetailLoading />;
  }

  if (error || !template) {
    return (
      <AppLayout>
        <Alert variant="error">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {t('templateNotFound')}
          </div>
        </Alert>
      </AppLayout>
    );
  }

  const totalQuestions = template._count?.questions || template.questions?.length || 0;
  const requiredQuestions = template.questions?.filter((q) => q.isRequired).length || 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <Link href="/checklists">
              <Button variant="ghost" size="sm" leftIcon={<ChevronLeft className="h-4 w-4" />}>
                {t('back')}
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">{template.name}</h1>
                {template.isActive ? (
                  <Badge variant="soft-success" size="sm">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {t('active')}
                  </Badge>
                ) : (
                  <Badge variant="soft-gray" size="sm">
                    <XCircle className="h-3 w-3 mr-1" />
                    {t('inactive')}
                  </Badge>
                )}
              </div>
              {template.description && (
                <p className="text-gray-500 mt-1">{template.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={openDuplicateModal}
              leftIcon={<Copy className="h-4 w-4" />}
            >
              {t('duplicate')}
            </Button>
            <Link href={`/checklists/${template.id}/edit`}>
              <Button leftIcon={<Edit className="h-4 w-4" />}>
                {t('edit')}
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-100 rounded-lg">
                  <HelpCircle className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{totalQuestions}</p>
                  <p className="text-sm text-gray-500">{t('questions')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{requiredQuestions}</p>
                  <p className="text-sm text-gray-500">{t('requiredQuestions')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Layers className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {template._count?.sections || template.sections?.length || 0}
                  </p>
                  <p className="text-sm text-gray-500">{t('sections')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Hash className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">v{template.version}</p>
                  <p className="text-sm text-gray-500">{t('version')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sections with questions */}
        {sections.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">{t('sections')}</h2>
            {sections.map((section) => (
              <Card key={section.id} className="border-l-4 border-l-primary">
                <CardHeader>
                  <CardTitle className="text-base">{section.title}</CardTitle>
                  {section.description && (
                    <p className="text-sm text-gray-500">{section.description}</p>
                  )}
                </CardHeader>
                <CardContent>
                  {section.questions.length === 0 ? (
                    <p className="text-gray-500 text-sm italic">{t('noQuestionsInSection')}</p>
                  ) : (
                    <div className="space-y-2">
                      {section.questions.map((question, index) => (
                        <QuestionCard key={question.id} question={question} index={index} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Unsectioned questions */}
        {unsectioned.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{t('generalQuestions')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {unsectioned.map((question, index) => (
                  <QuestionCard key={question.id} question={question} index={index} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* No questions */}
        {totalQuestions === 0 && (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <HelpCircle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {t('noQuestionsRegistered')}
                </h3>
                <p className="text-gray-500 mb-4">
                  {t('templateNoQuestions')}
                </p>
                <Link href={`/checklists/${template.id}/edit`}>
                  <Button leftIcon={<Edit className="h-4 w-4" />}>
                    {t('addQuestions')}
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Danger zone */}
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">{t('dangerZone')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{t('deleteTemplate')}</p>
                <p className="text-sm text-gray-500">
                  {t('deleteWarningFull')}
                </p>
              </div>
              <Button
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50"
                onClick={() => setDeleteModalOpen(true)}
                leftIcon={<Trash2 className="h-4 w-4" />}
              >
                {t('delete')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Delete Modal */}
        <Modal
          isOpen={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          title={t('deleteTemplate')}
        >
          <div className="space-y-4">
            <p className="text-gray-600">
              {t('deleteConfirmMessage', { name: template.name })}
            </p>
            <p className="text-sm text-gray-500">
              {t('deleteWarning')}
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setDeleteModalOpen(false)}
              >
                {t('cancel')}
              </Button>
              <Button
                variant="error"
                onClick={handleDelete}
                disabled={deleteTemplateMutation.isPending}
              >
                {deleteTemplateMutation.isPending ? t('deleting') : t('delete')}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Duplicate Modal */}
        <Modal
          isOpen={duplicateModalOpen}
          onClose={() => setDuplicateModalOpen(false)}
          title={t('duplicateTemplate')}
        >
          <div className="space-y-4">
            <p className="text-gray-600">
              {t('duplicateMessage', { name: template.name })}
            </p>
            <FormField label={t('newTemplateName')}>
              <Input
                value={duplicateName}
                onChange={(e) => setDuplicateName(e.target.value)}
                placeholder={t('templateNamePlaceholder')}
              />
            </FormField>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setDuplicateModalOpen(false)}
              >
                {t('cancel')}
              </Button>
              <Button
                onClick={handleDuplicate}
                disabled={duplicateTemplateMutation.isPending}
              >
                {duplicateTemplateMutation.isPending ? t('duplicating') : t('duplicate')}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </AppLayout>
  );
}

// Export with Suspense
export default function ChecklistDetailPage() {
  return (
    <Suspense fallback={<ChecklistDetailLoading />}>
      <ChecklistDetailContent />
    </Suspense>
  );
}
