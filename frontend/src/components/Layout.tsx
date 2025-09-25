import { Outlet } from 'react-router-dom';

import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { Footer } from './Footer';

export const Layout: React.FC = () => {
  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="flex flex-1 flex-col bg-slate-50">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
};
