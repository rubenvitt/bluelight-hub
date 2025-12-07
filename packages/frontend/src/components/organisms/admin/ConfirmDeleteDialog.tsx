import { Badge } from '@/components/atoms/badge.atom';
import { Button } from '@/components/atoms/button.atom';
import { Input } from '@/components/atoms/input.atom';
import { Label } from '@/components/atoms/label.atom';
import { Dialog } from '@/components/molecules/dialog.molecule';
import { ManagedUserResponseDtoRoleEnum } from '@bluelight-hub/shared/client';
import { useState } from 'react';
import { PiLockKey, PiShieldWarning, PiUserMinus } from 'react-icons/pi';

export type UserActionType = 'delete' | 'downgrade' | 'lock';

interface ConfirmDeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (action: UserActionType, lockReason?: string) => void;
  userName: string;
  userRole: ManagedUserResponseDtoRoleEnum;
  isDeleting: boolean;
}

/**
 * Bestimmt die Badge-Variante basierend auf der Benutzerrolle.
 * @param role - Die Benutzerrolle als ManagedUserResponseDtoRoleEnum
 * @returns Die entsprechende Badge-Variante für die visuelle Darstellung
 */
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

export const ConfirmDeleteDialog = ({ isOpen, onClose, onConfirm, userName, userRole, isDeleting }: ConfirmDeleteDialogProps) => {
  const [selectedAction, setSelectedAction] = useState<UserActionType>('delete');
  const [lockReason, setLockReason] = useState('');

  const isAdmin = userRole === ManagedUserResponseDtoRoleEnum.Admin || userRole === ManagedUserResponseDtoRoleEnum.SuperAdmin;

  const handleClose = () => {
    setSelectedAction('delete');
    setLockReason('');
    onClose();
  };

  const handleConfirm = () => {
    onConfirm(selectedAction, selectedAction === 'lock' ? lockReason : undefined);
  };

  const getActionButtonText = () => {
    switch (selectedAction) {
      case 'delete':
        return 'Löschen';
      case 'downgrade':
        return 'Zu User herabstufen';
      case 'lock':
        return 'Sperren';
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={handleClose}>
      <div className="relative">
        <Dialog.Title>Benutzer-Aktion wählen</Dialog.Title>

        <Dialog.Body>
          <div className="flex flex-col space-y-4">
            <div className="flex flex-col items-center space-y-2 text-center">
              <PiShieldWarning className="h-12 w-12 text-orange-500" />
              <p className="font-semibold text-gray-900 text-lg dark:text-white">{userName}</p>
              <Badge variant={getRoleBadgeVariant(userRole)}>{userRole}</Badge>
            </div>

            <div className="space-y-3">
              <Label>Aktion auswählen:</Label>

              <div className="space-y-2">
                <label className="flex cursor-pointer items-center space-x-3 rounded-lg border border-gray-200 p-3 transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
                  <input
                    type="radio"
                    name="action"
                    value="delete"
                    checked={selectedAction === 'delete'}
                    onChange={(e) => setSelectedAction(e.target.value as UserActionType)}
                    className="h-4 w-4 text-red-600"
                  />
                  <div className="flex flex-1 items-center space-x-2">
                    <PiUserMinus className="h-5 w-5 text-red-500" />
                    <div>
                      <p className="font-medium text-sm">Löschen (Soft Delete)</p>
                      <p className="text-gray-500 text-xs dark:text-gray-400">{isAdmin ? 'Deaktivieren + zu User herabstufen (reaktivierbar)' : 'Benutzer deaktivieren (reaktivierbar)'}</p>
                    </div>
                  </div>
                </label>

                {isAdmin && (
                  <label className="flex cursor-pointer items-center space-x-3 rounded-lg border border-gray-200 p-3 transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
                    <input
                      type="radio"
                      name="action"
                      value="downgrade"
                      checked={selectedAction === 'downgrade'}
                      onChange={(e) => setSelectedAction(e.target.value as UserActionType)}
                      className="h-4 w-4 text-yellow-600"
                    />
                    <div className="flex flex-1 items-center space-x-2">
                      <PiShieldWarning className="h-5 w-5 text-yellow-500" />
                      <div>
                        <p className="font-medium text-sm">Zu User herabstufen (aktiv)</p>
                        <p className="text-gray-500 text-xs dark:text-gray-400">Admin-Rechte entfernen, als User aktiv bleiben</p>
                      </div>
                    </div>
                  </label>
                )}

                <label className="flex cursor-pointer items-center space-x-3 rounded-lg border border-gray-200 p-3 transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
                  <input
                    type="radio"
                    name="action"
                    value="lock"
                    checked={selectedAction === 'lock'}
                    onChange={(e) => setSelectedAction(e.target.value as UserActionType)}
                    className="h-4 w-4 text-orange-600"
                  />
                  <div className="flex flex-1 items-center space-x-2">
                    <PiLockKey className="h-5 w-5 text-orange-500" />
                    <div>
                      <p className="font-medium text-sm">Sperren</p>
                      <p className="text-gray-500 text-xs dark:text-gray-400">Temporär sperren (reversibel)</p>
                    </div>
                  </div>
                </label>
              </div>

              {selectedAction === 'lock' && (
                <div className="mt-3">
                  <Label htmlFor="lockReason">Sperrgrund (optional)</Label>
                  <Input id="lockReason" value={lockReason} onChange={(e) => setLockReason(e.target.value)} placeholder="z.B. Verstoß gegen Nutzungsbedingungen" className="mt-1" />
                </div>
              )}
            </div>
          </div>
        </Dialog.Body>

        <Dialog.Footer>
          <Button intent="secondary" appearance="ghost" onClick={handleClose} disabled={isDeleting}>
            Abbrechen
          </Button>
          <Button intent={selectedAction === 'delete' ? 'danger' : selectedAction === 'lock' ? 'warning' : 'primary'} onClick={handleConfirm} loading={isDeleting} disabled={isDeleting}>
            {getActionButtonText()}
          </Button>
        </Dialog.Footer>
      </div>
    </Dialog>
  );
};
