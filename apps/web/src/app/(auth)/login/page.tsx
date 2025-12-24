'use client';

/**
 * Página de Login - Design Auvo
 *
 * Layout centralizado com card contendo:
 * - Esquerda: Formulário de login
 * - Direita: Imagem promocional com bordas arredondadas
 */

import { useState, FormEvent, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/context/auth-context';
import { useTranslations } from '@/i18n';
import {
  Button,
  Input,
  Alert,
} from '@/components/ui';

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading: authLoading, error: authError, clearError } = useAuth();
  const { t } = useTranslations('auth');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const submitTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasRedirectedRef = useRef(false);

  // Marca quando o loading inicial terminou
  useEffect(() => {
    if (!authLoading && !initialLoadDone) {
      setInitialLoadDone(true);
    }
  }, [authLoading, initialLoadDone]);

  // Redireciona se já autenticado
  useEffect(() => {
    if (initialLoadDone && isAuthenticated && !hasRedirectedRef.current) {
      hasRedirectedRef.current = true;
      router.push('/dashboard');
    }
  }, [isAuthenticated, initialLoadDone, router]);

  // Limpar erros do auth context ao montar
  useEffect(() => {
    clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (formError) setFormError(null);
  }, [formError]);

  const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (formError) setFormError(null);
  }, [formError]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (submitTimeoutRef.current) return;

    if (!email.trim()) {
      setFormError(t('enterEmail'));
      return;
    }

    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!emailRegex.test(email.trim())) {
      setFormError(t('enterValidEmail'));
      return;
    }

    if (!password) {
      setFormError(t('enterPassword'));
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    submitTimeoutRef.current = setTimeout(() => {
      submitTimeoutRef.current = null;
    }, 500);

    try {
      await login({ email: email.trim(), password });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('loginError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading inicial
  if (!initialLoadDone && authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-pulse text-primary">{t('loading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-6 py-12">
      {/* Card Centralizado */}
      <div className="w-full max-w-5xl flex bg-white rounded-3xl shadow-xl overflow-hidden">
        {/* Lado Esquerdo - Formulário */}
        <div className="flex-1 p-10 lg:p-14">
          {/* Logo dentro do card */}
          <Link href="/" className="inline-block mb-8">
            <Image
              src="/images/LogoAuvo-Roxo.png"
              alt="Auvo"
              width={100}
              height={34}
              className="h-8 w-auto"
              priority
            />
          </Link>

          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">
            Bem-vindo(a) ao Auvo
          </h1>
            <p className="text-gray-500 mb-8">
              Acesse sua conta e continue gerenciando sua operação com facilidade.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Erro */}
              {(formError || authError) && (
                <Alert variant="error">
                  {formError || authError}
                </Alert>
              )}

              {/* Email */}
              <div>
                <Input
                  type="email"
                  placeholder="Digite seu e-mail"
                  value={email}
                  onChange={handleEmailChange}
                  disabled={isSubmitting}
                  autoComplete="email"
                  autoFocus
                  className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              {/* Senha */}
              <div>
                <Input
                  type="password"
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={handlePasswordChange}
                  disabled={isSubmitting}
                  autoComplete="current-password"
                  className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              {/* Divisor Google */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-3 bg-white text-gray-400">ou entre com o Google</span>
                </div>
              </div>

              {/* Botão Google */}
              <button
                type="button"
                className="w-full px-4 py-3.5 border border-gray-300 rounded-xl font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-3"
                onClick={() => {
                  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
                  window.location.href = `${apiUrl}/auth/google`;
                }}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span className="text-gray-700">Fazer login com o Google</span>
              </button>

              {/* Botão Entrar */}
              <Button
                type="submit"
                fullWidth
                loading={isSubmitting}
                disabled={isSubmitting}
                className="w-full py-3.5 bg-primary hover:bg-primary-700 text-white font-semibold rounded-xl transition-colors"
              >
                Entrar
              </Button>
            </form>

            {/* Links */}
            <div className="mt-6 text-center space-y-3">
              <Link href="/forgot-password" className="text-primary text-sm hover:underline block">
                Esqueceu sua senha?
              </Link>
              <Link href="/register" className="text-primary text-sm hover:underline block">
                Criar minha conta
              </Link>
            </div>
          </div>

        {/* Lado Direito - Imagem Promocional */}
        <div className="hidden lg:block lg:w-[420px] xl:w-[480px] relative">
          <div className="absolute inset-0 rounded-3xl m-2 overflow-hidden">
            {/* Imagem de fundo */}
            <Image
              src="/images/imagem autonomo.png"
              alt="Técnico de serviços externos"
              fill
              className="object-cover"
              priority
            />
            {/* Overlay com gradiente para o texto */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
            {/* Texto sobre a imagem */}
            <div className="absolute bottom-0 left-0 right-0 p-8">
              <h2 className="text-2xl xl:text-3xl font-bold leading-tight text-white drop-shadow-lg" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                O Software n°1<br />
                para serviços técnicos
              </h2>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
