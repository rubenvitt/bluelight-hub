// @ts-nocheck
import { ForbiddenException } from '@nestjs/common';
import { BefehlRollenGuard } from '../befehl-rollen.guard';
import { BEFEHL_ROLLEN_KEY } from '../../decorators/requires-befehl-rolle.decorator';

describe('BefehlRollenGuard', () => {
  let guard: BefehlRollenGuard;
  let mockReflector: any;
  let mockPrisma: any;

  const userId = 'user-123';
  const einsatzId = 'cm5testeinsatzid456789';
  const befehlId = 'cm5testbefehlid78901234';

  function createMockContext(overrides: { user?: any; body?: any; query?: any; params?: any } = {}) {
    const request = {
      user: 'user' in overrides ? overrides.user : { userId, role: 'USER' },
      body: overrides.body ?? {},
      query: overrides.query ?? {},
      params: overrides.params ?? {},
    };
    return {
      getHandler: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(request),
      }),
      _request: request,
    };
  }

  beforeEach(() => {
    mockReflector = {
      get: jest.fn(),
    };
    mockPrisma = {
      einsatzRollenzuweisung: {
        findUnique: jest.fn(),
      },
      befehl: {
        findUnique: jest.fn(),
      },
    };

    guard = new BefehlRollenGuard(mockReflector, mockPrisma);
  });

  describe('Kein Decorator (keine erforderlichen Rollen)', () => {
    it('gibt true zurueck wenn keine Metadata gesetzt ist', async () => {
      mockReflector.get.mockReturnValue(undefined);
      const context = createMockContext();

      const result = await guard.canActivate(context as any);

      expect(result).toBe(true);
      expect(mockReflector.get).toHaveBeenCalledWith(BEFEHL_ROLLEN_KEY, context.getHandler());
    });

    it('gibt true zurueck wenn leeres Rollen-Array gesetzt ist', async () => {
      mockReflector.get.mockReturnValue([]);
      const context = createMockContext();

      const result = await guard.canActivate(context as any);

      expect(result).toBe(true);
    });
  });

  describe('Admin/SuperAdmin Bypass', () => {
    it('gibt true zurueck fuer ADMIN ohne Rollen-Lookup', async () => {
      mockReflector.get.mockReturnValue(['BEFEHLSGEBER']);
      const context = createMockContext({ user: { userId, role: 'ADMIN' } });

      const result = await guard.canActivate(context as any);

      expect(result).toBe(true);
      expect(mockPrisma.einsatzRollenzuweisung.findUnique).not.toHaveBeenCalled();
    });

    it('gibt true zurueck fuer SUPER_ADMIN ohne Rollen-Lookup', async () => {
      mockReflector.get.mockReturnValue(['ERSTELLER']);
      const context = createMockContext({ user: { userId, role: 'SUPER_ADMIN' } });

      const result = await guard.canActivate(context as any);

      expect(result).toBe(true);
      expect(mockPrisma.einsatzRollenzuweisung.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('Fehlender User', () => {
    it('wirft ForbiddenException wenn kein User vorhanden', async () => {
      mockReflector.get.mockReturnValue(['BEFEHLSGEBER']);
      const context = createMockContext({ user: undefined });

      const error = await guard.canActivate(context as any).catch((e) => e);

      expect(error).toBeInstanceOf(ForbiddenException);
      expect(error.getResponse()).toEqual(
        expect.objectContaining({
          code: 'MISSING_ROLLE',
          message: 'Nicht authentifiziert',
          allowedRoles: ['BEFEHLSGEBER'],
        }),
      );
    });

    it('wirft ForbiddenException wenn userId fehlt', async () => {
      mockReflector.get.mockReturnValue(['BEFEHLSGEBER']);
      const context = createMockContext({ user: { role: 'USER' } });

      const error = await guard.canActivate(context as any).catch((e) => e);

      expect(error).toBeInstanceOf(ForbiddenException);
      expect(error.getResponse()).toEqual(
        expect.objectContaining({
          code: 'MISSING_ROLLE',
          message: 'Nicht authentifiziert',
        }),
      );
    });
  });

  describe('EinsatzId-Aufloesung', () => {
    beforeEach(() => {
      mockReflector.get.mockReturnValue(['BEFEHLSGEBER']);
    });

    it('loest EinsatzId aus Body auf', async () => {
      const context = createMockContext({ body: { einsatzId } });
      mockPrisma.einsatzRollenzuweisung.findUnique.mockResolvedValue({
        rolle: 'BEFEHLSGEBER',
      });

      const result = await guard.canActivate(context as any);

      expect(result).toBe(true);
      expect(mockPrisma.einsatzRollenzuweisung.findUnique).toHaveBeenCalledWith({
        where: { einsatzId_userId: { einsatzId, userId } },
      });
    });

    it('loest EinsatzId aus Query auf', async () => {
      const context = createMockContext({ query: { einsatzId } });
      mockPrisma.einsatzRollenzuweisung.findUnique.mockResolvedValue({
        rolle: 'BEFEHLSGEBER',
      });

      const result = await guard.canActivate(context as any);

      expect(result).toBe(true);
      expect(mockPrisma.einsatzRollenzuweisung.findUnique).toHaveBeenCalledWith({
        where: { einsatzId_userId: { einsatzId, userId } },
      });
    });

    it('loest EinsatzId ueber Befehl-Lookup aus params.id auf', async () => {
      const context = createMockContext({ params: { id: befehlId } });
      mockPrisma.befehl.findUnique.mockResolvedValue({ einsatzId });
      mockPrisma.einsatzRollenzuweisung.findUnique.mockResolvedValue({
        rolle: 'BEFEHLSGEBER',
      });

      const result = await guard.canActivate(context as any);

      expect(result).toBe(true);
      expect(mockPrisma.befehl.findUnique).toHaveBeenCalledWith({
        where: { id: befehlId },
        select: { einsatzId: true },
      });
      expect(mockPrisma.einsatzRollenzuweisung.findUnique).toHaveBeenCalledWith({
        where: { einsatzId_userId: { einsatzId, userId } },
      });
    });

    it('bevorzugt Body ueber Query', async () => {
      const context = createMockContext({
        body: { einsatzId: 'from-body' },
        query: { einsatzId: 'from-query' },
      });
      mockPrisma.einsatzRollenzuweisung.findUnique.mockResolvedValue({
        rolle: 'BEFEHLSGEBER',
      });

      await guard.canActivate(context as any);

      expect(mockPrisma.einsatzRollenzuweisung.findUnique).toHaveBeenCalledWith({
        where: { einsatzId_userId: { einsatzId: 'from-body', userId } },
      });
    });

    it('wirft ForbiddenException wenn keine EinsatzId ermittelt werden kann', async () => {
      const context = createMockContext();

      const error = await guard.canActivate(context as any).catch((e) => e);

      expect(error).toBeInstanceOf(ForbiddenException);
      expect(error.getResponse()).toEqual(
        expect.objectContaining({
          code: 'MISSING_ROLLE',
          message: 'Einsatz-Kontext konnte nicht ermittelt werden',
        }),
      );
    });

    it('wirft ForbiddenException wenn Befehl-Lookup null liefert', async () => {
      const context = createMockContext({ params: { id: 'nonexistent-befehl' } });
      mockPrisma.befehl.findUnique.mockResolvedValue(null);

      await expect(guard.canActivate(context as any)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Rollen-Pruefung', () => {
    beforeEach(() => {
      mockReflector.get.mockReturnValue(['BEFEHLSGEBER', 'ERSTELLER']);
    });

    it('gibt true zurueck wenn User die korrekte Rolle hat', async () => {
      const context = createMockContext({ body: { einsatzId } });
      mockPrisma.einsatzRollenzuweisung.findUnique.mockResolvedValue({
        rolle: 'BEFEHLSGEBER',
      });

      const result = await guard.canActivate(context as any);

      expect(result).toBe(true);
    });

    it('gibt true zurueck fuer zweite erlaubte Rolle (OR-Verknuepfung)', async () => {
      const context = createMockContext({ body: { einsatzId } });
      mockPrisma.einsatzRollenzuweisung.findUnique.mockResolvedValue({
        rolle: 'ERSTELLER',
      });

      const result = await guard.canActivate(context as any);

      expect(result).toBe(true);
    });

    it('wirft ForbiddenException bei falscher Rolle', async () => {
      const context = createMockContext({ body: { einsatzId } });
      mockPrisma.einsatzRollenzuweisung.findUnique.mockResolvedValue({
        rolle: 'EMPFAENGER',
      });

      const error = await guard.canActivate(context as any).catch((e) => e);

      expect(error).toBeInstanceOf(ForbiddenException);
      const response = error.getResponse();
      expect(response).toEqual(
        expect.objectContaining({
          code: 'MISSING_ROLLE',
          allowedRoles: ['BEFEHLSGEBER', 'ERSTELLER'],
        }),
      );
      expect(response.nextAction).toContain('EMPFAENGER');
      expect(response.nextAction).toContain('BEFEHLSGEBER oder ERSTELLER');
    });

    it('wirft ForbiddenException wenn keine Rollenzuweisung existiert', async () => {
      const context = createMockContext({ body: { einsatzId } });
      mockPrisma.einsatzRollenzuweisung.findUnique.mockResolvedValue(null);

      const error = await guard.canActivate(context as any).catch((e) => e);

      expect(error).toBeInstanceOf(ForbiddenException);
      expect(error.getResponse()).toEqual(
        expect.objectContaining({
          code: 'MISSING_ROLLE',
          message: 'Keine Berechtigung fuer diese Aktion',
          allowedRoles: ['BEFEHLSGEBER', 'ERSTELLER'],
          nextAction: expect.stringContaining('Einsatzleiter'),
        }),
      );
    });
  });

  describe('Request-Anreicherung', () => {
    it('speichert einsatzRolle und resolvedEinsatzId im Request', async () => {
      mockReflector.get.mockReturnValue(['BEFEHLSGEBER']);
      const context = createMockContext({ body: { einsatzId } });
      mockPrisma.einsatzRollenzuweisung.findUnique.mockResolvedValue({
        rolle: 'BEFEHLSGEBER',
      });

      await guard.canActivate(context as any);

      const request = context.switchToHttp().getRequest();
      expect(request.einsatzRolle).toBe('BEFEHLSGEBER');
      expect(request.resolvedEinsatzId).toBe(einsatzId);
    });
  });
});
