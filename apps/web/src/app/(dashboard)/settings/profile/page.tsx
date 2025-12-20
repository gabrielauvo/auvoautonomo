import { redirect } from 'next/navigation';

/**
 * Profile page redirect
 *
 * Redireciona para /settings/account que contém as configurações de perfil
 */
export default function ProfilePage() {
  redirect('/settings/account');
}
