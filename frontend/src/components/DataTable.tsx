import classNames from 'classnames';

interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  emptyMessage?: string;
}

export function DataTable<T>({ data, columns, emptyMessage = 'Nenhum registro encontrado.' }: DataTableProps<T>) {
  if (data.length === 0) {
    return <div className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">{emptyMessage}</div>;
  }

  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {columns.map((column) => (
              <th key={String(column.key)} className={classNames('px-4 py-3 font-semibold', column.className)}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {data.map((item, idx) => (
            <tr key={idx} className="hover:bg-slate-50">
              {columns.map((column) => (
                <td key={String(column.key)} className={classNames('px-4 py-3 text-slate-700', column.className)}>
                  {column.render ? column.render(item) : String((item as Record<string, unknown>)[column.key as string] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
