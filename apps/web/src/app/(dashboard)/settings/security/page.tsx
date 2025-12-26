'use client';

/**
 * Security Settings Page
 *
 * Configurações de segurança:
 * - Alteração de senha
 * - Gerenciamento de sessões
 * - Logout de todas as sessões
 * - Exclusão de conta
 */

import { useState } from 'react';
import {
  Shield,
  Key,
  LogOut,
  Monitor,
  Smartphone,
  Laptop,
  Trash2,
  AlertTriangle,
  Check,
  AlertCircle,
  Clock,
  MapPin,
  Globe,
} from 'lucide-react';
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
  Badge,
} from '@/components/ui';
import {
  useSecurityInfo,
  useChangePassword,
  useLogoutAllSessions,
  useRevokeSession,
} from '@/hooks/use-settings';
import { cn } from '@/lib/utils';
import { SessionInfo } from '@/services/settings.service';
import { useTranslations } from '@/i18n';

// Helper para determinar ícone do dispositivo
function getDeviceIcon(device: string) {
  const deviceLower = device.toLowerCase();
  if (deviceLower.includes('mobile') || deviceLower.includes('phone')) {
    return Smartphone;
  }
  if (deviceLower.includes('tablet') || deviceLower.includes('ipad')) {
    return Monitor;
  }
  return Laptop;
}

// Helper para formatar data - now uses translation function
function formatLastActive(dateString: string, t: (key: string, params?: Record<string, string | number>) => string, locale: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return t('now');
  if (diffMins < 60) return t('minutesAgo', { minutes: diffMins });
  if (diffHours < 24) return t('hoursAgo', { hours: diffHours });
  if (diffDays === 1) return t('yesterday');
  if (diffDays < 7) return t('daysAgo', { days: diffDays });

  return date.toLocaleDateString(locale);
}

export default function SecuritySettingsPage() {
  const { t, locale } = useTranslations('settings.securityPage');
  const { data: securityInfo, isLoading } = useSecurityInfo();
  const changePassword = useChangePassword();
  const logoutAll = useLogoutAllSessions();
  const revokeSession = useRevokeSession();

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);

  // Modal states
  const [showLogoutAllConfirm, setShowLogoutAllConfirm] = useState(false);
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Session being revoked
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);

  const handleChangePassword = async () => {
    setPasswordError(null);

    if (!currentPassword) {
      setPasswordError(t('enterCurrentPassword'));
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError(t('newPasswordMinLength'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(t('passwordsDontMatch'));
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
      setPasswordError(error instanceof Error ? error.message : t('passwordChangeError'));
    }
  };

  const handleLogoutAll = async () => {
    try {
      await logoutAll.mutateAsync();
      setShowLogoutAllConfirm(false);
    } catch (error) {
      console.error('Erro ao encerrar sessões:', error);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    setRevokingSessionId(sessionId);
    try {
      await revokeSession.mutateAsync(sessionId);
    } catch (error) {
      console.error('Erro ao revogar sessão:', error);
    } finally {
      setRevokingSessionId(null);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== t('deleteConfirmText')) {
      return;
    }

    // Note: Delete account would be implemented here
    // This is typically handled with extra care and verification
    console.log('Deletar conta com senha:', deletePassword);
    setShowDeleteAccountConfirm(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const lastPasswordChange = securityInfo?.lastPasswordChange
    ? new Date(securityInfo.lastPasswordChange).toLocaleDateString(locale)
    : t('neverChanged');

  const sessions = securityInfo?.activeSessions || [];
  const currentSession = sessions.find((s) => s.current);
  const otherSessions = sessions.filter((s) => !s.current);

  return (
    <div className="space-y-6">
      {/* Alteração de senha */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            {t('passwordChange')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-500 mb-4">
            {t('lastChange')}: <span className="font-medium">{lastPasswordChange}</span>
          </p>

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
            {t('passwordHint')}
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
              leftIcon={<Key className="h-4 w-4" />}
            >
              {t('changePassword')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sessões ativas */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {t('activeSessions')}
            </CardTitle>
            {otherSessions.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="text-error border-error hover:bg-error/5"
                onClick={() => setShowLogoutAllConfirm(true)}
                leftIcon={<LogOut className="h-4 w-4" />}
              >
                {t('endAllSessions')}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Sessão atual */}
            {currentSession && (
              <SessionItem
                session={currentSession}
                isCurrent
                onRevoke={() => {}}
                isRevoking={false}
                t={t}
                locale={locale}
              />
            )}

            {/* Outras sessões */}
            {otherSessions.length > 0 && (
              <>
                <div className="border-t pt-4 mt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-4">
                    {t('otherSessions')} ({otherSessions.length})
                  </h4>
                  <div className="space-y-3">
                    {otherSessions.map((session) => (
                      <SessionItem
                        key={session.id}
                        session={session}
                        isCurrent={false}
                        onRevoke={() => handleRevokeSession(session.id)}
                        isRevoking={revokingSessionId === session.id}
                        t={t}
                        locale={locale}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}

            {sessions.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                {t('noActiveSessions')}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Zona de perigo */}
      <Card className="border-error/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-error">
            <AlertTriangle className="h-5 w-5" />
            {t('dangerZone')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-4 border border-error/20 rounded-lg bg-error/5">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-medium text-gray-900">{t('deleteAccount')}</h4>
                <p className="text-sm text-gray-500 mt-1">
                  {t('deleteAccountDescription')}
                </p>
              </div>
              <Button
                variant="error"
                size="sm"
                onClick={() => setShowDeleteAccountConfirm(true)}
                leftIcon={<Trash2 className="h-4 w-4" />}
              >
                {t('deleteAccountButton')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal de confirmação - Logout All */}
      {showLogoutAllConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LogOut className="h-5 w-5" />
                {t('endAllSessionsTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="warning">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium">{t('endAllSessionsWarning')}</p>
                    <p>
                      {t('endAllSessionsMessage')}
                    </p>
                  </div>
                </div>
              </Alert>

              <div className="flex justify-end gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setShowLogoutAllConfirm(false)}
                >
                  {t('cancel')}
                </Button>
                <Button
                  variant="error"
                  onClick={handleLogoutAll}
                  loading={logoutAll.isPending}
                >
                  {t('endSessions')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal de confirmação - Delete Account */}
      {showDeleteAccountConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-error">
                <Trash2 className="h-5 w-5" />
                {t('deleteAccountPermanently')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="error">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium">{t('deleteAccountCannotUndo')}</p>
                    <p>
                      {t('deleteAccountDataWarning')}
                    </p>
                  </div>
                </div>
              </Alert>

              <FormField label={t('enterPasswordToConfirm')}>
                <Input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="••••••••"
                />
              </FormField>

              <FormField label={t('typeDeleteMyAccount')}>
                <Input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={t('deleteConfirmText')}
                />
              </FormField>

              <div className="flex justify-end gap-3">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowDeleteAccountConfirm(false);
                    setDeletePassword('');
                    setDeleteConfirmText('');
                  }}
                >
                  {t('cancel')}
                </Button>
                <Button
                  variant="error"
                  onClick={handleDeleteAccount}
                  disabled={
                    !deletePassword ||
                    deleteConfirmText !== t('deleteConfirmText')
                  }
                >
                  {t('deleteMyAccount')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// Componente de item de sessão
interface SessionItemProps {
  session: SessionInfo;
  isCurrent: boolean;
  onRevoke: () => void;
  isRevoking: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
  locale: string;
}

function SessionItem({ session, isCurrent, onRevoke, isRevoking, t, locale }: SessionItemProps) {
  const DeviceIcon = getDeviceIcon(session.device);

  return (
    <div
      className={cn(
        'flex items-start justify-between p-4 rounded-lg border',
        isCurrent ? 'bg-primary-50 border-primary-200' : 'bg-white'
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'p-2 rounded-lg',
            isCurrent ? 'bg-primary-100' : 'bg-gray-100'
          )}
        >
          <DeviceIcon
            className={cn(
              'h-5 w-5',
              isCurrent ? 'text-primary' : 'text-gray-500'
            )}
          />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900">
              {session.device}
            </span>
            {isCurrent && (
              <Badge variant="primary" size="sm">
                {t('currentSession')}
              </Badge>
            )}
          </div>
          <p className="text-sm text-gray-500">
            {session.browser}
          </p>
          <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
            {session.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {session.location}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatLastActive(session.lastActive, t, locale)}
            </span>
          </div>
        </div>
      </div>

      {!isCurrent && (
        <Button
          variant="ghost"
          size="sm"
          className="text-error hover:bg-error/5"
          onClick={onRevoke}
          loading={isRevoking}
        >
          {t('endSession')}
        </Button>
      )}
    </div>
  );
}
