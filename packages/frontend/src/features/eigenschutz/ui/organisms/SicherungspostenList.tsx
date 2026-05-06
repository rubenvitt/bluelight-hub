/**
 * SicherungspostenList — Tabellen-Organism mit AKTIV/AUFGELOEST-Tabs
 * (Story 4.1, T6).
 *
 * Reine Präsentation + Action-Callbacks; State-Management (Drawer-Open,
 * Auflöse-Dialog) liegt in der Page. Datenladen via
 * `useListSicherungsposten` pro Tab — beide Status-Listen werden lazy
 * gefetcht, sobald der Tab aktiv ist (Status-Filter ist Pflicht-Param,
 * kein Combined-Endpoint vorgesehen).
 */

import { useState } from 'react';
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react';
import type { SicherungspostenDto } from '@bluelight-hub/shared/client';
import { Button } from '@/shared/ui/atoms/button.atom';
import { useListSicherungsposten } from '../../api/use-sicherungsposten';
import type { SicherungspostenStatus } from '../../schemas/sicherungsposten.schema';

export interface SicherungspostenListProps {
  readonly einsatzId: string;
  readonly onEdit: (posten: SicherungspostenDto) => void;
  readonly onAufloesen: (posten: SicherungspostenDto) => void;
  readonly onCreate: () => void;
}

const TAB_ORDER: ReadonlyArray<{ key: SicherungspostenStatus; label: string; testid: string }> = [
  { key: 'AKTIV', label: 'Aktiv', testid: 'sicherungsposten-tab-aktiv' },
  { key: 'AUFGELOEST', label: 'Aufgelöst', testid: 'sicherungsposten-tab-aufgeloest' },
];

/**
 * Liefert eine kompakte, einzeilige Standort-Repräsentation.
 *
 * Generierter Standort-DTO ist eine discriminated Union (`coordinate`/
 * `address`) — wir lesen die Diskriminante und mappen auf einen lesbaren
 * Text. `addressHint` (Coordinate) bleibt für eine spätere Story 4.3
 * erhalten und wird hier nicht ausgegeben, weil die Tabellenzelle nur
 * eine Kurzform zeigt.
 */
function formatStandort(standort: SicherungspostenDto['standort']): string {
  if (!standort || typeof standort !== 'object') return '—';
  const kind = (standort as { kind?: unknown }).kind;
  if (kind === 'coordinate') {
    const lon = (standort as { longitude?: number }).longitude;
    const lat = (standort as { latitude?: number }).latitude;
    if (typeof lon === 'number' && typeof lat === 'number') {
      return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    }
  }
  if (kind === 'address') {
    const text = (standort as { text?: string }).text;
    if (typeof text === 'string' && text.length > 0) return text;
  }
  return '—';
}

interface TableProps {
  readonly status: SicherungspostenStatus;
  readonly einsatzId: string;
  readonly onEdit: (posten: SicherungspostenDto) => void;
  readonly onAufloesen: (posten: SicherungspostenDto) => void;
}

function SicherungspostenTable({ status, einsatzId, onEdit, onAufloesen }: TableProps) {
  const query = useListSicherungsposten(einsatzId, status);

  if (query.isPending) {
    return (
      <p className="text-sm text-text-muted" data-testid="sicherungsposten-loading">
        Lade Sicherungsposten…
      </p>
    );
  }

  if (query.isError) {
    return (
      <p className="rounded-control border border-status-danger-border bg-status-danger-surface px-3 py-2 text-sm text-status-danger-text" role="alert" data-testid="sicherungsposten-error">
        Sicherungsposten konnten nicht geladen werden. Bitte erneut versuchen.
      </p>
    );
  }

  const rows = query.data ?? [];
  if (rows.length === 0) {
    return (
      <p className="rounded-control border border-border-subtle bg-surface-panel-elevated px-3 py-4 text-sm text-text-muted" data-testid="sicherungsposten-empty">
        {status === 'AKTIV' ? 'Keine aktiven Sicherungsposten — über „+ Sicherungsposten" anlegen.' : 'Bisher wurden keine Posten aufgelöst.'}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-panel border border-border-subtle">
      <table className="min-w-full divide-y divide-border-subtle text-sm" data-testid="sicherungsposten-table">
        <thead className="bg-surface-panel-elevated text-left text-xs font-semibold text-text-muted uppercase">
          <tr>
            <th scope="col" className="px-3 py-2">
              Bezeichnung
            </th>
            <th scope="col" className="px-3 py-2">
              Standort
            </th>
            <th scope="col" className="px-3 py-2">
              Personal
            </th>
            <th scope="col" className="px-3 py-2 text-right">
              Aktionen
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle bg-surface-panel">
          {rows.map((posten) => {
            const standortKind = posten.standort && typeof posten.standort === 'object' ? (posten.standort as { kind?: unknown }).kind : undefined;
            const showAddressHint = status === 'AKTIV' && standortKind === 'address';
            return (
              <tr key={posten.id} data-testid={`sicherungsposten-row-${posten.id}`} className="text-text-primary">
                <td className="px-3 py-2 font-medium">{posten.bezeichnung}</td>
                <td className="px-3 py-2 text-text-secondary">
                  {formatStandort(posten.standort)}
                  {showAddressHint ? (
                    <span data-testid={`sicherungsposten-no-coordinate-hint-${posten.id}`} className="block text-xs text-text-muted italic">
                      Kein Standort — auf Karte nicht sichtbar
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-text-secondary">{Array.isArray(posten.personal) ? posten.personal.length : 0}</td>
                <td className="px-3 py-2 text-right">
                  {status === 'AKTIV' ? (
                    <div className="flex justify-end gap-2">
                      <Button intent="secondary" appearance="ghost" size="sm" onClick={() => onEdit(posten)} data-testid={`sicherungsposten-edit-${posten.id}`}>
                        Bearbeiten
                      </Button>
                      <Button intent="secondary" appearance="ghost" size="sm" onClick={() => onAufloesen(posten)} data-testid={`sicherungsposten-aufloesen-${posten.id}`}>
                        Auflösen
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-text-muted">aufgelöst</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function SicherungspostenList({ einsatzId, onEdit, onAufloesen, onCreate }: SicherungspostenListProps) {
  const [tabIndex, setTabIndex] = useState<number>(0);
  const activeStatus = TAB_ORDER[tabIndex]?.key ?? 'AKTIV';

  return (
    <section data-testid="sicherungsposten-list" className="flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary">Sicherungsposten</h2>
        {activeStatus === 'AKTIV' ? (
          <Button intent="primary" size="sm" onClick={onCreate} data-testid="sicherungsposten-create-button">
            + Sicherungsposten
          </Button>
        ) : null}
      </header>

      <TabGroup selectedIndex={tabIndex} onChange={setTabIndex}>
        <TabList className="flex border-b border-border-subtle">
          {TAB_ORDER.map(({ key, label, testid }) => (
            <Tab
              key={key}
              data-testid={testid}
              className={({ selected }) =>
                [
                  'px-4 py-2 text-sm font-medium transition-colors motion-reduce:transition-none focus-visible:shadow-focus-ring focus-visible:outline-none',
                  selected ? 'border-b-2 border-action-primary text-action-primary' : 'text-text-muted hover:text-text-secondary',
                ].join(' ')
              }
            >
              {label}
            </Tab>
          ))}
        </TabList>
        <TabPanels className="mt-3">
          {TAB_ORDER.map(({ key }) => (
            <TabPanel key={key}>
              <SicherungspostenTable status={key} einsatzId={einsatzId} onEdit={onEdit} onAufloesen={onAufloesen} />
            </TabPanel>
          ))}
        </TabPanels>
      </TabGroup>
    </section>
  );
}
