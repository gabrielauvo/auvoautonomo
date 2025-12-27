'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from '@/i18n';
import { useAuth } from '@/context/auth-context';
import { Spinner } from '@/components/ui';

export default function Home() {
  const router = useRouter();
  const { t } = useTranslations('common');
  const { isAuthenticated, isLoading } = useAuth();
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    // Só redireciona quando o loading terminar e ainda não tiver redirecionado
    if (!isLoading && !hasRedirectedRef.current) {
      hasRedirectedRef.current = true;
      if (isAuthenticated) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    }
  }, [isAuthenticated, isLoading, router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <Spinner size="lg" />
      <p className="mt-4 text-gray-500">{t('loading')}</p>
    </main>
  );
}
