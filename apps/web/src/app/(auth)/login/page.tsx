'use client';

/**
 * Página de Login - Design Auvo
 *
 * Layout de duas colunas:
 * - Esquerda: Formulário de login
 * - Direita: Carrossel promocional
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
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Slides do carrossel promocional
const PROMO_SLIDES = [
  {
    id: 1,
    title: 'Indique',
    subtitle: '&Ganhe',
    description: 'Ganhe R$ 300 por indicação',
    details: 'Simples assim: indicou, contratou, ganhou.',
    bgGradient: 'from-primary-600 via-primary-700 to-primary-800',
  },
  {
    id: 2,
    title: 'Gestão',
    subtitle: 'Completa',
    description: 'Controle total do seu negócio',
    details: 'Ordens de serviço, clientes, cobranças e muito mais.',
    bgGradient: 'from-primary-700 via-primary-800 to-primary-900',
  },
];

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading: authLoading, error: authError, clearError } = useAuth();
  const { t } = useTranslations('auth');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const submitTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasRedirectedRef = useRef(false);

  // Auto-advance carrossel
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % PROMO_SLIDES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

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

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % PROMO_SLIDES.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + PROMO_SLIDES.length) % PROMO_SLIDES.length);

  // Loading inicial
  if (!initialLoadDone && authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-primary">{t('loading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Lado Esquerdo - Formulário */}
      <div className="flex-1 flex flex-col justify-center px-8 lg:px-16 xl:px-24">
        {/* Header com Logo e CTA */}
        <div className="absolute top-0 left-0 right-0 lg:right-1/2 flex items-center justify-between p-6">
          <Link href="/" className="text-2xl font-bold text-primary">
            auvo
          </Link>
          <Link
            href="/register"
            className="hidden sm:inline-flex items-center px-5 py-2.5 border-2 border-primary text-primary rounded-full font-medium hover:bg-primary hover:text-white transition-colors"
          >
            Teste o Auvo grátis
          </Link>
        </div>

        {/* Formulário */}
        <div className="max-w-md w-full mx-auto">
          <div className="bg-white rounded-2xl shadow-lg p-8 lg:p-10">
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
                  className="w-full px-4 py-3.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
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
                  className="w-full px-4 py-3.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              {/* Divisor SSO */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-3 bg-white text-gray-400">ou entre com SSO</span>
                </div>
              </div>

              {/* Botão SSO */}
              <button
                type="button"
                className="w-full px-4 py-3.5 border border-gray-300 rounded-lg text-primary font-medium hover:bg-gray-50 transition-colors"
                onClick={() => {
                  // TODO: Implementar SSO
                }}
              >
                Entrar com SSO
              </button>

              {/* Botão Entrar */}
              <Button
                type="submit"
                fullWidth
                loading={isSubmitting}
                disabled={isSubmitting}
                className="w-full py-3.5 bg-primary hover:bg-primary-700 text-white font-semibold rounded-lg transition-colors"
              >
                Entrar
              </Button>
            </form>

            {/* Links */}
            <div className="mt-6 text-center space-y-3">
              <p className="text-gray-500">
                Quer conhecer o Auvo?{' '}
                <Link href="/register" className="text-primary font-medium hover:underline">
                  Solicite uma demonstração
                </Link>
              </p>
              <div className="flex items-center justify-center gap-4 text-sm">
                <Link href="/forgot-password" className="text-primary hover:underline">
                  Esqueceu sua senha?
                </Link>
                <span className="text-gray-300">v.2.60.3</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lado Direito - Carrossel Promocional */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[45%] relative overflow-hidden">
        {/* Background com padrão de ondas */}
        <div className={`absolute inset-0 bg-gradient-to-br ${PROMO_SLIDES[currentSlide].bgGradient}`}>
          {/* Padrão de ondas circulares */}
          <div className="absolute inset-0 opacity-20">
            <svg className="w-full h-full" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice">
              {[...Array(8)].map((_, i) => (
                <circle
                  key={i}
                  cx="200"
                  cy="300"
                  r={80 + i * 40}
                  fill="none"
                  stroke="white"
                  strokeWidth="1"
                  opacity={0.3 - i * 0.03}
                />
              ))}
            </svg>
          </div>
        </div>

        {/* Conteúdo do Slide */}
        <div className="relative z-10 flex flex-col justify-center items-center w-full p-12 text-white">
          {/* Card do Slide */}
          <div className="w-full max-w-md">
            {/* Título estilizado */}
            <div className="mb-8 text-center">
              <div className="inline-block bg-white/10 backdrop-blur-sm rounded-3xl p-8 mb-6">
                <h2 className="text-5xl xl:text-6xl font-bold leading-tight">
                  {PROMO_SLIDES[currentSlide].title}
                </h2>
                <p className="text-4xl xl:text-5xl font-bold text-primary-200">
                  {PROMO_SLIDES[currentSlide].subtitle}
                </p>
              </div>
            </div>

            {/* Descrição */}
            <div className="text-center">
              <h3 className="text-2xl xl:text-3xl font-bold mb-3">
                {PROMO_SLIDES[currentSlide].description}
              </h3>
              <p className="text-lg text-white/80">
                {PROMO_SLIDES[currentSlide].details}
              </p>
            </div>
          </div>

          {/* Controles do Carrossel */}
          <div className="absolute bottom-12 left-0 right-0 flex items-center justify-between px-12">
            {/* Indicadores */}
            <div className="flex items-center gap-2">
              <span className="text-white font-medium">{currentSlide + 1}</span>
              <span className="text-white/50">de</span>
              <span className="text-white/50">{PROMO_SLIDES.length}</span>
            </div>

            {/* Botões */}
            <div className="flex items-center gap-3">
              <button
                onClick={prevSlide}
                className="w-10 h-10 rounded-full border border-white/30 flex items-center justify-center hover:bg-white/10 transition-colors"
                aria-label="Slide anterior"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={nextSlide}
                className="w-10 h-10 rounded-full border border-white/30 flex items-center justify-center hover:bg-white/10 transition-colors"
                aria-label="Próximo slide"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
