import { useAuth } from '@/hooks/useAuth';
import { useMatchRoute, useNavigate } from '@tanstack/react-router';
import { useCallback, useMemo } from 'react';
import { PiArrowsOut, PiCaretRight, PiClipboard, PiGear, PiPalette, PiSignOut } from 'react-icons/pi';
import { toast } from 'sonner';
import type { LagekarteSearchParams } from '@organisms/lagekarte/LagekarteView/LagekarteView';
import type { EtbSearchParams } from '@routes/app/einsatz/$einsatzId/führung/etb/';
import type { ModuleConfig } from '../types';
import { useThemeCommands } from './useThemeCommands';

export const useQuickActionsModule = (): ModuleConfig => {
  const navigate = useNavigate();
  const matchRoute = useMatchRoute();
  const { logout } = useAuth();
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
    [logout, navigate, handleThemeChange, themeOptions, isOnKarteRoute, isOnEtbRoute, setFullscreenSearch],
  );
};
