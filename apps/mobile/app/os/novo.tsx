// @ts-nocheck
/**
 * Create Work Order Screen
 *
 * Tela de criação de nova Ordem de Serviço com:
 * - Seleção/criação rápida de cliente
 * - Seleção de checklists (templates)
 * - Data e hora de agendamento
 * - Endereço do serviço
 * - Suporte offline-first
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Text, Card, Button, Badge } from '../../src/design-system';
import { useColors, useSpacing } from '../../src/design-system/ThemeProvider';
import { workOrderService } from '../../src/modules/workorders/WorkOrderService';
import { formatLocalDate, formatLocalDateTime } from '../../src/utils/dateUtils';
import { ClientService } from '../../src/modules/clients/ClientService';
import { syncEngine, useSyncStatus } from '../../src/sync';
import { Client, ChecklistTemplate, WorkOrderType } from '../../src/db/schema';
import { findAll, findById } from '../../src/db/database';
import { ChecklistInstanceRepository } from '../../src/modules/checklists/repositories/ChecklistInstanceRepository';
import { useAuth } from '../../src/services/AuthProvider';
import { getActiveWorkOrderTypes } from '../../src/modules/workorders/WorkOrderTypeSyncConfig';

// =============================================================================
// TYPES
// =============================================================================

interface CatalogItem {
  id: string;
  name: string;
  description?: string;
  type: 'PRODUCT' | 'SERVICE' | 'BUNDLE';
  sku?: string;
  basePrice: number;
  unit: string;
  category?: { id: string; name: string };
}

interface SelectedItem {
  item: CatalogItem;
  quantity: number;
  unitPrice: number;
  discount: number;
}

interface FormData {
  clientId: string;
  clientName: string;
  clientPhone?: string;
  clientAddress?: string;
  title: string;
  description: string;
  scheduledDate: Date;
  scheduledStartTime: Date;
  scheduledEndTime?: Date;
  address: string;
  notes: string;
  selectedChecklists: string[];
  selectedItems: SelectedItem[];
  workOrderTypeId?: string;
}

// =============================================================================
// CLIENT SELECTION MODAL
// =============================================================================

const ClientSelectionModal = React.memo(function ClientSelectionModal({
  visible,
  onClose,
  onSelect,
  onCreateNew,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (client: Client) => void;
  onCreateNew: () => void;
}) {
  const colors = useColors();
  const spacing = useSpacing();
  const [searchQuery, setSearchQuery] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Search clients
  useEffect(() => {
    const search = async () => {
      if (!visible) return;
      setIsLoading(true);
      try {
        if (searchQuery.trim().length > 0) {
          const result = await ClientService.searchClients(searchQuery, 10000);
          setClients(result.data);
        } else {
          const result = await ClientService.listClients(1, 10000);
          setClients(result.data);
        }
      } catch (err) {
        console.error('[ClientSelectionModal] Search error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(search, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, visible]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background.primary }]}>
        {/* Header */}
        <View style={[styles.modalHeader, { borderBottomColor: colors.border.light }]}>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
            <Ionicons name="close" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text variant="h4" weight="semibold">Selecionar Cliente</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Search Input */}
        <View style={[styles.searchContainer, { paddingHorizontal: spacing[4] }]}>
          <View style={[styles.searchInputContainer, { backgroundColor: colors.background.secondary, borderColor: colors.border.light }]}>
            <Ionicons name="search" size={20} color={colors.text.tertiary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text.primary }]}
              placeholder="Buscar cliente..."
              placeholderTextColor={colors.text.tertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={colors.text.tertiary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Create New Client Button */}
        <TouchableOpacity
          style={[styles.createNewButton, { backgroundColor: colors.primary[50], marginHorizontal: spacing[4] }]}
          onPress={onCreateNew}
        >
          <Ionicons name="add-circle-outline" size={24} color={colors.primary[500]} />
          <Text variant="body" weight="medium" style={{ color: colors.primary[500], marginLeft: 8 }}>
            Criar novo cliente
          </Text>
        </TouchableOpacity>

        {/* Client List */}
        <ScrollView style={styles.clientList} contentContainerStyle={{ paddingHorizontal: spacing[4] }}>
          {isLoading ? (
            <Text variant="body" color="secondary" style={{ textAlign: 'center', marginTop: 20 }}>
              Carregando...
            </Text>
          ) : clients.length === 0 ? (
            <Text variant="body" color="secondary" style={{ textAlign: 'center', marginTop: 20 }}>
              {searchQuery ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
            </Text>
          ) : (
            clients.map((client) => (
              <TouchableOpacity
                key={client.id}
                style={[styles.clientItem, { backgroundColor: colors.background.secondary, borderColor: colors.border.light }]}
                onPress={() => onSelect(client)}
              >
                <View style={styles.clientItemIcon}>
                  <Ionicons name="person" size={20} color={colors.primary[500]} />
                </View>
                <View style={styles.clientItemContent}>
                  <Text variant="body" weight="medium">{client.name}</Text>
                  {client.phone && (
                    <Text variant="caption" color="secondary">{client.phone}</Text>
                  )}
                  {client.address && (
                    <Text variant="caption" color="tertiary" numberOfLines={1}>{client.address}</Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
});

// =============================================================================
// QUICK CREATE CLIENT MODAL
// =============================================================================

const QuickCreateClientModal = React.memo(function QuickCreateClientModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (client: Client) => void;
}) {
  const colors = useColors();
  const spacing = useSpacing();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    // CRITICAL: Guard against duplicate submissions
    if (isCreating) {
      return;
    }

    if (!name.trim()) {
      Alert.alert('Erro', 'Nome do cliente é obrigatório');
      return;
    }

    setIsCreating(true);
    try {
      const client = await ClientService.createClient({
        name: name.trim(),
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
      });
      onCreated(client);
      // Reset form
      setName('');
      setPhone('');
      setAddress('');
    } catch (err) {
      console.error('[QuickCreateClientModal] Error:', err);
      Alert.alert('Erro', 'Não foi possível criar o cliente');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.quickCreateOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.quickCreateKeyboard}
        >
          <View style={[styles.quickCreateContent, { backgroundColor: colors.background.primary }]}>
            <View style={styles.quickCreateHeader}>
              <Text variant="h4" weight="semibold">Novo Cliente</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.quickCreateForm}>
              <View style={styles.formField}>
                <Text variant="caption" weight="medium" color="secondary" style={styles.fieldLabel}>
                  Nome *
                </Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: colors.background.secondary, borderColor: colors.border.light, color: colors.text.primary }]}
                  placeholder="Nome do cliente"
                  placeholderTextColor={colors.text.tertiary}
                  value={name}
                  onChangeText={setName}
                  autoFocus
                />
              </View>

              <View style={styles.formField}>
                <Text variant="caption" weight="medium" color="secondary" style={styles.fieldLabel}>
                  Telefone
                </Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: colors.background.secondary, borderColor: colors.border.light, color: colors.text.primary }]}
                  placeholder="(00) 00000-0000"
                  placeholderTextColor={colors.text.tertiary}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.formField}>
                <Text variant="caption" weight="medium" color="secondary" style={styles.fieldLabel}>
                  Endereço
                </Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: colors.background.secondary, borderColor: colors.border.light, color: colors.text.primary }]}
                  placeholder="Endereço do cliente"
                  placeholderTextColor={colors.text.tertiary}
                  value={address}
                  onChangeText={setAddress}
                />
              </View>
            </View>

            <View style={styles.quickCreateButtons}>
              <Button variant="ghost" onPress={onClose} style={{ flex: 1 }}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                onPress={handleCreate}
                disabled={isCreating || !name.trim()}
                style={{ flex: 1 }}
              >
                {isCreating ? 'Criando...' : 'Criar Cliente'}
              </Button>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
});

// =============================================================================
// CHECKLIST SELECTION MODAL
// =============================================================================

const ChecklistSelectionModal = React.memo(function ChecklistSelectionModal({
  visible,
  onClose,
  selectedIds,
  onSelectionChange,
}: {
  visible: boolean;
  onClose: () => void;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}) {
  const colors = useColors();
  const spacing = useSpacing();
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load templates - buscar da API primeiro, depois fallback para local
  useEffect(() => {
    const load = async () => {
      if (!visible) return;
      setIsLoading(true);
      try {
        // Tentar buscar da API primeiro
        const engine = syncEngine as any;
        console.log('[ChecklistSelectionModal] Engine state:', {
          baseUrl: engine.baseUrl,
          hasAuthToken: !!engine.authToken,
          isConfigured: engine.isConfigured?.()
        });
        if (engine.baseUrl && engine.authToken) {
          console.log('[ChecklistSelectionModal] Fetching templates from API...');
          // GET /checklist-templates?includeDetails=true - retorna sections e questions para criar offline
          const response = await fetch(`${engine.baseUrl}/checklist-templates?includeDetails=true`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${engine.authToken}`,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const data = await response.json();
            console.log('[ChecklistSelectionModal] API returned templates:', data.length || data.data?.length);
            // API pode retornar array direto ou { data: [...] }
            const templatesData = Array.isArray(data) ? data : (data.data || data.items || []);
            setTemplates(templatesData);
            setIsLoading(false);
            return;
          }
        }

        // Fallback: buscar do banco local
        console.log('[ChecklistSelectionModal] Falling back to local DB...');
        const results = await findAll<ChecklistTemplate>('checklist_templates', {
          where: { isActive: 1 },
          orderBy: 'name',
          order: 'ASC',
        });
        setTemplates(results);
      } catch (err) {
        // Tentar banco local em caso de erro de rede
        console.log('[ChecklistSelectionModal] Network error, trying local DB...', err instanceof Error ? err.message : err);
        try {
          const results = await findAll<ChecklistTemplate>('checklist_templates', {
            where: { isActive: 1 },
            orderBy: 'name',
            order: 'ASC',
          });
          console.log('[ChecklistSelectionModal] Local DB returned:', results.length, 'templates');
          setTemplates(results);
        } catch (dbErr) {
          console.error('[ChecklistSelectionModal] Local DB also failed:', dbErr);
        }
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [visible]);

  const toggleTemplate = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((i) => i !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background.primary }]}>
        {/* Header */}
        <View style={[styles.modalHeader, { borderBottomColor: colors.border.light }]}>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
            <Ionicons name="close" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text variant="h4" weight="semibold">Checklists</Text>
          <TouchableOpacity onPress={onClose}>
            <Text variant="body" weight="medium" style={{ color: colors.primary[500] }}>
              Pronto
            </Text>
          </TouchableOpacity>
        </View>

        {/* Template List */}
        <ScrollView style={styles.clientList} contentContainerStyle={{ padding: spacing[4] }}>
          {isLoading ? (
            <Text variant="body" color="secondary" style={{ textAlign: 'center', marginTop: 20 }}>
              Carregando checklists...
            </Text>
          ) : templates.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="checkbox-outline" size={48} color={colors.text.tertiary} />
              <Text variant="body" color="secondary" style={{ textAlign: 'center', marginTop: 12 }}>
                Nenhum checklist cadastrado.{'\n'}Cadastre checklists no painel web.
              </Text>
            </View>
          ) : (
            templates.map((template: any) => {
              const isSelected = selectedIds.includes(template.id);
              // Contar perguntas - pode vir de diferentes formatos
              let questionsCount = 0;
              if (template._count?.questions) {
                questionsCount = template._count.questions;
              } else if (Array.isArray(template.questions)) {
                questionsCount = template.questions.length;
              } else if (typeof template.questions === 'string') {
                try {
                  questionsCount = JSON.parse(template.questions).length;
                } catch { }
              }

              return (
                <TouchableOpacity
                  key={template.id}
                  style={[
                    styles.checklistItem,
                    {
                      backgroundColor: isSelected ? colors.primary[50] : colors.background.secondary,
                      borderColor: isSelected ? colors.primary[500] : colors.border.light,
                    },
                  ]}
                  onPress={() => toggleTemplate(template.id)}
                >
                  <View style={styles.checklistItemContent}>
                    <Text variant="body" weight="medium">{template.name}</Text>
                    {template.description && (
                      <Text variant="caption" color="secondary" numberOfLines={2}>
                        {template.description}
                      </Text>
                    )}
                    <Text variant="caption" color="tertiary">
                      {questionsCount} pergunta{questionsCount !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <View style={[
                    styles.checkbox,
                    {
                      backgroundColor: isSelected ? colors.primary[500] : 'transparent',
                      borderColor: isSelected ? colors.primary[500] : colors.border.medium,
                    },
                  ]}>
                    {isSelected && <Ionicons name="checkmark" size={16} color="#FFF" />}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>

        {/* Footer with count */}
        {selectedIds.length > 0 && (
          <View style={[styles.selectionFooter, { backgroundColor: colors.background.secondary, borderTopColor: colors.border.light }]}>
            <Text variant="body" color="secondary">
              {selectedIds.length} checklist{selectedIds.length !== 1 ? 's' : ''} selecionado{selectedIds.length !== 1 ? 's' : ''}
            </Text>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
});

// =============================================================================
// WORK ORDER TYPE SELECTION MODAL
// =============================================================================

const WorkOrderTypeSelectionModal = React.memo(function WorkOrderTypeSelectionModal({
  visible,
  onClose,
  selectedTypeId,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  selectedTypeId?: string;
  onSelect: (type: WorkOrderType | null) => void;
}) {
  const colors = useColors();
  const spacing = useSpacing();
  const { user } = useAuth();
  const [types, setTypes] = useState<WorkOrderType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load types from local database
  useEffect(() => {
    const load = async () => {
      if (!visible) return;
      setIsLoading(true);
      try {
        const technicianId = user?.technicianId || '';
        if (technicianId) {
          const results = await getActiveWorkOrderTypes(technicianId);
          setTypes(results);
        }
      } catch (err) {
        console.error('[WorkOrderTypeSelectionModal] Error loading types:', err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [visible, user?.technicianId]);

  const handleSelect = (type: WorkOrderType | null) => {
    onSelect(type);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background.primary }]}>
        {/* Header */}
        <View style={[styles.modalHeader, { borderBottomColor: colors.border.light }]}>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
            <Ionicons name="close" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text variant="h4" weight="semibold">Tipo de OS</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Type List */}
        <ScrollView style={styles.clientList} contentContainerStyle={{ padding: spacing[4] }}>
          {isLoading ? (
            <Text variant="body" color="secondary" style={{ textAlign: 'center', marginTop: 20 }}>
              Carregando tipos...
            </Text>
          ) : types.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="pricetag-outline" size={48} color={colors.text.tertiary} />
              <Text variant="body" color="secondary" style={{ textAlign: 'center', marginTop: 12 }}>
                Nenhum tipo de OS cadastrado.{'\n'}Cadastre tipos no painel web.
              </Text>
            </View>
          ) : (
            <>
              {/* Option to clear selection */}
              <TouchableOpacity
                style={[
                  styles.typeItem,
                  {
                    backgroundColor: !selectedTypeId ? colors.primary[50] : colors.background.secondary,
                    borderColor: !selectedTypeId ? colors.primary[500] : colors.border.light,
                  },
                ]}
                onPress={() => handleSelect(null)}
              >
                <View style={[styles.typeColorDot, { backgroundColor: colors.text.tertiary }]} />
                <View style={styles.typeItemContent}>
                  <Text variant="body" weight="medium">Sem tipo definido</Text>
                  <Text variant="caption" color="secondary">Não classificar esta OS</Text>
                </View>
                {!selectedTypeId && (
                  <Ionicons name="checkmark-circle" size={24} color={colors.primary[500]} />
                )}
              </TouchableOpacity>

              {types.map((type) => {
                const isSelected = selectedTypeId === type.id;
                return (
                  <TouchableOpacity
                    key={type.id}
                    style={[
                      styles.typeItem,
                      {
                        backgroundColor: isSelected ? colors.primary[50] : colors.background.secondary,
                        borderColor: isSelected ? colors.primary[500] : colors.border.light,
                      },
                    ]}
                    onPress={() => handleSelect(type)}
                  >
                    <View style={[styles.typeColorDot, { backgroundColor: type.color || colors.primary[500] }]} />
                    <View style={styles.typeItemContent}>
                      <Text variant="body" weight="medium">{type.name}</Text>
                      {type.description && (
                        <Text variant="caption" color="secondary" numberOfLines={2}>
                          {type.description}
                        </Text>
                      )}
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={24} color={colors.primary[500]} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
});

// =============================================================================
// ITEM SELECTION MODAL
// =============================================================================

const ItemSelectionModal = React.memo(function ItemSelectionModal({
  visible,
  onClose,
  selectedItems,
  onItemsChange,
}: {
  visible: boolean;
  onClose: () => void;
  selectedItems: SelectedItem[];
  onItemsChange: (items: SelectedItem[]) => void;
}) {
  const colors = useColors();
  const spacing = useSpacing();
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'PRODUCT' | 'SERVICE' | 'BUNDLE'>('ALL');

  // Load items from local database (offline-first) with API fallback
  useEffect(() => {
    const load = async () => {
      if (!visible) return;
      setIsLoading(true);
      try {
        // 1. Primeiro, tenta carregar do banco local (offline-first)
        console.log('[ItemSelectionModal] Loading items from local database...');
        let sql = `SELECT * FROM catalog_items WHERE isActive = 1`;
        const params: any[] = [];

        if (searchQuery) {
          sql += ` AND (name LIKE ? OR description LIKE ? OR sku LIKE ?)`;
          const searchPattern = `%${searchQuery}%`;
          params.push(searchPattern, searchPattern, searchPattern);
        }

        if (typeFilter !== 'ALL') {
          sql += ` AND type = ?`;
          params.push(typeFilter);
        }

        sql += ` ORDER BY name ASC LIMIT 100`;

        const { rawQuery } = await import('../../src/db/database');
        const localItems = await rawQuery<CatalogItem>(sql, params);

        if (localItems && localItems.length > 0) {
          console.log('[ItemSelectionModal] Found', localItems.length, 'items in local database');
          setCatalogItems(localItems);
          setIsLoading(false);
          return;
        }

        // 2. Se não há itens locais, tenta API (se online)
        console.log('[ItemSelectionModal] No local items, trying API...');
        const engine = syncEngine as any;
        if (engine.baseUrl && engine.authToken) {
          let url = `${engine.baseUrl}/items?isActive=true`;
          if (searchQuery) {
            url += `&search=${encodeURIComponent(searchQuery)}`;
          }
          if (typeFilter !== 'ALL') {
            url += `&type=${typeFilter}`;
          }

          const response = await fetch(url, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${engine.authToken}`,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const data = await response.json();
            console.log('[ItemSelectionModal] API returned items:', data.length);
            setCatalogItems(Array.isArray(data) ? data : (data.data || data.items || []));
          }
        }
      } catch (err) {
        console.error('[ItemSelectionModal] Error loading items:', err);
        // Em caso de erro de rede, mantém lista vazia
        setCatalogItems([]);
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(load, 300);
    return () => clearTimeout(debounce);
  }, [visible, searchQuery, typeFilter]);

  const isItemSelected = (itemId: string) => {
    return selectedItems.some((si) => si.item.id === itemId);
  };

  const getSelectedQuantity = (itemId: string) => {
    const found = selectedItems.find((si) => si.item.id === itemId);
    return found?.quantity || 0;
  };

  const toggleItem = (item: CatalogItem) => {
    if (isItemSelected(item.id)) {
      onItemsChange(selectedItems.filter((si) => si.item.id !== item.id));
    } else {
      onItemsChange([
        ...selectedItems,
        {
          item,
          quantity: 1,
          unitPrice: item.basePrice,
          discount: 0,
        },
      ]);
    }
  };

  const updateQuantity = (itemId: string, delta: number) => {
    onItemsChange(
      selectedItems.map((si) => {
        if (si.item.id === itemId) {
          const newQty = Math.max(1, si.quantity + delta);
          return { ...si, quantity: newQty };
        }
        return si;
      })
    );
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'PRODUCT':
        return 'cube-outline';
      case 'SERVICE':
        return 'construct-outline';
      case 'BUNDLE':
        return 'layers-outline';
      default:
        return 'pricetag-outline';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'PRODUCT':
        return 'Produto';
      case 'SERVICE':
        return 'Serviço';
      case 'BUNDLE':
        return 'Kit';
      default:
        return type;
    }
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const totalValue = selectedItems.reduce((sum, si) => {
    return sum + si.quantity * si.unitPrice - si.discount;
  }, 0);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background.primary }]}>
        {/* Header */}
        <View style={[styles.modalHeader, { borderBottomColor: colors.border.light }]}>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
            <Ionicons name="close" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text variant="h4" weight="semibold">Itens do Catálogo</Text>
          <TouchableOpacity onPress={onClose}>
            <Text variant="body" weight="medium" style={{ color: colors.primary[500] }}>
              Pronto
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={[styles.searchContainer, { paddingHorizontal: spacing[4] }]}>
          <View style={[styles.searchInputContainer, { backgroundColor: colors.background.secondary, borderColor: colors.border.light }]}>
            <Ionicons name="search" size={20} color={colors.text.tertiary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text.primary }]}
              placeholder="Buscar item..."
              placeholderTextColor={colors.text.tertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={colors.text.tertiary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Type filters */}
        <View style={[styles.typeFilters, { paddingHorizontal: spacing[4] }]}>
          {(['ALL', 'PRODUCT', 'SERVICE', 'BUNDLE'] as const).map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.typeFilterChip,
                {
                  backgroundColor: typeFilter === type ? colors.primary[500] : colors.background.secondary,
                  borderColor: typeFilter === type ? colors.primary[500] : colors.border.light,
                },
              ]}
              onPress={() => setTypeFilter(type)}
            >
              <Text
                variant="caption"
                style={{ color: typeFilter === type ? '#FFFFFF' : colors.text.secondary }}
              >
                {type === 'ALL' ? 'Todos' : getTypeLabel(type)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Items List */}
        <ScrollView style={styles.clientList} contentContainerStyle={{ padding: spacing[4] }}>
          {isLoading ? (
            <Text variant="body" color="secondary" style={{ textAlign: 'center', marginTop: 20 }}>
              Carregando itens...
            </Text>
          ) : catalogItems.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="cube-outline" size={48} color={colors.text.tertiary} />
              <Text variant="body" color="secondary" style={{ textAlign: 'center', marginTop: 12 }}>
                {searchQuery
                  ? 'Nenhum item encontrado'
                  : 'Nenhum item no catálogo local.\n\nCadastre itens no painel web e sincronize o app quando estiver online.'}
              </Text>
            </View>
          ) : (
            catalogItems.map((item) => {
              const isSelected = isItemSelected(item.id);
              const quantity = getSelectedQuantity(item.id);

              return (
                <View
                  key={item.id}
                  style={[
                    styles.catalogItem,
                    {
                      backgroundColor: isSelected ? colors.primary[50] : colors.background.secondary,
                      borderColor: isSelected ? colors.primary[500] : colors.border.light,
                    },
                  ]}
                >
                  <TouchableOpacity
                    style={styles.catalogItemMain}
                    onPress={() => toggleItem(item)}
                  >
                    <View style={[styles.catalogItemIcon, { backgroundColor: colors.primary[100] }]}>
                      <Ionicons name={getTypeIcon(item.type)} size={20} color={colors.primary[500]} />
                    </View>
                    <View style={styles.catalogItemContent}>
                      <Text variant="body" weight="medium">{item.name}</Text>
                      <View style={styles.catalogItemMeta}>
                        <Badge variant="default" size="sm">{getTypeLabel(item.type)}</Badge>
                        {item.sku && (
                          <Text variant="caption" color="tertiary">SKU: {item.sku}</Text>
                        )}
                      </View>
                      <Text variant="body" weight="semibold" style={{ color: colors.primary[500] }}>
                        {formatPrice(item.basePrice)} / {item.unit}
                      </Text>
                    </View>
                    <View style={[
                      styles.checkbox,
                      {
                        backgroundColor: isSelected ? colors.primary[500] : 'transparent',
                        borderColor: isSelected ? colors.primary[500] : colors.border.medium,
                      },
                    ]}>
                      {isSelected && <Ionicons name="checkmark" size={16} color="#FFF" />}
                    </View>
                  </TouchableOpacity>

                  {/* Quantity controls when selected */}
                  {isSelected && (
                    <View style={[styles.quantityControls, { borderTopColor: colors.border.light }]}>
                      <Text variant="caption" color="secondary">Quantidade:</Text>
                      <View style={styles.quantityButtons}>
                        <TouchableOpacity
                          style={[styles.qtyButton, { backgroundColor: colors.background.primary, borderColor: colors.border.light }]}
                          onPress={() => updateQuantity(item.id, -1)}
                        >
                          <Ionicons name="remove" size={18} color={colors.text.primary} />
                        </TouchableOpacity>
                        <Text variant="body" weight="semibold" style={styles.qtyText}>
                          {quantity}
                        </Text>
                        <TouchableOpacity
                          style={[styles.qtyButton, { backgroundColor: colors.primary[500] }]}
                          onPress={() => updateQuantity(item.id, 1)}
                        >
                          <Ionicons name="add" size={18} color="#FFF" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>

        {/* Footer with total */}
        {selectedItems.length > 0 && (
          <View style={[styles.itemsFooter, { backgroundColor: colors.background.secondary, borderTopColor: colors.border.light }]}>
            <View>
              <Text variant="caption" color="secondary">
                {selectedItems.length} ite{selectedItems.length !== 1 ? 'ns' : 'm'} selecionado{selectedItems.length !== 1 ? 's' : ''}
              </Text>
              <Text variant="body" weight="semibold" style={{ color: colors.primary[500] }}>
                Total: {formatPrice(totalValue)}
              </Text>
            </View>
            <Button variant="primary" size="sm" onPress={onClose}>
              Confirmar
            </Button>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
});

// =============================================================================
// MAIN SCREEN
// =============================================================================

export default function CreateWorkOrderScreen() {
  const colors = useColors();
  const spacing = useSpacing();
  const { isOnline } = useSyncStatus();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ clientId?: string; clientName?: string }>();

  // Form state
  const [formData, setFormData] = useState<FormData>({
    clientId: '',
    clientName: '',
    clientPhone: '',
    clientAddress: '',
    title: '',
    description: '',
    scheduledDate: new Date(),
    scheduledStartTime: new Date(),
    scheduledEndTime: undefined,
    address: '',
    notes: '',
    selectedChecklists: [],
    selectedItems: [],
  });

  // Pre-fill client if coming from client details page
  useEffect(() => {
    const loadPreSelectedClient = async () => {
      if (params.clientId && !formData.clientId) {
        try {
          const client = await ClientService.getClient(params.clientId);
          if (client) {
            setFormData((prev) => ({
              ...prev,
              clientId: client.id,
              clientName: client.name,
              clientPhone: client.phone || '',
              clientAddress: client.address || '',
              address: client.address || prev.address,
            }));
          } else if (params.clientName) {
            // Fallback: use params if client not found locally
            setFormData((prev) => ({
              ...prev,
              clientId: params.clientId!,
              clientName: decodeURIComponent(params.clientName!),
            }));
          }
        } catch (error) {
          console.warn('[CreateWorkOrderScreen] Error loading pre-selected client:', error);
          if (params.clientName) {
            setFormData((prev) => ({
              ...prev,
              clientId: params.clientId!,
              clientName: decodeURIComponent(params.clientName!),
            }));
          }
        }
      }
    };
    loadPreSelectedClient();
  }, [params.clientId, params.clientName]);

  // Modal states
  const [showClientModal, setShowClientModal] = useState(false);
  const [showQuickCreateClient, setShowQuickCreateClient] = useState(false);
  const [showChecklistModal, setShowChecklistModal] = useState(false);
  const [showItemsModal, setShowItemsModal] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  // Selected work order type display info
  const [selectedTypeName, setSelectedTypeName] = useState<string | undefined>();
  const [selectedTypeColor, setSelectedTypeColor] = useState<string | undefined>();

  // Loading state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handlers
  const handleClientSelect = useCallback((client: Client) => {
    setFormData((prev) => ({
      ...prev,
      clientId: client.id,
      clientName: client.name,
      clientPhone: client.phone || '',
      clientAddress: client.address || '',
      address: client.address || prev.address, // Auto-fill address if empty
    }));
    setShowClientModal(false);
  }, []);

  const handleClientCreated = useCallback((client: Client) => {
    handleClientSelect(client);
    setShowQuickCreateClient(false);
  }, [handleClientSelect]);

  const handleDateChange = useCallback((event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setFormData((prev) => ({ ...prev, scheduledDate: selectedDate }));
    }
  }, []);

  const handleStartTimeChange = useCallback((event: any, selectedTime?: Date) => {
    setShowStartTimePicker(Platform.OS === 'ios');
    if (selectedTime) {
      setFormData((prev) => ({ ...prev, scheduledStartTime: selectedTime }));
    }
  }, []);

  const handleEndTimeChange = useCallback((event: any, selectedTime?: Date) => {
    setShowEndTimePicker(Platform.OS === 'ios');
    if (selectedTime) {
      setFormData((prev) => ({ ...prev, scheduledEndTime: selectedTime }));
    }
  }, []);

  const handleTypeSelect = useCallback((type: WorkOrderType | null) => {
    if (type) {
      setFormData((prev) => ({ ...prev, workOrderTypeId: type.id }));
      setSelectedTypeName(type.name);
      setSelectedTypeColor(type.color || undefined);
    } else {
      setFormData((prev) => ({ ...prev, workOrderTypeId: undefined }));
      setSelectedTypeName(undefined);
      setSelectedTypeColor(undefined);
    }
  }, []);

  const handleSubmit = async () => {
    // CRITICAL: Guard against duplicate submissions
    if (isSubmitting) {
      return;
    }

    // Validação
    if (!formData.clientId) {
      Alert.alert('Erro', 'Selecione um cliente');
      return;
    }
    if (!formData.title.trim()) {
      Alert.alert('Erro', 'Informe o título da OS');
      return;
    }

    setIsSubmitting(true);
    try {
      // Criar OS (formatLocalDate e formatLocalDateTime são importados de utils/dateUtils)
      const workOrder = await workOrderService.createWorkOrder({
        clientId: formData.clientId,
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        scheduledDate: formatLocalDate(formData.scheduledDate),
        scheduledStartTime: formatLocalDateTime(formData.scheduledStartTime),
        scheduledEndTime: formData.scheduledEndTime ? formatLocalDateTime(formData.scheduledEndTime) : undefined,
        address: formData.address.trim() || undefined,
        notes: formData.notes.trim() || undefined,
        clientName: formData.clientName,
        clientPhone: formData.clientPhone,
        clientAddress: formData.clientAddress,
        workOrderTypeId: formData.workOrderTypeId,
        workOrderTypeName: selectedTypeName,
        workOrderTypeColor: selectedTypeColor,
      });

      console.log('[CreateWorkOrderScreen] Work order created:', workOrder.id);

      // Se online, aguardar sync da OS e depois criar checklists e itens via API
      if (isOnline) {
        const engine = syncEngine as any;

        // Aguardar sync da OS antes de criar checklists
        // O auto-sync dispara em 2 segundos, mas vamos forçar agora
        console.log('[CreateWorkOrderScreen] Triggering sync to push work order to server...');
        try {
          await syncEngine.syncAll();
          console.log('[CreateWorkOrderScreen] Sync completed, work order should be on server now');
        } catch (syncErr) {
          console.error('[CreateWorkOrderScreen] Sync failed:', syncErr);
        }

        // Pequeno delay para garantir que o servidor processou
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Criar instâncias de checklist para cada template selecionado
        if (formData.selectedChecklists.length > 0) {
          for (const templateId of formData.selectedChecklists) {
            try {
              console.log(`[CreateWorkOrderScreen] Creating checklist for template ${templateId} on work order ${workOrder.id}`);
              const response = await fetch(`${engine.baseUrl}/checklist-instances`, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${engine.authToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  workOrderId: workOrder.id,
                  templateId,
                }),
              });

              if (!response.ok) {
                const errorText = await response.text();
                console.warn(`[CreateWorkOrderScreen] Failed to create checklist instance for template ${templateId}:`, response.status, errorText);
              } else {
                const result = await response.json();
                console.log(`[CreateWorkOrderScreen] Checklist instance created:`, result.id);
              }
            } catch (err) {
              console.error(`[CreateWorkOrderScreen] Error creating checklist instance:`, err);
            }
          }
        }

        // Criar itens da OS para cada item selecionado
        if (formData.selectedItems.length > 0) {
          for (const selectedItem of formData.selectedItems) {
            try {
              // Se temos itemId, o backend preenche automaticamente name/type/unit/unitPrice do catálogo
              // Podemos sobrescrever unitPrice e discountValue se necessário
              const payload: any = {
                itemId: selectedItem.item.id,
                quantity: selectedItem.quantity,
              };

              // Só inclui se diferente do preço base (usuário alterou)
              if (selectedItem.unitPrice !== selectedItem.item.basePrice) {
                payload.unitPrice = selectedItem.unitPrice;
              }

              // Inclui desconto se houver
              if (selectedItem.discount > 0) {
                payload.discountValue = selectedItem.discount;
              }

              const response = await fetch(`${engine.baseUrl}/work-orders/${workOrder.id}/items`, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${engine.authToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
              });

              if (!response.ok) {
                const errorData = await response.text();
                console.warn(`[CreateWorkOrderScreen] Failed to add item ${selectedItem.item.name}:`, errorData);
              } else {
                console.log(`[CreateWorkOrderScreen] Item added: ${selectedItem.item.name}`);
              }
            } catch (err) {
              console.error(`[CreateWorkOrderScreen] Error adding item:`, err);
            }
          }
        }
      } else {
        // OFFLINE: Criar checklists localmente
        if (formData.selectedChecklists.length > 0) {
          console.log('[CreateWorkOrderScreen] Creating checklists locally (offline mode)...');
          for (const templateId of formData.selectedChecklists) {
            try {
              // Buscar template do banco local
              const template = await findById<ChecklistTemplate>('checklist_templates', templateId);
              console.log(`[CreateWorkOrderScreen] Template ${templateId} from local DB:`, template ? {
                id: template.id,
                name: template.name,
                hasSections: !!template.sections,
                hasQuestions: !!template.questions,
                sectionsType: typeof template.sections,
                questionsType: typeof template.questions,
                sectionsPreview: typeof template.sections === 'string' ? template.sections.substring(0, 100) : JSON.stringify(template.sections)?.substring(0, 100),
                questionsPreview: typeof template.questions === 'string' ? template.questions.substring(0, 100) : JSON.stringify(template.questions)?.substring(0, 100),
              } : 'NOT FOUND');

              if (!template) {
                console.warn(`[CreateWorkOrderScreen] Template ${templateId} not found locally, skipping...`);
                continue;
              }

              // Criar snapshot do template com sections e questions
              const sectionsData = typeof template.sections === 'string' ? JSON.parse(template.sections || '[]') : (template.sections || []);
              const questionsData = typeof template.questions === 'string' ? JSON.parse(template.questions || '[]') : (template.questions || []);

              console.log(`[CreateWorkOrderScreen] Parsed template data:`, {
                sectionsCount: sectionsData.length,
                questionsCount: questionsData.length,
              });

              const templateSnapshot = {
                id: template.id,
                name: template.name,
                description: template.description,
                version: template.version,
                sections: sectionsData,
                questions: questionsData,
              };

              // Criar instância de checklist localmente
              const instance = await ChecklistInstanceRepository.create({
                workOrderId: workOrder.id,
                templateId: template.id,
                templateName: template.name,
                templateVersionSnapshot: JSON.stringify(templateSnapshot),
                status: 'PENDING',
                progress: 0,
                technicianId: user?.technicianId || '',
              });

              console.log(`[CreateWorkOrderScreen] Checklist instance created locally:`, instance.id);
            } catch (err) {
              console.error(`[CreateWorkOrderScreen] Error creating local checklist instance:`, err);
            }
          }
        }
      }

      Alert.alert(
        'Sucesso',
        'Ordem de serviço criada com sucesso!',
        [
          {
            text: 'Ver OS',
            onPress: () => router.replace(`/os/${workOrder.id}`),
          },
          {
            text: 'Criar outra',
            onPress: () => {
              // Reset form
              setFormData({
                clientId: '',
                clientName: '',
                clientPhone: '',
                clientAddress: '',
                title: '',
                description: '',
                scheduledDate: new Date(),
                scheduledStartTime: new Date(),
                scheduledEndTime: undefined,
                address: '',
                notes: '',
                selectedChecklists: [],
                selectedItems: [],
                workOrderTypeId: undefined,
              });
              setSelectedTypeName(undefined);
              setSelectedTypeColor(undefined);
            },
          },
        ]
      );
    } catch (err) {
      console.error('[CreateWorkOrderScreen] Error:', err);
      Alert.alert('Erro', 'Não foi possível criar a ordem de serviço');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format helpers
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border.light }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text variant="h4" weight="semibold">Nova Ordem de Serviço</Text>
        <View style={styles.headerRight}>
          {!isOnline && (
            <Badge variant="warning" size="sm">Offline</Badge>
          )}
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{ padding: spacing[4], paddingBottom: 100 }}
        >
          {/* Cliente Section */}
          <Card variant="outlined" style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="person-outline" size={20} color={colors.primary[500]} />
              <Text variant="body" weight="semibold" style={{ marginLeft: 8 }}>Cliente</Text>
              <Text variant="caption" color="error" style={{ marginLeft: 4 }}>*</Text>
            </View>

            <TouchableOpacity
              style={[styles.selectButton, { borderColor: colors.border.light }]}
              onPress={() => setShowClientModal(true)}
            >
              {formData.clientId ? (
                <View style={styles.selectedClient}>
                  <View style={styles.selectedClientInfo}>
                    <Text variant="body" weight="medium">{formData.clientName}</Text>
                    {formData.clientPhone && (
                      <Text variant="caption" color="secondary">{formData.clientPhone}</Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
                </View>
              ) : (
                <View style={styles.selectButtonContent}>
                  <Ionicons name="add-circle-outline" size={20} color={colors.primary[500]} />
                  <Text variant="body" style={{ color: colors.primary[500], marginLeft: 8 }}>
                    Selecionar cliente
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </Card>

          {/* Título e Descrição */}
          <Card variant="outlined" style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="document-text-outline" size={20} color={colors.primary[500]} />
              <Text variant="body" weight="semibold" style={{ marginLeft: 8 }}>Detalhes</Text>
            </View>

            <View style={styles.formField}>
              <Text variant="caption" weight="medium" color="secondary" style={styles.fieldLabel}>
                Título *
              </Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.background.secondary, borderColor: colors.border.light, color: colors.text.primary }]}
                placeholder="Ex: Manutenção preventiva"
                placeholderTextColor={colors.text.tertiary}
                value={formData.title}
                onChangeText={(text) => setFormData((prev) => ({ ...prev, title: text }))}
              />
            </View>

            <View style={styles.formField}>
              <Text variant="caption" weight="medium" color="secondary" style={styles.fieldLabel}>
                Descrição
              </Text>
              <TextInput
                style={[styles.textInput, styles.textArea, { backgroundColor: colors.background.secondary, borderColor: colors.border.light, color: colors.text.primary }]}
                placeholder="Descrição do serviço..."
                placeholderTextColor={colors.text.tertiary}
                value={formData.description}
                onChangeText={(text) => setFormData((prev) => ({ ...prev, description: text }))}
                multiline
                numberOfLines={3}
              />
            </View>
          </Card>

          {/* Tipo de OS */}
          <Card variant="outlined" style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="pricetag-outline" size={20} color={colors.primary[500]} />
              <Text variant="body" weight="semibold" style={{ marginLeft: 8 }}>Tipo de OS</Text>
            </View>

            <TouchableOpacity
              style={[styles.selectButton, { borderColor: colors.border.light }]}
              onPress={() => setShowTypeModal(true)}
            >
              {formData.workOrderTypeId ? (
                <View style={styles.selectedClient}>
                  <View style={[styles.typeColorDot, { backgroundColor: selectedTypeColor || colors.primary[500], marginRight: 12 }]} />
                  <View style={styles.selectedClientInfo}>
                    <Text variant="body" weight="medium">{selectedTypeName}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
                </View>
              ) : (
                <View style={styles.selectButtonContent}>
                  <Ionicons name="add-circle-outline" size={20} color={colors.primary[500]} />
                  <Text variant="body" style={{ color: colors.primary[500], marginLeft: 8 }}>
                    Selecionar tipo (opcional)
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </Card>

          {/* Agendamento */}
          <Card variant="outlined" style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="calendar-outline" size={20} color={colors.primary[500]} />
              <Text variant="body" weight="semibold" style={{ marginLeft: 8 }}>Agendamento</Text>
            </View>

            <TouchableOpacity
              style={[styles.dateTimeButton, { borderColor: colors.border.light }]}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar" size={20} color={colors.text.tertiary} />
              <Text variant="body" style={{ flex: 1, marginLeft: 12 }}>
                {formatDate(formData.scheduledDate)}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
            </TouchableOpacity>

            <View style={styles.timeRow}>
              <TouchableOpacity
                style={[styles.dateTimeButton, { borderColor: colors.border.light, flex: 1 }]}
                onPress={() => setShowStartTimePicker(true)}
              >
                <Ionicons name="time" size={20} color={colors.text.tertiary} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text variant="caption" color="secondary">Início</Text>
                  <Text variant="body">{formatTime(formData.scheduledStartTime)}</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.dateTimeButton, { borderColor: colors.border.light, flex: 1, marginLeft: 12 }]}
                onPress={() => setShowEndTimePicker(true)}
              >
                <Ionicons name="time-outline" size={20} color={colors.text.tertiary} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text variant="caption" color="secondary">Fim</Text>
                  <Text variant="body">
                    {formData.scheduledEndTime ? formatTime(formData.scheduledEndTime) : '--:--'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </Card>

          {/* Endereço */}
          <Card variant="outlined" style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="location-outline" size={20} color={colors.primary[500]} />
              <Text variant="body" weight="semibold" style={{ marginLeft: 8 }}>Endereço do Serviço</Text>
            </View>

            <TextInput
              style={[styles.textInput, { backgroundColor: colors.background.secondary, borderColor: colors.border.light, color: colors.text.primary }]}
              placeholder="Endereço onde será realizado o serviço"
              placeholderTextColor={colors.text.tertiary}
              value={formData.address}
              onChangeText={(text) => setFormData((prev) => ({ ...prev, address: text }))}
            />
          </Card>

          {/* Checklists */}
          <Card variant="outlined" style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="checkbox-outline" size={20} color={colors.primary[500]} />
              <Text variant="body" weight="semibold" style={{ marginLeft: 8 }}>Checklists</Text>
            </View>

            <TouchableOpacity
              style={[styles.selectButton, { borderColor: colors.border.light }]}
              onPress={() => setShowChecklistModal(true)}
            >
              {formData.selectedChecklists.length > 0 ? (
                <View style={styles.selectedClient}>
                  <View style={styles.selectedClientInfo}>
                    <Text variant="body" weight="medium">
                      {formData.selectedChecklists.length} checklist{formData.selectedChecklists.length !== 1 ? 's' : ''} selecionado{formData.selectedChecklists.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
                </View>
              ) : (
                <View style={styles.selectButtonContent}>
                  <Ionicons name="add-circle-outline" size={20} color={colors.primary[500]} />
                  <Text variant="body" style={{ color: colors.primary[500], marginLeft: 8 }}>
                    Selecionar checklists
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </Card>

          {/* Itens do Catálogo */}
          <Card variant="outlined" style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="cart-outline" size={20} color={colors.primary[500]} />
              <Text variant="body" weight="semibold" style={{ marginLeft: 8 }}>Produtos e Serviços</Text>
            </View>

            <TouchableOpacity
              style={[styles.selectButton, { borderColor: colors.border.light }]}
              onPress={() => setShowItemsModal(true)}
            >
              {formData.selectedItems.length > 0 ? (
                <View style={styles.selectedClient}>
                  <View style={styles.selectedClientInfo}>
                    <Text variant="body" weight="medium">
                      {formData.selectedItems.length} ite{formData.selectedItems.length !== 1 ? 'ns' : 'm'} selecionado{formData.selectedItems.length !== 1 ? 's' : ''}
                    </Text>
                    <Text variant="caption" color="secondary">
                      Total: {formData.selectedItems.reduce((sum, si) => sum + (si.quantity * si.unitPrice - si.discount), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
                </View>
              ) : (
                <View style={styles.selectButtonContent}>
                  <Ionicons name="add-circle-outline" size={20} color={colors.primary[500]} />
                  <Text variant="body" style={{ color: colors.primary[500], marginLeft: 8 }}>
                    Adicionar produtos/serviços
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Lista de itens selecionados */}
            {formData.selectedItems.length > 0 && (
              <View style={{ marginTop: 12 }}>
                {formData.selectedItems.map((si) => (
                  <View
                    key={si.item.id}
                    style={[styles.selectedItemRow, { borderColor: colors.border.light }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text variant="body" weight="medium">{si.item.name}</Text>
                      <Text variant="caption" color="tertiary">
                        {si.quantity} x {si.unitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </Text>
                    </View>
                    <Text variant="body" weight="semibold" style={{ color: colors.primary[500] }}>
                      {(si.quantity * si.unitPrice - si.discount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </Card>

          {/* Notas */}
          <Card variant="outlined" style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="create-outline" size={20} color={colors.primary[500]} />
              <Text variant="body" weight="semibold" style={{ marginLeft: 8 }}>Notas</Text>
            </View>

            <TextInput
              style={[styles.textInput, styles.textArea, { backgroundColor: colors.background.secondary, borderColor: colors.border.light, color: colors.text.primary }]}
              placeholder="Observações adicionais..."
              placeholderTextColor={colors.text.tertiary}
              value={formData.notes}
              onChangeText={(text) => setFormData((prev) => ({ ...prev, notes: text }))}
              multiline
              numberOfLines={3}
            />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Submit Button */}
      <View style={[styles.submitContainer, { backgroundColor: colors.background.primary, borderTopColor: colors.border.light }]}>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onPress={handleSubmit}
          disabled={isSubmitting || !formData.clientId || !formData.title.trim()}
        >
          {isSubmitting ? 'Criando...' : 'Criar Ordem de Serviço'}
        </Button>
      </View>

      {/* Modals */}
      <ClientSelectionModal
        visible={showClientModal}
        onClose={() => setShowClientModal(false)}
        onSelect={handleClientSelect}
        onCreateNew={() => {
          setShowClientModal(false);
          setShowQuickCreateClient(true);
        }}
      />

      <QuickCreateClientModal
        visible={showQuickCreateClient}
        onClose={() => setShowQuickCreateClient(false)}
        onCreated={handleClientCreated}
      />

      <ChecklistSelectionModal
        visible={showChecklistModal}
        onClose={() => setShowChecklistModal(false)}
        selectedIds={formData.selectedChecklists}
        onSelectionChange={(ids) => setFormData((prev) => ({ ...prev, selectedChecklists: ids }))}
      />

      <ItemSelectionModal
        visible={showItemsModal}
        onClose={() => setShowItemsModal(false)}
        selectedItems={formData.selectedItems}
        onItemsChange={(items) => setFormData((prev) => ({ ...prev, selectedItems: items }))}
      />

      <WorkOrderTypeSelectionModal
        visible={showTypeModal}
        onClose={() => setShowTypeModal(false)}
        selectedTypeId={formData.workOrderTypeId}
        onSelect={handleTypeSelect}
      />

      {/* Date/Time Pickers */}
      {showDatePicker && (
        <DateTimePicker
          value={formData.scheduledDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
          locale="pt-BR"
        />
      )}

      {showStartTimePicker && (
        <DateTimePicker
          value={formData.scheduledStartTime}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleStartTimeChange}
          locale="pt-BR"
        />
      )}

      {showEndTimePicker && (
        <DateTimePicker
          value={formData.scheduledEndTime || new Date()}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleEndTimeChange}
          locale="pt-BR"
        />
      )}
    </SafeAreaView>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  headerRight: {
    marginLeft: 'auto',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 16,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  formField: {
    marginBottom: 12,
  },
  fieldLabel: {
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  selectButton: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    borderStyle: 'dashed',
  },
  selectButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedClient: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedClientInfo: {
    flex: 1,
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  timeRow: {
    flexDirection: 'row',
  },
  submitContainer: {
    padding: 16,
    borderTopWidth: 1,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  modalCloseButton: {
    padding: 4,
  },
  searchContainer: {
    paddingVertical: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
  },
  createNewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  clientList: {
    flex: 1,
  },
  clientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 8,
  },
  clientItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  clientItemContent: {
    flex: 1,
  },
  // Quick create modal
  quickCreateOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  quickCreateKeyboard: {
    justifyContent: 'flex-end',
  },
  quickCreateContent: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
  },
  quickCreateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  quickCreateForm: {
    marginBottom: 20,
  },
  quickCreateButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  // Checklist modal
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 2,
    borderRadius: 12,
    marginBottom: 12,
  },
  checklistItemContent: {
    flex: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  selectionFooter: {
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  // Item selection modal styles
  typeFilters: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 12,
  },
  typeFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  catalogItem: {
    borderWidth: 2,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  catalogItemMain: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  catalogItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  catalogItemContent: {
    flex: 1,
    gap: 4,
  },
  catalogItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  quantityButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  qtyButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  qtyText: {
    minWidth: 24,
    textAlign: 'center',
  },
  itemsFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
  },
  selectedItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  // Work order type selection styles
  typeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 2,
    borderRadius: 12,
    marginBottom: 12,
  },
  typeItemContent: {
    flex: 1,
  },
  typeColorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
});
