/**
 * `KorrekturDrawer` — Patient-Korrektur (Story 1.4, FR42, AC5).
 *
 * Headless-UI-`Dialog` als Slide-In auf der rechten Seite. Drei Tabs für
 * die korrigierbaren Felder (`sichtung`/`behandlungsstatus`/`transportstatus`),
 * Pflicht-`grund`-Textarea + Pflicht-Confirm-Step.
 *
 * **Bewusst KEIN Optimistic-Update:** Server-Wahrheit abwarten (Severity zu hoch).
 */
import type { BehandlungsstatusEnum, SkEnum, TransportstatusEnum } from '@bluelight-hub/shared/client';
import { Dialog, DialogPanel, DialogTitle, Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react';
import { clsx } from 'clsx';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useKorrigierePatient } from '../api/use-korrigiere-patient';
import { extractErrorCode, extractErrorMessage } from '../api/extract-error-code';
import { BEHANDLUNG_DISPLAY_ORDER } from '../constants/behandlungs-status-transitions';
import { BEHANDLUNG_LABELS } from '../constants/behandlungs-status-labels';
import { SK_DISPLAY_ORDER, SK_LABELS } from '../constants';
import { TRANSPORT_DISPLAY_ORDER } from '../constants/transport-status-transitions';
import { TRANSPORT_LABELS } from '../constants/transport-status-labels';
import type { KorrekturFeld } from '../schemas/korrigiere-patient.schema';

interface KorrekturDrawerProps {
  open: boolean;
  onClose: () => void;
  einsatzId: string;
  patientId: string;
  patientennummer: string;
  current: {
    sichtung: SkEnum;
    behandlungsstatus: BehandlungsstatusEnum;
    transportstatus: TransportstatusEnum;
  };
}

const TABS: { feld: KorrekturFeld; label: string }[] = [
  { feld: 'sichtung', label: 'Sichtung' },
  { feld: 'behandlungsstatus', label: 'Behandlung' },
  { feld: 'transportstatus', label: 'Transport' },
];

export function KorrekturDrawer({ open, onClose, einsatzId, patientId, patientennummer, current }: KorrekturDrawerProps) {
  const [activeFeld, setActiveFeld] = useState<KorrekturFeld>('sichtung');
  const [neuerWert, setNeuerWert] = useState<string>('');
  const [grund, setGrund] = useState<string>('');
  const [confirming, setConfirming] = useState(false);
  const [confirmingAt, setConfirmingAt] = useState<number | null>(null);
  const [externChangedWarning, setExternChangedWarning] = useState(false);
  /**
   * Story 1.4 Code-Review Feature 2: zusätzlicher Confirm-Gate für die
   * irreversible TOT-Markierung via Korrektur-Pfad. Greift nur, wenn
   * `feld='sichtung' && neuerWert='TOT' && current.sichtung !== 'TOT'`.
   */
  const [bestaetigeTotKorrektur, setBestaetigeTotKorrektur] = useState(false);
  const mutation = useKorrigierePatient({ einsatzId, patientId });

  /**
   * Open-time-Snapshot des `currentValue` pro Feld. Wird beim Öffnen des Drawers
   * bzw. beim Tab-Wechsel gesetzt und beim Submit gegen den frischen Prop-Wert
   * verglichen, um konkurrierende Änderungen (z. B. WebSocket-Push oder
   * paralleler OrgL-Tab) zu erkennen.
   */
  const originalCurrentRef = useRef<{ feld: KorrekturFeld; value: string } | null>(null);

  const errorMessage = useMemo(() => extractError(mutation.error), [mutation.error]);

  const currentValue = useMemo(() => {
    if (activeFeld === 'sichtung') return current.sichtung;
    if (activeFeld === 'behandlungsstatus') return current.behandlungsstatus;
    return current.transportstatus;
  }, [activeFeld, current]);

  // Open-time-Snapshot setzen, sobald der Drawer offen ist oder das Feld wechselt.
  useEffect(() => {
    if (!open) {
      originalCurrentRef.current = null;
      return;
    }
    if (originalCurrentRef.current?.feld !== activeFeld) {
      originalCurrentRef.current = { feld: activeFeld, value: currentValue };
      setExternChangedWarning(false);
    }
  }, [open, activeFeld, currentValue]);

  const options = useMemo(() => {
    if (activeFeld === 'sichtung') return SK_DISPLAY_ORDER.map((v) => ({ value: v, label: SK_LABELS[v].shortLabel }));
    if (activeFeld === 'behandlungsstatus') return BEHANDLUNG_DISPLAY_ORDER.map((v) => ({ value: v, label: BEHANDLUNG_LABELS[v].shortLabel }));
    return TRANSPORT_DISPLAY_ORDER.map((v) => ({ value: v, label: TRANSPORT_LABELS[v].shortLabel }));
  }, [activeFeld]);

  const handleClose = useCallback(() => {
    setActiveFeld('sichtung');
    setNeuerWert('');
    setGrund('');
    setConfirming(false);
    setConfirmingAt(null);
    setExternChangedWarning(false);
    setBestaetigeTotKorrektur(false);
    originalCurrentRef.current = null;
    mutation.reset();
    onClose();
  }, [mutation, onClose]);

  const handleTabChange = useCallback(
    (index: number) => {
      setActiveFeld(TABS[index].feld);
      setNeuerWert('');
      // Grund pro Tab leeren — eine für Tab A getippte Begründung darf nicht
      // versehentlich in den Submit von Tab B übernommen werden.
      setGrund('');
      setConfirming(false);
      setConfirmingAt(null);
      setExternChangedWarning(false);
      // Story 1.4 Code-Review Feature 2: TOT-Confirm beim Tab-Wechsel zurücksetzen.
      setBestaetigeTotKorrektur(false);
      mutation.reset();
    },
    [mutation],
  );

  /**
   * Story 1.4 Code-Review Feature 2: TOT-Korrektur auf lebendem Patienten
   * verlangt zusätzlichen Confirm-Gate. Greift nur auf dem Sichtung-Tab,
   * wenn `neuerWert='TOT'` und der aktuelle Patient nicht bereits TOT ist.
   */
  const requiresTotConfirm = activeFeld === 'sichtung' && neuerWert === 'TOT' && current.sichtung !== 'TOT';

  const canSubmit = neuerWert.trim().length > 0 && grund.trim().length > 0 && neuerWert !== currentValue && !mutation.isPending && (!requiresTotConfirm || bestaetigeTotKorrektur);

  const submit = useCallback(async () => {
    if (!canSubmit) return;

    // P3 — Revalidate Open-Time-Snapshot gegen aktuelle Prop-Werte. Hat sich der
    // Wert extern geändert (z. B. WebSocket-Push, paralleler OrgL-Tab), wird der
    // Confirm-Step zurückgesetzt und eine Warnung gerendert.
    const snapshot = originalCurrentRef.current;
    if (snapshot && snapshot.feld === activeFeld && snapshot.value !== currentValue) {
      setConfirming(false);
      setConfirmingAt(null);
      setExternChangedWarning(true);
      // Snapshot auf neuen Wert mitziehen, damit der nächste Klick wieder den
      // regulären Confirm-Step durchläuft.
      originalCurrentRef.current = { feld: activeFeld, value: currentValue };
      return;
    }

    if (!confirming) {
      setConfirming(true);
      setConfirmingAt(Date.now());
      return;
    }
    // P2 — Double-Click-Guard: Zwei schnelle Klicks dürfen den visuellen
    // Confirm-Step nicht überspringen.
    if (confirmingAt !== null && Date.now() - confirmingAt < 250) {
      return;
    }
    try {
      await mutation.mutateAsync({
        feld: activeFeld,
        neuerWert,
        grund: grund.trim(),
        // Story 1.4 Code-Review Feature 2: nur senden, wenn TOT-Confirm-Gate
        // tatsächlich gefordert UND aktiviert wurde.
        ...(requiresTotConfirm && bestaetigeTotKorrektur ? { bestaetigeTotKorrektur: true } : {}),
      });
      handleClose();
    } catch {
      // Fehler wird in der UI via errorMessage gerendert; Drawer bleibt offen.
      setConfirming(false);
      setConfirmingAt(null);
    }
  }, [activeFeld, bestaetigeTotKorrektur, canSubmit, confirming, confirmingAt, currentValue, grund, handleClose, mutation, neuerWert, requiresTotConfirm]);

  return (
    <Dialog open={open} onClose={handleClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
      <div className="fixed inset-y-0 right-0 flex w-full max-w-md">
        <DialogPanel className="flex w-full flex-col gap-4 overflow-y-auto bg-white p-6 shadow-xl" data-testid="korrektur-drawer">
          <DialogTitle className="text-lg font-semibold text-gray-900">
            Patient korrigieren — <span className="font-mono">{patientennummer}</span>
          </DialogTitle>
          <p className="text-sm text-gray-600">Append-only Korrektur des Patient-Snapshots. Originaleintrag bleibt unverändert; jede Korrektur erzeugt einen neuen Audit-Eintrag.</p>

          <TabGroup selectedIndex={TABS.findIndex((t) => t.feld === activeFeld)} onChange={handleTabChange}>
            <TabList className="flex gap-2 border-b border-gray-200">
              {TABS.map((tab) => (
                <Tab
                  key={tab.feld}
                  data-testid={`korrektur-tab-${tab.feld}`}
                  className={({ selected }) =>
                    clsx(
                      'px-3 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                      selected ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-600 hover:text-gray-900',
                    )
                  }
                >
                  {tab.label}
                </Tab>
              ))}
            </TabList>
            <TabPanels className="mt-4">
              {TABS.map((tab) => (
                <TabPanel key={tab.feld} className="flex flex-col gap-3">
                  <p className="text-sm text-gray-700">
                    Aktueller Wert: <strong data-testid={`korrektur-current-${tab.feld}`}>{currentValue}</strong>
                  </p>
                  <label className="flex flex-col gap-1 text-sm text-gray-700">
                    <span>Neuer Wert</span>
                    <select
                      data-testid="korrektur-neuer-wert"
                      value={neuerWert}
                      onChange={(event) => {
                        setNeuerWert(event.target.value);
                        setConfirming(false);
                        setConfirmingAt(null);
                        setExternChangedWarning(false);
                        // Story 1.4 Code-Review Feature 2: TOT-Confirm beim
                        // Wertwechsel zurücksetzen — der Confirm gilt nur für
                        // genau eine Submission.
                        setBestaetigeTotKorrektur(false);
                      }}
                      className="rounded border border-gray-300 px-2 py-1 focus:border-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      <option value="">— bitte wählen —</option>
                      {options.map((option) => (
                        <option key={option.value} value={option.value} disabled={option.value === currentValue}>
                          {option.label}
                          {option.value === currentValue ? ' (aktuell)' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label htmlFor={`korrektur-grund-${tab.feld}`} className="flex flex-col gap-1 text-sm text-gray-700">
                    <span>
                      Grund <span className="text-red-700">(Pflicht)</span>
                    </span>
                    <textarea
                      id={`korrektur-grund-${tab.feld}`}
                      data-testid="korrektur-grund"
                      value={grund}
                      maxLength={500}
                      rows={3}
                      onChange={(event) => {
                        setGrund(event.target.value);
                        setConfirming(false);
                        setConfirmingAt(null);
                      }}
                      className="rounded border border-gray-300 px-2 py-1 focus:border-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    />
                  </label>
                </TabPanel>
              ))}
            </TabPanels>
          </TabGroup>

          {externChangedWarning ? (
            <div role="alert" data-testid="korrektur-extern-changed" className="rounded-md border-2 border-amber-500 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
              Status wurde extern geändert — bitte erneut prüfen.
            </div>
          ) : null}

          {requiresTotConfirm ? (
            <div role="alert" data-testid="korrektur-tot-confirm" className="rounded-md border-2 border-red-600 bg-red-50 px-3 py-2 text-sm font-medium text-red-900">
              <p className="font-semibold">Diese Korrektur stuft den Patienten auf TOT.</p>
              <p className="mt-1 font-normal">
                TOT-Markierung ist ein regulatorisches Statement gemäß DIN 13050 und kann nicht über den regulären Sichtungs-Pfad zurückgenommen werden. Bitte explizit bestätigen.
              </p>
              <label className="mt-2 flex items-start gap-2 text-sm font-normal text-red-900">
                <input
                  type="checkbox"
                  data-testid="korrektur-tot-confirm-checkbox"
                  checked={bestaetigeTotKorrektur}
                  onChange={(event) => {
                    setBestaetigeTotKorrektur(event.target.checked);
                    setConfirming(false);
                    setConfirmingAt(null);
                  }}
                  className="mt-0.5 h-4 w-4 rounded border-red-500 text-red-600 focus:ring-red-500"
                />
                <span>Ich bestätige die TOT-Markierung dieses Patienten.</span>
              </label>
            </div>
          ) : null}

          {confirming ? (
            <div role="alert" className="rounded-md border-2 border-amber-500 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
              Diese Korrektur ist nicht rückgängig — bitte erneut bestätigen.
            </div>
          ) : null}

          {errorMessage ? (
            <p role="alert" aria-live="assertive" data-testid="korrektur-error" className="rounded-md border-2 border-red-500 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
              {errorMessage}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              data-testid="korrektur-submit"
              className="min-h-12 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50"
            >
              {mutation.isPending ? 'Wird übernommen…' : confirming ? 'Korrektur bestätigen' : 'Korrektur prüfen'}
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={mutation.isPending}
              data-testid="korrektur-cancel"
              className="min-h-12 rounded-md border-2 border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50"
            >
              Abbrechen
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

/**
 * Story 1.4 Code-Review Feature 1: Match auf den stabilen `code`-Stem
 * (gesetzt durch `enrichResponseErrorWithCode` im Mutation-Hook).
 */
function extractError(error: unknown): string | null {
  if (!error) return null;
  const code = extractErrorCode(error);
  if (code === 'BusinessRule:KorrekturUnveraendert') return 'Korrektur ohne Wertänderung — bitte gewünschten Wert angeben.';
  if (code === 'BusinessRule:KorrekturFeldInvalid') return 'Ungültiges Korrektur-Feld.';
  if (code === 'BusinessRule:KorrekturNeuerWertInvalid') return 'Ungültiger Wert für das Korrektur-Feld.';
  if (code === 'BusinessRule:KorrekturGrundRequired') return 'Korrektur erfordert einen Grund (max. 500 Zeichen).';
  if (code === 'BusinessRule:KorrekturTotBenoetigtBestaetigung') return 'Diese Korrektur stuft den Patienten auf TOT — bitte explizit bestätigen.';
  if (code === 'NotFound:PatientNichtGefunden') return 'Patient wurde zwischenzeitlich geändert oder entfernt, bitte Detail neu laden.';
  const message = extractErrorMessage(error);
  if (message && message !== 'Response returned an error code') {
    return `Korrektur fehlgeschlagen: ${message}`;
  }
  return 'Korrektur fehlgeschlagen.';
}
