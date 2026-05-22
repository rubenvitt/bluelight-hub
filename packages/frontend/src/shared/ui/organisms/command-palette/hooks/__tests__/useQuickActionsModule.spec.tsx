import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useQuickActionsModule } from '../useQuickActionsModule';

const navigateSpy = vi.fn();
const matchRouteSpy = vi.fn();
const useParamsSpy = vi.fn();
const logoutMutateAsyncSpy = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateSpy,
  useMatchRoute: () => matchRouteSpy,
  useParams: (...args: unknown[]) => useParamsSpy(...args),
}));

vi.mock('@/features/auth', () => ({
  useLogout: () => ({
    mutateAsync: logoutMutateAsyncSpy,
  }),
}));

vi.mock('../useThemeCommands', () => ({
  useThemeCommands: () => ({
    themeOptions: [],
    handleThemeChange: vi.fn(),
  }),
}));

describe('useQuickActionsModule', () => {
  beforeEach(() => {
    navigateSpy.mockReset();
    matchRouteSpy.mockReset();
    useParamsSpy.mockReset();
    logoutMutateAsyncSpy.mockReset();
    matchRouteSpy.mockReturnValue(false);
  });

  describe('Patienten-Modul Quick-Action (UX-DR19/UX-DR20)', () => {
    it('enthält "Patienten-Modul öffnen" wenn ein einsatzId-Param vorhanden ist', () => {
      useParamsSpy.mockReturnValue({ einsatzId: 'einsatz-1' });

      const { result } = renderHook(() => useQuickActionsModule());

      const patientenEntry = result.current.subPages.find((p) => p.name === 'Patienten-Modul öffnen');
      expect(patientenEntry).toBeDefined();
    });

    it('blendet "Patienten-Modul öffnen" aus, wenn kein Einsatz aktiv ist', () => {
      useParamsSpy.mockReturnValue(undefined);

      const { result } = renderHook(() => useQuickActionsModule());

      const patientenEntry = result.current.subPages.find((p) => p.name === 'Patienten-Modul öffnen');
      expect(patientenEntry).toBeUndefined();
    });

    it('navigiert beim Klick zur Patienten-Übersicht des aktiven Einsatzes', () => {
      useParamsSpy.mockReturnValue({ einsatzId: 'einsatz-42' });

      const { result } = renderHook(() => useQuickActionsModule());
      const patientenEntry = result.current.subPages.find((p) => p.name === 'Patienten-Modul öffnen');
      expect(patientenEntry).toBeDefined();

      patientenEntry!.action?.();

      expect(navigateSpy).toHaveBeenCalledWith({
        to: '/app/einsatz/$einsatzId/patienten',
        params: { einsatzId: 'einsatz-42' },
      });
    });

    it('liefert passende Keywords/Aliases für die Suche', () => {
      useParamsSpy.mockReturnValue({ einsatzId: 'einsatz-1' });

      const { result } = renderHook(() => useQuickActionsModule());
      const patientenEntry = result.current.subPages.find((p) => p.name === 'Patienten-Modul öffnen');

      expect(patientenEntry?.keywords).toEqual(expect.arrayContaining(['patient', 'patienten', 'p']));
    });
  });
});
