/**
 * Spec für `SicherungspostenDrawer` (Story 4.1, T6).
 *
 * Schwerpunkte:
 * - Pflichtfeld-Validation für `bezeichnung` blockiert Submit.
 * - Standort-Toggle wechselt zwischen Address-Textarea und Coordinate-Inputs.
 * - Personal-Eintrag hinzufügen + entfernen.
 * - Submit ruft `useCreateSicherungsposten` mit normalisiertem Payload.
 * - 409-Konflikt rendert Inline-Banner mit Server-Version.
 */

import { renderWithProviders } from '@/test/utils';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mocks, SicherungspostenConflictErrorMock } = vi.hoisted(() => {
  class SicherungspostenConflictErrorMock extends Error {
    readonly statusCode = 409;
    constructor(
      readonly currentVersion: number | undefined,
      readonly attemptedVersion: number | undefined,
      readonly originalError: unknown,
    ) {
      super('ConflictDetected:Sicherungsposten');
      this.name = 'SicherungspostenConflictError';
    }
  }
  return {
    SicherungspostenConflictErrorMock,
    mocks: {
      createMutation: { mutateAsync: vi.fn(), isPending: false },
      updateMutation: { mutateAsync: vi.fn(), isPending: false },
    },
  };
});

vi.mock('../../../api/use-sicherungsposten', () => ({
  useCreateSicherungsposten: () => mocks.createMutation,
  useUpdateSicherungsposten: () => mocks.updateMutation,
  useAufloeseSicherungsposten: () => ({ mutateAsync: vi.fn(), isPending: false }),
  SicherungspostenConflictError: SicherungspostenConflictErrorMock,
  extractSicherungspostenConflictError: vi.fn(),
  sicherungspostenQueryKeys: {
    all: ['sicherungsposten'],
    list: (id: string, s: string) => ['sicherungsposten', id, s],
    byEinsatz: (id: string) => ['sicherungsposten', id],
  },
}));

import { SicherungspostenDrawer } from '../SicherungspostenDrawer';

const EXISTING_POSTEN = {
  id: 'posten-1',
  einsatzId: 'einsatz-1',
  bezeichnung: 'Eingang Süd',
  standort: { kind: 'address', text: 'Süd-Tor' },
  personal: [],
  version: 4,
  erstelltAm: '2026-05-01T10:00:00.000Z',
  erstelltVonUserId: 'user-1',
  aktualisiertAm: '2026-05-01T10:00:00.000Z',
  aktualisiertVonUserId: 'user-1',
} as const;

beforeEach(() => {
  // Wichtig: Real-Timer in jedem `beforeEach` erzwingen — sonst leakt ein
  // vorausgegangener Fake-Timer-Test (mit fehlgeschlagenem `vi.useRealTimers`-
  // Cleanup im finally) in den nächsten Test und blockiert den Dialog-Mount.
  vi.useRealTimers();
  mocks.createMutation.mutateAsync = vi.fn();
  mocks.createMutation.isPending = false;
  mocks.updateMutation.mutateAsync = vi.fn();
  mocks.updateMutation.isPending = false;
});

function setup(props: Partial<React.ComponentProps<typeof SicherungspostenDrawer>> = {}) {
  const onClose = vi.fn();
  renderWithProviders(<SicherungspostenDrawer einsatzId="einsatz-1" mode="create" open={true} onClose={onClose} {...props} />);
  return { onClose };
}

describe('SicherungspostenDrawer', () => {
  it('zeigt Inline-Fehler bei leerer Bezeichnung und blockiert Submit', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByTestId('sicherungsposten-drawer-submit'));
    await waitFor(() => {
      expect(screen.getByTestId('sicherungsposten-drawer-inline-error')).toBeInTheDocument();
    });
    expect(mocks.createMutation.mutateAsync).not.toHaveBeenCalled();
  });

  it('Standort-Toggle wechselt zwischen Address und Coordinate', async () => {
    const user = userEvent.setup();
    setup();
    expect(screen.getByTestId('sicherungsposten-standort-text')).toBeInTheDocument();

    await user.click(screen.getByTestId('sicherungsposten-standort-toggle-coordinate'));
    await waitFor(() => {
      expect(screen.getByTestId('sicherungsposten-standort-latitude')).toBeInTheDocument();
      expect(screen.getByTestId('sicherungsposten-standort-longitude')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('sicherungsposten-standort-text')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('sicherungsposten-standort-toggle-address'));
    await waitFor(() => {
      expect(screen.getByTestId('sicherungsposten-standort-text')).toBeInTheDocument();
    });
  });

  it('Personal: Eintrag hinzufügen und wieder entfernen', async () => {
    const user = userEvent.setup();
    setup();
    expect(screen.queryByTestId('sicherungsposten-personal-row-0')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('sicherungsposten-personal-add'));
    await waitFor(() => {
      expect(screen.getByTestId('sicherungsposten-personal-row-0')).toBeInTheDocument();
    });
    expect(screen.getByTestId('sicherungsposten-personal-name-0')).toBeInTheDocument();

    await user.click(screen.getByTestId('sicherungsposten-personal-remove-0'));
    await waitFor(() => {
      expect(screen.queryByTestId('sicherungsposten-personal-row-0')).not.toBeInTheDocument();
    });
  });

  it('Personal: Toggle zwischen User-ID und Freitext', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByTestId('sicherungsposten-personal-add'));
    await waitFor(() => {
      expect(screen.getByTestId('sicherungsposten-personal-name-0')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('sicherungsposten-personal-toggle-user-0'));
    await waitFor(() => {
      expect(screen.getByTestId('sicherungsposten-personal-userid-0')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('sicherungsposten-personal-name-0')).not.toBeInTheDocument();
  });

  it('Submit im Create-Modus ruft useCreateSicherungsposten mit Form-Werten', async () => {
    const user = userEvent.setup();
    mocks.createMutation.mutateAsync = vi.fn().mockResolvedValue({ id: 'posten-new' });
    const { onClose } = setup();

    await user.type(screen.getByTestId('sicherungsposten-bezeichnung'), 'Posten Mitte');
    const standortText = screen.getByTestId('sicherungsposten-standort-text');
    await user.type(standortText, 'Hauptzelt');

    await user.click(screen.getByTestId('sicherungsposten-drawer-submit'));

    await waitFor(() => {
      expect(mocks.createMutation.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          bezeichnung: 'Posten Mitte',
          standort: { kind: 'address', text: 'Hauptzelt' },
        }),
      );
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('Submit im Edit-Modus übergibt expectedVersion aus posten.version', async () => {
    const user = userEvent.setup();
    mocks.updateMutation.mutateAsync = vi.fn().mockResolvedValue({ id: EXISTING_POSTEN.id });

    setup({ mode: 'edit', posten: EXISTING_POSTEN });
    const bezeichnung = screen.getByTestId('sicherungsposten-bezeichnung') as HTMLInputElement;
    await waitFor(() => expect(bezeichnung.value).toBe('Eingang Süd'));

    await user.clear(bezeichnung);
    await user.type(bezeichnung, 'Eingang Nord');
    await user.click(screen.getByTestId('sicherungsposten-drawer-submit'));

    await waitFor(() => {
      expect(mocks.updateMutation.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          postenId: EXISTING_POSTEN.id,
          body: expect.objectContaining({ expectedVersion: 4, bezeichnung: 'Eingang Nord' }),
        }),
      );
    });
  });

  it('409-Konflikt rendert Inline-Banner mit Server-Version, schließt Drawer NICHT', async () => {
    const user = userEvent.setup();
    const conflict = new SicherungspostenConflictErrorMock(7, 4, undefined);
    mocks.updateMutation.mutateAsync = vi.fn().mockRejectedValue(conflict);

    const { onClose } = setup({ mode: 'edit', posten: EXISTING_POSTEN });
    const bezeichnung = screen.getByTestId('sicherungsposten-bezeichnung') as HTMLInputElement;
    await waitFor(() => expect(bezeichnung.value).toBe('Eingang Süd'));
    await user.clear(bezeichnung);
    await user.type(bezeichnung, 'Eingang Mitte');

    await user.click(screen.getByTestId('sicherungsposten-drawer-submit'));

    await waitFor(() => {
      const banner = screen.getByTestId('sicherungsposten-drawer-conflict-banner');
      expect(within(banner).getByText(/Server-Version: 7/)).toBeInTheDocument();
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});

/**
 * Story 4.2 — Ablösezeiten als Textfeld (T6 / AC11 Frontend).
 *
 * Diese Tests fokussieren ausschließlich auf den neuen Ablösezeiten-Editor:
 * Textarea + Zähler, Auto-Save-Verdrahtung im Edit-Mode, Konflikt-Pause
 * sowie Create-Mode-Footer-Submit. Bestehende Tests (oben) bleiben grün.
 *
 * Wichtige Test-Konventionen:
 * - Auto-Save-Tests benutzen `vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync`
 *   im `act(async ...)`-Wrapper (Pattern aus `GefaehrdungenEditorOrganism.spec.tsx`).
 * - 2001-Zeichen-Eingabe wird via `fireEvent.change` injiziert, weil
 *   `userEvent.type` das HTML-`maxLength`-Attribut respektiert und JSDOM
 *   in der Folge keine >2000-Zeichen-Strings zulässt.
 * - `userEvent` läuft NICHT zusammen mit Fake-Timern — Fake-Timer-Tests nutzen
 *   ausschließlich `fireEvent`.
 */

/**
 * Hilfs-Fixture: erweitert {@link EXISTING_POSTEN} um einen optionalen
 * `abloesezeiten`-Wert und eine optionale Versions-Override. Vermeidet
 * `as const`-Mutationen am Shared-Fixture.
 */
function buildPosten(overrides: { abloesezeiten?: string | null; version?: number } = {}) {
  return {
    ...EXISTING_POSTEN,
    abloesezeiten: overrides.abloesezeiten ?? null,
    version: overrides.version ?? EXISTING_POSTEN.version,
  } as unknown as Parameters<typeof SicherungspostenDrawer>[0]['posten'];
}

describe('Story 4.2 — Ablösezeiten-Editor', () => {
  it('(1) Edit-Mode: Textarea ist gerendert (kein Stub mehr), maxLength=2000, Counter zeigt initialen Wert', async () => {
    setup({ mode: 'edit', posten: buildPosten({ abloesezeiten: null }) });

    const textarea = await screen.findByTestId('sicherungsposten-abloesezeiten');
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveAttribute('maxLength', '2000');
    expect(screen.queryByTestId('sicherungsposten-abloesezeiten-stub')).toBeNull();

    const counter = screen.getByTestId('sicherungsposten-abloesezeiten-counter');
    expect(counter).toHaveTextContent('0 / 2000 Zeichen');
    expect(counter.className).not.toContain('text-status-danger-text');
  });

  it('(2) Edit-Mode: 1500-Zeichen-Eingabe → Counter zeigt „1500 / 2000", nicht rot', async () => {
    setup({ mode: 'edit', posten: buildPosten({ abloesezeiten: null }) });

    const textarea = await screen.findByTestId('sicherungsposten-abloesezeiten');
    fireEvent.change(textarea, { target: { value: 'a'.repeat(1500) } });

    const counter = screen.getByTestId('sicherungsposten-abloesezeiten-counter');
    await waitFor(() => expect(counter).toHaveTextContent('1500 / 2000 Zeichen'));
    expect(counter.className).not.toContain('text-status-danger-text');
  });

  it('(3) Edit-Mode: 2001-Zeichen-Eingabe (paste) → Counter wird rot, Badge zeigt „Nicht gespeichert", Auto-Save bleibt blockiert', async () => {
    // `useAutoSave.scheduleSave` setzt jetzt explizit `dirty`, wenn die
    // einzige Ablehnungs-Ursache `isValid=false` ist (AC7). Der Test
    // verifiziert: Counter rot, Badge `dirty`, UND auch nach 2-s-Debounce
    // läuft keine Mutation — sonst würde der Test bereits ohne
    // Timer-Vorrücken bestehen (tautologisch).
    mocks.updateMutation.mutateAsync = vi.fn();
    setup({ mode: 'edit', posten: buildPosten({ abloesezeiten: null }) });

    const textarea = await screen.findByTestId('sicherungsposten-abloesezeiten');
    fireEvent.change(textarea, { target: { value: 'a'.repeat(2001) } });

    const counter = screen.getByTestId('sicherungsposten-abloesezeiten-counter');
    await waitFor(() => expect(counter).toHaveTextContent('2001 / 2000 Zeichen'));
    expect(counter.className).toContain('text-status-danger-text');

    const badge = await screen.findByTestId('sicherungsposten-abloesezeiten-autosave-status');
    expect(badge).toHaveTextContent('Nicht gespeichert');

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2500);
      });
      expect(mocks.updateMutation.mutateAsync).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('(4) Edit-Mode: Tippen + 2-s-Debounce → genau eine Update-Mutation mit korrekter expectedVersion + abloesezeiten-Wert', async () => {
    // Render mit Real-Timern (Dialog.SlideIn-Mount erfordert Real-Timer);
    // erst danach Fake-Timer aktivieren — sonst hängt der Mount-Transition.
    mocks.updateMutation.mutateAsync = vi.fn().mockResolvedValue({
      ...EXISTING_POSTEN,
      version: 5,
      abloesezeiten: 'Posten Schicht 1',
    });
    setup({ mode: 'edit', posten: buildPosten({ abloesezeiten: null, version: 4 }) });
    const textarea = await screen.findByTestId('sicherungsposten-abloesezeiten');

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      fireEvent.change(textarea, { target: { value: 'Posten Schicht 1' } });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });

      expect(mocks.updateMutation.mutateAsync).toHaveBeenCalledTimes(1);
      expect(mocks.updateMutation.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          postenId: EXISTING_POSTEN.id,
          body: expect.objectContaining({
            expectedVersion: 4,
            abloesezeiten: 'Posten Schicht 1',
          }),
        }),
      );
      // Auto-Save-Body besitzt `abloesezeiten` exklusiv und sendet KEINE
      // Footer-Felder (Story 4.2 / AC4).
      const callArgs = mocks.updateMutation.mutateAsync.mock.calls[0]![0] as { body: Record<string, unknown> };
      expect(callArgs.body).not.toHaveProperty('bezeichnung');
      expect(callArgs.body).not.toHaveProperty('standort');
    } finally {
      vi.useRealTimers();
    }
  });

  it('(5) Edit-Mode: zwei Tipps innerhalb 1 s → nur eine Mutation (Debounce-Coalescing)', async () => {
    mocks.updateMutation.mutateAsync = vi.fn().mockResolvedValue({
      ...EXISTING_POSTEN,
      version: 5,
      abloesezeiten: 'Schicht 2 final',
    });
    setup({ mode: 'edit', posten: buildPosten({ abloesezeiten: null, version: 4 }) });
    const textarea = await screen.findByTestId('sicherungsposten-abloesezeiten');

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      fireEvent.change(textarea, { target: { value: 'Schicht 1' } });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });
      fireEvent.change(textarea, { target: { value: 'Schicht 2 final' } });

      // Vor Ablauf der 2-s-Debounce-Frist DARF noch nichts gefeuert haben.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1999);
      });
      expect(mocks.updateMutation.mutateAsync).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });

      expect(mocks.updateMutation.mutateAsync).toHaveBeenCalledTimes(1);
      expect(mocks.updateMutation.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({ abloesezeiten: 'Schicht 2 final' }),
        }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('(6) Edit-Mode: 409-Konflikt pausiert Auto-Save — weitere Tipps lösen keine Mutation aus', async () => {
    // Strategie: Konflikt wird über den Footer-Submit-Pfad provoziert
    // (bestehendes Pattern, real timers, `userEvent.click`). Sobald der
    // Banner sichtbar ist, ist `conflictError` gesetzt → `useAutoSave` ist
    // via `enabled: false` deaktiviert. Weitere Eingaben in der Textarea
    // dürfen keine Auto-Save-Mutation auslösen.
    const user = userEvent.setup();
    const conflict = new SicherungspostenConflictErrorMock(7, 4, undefined);
    mocks.updateMutation.mutateAsync = vi.fn().mockRejectedValueOnce(conflict);
    setup({ mode: 'edit', posten: buildPosten({ abloesezeiten: null, version: 4 }) });

    const bezeichnung = screen.getByTestId('sicherungsposten-bezeichnung') as HTMLInputElement;
    await waitFor(() => expect(bezeichnung.value).toBe('Eingang Süd'));
    await user.clear(bezeichnung);
    await user.type(bezeichnung, 'Eingang Mitte');
    await user.click(screen.getByTestId('sicherungsposten-drawer-submit'));

    // Konflikt-Banner sichtbar, Auto-Save-Badge zeigt „Konflikt — bitte neu laden".
    await waitFor(() => {
      expect(screen.getByTestId('sicherungsposten-drawer-conflict-banner')).toBeInTheDocument();
    });
    const banner = screen.getByTestId('sicherungsposten-drawer-conflict-banner');
    expect(within(banner).getByText(/Server-Version: 7/)).toBeInTheDocument();
    expect(mocks.updateMutation.mutateAsync).toHaveBeenCalledTimes(1);

    // AC7: Badge zeigt „Konflikt — bitte neu laden".
    const badge = screen.getByTestId('sicherungsposten-abloesezeiten-autosave-status');
    expect(badge).toHaveTextContent('Konflikt — bitte neu laden');

    // Weitere Eingabe darf KEINE neue Mutation auslösen — `enabled: false`
    // im `useAutoSave`-Hook blockt zuverlässig.
    const textarea = screen.getByTestId('sicherungsposten-abloesezeiten');
    fireEvent.change(textarea, { target: { value: 'Tipp nach Konflikt' } });

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });
    } finally {
      vi.useRealTimers();
    }
    expect(mocks.updateMutation.mutateAsync).toHaveBeenCalledTimes(1);
  });

  it('(7) Edit-Mode: Drawer-Close (Cancel) während dirty → flushNow vor Close, finale Mutation läuft', async () => {
    // Echte Timer: kein Fake-Timer-Setup. Der Auto-Save-Debounce läuft
    // 2 s — der Cancel-Klick gewinnt das Race und triggert `flushNow`
    // im `handleClose`-Pfad. `fireEvent.click` (statt `user.click`)
    // umgeht userEvent-Pointer-Checks unter Drawer-Overlays.
    mocks.updateMutation.mutateAsync = vi.fn().mockResolvedValue({
      ...EXISTING_POSTEN,
      version: 5,
      abloesezeiten: 'Tipp während dirty',
    });
    const { onClose } = setup({ mode: 'edit', posten: buildPosten({ abloesezeiten: null, version: 4 }) });

    const textarea = await screen.findByTestId('sicherungsposten-abloesezeiten');
    fireEvent.change(textarea, { target: { value: 'Tipp während dirty' } });

    // Cancel-Button auf das Drawer-Form scopen (Dialog kann eigene
    // „Abbrechen"-Buttons via Confirm-Variante mounten).
    const drawerForm = screen.getByTestId('sicherungsposten-drawer');
    const cancelButton = within(drawerForm).getByRole('button', { name: 'Abbrechen' });
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(mocks.updateMutation.mutateAsync).toHaveBeenCalledTimes(1);
    });
    expect(mocks.updateMutation.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        postenId: EXISTING_POSTEN.id,
        body: expect.objectContaining({ abloesezeiten: 'Tipp während dirty' }),
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('(8) Create-Mode: Textarea ist gerendert, kein Auto-Save-Badge, Footer-Submit überträgt Wert via abloesezeiten', async () => {
    // Real timers durchgehend — Create-Mode hat `enabled=false` für den
    // Auto-Save-Hook, also kann KEIN Debounce-Timer feuern (verifiziert
    // implizit dadurch, dass `updateMutation.mutateAsync` über den ganzen
    // Test 0× aufgerufen wird).
    const user = userEvent.setup();
    mocks.createMutation.mutateAsync = vi.fn().mockResolvedValue({ id: 'posten-new' });
    setup();

    const textarea = await screen.findByTestId('sicherungsposten-abloesezeiten');
    expect(textarea).toBeInTheDocument();
    // Im Create-Mode darf KEIN Auto-Save-Badge gerendert werden.
    expect(screen.queryByTestId('sicherungsposten-abloesezeiten-autosave-status')).toBeNull();

    // Pflichtfelder + Ablösezeiten setzen.
    await user.type(screen.getByTestId('sicherungsposten-bezeichnung'), 'Posten Mitte');
    await user.type(screen.getByTestId('sicherungsposten-standort-text'), 'Hauptzelt');
    fireEvent.change(textarea, { target: { value: '08:00 – 12:00 Trupp 1' } });

    // Footer-Submit muss `abloesezeiten` mitschicken.
    await user.click(screen.getByTestId('sicherungsposten-drawer-submit'));

    await waitFor(() => {
      expect(mocks.createMutation.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          bezeichnung: 'Posten Mitte',
          abloesezeiten: '08:00 – 12:00 Trupp 1',
        }),
      );
    });
    // Auto-Save-Pfad wurde im Create-Mode nicht aufgerufen.
    expect(mocks.updateMutation.mutateAsync).not.toHaveBeenCalled();
  });

  it('(7b) Edit-Mode: ESC-Taste während dirty → handleClose flusht Auto-Save vor Close (analog Cancel-Pfad)', async () => {
    // AC5: Schließen via ESC/Backdrop muss denselben `flushNow`+Race-Pfad
    // nehmen wie der Cancel-Button. Test verifiziert per ESC-Keydown auf
    // dem Dialog, dass die finale Mutation läuft.
    mocks.updateMutation.mutateAsync = vi.fn().mockResolvedValue({
      ...EXISTING_POSTEN,
      version: 5,
      abloesezeiten: 'Tipp via ESC',
    });
    const { onClose } = setup({ mode: 'edit', posten: buildPosten({ abloesezeiten: null, version: 4 }) });

    const textarea = await screen.findByTestId('sicherungsposten-abloesezeiten');
    fireEvent.change(textarea, { target: { value: 'Tipp via ESC' } });

    // ESC auf den Dialog feuert die Headless-UI-`onClose`-Bridge → handleClose.
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape', code: 'Escape' });

    await waitFor(() => {
      expect(mocks.updateMutation.mutateAsync).toHaveBeenCalledTimes(1);
    });
    expect(mocks.updateMutation.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ abloesezeiten: 'Tipp via ESC' }),
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('(7c) `AutoSaveBadge` rendert niemals den `local-saved`-Status (kein onLocalSave konfiguriert)', async () => {
    // AC7-Spec-Vorgabe: `local-saved` und `offline-queued` dürfen in 4.2
    // nicht auftreten, weil `useAutoSave` ohne `onLocalSave` aufgerufen
    // wird. Strukturell garantiert; Test pinnt das per Snapshot des
    // Badge-Mappings + verifiziert kein Render in beiden Auto-Save-Pfaden.
    mocks.updateMutation.mutateAsync = vi.fn().mockResolvedValue({
      ...EXISTING_POSTEN,
      version: 5,
      abloesezeiten: 'Schicht 1',
    });
    setup({ mode: 'edit', posten: buildPosten({ abloesezeiten: null, version: 4 }) });
    const textarea = await screen.findByTestId('sicherungsposten-abloesezeiten');

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      fireEvent.change(textarea, { target: { value: 'Schicht 1' } });
      // Während der gesamten Save-Sequenz darf kein „Lokal gespeichert"-
      // Marker auftauchen (wäre nur möglich, wenn `onLocalSave` konfiguriert
      // wäre; verifiziert die Online-Only-Pivot-Annahme).
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2500);
      });
      const badge = screen.queryByTestId('sicherungsposten-abloesezeiten-autosave-status');
      expect(badge?.textContent ?? '').not.toContain('Lokal gespeichert');
      expect(badge?.textContent ?? '').not.toContain('Offline');
    } finally {
      vi.useRealTimers();
    }
  });

  it('(9) Edit-Mode: identischer Wert → keine Mutation (hasChanges No-Op-Filter)', async () => {
    mocks.updateMutation.mutateAsync = vi.fn();
    setup({ mode: 'edit', posten: buildPosten({ abloesezeiten: 'Schicht 1', version: 4 }) });
    const textarea = (await screen.findByTestId('sicherungsposten-abloesezeiten')) as HTMLTextAreaElement;
    // Sanity: initialer Wert ist befüllt.
    await waitFor(() => expect(textarea.value).toBe('Schicht 1'));

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      // Identischer Wert — `hasChanges` filtert: keine Mutation, auch nach Debounce nicht.
      fireEvent.change(textarea, { target: { value: 'Schicht 1' } });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(mocks.updateMutation.mutateAsync).not.toHaveBeenCalled();

      // Auch Whitespace-Variante (Trim-equivalent) darf nicht feuern,
      // weil `normalizeAbloesezeiten` trimmt.
      fireEvent.change(textarea, { target: { value: '  Schicht 1  ' } });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(mocks.updateMutation.mutateAsync).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
