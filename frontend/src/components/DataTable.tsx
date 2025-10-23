import classNames from 'classnames';
import { isValidElement, type ReactNode } from 'react';

type Align = 'left' | 'center' | 'right';

interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
  mobileClassName?: string;
  mobileLabel?: string;
  hideOnMobile?: boolean;
  isPrimary?: boolean;
  align?: Align;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  emptyMessage?: string;
  mobileAriaLabel?: string;
}

const ALIGN_CLASS_MAP: Record<Align, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

const renderCellContent = <T,>(item: T, column: Column<T>) => {
  if (column.render) {
    return column.render(item);
  }
  const value = (item as Record<string, unknown>)[column.key as string];
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  return String(value);
};

const isPrimitiveContent = (value: ReactNode): value is string | number => {
  return typeof value === 'string' || typeof value === 'number';
};

export function DataTable<T>({
  data,
  columns,
  emptyMessage = 'Nenhum registro encontrado.',
  mobileAriaLabel = 'Lista de registros',
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
        {emptyMessage}
      </div>
    );
  }

  const visibleMobileColumns = columns.filter((column) => !column.hideOnMobile);
  const primaryColumn =
    visibleMobileColumns.find((column) => column.isPrimary) ?? visibleMobileColumns[0] ?? null;

  return (
    <div className="space-y-4">
      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
        <div className="w-full overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {columns.map((column) => (
                  <th
                    key={String(column.key)}
                    className={classNames(
                      'px-4 py-3 font-semibold',
                      ALIGN_CLASS_MAP[column.align ?? 'left'],
                      column.className,
                    )}
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {data.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  {columns.map((column) => {
                    const content = renderCellContent(item, column);
                    return (
                      <td
                        key={String(column.key)}
                        className={classNames(
                          'px-4 py-3 text-slate-700',
                          ALIGN_CLASS_MAP[column.align ?? 'left'],
                          column.className,
                        )}
                      >
                        {isPrimitiveContent(content) ? content : content || '—'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {visibleMobileColumns.length ? (
        <div className="space-y-3 md:hidden" role="list" aria-label={mobileAriaLabel}>
          {data.map((item, rowIndex) => {
            const primaryContent = primaryColumn ? renderCellContent(item, primaryColumn) : null;
            return (
              <div
                key={rowIndex}
                role="listitem"
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                {primaryColumn ? (
                  <div className="text-sm font-semibold text-slate-800">
                    {isPrimitiveContent(primaryContent) || isValidElement(primaryContent)
                      ? primaryContent
                      : primaryContent ?? '—'}
                  </div>
                ) : null}
                <dl className={classNames('mt-3 space-y-2 text-xs text-slate-500', primaryColumn ? '' : 'mt-0')}>
                  {visibleMobileColumns
                    .filter((column) => column !== primaryColumn)
                    .map((column) => {
                      const content = renderCellContent(item, column);
                      const hasPrimitiveContent = isPrimitiveContent(content);
                      const displayContent =
                        hasPrimitiveContent || isValidElement(content) ? content : content ?? '—';

                      return (
                        <div key={String(column.key)} className="flex flex-col gap-1">
                          <dt className="font-semibold uppercase tracking-wide text-slate-400">
                            {column.mobileLabel ?? column.header}
                          </dt>
                          <dd
                            className={classNames(
                              'text-sm text-slate-700',
                              column.mobileClassName,
                              !hasPrimitiveContent && !isValidElement(displayContent)
                                ? 'font-medium'
                                : undefined,
                            )}
                          >
                            {displayContent}
                          </dd>
                        </div>
                      );
                    })}
                </dl>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
