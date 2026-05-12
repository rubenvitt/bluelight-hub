import { useNavigate } from '@tanstack/react-router';
import { useMemo } from 'react';
import { PiArchive, PiClipboardText, PiListChecks, PiShieldCheck, PiShieldWarning, PiSiren, PiUserSwitch, PiWarningCircle } from 'react-icons/pi';
import type { ModuleConfig } from '@/shared/ui/organisms/command-palette';
import { useAktiveEinsatzEinheit } from './use-aktive-einsatz-einheit';

interface UseEigenschutzCommandModuleProps {
  readonly einsatzId: string;
  readonly hidden?: boolean;
  readonly disabledReason?: string;
  readonly syncConflictsDisabledReason?: string;
}

const ROUTES = {
  dashboard: '/app/einsatz/$einsatzId/sicherheit/eigenschutz',
  gefaehrdungen: '/app/einsatz/$einsatzId/sicherheit/eigenschutz/gefaehrdungen/',
  vorfaelle: '/app/einsatz/$einsatzId/sicherheit/eigenschutz/vorfaelle',
  psaProfile: '/app/einsatz/$einsatzId/sicherheit/eigenschutz/psa-profile',
  sicherheitsregeln: '/app/einsatz/$einsatzId/sicherheit/eigenschutz/sicherheitsregeln',
  sicherungsposten: '/app/einsatz/$einsatzId/sicherheit/eigenschutz/sicherungsposten',
} as const;

type RouteTarget = (typeof ROUTES)[keyof typeof ROUTES];

function removeUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

/**
 * Liefert die Eigenschutz-Aktionsgruppe für die Shell-eigene Command Palette.
 *
 * Die Aktionen navigieren ausschließlich in bestehende Routen und setzen bei
 * Drawer-Flows einen kleinen `action`-Search-Param. Die Pages konsumieren
 * diesen Param und entfernen ihn nach Close/Save wieder per `replace`.
 */
export function useEigenschutzCommandModule({ einsatzId, hidden = false, disabledReason, syncConflictsDisabledReason }: UseEigenschutzCommandModuleProps): ModuleConfig {
  const navigate = useNavigate();
  const aktiveEinheit = useAktiveEinsatzEinheit(einsatzId);
  const psaDisabledReason = disabledReason ?? (aktiveEinheit.einheitId === null ? 'Keine aktive Einheit ausgewählt.' : undefined);
  const conflictDisabledReason = disabledReason ?? syncConflictsDisabledReason;

  return useMemo<ModuleConfig>(() => {
    const navigateTo = (to: RouteTarget, search?: Record<string, unknown>) => {
      void (navigate as unknown as (opts: { to: RouteTarget; params: { einsatzId: string }; search?: Record<string, unknown> | ((prev: Record<string, unknown>) => Record<string, unknown>) }) => void)(
        {
          to,
          params: { einsatzId },
          search: search ? (prev) => removeUndefined({ ...prev, ...search }) : undefined,
        },
      );
    };

    return {
      id: 'eigenschutz-aktionen',
      name: 'Eigenschutz',
      color: 'red',
      icon: PiShieldWarning,
      subPages: hidden
        ? []
        : [
            {
              id: 'new-gefaehrdung',
              name: 'Eigenschutz: Neue Gefährdungsbeurteilung',
              description: 'Beurteilung für eine Einheit anlegen',
              icon: PiClipboardText,
              disabled: Boolean(disabledReason),
              disabledReason,
              keywords: ['Gefaehrdung', 'Gefährdung', 'Gefaehrdungsbeurteilung', 'Gefährdungsbeurteilung', 'Risiko', 'Schutzmaßnahmen', 'Schutzmassnahmen'],
              action: () => navigateTo(ROUTES.gefaehrdungen, { action: 'new-gefaehrdung' }),
            },
            {
              id: 'new-vorfall',
              name: 'Eigenschutz: Neuer Vorfall',
              description: 'Vorfallmeldung erfassen',
              icon: PiSiren,
              disabled: Boolean(disabledReason),
              disabledReason,
              keywords: ['Vorfall', 'Meldung', 'Unfallkasse'],
              action: () => navigateTo(ROUTES.vorfaelle, { action: 'new-vorfall' }),
            },
            {
              id: 'psa-change',
              name: 'Eigenschutz: PSA-Profil ändern',
              description: aktiveEinheit.einheitName ? `PSA für ${aktiveEinheit.einheitName} ändern` : 'PSA-Profil der aktiven Einheit ändern',
              icon: PiUserSwitch,
              disabled: Boolean(psaDisabledReason),
              disabledReason: psaDisabledReason,
              keywords: ['PSA', 'Schutzkleidung', 'Profil', 'CBRN'],
              action: () => navigateTo(ROUTES.psaProfile, { action: 'psa-change', einheitId: aktiveEinheit.einheitId ?? undefined }),
            },
            {
              id: 'new-sicherheitsregel',
              name: 'Eigenschutz: Sicherheitsregel erstellen',
              description: 'Regel dokumentieren und bekannt geben',
              icon: PiShieldCheck,
              disabled: Boolean(disabledReason),
              disabledReason,
              keywords: ['Sicherheitsregel', 'Regel', 'Bekanntgabe'],
              action: () => navigateTo(ROUTES.sicherheitsregeln, { action: 'new-sicherheitsregel' }),
            },
            {
              id: 'new-sicherungsposten',
              name: 'Eigenschutz: Sicherungsposten anlegen',
              description: 'Sicherungsposten mit Versionierung erfassen',
              icon: PiWarningCircle,
              disabled: Boolean(disabledReason),
              disabledReason,
              keywords: ['Sicherungsposten', 'Posten', 'Absicherung'],
              action: () => navigateTo(ROUTES.sicherungsposten, { action: 'new-sicherungsposten' }),
            },
            {
              id: 'dashboard',
              name: 'Eigenschutz: Dashboard öffnen',
              description: 'Ampel- und Statusübersicht öffnen',
              icon: PiShieldWarning,
              disabled: Boolean(disabledReason),
              disabledReason,
              keywords: ['Dashboard', 'Ampel', 'Status', 'Übersicht', 'Uebersicht'],
              action: () => navigateTo(ROUTES.dashboard),
            },
            {
              id: 'sync-konflikte',
              name: 'Eigenschutz: Konflikte auflösen',
              description: 'Offene Sync-Konflikte bearbeiten',
              icon: PiListChecks,
              disabled: Boolean(conflictDisabledReason),
              disabledReason: conflictDisabledReason,
              keywords: ['Konflikte', 'Konflikt', 'Sync', 'Aufloesen', 'Auflösen'],
              // Goal G6: Konflikt-Auflösung läuft über den `SyncConflictsDrawer`
              // an der Layout-Route. `openConflicts=1` triggert den Drawer-Open
              // im Layout-`useEffect`.
              action: () => navigateTo(ROUTES.dashboard, { openConflicts: 1 }),
            },
            {
              id: 'vorfall-archiv',
              name: 'Eigenschutz: Vorfall-Archiv öffnen',
              description: 'Vorfälle suchen und filtern',
              icon: PiArchive,
              disabled: Boolean(disabledReason),
              disabledReason,
              keywords: ['Vorfall', 'Vorfälle', 'Vorfaelle', 'Archiv', 'Unfallkasse'],
              action: () => navigateTo(ROUTES.vorfaelle),
            },
          ],
    };
  }, [aktiveEinheit.einheitId, aktiveEinheit.einheitName, conflictDisabledReason, disabledReason, einsatzId, hidden, navigate, psaDisabledReason]);
}
