import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate } from 'react-router-dom';

import { UsersApi } from '../api/resources';
import { PageHeader } from '../components/PageHeader';
import { Loading } from '../components/Loading';
import type { User } from '../types';
import { useAuth } from '../context/AuthContext';

const emptyForm = () => ({ email: '', full_name: '', password: '', is_admin: false });

const AdminUsers: React.FC = () => {
  const { isAdmin, currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: UsersApi.list,
    enabled: isAdmin,
  });

  const createUserMutation = useMutation({
    mutationFn: () =>
      UsersApi.create({
        email: form.email,
        password: form.password,
        full_name: form.full_name || undefined,
        is_admin: form.is_admin,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      setFeedback('Usuário criado com sucesso.');
      setError(null);
      setForm(emptyForm());
    },
    onError: (err) => {
      setError((err as Error).message);
      setFeedback(null);
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: { is_admin?: boolean; is_active?: boolean; password?: string };
    }) => UsersApi.update(id, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: number) => UsersApi.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      setFeedback('Usuário excluído.');
      setError(null);
    },
    onError: (err) => {
      setError((err as Error).message);
      setFeedback(null);
    },
  });

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const handleCreateUser = () => {
    if (!form.email.trim() || !form.password.trim()) {
      setError('Informe e-mail e senha para criar o usuário.');
      setFeedback(null);
      return;
    }
    createUserMutation.mutate();
  };

  const handleToggle = (user: User, key: 'is_admin' | 'is_active') => {
    const newValue = key === 'is_admin' ? !user.is_admin : !user.is_active;
    if (key === 'is_active' && currentUser?.id === user.id && !newValue) {
      setError('Você não pode desativar o próprio usuário.');
      setFeedback(null);
      return;
    }
    updateUserMutation.mutate(
      { id: user.id, data: { [key]: newValue } },
      {
        onSuccess: () => {
          setFeedback('Registro atualizado.');
          setError(null);
        },
        onError: (err) => {
          setError((err as Error).message);
          setFeedback(null);
        },
      }
    );
  };

  const handleResetPassword = (user: User) => {
    if (user.is_admin && currentUser?.id !== user.id) {
      setError('Não é possível alterar a senha de outro administrador.');
      setFeedback(null);
      return;
    }
    const newPassword = window.prompt(`Informe a nova senha para ${user.email}`);
    if (!newPassword) {
      return;
    }
    if (newPassword.length < 8) {
      setError('A senha precisa ter ao menos 8 caracteres.');
      setFeedback(null);
      return;
    }
    updateUserMutation.mutate(
      { id: user.id, data: { password: newPassword } },
      {
        onSuccess: () => {
          setFeedback('Senha atualizada com sucesso.');
          setError(null);
        },
        onError: (err) => {
          setError((err as Error).message);
          setFeedback(null);
        },
      }
    );
  };

  const handleDelete = (user: User) => {
    if (user.is_admin) {
      setError('Não é possível excluir outro administrador.');
      setFeedback(null);
      return;
    }
    if (currentUser?.id === user.id) {
      setError('Você não pode excluir o próprio usuário.');
      setFeedback(null);
      return;
    }
    if (!confirm(`Excluir o usuário ${user.email}? Essa ação não pode ser desfeita.`)) {
      return;
    }
    deleteUserMutation.mutate(user.id);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestão de usuários"
        description="Cadastre logins de acesso e defina quem possui permissões administrativas."
      />

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-700">Novo usuário</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-[repeat(4,minmax(0,1fr)),auto]">
          <input
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="E-mail"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            type="email"
          />
          <input
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Nome completo (opcional)"
            value={form.full_name}
            onChange={(event) => setForm((prev) => ({ ...prev, full_name: event.target.value }))}
          />
          <input
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Senha temporária"
            value={form.password}
            onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
            type="password"
          />
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={form.is_admin}
              onChange={(event) => setForm((prev) => ({ ...prev, is_admin: event.target.checked }))}
            />
            Administrador
          </label>
          <button
            type="button"
            onClick={handleCreateUser}
            disabled={createUserMutation.isPending}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            {createUserMutation.isPending ? 'Criando...' : 'Adicionar'}
          </button>
        </div>
        {feedback ? <p className="mt-3 text-sm text-emerald-600">{feedback}</p> : null}
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-700">Usuários cadastrados</h2>
        {usersQuery.isLoading ? (
          <Loading label="Carregando usuários..." />
        ) : usersQuery.isError ? (
          <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">Erro ao carregar usuários.</div>
        ) : usersQuery.data && usersQuery.data.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-slate-600">E-mail</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-600">Nome</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-600">Perfil</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-600">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {usersQuery.data.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-2 text-slate-700">{user.email}</td>
                    <td className="px-4 py-2 text-slate-500">{user.full_name ?? '-'}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          user.is_admin ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {user.is_admin ? 'Administrador' : 'Usuário'}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          user.is_active ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                        }`}
                      >
                        {user.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => handleToggle(user, 'is_admin')}
                        className="rounded-md border border-slate-300 px-3 py-1 text-slate-600 hover:bg-slate-100"
                        disabled={updateUserMutation.isPending || currentUser?.id === user.id}
                      >
                        {user.is_admin ? 'Remover admin' : 'Tornar admin'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggle(user, 'is_active')}
                        className="rounded-md border border-slate-300 px-3 py-1 text-slate-600 hover:bg-slate-100"
                        disabled={updateUserMutation.isPending}
                      >
                        {user.is_active ? 'Desativar' : 'Ativar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResetPassword(user)}
                        className="rounded-md border border-slate-300 px-3 py-1 text-slate-600 hover:bg-slate-100"
                        disabled={updateUserMutation.isPending || (user.is_admin && currentUser?.id !== user.id)}
                      >
                        Redefinir senha
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(user)}
                        className="rounded-md border border-red-300 px-3 py-1 text-red-600 hover:bg-red-50"
                        disabled={deleteUserMutation.isPending || user.is_admin}
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Nenhum usuário encontrado.</p>
        )}
      </section>
    </div>
  );
};

export default AdminUsers;
