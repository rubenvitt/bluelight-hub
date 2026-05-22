import { PiTrash, PiUser } from 'react-icons/pi';
import { Checkbox } from '@/shared/ui/atoms/checkbox.atom';
import { useIncludedKontextType, toggleIncludedKontextType } from '../../stores';
import { cn } from '@/shared/ui/cn';

interface EtbFilterControlsProps {
  showDeleted: boolean;
  onShowDeletedChange: (show: boolean) => void;
}

/**
 * ETB Filter-Controls (z.B. gelöschte Einträge anzeigen, Kontext-Filter)
 */
export function EtbFilterControls({ showDeleted, onShowDeletedChange }: EtbFilterControlsProps) {
  const includedKontextType = useIncludedKontextType();
  const isPatientFilterActive = includedKontextType === 'patient';

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        id="etb-filter-patient-chip"
        aria-pressed={isPatientFilterActive}
        onClick={() => toggleIncludedKontextType('patient')}
        className={cn(
          'flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-200 focus-visible:shadow-focus-ring focus-visible:outline-none',
          isPatientFilterActive ? 'border-action-primary bg-action-secondary text-action-primary' : 'border-border-subtle bg-surface-panel text-text-secondary hover:bg-action-secondary',
        )}
      >
        <PiUser className={cn('h-4 w-4', isPatientFilterActive ? 'text-action-primary' : 'text-text-muted')} />
        Nur Patient-Ereignisse
      </button>

      <Checkbox
        id="etb-filter-show-deleted"
        checked={showDeleted}
        onChange={onShowDeletedChange}
        labelClassName="flex items-center gap-1.5 text-sm text-text-secondary"
        label={
          <>
            <PiTrash className="h-4 w-4" />
            Gelöschte Einträge anzeigen
          </>
        }
      />
    </div>
  );
}
