import { EINSATZ_WORKSPACE_MODULES, getCanonicalWorkspaceRoute, getWorkspacePrimaryRoute, isWorkspaceRouteAccessible } from '../einsatz-workspace.registry';
import { PiClipboard } from 'react-icons/pi';
import { describe, expect, it } from 'vitest';

describe('einsatz workspace registry', () => {
  it('stellt einen typisierten Workspace-Contract mit Route-, Shortcut- und Badge-Metadaten bereit', () => {
    expect(EINSATZ_WORKSPACE_MODULES.length).toBeGreaterThan(0);

    const fuehrungModule = EINSATZ_WORKSPACE_MODULES.find((module) => module.id === 'führung');

    expect(fuehrungModule).toMatchObject({
      id: 'führung',
      label: 'Führung',
      routeTarget: '/app/einsatz/$einsatzId/führung/etb',
      shortcut: {
        modifiers: ['alt'],
        key: '2',
      },
      visibility: {
        default: 'visible',
      },
      badgeHint: {
        kind: 'status',
        label: 'Unquittierte Befehle',
      },
    });
    expect(getWorkspacePrimaryRoute(fuehrungModule)).toBe('/app/einsatz/$einsatzId/führung/etb');
  });

  it('führt Unterseiten und künftige Priorisierung konsistent über denselben Contract', () => {
    const overviewModule = EINSATZ_WORKSPACE_MODULES.find((module) => module.id === 'übersicht');

    expect(overviewModule?.subPages[0]).toMatchObject({
      label: 'Dashboard',
      href: '/app/einsatz/$einsatzId/übersicht',
    });
    expect(overviewModule?.priority).toBeTypeOf('number');
    expect(overviewModule?.subPages.find((page) => page.id === 'dashboard')?.visibility.default).toBe('visible');
    expect(overviewModule?.subPages.find((page) => page.id === 'karte')?.visibility.default).toBe('visible');
    expect(overviewModule?.subPages.find((page) => page.id === 'statistik')?.visibility).toMatchObject({
      default: 'disabled',
    });
  });

  it('begrenzt Story 1.8 auf sichtbare Kernziele und markiert spätere Bereiche bewusst als deaktiviert', () => {
    const visibleModules = EINSATZ_WORKSPACE_MODULES.filter((module) => module.visibility.default === 'visible');
    const disabledModules = EINSATZ_WORKSPACE_MODULES.filter((module) => module.visibility.default === 'disabled');
    const fuehrungModule = EINSATZ_WORKSPACE_MODULES.find((module) => module.id === 'führung');
    const kraefteModule = EINSATZ_WORKSPACE_MODULES.find((module) => module.id === 'kräfte');

    expect(visibleModules.map((module) => module.id)).toEqual(['übersicht', 'führung', 'kommunikation', 'kräfte', 'sicherheit', 'patienten']);
    expect(disabledModules.map((module) => module.id)).toEqual(['betreuung', 'logistik', 'drohne']);
    expect(disabledModules.every((module) => module.visibility.reason)).toBe(true);
    expect(fuehrungModule?.subPages.find((page) => page.id === 'etb')?.visibility.default).toBe('visible');
    expect(fuehrungModule?.subPages.find((page) => page.id === 'pinnwand')?.visibility.default).toBe('visible');
    expect(fuehrungModule?.subPages.find((page) => page.id === 'befehle')?.visibility.default).toBe('visible');
    expect(fuehrungModule?.subPages.find((page) => page.id === 'rhythmus')?.visibility.default).toBe('visible');
    expect(kraefteModule?.subPages.find((page) => page.id === 'dashboard')?.visibility.default).toBe('visible');
    expect(kraefteModule?.subPages.find((page) => page.id === 'personal')?.visibility.default).toBe('visible');
    expect(kraefteModule?.subPages.find((page) => page.id === 'fahrzeuge')?.visibility.default).toBe('visible');
    expect(kraefteModule?.subPages.find((page) => page.id === 'einheiten')?.visibility.default).toBe('visible');
  });

  it('respektiert bewusst modellierte routeTargets statt implizit die erste Unterseite zu verwenden', () => {
    expect(
      getWorkspacePrimaryRoute({
        routeTarget: '/app/einsatz/$einsatzId/führung/berichte',
        subPages: [
          {
            id: 'etb',
            label: 'ETB',
            href: '/app/einsatz/$einsatzId/führung/etb',
            icon: PiClipboard,
            visibility: { default: 'visible' },
          },
          {
            id: 'berichte',
            label: 'Berichte',
            href: '/app/einsatz/$einsatzId/führung/berichte',
            icon: PiClipboard,
            visibility: { default: 'visible' },
          },
        ],
      }),
    ).toBe('/app/einsatz/$einsatzId/führung/berichte');
  });

  it('gibt eine kanonische Fallback-Route für den aktiven Workspace zurück', () => {
    expect(getCanonicalWorkspaceRoute()).toBe('/app/einsatz/$einsatzId/übersicht');
  });

  it('erlaubt nur sichtbare Module und Unterseiten für Direktaufrufe', () => {
    expect(isWorkspaceRouteAccessible('/app/einsatz/einsatz-42/führung/etb', 'einsatz-42')).toBe(true);
    expect(isWorkspaceRouteAccessible('/app/einsatz/einsatz-42/führung/protokoll', 'einsatz-42')).toBe(false);
    expect(isWorkspaceRouteAccessible('/app/einsatz/einsatz-42/kommunikation/funk', 'einsatz-42')).toBe(true);
    expect(isWorkspaceRouteAccessible('/app/einsatz/einsatz-42/übersicht', 'einsatz-42')).toBe(true);
    expect(isWorkspaceRouteAccessible('/app/einsatz/einsatz-42/übersicht/', 'einsatz-42')).toBe(true);
    expect(isWorkspaceRouteAccessible('/app/einsatz/einsatz-42/übersicht/karte', 'einsatz-42')).toBe(true);
    expect(isWorkspaceRouteAccessible('/app/einsatz/einsatz-42/übersicht/statistik', 'einsatz-42')).toBe(false);
  });

  describe('Eigenschutz-Flip (Story 1.6 AC1)', () => {
    it('markiert die sicherheit.eigenschutz-SubPage als sichtbar', () => {
      const sicherheit = EINSATZ_WORKSPACE_MODULES.find((module) => module.id === 'sicherheit');
      const eigenschutz = sicherheit?.subPages.find((page) => page.id === 'eigenschutz');

      expect(eigenschutz).toBeDefined();
      expect(eigenschutz?.visibility.default).toBe('visible');
      expect(eigenschutz?.href).toBe('/app/einsatz/$einsatzId/sicherheit/eigenschutz');
    });

    it('bewahrt Label, Icon und Description der Eigenschutz-SubPage', () => {
      const sicherheit = EINSATZ_WORKSPACE_MODULES.find((module) => module.id === 'sicherheit');
      const eigenschutz = sicherheit?.subPages.find((page) => page.id === 'eigenschutz');

      expect(eigenschutz?.label).toBe('Eigenschutz');
      expect(eigenschutz?.description).toBe('Arbeitsschutz');
      expect(eigenschutz?.icon).toBeDefined();
    });

    it('macht die Route für Direktaufrufe erreichbar (kein Redirect-Bypass)', () => {
      expect(isWorkspaceRouteAccessible('/app/einsatz/e-123/sicherheit/eigenschutz', 'e-123')).toBe(true);
    });

    it('lässt getCanonicalWorkspaceRoute unverändert auf der Übersicht', () => {
      expect(getCanonicalWorkspaceRoute()).toBe('/app/einsatz/$einsatzId/übersicht');
    });
  });
});
