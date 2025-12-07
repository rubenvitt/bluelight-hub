import type React from 'react';
import { useState } from 'react';
import { flexRender, type Row } from '@tanstack/react-table';
import type { EintragDto } from '@bluelight-hub/shared/client';
import { useUpdateEtbEintrag } from '@/hooks/useEtb';
import { cn } from '@/utils/cn';
import { EtbActionsCell } from './cells/EtbActionsCell';

interface EtbTableRowEditableProps {
  row: Row<EintragDto>;
  style?: React.CSSProperties;
  className?: string;
  onDelete?: (entry: EintragDto) => void;
}

export const EtbTableRowEditable: React.FC<EtbTableRowEditableProps> = ({ row, style, className = '', onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(row.original.text);
  const updateEintrag = useUpdateEtbEintrag();

  const handleSave = () => {
    if (!row.original.id) return;

    updateEintrag.mutate(
      {
        eintragId: row.original.id,
        data: {
          text: editText,
        },
      },
      {
        onSuccess: () => {
          setIsEditing(false);
        },
      },
    );
  };

  const handleCancel = () => {
    setEditText(row.original.text);
    setIsEditing(false);
  };

  return (
    <tr
      className={cn(
        'transition-colors',
        row.original.deletedAt ? 'border-l-2 border-l-red-500 bg-red-50/30 opacity-60 dark:bg-red-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-900/50',
        isEditing && 'bg-blue-50 dark:bg-blue-900/20',
        className,
      )}
      style={style}
    >
      {row.getVisibleCells().map((cell) => {
        const columnId = cell.column.id;

        // Special handling for text column in edit mode
        if (columnId === 'text' && isEditing) {
          return (
            <td key={cell.id} className="px-3 py-2" style={{ width: cell.column.getSize() }}>
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className={cn('w-full rounded-md border-gray-300 shadow-sm', 'focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm', 'dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100')}
                rows={2}
              />
            </td>
          );
        }

        // Special handling for actions column
        if (columnId === 'actions') {
          return (
            <td key={cell.id} className="px-3 py-2" style={{ width: cell.column.getSize() }}>
              <EtbActionsCell
                isEditing={isEditing}
                onEdit={() => setIsEditing(true)}
                onSave={handleSave}
                onCancel={handleCancel}
                onDelete={onDelete ? () => onDelete(row.original) : undefined}
                isLoading={updateEintrag.isPending}
                isDeleted={!!row.original.deletedAt}
              />
            </td>
          );
        }

        // Default rendering for other columns
        return (
          <td key={cell.id} className="px-3 py-2" style={{ width: cell.column.getSize() }}>
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </td>
        );
      })}
    </tr>
  );
};
