/**
 * Spec für `VorfallMeldenDrawer` (Story 5.1, AC10).
 *
 * Schwerpunkte:
 * - Pflichtfeld-Validation (Was, Wann, einheitId).
 * - Wo-Toggle Coordinate ↔ Freitext.
 * - Beteiligte-Mix (User + Freitext).
 * - Cmd+Enter-Submit.
 * - 422-Fehler mit context.field → Inline-Field-Error.
 * - 403-Fehler → Inline-Toast-Text.
 * - kontextSnapshot ist nicht im Form (Story-5.1-Stub).
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockReport = vi.fn();
const { mockToastSuccess } = vi.hoisted(() => ({
  mockToastSuccess: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
  },
}));

const mockFindAllEinsatzPersonen = vi.fn(() => Promise.resolve({ data: [] as Array<{ id: string; vorname: string; nachname: string; funkrufname: string | null }> }));

vi.mock('@/shared', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/shared');
  return {
    ...actual,
    api: {
      eigenschutz: () => ({
        eigenschutzVorfallControllerReportVorfallVAlpha: mockReport,
      }),
      einsatzPersonen: () => ({
        einsatzPersonenControllerFindAllVAlpha: mockFindAllEinsatzPersonen,
      }),
    },
  };
});

const mockEinheitenState = {
  data: [
    { id: 'clw3h8x9y0000qwertyui05002', einsatzId: 'einsatz-1', name: 'RTW 1', typ: 'TRUPP' },
    { id: 'clw3h8x9y0000qwertyui05003', einsatzId: 'einsatz-1', name: 'SEG-Behandlung', typ: 'GRUPPE' },
  ] as Array<{ id: string; einsatzId: string; name: string; typ: string }>,
  isLoading: false,
  isError: false,
};

vi.mock('@/features/kraefte/api/use-einsatz-einheiten', () => ({
  useEinsatzEinheiten: () => mockEinheitenState,
}));

vi.mock('@/features/kraefte/ui/molecules', () => ({
  EinheitCombobox: ({ value, onChange, disabled, label }: { value: string; onChange: (id: string) => void; disabled?: boolean; label?: string }) => {
    const data = mockEinheitenState.data;
    if (data.length === 0) {
      return (
        <div>
          <span>{label}</span>
          <p>Dieser Einsatz hat keine Einheiten.</p>
        </div>
      );
    }
    return (
      <div>
        <span>{label}</span>
        <select aria-label="Einheit" data-testid="vorfall-einheit-picker-select" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
          <option value="">— bitte wählen —</option>
          {data.map((einheit) => (
            <option key={einheit.id} value={einheit.id}>
              {einheit.name}
            </option>
          ))}
        </select>
      </div>
    );
  },
}));

import { VorfallMeldenDrawer } from '../VorfallMeldenDrawer';

const VORFALL_DTO = {
  id: 'vorfall-1',
  einsatzId: 'einsatz-1',
  einheitId: 'clw3h8x9y0000qwertyui05002',
  vorfallZeit: '2026-05-06T10:00:00.000Z',
  wann: '2026-05-06T10:00:00.000Z',
  was: 'Sturz',
  wo: null,
  beteiligte: [],
  massnahmen: '',
  unfallkasseRelevant: false,
  erfasstAm: '2026-05-06T10:00:00.000Z',
  erfasstVonUserId: 'user-1',
  kontextSnapshot: {},
  gefBeurteilungVersionId: null,
};

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const VALID_EINHEIT = 'clw3h8x9y0000qwertyui05002';

beforeEach(() => {
  mockReport.mockReset();
  mockToastSuccess.mockReset();
});

describe('VorfallMeldenDrawer (Story 5.1)', () => {
  it('rendert Drawer mit Pflichtfeldern Was und Wann', () => {
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <VorfallMeldenDrawer einsatzId="einsatz-1" einheitId={VALID_EINHEIT} open={true} onClose={() => {}} />
      </Wrapper>,
    );

    expect(screen.getByTestId('vorfall-melden-drawer')).toBeInTheDocument();
    expect(screen.getByTestId('vorfall-was-input')).toHaveAttribute('aria-required', 'true');
    expect(screen.getByTestId('vorfall-wann-input')).toHaveAttribute('aria-required', 'true');
  });

  it('disabled Submit-Button solange Was leer', async () => {
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <VorfallMeldenDrawer einsatzId="einsatz-1" einheitId={VALID_EINHEIT} open={true} onClose={() => {}} />
      </Wrapper>,
    );

    const submit = screen.getByTestId('vorfall-submit') as HTMLButtonElement;
    expect(submit).toBeDisabled();

    const user = userEvent.setup();
    await user.type(screen.getByTestId('vorfall-was-input'), 'Sturz');
    expect(submit).not.toBeDisabled();
  });

  it('rendert Inline-Picker wenn keine aktive Einheit gesetzt — Submit erst nach Auswahl freigeschaltet', async () => {
    mockReport.mockResolvedValue({ data: VORFALL_DTO });
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <VorfallMeldenDrawer einsatzId="einsatz-1" einheitId={null} open={true} onClose={() => {}} />
      </Wrapper>,
    );

    expect(screen.getByTestId('vorfall-einheit-picker')).toBeInTheDocument();
    expect(screen.queryByTestId('vorfall-einheit-error')).not.toBeInTheDocument();

    const submit = screen.getByTestId('vorfall-submit') as HTMLButtonElement;
    const user = userEvent.setup();
    await user.type(screen.getByTestId('vorfall-was-input'), 'Sturz');
    expect(submit).toBeDisabled();

    await user.selectOptions(screen.getByTestId('vorfall-einheit-picker-select'), VALID_EINHEIT);
    expect(submit).not.toBeDisabled();

    await user.click(submit);
    await waitFor(() => expect(mockReport).toHaveBeenCalled());
    expect(mockReport.mock.calls[0][0].reportVorfallDto.einheitId).toBe(VALID_EINHEIT);
  });

  it('zeigt Empty-Hint im Picker wenn der Einsatz keine Einheiten hat', () => {
    const original = mockEinheitenState.data;
    mockEinheitenState.data = [];
    try {
      const Wrapper = makeWrapper();
      render(
        <Wrapper>
          <VorfallMeldenDrawer einsatzId="einsatz-1" einheitId={null} open={true} onClose={() => {}} />
        </Wrapper>,
      );

      expect(screen.getByTestId('vorfall-einheit-picker')).toBeInTheDocument();
      expect(screen.getByText(/keine Einheiten/i)).toBeInTheDocument();
      expect(screen.getByTestId('vorfall-submit')).toBeDisabled();
    } finally {
      mockEinheitenState.data = original;
    }
  });

  it('Wo-Toggle zeigt Coordinate-Inputs', async () => {
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <VorfallMeldenDrawer einsatzId="einsatz-1" einheitId={VALID_EINHEIT} open={true} onClose={() => {}} />
      </Wrapper>,
    );

    const user = userEvent.setup();
    await user.click(screen.getByTestId('vorfall-wo-mode-coordinate'));
    expect(screen.getByTestId('vorfall-wo-coordinate-section')).toBeInTheDocument();
    expect(screen.getByTestId('vorfall-wo-longitude')).toBeInTheDocument();

    await user.click(screen.getByTestId('vorfall-wo-mode-freitext'));
    expect(screen.getByTestId('vorfall-wo-freitext')).toBeInTheDocument();
  });

  it('Beteiligte-Mix kann User + Freitext-Rows hinzufügen und entfernen', async () => {
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <VorfallMeldenDrawer einsatzId="einsatz-1" einheitId={VALID_EINHEIT} open={true} onClose={() => {}} />
      </Wrapper>,
    );

    const user = userEvent.setup();
    await user.click(screen.getByTestId('vorfall-beteiligter-add-user'));
    await user.click(screen.getByTestId('vorfall-beteiligter-add-freitext'));

    expect(screen.getAllByTestId(/^vorfall-beteiligter-row-/)).toHaveLength(2);
  });

  it('Submit ruft useReportVorfall mit korrekten Body-Feldern (kontextSnapshot NICHT im Body — Backend-Stub)', async () => {
    mockReport.mockResolvedValue({ data: VORFALL_DTO });
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <VorfallMeldenDrawer einsatzId="einsatz-1" einheitId={VALID_EINHEIT} open={true} onClose={onClose} onSuccess={onSuccess} />
      </Wrapper>,
    );

    const user = userEvent.setup();
    await user.type(screen.getByTestId('vorfall-was-input'), 'Sturz');
    await user.click(screen.getByTestId('vorfall-unfallkasse-checkbox'));
    await user.click(screen.getByTestId('vorfall-submit'));

    await waitFor(() => expect(mockReport).toHaveBeenCalled());
    const call = mockReport.mock.calls[0][0];
    expect(call.einsatzId).toBe('einsatz-1');
    expect(call.reportVorfallDto.einheitId).toBe(VALID_EINHEIT);
    expect(call.reportVorfallDto.was).toBe('Sturz');
    expect(call.reportVorfallDto.unfallkasseRelevant).toBe(true);
    expect(call.reportVorfallDto.beteiligte).toEqual([]);
    expect(call.reportVorfallDto.wo).toBeNull();
    expect(call.reportVorfallDto).not.toHaveProperty('kontextSnapshot');

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it('422 mit context.field=wo zeigt Field-Error inline', async () => {
    mockReport.mockRejectedValue({ response: { status: 422, data: { context: { rule: 'ValidationFailed', field: 'wo' } } } });
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <VorfallMeldenDrawer einsatzId="einsatz-1" einheitId={VALID_EINHEIT} open={true} onClose={() => {}} />
      </Wrapper>,
    );

    const user = userEvent.setup();
    await user.type(screen.getByTestId('vorfall-was-input'), 'Sturz');
    await user.click(screen.getByTestId('vorfall-wo-mode-freitext'));
    await user.type(screen.getByTestId('vorfall-wo-freitext'), 'Halle 3');
    await user.click(screen.getByTestId('vorfall-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('vorfall-wo-error')).toBeInTheDocument();
    });
  });

  it('403 zeigt Inline-Toast-Text mit Permission-Hinweis', async () => {
    mockReport.mockRejectedValue({ response: { status: 403 } });
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <VorfallMeldenDrawer einsatzId="einsatz-1" einheitId={VALID_EINHEIT} open={true} onClose={() => {}} />
      </Wrapper>,
    );

    const user = userEvent.setup();
    await user.type(screen.getByTestId('vorfall-was-input'), 'Sturz');
    await user.click(screen.getByTestId('vorfall-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('vorfall-error-text')).toHaveTextContent(/Berechtigung/);
    });
  });

  it('Cmd+Enter triggert Submit', async () => {
    mockReport.mockResolvedValue({ data: VORFALL_DTO });
    const onSuccess = vi.fn();
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <VorfallMeldenDrawer einsatzId="einsatz-1" einheitId={VALID_EINHEIT} open={true} onClose={() => {}} onSuccess={onSuccess} />
      </Wrapper>,
    );

    const user = userEvent.setup();
    await user.type(screen.getByTestId('vorfall-was-input'), 'Sturz');
    await user.keyboard('{Meta>}{Enter}{/Meta}');

    await waitFor(() => expect(mockReport).toHaveBeenCalled());
  });

  it('Was-Counter zeigt 80er-Cap', async () => {
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <VorfallMeldenDrawer einsatzId="einsatz-1" einheitId={VALID_EINHEIT} open={true} onClose={() => {}} />
      </Wrapper>,
    );

    expect(screen.getByTestId('vorfall-was-counter')).toHaveTextContent('0/80');
  });

  it('Maßnahmen-Textarea akzeptiert bis 4000 Zeichen', () => {
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <VorfallMeldenDrawer einsatzId="einsatz-1" einheitId={VALID_EINHEIT} open={true} onClose={() => {}} />
      </Wrapper>,
    );

    expect(screen.getByTestId('vorfall-massnahmen-input')).toHaveAttribute('maxlength', '4000');
  });

  it('Shift+Enter in der Maßnahmen-Textarea erzeugt eine neue Zeile und submitet nicht', async () => {
    mockReport.mockResolvedValue({ data: VORFALL_DTO });
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <VorfallMeldenDrawer einsatzId="einsatz-1" einheitId={VALID_EINHEIT} open={true} onClose={() => {}} />
      </Wrapper>,
    );

    const user = userEvent.setup();
    const massnahmen = screen.getByTestId('vorfall-massnahmen-input') as HTMLTextAreaElement;
    await user.click(massnahmen);
    await user.keyboard('Erste Zeile{Shift>}{Enter}{/Shift}zweite Zeile');

    expect(massnahmen.value).toBe('Erste Zeile\nzweite Zeile');
    expect(mockReport).not.toHaveBeenCalled();
  });

  it('Drawer ist nicht gerendert wenn open=false', () => {
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <VorfallMeldenDrawer einsatzId="einsatz-1" einheitId={VALID_EINHEIT} open={false} onClose={() => {}} />
      </Wrapper>,
    );

    expect(screen.queryByTestId('vorfall-melden-drawer')).not.toBeInTheDocument();
  });
});
