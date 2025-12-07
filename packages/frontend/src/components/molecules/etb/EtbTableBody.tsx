import { cn } from '@/utils/cn';
import type { EintragDto } from '@bluelight-hub/shared/client';
import type { ColumnDef, Row } from '@tanstack/react-table';
import { flexRender } from '@tanstack/react-table';
import type { VirtualItem } from '@tanstack/react-virtual';
import { Fragment } from 'react';
import { PiCircleNotch } from 'react-icons/pi';
import { EtbEntryDetails } from '../../organisms/etb/components/EtbEntryDetails';
import { EtbTableRowEditable } from '../../organisms/etb/components/EtbTableRowEditable';

interface EtbTableBodyProps {
  virtualRows: VirtualItem[];
  rows: Row<EintragDto>[];
  columns: ColumnDef<EintragDto>[];
  paddingTop: number;
  paddingBottom: number;
  isLoading: boolean;
  entries: EintragDto[];
  enableInlineEdit: boolean;
  einsatzId?: string;
  onDelete: (entry: EintragDto) => void;
  getUserName: (userId: string) => string | undefined;
}

// Statische Skeleton-Row-Keys (für Performance und Linter)
const SKELETON_KEYS = Array.from({ length: 10 }, (_, i) => `skeleton-${i}`);

/**
 * ETB Table Body mit Virtualisierung
 */
export function EtbTableBody({ virtualRows, rows, columns, paddingTop, paddingBottom, isLoading, entries, enableInlineEdit, einsatzId, onDelete, getUserName }: EtbTableBodyProps) {
  return (
    <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-950">
      {paddingTop > 0 && (
        <tr>
          <td colSpan={columns.length} style={{ height: `${paddingTop}px` }} />
        </tr>
      )}

      {/* Loading Overlay innerhalb der Tabelle */}
      {isLoading && entries.length === 0 ? (
        // Initial Loading - Skeleton Rows
        SKELETON_KEYS.map((key) => (
          <tr key={key} className="animate-pulse">
            <td className="px-3 py-2">
              <div className="h-4 w-4 rounded bg-gray-200 dark:bg-gray-700" />
            </td>
            <td className="px-3 py-2">
              <div className="h-4 w-8 rounded bg-gray-200 dark:bg-gray-700" />
            </td>
            <td className="px-3 py-2">
              <div className="h-4 w-16 rounded bg-gray-200 dark:bg-gray-700" />
            </td>
            <td className="px-3 py-2">
              <div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700" />
            </td>
            <td className="px-3 py-2">
              <div className="h-4 w-48 rounded bg-gray-200 dark:bg-gray-700" />
            </td>
            <td className="px-3 py-2">
              <div className="h-4 w-16 rounded bg-gray-200 dark:bg-gray-700" />
            </td>
          </tr>
        ))
      ) : virtualRows.length === 0 && entries.length > 0 ? (
        // Fallback während Virtualizer initialisiert
        <tr>
          <td colSpan={columns.length} className="h-[500px]">
            <div className="flex h-full items-center justify-center">
              <PiCircleNotch className="h-6 w-6 animate-spin text-primary-500" />
            </div>
          </td>
        </tr>
      ) : (
        virtualRows.map((virtualRow) => {
          const row = rows[virtualRow.index];
          return (
            <Fragment key={row.id}>
              {/* Main Row */}
              {enableInlineEdit && einsatzId ? (
                <EtbTableRowEditable row={row} style={{ height: `${virtualRow.size}px` }} onDelete={onDelete} />
              ) : (
                <tr
                  className={cn('transition-colors', row.original.deletedAt ? 'border-l-2 border-l-red-500 bg-red-50/30 opacity-60 dark:bg-red-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-900/50')}
                  style={{ height: `${virtualRow.size}px` }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-4 py-3 align-top"
                      style={{
                        width: cell.column.getSize(),
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              )}

              {/* Expanded Row */}
              {row.getIsExpanded() && (
                <tr>
                  <td colSpan={columns.length} className="bg-gray-50 px-8 py-4 dark:bg-gray-900/30">
                    <EtbEntryDetails entry={row.original} getUserName={getUserName} />
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })
      )}

      {paddingBottom > 0 && (
        <tr>
          <td colSpan={columns.length} style={{ height: `${paddingBottom}px` }} />
        </tr>
      )}
    </tbody>
  );
}
