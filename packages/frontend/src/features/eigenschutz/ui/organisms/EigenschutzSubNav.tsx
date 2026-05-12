import { Link } from '@tanstack/react-router';
import type { ComponentType } from 'react';
import { PiClipboardText, PiGauge, PiMapPin, PiShield, PiShieldCheck, PiWarningOctagon } from 'react-icons/pi';
import { cn } from '@/shared/ui/cn';

/**
 * Persistente Sub-Tab-Navigation für das Eigenschutz-Modul (UX-Spec
 * §Navigation Patterns Z. 1007). Hängt in der Layout-Route oberhalb des
 * `<Outlet />`, damit der Nutzer auf jeder Sub- und Detail-Route weiß, in
 * welchem Bereich er ist, und ohne Umweg zum Geschwister-Bereich wechseln
 * kann.
 *
 * **Active-Matching:**
 * - „Übersicht" nutzt `activeOptions={{ exact: true }}`, damit der Tab nur
 *   auf der Index-Route aktiv ist — sonst würde TanStack-Router ihn als
 *   Präfix jeder Sub-Route fälschlich als aktiv markieren.
 * - Alle übrigen Tabs nutzen das `exact: false`-Default, sodass
 *   Detail-Routen (`…/gefaehrdungen/$id`) den Parent-Tab aktiv halten.
 *
 * **Goal G6 — kein „Konflikte"-Tab mehr:** Konflikt-Auflösung läuft jetzt
 * über den `SyncConflictsDrawer` (kontextueller Slide-in). Die Konflikt-
 * Sichtbarkeit für den Sicherheitsbeauftragten erfolgt über den
 * `EigenschutzSyncStatusPopover`, den `KonfliktErkanntMikroBanner` und das
 * Summary-Banner in der Layout-Route — keine dedizierte Sub-Tab nötig.
 */
interface SubNavItem {
  readonly id: string;
  readonly label: string;
  readonly to: string;
  readonly Icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  readonly exact?: boolean;
}

const ITEMS: readonly SubNavItem[] = [
  { id: 'uebersicht', label: 'Übersicht', to: '/app/einsatz/$einsatzId/sicherheit/eigenschutz', Icon: PiGauge, exact: true },
  { id: 'gefaehrdungen', label: 'Gefährdungen', to: '/app/einsatz/$einsatzId/sicherheit/eigenschutz/gefaehrdungen', Icon: PiClipboardText },
  { id: 'sicherheitsregeln', label: 'Sicherheitsregeln', to: '/app/einsatz/$einsatzId/sicherheit/eigenschutz/sicherheitsregeln', Icon: PiShieldCheck },
  { id: 'psa-profile', label: 'PSA-Profile', to: '/app/einsatz/$einsatzId/sicherheit/eigenschutz/psa-profile', Icon: PiShield },
  { id: 'sicherungsposten', label: 'Sicherungsposten', to: '/app/einsatz/$einsatzId/sicherheit/eigenschutz/sicherungsposten', Icon: PiMapPin },
  { id: 'vorfaelle', label: 'Vorfälle', to: '/app/einsatz/$einsatzId/sicherheit/eigenschutz/vorfaelle', Icon: PiWarningOctagon },
] as const;

export interface EigenschutzSubNavProps {
  readonly einsatzId: string;
}

const LINK_BASE =
  'inline-flex min-h-11 items-center gap-2 whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:text-text-primary focus:outline-none focus-visible:shadow-focus-ring';
const LINK_ACTIVE = 'border-action-primary text-text-primary';

export function EigenschutzSubNav({ einsatzId }: EigenschutzSubNavProps) {
  return (
    <nav aria-label="Eigenschutz-Bereiche" data-testid="eigenschutz-subnav" className="-mx-1 overflow-x-auto border-b border-border-subtle">
      <ul className="flex min-w-max items-stretch gap-1 px-1">
        {ITEMS.map((item) => (
          <li key={item.id} className="flex">
            <Link
              to={item.to}
              params={{ einsatzId }}
              activeProps={{ className: cn(LINK_BASE, LINK_ACTIVE), 'aria-current': 'page', 'data-active': 'true' }}
              inactiveProps={{ className: LINK_BASE }}
              activeOptions={item.exact ? { exact: true } : undefined}
              data-testid={`eigenschutz-subnav-link-${item.id}`}
            >
              <item.Icon aria-hidden="true" className="h-4 w-4 flex-shrink-0" />
              <span>{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
