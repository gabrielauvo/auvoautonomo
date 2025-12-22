/**
 * Edit Expense Page
 *
 * Página para editar despesa existente.
 */

import { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ExpenseFormScreen, ExpenseService } from '../../../src/modules/expenses';
import type { Expense } from '../../../src/modules/expenses';
import { useColors } from '../../../src/design-system/ThemeProvider';
import { Text } from '../../../src/design-system/components/Text';
import { spacing } from '../../../src/design-system/tokens';

export default function EditExpensePage() {
  const router = useRouter();
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [expense, setExpense] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadExpense = async () => {
      try {
        const data = await ExpenseService.getExpenseById(id);
        setExpense(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar despesa');
      } finally {
        setLoading(false);
      }
    };
    loadExpense();
  }, [id]);

  const handleSave = () => {
    router.back();
  };

  const handleCancel = () => {
    router.back();
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background.secondary }]}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
      </View>
    );
  }

  if (error || !expense) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background.secondary }]}>
        <Text variant="body" color="secondary">
          {error || 'Despesa não encontrada'}
        </Text>
      </View>
    );
  }

  return (
    <ExpenseFormScreen
      expense={expense}
      onSave={handleSave}
      onCancel={handleCancel}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[4],
  },
});
