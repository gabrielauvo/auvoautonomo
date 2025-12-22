/**
 * Nova Despesa Page
 *
 * Página para criar nova despesa.
 */

import { useRouter } from 'expo-router';
import { ExpenseFormScreen } from '../../src/modules/expenses';

export default function NovaDespesaPage() {
  const router = useRouter();

  const handleSave = () => {
    router.back();
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <ExpenseFormScreen
      onSave={handleSave}
      onCancel={handleCancel}
    />
  );
}
