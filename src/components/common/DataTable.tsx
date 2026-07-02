import { cn } from '@/lib/utils';

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  emptyMessage?: string;
  className?: string;
  onRowClick?: (item: T) => void;
}

export default function DataTable<T>({ columns, data, keyExtractor, emptyMessage = 'لا توجد بيانات', className, onRowClick }: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="py-12 text-center text-text-secondary">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn('-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0', className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-gray-50/70">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-3 py-3 text-start text-xs font-semibold text-text-secondary whitespace-nowrap sm:px-4',
                  col.className
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {data.map((item) => (
            <tr
              key={keyExtractor(item)}
              className={cn(
                'transition-colors hover:bg-gray-50',
                onRowClick && 'cursor-pointer'
              )}
              onClick={() => onRowClick?.(item)}
            >
              {columns.map((col) => (
                <td key={col.key} className={cn('px-3 py-3 text-text-primary sm:px-4', col.className)}>
                  {col.render
                    ? col.render(item)
                    : String((item as Record<string, unknown>)[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
