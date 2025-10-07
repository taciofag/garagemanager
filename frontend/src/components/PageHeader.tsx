import { Link } from "react-router-dom";
import classNames from "classnames";
import type { ReactNode } from "react";

interface PageHeaderBreadcrumb {
  label: string;
  to?: string;
}

export type PageHeaderMetricTone = "default" | "success" | "warning" | "danger";

export interface PageHeaderMetric {
  label: string;
  value: ReactNode;
  tone?: PageHeaderMetricTone;
  helper?: ReactNode;
}

export type PageHeaderVariant = "brand" | "soft";

export interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  breadcrumbs?: PageHeaderBreadcrumb[];
  actions?: ReactNode;
  metrics?: PageHeaderMetric[];
  children?: ReactNode;
  variant?: PageHeaderVariant;
  className?: string;
}

const sharedContainerStyles =
  "relative overflow-hidden rounded-3xl border border-indigo-500/30 bg-gradient-to-br from-[#090f1f] via-[#162345] to-[#1e3a8a] p-8 text-slate-50 shadow-[0_38px_90px_-60px_rgba(15,23,42,1)] sm:p-10";

const variantClasses: Record<PageHeaderVariant, string> = {
  brand: sharedContainerStyles,
  soft: sharedContainerStyles,
};

const sharedDescriptionStyles = "text-sm text-slate-200 sm:text-base";

const descriptionClasses: Record<PageHeaderVariant, string> = {
  brand: sharedDescriptionStyles,
  soft: sharedDescriptionStyles,
};

const sharedMetricCardStyles =
  "rounded-2xl border border-white/15 bg-white/10 p-4 shadow-[0_26px_70px_-45px_rgba(15,23,42,0.95)] backdrop-blur";

const metricCardClasses: Record<PageHeaderVariant, string> = {
  brand: sharedMetricCardStyles,
  soft: sharedMetricCardStyles,
};

const sharedMetricLabelStyles = "text-[11px] uppercase tracking-[0.18em] text-indigo-200";

const metricLabelClasses: Record<PageHeaderVariant, string> = {
  brand: sharedMetricLabelStyles,
  soft: sharedMetricLabelStyles,
};

const sharedToneMapping: Record<PageHeaderMetricTone, string> = {
  default: "text-slate-50",
  success: "text-emerald-200",
  warning: "text-amber-200",
  danger: "text-rose-200",
};

const metricToneClasses: Record<PageHeaderVariant, Record<PageHeaderMetricTone, string>> = {
  brand: sharedToneMapping,
  soft: sharedToneMapping,
};

const overlayAccents: Record<PageHeaderVariant, ReactNode | null> = {
  brand: (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-sky-500/30 blur-[120px] sm:h-80 sm:w-80" />
      <div className="absolute top-1/2 right-[-15%] h-80 w-80 -translate-y-1/2 rounded-full bg-indigo-500/35 blur-[140px]" />
      <div className="absolute -bottom-28 left-1/4 h-64 w-64 rounded-full bg-violet-500/25 blur-[120px]" />
    </div>
  ),
  soft: (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-sky-500/30 blur-[120px] sm:h-80 sm:w-80" />
      <div className="absolute top-1/2 right-[-15%] h-80 w-80 -translate-y-1/2 rounded-full bg-indigo-500/35 blur-[140px]" />
      <div className="absolute -bottom-28 left-1/4 h-64 w-64 rounded-full bg-violet-500/25 blur-[120px]" />
    </div>
  ),
};

export const PageHeader = ({
  title,
  description,
  eyebrow,
  breadcrumbs,
  actions,
  metrics,
  children,
  variant = "brand",
  className,
}: PageHeaderProps) => {
  const breadcrumbBase = "text-slate-200";
  const breadcrumbLinkHover = "hover:text-white";

  return (
    <header className={classNames(variantClasses[variant], className)}>
      {overlayAccents[variant]}
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-3">
          {breadcrumbs && breadcrumbs.length ? (
            <nav className={classNames("flex flex-wrap items-center gap-2 text-xs", breadcrumbBase)}>
              {breadcrumbs.map((crumb, index) => (
                <span key={`${crumb.label}-${index}`} className="flex items-center gap-2">
                  {crumb.to ? (
                    <Link to={crumb.to} className={classNames("transition", breadcrumbLinkHover)}>
                      {crumb.label}
                    </Link>
                  ) : (
                    <span>{crumb.label}</span>
                  )}
                  {index < breadcrumbs.length - 1 ? <span className="opacity-60">/</span> : null}
                </span>
              ))}
            </nav>
          ) : null}
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-200">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">{title}</h1>
          {description ? <p className={descriptionClasses[variant]}>{description}</p> : null}
        </div>
        {actions ? (
          <div className="flex w-full flex-col gap-3 text-sm lg:w-auto lg:flex-row lg:items-center">
            {actions}
          </div>
        ) : null}
      </div>

      {metrics && metrics.length ? (
        <div className="relative mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <div key={metric.label} className={metricCardClasses[variant]}>
              <p className={metricLabelClasses[variant]}>{metric.label}</p>
              <p
                className={classNames(
                  "mt-2 text-2xl font-semibold",
                  metricToneClasses[variant][metric.tone ?? "default"]
                )}
              >
                {metric.value}
              </p>
              {metric.helper ? (
                <p className="mt-1 text-sm text-indigo-100/90">
                  {metric.helper}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {children ? <div className="relative mt-6">{children}</div> : null}
    </header>
  );
};
