'use client';

/**
 * Checklists Templates List Page
 *
 * Exibe:
 * - Lista de templates de checklist
 * - Busca por nome
 * - Ações: ver, editar, duplicar, excluir
 * - Badge de perguntas/seções
 */

import { useState, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout';
import {
  Card,
  CardContent,
  Button,
  Input,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Skeleton,
  Alert,
  EmptyState,
  Modal,
  FormField,
} from '@/components/ui';
import {
  Plus,
  Search,
  ClipboardCheck,
  Eye,
  Edit,
  Copy,
  Trash2,
  AlertCircle,
  FileText,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import {
  useChecklistTemplates,
  useDeleteChecklistTemplate,
  useDuplicateChecklistTemplate,
  useUpdateChecklistTemplate,
} from '@/hooks/use-checklists';
import { ChecklistTemplate } from '@/services/checklists.service';
import { useTranslations } from '@/i18n';

// Loading component
function ChecklistsListLoading() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Skeleton className="h-8 w-40 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-36" />
        </div>
        <Card>
          <CardContent className="py-4">
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-8 w-24" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

// Main content component
function ChecklistsListContent() {
  const router = useRouter();
  const { t } = useTranslations('checklists');
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<ChecklistTemplate | null>(null);
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [templateToDuplicate, setTemplateToDuplicate] = useState<ChecklistTemplate | null>(null);
  const [duplicateName, setDuplicateName] = useState('');

  // Query templates
  const {
    data: templates,
    isLoading,
    error,
  } = useChecklistTemplates(showInactive);

  // Mutations
  const deleteTemplateMutation = useDeleteChecklistTemplate();
  const duplicateTemplateMutation = useDuplicateChecklistTemplate();
  const updateTemplateMutation = useUpdateChecklistTemplate();

  // Filter templates by search
  const filteredTemplates = templates?.filter((template) =>
    template.name.toLowerCase().includes(search.toLowerCase()) ||
    template.description?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  // Handlers
  const handleDelete = useCallback(async () => {
    if (!templateToDelete) return;

    try {
      await deleteTemplateMutation.mutateAsync(templateToDelete.id);
      setDeleteModalOpen(false);
      setTemplateToDelete(null);
    } catch (error) {
      console.error('Failed to delete template:', error);
    }
  }, [templateToDelete, deleteTemplateMutation]);

  const handleDuplicate = useCallback(async () => {
    if (!templateToDuplicate) return;

    try {
      const duplicated = await duplicateTemplateMutation.mutateAsync({
        id: templateToDuplicate.id,
        name: duplicateName || `${templateToDuplicate.name} (${t('copy')})`,
      });
      setDuplicateModalOpen(false);
      setTemplateToDuplicate(null);
      setDuplicateName('');
      router.push(`/checklists/${duplicated.id}`);
    } catch (error) {
      console.error('Failed to duplicate template:', error);
    }
  }, [templateToDuplicate, duplicateName, duplicateTemplateMutation, router]);

  const handleToggleActive = useCallback(async (template: ChecklistTemplate) => {
    try {
      await updateTemplateMutation.mutateAsync({
        id: template.id,
        data: { isActive: !template.isActive },
      });
    } catch (error) {
      console.error('Failed to toggle template status:', error);
    }
  }, [updateTemplateMutation]);

  const openDeleteModal = useCallback((template: ChecklistTemplate) => {
    setTemplateToDelete(template);
    setDeleteModalOpen(true);
  }, []);

  const openDuplicateModal = useCallback((template: ChecklistTemplate) => {
    setTemplateToDuplicate(template);
    setDuplicateName(`${template.name} (${t('copy')})`);
    setDuplicateModalOpen(true);
  }, [t]);

  // Format question types count
  const getQuestionsLabel = (count: number | undefined) => {
    if (!count) return t('questionsCount', { count: 0 });
    return t('questionsCount', { count });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
            <p className="text-gray-500 mt-1">
              {t('subtitle')}
            </p>
          </div>
          <Button
            onClick={() => router.push('/checklists/new')}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            {t('newTemplate')}
          </Button>
        </div>

        {/* Search and filters */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder={t('searchPlaceholder')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  leftIcon={<Search className="h-4 w-4" />}
                />
              </div>
              <Button
                variant={showInactive ? 'default' : 'outline'}
                onClick={() => setShowInactive(!showInactive)}
                leftIcon={showInactive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
              >
                {showInactive ? t('showingInactive') : t('showInactive')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <Alert variant="error">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {t('loadError')}
            </div>
          </Alert>
        )}

        {/* Templates table */}
        <Card>
          {isLoading ? (
            <CardContent className="py-4">
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-8 w-24" />
                  </div>
                ))}
              </div>
            </CardContent>
          ) : filteredTemplates.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title={search ? t('noTemplatesFound') : t('noTemplates')}
              description={
                search
                  ? t('tryOtherTerms')
                  : t('createFirstTemplate')
              }
              action={
                !search
                  ? {
                      label: t('createTemplate'),
                      onClick: () => router.push('/checklists/new'),
                    }
                  : undefined
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('template')}</TableHead>
                  <TableHead>{t('questions')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                  <TableHead>{t('version')}</TableHead>
                  <TableHead className="text-right">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTemplates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-100 text-primary">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{template.name}</p>
                          {template.description && (
                            <p className="text-sm text-gray-500 line-clamp-1">
                              {template.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="primary" size="sm">
                          {getQuestionsLabel(template._count?.questions)}
                        </Badge>
                        {template._count?.sections && template._count.sections > 0 && (
                          <Badge variant="soft-gray" size="sm">
                            {t('sectionsCount', { count: template._count.sections })}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {template.isActive ? (
                        <Badge variant="soft-success" size="sm">
                          {t('active')}
                        </Badge>
                      ) : (
                        <Badge variant="soft-gray" size="sm">
                          {t('inactive')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-500">v{template.version}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/checklists/${template.id}`}>
                          <Button variant="ghost" size="icon-sm" title={t('viewDetails')}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Link href={`/checklists/${template.id}/edit`}>
                          <Button variant="ghost" size="icon-sm" title={t('edit')}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title={t('duplicate')}
                          onClick={() => openDuplicateModal(template)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title={template.isActive ? t('deactivate') : t('activate')}
                          onClick={() => handleToggleActive(template)}
                          disabled={updateTemplateMutation.isPending}
                        >
                          {template.isActive ? (
                            <ToggleRight className="h-4 w-4 text-green-600" />
                          ) : (
                            <ToggleLeft className="h-4 w-4 text-gray-400" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title={t('delete')}
                          onClick={() => openDeleteModal(template)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        {/* Delete Modal */}
        <Modal
          isOpen={deleteModalOpen}
          onClose={() => {
            setDeleteModalOpen(false);
            setTemplateToDelete(null);
          }}
          title={t('deleteTemplate')}
        >
          <div className="space-y-4">
            <p className="text-gray-600">
              {t('deleteConfirmMessage', { name: templateToDelete?.name || '' })}
            </p>
            <p className="text-sm text-gray-500">
              {t('deleteWarning')}
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteModalOpen(false);
                  setTemplateToDelete(null);
                }}
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
          onClose={() => {
            setDuplicateModalOpen(false);
            setTemplateToDuplicate(null);
            setDuplicateName('');
          }}
          title={t('duplicateTemplate')}
        >
          <div className="space-y-4">
            <p className="text-gray-600">
              {t('duplicateMessage', { name: templateToDuplicate?.name || '' })}
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
                onClick={() => {
                  setDuplicateModalOpen(false);
                  setTemplateToDuplicate(null);
                  setDuplicateName('');
                }}
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
export default function ChecklistsListPage() {
  return (
    <Suspense fallback={<ChecklistsListLoading />}>
      <ChecklistsListContent />
    </Suspense>
  );
}
