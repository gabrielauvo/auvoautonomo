'use client';

/**
 * Página de Registro
 *
 * Tela de cadastro com:
 * - Formulário de nome/email/senha
 * - Campos opcionais (empresa, telefone)
 * - Componentes do design system
 * - Tratamento de erros
 * - Loading state
 */

import { useState, FormEvent, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
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
import { Mail, Lock, Eye, EyeOff, User, Building, Phone } from 'lucide-react';
import { useTranslations } from '@/i18n';

export default function RegisterPage() {
  const router = useRouter();
  const { register, isAuthenticated, isLoading: authLoading, error, clearError } = useAuth();
  const { t } = useTranslations('auth');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const submitTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Redireciona se já autenticado
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, authLoading, router]);

  // Limpa erro ao mudar campos
  useEffect(() => {
    if (formError || error) {
      setFormError(null);
      clearError();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, email, password, confirmPassword]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Previne cliques duplos com debounce
    if (submitTimeoutRef.current) {
      return;
    }

    // Validação do nome
    if (!name.trim()) {
      setFormError(t('nameRequired'));
      return;
    }

    // Validação do email
    if (!email.trim()) {
      setFormError(t('emailRequired'));
      return;
    }

    // Validação de formato de email com regex robusto
    // RFC 5322 simplificado - aceita caracteres especiais válidos
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!emailRegex.test(email.trim())) {
      setFormError(t('invalidEmail'));
      return;
    }

    // Validação da senha
    if (!password) {
      setFormError(t('passwordRequired'));
      return;
    }

    if (password.length < 6) {
      setFormError(t('passwordMinLength'));
      return;
    }

    // Validação de confirmação de senha
    if (password !== confirmPassword) {
      setFormError(t('passwordMismatch'));
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    // Debounce de 500ms para prevenir submits duplicados
    submitTimeoutRef.current = setTimeout(() => {
      submitTimeoutRef.current = null;
    }, 500);

    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
        companyName: companyName.trim() || undefined,
        phone: phone.trim() || undefined,
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('registerError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading inicial
  if (authLoading) {
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
          <p className="text-gray-500 mt-2">Sistema de Gestão para Autônomos</p>
        </div>

        {/* Card de Registro */}
        <Card variant="elevated" padding="lg">
          <CardHeader>
            <CardTitle className="text-center">{t('createAccount')}</CardTitle>
            <CardDescription className="text-center">
              {t('fillDataToStart')}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Erro */}
              {(formError || error) && (
                <Alert variant="error">
                  {formError || error}
                </Alert>
              )}

              {/* Nome */}
              <FormField label={t('name')} required>
                <Input
                  type="text"
                  placeholder={t('namePlaceholder')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  leftIcon={<User className="h-4 w-4" />}
                  disabled={isSubmitting}
                  autoComplete="name"
                  autoFocus
                />
              </FormField>

              {/* Email */}
              <FormField label={t('email')} required>
                <Input
                  type="email"
                  placeholder={t('emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  leftIcon={<Mail className="h-4 w-4" />}
                  disabled={isSubmitting}
                  autoComplete="email"
                />
              </FormField>

              {/* Empresa (opcional) */}
              <FormField label={t('company')} hint={t('optional')}>
                <Input
                  type="text"
                  placeholder={t('companyPlaceholder')}
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  leftIcon={<Building className="h-4 w-4" />}
                  disabled={isSubmitting}
                  autoComplete="organization"
                />
              </FormField>

              {/* Telefone (opcional) */}
              <FormField label={t('phone')} hint={t('optional')}>
                <Input
                  type="tel"
                  placeholder={t('phonePlaceholder')}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  leftIcon={<Phone className="h-4 w-4" />}
                  disabled={isSubmitting}
                  autoComplete="tel"
                />
              </FormField>

              {/* Senha */}
              <FormField label={t('password')} required hint={t('passwordHint')}>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('passwordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
                  autoComplete="new-password"
                />
              </FormField>

              {/* Confirmar Senha */}
              <FormField label={t('confirmPassword')} required>
                <Input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder={t('confirmPasswordPlaceholder')}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  leftIcon={<Lock className="h-4 w-4" />}
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="hover:text-gray-600"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  }
                  disabled={isSubmitting}
                  autoComplete="new-password"
                />
              </FormField>

              {/* Botão de registro */}
              <Button
                type="submit"
                fullWidth
                loading={isSubmitting}
                disabled={isSubmitting}
              >
                {isSubmitting ? t('creatingAccount') : t('createAccount')}
              </Button>
            </form>

            {/* Link para login */}
            <div className="mt-6 text-center text-sm text-gray-500">
              {t('hasAccount')}{' '}
              <Link href="/login" className="text-primary hover:text-primary-700 font-medium">
                {t('login')}
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          &copy; {new Date().getFullYear()} Auvo. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
