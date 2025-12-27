'use client';

/**
 * Página de Recuperação de Senha - Design Auvo
 *
 * Layout centralizado com card contendo:
 * - Esquerda: Formulário de recuperação
 * - Direita: Imagem promocional com bordas arredondadas
 */

import { useState, FormEvent, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from '@/i18n';
import {
  Button,
  Input,
  Alert,
} from '@/components/ui';

export default function ForgotPasswordPage() {
  const { t } = useTranslations('auth');

  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (formError) setFormError(null);
  }, [formError]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      setFormError(t('enterEmail'));
      return;
    }

    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!emailRegex.test(email.trim())) {
      setFormError(t('enterValidEmail'));
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || t('errorSendingEmail'));
      }

      setSuccess(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('errorSendingEmail'));
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
            {t('recoverPassword')}
          </h1>
          <p className="text-gray-500 mb-8">
            {t('recoverPasswordSubtitle')}
          </p>

          {success ? (
            <div className="space-y-6">
              <Alert variant="success">
                {t('emailSentSuccess')}
              </Alert>
              <Link href="/login">
                <Button fullWidth variant="outline">
                  {t('backToLogin')}
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

              {/* Email */}
              <div>
                <Input
                  type="email"
                  placeholder={t('emailInputPlaceholder')}
                  value={email}
                  onChange={handleEmailChange}
                  disabled={isSubmitting}
                  autoComplete="email"
                  autoFocus
                  className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              {/* Botão Enviar */}
              <Button
                type="submit"
                fullWidth
                loading={isSubmitting}
                disabled={isSubmitting}
                className="w-full py-3.5 bg-primary hover:bg-primary-700 text-white font-semibold rounded-xl transition-colors"
              >
                {t('sendInstructions')}
              </Button>
            </form>
          )}

          {/* Link Voltar para login */}
          {!success && (
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
