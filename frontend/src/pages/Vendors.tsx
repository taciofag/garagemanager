import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';

import { VendorsApi } from '../api/resources';
import { DataTable } from '../components/DataTable';
import { Loading } from '../components/Loading';
import type { Vendor } from '../types';
import { vendorTypeLabel, vendorTypeOptions } from '../utils/labels';

interface VendorForm {
  name: string;
  type: Vendor['type'];
  phone?: string;
  notes?: string;
}


const Vendors: React.FC = () => {
  const queryClient = useQueryClient();
  const vendorsQuery = useQuery({ queryKey: ['vendors'], queryFn: () => VendorsApi.list() });
  const { register, handleSubmit, reset } = useForm<VendorForm>({ defaultValues: { type: 'OTHER' } });

  const createVendor = useMutation({
    mutationFn: (payload: Partial<Vendor>) => VendorsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      reset({ type: 'OTHER' });
    },
  });

  const deleteVendor = useMutation({
    mutationFn: (id: string) => VendorsApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vendors'] }),
  });

  const onSubmit = (data: VendorForm) => {
    createVendor.mutate(data);
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-800">Fornecedores e Serviços</h1>
        <p className="text-sm text-slate-500">Mantenha o cadastro de fornecedores, oficinas e parceiros de serviços.</p>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-700">Novo fornecedor</h2>
        <form className="grid gap-4 md:grid-cols-3" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Nome</label>
            <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('name', { required: true })} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo</label>
            <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('type', { required: true })}>
              {vendorTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Telefone</label>
            <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('phone')} />
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Notas</label>
            <textarea className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('notes')} />
          </div>
          <div className="md:col-span-3">
            <button
              type="submit"
              disabled={createVendor.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-70"
            >
              {createVendor.isPending ? 'Salvando...' : 'Cadastrar fornecedor'}
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-700">Fornecedores cadastrados</h2>
        {vendorsQuery.isLoading ? (
          <Loading label="Carregando fornecedores..." />
        ) : vendorsQuery.isError ? (
          <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">Erro ao carregar fornecedores.</div>
        ) : (
          <DataTable<Vendor>
            data={vendorsQuery.data?.items ?? []}
            columns={[
              { header: 'ID', key: 'id' },
              { header: 'Nome', key: 'name' },
              {
                header: 'Tipo',
                key: 'type',
                render: (item) => vendorTypeLabel(item.type),
              },
              { header: 'Telefone', key: 'phone' },
              {
                header: 'Ações',
                key: 'actions',
                render: (item) => (
                  <button
                    className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                    onClick={() => {
                      if (confirm(`Excluir fornecedor ${item.name}?`)) {
                        deleteVendor.mutate(item.id);
                      }
                    }}
                  >
                    Excluir
                  </button>
                ),
              },
            ]}
          />
        )}
      </section>
    </div>
  );
};

export default Vendors;
