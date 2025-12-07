import { cn } from '@/utils/cn';
import { IconButton } from '@atoms/icon-button.atom';
import type { EintragDto, EintragDtoKategorieEnum } from '@bluelight-hub/shared/client';
import type { ColumnDef } from '@tanstack/react-table';
import { format, isValid } from 'date-fns';
import { de } from 'date-fns/locale';
import { useMemo } from 'react';
import { PiCaretDown, PiCaretRight, PiPencil, PiTrash, PiTrashSimple } from 'react-icons/pi';
import { EtbKategorieBadge } from '../components/EtbKategorieBadge';
import { EtbVersionBadge } from '../components/EtbVersionBadge';
import { EtbTextCell } from '../components/EtbTextCell';

interface UseEtbColumnsProps {
  onEditEntry?: (entry: EintragDto) => void;
  handleDelete: (entry: EintragDto) => void;
  onShowHistory?: (entry: EintragDto) => void;
}

export function useEtbColumns({ onEditEntry, handleDelete, onShowHistory }: UseEtbColumnsProps): ColumnDef<EintragDto>[] {
  return useMemo<ColumnDef<EintragDto>[]>(
    () => [
      {
        id: 'expander',
        header: () => null,
        cell: ({ row }) => (
          <IconButton
            aria-label="Eintrag erweitern"
            onClick={row.getToggleExpandedHandler()}
            className={cn('rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700', 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200')}
          >
            {row.getIsExpanded() ? <PiCaretDown className="h-4 w-4" /> : <PiCaretRight className="h-4 w-4" />}
          </IconButton>
        ),
        size: 48,
      },
      {
        id: 'sequenceNumber',
        accessorKey: 'sequenceNumber',
        header: '#',
        cell: ({ getValue }) => <span className="font-mono text-gray-500 text-xs dark:text-gray-400">#{getValue<number>()}</span>,
        size: 70,
        enableSorting: true,
      },
      {
        id: 'version',
        accessorKey: 'version',
        header: 'Ver.',
        cell: ({ getValue, row }) => {
          const rawVersion = getValue<number>();
          const version = typeof rawVersion === 'number' && Number.isFinite(rawVersion) ? rawVersion : null;
          const entry = row.original;

          const hasBeenUpdated = entry.updatedAt && entry.createdAt && entry.updatedAt.valueOf() !== entry.createdAt.valueOf();
          const fallbackVersion = hasBeenUpdated ? 2 : 1;
          const displayVersion = version ?? fallbackVersion;

          if (!displayVersion || displayVersion <= 1) return null;

          return <EtbVersionBadge version={displayVersion} variant="subtle" onClick={() => onShowHistory?.(entry)} />;
        },
        size: 70,
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const entry = row.original;

          // "Gelöscht" Badge nur anzeigen, wenn Eintrag gelöscht wurde
          if (entry.deletedAt) {
            return (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-700 text-xs dark:bg-red-900/30 dark:text-red-400"
                title={`Gelöscht${entry.deleterUsername ? ` von ${entry.deleterUsername}` : ''}`}
              >
                <PiTrashSimple className="h-3 w-3" />
                Gelöscht
              </span>
            );
          }

          return null;
        },
        size: 90,
      },
      {
        id: 'timestamp',
        accessorKey: 'timestamp',
        header: 'Zeit',
        cell: ({ getValue }) => {
          const rawTimestamp = getValue<string | Date | null | undefined>();
          const date = rawTimestamp ? new Date(rawTimestamp) : null;

          if (!date || !isValid(date)) {
            return <span className="text-gray-500 text-sm dark:text-gray-400">-</span>;
          }

          return (
            <time className="text-gray-700 text-sm dark:text-gray-300" title={format(date, 'dd.MM.yyyy HH:mm:ss', { locale: de })}>
              {format(date, 'HH:mm:ss', { locale: de })}
            </time>
          );
        },
        size: 90,
        enableSorting: true,
      },
      {
        id: 'kategorie',
        accessorKey: 'kategorie',
        header: 'Kategorie',
        enableSorting: true,
        cell: ({ getValue }) => <EtbKategorieBadge kategorie={getValue<EintragDtoKategorieEnum>()} />,
        size: 150,
      },
      {
        id: 'text',
        accessorKey: 'text',
        header: 'Eintrag',
        cell: ({ row }) => <EtbTextCell entry={row.original} isDeleted={!!row.original.deletedAt} />,
        size: 600,
        minSize: 400,
      },
      {
        id: 'actions',
        header: 'Aktionen',
        cell: ({ row }) => {
          const entry = row.original;
          const isDeleted = !!entry.deletedAt;

          // Für gelöschte Einträge: disabled Buttons mit Tooltip
          if (isDeleted) {
            return (
              <div className="flex justify-center gap-1" title="Eintrag wurde gelöscht">
                <IconButton appearance="minimal" size="sm" disabled className="cursor-not-allowed opacity-40" aria-label="Bearbeiten nicht möglich">
                  <PiPencil />
                </IconButton>
                <IconButton appearance="minimal" size="sm" intent="danger" disabled className="cursor-not-allowed opacity-40" aria-label="Löschen nicht möglich">
                  <PiTrash />
                </IconButton>
              </div>
            );
          }

          return (
            <div className="flex justify-center gap-1">
              <IconButton
                appearance="minimal"
                size="sm"
                onClick={() => onEditEntry?.(entry)}
                className="text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400"
                aria-label="Bearbeiten"
              >
                <PiPencil />
              </IconButton>
              <IconButton size="sm" appearance="minimal" intent="danger" onClick={() => handleDelete(entry)} aria-label="Löschen">
                <PiTrash />
              </IconButton>
            </div>
          );
        },
        size: 110,
      },
    ],
    [onEditEntry, handleDelete, onShowHistory],
  );
}
