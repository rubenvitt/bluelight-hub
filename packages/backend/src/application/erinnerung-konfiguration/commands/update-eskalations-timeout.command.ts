import { CommandHandler, type ICommand, type ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { IErinnerungKonfigurationRepository } from '@domain/erinnerung-konfiguration/repositories/erinnerung-konfiguration.repository.interface';
import { ErinnerungKonfiguration } from '@domain/erinnerung-konfiguration/entities/erinnerung-konfiguration.entity';
import { EskalationsTimeout } from '@domain/erinnerung-konfiguration/value-objects/eskalations-timeout';
import { Result } from '@domain/common/result';
import { UserId } from '@domain/value-objects/user-id';

export class UpdateEskalationsTimeoutCommand implements ICommand {
  constructor(
    public readonly timeoutMinutes: number,
    public readonly userId: string,
  ) {}
}

@CommandHandler(UpdateEskalationsTimeoutCommand)
export class UpdateEskalationsTimeoutHandler implements ICommandHandler<UpdateEskalationsTimeoutCommand> {
  constructor(
    @Inject(IErinnerungKonfigurationRepository)
    private readonly repository: IErinnerungKonfigurationRepository,
  ) {}

  async execute(command: UpdateEskalationsTimeoutCommand): Promise<Result<void>> {
    const timeoutResult = EskalationsTimeout.create(command.timeoutMinutes);
    if (timeoutResult.isFailure) {
      return Result.fail(timeoutResult.error as string);
    }

    const userIdResult = UserId.create(command.userId);
    if (userIdResult.isFailure) {
      return Result.fail(userIdResult.error as string);
    }

    let config = await this.repository.get();

    if (!config) {
      // Create new if not exists (Lazy Creation)
      // We start with default and then update to ensure consistent state/events,
      // or duplicate creation logic. Logic: Default + Update.
      config = ErinnerungKonfiguration.createDefault();
    }

    const updateResult = config.updateTimeout(timeoutResult.value as EskalationsTimeout, userIdResult.value as UserId);
    if (updateResult.isFailure) {
      return updateResult;
    }

    await this.repository.save(config);
    return Result.ok(undefined);
  }
}
