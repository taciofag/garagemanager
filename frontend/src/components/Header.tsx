import { Link, NavLink, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';

import { useAuth } from '../context/AuthContext';

const navItems: Array<{ to: string; label: string; adminOnly?: boolean }> = [
  { to: '/', label: 'Painel' },
  { to: '/profile', label: 'Perfil' },
  { to: '/vehicles', label: 'Veículos' },
  { to: '/maintenance', label: 'Manutenções' },
  { to: '/drivers', label: 'Motoristas' },
  { to: '/vendors', label: 'Fornecedores' },
  { to: '/rentals', label: 'Aluguéis' },
  { to: '/rent-payments', label: 'Cobranças' },
  { to: '/expenses', label: 'Despesas' },
  { to: '/capital', label: 'Capital' },
  { to: '/cash', label: 'Caixa' },
  { to: '/summary', label: 'Resumo' },
  { to: '/admin/users', label: 'Usuários', adminOnly: true },
];

export const Header: React.FC = () => {
  const { logout, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const visibleNavItems = navItems.filter((item) => (item.adminOnly ? isAdmin : true));

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="relative mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-600 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white lg:hidden"
            onClick={() => setOpen((prev) => !prev)}
            aria-expanded={open}
            aria-controls="app-mobile-nav"
            aria-label="Alternar menu"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="h-5 w-5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <Link to="/" className="flex items-center gap-3 text-left">
            <span className="rounded-xl bg-indigo-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
              Garage
            </span>
            <div>
              <p className="text-sm font-medium text-slate-800">Painel de Controle</p>
              <p className="text-[11px] uppercase tracking-widest text-slate-500">Gestão de Frota</p>
            </div>
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/summary"
            className="hidden items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-600 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-100 sm:inline-flex"
          >
            <span>Ver resumo</span>
          </Link>
          <button
            onClick={logout}
            className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            Sair
          </button>
        </div>
        {open ? (
          <>
            <div
              className="absolute inset-x-0 top-full z-40 mt-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-2xl ring-1 ring-black/5 lg:hidden"
              id="app-mobile-nav"
            >
              <nav className="flex flex-col gap-1 text-sm text-slate-700">
                {visibleNavItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      `flex items-center justify-between rounded-xl px-3 py-2 transition ${
                        isActive ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-slate-100 hover:text-slate-900'
                      }`
                    }
                  >
                    <span>{item.label}</span>
                    <span className="text-xs text-slate-400">&rsaquo;</span>
                  </NavLink>
                ))}
              </nav>
            </div>
            <button
              type="button"
              className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm lg:hidden"
              aria-hidden="true"
              onClick={() => setOpen(false)}
            />
          </>
        ) : null}
      </div>
    </header>
  );
};
