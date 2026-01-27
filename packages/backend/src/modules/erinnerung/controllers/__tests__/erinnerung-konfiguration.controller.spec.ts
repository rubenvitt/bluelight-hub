import { Test, type TestingModule } from '@nestjs/testing';
import { ErinnerungKonfigurationController } from '../erinnerung-konfiguration.controller';
import { QueryBus, CommandBus, CqrsModule } from '@nestjs/cqrs';
import { GetErinnerungKonfigurationQuery } from '@/application/erinnerung-konfiguration/queries/get-erinnerung-konfiguration.query';
import { Result } from '@/domain/common/result';
import { type User, UserRole } from '@/generated/prisma/client';
import { EskalationsTimeout } from '@/domain/erinnerung-konfiguration/value-objects/eskalations-timeout';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';

describe('ErinnerungKonfigurationController', () => {
  let controller: ErinnerungKonfigurationController;
  let queryBus: QueryBus;
  let commandBus: CommandBus;

  const mockUser = {
    id: 'user-1',
    role: UserRole.ADMIN,
  } as User;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [CqrsModule],
      controllers: [ErinnerungKonfigurationController],
    })
      .overrideProvider(QueryBus)
      .useValue({ execute: jest.fn() })
      .overrideProvider(CommandBus)
      .useValue({ execute: jest.fn() })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ErinnerungKonfigurationController>(ErinnerungKonfigurationController);
    queryBus = module.get<QueryBus>(QueryBus);
    commandBus = module.get<CommandBus>(CommandBus);
  });

  describe('getConfig', () => {
    it('should return configuration', async () => {
      const config = {
        eskalationsTimeout: EskalationsTimeout.create(10).value!,
      };
      (queryBus.execute as jest.Mock).mockResolvedValue(config);

      const result = await controller.getConfig();

      expect(queryBus.execute).toHaveBeenCalledWith(expect.any(GetErinnerungKonfigurationQuery));
      expect(result).toEqual({
        eskalationsTimeoutSeconds: 600,
        eskalationsTimeoutMinutes: 10,
      });
    });
  });

  describe('updateTimeout', () => {
    it('should update timeout', async () => {
      (commandBus.execute as jest.Mock).mockResolvedValue(Result.ok());

      await controller.updateTimeout({ timeoutMinutes: 15 }, mockUser);

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          timeoutMinutes: 15,
          userId: 'user-1',
        }),
      );
    });

    it('should throw error on failure', async () => {
      (commandBus.execute as jest.Mock).mockResolvedValue(Result.fail('Error'));

      await expect(controller.updateTimeout({ timeoutMinutes: 15 }, mockUser)).rejects.toThrow('Error');
    });
  });
});
