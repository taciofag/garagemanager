import { Link } from 'react-router-dom';
import { useState } from 'react';

import { useAuth } from '../context/AuthContext';

export const Header: React.FC = () => {
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm">
      <div className="flex items-center gap-3">
        <button
          className="rounded-md border border-slate-200 p-2 text-slate-600 lg:hidden"
          onClick={() => setOpen((prev) => !prev)}
        >
          ☰
        </button>
        <div className="text-lg font-semibold text-slate-700">Painel de Controle</div>
      </div>
      <div className="flex items-center gap-3">
        <Link
          to="/summary"
          className="hidden rounded-md border border-primary/40 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10 sm:inline-flex"
        >
          Ver resumo
        </Link>
        <button
          onClick={logout}
          className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90"
        >
          Sair
        </button>
      </div>
      {open && (
        <div className="absolute left-0 top-16 w-full border-b border-slate-200 bg-white p-4 lg:hidden">
          <nav className="space-y-2 text-sm">
            {[
              { to: '/', label: 'Painel' },
              { to: '/vehicles', label: 'Veículos' },
              { to: '/drivers', label: 'Motoristas' },
              { to: '/vendors', label: 'Fornecedores' },
              { to: '/rentals', label: 'Aluguéis' },
              { to: '/rent-payments', label: 'Cobranças' },
              { to: '/expenses', label: 'Despesas' },
              { to: '/capital', label: 'Capital' },
              { to: '/cash', label: 'Caixa' },
              { to: '/summary', label: 'Resumo' },
            ].map((item) => (
              <Link key={item.to} to={item.to} className="block rounded-md px-3 py-2 text-slate-600 hover:bg-slate-100">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
};
