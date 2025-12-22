'use client';

/**
 * Página de Login
 *
 * Tela de autenticação com:
 * - Formulário de email/senha
 * - Componentes do design system
 * - Tratamento de erros
 * - Loading state
 */

import { useState, FormEvent, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { useTranslations } from '@/i18n';
import {
  Button,
  Input,
  FormField,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Alert,
} from '@/components/ui';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading: authLoading, error: authError, clearError } = useAuth();
  const { t } = useTranslations('auth');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

  // Redireciona se já autenticado (apenas uma vez, após load inicial)
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

  // Handlers com limpeza de erro local
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

    // Previne cliques duplos com debounce
    if (submitTimeoutRef.current) {
      return;
    }

    // Validação básica
    if (!email.trim()) {
      setFormError(t('enterEmail'));
      return;
    }

    // Validação de formato de email com regex robusto
    // RFC 5322 simplificado - aceita caracteres especiais válidos
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

    // Debounce de 500ms para prevenir submits duplicados
    submitTimeoutRef.current = setTimeout(() => {
      submitTimeoutRef.current = null;
    }, 500);

    try {
      await login({ email: email.trim(), password });
    } catch (err) {
      // Erro já está no contexto
      setFormError(err instanceof Error ? err.message : t('loginError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading inicial (apenas na primeira carga)
  if (!initialLoadDone && authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-primary">{t('loading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {/* Logo/Branding */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gradient-auvo">Auvo</h1>
          <p className="text-gray-500 mt-2">{t('systemTitle')}</p>
        </div>

        {/* Card de Login */}
        <Card variant="elevated" padding="lg">
          <CardHeader>
            <CardTitle className="text-center">{t('login')}</CardTitle>
            <CardDescription className="text-center">
              {t('enterCredentials')}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Erro */}
              {(formError || authError) && (
                <Alert variant="error">
                  {formError || authError}
                </Alert>
              )}

              {/* Email */}
              <FormField label={t('email')} required>
                <Input
                  type="email"
                  placeholder={t('emailPlaceholder')}
                  value={email}
                  onChange={handleEmailChange}
                  leftIcon={<Mail className="h-4 w-4" />}
                  disabled={isSubmitting}
                  autoComplete="email"
                  autoFocus
                />
              </FormField>

              {/* Senha */}
              <FormField label={t('password')} required>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('passwordPlaceholder')}
                  value={password}
                  onChange={handlePasswordChange}
                  leftIcon={<Lock className="h-4 w-4" />}
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="hover:text-gray-600"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  }
                  disabled={isSubmitting}
                  autoComplete="current-password"
                />
              </FormField>

              {/* Esqueci a senha */}
              <div className="text-right">
                <Link
                  href="/forgot-password"
                  className="text-sm text-primary hover:text-primary-700"
                >
                  {t('forgotPassword')}
                </Link>
              </div>

              {/* Botão de login */}
              <Button
                type="submit"
                fullWidth
                loading={isSubmitting}
                disabled={isSubmitting}
              >
                {isSubmitting ? t('loggingIn') : t('login')}
              </Button>
            </form>

            {/* Divisor */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">{t('or')}</span>
              </div>
            </div>

            {/* Login com Google */}
            <Button
              type="button"
              variant="outline"
              fullWidth
              onClick={() => {
                window.location.href = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/auth/google`;
              }}
              className="flex items-center justify-center gap-3"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              {t('loginWithGoogle')}
            </Button>

            {/* Link para registro */}
            <div className="mt-6 text-center text-sm text-gray-500">
              {t('noAccount')}{' '}
              <Link href="/register" className="text-primary hover:text-primary-700 font-medium">
                {t('createAccount')}
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          &copy; {new Date().getFullYear()} Auvo. {t('allRightsReserved')}
        </p>
      </div>
    </div>
  );
}
