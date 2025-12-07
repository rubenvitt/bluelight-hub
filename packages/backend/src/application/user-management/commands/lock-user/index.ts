/**
 * Barrel Export für LockUser Command und Handler.
 *
 * Vereinfacht Imports in anderen Modulen:
 * ```typescript
 * import { LockUserCommand, LockUserHandler } from '@application/user-management/commands/lock-user';
 * ```
 *
 * Statt:
 * ```typescript
 * import { LockUserCommand } from '@application/user-management/commands/lock-user/lock-user.command';
 * import { LockUserHandler } from '@application/user-management/commands/lock-user/lock-user.handler';
 * ```
 */
export { LockUserCommand } from './lock-user.command';
export { LockUserHandler } from './lock-user.handler';
