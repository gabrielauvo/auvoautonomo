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

// Helper para formatar data
function formatLastActive(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Agora';
  if (diffMins < 60) return `Há ${diffMins} minutos`;
  if (diffHours < 24) return `Há ${diffHours} horas`;
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 7) return `Há ${diffDays} dias`;

  return date.toLocaleDateString('pt-BR');
}

export default function SecuritySettingsPage() {
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
      setPasswordError('Informe a senha atual');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('A nova senha deve ter pelo menos 8 caracteres');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('As senhas não conferem');
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
      setPasswordError(error instanceof Error ? error.message : 'Erro ao alterar senha');
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
    if (deleteConfirmText !== 'EXCLUIR MINHA CONTA') {
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
    ? new Date(securityInfo.lastPasswordChange).toLocaleDateString('pt-BR')
    : 'Nunca alterada';

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
            Alteração de Senha
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-500 mb-4">
            Última alteração: <span className="font-medium">{lastPasswordChange}</span>
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="Senha atual">
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
              />
            </FormField>

            <FormField label="Nova senha">
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
              />
            </FormField>

            <FormField label="Confirmar nova senha">
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
            </FormField>
          </div>

          <p className="text-xs text-gray-500">
            A senha deve ter pelo menos 8 caracteres. Recomendamos usar letras maiúsculas,
            minúsculas, números e caracteres especiais.
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
                Senha alterada com sucesso!
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
              Alterar senha
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
              Sessões Ativas
            </CardTitle>
            {otherSessions.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="text-error border-error hover:bg-error/5"
                onClick={() => setShowLogoutAllConfirm(true)}
                leftIcon={<LogOut className="h-4 w-4" />}
              >
                Encerrar todas
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
              />
            )}

            {/* Outras sessões */}
            {otherSessions.length > 0 && (
              <>
                <div className="border-t pt-4 mt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-4">
                    Outras sessões ({otherSessions.length})
                  </h4>
                  <div className="space-y-3">
                    {otherSessions.map((session) => (
                      <SessionItem
                        key={session.id}
                        session={session}
                        isCurrent={false}
                        onRevoke={() => handleRevokeSession(session.id)}
                        isRevoking={revokingSessionId === session.id}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}

            {sessions.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                Nenhuma sessão ativa encontrada
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
            Zona de Perigo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-4 border border-error/20 rounded-lg bg-error/5">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-medium text-gray-900">Excluir conta</h4>
                <p className="text-sm text-gray-500 mt-1">
                  Esta ação é permanente e não pode ser desfeita. Todos os seus dados,
                  incluindo clientes, orçamentos, OS e cobranças serão excluídos.
                </p>
              </div>
              <Button
                variant="error"
                size="sm"
                onClick={() => setShowDeleteAccountConfirm(true)}
                leftIcon={<Trash2 className="h-4 w-4" />}
              >
                Excluir conta
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
                Encerrar todas as sessões
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="warning">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium">Atenção!</p>
                    <p>
                      Todas as sessões serão encerradas, exceto esta.
                      Você precisará fazer login novamente em outros dispositivos.
                    </p>
                  </div>
                </div>
              </Alert>

              <div className="flex justify-end gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setShowLogoutAllConfirm(false)}
                >
                  Cancelar
                </Button>
                <Button
                  variant="error"
                  onClick={handleLogoutAll}
                  loading={logoutAll.isPending}
                >
                  Encerrar sessões
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
                Excluir Conta Permanentemente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="error">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium">Esta ação não pode ser desfeita!</p>
                    <p>
                      Todos os dados da sua conta serão permanentemente excluídos,
                      incluindo clientes, orçamentos, ordens de serviço, cobranças
                      e configurações.
                    </p>
                  </div>
                </div>
              </Alert>

              <FormField label="Digite sua senha para confirmar">
                <Input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="••••••••"
                />
              </FormField>

              <FormField label="Digite 'EXCLUIR MINHA CONTA' para confirmar">
                <Input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="EXCLUIR MINHA CONTA"
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
                  Cancelar
                </Button>
                <Button
                  variant="error"
                  onClick={handleDeleteAccount}
                  disabled={
                    !deletePassword ||
                    deleteConfirmText !== 'EXCLUIR MINHA CONTA'
                  }
                >
                  Excluir minha conta
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
}

function SessionItem({ session, isCurrent, onRevoke, isRevoking }: SessionItemProps) {
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
                Sessão atual
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
              {formatLastActive(session.lastActive)}
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
          Encerrar
        </Button>
      )}
    </div>
  );
}
