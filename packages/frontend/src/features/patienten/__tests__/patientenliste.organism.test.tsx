import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createElement, type ReactNode } from 'react';

// `@tanstack/react-virtual` misst im JSDOM 0×0 und rendert deshalb keine
// Items. Für Unit-Tests stubben wir `useVirtualizer` so, dass alle Indexes
// linear gerendert werden — wir testen das Filter-/Sort-Verhalten der
// Organism, nicht die Virtualisierung selbst.
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (config: { count: number; estimateSize: () => number }) => {
    const rowSize = config.estimateSize();
    const virtualRows = Array.from({ length: config.count }, (_, index) => ({ index, start: index * rowSize, end: (index + 1) * rowSize, size: rowSize, key: String(index) }));
    return {
      getVirtualItems: () => virtualRows,
      getTotalSize: () => config.count * rowSize,
      scrollToIndex: () => {},
      measure: () => {},
    };
  },
}));

const listApiSpy = vi.fn();

vi.mock('@/shared', () => ({
  api: {
    patienten: () => ({
      patientenControllerListVAlpha: listApiSpy,
    }),
  },
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

const { PatientenListe } = await import('../ui/patientenliste.organism');

function buildPatient(idx: number) {
  return {
    id: `pat_${idx}`,
    patientennummer: `P-${String(idx + 1).padStart(3, '0')}`,
    diviVakNummer: null,
    name: null,
    aktuelleSk: 'SK_II',
    behandlungsstatus: 'IN_BEHANDLUNG',
    transportstatus: 'WARTEND',
    erfasstAm: new Date(Date.UTC(2026, 4, 20, 10, idx, 0)).toISOString(),
    eventVersion: 1,
  };
}

function buildResponse(opts: { count?: number; page?: number; pageSize?: number; total?: number } = {}) {
  const count = opts.count ?? 3;
  const items = Array.from({ length: count }, (_, i) => buildPatient(i));
  return {
    data: items,
    pagination: {
      page: opts.page ?? 1,
      pageSize: opts.pageSize ?? 50,
      total: opts.total ?? count,
      totalPages: Math.ceil((opts.total ?? count) / (opts.pageSize ?? 50)),
    },
  };
}

function buildWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('PatientenListe organism (Story 1.6)', () => {
  beforeEach(() => {
    listApiSpy.mockReset();
  });

  it('rendert Toolbar + Pagination + Rows aus dem Hook', async () => {
    listApiSpy.mockResolvedValue(buildResponse());
    const onFiltersChange = vi.fn();

    render(<PatientenListe einsatzId="ein_1" filters={{}} onFiltersChange={onFiltersChange} />, { wrapper: buildWrapper() });

    await waitFor(() => expect(screen.getAllByTestId(/patient-list-row-pat_/).length).toBeGreaterThan(0));
    expect(screen.getByTestId('patienten-liste-pagesize-select')).toBeInTheDocument();
    expect(screen.getByTestId('patienten-liste-sort-select')).toBeInTheDocument();
  });

  it('rendert EmptyState "Keine Patienten passen zum Filter" mit Reset-CTA, wenn Filter aktiv und total=0', async () => {
    listApiSpy.mockResolvedValue(buildResponse({ count: 0, total: 0 }));
    const onFiltersChange = vi.fn();

    render(<PatientenListe einsatzId="ein_1" filters={{ sk: ['SK_I'] as never, search: 'Nope' }} onFiltersChange={onFiltersChange} />, { wrapper: buildWrapper() });

    await waitFor(() => expect(screen.getByText(/Keine Patienten passen zum Filter/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Filter zurücksetzen/i }));
    expect(onFiltersChange).toHaveBeenCalledTimes(1);
    const call = onFiltersChange.mock.calls[0][0];
    expect(call.sk).toBeUndefined();
    expect(call.search).toBeUndefined();
    expect(call.behandlungsstatus).toBeUndefined();
    expect(call.transportstatus).toBeUndefined();
  });

  it('rendert Pure-Empty-State, wenn keine Filter aktiv und total=0', async () => {
    listApiSpy.mockResolvedValue(buildResponse({ count: 0, total: 0 }));
    const onFiltersChange = vi.fn();

    render(<PatientenListe einsatzId="ein_1" filters={{}} onFiltersChange={onFiltersChange} />, { wrapper: buildWrapper() });

    await waitFor(() => expect(screen.getByText(/Noch keine Patienten erfasst/i)).toBeInTheDocument());
  });

  it('entfernt einen SK-Filter beim Klick auf den Filter-Pill ×-Button', async () => {
    listApiSpy.mockResolvedValue(buildResponse());
    const onFiltersChange = vi.fn();

    render(<PatientenListe einsatzId="ein_1" filters={{ sk: ['SK_I', 'SK_II'] as never }} onFiltersChange={onFiltersChange} />, { wrapper: buildWrapper() });

    await waitFor(() => expect(screen.getByTestId('patienten-liste-filter-pills')).toBeInTheDocument());
    const pill = screen.getByRole('button', { name: 'Filter entfernen: SK: SK I' });
    fireEvent.click(pill);

    expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ sk: ['SK_II'], page: 1 }));
  });

  it('ändert Sort-Werte über das Dropdown', async () => {
    listApiSpy.mockResolvedValue(buildResponse());
    const onFiltersChange = vi.fn();

    render(<PatientenListe einsatzId="ein_1" filters={{}} onFiltersChange={onFiltersChange} />, { wrapper: buildWrapper() });

    await waitFor(() => expect(screen.getByTestId('patienten-liste-sort-select')).toBeInTheDocument());
    fireEvent.change(screen.getByTestId('patienten-liste-sort-select'), { target: { value: 'zeit:desc' } });

    expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ sortBy: 'zeit', sortDir: 'desc', page: 1 }));
  });

  it('navigiert per Pagination-Buttons', async () => {
    listApiSpy.mockResolvedValue(buildResponse({ count: 50, total: 250, page: 2, pageSize: 50 }));
    const onFiltersChange = vi.fn();

    render(<PatientenListe einsatzId="ein_1" filters={{ page: 2 }} onFiltersChange={onFiltersChange} />, { wrapper: buildWrapper() });

    await waitFor(() => expect(screen.getByTestId('patienten-liste-prev-page')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('patienten-liste-prev-page'));
    expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));

    onFiltersChange.mockClear();
    fireEvent.click(screen.getByTestId('patienten-liste-next-page'));
    expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ page: 3 }));
  });

  it('rendert den /-Hint sichtbar in der Toolbar (Hotkey-Wiring via react-hotkeys-hook ist Smoke-Test)', async () => {
    listApiSpy.mockResolvedValue(buildResponse());
    const onFiltersChange = vi.fn();

    render(<PatientenListe einsatzId="ein_1" filters={{}} onFiltersChange={onFiltersChange} />, { wrapper: buildWrapper() });

    await waitFor(() => expect(screen.getByText(/fokussiert die Suche/i)).toBeInTheDocument());
    // Der eigentliche Focus-Effekt ist in JSDOM nicht zuverlässig prüfbar (react-hotkeys-hook
    // hängt am `document`-Listener und kollidiert mit dem virtualisierten Container);
    // manuelle Verifikation siehe AC11 in der Dev-Browser-Checklist.
  });

  it('ruft onRowClick mit patient.id', async () => {
    listApiSpy.mockResolvedValue(buildResponse({ count: 1 }));
    const onRowClick = vi.fn();
    const onFiltersChange = vi.fn();

    render(<PatientenListe einsatzId="ein_1" filters={{}} onFiltersChange={onFiltersChange} onRowClick={onRowClick} />, { wrapper: buildWrapper() });

    await waitFor(() => expect(screen.getByTestId('patient-list-row-pat_0')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('patient-list-row-pat_0'));
    expect(onRowClick).toHaveBeenCalledWith('pat_0');
  });
});
