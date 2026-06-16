import React from 'react';
import EmptyState from './EmptyState';
import Skeleton from './Skeleton';
import { cn } from './utils';

const densities = {
  compact: 'px-3 py-2',
  normal: 'px-4 py-3',
  comfortable: 'px-5 py-4',
};

const alignments = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

const getValue = (row, column, rowIndex) => {
  if (column.render) return column.render(row, rowIndex);
  return row?.[column.key] ?? '—';
};

const getKey = (row, rowIndex, getRowKey) => {
  if (getRowKey) return getRowKey(row, rowIndex);
  return row?.id ?? row?.key ?? rowIndex;
};

export default function Table({
  columns = [],
  rows = [],
  loading = false,
  emptyTitle = 'Нічого не знайдено',
  emptyDescription,
  renderMobileCard,
  stickyFirstColumn = false,
  getRowKey,
  rowClassName,
  onRowClick,
  density = 'normal',
  mobileBreakpoint = 'md',
  mobileTitleKey,
  mobileSubtitleKey,
  mobileActions,
  className = '',
  tableClassName = '',
  headerClassName = '',
  bodyClassName = '',
}) {
  if (loading) {
    return (
      <div className={cn('rounded-3xl border border-slate-200 bg-white p-4 shadow-sm', className)}>
        <Skeleton rows={5} />
      </div>
    );
  }

  if (!rows?.length) return <EmptyState title={emptyTitle} description={emptyDescription} />;

  const cellPadding = densities[density] || densities.normal;
  const desktopClass = mobileBreakpoint === 'sm' ? 'hidden sm:block' : mobileBreakpoint === 'lg' ? 'hidden lg:block' : 'hidden md:block';
  const mobileClass = mobileBreakpoint === 'sm' ? 'space-y-3 sm:hidden' : mobileBreakpoint === 'lg' ? 'space-y-3 lg:hidden' : 'space-y-3 md:hidden';

  return (
    <div className={cn('w-full', className)}>
      <div className={cn(desktopClass, 'overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm')}>
        <div className="overflow-x-auto">
          <table className={cn('min-w-full divide-y divide-slate-100', tableClassName)}>
            <thead className={cn('bg-slate-50', headerClassName)}>
              <tr>
                {columns.map((column, index) => (
                  <th
                    key={column.key || index}
                    className={cn(
                      cellPadding,
                      alignments[column.align] || alignments.left,
                      'whitespace-nowrap text-xs font-black uppercase tracking-wide text-slate-500',
                      column.headerClassName,
                      stickyFirstColumn && index === 0 && 'sticky left-0 z-10 bg-slate-50 shadow-[1px_0_0_0_rgba(226,232,240,1)]'
                    )}
                    style={column.width ? { width: column.width } : undefined}
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={cn('divide-y divide-slate-100', bodyClassName)}>
              {rows.map((row, rowIndex) => {
                const clickable = Boolean(onRowClick);
                return (
                  <tr
                    key={getKey(row, rowIndex, getRowKey)}
                    onClick={onRowClick ? () => onRowClick(row, rowIndex) : undefined}
                    className={cn('transition-colors hover:bg-slate-50/80', clickable && 'cursor-pointer', typeof rowClassName === 'function' ? rowClassName(row, rowIndex) : rowClassName)}
                  >
                    {columns.map((column, columnIndex) => (
                      <td
                        key={column.key || columnIndex}
                        className={cn(
                          cellPadding,
                          alignments[column.align] || alignments.left,
                          'max-w-[360px] align-middle text-sm font-semibold text-slate-700',
                          column.nowrap ? 'whitespace-nowrap' : 'break-words',
                          column.cellClassName,
                          stickyFirstColumn && columnIndex === 0 && 'sticky left-0 bg-white font-black shadow-[1px_0_0_0_rgba(226,232,240,1)]'
                        )}
                      >
                        {getValue(row, column, rowIndex)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className={mobileClass}>
        {rows.map((row, rowIndex) => {
          if (renderMobileCard) return <React.Fragment key={getKey(row, rowIndex, getRowKey)}>{renderMobileCard(row, rowIndex)}</React.Fragment>;
          const titleColumn = columns.find((column) => column.key === mobileTitleKey) || columns[0];
          const subtitleColumn = columns.find((column) => column.key === mobileSubtitleKey);
          const visibleColumns = columns.filter((column) => column.mobileHidden !== true && column !== titleColumn && column !== subtitleColumn);

          return (
            <article key={getKey(row, rowIndex, getRowKey)} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="min-w-0">
                  <h3 className="break-words text-base font-black text-slate-900">{getValue(row, titleColumn, rowIndex)}</h3>
                  {subtitleColumn && <p className="mt-1 text-xs font-bold text-slate-500">{getValue(row, subtitleColumn, rowIndex)}</p>}
                </div>
                {mobileActions && <div className="shrink-0">{typeof mobileActions === 'function' ? mobileActions(row, rowIndex) : mobileActions}</div>}
              </div>
              <div className="space-y-2">
                {visibleColumns.map((column) => (
                  <div key={column.key} className="grid grid-cols-[minmax(92px,0.42fr)_minmax(0,1fr)] gap-3 text-sm">
                    <span className="text-xs font-black uppercase text-slate-400">{column.mobileLabel || column.header}</span>
                    <span className={cn('min-w-0 text-right font-bold text-slate-800', column.mobileValueClassName)}>{getValue(row, column, rowIndex)}</span>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
