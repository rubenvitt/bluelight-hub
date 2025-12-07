import { api } from '@/api';
import { QUERY_KEYS } from '@/queryKeys';
import { getApiErrorMessage } from '@/utils/apiErrorHandler';
import { logger } from '@/utils/logger';
import type { CreateUserDto, DeleteManagedUserResponse, ResponseError, UpdateUserDto, ManagedUserResponse, ManagedUsersListResponse } from '@bluelight-hub/shared/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

/**
 * Hook für Admin-Benutzerverwaltung
 *
 * Stellt alle Funktionen für Admin-Benutzerverwaltung bereit:
 * - Laden der Benutzerliste
 * - Erstellen neuer Benutzer
 * - Löschen von Benutzern
 *
 * @returns Objekt mit Benutzerdaten, Ladezuständen und Aktionen
 */
export const useAdminUserManagement = () => {
  const queryClient = useQueryClient();

  // Query für Benutzerliste
  const usersQuery = useQuery<ManagedUsersListResponse, ResponseError>({
    queryKey: QUERY_KEYS.admin.users,
    queryFn: async () => {
      return await api.userManagement().userManagementControllerFindAllVAlpha();
    },
  });

  // Mutation für Benutzer erstellen
  const createUserMutation = useMutation<ManagedUserResponse, ResponseError, CreateUserDto>({
    mutationFn: async (data: CreateUserDto) => {
      return await api.userManagement().userManagementControllerCreateVAlpha({
        createUserDto: data,
      });
    },
    onSuccess: async () => {
      toast.success('Benutzer erstellt', {
        description: 'Der Benutzer wurde erfolgreich erstellt.',
      });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.admin.users });
    },
    onError: async (error: ResponseError) => {
      const message = await getApiErrorMessage(error, 'Der Benutzer konnte nicht erstellt werden.', 'createUser');

      logger.error('Failed to create a user', error);
      toast.error('Fehler', {
        description: message,
      });
    },
  });

  // Mutation für Benutzer aktualisieren
  const updateUserMutation = useMutation<ManagedUserResponse, ResponseError, { id: string; data: UpdateUserDto }>({
    mutationFn: async ({ id, data }) => {
      return await api.userManagement().userManagementControllerUpdateVAlpha({
        id,
        updateUserDto: data,
      });
    },
    onSuccess: async () => {
      toast.success('Benutzer aktualisiert', {
        description: 'Die Änderungen wurden erfolgreich gespeichert.',
      });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.admin.users });
    },
    onError: async (error: ResponseError) => {
      const message = await getApiErrorMessage(error, 'Der Benutzer konnte nicht aktualisiert werden.', 'updateUser');

      logger.error('Failed to update user', error);
      toast.error('Fehler', {
        description: message,
      });
    },
  });

  // Mutation für Benutzer löschen (mit optionalem Downgrade)
  const deleteUserMutation = useMutation<DeleteManagedUserResponse, ResponseError, { id: string; downgradeAdmin?: boolean }, { previousUsers: ManagedUsersListResponse | undefined }>({
    mutationFn: async ({ id, downgradeAdmin }) => {
      return await api.userManagement().userManagementControllerRemoveVAlpha({
        id,
        deleteUserDto: downgradeAdmin ? { downgradeAdmin } : undefined,
      });
    },
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.admin.users });

      const previousUsers = queryClient.getQueryData<ManagedUsersListResponse>(QUERY_KEYS.admin.users);

      queryClient.setQueryData<ManagedUsersListResponse>(QUERY_KEYS.admin.users, (old) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.filter((user) => user.id !== id),
        };
      });

      return { previousUsers };
    },
    onError: async (error: ResponseError, _id, context) => {
      queryClient.setQueryData(QUERY_KEYS.admin.users, context?.previousUsers);

      const message = await getApiErrorMessage(error, 'Der Benutzer konnte nicht gelöscht werden.', 'deleteUser');

      logger.error('Failed to delete user', error);
      toast.error('Fehler', {
        description: message,
      });
    },
    onSuccess: (_, { downgradeAdmin }) => {
      if (downgradeAdmin) {
        toast.success('Admin herabgestuft', {
          description: 'Der Admin wurde erfolgreich zu einem normalen Benutzer herabgestuft.',
        });
      } else {
        toast.success('Benutzer gelöscht', {
          description: 'Der Benutzer wurde erfolgreich gelöscht.',
        });
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.admin.users });
    },
  });

  // Mutation für Benutzer sperren
  const lockUserMutation = useMutation<ManagedUserResponse, ResponseError, { id: string; reason?: string }>({
    mutationFn: async ({ id, reason }) => {
      return await api.userManagement().userManagementControllerLockVAlpha({
        id,
        lockUserDto: reason ? { reason } : undefined,
      });
    },
    onSuccess: async () => {
      toast.success('Benutzer gesperrt', {
        description: 'Der Benutzer wurde erfolgreich gesperrt.',
      });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.admin.users });
    },
    onError: async (error: ResponseError) => {
      const message = await getApiErrorMessage(error, 'Der Benutzer konnte nicht gesperrt werden.', 'lockUser');

      logger.error('Failed to lock user', error);
      toast.error('Fehler', {
        description: message,
      });
    },
  });

  // Mutation für Benutzer entsperren
  const unlockUserMutation = useMutation<ManagedUserResponse, ResponseError, string>({
    mutationFn: async (id: string) => {
      return await api.userManagement().userManagementControllerUnlockVAlpha({ id });
    },
    onSuccess: async () => {
      toast.success('Benutzer entsperrt', {
        description: 'Der Benutzer wurde erfolgreich entsperrt.',
      });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.admin.users });
    },
    onError: async (error: ResponseError) => {
      const message = await getApiErrorMessage(error, 'Der Benutzer konnte nicht entsperrt werden.', 'unlockUser');

      logger.error('Failed to unlock user', error);
      toast.error('Fehler', {
        description: message,
      });
    },
  });

  return {
    // Benutzerdaten und Ladezustände
    users: usersQuery.data?.data,
    usersData: usersQuery.data,
    isLoading: usersQuery.isLoading,
    error: usersQuery.error,
    refetch: usersQuery.refetch,

    // Aktionen
    createUser: createUserMutation.mutate,
    updateUser: updateUserMutation.mutate,
    deleteUser: deleteUserMutation.mutate,
    lockUser: lockUserMutation.mutate,
    unlockUser: unlockUserMutation.mutate,

    // Mutation-Zustände
    isCreating: createUserMutation.isPending,
    isUpdating: updateUserMutation.isPending,
    isDeleting: deleteUserMutation.isPending,
    isLocking: lockUserMutation.isPending,
    isUnlocking: unlockUserMutation.isPending,
    createUserError: createUserMutation.error,
    updateUserError: updateUserMutation.error,
    deleteUserError: deleteUserMutation.error,
    lockUserError: lockUserMutation.error,
    unlockUserError: unlockUserMutation.error,
  };
};
