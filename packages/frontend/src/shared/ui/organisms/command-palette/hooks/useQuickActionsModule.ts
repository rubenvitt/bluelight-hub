import { useLogout } from '@/features/auth';
import { useMatchRoute, useNavigate, useParams } from '@tanstack/react-router';
import { useCallback, useMemo } from 'react';
import { PiArrowsOut, PiCaretRight, PiClipboard, PiFirstAid, PiGear, PiPalette, PiSignOut } from 'react-icons/pi';
import { toast } from 'sonner';
import type { LagekarteSearchParams } from '@/features/lagekarte/ui';
import type { EtbSearchParams } from '@routes/app/einsatz/$einsatzId/führung/etb/';
import type { ModuleConfig } from '../types';
import { useThemeCommands } from './useThemeCommands';

export const useQuickActionsModule = (): ModuleConfig => {
  const navigate = useNavigate();
  const matchRoute = useMatchRoute();
  const logout = useLogout();
  const { einsatzId } = useParams({ from: '/app/einsatz/$einsatzId', shouldThrow: false }) ?? {};
  const { themeOptions, handleThemeChange } = useThemeCommands();
  type FullscreenSearchParams = LagekarteSearchParams | EtbSearchParams;

  const setFullscreenSearch = useCallback(
    (prev: FullscreenSearchParams) => ({
      ...prev,
      mode: 'fullscreen' as const,
    }),
    [],
  );

  // Prüfe ob wir auf der Karten-Route sind (Fullscreen-Unterstützung)
  const isOnKarteRoute = !!matchRoute({ to: '/app/einsatz/$einsatzId/übersicht/karte', fuzzy: false });

  // Prüfe ob wir auf der ETB-Route sind (Fullscreen-Unterstützung - noch nicht implementiert)
  const isOnEtbRoute = !!matchRoute({ to: '/app/einsatz/$einsatzId/führung/etb', fuzzy: true });

  return useMemo(
    () => ({
      id: 'quick-actions',
      name: 'Schnellaktionen',
      color: 'primary',
      icon: PiCaretRight,
      subPages: [
        {
          name: 'Einstellungen',
          icon: PiGear,
          shortcut: ['⌘', ','],
          action: () => {
            toast.info('Einstellungen sind nicht implementiert');
          },
        },
        {
          name: 'In Zwischenablage kopieren',
          icon: PiClipboard,
          action: () => {
            navigator.clipboard
              .writeText(window.location.href)
              .then(() => toast.success('URL kopiert'))
              .catch(() => toast.error('Kopieren fehlgeschlagen'));
          },
        },
        // UX-DR19/UX-DR20: Patienten-Modul als Quick-Action (nur wenn ein Einsatz aktiv ist)
        ...(einsatzId
          ? [
              {
                id: 'open-patienten-modul',
                name: 'Patienten-Modul öffnen',
                description: 'Wechselt zur Patienten-Übersicht des aktiven Einsatzes',
                icon: PiFirstAid,
                keywords: ['patient', 'patienten', 'p'],
                action: () => {
                  navigate({
                    to: '/app/einsatz/$einsatzId/patienten',
                    params: { einsatzId },
                  });
                },
              },
            ]
          : []),
        // Lagekarte Vollbild-Action (nur auf Karten-Route)
        ...(isOnKarteRoute
          ? [
              {
                name: 'Lagekarte Vollbild',
                icon: PiArrowsOut,
                shortcut: ['⌘', 'E'],
                action: () => {
                  navigate({
                    to: '.',
                    search: setFullscreenSearch,
                  });
                },
              },
            ]
          : []),
        // ETB Vollbild-Action (nur auf ETB-Route)
        ...(isOnEtbRoute
          ? [
              {
                name: 'ETB Vollbild',
                icon: PiArrowsOut,
                shortcut: ['⌘', 'E'],
                action: () => {
                  navigate({
                    to: '.',
                    search: setFullscreenSearch,
                  });
                },
              },
            ]
          : []),
        {
          name: 'Theme wechseln',
          icon: PiPalette,
          shortcut: ['⌘', 'T'],
          action: handleThemeChange,
          subCommands: themeOptions,
        },
        {
          name: 'Abmelden',
          icon: PiSignOut,
          destructive: true,
          action: async () => {
            try {
              await logout.mutateAsync().then(() => navigate({ to: '/' }));
            } catch {
              toast.error('Abmeldung fehlgeschlagen');
            }
          },
        },
      ],
    }),
    [logout, navigate, handleThemeChange, themeOptions, isOnKarteRoute, isOnEtbRoute, setFullscreenSearch, einsatzId],
  );
};
