import { RolesGuard } from '../roles.guard';
import { Reflector } from '@nestjs/core';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import type { ILogger } from '@domain/ports/i-logger.port';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;
  const mockLogger: ILogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  };

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector, mockLogger);
  });

  function createMockContext(user?: { userId: string; role?: string }): ExecutionContext {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
        getResponse: jest.fn(),
        getNext: jest.fn(),
      }),
    } as unknown as ExecutionContext;
  }

  describe('Strukturierte 403-Response', () => {
    it('sollte suggestedAction in ForbiddenException enthalten wenn Rolle nicht ausreicht', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN', 'SUPER_ADMIN']);

      const context = createMockContext({ userId: 'user-1', role: 'USER' });

      try {
        guard.canActivate(context);
        fail('Sollte ForbiddenException werfen');
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        const response = (error as ForbiddenException).getResponse();
        expect(response).toMatchObject({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Dieser Bereich ist für Ihre Rolle nicht freigegeben',
          suggestedAction: 'Zurück zum Überblick',
        });
      }
    });

    it('sollte Zugriff erlauben wenn Rolle passt', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN', 'SUPER_ADMIN']);

      const context = createMockContext({ userId: 'user-1', role: 'ADMIN' });

      expect(guard.canActivate(context)).toBe(true);
    });

    it('sollte Zugriff erlauben wenn kein @Roles Decorator vorhanden', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

      const context = createMockContext({ userId: 'user-1', role: 'USER' });

      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('Fehlende Authentifizierung', () => {
    it('sollte ForbiddenException werfen wenn kein User im Request', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN', 'SUPER_ADMIN']);

      const context = createMockContext(undefined);

      try {
        guard.canActivate(context);
        fail('Sollte ForbiddenException werfen');
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect((error as ForbiddenException).message).toBe('Nicht authentifiziert');
      }
    });

    it('sollte ForbiddenException werfen wenn User keine Rolle hat', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN', 'SUPER_ADMIN']);

      const context = createMockContext({ userId: 'user-1', role: undefined });

      try {
        guard.canActivate(context);
        fail('Sollte ForbiddenException werfen');
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect((error as ForbiddenException).message).toBe('Keine Rolle zugewiesen - Zugriff verweigert');
      }
    });
  });
});
