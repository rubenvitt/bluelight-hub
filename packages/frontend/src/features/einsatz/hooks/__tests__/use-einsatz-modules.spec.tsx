import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useEinsatzModules } from '../use-einsatz-modules';

vi.mock('@/features/auth/hooks', () => ({
  useNavigationPermissions: () => ({ data: undefined, isLoading: false }),
  NAVIGATION_PERMISSIONS_KEY: ['navigation', 'permissions'],
}));

describe('useEinsatzModules', () => {
  it('returns the full workspace contract instead of a legacy parallel shape', () => {
    const { result } = renderHook(() => useEinsatzModules());

    const fuehrungModule = result.current.find((module) => module.id === 'führung');

    expect(fuehrungModule).toMatchObject({
      id: 'führung',
      label: 'Führung',
      description: 'Einsatzleitung und Dokumentation',
      routeTarget: '/app/einsatz/$einsatzId/führung/etb',
      shortcut: {
        modifiers: ['alt'],
        key: '2',
      },
      badgeHint: {
        kind: 'status',
        label: 'Unquittierte Befehle',
      },
    });
    expect(fuehrungModule?.subPages[0]).toMatchObject({
      label: 'ETB',
      href: '/app/einsatz/$einsatzId/führung/etb',
      badge: 'NEU',
    });
  });
});
