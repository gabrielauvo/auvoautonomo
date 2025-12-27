'use client';

/**
 * Página de Redefinição de Senha - Design Auvo
 *
 * O usuário acessa esta página através do link enviado por e-mail.
 * O token é passado via query parameter.
 */

import { useState, FormEvent, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Button,
  Input,
  Alert,
} from '@/components/ui';
import { useTranslations } from '@/i18n';

export default function ResetPasswordPage() {
  const { t } = useTranslations('auth');
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Verifica se tem token
  useEffect(() => {
    if (!token) {
      setFormError(t('invalidOrExpiredLink'));
    }
  }, [token, t]);

  const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (formError) setFormError(null);
  }, [formError]);

  const handleConfirmPasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmPassword(e.target.value);
    if (formError) setFormError(null);
  }, [formError]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!token) {
      setFormError(t('invalidOrExpiredLink'));
      return;
    }

    if (!password) {
      setFormError(t('enterNewPassword'));
      return;
    }

    if (password.length < 6) {
      setFormError(t('passwordMinLength6'));
      return;
    }

    if (password !== confirmPassword) {
      setFormError(t('passwordsDontMatch'));
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || t('errorResettingPassword'));
      }

      setSuccess(true);
      // Redireciona para login após 3 segundos
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('errorResettingPassword'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 sm:px-6 py-12">
      {/* Card Centralizado */}
      <div className="w-full max-w-5xl flex bg-white rounded-3xl shadow-xl overflow-hidden">
        {/* Lado Esquerdo - Formulário */}
        <div className="flex-1 min-w-0 p-8 sm:p-10 lg:p-14 flex flex-col justify-center">
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
            {t('resetPasswordTitle')}
          </h1>
          <p className="text-gray-500 mb-8">
            {t('resetPasswordSubtitle')}
          </p>

          {success ? (
            <div className="space-y-6">
              <Alert variant="success">
                {t('passwordResetSuccess')}
              </Alert>
              <Link href="/login">
                <Button fullWidth variant="outline">
                  {t('goToLogin')}
                </Button>
              </Link>
            </div>
          ) : !token ? (
            <div className="space-y-6">
              <Alert variant="error">
                {formError || t('invalidOrExpiredLink')}
              </Alert>
              <Link href="/forgot-password">
                <Button fullWidth>
                  {t('requestNewLink')}
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Erro */}
              {formError && (
                <Alert variant="error">
                  {formError}
                </Alert>
              )}

              {/* Nova Senha */}
              <div>
                <Input
                  type="password"
                  placeholder={t('newPassword')}
                  value={password}
                  onChange={handlePasswordChange}
                  disabled={isSubmitting}
                  autoComplete="new-password"
                  autoFocus
                  className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              {/* Confirmar Senha */}
              <div>
                <Input
                  type="password"
                  placeholder={t('confirmNewPassword')}
                  value={confirmPassword}
                  onChange={handleConfirmPasswordChange}
                  disabled={isSubmitting}
                  autoComplete="new-password"
                  className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              {/* Botão Redefinir */}
              <Button
                type="submit"
                fullWidth
                loading={isSubmitting}
                disabled={isSubmitting}
                className="w-full py-3.5 bg-primary hover:bg-primary-700 text-white font-semibold rounded-xl transition-colors"
              >
                {t('resetPassword')}
              </Button>
            </form>
          )}

          {/* Link Voltar para login */}
          {!success && token && (
            <div className="mt-6 text-center">
              <Link href="/login" className="text-primary text-sm hover:underline">
                {t('backToLogin')}
              </Link>
            </div>
          )}
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
                {t('softwareNumber1')}<br />
                {t('forTechnicalServices')}
              </h2>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
