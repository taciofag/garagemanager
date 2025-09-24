﻿export const Loading: React.FC<{ label?: string }> = ({ label = 'Carregando...' }) => (
  <div className="flex items-center justify-center py-10 text-sm text-slate-500">
    <svg className="mr-2 h-5 w-5 animate-spin text-primary" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8z" />
    </svg>
    {label}
  </div>
);
