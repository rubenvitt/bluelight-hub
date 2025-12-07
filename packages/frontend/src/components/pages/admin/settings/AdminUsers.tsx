import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useAdminUserManagement } from '@/hooks/useAdminUserManagement';
import { Alert } from '@atoms/alert.atom';
import { Button } from '@atoms/button.atom';
import { Card } from '@atoms/card.atom';
import { Container } from '@atoms/container.atom';
import { Heading } from '@atoms/heading.atom';
import { Spinner } from '@atoms/spinner.atom';
import { type CreateUserDto, type UpdateUserDto, type ManagedUserResponseDto, ManagedUserResponseDtoRoleEnum } from '@bluelight-hub/shared/client';
import { ConfirmDeleteDialog, type UserActionType } from '@organisms/admin/ConfirmDeleteDialog';
import { CreateUserDialog } from '@organisms/admin/CreateUserDialog';
import { EditUserDialog } from '@organisms/admin/EditUserDialog';
import { UsersTable } from '@organisms/admin/UsersTable';
import { Navigate } from '@tanstack/react-router';
import { useState } from 'react';
import { PiPlus, PiWarning } from 'react-icons/pi';

export function AdminUsers() {
  const { isAdmin, isLoading: isAuthLoading } = useAdminAuth();
  const {
    usersData,
    isLoading: isUsersLoading,
    error,
    createUser,
    updateUser,
    deleteUser,
    lockUser,
    unlockUser,
    isCreating,
    isUpdating,
    isDeleting,
    isLocking,
    isUnlocking,
  } = useAdminUserManagement();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ManagedUserResponseDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ManagedUserResponseDto | null>(null);

  // Redirect if not admin
  if (!isAuthLoading && !isAdmin) {
    return <Navigate to="/admin-login" />;
  }

  const handleCreateUser = (data: CreateUserDto) => {
    createUser(data, {
      onSuccess: () => {
        setIsCreateDialogOpen(false);
      },
    });
  };

  const handleEditUser = (user: ManagedUserResponseDto) => {
    setEditTarget(user);
    setIsEditDialogOpen(true);
  };

  const handleUpdateUser = (id: string, data: UpdateUserDto) => {
    updateUser(
      { id, data },
      {
        onSuccess: () => {
          setIsEditDialogOpen(false);
          setEditTarget(null);
        },
      },
    );
  };

  const handleDeleteUser = (user: ManagedUserResponseDto) => {
    setDeleteTarget(user);
  };

  const handleUnlockUser = (user: ManagedUserResponseDto) => {
    unlockUser(user.id);
  };

  const confirmDelete = (action: UserActionType, lockReason?: string) => {
    if (!deleteTarget) return;

    switch (action) {
      case 'delete':
        deleteUser(
          { id: deleteTarget.id, downgradeAdmin: false },
          {
            onSettled: () => {
              setDeleteTarget(null);
            },
          },
        );
        break;
      case 'downgrade':
        deleteUser(
          { id: deleteTarget.id, downgradeAdmin: true },
          {
            onSettled: () => {
              setDeleteTarget(null);
            },
          },
        );
        break;
      case 'lock':
        lockUser(
          { id: deleteTarget.id, reason: lockReason },
          {
            onSettled: () => {
              setDeleteTarget(null);
            },
          },
        );
        break;
    }
  };

  if (isAuthLoading || isUsersLoading) {
    return (
      <Container maxWidth="6xl" className="py-8">
        <div className="flex h-[50vh] items-center justify-center">
          <Spinner size="xl" />
        </div>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="6xl" className="py-8">
        <div className="flex h-[50vh] items-center justify-center">
          <Alert status="error" title="Fehler beim Laden der Benutzer" description={error.message} icon={<PiWarning className="h-6 w-6" />} />
        </div>
      </Container>
    );
  }

  return (
    <Container maxWidth="6xl" className="py-8">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <Heading size="lg" as="h1">
            Benutzerverwaltung
          </Heading>
          <Button onClick={() => setIsCreateDialogOpen(true)} intent="primary" appearance="outline">
            <PiPlus className="mr-2" />
            Benutzer hinzufügen
          </Button>
        </div>

        <Card padding="md">
          <UsersTable users={usersData?.data} isLoading={isUsersLoading} onEdit={handleEditUser} onDelete={handleDeleteUser} onUnlock={handleUnlockUser} />
        </Card>
      </div>

      <CreateUserDialog isOpen={isCreateDialogOpen} onClose={() => setIsCreateDialogOpen(false)} onSubmit={handleCreateUser} isSubmitting={isCreating} />

      <EditUserDialog
        isOpen={isEditDialogOpen}
        onClose={() => {
          setIsEditDialogOpen(false);
          setEditTarget(null);
        }}
        onSubmit={handleUpdateUser}
        isSubmitting={isUpdating}
        user={editTarget}
      />

      <ConfirmDeleteDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        userName={deleteTarget?.username || ''}
        userRole={deleteTarget?.role || ManagedUserResponseDtoRoleEnum.User}
        isDeleting={isDeleting || isLocking || isUnlocking}
      />
    </Container>
  );
}
