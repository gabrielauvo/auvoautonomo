'use client';

import { useState } from 'react';
import { useTranslations } from '@/i18n';
import { Plus, Search, MoreHorizontal, Pencil, Power, PowerOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  useWorkOrderTypes,
  useCreateWorkOrderType,
  useUpdateWorkOrderType,
  useDeactivateWorkOrderType,
  useReactivateWorkOrderType,
} from '@/hooks/use-work-order-types';
import { WorkOrderType } from '@/services/work-order-types.service';

const DEFAULT_COLORS = [
  '#7C3AED', // Purple
  '#2563EB', // Blue
  '#059669', // Green
  '#DC2626', // Red
  '#D97706', // Orange
  '#7C2D12', // Brown
  '#0891B2', // Cyan
  '#DB2777', // Pink
];

export default function WorkOrderTypesPage() {
  const { t } = useTranslations('settings');
  const { t: tCommon } = useTranslations('common');

  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<WorkOrderType | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formColor, setFormColor] = useState(DEFAULT_COLORS[0]);

  const { data, isLoading } = useWorkOrderTypes({
    search: search || undefined,
    isActive: showInactive ? undefined : true,
  });

  const createMutation = useCreateWorkOrderType();
  const updateMutation = useUpdateWorkOrderType();
  const deactivateMutation = useDeactivateWorkOrderType();
  const reactivateMutation = useReactivateWorkOrderType();

  const handleOpenCreate = () => {
    setEditingType(null);
    setFormName('');
    setFormDescription('');
    setFormColor(DEFAULT_COLORS[0]);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (type: WorkOrderType) => {
    setEditingType(type);
    setFormName(type.name);
    setFormDescription(type.description || '');
    setFormColor(type.color || DEFAULT_COLORS[0]);
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formName.trim()) return;

    const data = {
      name: formName.trim(),
      description: formDescription.trim() || undefined,
      color: formColor,
    };

    if (editingType) {
      await updateMutation.mutateAsync({ id: editingType.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }

    setIsDialogOpen(false);
  };

  const handleToggleActive = async (type: WorkOrderType) => {
    if (type.isActive) {
      await deactivateMutation.mutateAsync(type.id);
    } else {
      await reactivateMutation.mutateAsync(type.id);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tipos de Ordem de Serviço</h1>
          <p className="text-muted-foreground">
            Gerencie os tipos de OS para categorizar seus serviços
          </p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Tipo
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Tipos Cadastrados</CardTitle>
              <CardDescription>
                {data?.total || 0} tipos cadastrados
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              <Button
                variant={showInactive ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setShowInactive(!showInactive)}
              >
                {showInactive ? 'Mostrando Todos' : 'Mostrar Inativos'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : data?.items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {search
                ? 'Nenhum tipo encontrado para esta busca'
                : 'Nenhum tipo cadastrado. Clique em "Novo Tipo" para começar.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cor</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.items.map((type) => (
                  <TableRow key={type.id}>
                    <TableCell>
                      <div
                        className="w-6 h-6 rounded-full border"
                        style={{ backgroundColor: type.color || DEFAULT_COLORS[0] }}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{type.name}</TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate">
                      {type.description || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={type.isActive ? 'default' : 'secondary'}>
                        {type.isActive ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenEdit(type)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleActive(type)}>
                            {type.isActive ? (
                              <>
                                <PowerOff className="mr-2 h-4 w-4" />
                                Desativar
                              </>
                            ) : (
                              <>
                                <Power className="mr-2 h-4 w-4" />
                                Reativar
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingType ? 'Editar Tipo de OS' : 'Novo Tipo de OS'}
            </DialogTitle>
            <DialogDescription>
              {editingType
                ? 'Atualize as informações do tipo de OS'
                : 'Preencha as informações para criar um novo tipo de OS'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex: Manutenção Preventiva"
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Descreva o tipo de OS..."
                maxLength={500}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {DEFAULT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      formColor === color
                        ? 'border-foreground scale-110'
                        : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormColor(color)}
                  />
                ))}
                <Input
                  type="color"
                  value={formColor}
                  onChange={(e) => setFormColor(e.target.value)}
                  className="w-8 h-8 p-0 border-0 cursor-pointer"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isSubmitting}
            >
              {tCommon('cancel')}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formName.trim() || isSubmitting}
            >
              {isSubmitting
                ? 'Salvando...'
                : editingType
                ? 'Salvar'
                : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
