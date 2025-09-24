import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
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
];

export const Sidebar: React.FC = () => {
  const { logout } = useAuth();

  return (
    <aside className="hidden w-60 flex-col border-r border-slate-200 bg-white lg:flex">
      <div className="flex h-16 items-center gap-2 border-b border-slate-100 px-6">
        <img src="/garage.svg" alt="Garage" className="h-8 w-8" />
        <div className="text-lg font-semibold text-slate-800">Garage Manager</div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-6">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center rounded-md px-3 py-2 text-sm font-medium transition ${
                    isActive ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-100'
                  }`
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="border-t border-slate-200 p-4">
        <button
          onClick={logout}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
        >
          Sair
        </button>
      </div>
    </aside>
  );
};
