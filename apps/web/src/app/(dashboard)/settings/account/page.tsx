'use client';

/**
 * Account Settings Page
 *
 * Configurações de conta do usuário:
 * - Nome, email, telefone
 * - Idioma
 * - Configurações regionais (país, moeda, fuso horário)
 * - Alteração de senha
 */

import { useState, useEffect } from 'react';
import { User, Mail, Globe, Key, Check, AlertCircle } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  FormField,
  Alert,
  Skeleton,
} from '@/components/ui';
import { RegionalSettingsForm } from '@/components/settings';
import {
  useProfile,
  useUpdateProfile,
  useChangePassword,
} from '@/hooks/use-settings';
import { useTranslations, useLocale, localeNames, type Locale } from '@/i18n';

// Idiomas
const LANGUAGES = Object.entries(localeNames).map(([value, label]) => ({
  value,
  label,
}));

export default function AccountSettingsPage() {
  const { t } = useTranslations('settings');
  const { t: tCommon } = useTranslations('common');
  const { t: tAuth } = useTranslations('auth');
  const { locale, setLocale } = useLocale();
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();

  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [language, setLanguage] = useState<Locale>('pt-BR');
  const [profileSaved, setProfileSaved] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);

  // Load profile data and sync locale
  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setPhone(profile.phone || '');
      const profileLang = (profile.language || 'pt-BR') as Locale;
      setLanguage(profileLang);

      // Sync locale with profile language if different
      if (profileLang !== locale) {
        setLocale(profileLang);
      }
    }
  }, [profile, locale, setLocale]);

  const handleSaveProfile = async () => {
    try {
      await updateProfile.mutateAsync({
        name,
        phone: phone || undefined,
        language,
      });

      // Update locale when language changes
      if (language !== locale) {
        setLocale(language);
      }

      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError(null);

    if (!currentPassword) {
      setPasswordError(t('currentPassword') + ' ' + tCommon('required').toLowerCase());
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError(t('passwordMinLength'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(tAuth('passwordMismatch'));
      return;
    }

    try {
      await changePassword.mutateAsync({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSaved(true);
      setTimeout(() => setPasswordSaved(false), 3000);
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : t('passwordError'));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dados da conta */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {t('accountSettings')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label={t('fullName')}>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('fullName')}
                  className="pl-10"
                />
              </div>
            </FormField>

            <FormField label={t('email')}>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={profile?.email || ''}
                  disabled
                  className="pl-10 bg-gray-50"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {t('emailCannotBeChanged')}
              </p>
            </FormField>

            <FormField label={t('phone')}>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </FormField>

            <FormField label={t('language')}>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as Locale)}
                  className="w-full h-10 pl-10 pr-4 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.value} value={lang.value}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>
            </FormField>
          </div>

          {profileSaved && (
            <Alert variant="success">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4" />
                {t('profileSaved')}
              </div>
            </Alert>
          )}

          {updateProfile.error && (
            <Alert variant="error">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {t('profileError')}
              </div>
            </Alert>
          )}

          <div className="flex justify-end">
            <Button
              onClick={handleSaveProfile}
              loading={updateProfile.isPending}
              leftIcon={<Check className="h-4 w-4" />}
            >
              {tCommon('save')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Configurações Regionais */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {t('regionalSettings')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-4">
            {t('regionalSettingsDescription')}
          </p>
          <RegionalSettingsForm />
        </CardContent>
      </Card>

      {/* Alterar senha */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            {t('changePassword')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label={t('currentPassword')}>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
              />
            </FormField>

            <FormField label={t('newPassword')}>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
              />
            </FormField>

            <FormField label={t('confirmNewPassword')}>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
            </FormField>
          </div>

          <p className="text-xs text-gray-500">
            {t('passwordMinLength')}
          </p>

          {passwordError && (
            <Alert variant="error">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {passwordError}
              </div>
            </Alert>
          )}

          {passwordSaved && (
            <Alert variant="success">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4" />
                {t('passwordChanged')}
              </div>
            </Alert>
          )}

          <div className="flex justify-end">
            <Button
              onClick={handleChangePassword}
              loading={changePassword.isPending}
              disabled={!currentPassword || !newPassword || !confirmPassword}
              variant="outline"
              leftIcon={<Key className="h-4 w-4" />}
            >
              {t('changePassword')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
