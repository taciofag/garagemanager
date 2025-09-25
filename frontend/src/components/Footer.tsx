export const Footer = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 bg-white/80">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-2 px-6 py-4 text-xs text-slate-500 sm:flex-row sm:justify-between">
        <span className="font-semibold text-slate-600">Garage Manager</span>
        <span className="text-center sm:text-left">
          © {year} Garage Manager • Organização completa de compras, vendas e aluguéis.
        </span>
        <a
          href="mailto:contato@garagemanager.com"
          className="text-slate-400 transition-colors hover:text-primary"
        >
          contato@garagemanager.com
        </a>
      </div>
    </footer>
  );
};