/**
 * Despesas Index Page
 *
 * Página de listagem de despesas.
 */

import { useRouter } from 'expo-router';
import { ExpensesListScreen } from '../../src/modules/expenses';

export default function DespesasIndexPage() {
  const router = useRouter();

  const handleExpensePress = (expense: { id: string }) => {
    router.push(`/despesas/${expense.id}`);
  };

  const handleNewExpense = () => {
    router.push('/despesas/nova');
  };

  return (
    <ExpensesListScreen
      onExpensePress={handleExpensePress}
      onNewExpense={handleNewExpense}
    />
  );
}
