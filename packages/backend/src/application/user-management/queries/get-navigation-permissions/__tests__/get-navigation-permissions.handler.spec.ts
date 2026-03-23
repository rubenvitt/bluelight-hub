import { GetNavigationPermissionsQueryHandler } from '../get-navigation-permissions.handler';
import { GetNavigationPermissionsQuery } from '../get-navigation-permissions.query';

describe('GetNavigationPermissionsQueryHandler', () => {
  let handler: GetNavigationPermissionsQueryHandler;

  beforeEach(() => {
    handler = new GetNavigationPermissionsQueryHandler();
  });

  describe('SUPER_ADMIN', () => {
    it('sollte Zugang zu allen Bereichen gewaehren', async () => {
      const query = new GetNavigationPermissionsQuery('SUPER_ADMIN');
      const result = await handler.execute(query);

      expect(result.isSuccess).toBe(true);
      const permissions = result.value!;
      expect(permissions).toHaveLength(6);
      expect(permissions.every((p) => p.accessible)).toBe(true);
      expect(permissions.every((p) => p.reason === null)).toBe(true);
    });

    it('sollte alle definierten Bereiche enthalten', async () => {
      const query = new GetNavigationPermissionsQuery('SUPER_ADMIN');
      const result = await handler.execute(query);
      const areas = result.value!.map((p) => p.area);

      expect(areas).toEqual(['ueberblick', 'etb', 'befehle', 'stammdaten', 'berechtigungen', 'integrationen']);
    });
  });

  describe('ADMIN', () => {
    it('sollte Zugang zu allen Bereichen gewaehren', async () => {
      const query = new GetNavigationPermissionsQuery('ADMIN');
      const result = await handler.execute(query);

      expect(result.isSuccess).toBe(true);
      const permissions = result.value!;
      expect(permissions.every((p) => p.accessible)).toBe(true);
    });
  });

  describe('USER', () => {
    it('sollte Zugang zu operativen Bereichen gewaehren', async () => {
      const query = new GetNavigationPermissionsQuery('USER');
      const result = await handler.execute(query);

      expect(result.isSuccess).toBe(true);
      const permissions = result.value!;

      const accessible = permissions.filter((p) => p.accessible).map((p) => p.area);
      expect(accessible).toEqual(['ueberblick', 'etb', 'befehle']);
    });

    it('sollte Zugang zu Admin-Bereichen verweigern mit Begruendung', async () => {
      const query = new GetNavigationPermissionsQuery('USER');
      const result = await handler.execute(query);

      const denied = result.value!.filter((p) => !p.accessible);
      expect(denied).toHaveLength(3);
      expect(denied.map((p) => p.area)).toEqual(['stammdaten', 'berechtigungen', 'integrationen']);
      for (const p of denied) {
        expect(p.reason).toBe('Nur für Administratoren freigegeben');
      }
    });
  });

  describe('Custom Permissions', () => {
    it('sollte per Custom Permission Zugang zu gesperrten Bereichen gewaehren', async () => {
      const query = new GetNavigationPermissionsQuery('USER', ['nav:stammdaten']);
      const result = await handler.execute(query);

      const stammdaten = result.value!.find((p) => p.area === 'stammdaten');
      expect(stammdaten?.accessible).toBe(true);
      expect(stammdaten?.reason).toBeNull();
    });

    it('sollte nav:* Wildcard unterstuetzen', async () => {
      const query = new GetNavigationPermissionsQuery('USER', ['nav:*']);
      const result = await handler.execute(query);

      expect(result.value!.every((p) => p.accessible)).toBe(true);
    });

    it('sollte ohne Custom Permissions normal funktionieren', async () => {
      const query = new GetNavigationPermissionsQuery('USER', []);
      const result = await handler.execute(query);

      const denied = result.value!.filter((p) => !p.accessible);
      expect(denied).toHaveLength(3);
    });
  });
});
