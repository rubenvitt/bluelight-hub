import { Test, type TestingModule } from '@nestjs/testing';
import { UpdateEskalationsTimeoutHandler } from '../update-eskalations-timeout.command';
import { UpdateEskalationsTimeoutCommand } from '../update-eskalations-timeout.command';
import { IErinnerungKonfigurationRepository } from '@domain/erinnerung-konfiguration/repositories/erinnerung-konfiguration.repository.interface';
import { ErinnerungKonfiguration } from '@domain/erinnerung-konfiguration/entities/erinnerung-konfiguration.entity';

describe('UpdateEskalationsTimeoutHandler', () => {
  let handler: UpdateEskalationsTimeoutHandler;
  let repository: Partial<IErinnerungKonfigurationRepository>;

  beforeEach(async () => {
    repository = {
      get: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateEskalationsTimeoutHandler,
        {
          provide: IErinnerungKonfigurationRepository,
          useValue: repository,
        },
      ],
    }).compile();

    handler = module.get<UpdateEskalationsTimeoutHandler>(UpdateEskalationsTimeoutHandler);
  });

  it('should update existing configuration', async () => {
    const existingConfig = ErinnerungKonfiguration.createDefault();
    (repository.get as jest.Mock).mockResolvedValue(existingConfig);

    const command = new UpdateEskalationsTimeoutCommand(15, 'clq4kx3z0000008l40g5z8q9z');
    const result = await handler.execute(command);

    expect(result.isSuccess).toBe(true);
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        eskalationsTimeout: expect.objectContaining({ value: 15 }),
        updatedBy: expect.objectContaining({ value: 'clq4kx3z0000008l40g5z8q9z' }),
      }),
    );
  });

  it('should create new configuration if none exists', async () => {
    (repository.get as jest.Mock).mockResolvedValue(null);

    const command = new UpdateEskalationsTimeoutCommand(15, 'clq4kx3z0000008l40g5z8q9z');
    const result = await handler.execute(command);

    expect(result.isSuccess).toBe(true);
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        eskalationsTimeout: expect.objectContaining({ value: 15 }),
        updatedBy: expect.objectContaining({ value: 'clq4kx3z0000008l40g5z8q9z' }),
      }),
    );
  });

  it('should fail if timeout is invalid', async () => {
    const command = new UpdateEskalationsTimeoutCommand(0, 'user-1');
    const result = await handler.execute(command);

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('ESKALATIONS_TIMEOUT_TOO_LOW');
    expect(repository.save).not.toHaveBeenCalled();
  });
});
