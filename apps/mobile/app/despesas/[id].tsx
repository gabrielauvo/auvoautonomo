/**
 * Expense Detail Page
 *
 * Página de detalhes da despesa.
 */

import { useRouter, useLocalSearchParams } from 'expo-router';
import { ExpenseDetailScreen } from '../../src/modules/expenses';
import type { Expense } from '../../src/modules/expenses';

export default function ExpenseDetailPage() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const handleBack = () => {
    router.back();
  };

  const handleEdit = (expense: Expense) => {
    router.push(`/despesas/editar/${expense.id}`);
  };

  const handleDeleted = () => {
    router.back();
  };

  return (
    <ExpenseDetailScreen
      expenseId={id}
      onBack={handleBack}
      onEdit={handleEdit}
      onDeleted={handleDeleted}
    />
  );
}
