import { ManagedUserResponseDtoRoleEnum } from '@bluelight-hub/shared/client';

const adminRoles: Array<ManagedUserResponseDtoRoleEnum> = [ManagedUserResponseDtoRoleEnum.Admin, ManagedUserResponseDtoRoleEnum.SuperAdmin];
export const isAdmin = (role: ManagedUserResponseDtoRoleEnum | string | undefined): boolean => {
  if (!role) return false;
  return adminRoles.includes(role as ManagedUserResponseDtoRoleEnum);
};
