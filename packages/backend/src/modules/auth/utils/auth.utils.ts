import { UserRole } from '@prisma/client';

export const adminRoles: Array<UserRole> = [UserRole.ADMIN, UserRole.SUPER_ADMIN];

export const isAdmin = (role: UserRole | undefined): boolean => {
  if (!role) return false;
  return adminRoles.includes(role);
};
