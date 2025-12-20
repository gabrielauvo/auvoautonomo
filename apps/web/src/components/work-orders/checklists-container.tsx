'use client';

/**
 * ChecklistsContainer - Container de checklists da OS
 *
 * Gerencia:
 * - Listagem de checklists da OS
 * - Adição de novos checklists
 * - Visualização e preenchimento de respostas
 */

import { useState } from 'react';
import {
  Card,
  CardContent,
  Button,
  Skeleton,
  Alert,
  Modal,
  EmptyState,
  Badge,
} from '@/components/ui';
import {
  ClipboardList,
  Plus,
  AlertCircle,
  ChevronRight,
  CheckCircle2,
  Clock,
  Circle,
  Trash2,
  Play,
  RotateCcw,
} from 'lucide-react';
import {
  useChecklistInstances,
  useChecklistTemplates,
  useCreateChecklistInstance,
  useDeleteChecklistInstance,
  useReopenChecklist,
} from '@/hooks/use-checklists';
import { ChecklistResponseForm } from '@/components/checklists';
import { ChecklistInstance, ChecklistInstanceStatus } from '@/services/checklists.service';
import { cn } from '@/lib/utils';

interface ChecklistsContainerProps {
  workOrderId: string;
  workOrderStatus: string;
}

// Status label mapping
const statusLabels: Record<ChecklistInstanceStatus, string> = {
  NOT_STARTED: 'Não iniciado',
  IN_PROGRESS: 'Em progresso',
  COMPLETED: 'Concluído',
};

// Status icon mapping
function StatusIcon({ status }: { status: ChecklistInstanceStatus }) {
  switch (status) {
    case 'COMPLETED':
      return <CheckCircle2 className="h-4 w-4 text-success" />;
    case 'IN_PROGRESS':
      return <Clock className="h-4 w-4 text-warning" />;
    default:
      return <Circle className="h-4 w-4 text-gray-400" />;
  }
}

// Status badge variant
function getStatusVariant(status: ChecklistInstanceStatus): 'soft-success' | 'soft-warning' | 'soft-gray' {
  switch (status) {
    case 'COMPLETED':
      return 'soft-success';
    case 'IN_PROGRESS':
      return 'soft-warning';
    default:
      return 'soft-gray';
  }
}

export function ChecklistsContainer({
  workOrderId,
  workOrderStatus,
}: ChecklistsContainerProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [activeInstanceId, setActiveInstanceId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Queries
  const { data: instances, isLoading, error, refetch } = useChecklistInstances(workOrderId);
  const { data: templates, isLoading: isLoadingTemplates } = useChecklistTemplates();

  // Mutations
  const createInstance = useCreateChecklistInstance();
  const deleteInstance = useDeleteChecklistInstance();
  const reopenChecklist = useReopenChecklist();

  // Pode editar se a OS estiver em progresso
  const isEditable = workOrderStatus === 'IN_PROGRESS';

  // Adicionar checklist
  const handleAddChecklist = async () => {
    if (!selectedTemplate) return;

    try {
      await createInstance.mutateAsync({
        workOrderId,
        data: { templateId: selectedTemplate },
      });
      setShowAddModal(false);
      setSelectedTemplate(null);
      refetch();
    } catch (err) {
      console.error('Erro ao adicionar checklist:', err);
    }
  };

  // Excluir checklist
  const handleDeleteChecklist = async (instanceId: string) => {
    try {
      await deleteInstance.mutateAsync({
        instanceId,
        workOrderId,
      });
      setDeleteConfirmId(null);
      refetch();
    } catch (err) {
      console.error('Erro ao excluir checklist:', err);
    }
  };

  // Reabrir checklist
  const handleReopenChecklist = async (instanceId: string) => {
    try {
      await reopenChecklist.mutateAsync({
        instanceId,
        workOrderId,
      });
      refetch();
    } catch (err) {
      console.error('Erro ao reabrir checklist:', err);
    }
  };

  // Calcular progresso
  const calculateProgress = (instance: ChecklistInstance): number => {
    // Usar _count do template ou fallback para questions array
    const totalQuestions = (instance.template as any)?._count?.questions || instance.template?.questions?.length || 0;
    const answeredQuestions = instance._count?.answers || 0;
    if (totalQuestions === 0) return 0;
    return Math.round((answeredQuestions / totalQuestions) * 100);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Alert variant="error">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          Erro ao carregar checklists
        </div>
      </Alert>
    );
  }

  // Templates disponíveis (excluindo os já adicionados)
  const addedTemplateIds = new Set(instances?.map((i) => i.templateId) || []);
  const availableTemplates = templates?.filter((t) => t.isActive && !addedTemplateIds.has(t.id)) || [];

  // Se estiver preenchendo um checklist, mostrar apenas o formulário
  if (activeInstanceId) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveInstanceId(null)}
          >
            ← Voltar para lista
          </Button>
        </div>
        <ChecklistResponseForm
          instanceId={activeInstanceId}
          workOrderId={workOrderId}
          onComplete={() => {
            setActiveInstanceId(null);
            refetch();
          }}
          readOnly={!isEditable}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header com botão de adicionar */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          Checklists
        </h3>
        {isEditable && availableTemplates.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddModal(true)}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Adicionar Checklist
          </Button>
        )}
      </div>

      {/* Lista de checklists */}
      {instances && instances.length > 0 ? (
        <div className="space-y-3">
          {instances.map((instance) => {
            const progress = calculateProgress(instance);
            // Usar _count do template ou fallback para arrays
            const questionCount = (instance.template as any)?._count?.questions || instance.template?.questions?.length || 0;
            const sectionCount = (instance.template as any)?._count?.sections || instance.template?.sections?.length || 0;

            return (
              <Card
                key={instance.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setActiveInstanceId(instance.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <StatusIcon status={instance.status} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900 truncate">
                            {instance.template?.name || 'Checklist'}
                          </p>
                          <Badge variant={getStatusVariant(instance.status)}>
                            {statusLabels[instance.status]}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-xs text-gray-500">
                            {questionCount} pergunta{questionCount !== 1 ? 's' : ''}
                            {sectionCount > 0 && ` • ${sectionCount} seção${sectionCount !== 1 ? 'ões' : ''}`}
                          </span>
                          {progress > 0 && (
                            <span className="text-xs text-gray-500">
                              {progress}% concluído
                            </span>
                          )}
                        </div>
                        {/* Barra de progresso */}
                        {questionCount > 0 && (
                          <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                            <div
                              className={cn(
                                'h-1.5 rounded-full transition-all duration-300',
                                progress === 100 ? 'bg-success' : 'bg-primary'
                              )}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      {isEditable && instance.status !== 'COMPLETED' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveInstanceId(instance.id);
                          }}
                          leftIcon={<Play className="h-4 w-4" />}
                        >
                          {instance.status === 'NOT_STARTED' ? 'Iniciar' : 'Continuar'}
                        </Button>
                      )}
                      {isEditable && instance.status === 'COMPLETED' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReopenChecklist(instance.id);
                          }}
                          leftIcon={<RotateCcw className="h-4 w-4" />}
                          loading={reopenChecklist.isPending}
                        >
                          Reabrir
                        </Button>
                      )}
                      {isEditable && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmId(instance.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-gray-400 hover:text-error" />
                        </Button>
                      )}
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8">
            <EmptyState
              icon={ClipboardList}
              title="Nenhum checklist"
              description={
                isEditable
                  ? 'Adicione checklists para registrar inspeções e procedimentos'
                  : 'Esta OS não possui checklists'
              }
              action={
                isEditable && availableTemplates.length > 0
                  ? {
                      label: 'Adicionar Checklist',
                      onClick: () => setShowAddModal(true),
                    }
                  : undefined
              }
            />
          </CardContent>
        </Card>
      )}

      {/* Modal de seleção de template */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setSelectedTemplate(null);
        }}
        title="Adicionar Checklist"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Selecione um template de checklist para adicionar à OS:
          </p>

          {isLoadingTemplates ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : availableTemplates.length > 0 ? (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {availableTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => setSelectedTemplate(template.id)}
                  className={cn(
                    'w-full text-left p-3 rounded-lg border transition-colors',
                    selectedTemplate === template.id
                      ? 'border-primary bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <p className="font-medium text-gray-900">{template.name}</p>
                  {template.description && (
                    <p className="text-sm text-gray-500 mt-0.5">{template.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {template._count?.questions || 0} pergunta
                    {(template._count?.questions || 0) !== 1 ? 's' : ''}
                    {(template._count?.sections || 0) > 0 &&
                      ` • ${template._count?.sections} seção${(template._count?.sections || 0) !== 1 ? 'ões' : ''}`}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <Alert variant="info">
              {templates?.length === 0
                ? 'Nenhum template de checklist disponível. Crie um template primeiro.'
                : 'Todos os templates já foram adicionados a esta OS'}
            </Alert>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="ghost"
              onClick={() => {
                setShowAddModal(false);
                setSelectedTemplate(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAddChecklist}
              loading={createInstance.isPending}
              disabled={!selectedTemplate}
            >
              Adicionar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de confirmação de exclusão */}
      <Modal
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        title="Excluir Checklist"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Tem certeza que deseja excluir este checklist? Todas as respostas serão perdidas.
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="ghost"
              onClick={() => setDeleteConfirmId(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="error"
              onClick={() => deleteConfirmId && handleDeleteChecklist(deleteConfirmId)}
              loading={deleteInstance.isPending}
            >
              Excluir
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default ChecklistsContainer;
