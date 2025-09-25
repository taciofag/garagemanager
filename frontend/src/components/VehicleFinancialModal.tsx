import { format } from 'date-fns';

import { VehicleFinancialSummary } from '../types';
import { currencyBRL } from '../utils/formatters';
import { Loading } from './Loading';

interface VehicleFinancialModalProps {
  isOpen: boolean;
  onClose: () => void;
  data?: VehicleFinancialSummary;
  isLoading: boolean;
}

export const VehicleFinancialModal: React.FC<VehicleFinancialModalProps> = ({ isOpen, onClose, data, isLoading }) => {
  if (!isOpen) {
    return null;
  }

  const summary = data;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="flex h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
        <header className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Resumo financeiro do veículo</h3>
            {summary ? (
              <p className="text-xs text-slate-500">
                {summary.vehicle.id} · {summary.vehicle.make} {summary.vehicle.model} · placa {summary.vehicle.plate}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
          >
            Fechar
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isLoading ? (
            <Loading label="Carregando dados financeiros..." />
          ) : !summary ? (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">Não foi possível carregar as informações.</div>
          ) : (
            <div className="space-y-6">
              <section className="grid gap-4 md:grid-cols-3">
                <FinancialCard title="Investimento" value={currencyBRL(summary.acquisition_price)} description="Valor de compra" />
                <FinancialCard title="Despesas" value={currencyBRL(summary.total_expenses)} description="Somatório de gastos" />
                <FinancialCard title="Custo total" value={currencyBRL(summary.total_cost)} description="Compra + despesas" />
                <FinancialCard title="Aluguel recebido" value={currencyBRL(summary.total_rent_paid)} description="Pagamentos" tone="success" />
                <FinancialCard title="Multas" value={currencyBRL(summary.total_late_fee)} description="Juros/multas recebidas" tone="success" />
                <FinancialCard title="Receita total" value={currencyBRL(summary.total_income)} description="Aluguel + multas + venda" tone="success" />
                <FinancialCard
                  title="Resultado"
                  value={currencyBRL(summary.profit ?? '0')}
                  description="Receitas - custos"
                  tone={(summary.profit ?? '0').startsWith('-') ? 'warning' : 'success'}
                />
                {summary.sale_price ? (
                  <FinancialCard
                    title="Venda"
                    value={currencyBRL(summary.sale_price)}
                    description={`Liquidez: ${currencyBRL(summary.sale_net ?? '0')}`}
                  />
                ) : null}
              </section>

              <section className="space-y-3">
                <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Despesas registradas</h4>
                {summary.expenses.length === 0 ? (
                  <div className="rounded-md border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                    Nenhuma despesa cadastrada para este veículo.
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-md border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-3 py-2">Data</th>
                          <th className="px-3 py-2">Categoria</th>
                          <th className="px-3 py-2">Descrição</th>
                          <th className="px-3 py-2 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {summary.expenses.map((expense) => (
                          <tr key={expense.id}>
                            <td className="px-3 py-2 text-slate-600">{format(new Date(expense.date), 'dd/MM/yyyy')}</td>
                            <td className="px-3 py-2 text-slate-600">{expense.category}</td>
                            <td className="px-3 py-2 text-slate-600">{expense.description}</td>
                            <td className="px-3 py-2 text-right font-medium text-slate-700">{currencyBRL(expense.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Cobranças de aluguel</h4>
                {summary.rentals.length === 0 ? (
                  <div className="rounded-md border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                    Nenhuma cobrança registrada para este veículo.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {summary.rentals.map((rental) => (
                      <div key={rental.id} className="rounded-md border border-slate-200">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                          <div className="font-medium text-slate-700">
                            Contrato {rental.id} · Motorista {rental.driver_id}
                          </div>
                          <div className="text-xs text-slate-500">
                            {format(new Date(rental.start_date), 'dd/MM/yyyy')} - {rental.end_date ? format(new Date(rental.end_date), 'dd/MM/yyyy') : 'em aberto'} · {rental.status}
                          </div>
                          <div className="flex gap-3 text-xs text-slate-500">
                            <span>Devido: <strong>{currencyBRL(rental.total_due)}</strong></span>
                            <span>Pago: <strong>{currencyBRL(rental.total_paid)}</strong></span>
                            <span>Multas: <strong>{currencyBRL(rental.total_late_fee)}</strong></span>
                          </div>
                        </div>
                        {rental.payments.length === 0 ? (
                          <div className="px-4 py-3 text-sm text-slate-500">Sem cobranças geradas.</div>
                        ) : (
                          <table className="min-w-full divide-y divide-slate-200 text-sm">
                            <thead className="bg-white text-left text-xs uppercase tracking-wide text-slate-500">
                              <tr>
                                <th className="px-3 py-2">Período</th>
                                <th className="px-3 py-2 text-right">Devido</th>
                                <th className="px-3 py-2 text-right">Pago</th>
                                <th className="px-3 py-2 text-right">Multa</th>
                                <th className="px-3 py-2 text-right">Saldo</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {rental.payments.map((payment) => (
                                <tr key={payment.id}>
                                  <td className="px-3 py-2 text-slate-600">
                                    {format(new Date(payment.period_start), 'dd/MM/yyyy')} - {format(new Date(payment.period_end), 'dd/MM/yyyy')}
                                  </td>
                                  <td className="px-3 py-2 text-right text-slate-600">{currencyBRL(payment.due_amount)}</td>
                                  <td className="px-3 py-2 text-right text-slate-600">{currencyBRL(payment.paid_amount)}</td>
                                  <td className="px-3 py-2 text-right text-slate-600">{currencyBRL(payment.late_fee)}</td>
                                  <td className="px-3 py-2 text-right font-medium text-slate-700">{currencyBRL(payment.balance)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface FinancialCardProps {
  title: string;
  value: string;
  description?: string;
  tone?: 'default' | 'success' | 'warning';
}

const toneClasses: Record<NonNullable<FinancialCardProps['tone']>, string> = {
  default: 'border-slate-200 text-slate-700',
  success: 'border-emerald-200 text-emerald-700',
  warning: 'border-amber-200 text-amber-700',
};

const FinancialCard: React.FC<FinancialCardProps> = ({ title, value, description, tone }) => {
  return (
    <div className={`rounded-lg border bg-white p-4 shadow-sm ${toneClasses[tone ?? 'default']}`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
      {description ? <div className="mt-1 text-xs text-slate-400">{description}</div> : null}
    </div>
  );
};
