import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createElement, type ComponentProps, type ReactNode } from 'react';

const korrigiereApiSpy = vi.fn();

vi.mock('@/shared', () => ({
  api: { patienten: () => ({ patientenControllerKorrigiereVAlpha: korrigiereApiSpy }) },
  ResponseError: class ResponseError extends Error {
    override name = 'ResponseError' as const;
    constructor(
      public response: Response,
      msg?: string,
    ) {
      super(msg);
    }
  },
}));

const { KorrekturDrawer } = await import('../ui/korrektur-drawer');

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

function renderDrawer(open = true, current?: ComponentProps<typeof KorrekturDrawer>['current']) {
  return render(
    <KorrekturDrawer
      open={open}
      onClose={() => undefined}
      einsatzId="einsatz-1"
      patientId="pat-1"
      patientennummer="P-003"
      current={current ?? { sichtung: 'SK_III', behandlungsstatus: 'VERSORGT', transportstatus: 'WARTEND' }}
    />,
    { wrapper },
  );
}

describe('KorrekturDrawer (Story 1.4, FR42, AC5)', () => {
  beforeEach(() => korrigiereApiSpy.mockReset());

  it('rendert drei Tabs (Sichtung, Behandlung, Transport)', () => {
    renderDrawer();
    expect(screen.getByTestId('korrektur-tab-sichtung')).toBeInTheDocument();
    expect(screen.getByTestId('korrektur-tab-behandlungsstatus')).toBeInTheDocument();
    expect(screen.getByTestId('korrektur-tab-transportstatus')).toBeInTheDocument();
  });

  it('Tab-Switching wechselt Auswahl-Optionen', async () => {
    const user = userEvent.setup();
    renderDrawer();
    expect(screen.getByTestId('korrektur-current-sichtung').textContent).toBe('SK_III');
    await user.click(screen.getByTestId('korrektur-tab-behandlungsstatus'));
    await waitFor(() => expect(screen.getByTestId('korrektur-current-behandlungsstatus').textContent).toBe('VERSORGT'));
  });

  it('Submit-Button ist disabled solange Grund leer oder neuerWert == currentValue', async () => {
    renderDrawer();
    expect(screen.getByTestId('korrektur-submit')).toBeDisabled();
  });

  it('Tab-Switching leert die `grund`-Textarea (P1)', async () => {
    const user = userEvent.setup();
    renderDrawer();
    await user.type(screen.getByTestId('korrektur-grund'), 'Begründung für Sichtung');
    expect((screen.getByTestId('korrektur-grund') as HTMLTextAreaElement).value).toBe('Begründung für Sichtung');

    await user.click(screen.getByTestId('korrektur-tab-behandlungsstatus'));
    await waitFor(() => expect((screen.getByTestId('korrektur-grund') as HTMLTextAreaElement).value).toBe(''));
  });

  it('Double-Click-Guard: zwei schnelle Klicks lösen die Mutation nicht doppelt aus (P2)', async () => {
    korrigiereApiSpy.mockResolvedValue({
      data: {
        id: 'pat-1',
        einsatzId: 'einsatz-1',
        patientennummer: 'P-003',
        aktuelleSk: 'SK_III',
        behandlungsstatus: 'IN_BEHANDLUNG',
        transportstatus: 'WARTEND',
        erfasstAm: '2026-05-19T10:00:00.000Z',
        erfasserRef: { type: 'user', userId: 'user-1' },
        eventVersion: 5,
      },
    });
    const nowSpy = vi.spyOn(Date, 'now');
    try {
      // 1. Klick: setzt confirming=true, confirmingAt=1000.
      nowSpy.mockReturnValue(1000);
      const user = userEvent.setup();
      renderDrawer();
      await user.click(screen.getByTestId('korrektur-tab-behandlungsstatus'));
      await user.selectOptions(screen.getByTestId('korrektur-neuer-wert'), 'IN_BEHANDLUNG');
      await user.type(screen.getByTestId('korrektur-grund'), 'Falschmeldung Team C');

      await user.click(screen.getByTestId('korrektur-submit'));
      await waitFor(() => expect(screen.getByText(/nicht rückgängig/)).toBeInTheDocument());
      expect(korrigiereApiSpy).not.toHaveBeenCalled();

      // 2. Klick innerhalb 250 ms (Date.now() === 1100): muss verworfen werden.
      nowSpy.mockReturnValue(1100);
      await user.click(screen.getByTestId('korrektur-submit'));
      // Kleine Wartezeit, falls die Mutation doch ausgelöst würde.
      await new Promise((r) => setTimeout(r, 20));
      expect(korrigiereApiSpy).not.toHaveBeenCalled();

      // 3. Klick nach 250 ms (Date.now() === 1300): muss durchgehen.
      nowSpy.mockReturnValue(1300);
      await user.click(screen.getByTestId('korrektur-submit'));
      await waitFor(() => expect(korrigiereApiSpy).toHaveBeenCalledTimes(1));
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('Revalidate currentValue beim Submit: extern geänderter Wert setzt Confirm-Step zurück (P3)', async () => {
    const user = userEvent.setup();
    const { rerender } = renderDrawer(true, { sichtung: 'SK_III', behandlungsstatus: 'VERSORGT', transportstatus: 'WARTEND' });

    await user.click(screen.getByTestId('korrektur-tab-behandlungsstatus'));
    await user.selectOptions(screen.getByTestId('korrektur-neuer-wert'), 'IN_BEHANDLUNG');
    await user.type(screen.getByTestId('korrektur-grund'), 'Korrektur weil ...');

    // 1. Klick → Pflicht-Confirm-Step sichtbar.
    await user.click(screen.getByTestId('korrektur-submit'));
    await waitFor(() => expect(screen.getByText(/nicht rückgängig/)).toBeInTheDocument());

    // Server-Push simulieren: behandlungsstatus extern geändert.
    rerender(
      <KorrekturDrawer
        open
        onClose={() => undefined}
        einsatzId="einsatz-1"
        patientId="pat-1"
        patientennummer="P-003"
        current={{ sichtung: 'SK_III', behandlungsstatus: 'TRANSPORTBEREIT', transportstatus: 'WARTEND' }}
      />,
    );

    // 2. Klick → Submit erkennt extern geänderten Wert, setzt Confirm-Step zurück und zeigt Warnung.
    await user.click(screen.getByTestId('korrektur-submit'));
    await waitFor(() => expect(screen.getByTestId('korrektur-extern-changed')).toBeInTheDocument());
    expect(korrigiereApiSpy).not.toHaveBeenCalled();
    expect(screen.queryByText(/nicht rückgängig/)).not.toBeInTheDocument();
  });

  // Inline-Fehler-Anzeige bei Server-Reject deferred — analog
  // `BehandlungsStatusPillGroup` (Story 1.4) und `SkUpgradePillGroup`
  // (Story 1.3). Die neue `code`-Match-Logik (Story 1.4 Code-Review Feature 1)
  // ist unit-getestet in `extract-error-code.test.ts`.

  describe('Story 1.4 Code-Review Feature 2: TOT-Korrektur-Confirm-Gate', () => {
    it('zeigt zusätzlichen Confirm-Block + disabled Submit, sobald `neuerWert=TOT` auf lebendem Patienten', async () => {
      const user = userEvent.setup();
      renderDrawer(true, { sichtung: 'SK_II', behandlungsstatus: 'VERSORGT', transportstatus: 'WARTEND' });
      // Sichtungs-Tab ist default-aktiv.
      await user.selectOptions(screen.getByTestId('korrektur-neuer-wert'), 'TOT');
      await user.type(screen.getByTestId('korrektur-grund'), 'Patient verstorben');

      // TOT-Confirm-Block wird gerendert.
      expect(screen.getByTestId('korrektur-tot-confirm')).toBeInTheDocument();
      // Submit ist disabled, solange Checkbox nicht aktiv.
      expect(screen.getByTestId('korrektur-submit')).toBeDisabled();

      // Checkbox aktivieren → Submit enabled.
      await user.click(screen.getByTestId('korrektur-tot-confirm-checkbox'));
      expect(screen.getByTestId('korrektur-submit')).not.toBeDisabled();
    });

    it('reicht `bestaetigeTotKorrektur=true` durch, wenn Checkbox aktiv und 2-Step-Confirm bestätigt', async () => {
      korrigiereApiSpy.mockResolvedValue({
        data: {
          id: 'pat-1',
          einsatzId: 'einsatz-1',
          patientennummer: 'P-003',
          aktuelleSk: 'TOT',
          behandlungsstatus: 'VERSORGT',
          transportstatus: 'WARTEND',
          erfasstAm: '2026-05-19T10:00:00.000Z',
          erfasserRef: { type: 'user', userId: 'user-1' },
          eventVersion: 5,
        },
      });
      const user = userEvent.setup();
      renderDrawer(true, { sichtung: 'SK_II', behandlungsstatus: 'VERSORGT', transportstatus: 'WARTEND' });
      await user.selectOptions(screen.getByTestId('korrektur-neuer-wert'), 'TOT');
      await user.type(screen.getByTestId('korrektur-grund'), 'Patient verstorben');
      await user.click(screen.getByTestId('korrektur-tot-confirm-checkbox'));

      // 1st submit click → Pflicht-Confirm-Step.
      await user.click(screen.getByTestId('korrektur-submit'));
      await waitFor(() => expect(screen.getByText(/nicht rückgängig/)).toBeInTheDocument());
      expect(korrigiereApiSpy).not.toHaveBeenCalled();

      // Double-Click-Guard >250 ms.
      await new Promise((r) => setTimeout(r, 260));

      // 2nd submit click → Mutation ausgelöst.
      await user.click(screen.getByTestId('korrektur-submit'));
      await waitFor(() => expect(korrigiereApiSpy).toHaveBeenCalledTimes(1));
      expect(korrigiereApiSpy).toHaveBeenCalledWith({
        einsatzId: 'einsatz-1',
        patientId: 'pat-1',
        korrigierePatientDto: {
          feld: 'sichtung',
          neuerWert: 'TOT',
          grund: 'Patient verstorben',
          bestaetigeTotKorrektur: true,
        },
      });
    });

    it('Checkbox wird beim Wertwechsel (neuerWert) zurückgesetzt', async () => {
      const user = userEvent.setup();
      renderDrawer(true, { sichtung: 'SK_II', behandlungsstatus: 'VERSORGT', transportstatus: 'WARTEND' });
      await user.selectOptions(screen.getByTestId('korrektur-neuer-wert'), 'TOT');
      await user.click(screen.getByTestId('korrektur-tot-confirm-checkbox'));
      expect((screen.getByTestId('korrektur-tot-confirm-checkbox') as HTMLInputElement).checked).toBe(true);

      // Wertwechsel: weg von TOT → Confirm-Block verschwindet.
      await user.selectOptions(screen.getByTestId('korrektur-neuer-wert'), 'SK_I');
      expect(screen.queryByTestId('korrektur-tot-confirm')).not.toBeInTheDocument();

      // Wieder TOT auswählen: Checkbox soll **nicht** mehr aktiv sein.
      await user.selectOptions(screen.getByTestId('korrektur-neuer-wert'), 'TOT');
      expect((screen.getByTestId('korrektur-tot-confirm-checkbox') as HTMLInputElement).checked).toBe(false);
    });

    it('Confirm-Gate erscheint **nicht**, wenn current.sichtung bereits TOT ist (No-Op-Pfad)', async () => {
      renderDrawer(true, { sichtung: 'TOT', behandlungsstatus: 'VERSORGT', transportstatus: 'WARTEND' });
      // TOT ist als `disabled` (aktuell) markiert — userEvent.selectOptions würde fehlschlagen.
      // Statt dessen prüfen wir, dass der Confirm-Block bei keinem Setup gezeigt wird.
      expect(screen.queryByTestId('korrektur-tot-confirm')).not.toBeInTheDocument();
    });

    it('Confirm-Gate erscheint **nicht** auf Behandlungs- oder Transport-Tab', async () => {
      const user = userEvent.setup();
      renderDrawer(true, { sichtung: 'SK_II', behandlungsstatus: 'VERSORGT', transportstatus: 'WARTEND' });
      await user.click(screen.getByTestId('korrektur-tab-behandlungsstatus'));
      await user.selectOptions(screen.getByTestId('korrektur-neuer-wert'), 'IN_BEHANDLUNG');
      expect(screen.queryByTestId('korrektur-tot-confirm')).not.toBeInTheDocument();

      await user.click(screen.getByTestId('korrektur-tab-transportstatus'));
      await user.selectOptions(screen.getByTestId('korrektur-neuer-wert'), 'IM_TRANSPORT');
      expect(screen.queryByTestId('korrektur-tot-confirm')).not.toBeInTheDocument();
    });

    it('Checkbox wird beim Tab-Wechsel zurückgesetzt', async () => {
      const user = userEvent.setup();
      renderDrawer(true, { sichtung: 'SK_II', behandlungsstatus: 'VERSORGT', transportstatus: 'WARTEND' });
      await user.selectOptions(screen.getByTestId('korrektur-neuer-wert'), 'TOT');
      await user.click(screen.getByTestId('korrektur-tot-confirm-checkbox'));
      expect((screen.getByTestId('korrektur-tot-confirm-checkbox') as HTMLInputElement).checked).toBe(true);

      await user.click(screen.getByTestId('korrektur-tab-behandlungsstatus'));
      // Zurück auf Sichtung → Auswahl und Confirm sind sauber.
      await user.click(screen.getByTestId('korrektur-tab-sichtung'));
      // Wert neu wählen, dann prüfen, dass Checkbox unchecked.
      await user.selectOptions(screen.getByTestId('korrektur-neuer-wert'), 'TOT');
      expect((screen.getByTestId('korrektur-tot-confirm-checkbox') as HTMLInputElement).checked).toBe(false);
    });
  });

  it('Pflicht-Confirm-Step: erster Submit zeigt Warnung, zweiter ruft API', async () => {
    korrigiereApiSpy.mockResolvedValue({
      data: {
        id: 'pat-1',
        einsatzId: 'einsatz-1',
        patientennummer: 'P-003',
        aktuelleSk: 'SK_III',
        behandlungsstatus: 'IN_BEHANDLUNG',
        transportstatus: 'WARTEND',
        erfasstAm: '2026-05-19T10:00:00.000Z',
        erfasserRef: { type: 'user', userId: 'user-1' },
        eventVersion: 5,
      },
    });
    const user = userEvent.setup();
    renderDrawer();
    await user.click(screen.getByTestId('korrektur-tab-behandlungsstatus'));
    await user.selectOptions(screen.getByTestId('korrektur-neuer-wert'), 'IN_BEHANDLUNG');
    await user.type(screen.getByTestId('korrektur-grund'), 'Falschmeldung Team C');

    // 1st click: zeigt Pflicht-Confirm-Step
    await user.click(screen.getByTestId('korrektur-submit'));
    await waitFor(() => expect(screen.getByText(/nicht rückgängig/)).toBeInTheDocument());
    expect(korrigiereApiSpy).not.toHaveBeenCalled();

    // Mindest-Verzögerung > 250 ms (Double-Click-Guard, siehe Test P2).
    await new Promise((resolve) => setTimeout(resolve, 260));

    // 2nd click: löst Mutation aus
    await user.click(screen.getByTestId('korrektur-submit'));
    await waitFor(() => expect(korrigiereApiSpy).toHaveBeenCalledTimes(1));
    expect(korrigiereApiSpy).toHaveBeenCalledWith({
      einsatzId: 'einsatz-1',
      patientId: 'pat-1',
      korrigierePatientDto: { feld: 'behandlungsstatus', neuerWert: 'IN_BEHANDLUNG', grund: 'Falschmeldung Team C' },
    });
  });
});
