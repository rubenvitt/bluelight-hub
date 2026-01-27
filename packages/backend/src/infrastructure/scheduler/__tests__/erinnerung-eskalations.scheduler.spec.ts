import { Test, type TestingModule } from '@nestjs/testing';
import { ErinnerungEskalationsScheduler } from '../erinnerung-eskalations.scheduler';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ERINNERUNG_REPOSITORY, LOGGER } from '@infrastructure/di-tokens';
import { Result } from '@domain/common/result';
import type { Erinnerung } from '@domain/entities/erinnerung.entity';
import type { IErinnerungRepository } from '@domain/repositories/i-erinnerung.repository';
import { ErinnerungKonfiguration } from '@domain/erinnerung-konfiguration/entities/erinnerung-konfiguration.entity';
import { EskaliereErinnerungCommand } from '@application/erinnerung/commands/eskaliere-erinnerung/eskaliere-erinnerung.command';
import { GetErinnerungKonfigurationQuery } from '@application/erinnerung-konfiguration/queries/get-erinnerung-konfiguration.query';
import type { ILogger } from '@domain/ports/i-logger.port';

describe('ErinnerungEskalationsScheduler', () => {
  let scheduler: ErinnerungEskalationsScheduler;
  let commandBus: CommandBus;
  let queryBus: QueryBus;
  let repository: jest.Mocked<IErinnerungRepository>;
  let logger: ILogger;

  beforeEach(async () => {
    repository = {
      findOverdue: jest.fn(),
    } as unknown as jest.Mocked<IErinnerungRepository>;

    logger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ErinnerungEskalationsScheduler,
        {
          provide: ERINNERUNG_REPOSITORY,
          useValue: repository,
        },
        {
          provide: LOGGER,
          useValue: logger,
        },
        {
          provide: CommandBus,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: QueryBus,
          useValue: {
            execute: jest.fn(),
          },
        },
      ],
    }).compile();

    scheduler = module.get<ErinnerungEskalationsScheduler>(ErinnerungEskalationsScheduler);
    commandBus = module.get<CommandBus>(CommandBus);
    queryBus = module.get<QueryBus>(QueryBus);
  });

  it('should be defined', () => {
    expect(scheduler).toBeDefined();
  });

  it('should trigger escalation for overdue reminders', async () => {
    // Arrange
    const config = ErinnerungKonfiguration.createDefault();
    jest.spyOn(queryBus, 'execute').mockResolvedValue(config);

    const overdueReminder = {
      id: { toString: () => '123' },
    } as Erinnerung;

    repository.findOverdue.mockResolvedValue(Result.ok([overdueReminder]));

    // Act
    await scheduler.handleCron();

    // Assert
    expect(queryBus.execute).toHaveBeenCalledWith(expect.any(GetErinnerungKonfigurationQuery));
    expect(repository.findOverdue).toHaveBeenCalled();
    expect(commandBus.execute).toHaveBeenCalledWith(expect.any(EskaliereErinnerungCommand));
    expect(commandBus.execute).toHaveBeenCalledWith(expect.objectContaining({ erinnerungId: '123' }));
  });

  it('should do nothing if no overdue reminders found', async () => {
    // Arrange
    const config = ErinnerungKonfiguration.createDefault();
    jest.spyOn(queryBus, 'execute').mockResolvedValue(config);

    repository.findOverdue.mockResolvedValue(Result.ok([]));

    // Act
    await scheduler.handleCron();

    // Assert
    expect(repository.findOverdue).toHaveBeenCalled();
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('should handle errors gracefully', async () => {
    // Arrange
    jest.spyOn(queryBus, 'execute').mockRejectedValue(new Error('Config Error'));

    // Act
    await scheduler.handleCron();

    // Assert
    expect(logger.error).toHaveBeenCalled();
  });
});
