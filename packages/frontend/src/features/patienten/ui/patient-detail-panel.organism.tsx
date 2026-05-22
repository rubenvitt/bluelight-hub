import type { PatientDetailDto } from '@bluelight-hub/shared/client';
import { CopyButton } from '@/shared/ui/molecules/copy-button.molecule';
import { cn } from '@/shared/ui/cn';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { usePatientDetail } from '../api/use-patient-detail';
import { PatientEreignisListe } from './patient-ereignis-liste.organism';
import { PatientNotizFeld } from './patient-notiz-feld.molecule';
import { SkBadge } from './sk-badge';
import { SkUpgradePillGroup } from './sk-upgrade-pill-group';

export interface PatientDetailPanelProps {
  einsatzId: string;
  patientId: string;
  variant: 'split-view' | 'drawer';
  onClose?: () => void;
  className?: string;
}

/**
 * Story 1.7 (AC7): Detail-Panel-Komposition.
 *
 * Komponiert: Patient-Header (Patientennummer + Pseudonym/SK-Badge +
 * Metadaten + CopyButton), `SkUpgradePillGroup` (Reevaluierung aus
 * Story 1.3), `PatientEreignisListe` (Story 1.7-Timeline), `PatientNotizFeld`
 * (AC9 mit Auto-Save). Loading-/Error-States analog `KpiStrip` aus
 * Story 1.5 (Skeleton + klartext-Error ohne Sentinel).
 *
 * **A11y:** `<section>` mit `<h2>`-Header, Touch-Targets ≥ 44 px,
 * `aria-busy` während Loading. axe-clean.
 *
 * **Layout-Variants:**
 *  - `split-view` (≥ 1024 px) — komplette innere Padding-Adaption für
 *    eine D4-Spalte.
 *  - `drawer` (< 1024 px) — kompakteres Padding, Close-Button wird
 *    extern (Dialog.SlideIn) bereitgestellt.
 */
export function PatientDetailPanel({ einsatzId, patientId, variant, className }: PatientDetailPanelProps) {
  const detail = usePatientDetail(einsatzId, patientId);
  const padding = variant === 'split-view' ? 'p-6' : 'p-4';

  if (detail.isPending) {
    return (
      <section className={cn('flex h-full flex-col gap-4', padding, className)} aria-busy="true" data-testid="patient-detail-loading">
        <div className="bg-surface-skeleton h-6 w-32 animate-pulse rounded motion-reduce:animate-none" />
        <div className="bg-surface-skeleton h-4 w-48 animate-pulse rounded motion-reduce:animate-none" />
        <div className="bg-surface-skeleton h-64 w-full animate-pulse rounded motion-reduce:animate-none" />
      </section>
    );
  }

  if (detail.isError || !detail.data) {
    return (
      <section className={cn('flex flex-col gap-2 rounded-md border border-border-strong', padding, className)} role="alert" data-testid="patient-detail-error">
        <h2 className="text-lg font-semibold text-text-primary">Patient-Detail konnte nicht geladen werden</h2>
        <p className="text-sm text-text-muted">Bitte erneut versuchen. Falls der Fehler bleibt, prüfe die Verbindung oder lade die Seite neu.</p>
        <button
          type="button"
          onClick={() => void detail.refetch()}
          className="bg-surface-action hover:bg-surface-action-hover focus:outline-border-focus text-text-on-action mt-1 self-start rounded-md px-3 py-1.5 text-sm font-medium focus:outline-2 focus:outline-offset-2"
          data-testid="patient-detail-retry"
        >
          Erneut versuchen
        </button>
      </section>
    );
  }

  const data: PatientDetailDto = detail.data;
  // Story 1.7 Code-Review-Patch: Relativer Link wäre für einen geteilten
  // Deep-Link unbrauchbar. In Tauri/SSR-Kontexten fällt `window` weg —
  // dann fallen wir auf den path-only Link zurück, kennzeichnen ihn aber
  // explizit, damit der Empfänger weiß, dass er die Origin selber kennt
  // (interne Übergabe innerhalb der App).
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const deepLinkUrl = origin ? `${origin}/app/einsatz/${einsatzId}/patienten/${patientId}` : `/app/einsatz/${einsatzId}/patienten/${patientId}`;
  const erfasstRelative = formatDistanceToNow(new Date(data.erfasstAm), { locale: de, addSuffix: true });
  // Sticky-Header Padding-Korrektur — die negativen Margins ziehen den
  // Header an den jeweiligen Container-Rand (variant-aware), sonst gibt es
  // entweder einen Rand-Spalt (drawer/p-4) oder Header-Überlappung
  // (split-view/p-6).
  const headerOffsets = variant === 'split-view' ? '-mt-6 -mr-6 -ml-6 px-6' : '-mt-4 -mr-4 -ml-4 px-4';

  return (
    <section className={cn('flex h-full flex-col gap-4', padding, className)} data-testid="patient-detail-panel" aria-label={`Patient ${data.patientennummer}`}>
      <header className={cn('sticky top-0 z-10 bg-surface-panel/95 pt-3 pb-3 backdrop-blur', headerOffsets)}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h2 className="font-mono text-xl font-semibold text-text-primary">{data.patientennummer}</h2>
              <SkBadge sk={data.aktuelleSk} size="md" />
            </div>
            <p className="text-xs text-text-muted">{`Erfasst ${erfasstRelative} (${new Date(data.erfasstAm).toLocaleString('de-DE')})`}</p>
            {data.diviVakNummer && <p className="text-xs text-text-muted">DIVI-VAK: {data.diviVakNummer}</p>}
          </div>
          <CopyButton text={deepLinkUrl} idleLabel="Link kopieren" copiedLabel="Link kopiert" size="sm" statusTestId="patient-detail-copy-status" />
        </div>
      </header>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-text-secondary">Sichtungs-Reevaluierung</h3>
        <SkUpgradePillGroup einsatzId={einsatzId} patientId={patientId} currentSk={data.aktuelleSk} patientennummer={data.patientennummer} />
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-text-secondary">Ereignis-Historie</h3>
        <PatientEreignisListe events={data.events} />
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-text-secondary">Notiz</h3>
        <PatientNotizFeld einsatzId={einsatzId} patientId={patientId} initialValue={data.notiz ?? null} />
      </div>
    </section>
  );
}
