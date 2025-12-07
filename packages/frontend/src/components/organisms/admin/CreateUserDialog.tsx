import { Button } from '@/components/atoms/button.atom';
import { RoleField, UsernameField } from '@/components/molecules/admin/UserFormFields';
import { Dialog } from '@/components/molecules/dialog.molecule';
import { ManagedUserResponseDtoRoleEnum } from '@bluelight-hub/shared/client';
import { useForm } from '@tanstack/react-form';
import { z } from 'zod';

const _createUserSchema = z.object({
  username: z
    .string()
    .min(3, 'Benutzername muss mindestens 3 Zeichen lang sein')
    .max(30, 'Benutzername darf maximal 30 Zeichen lang sein')
    .regex(/^[a-zA-Z0-9._]+$/, 'Benutzername darf nur Buchstaben, Zahlen, Unterstriche und Punkte enthalten'),
  role: z.nativeEnum(ManagedUserResponseDtoRoleEnum),
});

type CreateUserFormData = z.infer<typeof _createUserSchema>;

interface CreateUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateUserFormData) => void;
  isSubmitting: boolean;
}

export const CreateUserDialog = ({ isOpen, onClose, onSubmit, isSubmitting }: CreateUserDialogProps) => {
  const form = useForm({
    defaultValues: {
      username: '',
      role: ManagedUserResponseDtoRoleEnum.User as ManagedUserResponseDtoRoleEnum,
    },
    onSubmit: ({ value }) => {
      onSubmit(value);
    },
  });

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <Dialog isOpen={isOpen} onClose={handleClose}>
      <div className="relative">
        <Dialog.Title>Neuen Benutzer erstellen</Dialog.Title>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
      >
        <Dialog.Body>
          <div className="space-y-4">
            <form.Field name="username">{(field) => <UsernameField field={field} />}</form.Field>

            <form.Field name="role">{(field) => <RoleField field={field} />}</form.Field>
          </div>
        </Dialog.Body>

        <Dialog.Footer>
          <Button intent="secondary" appearance="ghost" onClick={handleClose} disabled={isSubmitting}>
            Abbrechen
          </Button>
          <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
            {([canSubmit, isFormSubmitting]) => {
              const submitting = isFormSubmitting || isSubmitting;
              return (
                <Button type="submit" disabled={!canSubmit || submitting} loading={submitting}>
                  Benutzer erstellen
                </Button>
              );
            }}
          </form.Subscribe>
        </Dialog.Footer>
      </form>
    </Dialog>
  );
};
