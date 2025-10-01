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

const variantClasses: Record<PageHeaderVariant, string> = {
  brand:
    "relative overflow-hidden rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6 text-slate-50 shadow-xl",
  soft: "relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm",
};

const descriptionClasses: Record<PageHeaderVariant, string> = {
  brand: "text-sm text-slate-300",
  soft: "text-sm text-slate-500",
};

const metricCardClasses: Record<PageHeaderVariant, string> = {
  brand: "rounded-xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm",
  soft: "rounded-xl border border-slate-200 bg-slate-900/5 p-4",
};

const metricLabelClasses: Record<PageHeaderVariant, string> = {
  brand: "text-[11px] uppercase tracking-wide text-indigo-200",
  soft: "text-[11px] uppercase tracking-wide text-slate-500",
};

const metricToneClasses: Record<PageHeaderVariant, Record<PageHeaderMetricTone, string>> = {
  brand: {
    default: "text-white",
    success: "text-emerald-300",
    warning: "text-amber-300",
    danger: "text-rose-300",
  },
  soft: {
    default: "text-slate-900",
    success: "text-emerald-600",
    warning: "text-amber-600",
    danger: "text-rose-600",
  },
};

const overlayAccent = (
  <svg
    className="pointer-events-none absolute right-[-10%] top-[-20%] h-64 w-64 text-indigo-400/30"
    viewBox="0 0 200 200"
    aria-hidden="true"
  >
    <defs>
      <radialGradient id="pageHeaderBlob" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="currentColor" />
        <stop offset="100%" stopColor="transparent" />
      </radialGradient>
    </defs>
    <circle cx="100" cy="100" r="100" fill="url(#pageHeaderBlob)" />
  </svg>
);

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
  const breadcrumbBase = variant === "brand" ? "text-slate-300" : "text-slate-500";
  const breadcrumbLinkHover = variant === "brand" ? "hover:text-white" : "hover:text-indigo-600";

  return (
    <header className={classNames(variantClasses[variant], className)}>
      {variant === "brand" ? overlayAccent : null}
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
            <p
              className={classNames(
                "text-xs font-semibold uppercase tracking-wider",
                variant === "brand" ? "text-indigo-200" : "text-indigo-600"
              )}
            >
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
                  "mt-2 text-lg font-semibold",
                  metricToneClasses[variant][metric.tone ?? "default"]
                )}
              >
                {metric.value}
              </p>
              {metric.helper ? (
                <p
                  className={classNames(
                    "mt-1 text-xs",
                    variant === "brand" ? "text-indigo-100" : "text-slate-500"
                  )}
                >
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
