import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { CashCategoriesApi } from '../api/resources';
import type { CashCategory } from '../types';
import { Loading } from './Loading';

interface CashCategoryManagerProps {
  open: boolean;
  onClose: () => void;
}

export const CashCategoryManager: React.FC<CashCategoryManagerProps> = ({ open, onClose }) => {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setName('');
      setDescription('');
      setFeedback(null);
      setError(null);
    }
  }, [open]);

  const categoriesQuery = useQuery({
    queryKey: ['cash-categories', 'admin'],
    queryFn: () => CashCategoriesApi.list(true),
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: () => CashCategoriesApi.create({ name, description: description || undefined }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['cash-categories', 'admin'] });
      await queryClient.invalidateQueries({ queryKey: ['cash-categories'] });
      setName('');
      setDescription('');
      setFeedback('Categoria criada com sucesso.');
      setError(null);
    },
    onError: (err) => {
      setError((err as Error).message);
      setFeedback(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { is_active?: boolean } }) => CashCategoriesApi.update(id, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['cash-categories', 'admin'] });
      await queryClient.invalidateQueries({ queryKey: ['cash-categories'] });
      setFeedback('Categoria atualizada.');
      setError(null);
    },
    onError: (err) => {
      setError((err as Error).message);
      setFeedback(null);
    },
  });

  if (!open) {
    return null;
  }

  const handleToggleActive = (category: CashCategory) => {
    updateMutation.mutate({ id: category.id, data: { is_active: !category.is_active } });
  };

  const handleCreate = () => {
    if (!name.trim()) {
      setError('Informe um nome para a categoria.');
      setFeedback(null);
      return;
    }
    createMutation.mutate();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
        <header className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Categorias do livro-caixa</h3>
            <p className="text-xs text-slate-500">Organize as categorias utilizadas nas entradas e saídas.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
          >
            Fechar
          </button>
        </header>

        <div className="flex flex-col gap-4 overflow-y-auto px-6 py-5">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <h4 className="text-sm font-semibold text-slate-700">Nova categoria</h4>
            <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,2fr),minmax(0,3fr),minmax(0,1fr)]">
              <input
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Nome"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <input
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Descrição (opcional)"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
              <button
                type="button"
                onClick={handleCreate}
                disabled={createMutation.isPending}
                className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-60"
              >
                {createMutation.isPending ? 'Salvando...' : 'Adicionar'}
              </button>
            </div>
          </div>

          {feedback ? <div className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-600">{feedback}</div> : null}
          {error ? <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div> : null}

          {categoriesQuery.isLoading ? (
            <Loading label="Carregando categorias..." />
          ) : categoriesQuery.isError ? (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">Erro ao carregar categorias.</div>
          ) : (
            <ul className="divide-y divide-slate-200 text-sm">
              {(categoriesQuery.data ?? []).map((category) => (
                <li key={category.id} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <p className="font-medium text-slate-700">
                      {category.name}{' '}
                      {category.is_system ? (
                        <span className="text-xs font-normal uppercase tracking-wide text-slate-400">Sistema</span>
                      ) : null}
                    </p>
                    {category.description ? (
                      <p className="text-xs text-slate-500">{category.description}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        category.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {category.is_active ? 'Ativa' : 'Inativa'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(category)}
                      disabled={category.is_system || updateMutation.isPending}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-60"
                    >
                      {category.is_active ? 'Desativar' : 'Ativar'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
