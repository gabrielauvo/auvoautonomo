/**
 * Import Contacts Modal
 *
 * Modal para importar contatos do dispositivo como clientes.
 * - Solicita permissão de acesso aos contatos
 * - Lista contatos com checkbox para seleção múltipla
 * - Permite busca/filtro
 * - Converte contatos selecionados em clientes
 * - Verifica limites do plano (FREE: 10 clientes, PRO: ilimitado)
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import { Text, Button, Badge } from '../../../design-system';
import { useColors, useSpacing } from '../../../design-system/ThemeProvider';
import { ClientService, CreateClientInput } from '../ClientService';
import { BillingService, QuotaInfo } from '../../../services/BillingService';

// =============================================================================
// TYPES
// =============================================================================

interface ImportContactsModalProps {
  visible: boolean;
  onClose: () => void;
  onImportComplete: (count: number) => void;
}

interface ContactItem {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  selected: boolean;
}

// =============================================================================
// CONTACT ITEM COMPONENT
// =============================================================================

const ContactItemRow = React.memo(function ContactItemRow({
  contact,
  onToggle,
}: {
  contact: ContactItem;
  onToggle: (id: string) => void;
}) {
  const colors = useColors();
  const spacing = useSpacing();

  return (
    <TouchableOpacity
      style={[
        styles.contactItem,
        {
          backgroundColor: contact.selected
            ? colors.primary[50]
            : colors.background.primary,
          borderColor: contact.selected
            ? colors.primary[300]
            : colors.gray[200],
        },
      ]}
      onPress={() => onToggle(contact.id)}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.checkbox,
          {
            backgroundColor: contact.selected
              ? colors.primary[500]
              : 'transparent',
            borderColor: contact.selected
              ? colors.primary[500]
              : colors.gray[400],
          },
        ]}
      >
        {contact.selected && (
          <Ionicons name="checkmark" size={16} color="#FFFFFF" />
        )}
      </View>

      <View style={styles.contactInfo}>
        <Text variant="body" weight="medium" numberOfLines={1}>
          {contact.name}
        </Text>
        {contact.phone && (
          <View style={styles.contactDetail}>
            <Ionicons
              name="call-outline"
              size={12}
              color={colors.text.tertiary}
            />
            <Text
              variant="caption"
              color="secondary"
              style={{ marginLeft: 4 }}
            >
              {contact.phone}
            </Text>
          </View>
        )}
        {contact.email && (
          <View style={styles.contactDetail}>
            <Ionicons
              name="mail-outline"
              size={12}
              color={colors.text.tertiary}
            />
            <Text
              variant="caption"
              color="secondary"
              style={{ marginLeft: 4 }}
              numberOfLines={1}
            >
              {contact.email}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function ImportContactsModal({
  visible,
  onClose,
  onImportComplete,
}: ImportContactsModalProps) {
  const colors = useColors();
  const spacing = useSpacing();

  // State
  const [permissionStatus, setPermissionStatus] = useState<
    'loading' | 'granted' | 'denied' | 'undetermined'
  >('loading');
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [isLoadingQuota, setIsLoadingQuota] = useState(true);

  // Load quota info from backend
  const loadQuota = useCallback(async () => {
    setIsLoadingQuota(true);
    try {
      const quotaInfo = await BillingService.getClientQuota();
      setQuota(quotaInfo);
      console.log('[ImportContacts] Quota loaded:', quotaInfo);
    } catch (error) {
      console.error('[ImportContacts] Error loading quota:', error);
      // On error, assume unlimited to not block the user
      setQuota({ remaining: -1, max: -1, current: 0, unlimited: true });
    } finally {
      setIsLoadingQuota(false);
    }
  }, []);

  // Request permission and load contacts
  const loadContacts = useCallback(async () => {
    setIsLoading(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();

      if (status !== 'granted') {
        setPermissionStatus('denied');
        setIsLoading(false);
        return;
      }

      setPermissionStatus('granted');

      // Get contacts with name and at least phone or email
      const { data } = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.Name,
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.Emails,
          Contacts.Fields.Addresses,
        ],
        sort: Contacts.SortTypes.FirstName,
      });

      // Filter contacts with name and phone/email, and transform
      // Use index to ensure unique keys even if contact.id is duplicated
      const validContacts: ContactItem[] = data
        .filter(
          (c) =>
            c.name &&
            (c.phoneNumbers?.length || c.emails?.length)
        )
        .map((c, index) => ({
          id: c.id ? `${c.id}_${index}` : `contact_${index}_${Date.now()}`,
          name: c.name || 'Sem nome',
          phone: c.phoneNumbers?.[0]?.number || null,
          email: c.emails?.[0]?.email || null,
          address: c.addresses?.[0]
            ? [
                c.addresses[0].street,
                c.addresses[0].city,
                c.addresses[0].region,
                c.addresses[0].postalCode,
              ]
                .filter(Boolean)
                .join(', ')
            : null,
          selected: false,
        }));

      setContacts(validContacts);
    } catch (error) {
      console.error('[ImportContacts] Error loading contacts:', error);
      Alert.alert('Erro', 'Não foi possível carregar os contatos.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    if (visible) {
      loadQuota();
      loadContacts();
    } else {
      // Reset state when closing
      setContacts([]);
      setSearchQuery('');
      setPermissionStatus('loading');
      setQuota(null);
      setIsLoadingQuota(true);
    }
  }, [visible, loadContacts, loadQuota]);

  // Calculate max selectable based on quota
  const maxSelectable = useMemo(() => {
    if (!quota) return Infinity;
    if (quota.unlimited || quota.remaining < 0) return Infinity;
    return quota.remaining;
  }, [quota]);

  // Is FREE plan (has limit)
  const isFreePlan = useMemo(() => {
    return quota && !quota.unlimited && quota.max > 0;
  }, [quota]);

  // Is quota reached (can't import any more)
  const isQuotaReached = useMemo(() => {
    return quota && !quota.unlimited && quota.remaining <= 0;
  }, [quota]);

  // Toggle contact selection
  const toggleContact = useCallback((id: string) => {
    setContacts((prev) => {
      const contact = prev.find(c => c.id === id);
      if (!contact) return prev;

      // If trying to select and quota limit reached
      if (!contact.selected) {
        const currentSelected = prev.filter(c => c.selected).length;
        if (maxSelectable !== Infinity && currentSelected >= maxSelectable) {
          Alert.alert(
            'Limite Atingido',
            `Você só pode importar mais ${maxSelectable} cliente${maxSelectable !== 1 ? 's' : ''} no plano gratuito.\n\nFaça upgrade para o plano PRO para clientes ilimitados.`
          );
          return prev;
        }
      }

      return prev.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c));
    });
  }, [maxSelectable]);

  // Select/deselect all
  const toggleAll = useCallback(() => {
    const selectedCount = contacts.filter((c) => c.selected).length;
    const allSelected = selectedCount === contacts.length;

    if (allSelected) {
      // Deselect all
      setContacts((prev) => prev.map((c) => ({ ...c, selected: false })));
    } else {
      // Select all (respecting quota)
      if (maxSelectable !== Infinity && contacts.length > maxSelectable) {
        Alert.alert(
          'Limite do Plano',
          `No plano gratuito, você pode ter até ${quota?.max || 10} clientes.\nVocê pode importar mais ${maxSelectable} cliente${maxSelectable !== 1 ? 's' : ''}.\n\nOs primeiros ${maxSelectable} contatos foram selecionados.`,
          [{ text: 'OK' }]
        );
        // Select only up to maxSelectable
        setContacts((prev) => prev.map((c, index) => ({ ...c, selected: index < maxSelectable })));
      } else {
        setContacts((prev) => prev.map((c) => ({ ...c, selected: true })));
      }
    }
  }, [contacts, maxSelectable, quota?.max]);

  // Filter contacts by search
  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contacts;

    const query = searchQuery.toLowerCase();
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.phone?.toLowerCase().includes(query) ||
        c.email?.toLowerCase().includes(query)
    );
  }, [contacts, searchQuery]);

  // Count selected
  const selectedCount = useMemo(
    () => contacts.filter((c) => c.selected).length,
    [contacts]
  );

  // Import selected contacts
  const handleImport = useCallback(async () => {
    const selected = contacts.filter((c) => c.selected);

    if (selected.length === 0) {
      Alert.alert('Atenção', 'Selecione pelo menos um contato para importar.');
      return;
    }

    Alert.alert(
      'Importar Contatos',
      `Deseja importar ${selected.length} contato${selected.length > 1 ? 's' : ''} como cliente${selected.length > 1 ? 's' : ''}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Importar',
          onPress: async () => {
            setIsImporting(true);
            let importedCount = 0;
            let errorCount = 0;

            for (const contact of selected) {
              try {
                const clientInput: CreateClientInput = {
                  name: contact.name,
                  phone: contact.phone || undefined,
                  email: contact.email || undefined,
                  address: contact.address || undefined,
                };

                await ClientService.createClient(clientInput);
                importedCount++;
              } catch (error) {
                console.error(
                  `[ImportContacts] Error importing ${contact.name}:`,
                  error
                );
                errorCount++;
              }
            }

            setIsImporting(false);

            if (errorCount > 0) {
              Alert.alert(
                'Importação Parcial',
                `${importedCount} cliente${importedCount > 1 ? 's' : ''} importado${importedCount > 1 ? 's' : ''} com sucesso.\n${errorCount} falha${errorCount > 1 ? 's' : ''}.`
              );
            } else {
              Alert.alert(
                'Sucesso',
                `${importedCount} cliente${importedCount > 1 ? 's' : ''} importado${importedCount > 1 ? 's' : ''} com sucesso!`
              );
            }

            onImportComplete(importedCount);
            onClose();
          },
        },
      ]
    );
  }, [contacts, onImportComplete, onClose]);

  // Render permission denied
  const renderPermissionDenied = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="lock-closed-outline" size={64} color={colors.gray[400]} />
      <Text
        variant="h5"
        style={{ textAlign: 'center', marginTop: spacing[4] }}
      >
        Acesso Negado
      </Text>
      <Text
        variant="body"
        color="secondary"
        style={{ textAlign: 'center', marginTop: spacing[2] }}
      >
        Para importar contatos, é necessário permitir o acesso aos contatos nas
        configurações do dispositivo.
      </Text>
      <Button
        variant="primary"
        onPress={onClose}
        style={{ marginTop: spacing[6] }}
      >
        Fechar
      </Button>
    </View>
  );

  // Render loading
  const renderLoading = () => (
    <View style={styles.emptyContainer}>
      <ActivityIndicator size="large" color={colors.primary[500]} />
      <Text variant="body" color="secondary" style={{ marginTop: spacing[4] }}>
        Carregando contatos...
      </Text>
    </View>
  );

  // Render empty
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="people-outline" size={64} color={colors.gray[400]} />
      <Text
        variant="body"
        color="secondary"
        style={{ textAlign: 'center', marginTop: spacing[4] }}
      >
        Nenhum contato encontrado com telefone ou email.
      </Text>
    </View>
  );

  // Render quota reached (can't import any more clients)
  const renderQuotaReached = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="alert-circle" size={64} color={colors.warning[500]} />
      <Text
        variant="h5"
        style={{ textAlign: 'center', marginTop: spacing[4] }}
      >
        Limite Atingido
      </Text>
      <Text
        variant="body"
        color="secondary"
        style={{ textAlign: 'center', marginTop: spacing[2], paddingHorizontal: spacing[4] }}
      >
        Você atingiu o limite de {quota?.max || 10} clientes do plano gratuito.
      </Text>
      <Text
        variant="body"
        color="secondary"
        style={{ textAlign: 'center', marginTop: spacing[2], paddingHorizontal: spacing[4] }}
      >
        Faça upgrade para o plano PRO para cadastrar clientes ilimitados.
      </Text>
      <Button
        variant="primary"
        onPress={onClose}
        style={{ marginTop: spacing[6] }}
      >
        Entendi
      </Button>
    </View>
  );

  // Render quota warning banner (for FREE plan users)
  const renderQuotaBanner = () => {
    if (!isFreePlan || isLoadingQuota || !quota) return null;

    return (
      <View
        style={[
          styles.quotaBanner,
          {
            backgroundColor: colors.warning[50],
            borderColor: colors.warning[200],
          },
        ]}
      >
        <Ionicons name="information-circle" size={20} color={colors.warning[600]} />
        <View style={styles.quotaBannerText}>
          <Text variant="bodySmall" weight="medium" style={{ color: colors.warning[800] }}>
            Plano Gratuito
          </Text>
          <Text variant="caption" style={{ color: colors.warning[700] }}>
            Você pode importar mais {maxSelectable} cliente{maxSelectable !== 1 ? 's' : ''} ({quota.current}/{quota.max} usado{quota.current !== 1 ? 's' : ''})
          </Text>
        </View>
      </View>
    );
  };

  // Render item
  const renderItem = useCallback(
    ({ item }: { item: ContactItem }) => (
      <ContactItemRow contact={item} onToggle={toggleContact} />
    ),
    [toggleContact]
  );

  const keyExtractor = useCallback((item: ContactItem) => item.id, []);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background.primary }]}
        edges={['top']}
      >
        {/* Header */}
        <View
          style={[
            styles.header,
            { borderBottomColor: colors.gray[200] },
          ]}
        >
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text variant="h5">Importar Contatos</Text>
          <View style={styles.headerRight}>
            {selectedCount > 0 && (
              <Badge variant="primary" size="sm">
                {String(selectedCount)}
              </Badge>
            )}
          </View>
        </View>

        {/* Content */}
        {permissionStatus === 'loading' || isLoading || isLoadingQuota ? (
          renderLoading()
        ) : permissionStatus === 'denied' ? (
          renderPermissionDenied()
        ) : isQuotaReached ? (
          renderQuotaReached()
        ) : contacts.length === 0 ? (
          renderEmpty()
        ) : (
          <>
            {/* Quota warning banner for FREE plan */}
            {renderQuotaBanner()}

            {/* Search bar */}
            <View style={[styles.searchContainer, { paddingHorizontal: spacing[4] }]}>
              <View
                style={[
                  styles.searchInput,
                  {
                    backgroundColor: colors.background.secondary,
                    borderColor: colors.gray[300],
                  },
                ]}
              >
                <Ionicons
                  name="search"
                  size={20}
                  color={colors.text.tertiary}
                />
                <TextInput
                  style={[styles.searchTextInput, { color: colors.text.primary }]}
                  placeholder="Buscar contato..."
                  placeholderTextColor={colors.text.tertiary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons
                      name="close-circle"
                      size={20}
                      color={colors.text.tertiary}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Select all bar */}
            <View
              style={[
                styles.selectAllBar,
                {
                  backgroundColor: colors.background.secondary,
                  borderBottomColor: colors.gray[200],
                },
              ]}
            >
              <TouchableOpacity
                style={styles.selectAllButton}
                onPress={toggleAll}
              >
                <View
                  style={[
                    styles.checkbox,
                    {
                      backgroundColor:
                        selectedCount === contacts.length && contacts.length > 0
                          ? colors.primary[500]
                          : 'transparent',
                      borderColor:
                        selectedCount === contacts.length && contacts.length > 0
                          ? colors.primary[500]
                          : colors.gray[400],
                    },
                  ]}
                >
                  {selectedCount === contacts.length && contacts.length > 0 && (
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  )}
                </View>
                <Text variant="body" style={{ marginLeft: spacing[3] }}>
                  {selectedCount === contacts.length && contacts.length > 0
                    ? 'Desmarcar todos'
                    : 'Selecionar todos'}
                </Text>
              </TouchableOpacity>
              <Text variant="caption" color="secondary">
                {filteredContacts.length} contato
                {filteredContacts.length !== 1 ? 's' : ''}
              </Text>
            </View>

            {/* Contacts list */}
            <FlatList
              data={filteredContacts}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              contentContainerStyle={{ padding: spacing[4] }}
              ItemSeparatorComponent={() => <View style={{ height: spacing[2] }} />}
              showsVerticalScrollIndicator={false}
            />

            {/* Footer */}
            <View
              style={[
                styles.footer,
                {
                  backgroundColor: colors.background.primary,
                  borderTopColor: colors.gray[200],
                },
              ]}
            >
              <Button
                variant="primary"
                onPress={handleImport}
                disabled={selectedCount === 0 || isImporting}
                style={{ flex: 1 }}
              >
                {isImporting
                  ? 'Importando...'
                  : `Importar ${selectedCount > 0 ? `(${selectedCount})` : ''}`}
              </Button>
            </View>
          </>
        )}
      </SafeAreaView>
    </Modal>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 4,
  },
  headerRight: {
    width: 32,
    alignItems: 'flex-end',
  },
  searchContainer: {
    paddingVertical: 12,
  },
  searchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchTextInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
  },
  selectAllBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactInfo: {
    flex: 1,
    marginLeft: 12,
  },
  contactDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
  },
  quotaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
  },
  quotaBannerText: {
    flex: 1,
  },
});

export default ImportContactsModal;
