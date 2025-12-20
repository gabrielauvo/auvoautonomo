'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { hasToken } from '@/services';
import { Spinner } from '@/components/ui';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const isAuthenticated = await hasToken();
      if (isAuthenticated) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    };
    checkAuth();
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <Spinner size="lg" />
      <p className="mt-4 text-gray-500">Carregando...</p>
    </main>
  );
}
