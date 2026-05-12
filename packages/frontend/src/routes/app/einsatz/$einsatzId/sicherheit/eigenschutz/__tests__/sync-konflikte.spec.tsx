/**
 * Schema- und Redirect-Tests für die Legacy-Route `/sync-konflikte`
 * (Goal G6 — `SyncConflictsPage` ersetzt durch `SyncConflictsDrawer`).
 *
 * Der Route-Komponenten-Pfad existiert nicht mehr; stattdessen wirft
 * `beforeLoad` ein TanStack-`redirect()`-Sentinel zur Layout-Route
 * `/eigenschutz` mit `openConflicts=1`.
 *
 * Pattern für die `createFileRoute`-Mock-Verkabelung: `alarmierung.spec.ts`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateFileRoute = vi.fn(() => (config: unknown) => ({ ...(config as object) }));

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-router')>('@tanstack/react-router');
  return {
    ...actual,
    createFileRoute: mockCreateFileRoute,
    // `redirect()` werfen wir manuell, damit der Test den Wurf direkt
    // einfangen kann (TanStack-internes Sentinel-Objekt simuliert).
    redirect: (target: unknown) => ({ __redirect: true, target }),
  };
});

type RouteShape = {
  validateSearch: (s: unknown) => unknown;
  beforeLoad: (args: { params: { einsatzId: string }; search: Record<string, unknown> }) => void;
};

interface RedirectPayload {
  to: string;
  params: { einsatzId: string };
  search: Record<string, unknown>;
  replace: boolean;
}

interface RedirectSentinel {
  __redirect: boolean;
  target: RedirectPayload;
}

function captureRedirect(fn: () => void): RedirectSentinel | undefined {
  try {
    fn();
    return undefined;
  } catch (sentinel) {
    return sentinel as RedirectSentinel;
  }
}

describe('Route /app/einsatz/$einsatzId/sicherheit/eigenschutz/sync-konflikte (Legacy-Redirect)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateSearch (Zod-Schema)', () => {
    it('akzeptiert ein leeres Search-Objekt', async () => {
      const { Route } = await import('../sync-konflikte');
      const validate = (Route as unknown as RouteShape).validateSearch;
      expect(validate(undefined)).toEqual({});
    });

    it('parst entityType + einheitId', async () => {
      const { Route } = await import('../sync-konflikte');
      const validate = (Route as unknown as RouteShape).validateSearch;
      const result = validate({ entityType: 'PSA_PROFIL_ZUWEISUNG', einheitId: 'einheit-7' });
      expect(result).toEqual({ entityType: 'PSA_PROFIL_ZUWEISUNG', einheitId: 'einheit-7' });
    });

    it('akzeptiert GEFAEHRDUNGSBEURTEILUNG_ITEM als entityType', async () => {
      const { Route } = await import('../sync-konflikte');
      const validate = (Route as unknown as RouteShape).validateSearch;
      const result = validate({ entityType: 'GEFAEHRDUNGSBEURTEILUNG_ITEM' }) as { entityType?: string } | undefined;
      expect(result?.entityType).toBe('GEFAEHRDUNGSBEURTEILUNG_ITEM');
    });

    it('Story 3.10 F6: kaputter Deep-Link (entityType=BOGUS) wirft NICHT, fällt auf leeres Filter-Objekt zurück', async () => {
      const { Route } = await import('../sync-konflikte');
      const validate = (Route as unknown as RouteShape).validateSearch;
      expect(() => validate({ entityType: 'BOGUS' })).not.toThrow();
      expect(validate({ entityType: 'BOGUS' })).toEqual({});
    });

    it('Story 3.10 F6: andere kaputte Search-Param-Typen fallen ebenfalls auf {} zurück', async () => {
      const { Route } = await import('../sync-konflikte');
      const validate = (Route as unknown as RouteShape).validateSearch;
      expect(() => validate({ einheitId: 42 })).not.toThrow();
      expect(validate({ einheitId: 42 })).toEqual({});
    });
  });

  describe('beforeLoad — Redirect zur Layout-Route (Goal G6)', () => {
    it('leitet auf /eigenschutz mit openConflicts=1 um', async () => {
      const { Route } = await import('../sync-konflikte');
      const beforeLoad = (Route as unknown as RouteShape).beforeLoad;

      const sentinel = captureRedirect(() => beforeLoad({ params: { einsatzId: 'einsatz-1' }, search: {} }));

      expect(sentinel?.__redirect).toBe(true);
      expect(sentinel?.target.to).toBe('/app/einsatz/$einsatzId/sicherheit/eigenschutz');
      expect(sentinel?.target.params).toEqual({ einsatzId: 'einsatz-1' });
      expect(sentinel?.target.search).toEqual({ openConflicts: 1 });
      expect(sentinel?.target.replace).toBe(true);
    });

    it('reicht entityType + einheitId an die Layout-Route weiter (Drawer öffnet vorgefiltert)', async () => {
      const { Route } = await import('../sync-konflikte');
      const beforeLoad = (Route as unknown as RouteShape).beforeLoad;

      const sentinel = captureRedirect(() =>
        beforeLoad({
          params: { einsatzId: 'einsatz-42' },
          search: { entityType: 'PSA_PROFIL_ZUWEISUNG', einheitId: 'einheit-7' },
        }),
      );

      expect(sentinel?.target.search).toEqual({
        openConflicts: 1,
        entityType: 'PSA_PROFIL_ZUWEISUNG',
        einheitId: 'einheit-7',
      });
    });

    it('redirected auch ohne Search-Params', async () => {
      const { Route } = await import('../sync-konflikte');
      const beforeLoad = (Route as unknown as RouteShape).beforeLoad;

      const sentinel = captureRedirect(() => beforeLoad({ params: { einsatzId: 'einsatz-1' }, search: undefined as unknown as Record<string, unknown> }));

      expect(sentinel?.__redirect).toBe(true);
      expect(sentinel?.target.search.openConflicts).toBe(1);
    });
  });
});
