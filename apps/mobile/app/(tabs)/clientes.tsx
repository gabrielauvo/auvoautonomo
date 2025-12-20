// @ts-nocheck
/**
 * Clients Screen
 *
 * Lista de clientes com busca local, paginação e sync.
 */

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Text, Card, Badge, Avatar } from '../../src/design-system';
import { useColors, useSpacing } from '../../src/design-system/ThemeProvider';
import { OptimizedList } from '../../src/components';
import { ClientService } from '../../src/modules/clients/ClientService';
import { useSyncStatus } from '../../src/sync';
import { Client } from '../../src/db/schema';
import { ImportContactsModal } from '../../src/modules/clients/components/ImportContactsModal';

// =============================================================================
// TYPES
// =============================================================================

interface ClientListItem extends Client {
  hasPending?: boolean;
}

// =============================================================================
// CLIENT CARD COMPONENT
// =============================================================================

const ClientCard = React.memo(function ClientCard({
  client,
  onPress,
}: {
  client: ClientListItem;
  onPress: () => void;
}) {
  const colors = useColors();
  const spacing = useSpacing();

  const initials = useMemo(() => {
    const parts = client.name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return client.name.substring(0, 2).toUpperCase();
  }, [client.name]);

  return (
    <Pressable onPress={onPress}>
      <Card
        variant="outlined"
        style={[styles.clientCard, { marginHorizontal: spacing[4], marginBottom: spacing[3] }]}
      >
        <View style={styles.clientRow}>
          <Avatar size="md" fallback={initials} />
          <View style={styles.clientInfo}>
            <View style={styles.clientHeader}>
              <Text variant="body" weight="medium" numberOfLines={1} style={styles.clientName}>
                {client.name}
              </Text>
              {client.hasPending && (
                <Badge variant="warning" size="sm">
                  Pendente
                </Badge>
              )}
            </View>
            {client.phone && (
              <Text variant="caption" color="secondary" numberOfLines={1}>
                {client.phone}
              </Text>
            )}
            {client.email && (
              <Text variant="caption" color="tertiary" numberOfLines={1}>
                {client.email}
              </Text>
            )}
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
        </View>
      </Card>
    </Pressable>
  );
});

// =============================================================================
// MAIN SCREEN
// =============================================================================

export default function ClientesScreen() {
  const colors = useColors();
  const spacing = useSpacing();
  const { isSyncing, isOnline, sync, pendingCount } = useSyncStatus();

  // State
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [showImportModal, setShowImportModal] = useState(false);

  const PAGE_SIZE = 50;

  // Load clients from local DB
  const loadClients = useCallback(async (pageNum: number = 1, append: boolean = false) => {
    try {
      if (pageNum === 1) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      const result = await ClientService.listClients(pageNum, PAGE_SIZE);

      if (append) {
        // Filtrar duplicados baseado no ID para evitar erro de "keys duplicadas"
        setClients((prev) => {
          const existingIds = new Set(prev.map(c => c.id));
          const newClients = result.data.filter(c => !existingIds.has(c.id));
          return [...prev, ...newClients];
        });
      } else {
        setClients(result.data);
      }

      setTotal(result.total);
      setHasMore(pageNum < result.pages);
      setPage(pageNum);
    } catch (error) {
      console.error('[ClientesScreen] Error loading clients:', error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, []);

  // Search clients
  const searchClients = useCallback(async (query: string) => {
    if (!query.trim()) {
      loadClients(1);
      return;
    }

    setIsLoading(true);
    try {
      const result = await ClientService.searchClients(query, PAGE_SIZE);
      setClients(result.data);
      setTotal(result.total);
      setHasMore(false); // Search results are not paginated
    } catch (error) {
      console.error('[ClientesScreen] Error searching clients:', error);
    } finally {
      setIsLoading(false);
    }
  }, [loadClients]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchClients(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, searchClients]);

  // Initial load
  useEffect(() => {
    loadClients(1);
  }, [loadClients]);

  // Reload clients when screen gains focus (after returning from delete or edit)
  useFocusEffect(
    useCallback(() => {
      // Only reload if not searching (search has its own refresh)
      if (!searchQuery) {
        loadClients(1);
      }
    }, [loadClients, searchQuery])
  );

  // Handle refresh (pull-to-refresh)
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Sync first if online
      if (isOnline) {
        await sync();
      }
      // Then reload from local DB
      await loadClients(1);
    } finally {
      setIsRefreshing(false);
    }
  }, [isOnline, sync, loadClients]);

  // Handle load more
  const handleLoadMore = useCallback(() => {
    if (hasMore && !isLoadingMore && !searchQuery) {
      loadClients(page + 1, true);
    }
  }, [hasMore, isLoadingMore, searchQuery, page, loadClients]);

  // Handle client press
  const handleClientPress = useCallback((client: Client) => {
    router.push(`/clientes/${client.id}`);
  }, []);

  // Handle add client
  const handleAddClient = useCallback(() => {
    router.push('/clientes/novo');
  }, []);

  // Handle import contacts
  const handleImportContacts = useCallback(() => {
    setShowImportModal(true);
  }, []);

  // Handle import complete
  const handleImportComplete = useCallback((count: number) => {
    if (count > 0) {
      // Reload clients list after import
      loadClients(1);
    }
  }, [loadClients]);

  // Render client item
  const renderItem = useCallback(
    ({ item }: { item: ClientListItem }) => (
      <ClientCard client={item} onPress={() => handleClientPress(item)} />
    ),
    [handleClientPress]
  );

  // Key extractor
  const keyExtractor = useCallback((item: Client) => item.id, []);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background.primary }]}
      edges={['bottom']}
    >
      {/* Header with search and sync status */}
      <View style={[styles.header, { paddingHorizontal: spacing[4], paddingVertical: spacing[3] }]}>
        {/* Search Input */}
        <View
          style={[
            styles.searchContainer,
            {
              backgroundColor: colors.background.secondary,
              borderColor: colors.border.light,
            },
          ]}
        >
          <Ionicons name="search" size={20} color={colors.text.tertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text.primary }]}
            placeholder="Buscar clientes..."
            placeholderTextColor={colors.text.tertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={colors.text.tertiary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Sync status */}
        <View style={styles.syncStatus}>
          <View style={styles.syncInfo}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isOnline ? colors.success[500] : colors.error[500] },
              ]}
            />
            <Text variant="caption" color="secondary">
              {isSyncing ? 'Sincronizando...' : isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>
          {pendingCount > 0 && (
            <Badge variant="warning" size="sm">
              {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
            </Badge>
          )}
        </View>
      </View>

      {/* Clients list */}
      <OptimizedList
        data={clients}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        onRefresh={handleRefresh}
        onLoadMore={handleLoadMore}
        isLoading={isLoading}
        isRefreshing={isRefreshing}
        isLoadingMore={isLoadingMore}
        hasMore={hasMore && !searchQuery}
        estimatedItemSize={80}
        emptyText={searchQuery ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
        contentContainerStyle={{ paddingTop: spacing[2], paddingBottom: spacing[20] }}
      />

      {/* Total count */}
      {!isLoading && total > 0 && (
        <View style={[styles.footer, { backgroundColor: colors.background.secondary }]}>
          <Text variant="caption" color="secondary">
            {total} cliente{total > 1 ? 's' : ''} {searchQuery ? 'encontrado' : 'no total'}
            {searchQuery ? `s para "${searchQuery}"` : ''}
          </Text>
        </View>
      )}

      {/* FAB Container */}
      <View style={styles.fabContainer}>
        {/* Secondary FAB - Import Contacts */}
        <TouchableOpacity
          style={[styles.fabSecondary, { backgroundColor: colors.background.primary, borderColor: colors.primary[500] }]}
          onPress={handleImportContacts}
          activeOpacity={0.8}
        >
          <Ionicons name="people" size={22} color={colors.primary[500]} />
        </TouchableOpacity>

        {/* Primary FAB - Add Client */}
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.primary[500] }]}
          onPress={handleAddClient}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Import Contacts Modal */}
      <ImportContactsModal
        visible={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={handleImportComplete}
      />
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
    gap: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  syncStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  syncInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  clientCard: {
    padding: 12,
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  clientInfo: {
    flex: 1,
    gap: 2,
  },
  clientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clientName: {
    flex: 1,
  },
  footer: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  fabContainer: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    alignItems: 'center',
    gap: 12,
  },
  fabSecondary: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
