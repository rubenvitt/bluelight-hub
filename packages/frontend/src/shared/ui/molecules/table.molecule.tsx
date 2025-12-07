import { cn } from '@/utils/cn';
import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { forwardRef } from 'react';

/**
 * Table Root Component
 */
interface TableRootProps extends HTMLAttributes<HTMLTableElement> {
  children: ReactNode;
}

export const TableRoot = forwardRef<HTMLTableElement, TableRootProps>(({ className, children, ...props }, ref) => {
  return (
    <div className="w-full overflow-auto">
      <table ref={ref} className={cn('w-full caption-bottom text-sm', className)} {...props}>
        {children}
      </table>
    </div>
  );
});

TableRoot.displayName = 'TableRoot';

/**
 * Table Header Component
 */
interface TableHeaderProps extends HTMLAttributes<HTMLTableSectionElement> {
  children: ReactNode;
}

export const TableHeader = forwardRef<HTMLTableSectionElement, TableHeaderProps>(({ className, children, ...props }, ref) => {
  return (
    <thead ref={ref} className={cn('[&_tr]:border-b', className)} {...props}>
      {children}
    </thead>
  );
});

TableHeader.displayName = 'TableHeader';

/**
 * Table Body Component
 */
interface TableBodyProps extends HTMLAttributes<HTMLTableSectionElement> {
  children: ReactNode;
}

export const TableBody = forwardRef<HTMLTableSectionElement, TableBodyProps>(({ className, children, ...props }, ref) => {
  return (
    <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props}>
      {children}
    </tbody>
  );
});

TableBody.displayName = 'TableBody';

/**
 * Table Row Component
 */
interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  children: ReactNode;
}

export const TableRow = forwardRef<HTMLTableRowElement, TableRowProps>(({ className, children, ...props }, ref) => {
  return (
    <tr ref={ref} className={cn('border-b transition-colors hover:bg-gray-50 data-[state=selected]:bg-gray-100 dark:data-[state=selected]:bg-gray-800 dark:hover:bg-gray-900', className)} {...props}>
      {children}
    </tr>
  );
});

TableRow.displayName = 'TableRow';

/**
 * Table Head Cell Component
 */
interface TableHeadProps extends ThHTMLAttributes<HTMLTableCellElement> {
  children?: ReactNode;
  sortable?: boolean;
  sorted?: 'asc' | 'desc' | false;
}

export const TableHead = forwardRef<HTMLTableCellElement, TableHeadProps>(({ className, children, sortable = false, sorted = false, ...props }, ref) => {
  return (
    <th
      ref={ref}
      className={cn(
        'h-12 px-4 text-left align-middle font-medium text-gray-500 dark:text-gray-400 [&:has([role=checkbox])]:pr-0',
        sortable && 'cursor-pointer select-none hover:text-gray-900 dark:hover:text-gray-100',
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-2">
        {children}
        {sorted && <span className="text-gray-400 dark:text-gray-500">{sorted === 'asc' ? '↑' : '↓'}</span>}
      </div>
    </th>
  );
});

TableHead.displayName = 'TableHead';

/**
 * Table Cell Component
 */
interface TableCellProps extends TdHTMLAttributes<HTMLTableCellElement> {
  children?: ReactNode;
}

export const TableCell = forwardRef<HTMLTableCellElement, TableCellProps>(({ className, children, ...props }, ref) => {
  return (
    <td ref={ref} className={cn('p-4 align-middle [&:has([role=checkbox])]:pr-0', className)} {...props}>
      {children}
    </td>
  );
});

TableCell.displayName = 'TableCell';

/**
 * Table Caption Component
 */
interface TableCaptionProps extends HTMLAttributes<HTMLTableCaptionElement> {
  children: ReactNode;
}

export const TableCaption = forwardRef<HTMLTableCaptionElement, TableCaptionProps>(({ className, children, ...props }, ref) => {
  return (
    <caption ref={ref} className={cn('mt-4 text-gray-500 text-sm dark:text-gray-400', className)} {...props}>
      {children}
    </caption>
  );
});

TableCaption.displayName = 'TableCaption';

/**
 * Table Skeleton Component for loading states
 */
interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export function TableSkeleton({ rows = 5, columns = 4 }: TableSkeletonProps) {
  return (
    <TableRoot>
      <TableBody>
        {Array.from({ length: rows }).map((_, rowIndex) => {
          const rowKey = `skeleton-${rows}-${columns}-row-${rowIndex}`;
          return (
            <TableRow key={rowKey}>
              {Array.from({ length: columns }).map((__, colIndex) => {
                const cellKey = `skeleton-${rows}-${columns}-cell-${rowIndex}-${colIndex}`;
                return (
                  <TableCell key={cellKey}>
                    <div className="h-4 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                  </TableCell>
                );
              })}
            </TableRow>
          );
        })}
      </TableBody>
    </TableRoot>
  );
}

// Export all table components as a namespace
export const Table = {
  Root: TableRoot,
  Header: TableHeader,
  Body: TableBody,
  Row: TableRow,
  Head: TableHead,
  Cell: TableCell,
  Caption: TableCaption,
  Skeleton: TableSkeleton,
};
