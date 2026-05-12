/**
 * Spec für `SicherungspostenDrawer` (Story 4.1, T6 + Story 4.2 T6).
 *
 * Schwerpunkte:
 * - Pflichtfeld-Validation für `bezeichnung` blockiert Submit.
 * - Standort-Toggle wechselt zwischen Address-Textarea und Coordinate-Inputs.
 * - Personal-Eintrag hinzufügen + entfernen.
 * - Submit ruft `useCreateSicherungsposten` mit normalisiertem Payload.
 * - 409-Konflikt rendert Inline-Banner mit Server-Version.
 *
 * Story 4.2 ergänzt:
 * - Ablösezeiten-Editor (Textarea ≤ 2000 Zeichen) ersetzt den 4.1-Stub.
 * - Counter zeigt Längen-Status, wird rot bei > 2000.
 * - Auto-Save (Debounce 2 s) feuert exakt einmal pro Pause.
 * - 409-Konflikt pausiert Auto-Save und zeigt „Konflikt"-Badge.
 * - Drawer-Close ruft `flushNow` (asynchron, mit 3-s-Timeout-Race).
 * - Identische Werte triggern keine No-Op-Mutation.
 */

import { renderWithProviders } from '@/test/utils';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
    byEinsatz: (id: string) => ['sicherungsposten', id],
    list: (id: string, s: string) => ['sicherungsposten', id, s],
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
    // Standardmodus ist Personal-Auswahl (kind: 'user'), nicht Freitext.
    expect(screen.getByTestId('sicherungsposten-personal-userid-0')).toBeInTheDocument();

    await user.click(screen.getByTestId('sicherungsposten-personal-remove-0'));
    await waitFor(() => {
      expect(screen.queryByTestId('sicherungsposten-personal-row-0')).not.toBeInTheDocument();
    });
  });

  it('Personal: Toggle zwischen Personal-Auswahl und Freitext', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByTestId('sicherungsposten-personal-add'));
    await waitFor(() => {
      expect(screen.getByTestId('sicherungsposten-personal-userid-0')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('sicherungsposten-personal-toggle-freitext-0'));
    await waitFor(() => {
      expect(screen.getByTestId('sicherungsposten-personal-name-0')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('sicherungsposten-personal-userid-0')).not.toBeInTheDocument();
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

  // ===== Story 4.2 — Ablösezeiten-Editor =====

  describe('Story 4.2 — Ablösezeiten-Editor', () => {
    const POSTEN_MIT_ABLOESE = {
      ...EXISTING_POSTEN,
      abloesezeiten: '08:00 – 12:00 Trupp 1',
    };

    afterEach(() => {
      vi.useRealTimers();
    });

    it('Edit-Mode: Textarea ist gerendert (kein Stub), maxLength=2000, Counter zeigt initialen Wert', async () => {
      setup({ mode: 'edit', posten: POSTEN_MIT_ABLOESE });

      // Stub muss verschwunden sein
      expect(screen.queryByTestId('sicherungsposten-abloesezeiten-stub')).not.toBeInTheDocument();

      const textarea = screen.getByTestId('sicherungsposten-abloesezeiten') as HTMLTextAreaElement;
      expect(textarea).toBeInTheDocument();
      expect(textarea.maxLength).toBe(2000);
      await waitFor(() => expect(textarea.value).toBe('08:00 – 12:00 Trupp 1'));

      const counter = screen.getByTestId('sicherungsposten-abloesezeiten-counter');
      expect(counter).toHaveTextContent(`${'08:00 – 12:00 Trupp 1'.length} / 2000 Zeichen`);
      expect(counter.className).not.toContain('text-status-danger-text');
    });

    it('Edit-Mode: 1500-Zeichen-Eingabe → Counter „1500 / 2000", nicht rot', async () => {
      setup({ mode: 'edit', posten: { ...POSTEN_MIT_ABLOESE, abloesezeiten: '' } });
      const textarea = screen.getByTestId('sicherungsposten-abloesezeiten') as HTMLTextAreaElement;

      const longValue = 'a'.repeat(1500);
      // fireEvent für direktes Setzen ohne 1500-Char-userEvent-Tippen
      fireEvent.change(textarea, { target: { value: longValue } });

      await waitFor(() => {
        expect(screen.getByTestId('sicherungsposten-abloesezeiten-counter')).toHaveTextContent('1500 / 2000 Zeichen');
      });
      const counter = screen.getByTestId('sicherungsposten-abloesezeiten-counter');
      expect(counter.className).not.toContain('text-status-danger-text');
    });

    it('Edit-Mode: 2001-Zeichen → Counter rot, Auto-Save-Badge zeigt „Nicht gespeichert" (isValid blockt)', async () => {
      vi.useFakeTimers();
      try {
        mocks.updateMutation.mutateAsync = vi.fn().mockResolvedValue({ ...POSTEN_MIT_ABLOESE, version: 5 });

        setup({ mode: 'edit', posten: { ...POSTEN_MIT_ABLOESE, abloesezeiten: '' } });
        const textarea = screen.getByTestId('sicherungsposten-abloesezeiten') as HTMLTextAreaElement;

        // Hard-set ohne `maxLength`-Cap (fireEvent umgeht das DOM-MaxLength)
        const overflow = 'a'.repeat(2001);
        fireEvent.change(textarea, { target: { value: overflow } });

        const counter = screen.getByTestId('sicherungsposten-abloesezeiten-counter');
        expect(counter).toHaveTextContent('2001 / 2000 Zeichen');
        expect(counter.className).toContain('text-status-danger-text');

        // Debounce-Tick durchlaufen — Auto-Save darf NICHT feuern
        await act(async () => {
          await vi.advanceTimersByTimeAsync(2500);
        });

        const badge = screen.getByTestId('sicherungsposten-abloesezeiten-autosave-status');
        expect(badge).toHaveTextContent('Nicht gespeichert');
        expect(mocks.updateMutation.mutateAsync).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it('Edit-Mode: Tippen → 2-s-Debounce → genau eine Mutation mit korrekter expectedVersion + abloesezeiten', async () => {
      vi.useFakeTimers();
      try {
        mocks.updateMutation.mutateAsync = vi.fn().mockResolvedValue({ ...POSTEN_MIT_ABLOESE, version: 5, abloesezeiten: 'neu' });

        setup({ mode: 'edit', posten: POSTEN_MIT_ABLOESE });
        const textarea = screen.getByTestId('sicherungsposten-abloesezeiten') as HTMLTextAreaElement;

        fireEvent.change(textarea, { target: { value: 'neu' } });

        // Vor Debounce-Ablauf: keine Mutation
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1999);
        });
        expect(mocks.updateMutation.mutateAsync).not.toHaveBeenCalled();

        // Nach Debounce-Ablauf: genau eine Mutation
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1);
        });

        expect(mocks.updateMutation.mutateAsync).toHaveBeenCalledTimes(1);
        expect(mocks.updateMutation.mutateAsync).toHaveBeenCalledWith({
          postenId: POSTEN_MIT_ABLOESE.id,
          body: { expectedVersion: POSTEN_MIT_ABLOESE.version, abloesezeiten: 'neu' },
        });
      } finally {
        vi.useRealTimers();
      }
    });

    it('Edit-Mode: zwei Tipps innerhalb 1 s → nur eine Mutation (Debounce-Coalescing)', async () => {
      vi.useFakeTimers();
      try {
        mocks.updateMutation.mutateAsync = vi.fn().mockResolvedValue({ ...POSTEN_MIT_ABLOESE, version: 5, abloesezeiten: 'AB' });

        setup({ mode: 'edit', posten: POSTEN_MIT_ABLOESE });
        const textarea = screen.getByTestId('sicherungsposten-abloesezeiten') as HTMLTextAreaElement;

        fireEvent.change(textarea, { target: { value: 'A' } });
        await act(async () => {
          await vi.advanceTimersByTimeAsync(500);
        });
        fireEvent.change(textarea, { target: { value: 'AB' } });
        // Coalescing-Window läuft erst jetzt 2 s ab
        await act(async () => {
          await vi.advanceTimersByTimeAsync(2000);
        });

        expect(mocks.updateMutation.mutateAsync).toHaveBeenCalledTimes(1);
        expect(mocks.updateMutation.mutateAsync).toHaveBeenCalledWith({
          postenId: POSTEN_MIT_ABLOESE.id,
          body: { expectedVersion: POSTEN_MIT_ABLOESE.version, abloesezeiten: 'AB' },
        });
      } finally {
        vi.useRealTimers();
      }
    });

    it('Edit-Mode: 409-Konflikt → Banner + Auto-Save-Badge „Konflikt", weitere Tipps lösen keine Mutation aus', async () => {
      vi.useFakeTimers();
      try {
        const conflict = new SicherungspostenConflictErrorMock(9, 4, undefined);
        mocks.updateMutation.mutateAsync = vi.fn().mockRejectedValue(conflict);

        setup({ mode: 'edit', posten: POSTEN_MIT_ABLOESE });
        const textarea = screen.getByTestId('sicherungsposten-abloesezeiten') as HTMLTextAreaElement;

        fireEvent.change(textarea, { target: { value: 'konflikt-tick-1' } });
        await act(async () => {
          await vi.advanceTimersByTimeAsync(2000);
        });

        expect(screen.getByTestId('sicherungsposten-drawer-conflict-banner')).toBeInTheDocument();
        expect(mocks.updateMutation.mutateAsync).toHaveBeenCalledTimes(1);

        const badge = screen.getByTestId('sicherungsposten-abloesezeiten-autosave-status');
        expect(badge).toHaveTextContent('Konflikt — bitte neu laden');

        // Weitere Tipps → kein neuer Save-Versuch
        fireEvent.change(textarea, { target: { value: 'konflikt-tick-2' } });
        await act(async () => {
          await vi.advanceTimersByTimeAsync(2500);
        });
        expect(mocks.updateMutation.mutateAsync).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it('Edit-Mode: Drawer-Close mit dirty Draft → flushNow läuft vor Schließen, Mutation feuert', async () => {
      vi.useFakeTimers();
      try {
        mocks.updateMutation.mutateAsync = vi.fn().mockResolvedValue({ ...POSTEN_MIT_ABLOESE, version: 5, abloesezeiten: 'flushed' });

        const { onClose } = setup({ mode: 'edit', posten: POSTEN_MIT_ABLOESE });
        const textarea = screen.getByTestId('sicherungsposten-abloesezeiten') as HTMLTextAreaElement;

        fireEvent.change(textarea, { target: { value: 'flushed' } });
        // Direkt Close vor Debounce-Ablauf
        const cancelButton = screen.getByRole('button', { name: 'Abbrechen' });
        await act(async () => {
          fireEvent.click(cancelButton);
          // Microtasks für flushNow + onClose abarbeiten
          await vi.advanceTimersByTimeAsync(0);
        });

        expect(mocks.updateMutation.mutateAsync).toHaveBeenCalledTimes(1);
        expect(mocks.updateMutation.mutateAsync).toHaveBeenCalledWith({
          postenId: POSTEN_MIT_ABLOESE.id,
          body: { expectedVersion: POSTEN_MIT_ABLOESE.version, abloesezeiten: 'flushed' },
        });
        expect(onClose).toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it('Create-Mode: Textarea gerendert, KEIN Auto-Save-Badge, Footer-Submit überträgt Wert via CreateDto', async () => {
      const user = userEvent.setup();
      mocks.createMutation.mutateAsync = vi.fn().mockResolvedValue({ id: 'posten-new', version: 1 });

      setup({ mode: 'create' });

      const textarea = screen.getByTestId('sicherungsposten-abloesezeiten') as HTMLTextAreaElement;
      expect(textarea).toBeInTheDocument();

      // Im Create-Mode darf das Auto-Save-Badge nicht erscheinen
      expect(screen.queryByTestId('sicherungsposten-abloesezeiten-autosave-status')).not.toBeInTheDocument();

      await user.type(screen.getByTestId('sicherungsposten-bezeichnung'), 'Posten Mitte');
      await user.type(screen.getByTestId('sicherungsposten-standort-text'), 'Hauptzelt');
      await user.type(textarea, 'CreateZeit');

      await user.click(screen.getByTestId('sicherungsposten-drawer-submit'));

      await waitFor(() => {
        expect(mocks.createMutation.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ abloesezeiten: 'CreateZeit' }));
      });
    });

    it('Edit-Mode: identischer Wert in Folge → keine erneute Mutation (hasChanges-Filter)', async () => {
      vi.useFakeTimers();
      try {
        mocks.updateMutation.mutateAsync = vi.fn().mockResolvedValue({ ...POSTEN_MIT_ABLOESE, version: 5, abloesezeiten: 'neu' });

        setup({ mode: 'edit', posten: POSTEN_MIT_ABLOESE });
        const textarea = screen.getByTestId('sicherungsposten-abloesezeiten') as HTMLTextAreaElement;

        fireEvent.change(textarea, { target: { value: 'neu' } });
        await act(async () => {
          await vi.advanceTimersByTimeAsync(2000);
        });
        expect(mocks.updateMutation.mutateAsync).toHaveBeenCalledTimes(1);

        // Selber Wert nochmal „eingeben" — kein Diff, kein Save
        fireEvent.change(textarea, { target: { value: 'neu' } });
        await act(async () => {
          await vi.advanceTimersByTimeAsync(2500);
        });

        expect(mocks.updateMutation.mutateAsync).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
