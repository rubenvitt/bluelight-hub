import { Button } from '@atoms/button.atom';
import { Dialog } from '@molecules/dialog.molecule';
import { useAuth } from '@/hooks/useAuth';
import { useLockEtb } from '@/hooks/useEtb';
import { AuthUserDtoRoleEnum } from '@bluelight-hub/shared/client';
import { useState, useCallback } from 'react';
import { PiLockSimple } from 'react-icons/pi';

interface EtbLockButtonProps {
  /** ID des ETB, das gesperrt werden soll */
  etbId: string;
  /** Deaktiviert den Button (z.B. wenn ETB bereits gesperrt) */
  disabled?: boolean;
  /** Callback nach erfolgreicher Sperrung */
  onSuccess?: () => void;
}

/**
 * Button zum Sperren eines Einsatztagebuchs
 *
 * Diese Komponente ist nur fuer Benutzer mit ADMIN oder SUPER_ADMIN Rolle sichtbar.
 * Zeigt einen Bestaetigungsdialog vor dem Sperren, da die Aktion unwiderruflich ist.
 */
export function EtbLockButton({ etbId, disabled = false, onSuccess }: EtbLockButtonProps) {
  const { user } = useAuth();
  const lockEtb = useLockEtb();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Nur ADMIN oder SUPER_ADMIN duerfen das ETB sperren
  const canLock = user?.role === AuthUserDtoRoleEnum.Admin || user?.role === AuthUserDtoRoleEnum.SuperAdmin;

  const handleOpenDialog = useCallback(() => {
    setIsDialogOpen(true);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setIsDialogOpen(false);
  }, []);

  const handleConfirmLock = useCallback(async () => {
    try {
      await lockEtb.mutateAsync({ etbId });
      // Erfolgs-Toast wird bereits im useLockEtb Hook angezeigt
      handleCloseDialog();
      onSuccess?.();
    } catch {
      // Fehler-Toast wird bereits im useLockEtb Hook angezeigt
      handleCloseDialog();
    }
  }, [etbId, lockEtb, handleCloseDialog, onSuccess]);

  // Komponente nicht rendern wenn Benutzer keine Berechtigung hat
  if (!canLock) {
    return null;
  }

  return (
    <>
      <Button intent="danger" appearance="outline" size="sm" onClick={handleOpenDialog} disabled={disabled || lockEtb.isPending} title="ETB sperren">
        <PiLockSimple className="mr-1.5 h-4 w-4" />
        ETB sperren
      </Button>

      <Dialog.Confirm
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        onConfirm={handleConfirmLock}
        title="ETB sperren?"
        message={
          <div className="space-y-2">
            <p className="font-semibold text-red-600 dark:text-red-400">Diese Aktion ist UNWIDERRUFLICH.</p>
            <p>Das ETB kann danach nicht mehr bearbeitet werden.</p>
          </div>
        }
        confirmLabel="ETB sperren"
        cancelLabel="Abbrechen"
        variant="danger"
        isProcessing={lockEtb.isPending}
        requireConfirmation={true}
      />
    </>
  );
}
