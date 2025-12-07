import { Badge } from '@/components/atoms/badge.atom';
import { IconButton } from '@/components/atoms/icon-button.atom';
import { Table } from '@/components/molecules/table.molecule';
import type { ManagedUserResponseDto } from '@bluelight-hub/shared/client';
import { ManagedUserResponseDtoRoleEnum } from '@bluelight-hub/shared/client';
import type { SortingState } from '@tanstack/react-table';
import { createColumnHelper, flexRender, getCoreRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { PiLockKey, PiLockKeyOpen, PiPencilSimple, PiTrash } from 'react-icons/pi';

interface UsersTableProps {
  users: Array<ManagedUserResponseDto> | undefined;
  isLoading: boolean;
  onDelete: (user: ManagedUserResponseDto) => void;
  onEdit: (user: ManagedUserResponseDto) => void;
  onUnlock: (user: ManagedUserResponseDto) => void;
}

const columnHelper = createColumnHelper<ManagedUserResponseDto>();

const getRoleBadgeVariant = (role: ManagedUserResponseDtoRoleEnum): 'error' | 'warning' | 'info' | 'default' => {
  switch (role) {
    case ManagedUserResponseDtoRoleEnum.SuperAdmin:
      return 'error';
    case ManagedUserResponseDtoRoleEnum.Admin:
      return 'warning';
    case ManagedUserResponseDtoRoleEnum.User:
      return 'info';
    default:
      return 'default';
  }
};

export const UsersTable = ({ users, isLoading, onDelete, onEdit, onUnlock }: UsersTableProps) => {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo(
    () => [
      columnHelper.accessor('username', {
        header: 'Benutzername',
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor('role', {
        header: 'Rolle',
        cell: ({ row }) => <Badge variant={getRoleBadgeVariant(row.original.role)}>{row.original.role}</Badge>,
      }),
      columnHelper.accessor('isLocked', {
        header: 'Status',
        cell: ({ row }) => {
          if (row.original.isLocked) {
            const lockReason = row.original.lockReason;
            return (
              <div className="flex items-center gap-2">
                <Badge variant="warning" className="flex items-center gap-1">
                  <PiLockKey className="h-3 w-3" />
                  Gesperrt
                </Badge>
                {lockReason && (
                  <span className="text-gray-500 text-xs dark:text-gray-400" title={lockReason}>
                    ({lockReason.length > 20 ? `${lockReason.substring(0, 20)}...` : lockReason})
                  </span>
                )}
              </div>
            );
          }
          return <Badge variant="success">Aktiv</Badge>;
        },
      }),
      columnHelper.accessor('id', {
        header: 'ID',
        cell: (info) => <span className="font-mono text-gray-600 text-sm dark:text-gray-400">{info.getValue()}</span>,
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Aktionen',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            {row.original.isLocked && (
              <IconButton size="sm" intent="success" appearance="minimal" onClick={() => onUnlock(row.original)} aria-label="Benutzer entsperren">
                <PiLockKeyOpen />
              </IconButton>
            )}
            <IconButton size="sm" appearance="minimal" onClick={() => onEdit(row.original)} aria-label="Benutzer bearbeiten">
              <PiPencilSimple />
            </IconButton>
            <IconButton size="sm" intent="danger" appearance="minimal" onClick={() => onDelete(row.original)} aria-label="Benutzer löschen">
              <PiTrash />
            </IconButton>
          </div>
        ),
      }),
    ],
    [onDelete, onEdit, onUnlock],
  );

  const table = useReactTable({
    data: users || [],
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (isLoading) {
    return (
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head>Benutzername</Table.Head>
            <Table.Head>Rolle</Table.Head>
            <Table.Head>Status</Table.Head>
            <Table.Head>ID</Table.Head>
            <Table.Head>Aktionen</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Skeleton rows={5} columns={5} />
      </Table.Root>
    );
  }

  return (
    <Table.Root>
      <Table.Header>
        {table.getHeaderGroups().map((headerGroup) => (
          <Table.Row key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <Table.Head key={header.id} onClick={header.column.getToggleSortingHandler()} sortable={header.column.getCanSort()} sorted={header.column.getIsSorted()}>
                {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
              </Table.Head>
            ))}
          </Table.Row>
        ))}
      </Table.Header>
      <Table.Body>
        {table.getRowModel().rows.map((row) => (
          <Table.Row key={row.id}>
            {row.getVisibleCells().map((cell) => (
              <Table.Cell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</Table.Cell>
            ))}
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
};
