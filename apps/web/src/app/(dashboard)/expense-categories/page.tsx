'use client';

/**
 * Expense Categories Page - Categorias de Despesas
 *
 * Permite gerenciar categorias de despesas com edição inline
 */

import { useState, useCallback, useMemo } from 'react';
import { AppLayout } from '@/components/layout';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Skeleton,
  Alert,
  EmptyState,
} from '@/components/ui';
import {
  Plus,
  Folder,
  Edit,
  Trash2,
  Check,
  X,
  AlertCircle,
} from 'lucide-react';
import {
  useExpenseCategories,
  useCreateExpenseCategory,
  useUpdateExpenseCategory,
  useDeleteExpenseCategory,
} from '@/hooks/use-expense-categories';
import { ExpenseCategory } from '@/services/expense-categories.service';
import { useTranslations } from '@/i18n';

export default function ExpenseCategoriesPage() {
  const { t } = useTranslations('expenseCategories');

  // Cores predefinidas para categorias (memoized with translations)
  const CATEGORY_COLORS = useMemo(() => [
    { value: '#3B82F6', label: t('colors.blue') },
    { value: '#10B981', label: t('colors.green') },
    { value: '#F59E0B', label: t('colors.yellow') },
    { value: '#EF4444', label: t('colors.red') },
    { value: '#8B5CF6', label: t('colors.purple') },
    { value: '#EC4899', label: t('colors.pink') },
    { value: '#6B7280', label: t('colors.gray') },
    { value: '#F97316', label: t('colors.orange') },
  ], [t]);

  // Hooks de dados
  const { data: categories, isLoading, error: loadError } = useExpenseCategories();
  const createCategory = useCreateExpenseCategory();
  const updateCategory = useUpdateExpenseCategory();
  const deleteCategory = useDeleteExpenseCategory();

  // Estados de edição
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#3B82F6');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Modal de confirmação de exclusão
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<ExpenseCategory | null>(null);

  // Handler para criar categoria
  const handleCreate = useCallback(async () => {
    if (!newName.trim()) {
      setError(t('nameRequired'));
      return;
    }

    setError(null);
    try {
      await createCategory.mutateAsync({
        name: newName.trim(),
        color: newColor,
      });
      setNewName('');
      setNewColor('#3B82F6');
      setShowNewForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorCreating'));
    }
  }, [newName, newColor, createCategory, t]);

  // Handler para iniciar edição
  const handleStartEdit = useCallback((category: ExpenseCategory) => {
    setEditingId(category.id);
    setEditName(category.name);
    setEditColor(category.color || '#3B82F6');
    setError(null);
  }, []);

  // Handler para cancelar edição
  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditName('');
    setEditColor('');
    setError(null);
  }, []);

  // Handler para salvar edição
  const handleSaveEdit = useCallback(async () => {
    if (!editingId || !editName.trim()) {
      setError(t('nameRequired'));
      return;
    }

    setError(null);
    try {
      await updateCategory.mutateAsync({
        id: editingId,
        data: {
          name: editName.trim(),
          color: editColor,
        },
      });
      setEditingId(null);
      setEditName('');
      setEditColor('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorUpdating'));
    }
  }, [editingId, editName, editColor, updateCategory, t]);

  // Handler para deletar categoria
  const handleDelete = useCallback(async () => {
    if (!categoryToDelete) return;

    try {
      await deleteCategory.mutateAsync(categoryToDelete.id);
      setCategoryToDelete(null);
      setShowDeleteConfirm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorDeleting'));
    }
  }, [categoryToDelete, deleteCategory, t]);

  const isProcessing = createCategory.isPending || updateCategory.isPending || deleteCategory.isPending;

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
          {!showNewForm && (
            <Button
              onClick={() => setShowNewForm(true)}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              {t('newCategory')}
            </Button>
          )}
        </div>

        {/* Erro geral */}
        {(error || loadError) && (
          <Alert variant="error">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {error || t('errorLoading')}
            </div>
          </Alert>
        )}

        {/* Formulário de nova categoria */}
        {showNewForm && (
          <Card>
            <CardHeader>
              <CardTitle>{t('newCategory')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={t('categoryNamePlaceholder')}
                    disabled={isProcessing}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCreate();
                      } else if (e.key === 'Escape') {
                        setShowNewForm(false);
                        setNewName('');
                      }
                    }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">{t('color')}:</span>
                  <div className="flex gap-1">
                    {CATEGORY_COLORS.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        className={`w-6 h-6 rounded-full border-2 transition-all ${
                          newColor === color.value
                            ? 'border-gray-900 scale-110'
                            : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: color.value }}
                        onClick={() => setNewColor(color.value)}
                        title={color.label}
                        disabled={isProcessing}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleCreate}
                    disabled={!newName.trim() || isProcessing}
                    loading={createCategory.isPending}
                  >
                    {t('create')}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowNewForm(false);
                      setNewName('');
                      setError(null);
                    }}
                    disabled={isProcessing}
                  >
                    {t('cancel')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lista de categorias */}
        <Card>
          {isLoading ? (
            <CardContent className="py-4">
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-6 w-6 rounded-full" />
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-20 ml-auto" />
                  </div>
                ))}
              </div>
            </CardContent>
          ) : !categories || categories.length === 0 ? (
            <EmptyState
              icon={Folder}
              title={t('noCategories')}
              description={t('createCategoriesDescription')}
              action={{
                label: t('newCategory'),
                onClick: () => setShowNewForm(true),
              }}
            />
          ) : (
            <div className="divide-y divide-gray-200">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  {editingId === category.id ? (
                    // Modo de edição
                    <>
                      <div
                        className="w-6 h-6 rounded-full flex-shrink-0"
                        style={{ backgroundColor: editColor }}
                      />
                      <div className="flex-1 flex flex-col sm:flex-row gap-2 sm:items-center">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1"
                          disabled={isProcessing}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveEdit();
                            } else if (e.key === 'Escape') {
                              handleCancelEdit();
                            }
                          }}
                        />
                        <div className="flex gap-1">
                          {CATEGORY_COLORS.map((color) => (
                            <button
                              key={color.value}
                              type="button"
                              className={`w-5 h-5 rounded-full border-2 transition-all ${
                                editColor === color.value
                                  ? 'border-gray-900 scale-110'
                                  : 'border-transparent hover:scale-105'
                              }`}
                              style={{ backgroundColor: color.value }}
                              onClick={() => setEditColor(color.value)}
                              title={color.label}
                              disabled={isProcessing}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={handleSaveEdit}
                          disabled={!editName.trim() || isProcessing}
                          title={t('save')}
                        >
                          <Check className="h-4 w-4 text-success" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={handleCancelEdit}
                          disabled={isProcessing}
                          title={t('cancel')}
                        >
                          <X className="h-4 w-4 text-gray-500" />
                        </Button>
                      </div>
                    </>
                  ) : (
                    // Modo de visualização
                    <>
                      <div
                        className="w-6 h-6 rounded-full flex-shrink-0"
                        style={{ backgroundColor: category.color || CATEGORY_COLORS[0].value }}
                      />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{category.name}</p>
                        <p className="text-xs text-gray-500">
                          {t('expensesCount', { count: category._count?.expenses || 0 })}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleStartEdit(category)}
                          disabled={isProcessing}
                          title={t('edit')}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            setCategoryToDelete(category);
                            setShowDeleteConfirm(true);
                          }}
                          disabled={isProcessing}
                          title={t('delete')}
                        >
                          <Trash2 className="h-4 w-4 text-error" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Modal de confirmação de exclusão */}
        {showDeleteConfirm && categoryToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <Card className="max-w-md w-full">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-error-100">
                    <Trash2 className="h-6 w-6 text-error" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {t('deleteCategory')}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {categoryToDelete.name}
                    </p>
                  </div>
                </div>

                {(categoryToDelete._count?.expenses || 0) > 0 && (
                  <Alert variant="warning" className="mb-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <p className="font-medium">{t('attention')}</p>
                        <p>
                          {t('categoryHasExpenses', { count: categoryToDelete._count?.expenses })}
                        </p>
                      </div>
                    </div>
                  </Alert>
                )}

                <div className="flex justify-end gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setCategoryToDelete(null);
                    }}
                    disabled={deleteCategory.isPending}
                  >
                    {t('cancel')}
                  </Button>
                  <Button
                    variant="error"
                    onClick={handleDelete}
                    loading={deleteCategory.isPending}
                    leftIcon={<Trash2 className="h-4 w-4" />}
                  >
                    {t('deleteConfirm')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
