import { useMutation } from '@tanstack/react-query';
import { ChangeEvent, useEffect, useMemo, useState } from 'react';

import { AuthApi } from '../api/resources';
import { PageHeader } from '../components/PageHeader';
import { Loading } from '../components/Loading';
import { useAuth } from '../context/AuthContext';

const apiBase = import.meta.env.VITE_API_BASE_URL ?? '/api';

const placeholderInitial = (email?: string, fullName?: string) => {
  if (fullName) {
    return fullName.charAt(0).toUpperCase();
  }
  if (email) {
    return email.charAt(0).toUpperCase();
  }
  return '?';
};

const Profile: React.FC = () => {
  const { currentUser, refreshCurrentUser } = useAuth();
  const [fullName, setFullName] = useState('');
  const [profileFeedback, setProfileFeedback] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [passwordFeedback, setPasswordFeedback] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    setFullName(currentUser?.full_name ?? '');
  }, [currentUser]);

  const avatarUrl = useMemo(() => {
    if (!currentUser?.avatar_url) {
      return null;
    }
    return `${apiBase}${currentUser.avatar_url}`;
  }, [currentUser]);

  const updateProfile = useMutation({
    mutationFn: () => AuthApi.updateProfile({ full_name: fullName || undefined }),
    onSuccess: async () => {
      await refreshCurrentUser();
      setProfileFeedback('Dados atualizados com sucesso.');
      setProfileError(null);
    },
    onError: (err) => {
      setProfileError((err as Error).message);
      setProfileFeedback(null);
    },
  });

  const uploadAvatar = useMutation({
    mutationFn: (file: File) => AuthApi.uploadAvatar(file),
    onSuccess: async () => {
      await refreshCurrentUser();
      setProfileFeedback('Foto atualizada com sucesso.');
      setProfileError(null);
    },
    onError: (err) => {
      setProfileError((err as Error).message ?? 'Falha ao enviar a foto.');
      setProfileFeedback(null);
    },
  });

  const changePassword = useMutation({
    mutationFn: () => AuthApi.changePassword({ current_password: currentPassword, new_password: newPassword }),
    onSuccess: () => {
      setPasswordFeedback('Senha alterada com sucesso.');
      setPasswordError(null);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (err) => {
      setPasswordError((err as Error).message ?? 'Não foi possível alterar a senha.');
      setPasswordFeedback(null);
    },
  });

  if (!currentUser) {
    return <Loading label="Carregando perfil..." />;
  }

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setProfileError('Selecione uma imagem de até 5MB.');
      setProfileFeedback(null);
      return;
    }
    uploadAvatar.mutate(file);
    event.target.value = '';
  };

  const handleProfileSubmit = () => {
    updateProfile.mutate();
  };

  const handlePasswordSubmit = () => {
    if (!newPassword || newPassword.length < 8) {
      setPasswordError('A nova senha precisa ter pelo menos 8 caracteres.');
      setPasswordFeedback(null);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('As senhas não conferem.');
      setPasswordFeedback(null);
      return;
    }
    changePassword.mutate();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Meu perfil" description="Atualize seus dados pessoais, foto e senha de acesso." />

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr),minmax(0,1fr)]">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-700">Dados pessoais</h2>
          <p className="mt-1 text-sm text-slate-500">Seu e-mail é usado para login e notificações.</p>

          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">E-mail</label>
              <input value={currentUser.email} disabled className="mt-1 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Nome completo</label>
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Informe como deseja ser identificado"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={handleProfileSubmit}
              disabled={updateProfile.isPending}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {updateProfile.isPending ? 'Salvando...' : 'Salvar alterações'}
            </button>
            {profileFeedback ? <p className="text-sm text-emerald-600">{profileFeedback}</p> : null}
            {profileError ? <p className="text-sm text-red-600">{profileError}</p> : null}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-700">Foto de perfil</h2>
          <p className="mt-1 text-sm text-slate-500">Formatos aceitos: JPG, PNG ou WEBP até 5MB.</p>

          <div className="mt-4 flex items-center gap-4">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar do usuário" className="h-20 w-20 rounded-full object-cover shadow-sm" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-100 text-lg font-semibold text-indigo-600 shadow-sm">
                {placeholderInitial(currentUser.email, currentUser.full_name)}
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Atualizar foto</label>
              <input type="file" className="mt-2 text-sm" accept="image/png,image/jpeg,image/webp" onChange={handleAvatarChange} />
              {uploadAvatar.isPending ? <p className="mt-1 text-xs text-slate-500">Enviando...</p> : null}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-700">Alterar senha</h2>
        <p className="mt-1 text-sm text-slate-500">Use uma senha forte e não compartilhe com outras pessoas.</p>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Senha atual</label>
            <input
              type="password"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Nova senha</label>
            <input
              type="password"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Confirmar nova senha</label>
            <input
              type="password"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handlePasswordSubmit}
            disabled={changePassword.isPending}
            className="rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
          >
            {changePassword.isPending ? 'Atualizando...' : 'Atualizar senha'}
          </button>
          {passwordFeedback ? <span className="text-sm text-emerald-600">{passwordFeedback}</span> : null}
          {passwordError ? <span className="text-sm text-red-600">{passwordError}</span> : null}
        </div>
      </section>
    </div>
  );
};

export default Profile;
