import { redirect } from 'next/navigation';

/**
 * Settings Root Page
 *
 * Redireciona para a página de conta
 */
export default function SettingsPage() {
  redirect('/settings/account');
}
