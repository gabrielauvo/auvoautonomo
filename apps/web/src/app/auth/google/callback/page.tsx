'use client';

/**
 * Google OAuth Callback Page
 * Recebe o token do backend e autentica o usuário
 */

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/auth-context';

export default function GoogleCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginWithToken } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError('Falha na autenticação com Google. Tente novamente.');
      setTimeout(() => router.push('/login'), 3000);
      return;
    }

    if (token) {
      loginWithToken(token)
        .then(() => {
          router.push('/dashboard');
        })
        .catch((err) => {
          setError('Erro ao processar autenticação. Tente novamente.');
          setTimeout(() => router.push('/login'), 3000);
        });
    } else {
      setError('Token não encontrado. Redirecionando...');
      setTimeout(() => router.push('/login'), 2000);
    }
  }, [searchParams, loginWithToken, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        {error ? (
          <div className="text-error">{error}</div>
        ) : (
          <div className="space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto"></div>
            <p className="text-gray-600">Autenticando com Google...</p>
          </div>
        )}
      </div>
    </div>
  );
}
