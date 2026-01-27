import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject, Injectable } from '@nestjs/common';
import { Result } from '@domain/common/result';
import type { IUserRepository } from '@domain/repositories/i-user.repository';
import type { ILogger } from '@domain/ports/i-logger.port';
import { LOGGER, USER_REPOSITORY } from '@infrastructure/di-tokens';
import { UpdateProfileCommand } from './update-profile.command';
import { UserId } from '@domain/value-objects/user-id';

@Injectable()
@CommandHandler(UpdateProfileCommand)
export class UpdateProfileHandler implements ICommandHandler<UpdateProfileCommand, Result<void>> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(LOGGER) private readonly logger: ILogger,
  ) {}

  async execute(command: UpdateProfileCommand): Promise<Result<void>> {
    const { userId, defaultEscalationTargetId } = command;

    try {
      // 1. User laden
      const userIdVO = UserId.create(userId);
      if (userIdVO.isFailure) return Result.fail('Invalid UserId');

      const userResult = await this.userRepository.findById(userIdVO.value!);
      if (userResult.isFailure) {
        return Result.fail(userResult.error ?? 'Failed to load user');
      }
      const user = userResult.value;
      if (!user) {
        return Result.fail('User not found');
      }

      // 2. Validate Escalation Target if set
      let targetIdVO: UserId | null = null;

      if (defaultEscalationTargetId) {
        // Prevent self-escalation
        if (defaultEscalationTargetId === userId) {
          return Result.fail('Cannot set self as escalation target');
        }

        const targetIdResult = UserId.create(defaultEscalationTargetId);
        if (targetIdResult.isFailure) return Result.fail('Invalid Escalation Target ID');
        targetIdVO = targetIdResult.value!;

        const targetResult = await this.userRepository.findById(targetIdVO);
        if (targetResult.isFailure || !targetResult.value) {
          return Result.fail('Escalation target user not found');
        }
      }

      // 3. Update User Aggregate
      // TODO: Add method to User Aggregate (Story 4.8)
      // user.updateEscalationConfig(defaultEscalationTargetId);
      // For now we map it directly if method missing, but better add checking logic in Domain.
      // Let's assume we will add `updateEscalationTarget` to User Entity.

      // But wait, User entity is in Domain. I need to modify it first or now.
      // I will assume method `updateDefaultEscalationTarget` exists or I access public props/methods.
      // Actually User entity modification was in the plan. I haven't done it yet.
      // I should modify User Entity first.

      // Lets implement the logic here assuming I will add the method in next step.
      user.updateDefaultEscalationTarget(targetIdVO);

      // 4. Save
      await this.userRepository.save(user);

      this.logger.log(`User ${userId} updated profile`, { defaultEscalationTargetId });

      return Result.ok(undefined);
    } catch (error) {
      this.logger.error('Error updating profile', { error, userId });
      return Result.fail('Internal error updating profile');
    }
  }
}
