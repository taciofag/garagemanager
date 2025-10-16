import type { ReactNode } from 'react';

interface SectionProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  roleLabel?: string;
}

export const Section: React.FC<SectionProps> = ({
  title,
  description,
  actions,
  children,
  className = '',
  roleLabel,
}) => {
  const label = roleLabel ?? title;

  return (
    <section
      role="region"
      aria-label={label}
      tabIndex={0}
      className={`dashboard-section rounded-xl border border-slate-200 bg-white p-4 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${className}`}
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-800 sm:text-lg">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </header>

      <div>{children}</div>
    </section>
  );
};

export default Section;
