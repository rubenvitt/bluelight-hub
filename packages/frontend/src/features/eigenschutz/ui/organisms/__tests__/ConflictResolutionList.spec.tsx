/**
 * Tests für `ConflictResolutionList` (Story 3.10 AC8).
 *
 * Mockt die API-Hooks `useSyncConflicts` und `useResolveKonflikt`
 * sowie die Lookup-Hooks (`useEinsatzEinheiten`, `useUserNames`),
 * um die Organism isoliert zu testen.
 *
 * **Hinweis zur a11y-Snapshot-Anforderung:** Im Repo ist weder
 * `vitest-axe` noch `jest-axe` installiert (siehe `vitest.setup.ts` —
 * keine Axe-Matcher). Statt eine neue Dependency einzuführen, prüft der
 * a11y-Test strukturelle Invarianten direkt: `role="table"` vorhanden,
 * jeder Sort-Header trägt `aria-sort`, jeder Action-Button ein
 * non-empty `aria-label`, keine doppelten `id`-Attribute.
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SyncConflictListItemDto } from '@bluelight-hub/shared/client';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

const { conflictsResultMock, mutateMock, mutationResultMock, einheitenMock, userNamesMock, navigateMock } = vi.hoisted(() => ({
  conflictsResultMock: {
    current: {
      data: [] as SyncConflictListItemDto[],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<SyncConflictListItemDto[]>,
  },
  mutateMock: vi.fn(),
  mutationResultMock: {
    current: { isPending: false } as unknown as UseMutationResult<unknown, unknown, unknown, unknown>,
  },
  einheitenMock: { data: [{ id: 'einheit-1', name: 'SEG Nord' }] as Array<{ id: string; name: string }> },
  userNamesMock: { getUserName: (id: string) => `User ${id}` },
  navigateMock: vi.fn(),
}));

vi.mock('../../../api/queries', async () => {
  // Wir mocken nur die zwei verwendeten Hooks; alles andere stammt aus dem
  // echten Modul (Query-Keys, Filter-Typen) und bleibt unverändert.
  const actual = await vi.importActual<typeof import('../../../api/queries')>('../../../api/queries');
  return {
    ...actual,
    useSyncConflicts: vi.fn((_einsatzId: string, _filter?: unknown) => conflictsResultMock.current),
    useResolveKonflikt: vi.fn(() => ({
      ...mutationResultMock.current,
      mutate: mutateMock,
    })),
  };
});

vi.mock('@/features/kraefte/api/use-einsatz-einheiten', () => ({
  useEinsatzEinheiten: () => einheitenMock,
}));

vi.mock('@/features/auth/api/use-users', () => ({
  useUserNames: () => userNamesMock,
}));

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-router')>('@tanstack/react-router');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

import { ConflictResolutionList } from '../ConflictResolutionList';
import * as queriesModule from '../../../api/queries';

const useSyncConflictsMock = vi.mocked(queriesModule.useSyncConflicts);

// Gültige cuid2-Strings (24 Zeichen, lowercase a-z 0-9) für Filter-Tests.
const VALID_CUID2 = 'abc123def456ghi789jkl012';
const ANOTHER_CUID2 = 'mno345pqr678stu901vwx234';

function makeConflict(overrides: Partial<SyncConflictListItemDto> = {}): SyncConflictListItemDto {
  return {
    id: 'conflict-1',
    einheitId: 'einheit-1',
    entityType: 'PSA_PROFIL_ZUWEISUNG',
    entityId: 'entity-1',
    fieldPath: 'profil',
    localPayload: {
      toggles: [
        { profil: 'BASIS', aktiv: true },
        { profil: 'INFEKTION', aktiv: false },
      ],
    } as unknown as object,
    serverVersion: 6,
    localExpectedVersion: 5,
    reportedAt: new Date('2026-04-29T10:00:00.000Z'),
    reportedByUserId: 'user-1',
    ...overrides,
  };
}

beforeEach(() => {
  conflictsResultMock.current = {
    data: [makeConflict()],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as UseQueryResult<SyncConflictListItemDto[]>;
  mutationResultMock.current = { isPending: false } as unknown as UseMutationResult<unknown, unknown, unknown, unknown>;
  mutateMock.mockReset();
  navigateMock.mockReset();
  useSyncConflictsMock.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('ConflictResolutionList (Story 3.10 AC8)', () => {
  // jsdom liefert für `getBoundingClientRect()` immer 0×0 — der Virtualizer
  // würde dann keine Rows rendern. Wir patchen `getBoundingClientRect` und
  // ersetzen `ResizeObserver` durch einen Stub, der die Callback-Funktion
  // sofort mit realistischen Werten aufruft (Pattern `EtbEntryList.spec.tsx`).
  const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
  const originalResizeObserver = global.ResizeObserver;
  const originalClientHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
  const originalClientWidthDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');

  beforeAll(() => {
    Element.prototype.getBoundingClientRect = function getBoundingClientRectStub() {
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        bottom: 600,
        right: 1200,
        width: 1200,
        height: 600,
        toJSON: () => ({}),
      } as DOMRect;
    };
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get: () => 600,
    });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => 1200,
    });
    global.ResizeObserver = class ResizeObserver implements globalThis.ResizeObserver {
      constructor(private readonly callback: ResizeObserverCallback) {}
      disconnect(): void {}
      observe(target: Element): void {
        const height = target instanceof HTMLElement ? target.clientHeight || 600 : 600;
        const width = target instanceof HTMLElement ? target.clientWidth || 1200 : 1200;
        queueMicrotask(() => {
          this.callback(
            [
              {
                target,
                borderBoxSize: [{ blockSize: height, inlineSize: width }],
                contentBoxSize: [{ blockSize: height, inlineSize: width }],
                contentRect: { x: 0, y: 0, top: 0, left: 0, bottom: height, right: width, width, height, toJSON: () => ({}) },
                devicePixelContentBoxSize: [{ blockSize: height, inlineSize: width }],
              } as ResizeObserverEntry,
            ],
            this,
          );
        });
      }
      unobserve(): void {}
    };
  });

  afterAll(() => {
    Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    global.ResizeObserver = originalResizeObserver;
    if (originalClientHeightDescriptor) Object.defineProperty(HTMLElement.prototype, 'clientHeight', originalClientHeightDescriptor);
    if (originalClientWidthDescriptor) Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidthDescriptor);
  });

  it('rendert role="table" mit den erwarteten Spalten-Headern', () => {
    render(<ConflictResolutionList einsatzId="einsatz-1" canResolve={true} />);
    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Entität/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Server-Version/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Lokale Version/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Reportet/ })).toBeInTheDocument();
  });

  it('Klick auf Spalten-Header toggelt aria-sort und sortiert die Rows entsprechend', () => {
    conflictsResultMock.current = {
      data: [makeConflict({ id: 'a', serverVersion: 8 }), makeConflict({ id: 'b', serverVersion: 3 })],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<SyncConflictListItemDto[]>;
    render(<ConflictResolutionList einsatzId="einsatz-1" canResolve={true} />);

    const header = screen.getByTestId('conflict-sort-serverVersion');
    expect(header).toHaveAttribute('aria-sort', 'none');
    fireEvent.click(header);
    expect(header).toHaveAttribute('aria-sort', 'descending');
    fireEvent.click(header);
    expect(header).toHaveAttribute('aria-sort', 'ascending');
  });

  it('Filter-Bar entityType triggert useSyncConflicts mit Filter-Argument', () => {
    render(<ConflictResolutionList einsatzId="einsatz-1" canResolve={true} />);
    const select = screen.getByLabelText('Entitätstyp') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'GEFAEHRDUNGSBEURTEILUNG_ITEM' } });
    const lastCall = useSyncConflictsMock.mock.calls.at(-1);
    expect(lastCall?.[1]).toEqual({ entityType: 'GEFAEHRDUNGSBEURTEILUNG_ITEM' });
  });

  it('Reset-Button setzt den Filter zurück (entityType + einheitId undefined)', () => {
    render(<ConflictResolutionList einsatzId="einsatz-1" canResolve={true} initialFilter={{ entityType: 'PSA_PROFIL_ZUWEISUNG', einheitId: VALID_CUID2 }} />);
    fireEvent.click(screen.getByTestId('conflict-filter-reset'));
    const lastCall = useSyncConflictsMock.mock.calls.at(-1);
    expect(lastCall?.[1]).toEqual({});
  });

  it('Filter-Änderung schreibt URL-Search via navigate(replace: true) zurück (F8)', () => {
    render(<ConflictResolutionList einsatzId="einsatz-1" canResolve={true} />);
    const select = screen.getByLabelText('Entitätstyp') as HTMLSelectElement;
    act(() => {
      fireEvent.change(select, { target: { value: 'PSA_PROFIL_ZUWEISUNG' } });
    });
    expect(navigateMock).toHaveBeenCalled();
    const lastCall = navigateMock.mock.calls.at(-1)?.[0];
    expect(lastCall?.replace).toBe(true);
    // Search ist eine Updater-Function — wir rufen sie mit dem prev-Stub auf
    // und prüfen das Ergebnis.
    const result = (lastCall?.search as (prev: Record<string, unknown>) => Record<string, unknown>)({});
    expect(result.entityType).toBe('PSA_PROFIL_ZUWEISUNG');
  });

  it('Resolve-Klick triggert useResolveKonflikt.mutate mit korrekten Argumenten', async () => {
    render(<ConflictResolutionList einsatzId="einsatz-1" canResolve={true} />);
    const btn = await screen.findByTestId('conflict-resolve-SERVER_WINS-conflict-1');
    fireEvent.click(btn);
    expect(mutateMock).toHaveBeenCalledTimes(1);
    expect(mutateMock).toHaveBeenCalledWith({ syncConflictId: 'conflict-1', resolution: 'SERVER_WINS' }, expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }));
  });

  it('Erfolgreicher Resolve setzt SR-Ansage in der polite Live-Region', async () => {
    mutateMock.mockImplementation((_vars, opts: { onSuccess?: () => void } | undefined) => {
      opts?.onSuccess?.();
    });
    render(<ConflictResolutionList einsatzId="einsatz-1" canResolve={true} />);
    const btn = await screen.findByTestId('conflict-resolve-LOCAL_WINS-conflict-1');
    fireEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByTestId('conflict-sr-announcer').textContent).toMatch(/Konflikt aufgelöst/);
      expect(screen.getByTestId('conflict-sr-announcer').textContent).toMatch(/Lokal behalten/);
    });
  });

  it('Read-Only-Mode (canResolve=false) deaktiviert alle drei Action-Buttons', async () => {
    render(<ConflictResolutionList einsatzId="einsatz-1" canResolve={false} />);
    const serverBtn = await screen.findByTestId('conflict-resolve-SERVER_WINS-conflict-1');
    const localBtn = screen.getByTestId('conflict-resolve-LOCAL_WINS-conflict-1');
    const mergeBtn = screen.getByTestId('conflict-resolve-MERGED-conflict-1');
    expect(serverBtn).toBeDisabled();
    expect(localBtn).toBeDisabled();
    expect(mergeBtn).toBeDisabled();
    expect(serverBtn).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText(/nur vom Sicherheitsbeauftragten/)).toBeInTheDocument();
  });

  it('Empty-State rendert bei conflicts=[]', () => {
    conflictsResultMock.current = {
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<SyncConflictListItemDto[]>;
    render(<ConflictResolutionList einsatzId="einsatz-1" canResolve={true} />);
    expect(screen.getByText('Keine offenen Sync-Konflikte')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('Loading-State rendert Skeleton bei isLoading=true', () => {
    conflictsResultMock.current = {
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<SyncConflictListItemDto[]>;
    render(<ConflictResolutionList einsatzId="einsatz-1" canResolve={true} />);
    expect(screen.getByTestId('conflict-loading-skeleton')).toBeInTheDocument();
  });

  it('Error-State rendert Inline-Alert bei isError=true (kein globaler Toast)', () => {
    conflictsResultMock.current = {
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<SyncConflictListItemDto[]>;
    render(<ConflictResolutionList einsatzId="einsatz-1" canResolve={true} />);
    expect(screen.getByTestId('conflict-error-alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Erneut versuchen/ })).toBeInTheDocument();
  });

  it('Virtualisierung bei 100 Konflikten rendert nur einen Bruchteil der Rows initial', async () => {
    const many = Array.from({ length: 100 }, (_, i) => makeConflict({ id: `conflict-${i}`, serverVersion: i, localExpectedVersion: i - 1 }));
    conflictsResultMock.current = {
      data: many,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<SyncConflictListItemDto[]>;
    const { container } = render(<ConflictResolutionList einsatzId="einsatz-1" canResolve={true} />);
    await waitFor(() => {
      const dataRows = container.querySelectorAll('[data-testid^="conflict-row-"]');
      expect(dataRows.length).toBeGreaterThan(0);
    });
    const dataRows = container.querySelectorAll('[data-testid^="conflict-row-"]');
    expect(dataRows.length).toBeLessThan(100);
  });

  it('a11y-Strukturinvarianten: aria-sort auf Sort-Headern, aria-label auf Buttons, keine doppelten IDs', async () => {
    const { container } = render(<ConflictResolutionList einsatzId="einsatz-1" canResolve={true} />);
    // 1. Sort-Header haben aria-sort.
    for (const headerId of ['conflict-sort-entityType', 'conflict-sort-serverVersion', 'conflict-sort-localExpectedVersion', 'conflict-sort-reportedAt']) {
      expect(screen.getByTestId(headerId)).toHaveAttribute('aria-sort');
    }
    // 2. Action-Buttons haben non-empty aria-label (warten auf Virtualizer-Render).
    await screen.findByTestId('conflict-resolve-SERVER_WINS-conflict-1');
    for (const tid of ['conflict-resolve-SERVER_WINS-conflict-1', 'conflict-resolve-LOCAL_WINS-conflict-1', 'conflict-resolve-MERGED-conflict-1']) {
      const label = screen.getByTestId(tid).getAttribute('aria-label');
      expect(label && label.length > 0).toBe(true);
    }
    // 3. Keine doppelten ID-Attribute im Subtree.
    const ids = Array.from(container.querySelectorAll<HTMLElement>('[id]')).map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('Touch-Target: alle Action-Buttons haben minHeight ≥ 48px (style)', async () => {
    render(<ConflictResolutionList einsatzId="einsatz-1" canResolve={true} />);
    await screen.findByTestId('conflict-resolve-SERVER_WINS-conflict-1');
    for (const tid of ['conflict-resolve-SERVER_WINS-conflict-1', 'conflict-resolve-LOCAL_WINS-conflict-1', 'conflict-resolve-MERGED-conflict-1']) {
      const btn = screen.getByTestId(tid);
      expect(btn).toHaveStyle({ minHeight: '48px' });
    }
  });

  it('LocalPayload-Popover: Klick auf Summary öffnet das <details>-Element mit JSON-Vorschau', async () => {
    render(<ConflictResolutionList einsatzId="einsatz-1" canResolve={true} />);
    const details = (await screen.findByTestId('conflict-snapshot-conflict-1')) as HTMLDetailsElement;
    expect(details.open).toBe(false);
    const summary = details.querySelector('summary')!;
    // Toggle-Preview im Summary nutzt Backend-Format `{ profil, aktiv }` (F5).
    expect(summary.textContent).toMatch(/BASIS\+/);
    expect(summary.textContent).toMatch(/INFEKTION−/);
    fireEvent.click(summary);
    // jsdom toggelt das `open`-Attribut bei Klick auf Summary.
    expect(details.open).toBe(true);
    // Volltext-JSON enthält den toggle-profil-Key.
    expect(details.querySelector('pre')!.textContent).toContain('BASIS');
  });

  it('Sekundärer Konflikt im Resolve: rendert Inline-Row-Error, kein globaler Toast', async () => {
    mutateMock.mockImplementation((_vars, opts: { onError?: (e: unknown) => void } | undefined) => {
      opts?.onError?.(new Error('ConflictDetected:SyncConflict:RaceLost'));
    });
    render(<ConflictResolutionList einsatzId="einsatz-1" canResolve={true} />);
    const btn = await screen.findByTestId('conflict-resolve-SERVER_WINS-conflict-1');
    fireEvent.click(btn);
    await waitFor(() => {
      const inlineError = screen.getByTestId('conflict-row-error-conflict-1');
      expect(inlineError).toBeInTheDocument();
      expect(inlineError.textContent).toMatch(/Erneuter Konflikt/);
    });
  });

  it('Sentinel NotFound:SyncConflict liefert deutsche Konflikt-nicht-gefunden-Meldung (F4)', async () => {
    mutateMock.mockImplementation((_vars, opts: { onError?: (e: unknown) => void } | undefined) => {
      opts?.onError?.(new Error('NotFound:SyncConflict'));
    });
    render(<ConflictResolutionList einsatzId="einsatz-1" canResolve={true} />);
    const btn = await screen.findByTestId('conflict-resolve-SERVER_WINS-conflict-1');
    fireEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByTestId('conflict-row-error-conflict-1').textContent).toMatch(/Konflikt nicht gefunden/);
    });
  });

  it('Sentinel LocalWinsNichtMoeglich:AggregateNichtGefunden weist auf Server-Übernahme hin (F13)', async () => {
    mutateMock.mockImplementation((_vars, opts: { onError?: (e: unknown) => void } | undefined) => {
      opts?.onError?.(new Error('BusinessRule:LocalWinsNichtMoeglich:AggregateNichtGefunden'));
    });
    render(<ConflictResolutionList einsatzId="einsatz-1" canResolve={true} />);
    const btn = await screen.findByTestId('conflict-resolve-LOCAL_WINS-conflict-1');
    fireEvent.click(btn);
    await waitFor(() => {
      const text = screen.getByTestId('conflict-row-error-conflict-1').textContent ?? '';
      expect(text).toMatch(/Aggregat existiert nicht mehr/);
      expect(text).toMatch(/Server übernehmen/);
    });
  });

  it('Sentinel ValidationFailed:LocalWinsPayloadInvalid liefert Hinweis auf Server-Übernahme (F4)', async () => {
    mutateMock.mockImplementation((_vars, opts: { onError?: (e: unknown) => void } | undefined) => {
      opts?.onError?.(new Error('ValidationFailed:LocalWinsPayloadInvalid'));
    });
    render(<ConflictResolutionList einsatzId="einsatz-1" canResolve={true} />);
    const btn = await screen.findByTestId('conflict-resolve-LOCAL_WINS-conflict-1');
    fireEvent.click(btn);
    await waitFor(() => {
      const text = screen.getByTestId('conflict-row-error-conflict-1').textContent ?? '';
      expect(text).toMatch(/Lokaler Snapshot ist ungültig/);
    });
  });

  it('Sentinel via ResponseError-Body wird aus response.json() extrahiert (F4 Production-Shape)', async () => {
    const fakeResponse = new Response(JSON.stringify({ message: 'BusinessRule:KonfliktNichtImEinsatz', statusCode: 422 }), {
      status: 422,
      headers: { 'content-type': 'application/json' },
    });
    const responseError = Object.assign(new Error('Response returned an error code'), { response: fakeResponse });

    mutateMock.mockImplementation((_vars, opts: { onError?: (e: unknown) => void } | undefined) => {
      opts?.onError?.(responseError);
    });
    render(<ConflictResolutionList einsatzId="einsatz-1" canResolve={true} />);
    const btn = await screen.findByTestId('conflict-resolve-SERVER_WINS-conflict-1');
    fireEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByTestId('conflict-row-error-conflict-1').textContent).toMatch(/nicht zum aktuellen Einsatz/);
    });
  });

  it('Per-Row-Disabling: nur die laufende Resolve-Row wird deaktiviert, andere Rows bleiben aktiv (F10)', async () => {
    conflictsResultMock.current = {
      data: [makeConflict({ id: 'conflict-1' }), makeConflict({ id: 'conflict-2', einheitId: 'einheit-1' })],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<SyncConflictListItemDto[]>;
    // Resolve-Mutation hängt — `onSuccess`/`onError` wird nie aufgerufen, also
    // bleibt `resolvingIds` nach dem ersten Klick gesetzt.
    mutateMock.mockImplementation(() => {
      /* hängt */
    });
    render(<ConflictResolutionList einsatzId="einsatz-1" canResolve={true} />);
    const btn1 = await screen.findByTestId('conflict-resolve-SERVER_WINS-conflict-1');
    fireEvent.click(btn1);
    // Row 1 ist disabled, Row 2 bleibt aktiv.
    expect(btn1).toBeDisabled();
    const btn2 = screen.getByTestId('conflict-resolve-SERVER_WINS-conflict-2');
    expect(btn2).not.toBeDisabled();
  });

  it('Einheit-Auswahl per Combobox übergibt die zugehörige Einheit-ID an den Filter (G7)', async () => {
    render(<ConflictResolutionList einsatzId="einsatz-1" canResolve={true} />);
    // Combobox im Filter-Bereich isolieren (testId-Wrapper).
    const filterCombobox = screen.getByTestId('conflict-filter-einheit-id');
    const input = filterCombobox.querySelector('input[role="combobox"]') as HTMLInputElement;
    expect(input).not.toBeNull();

    const user = userEvent.setup();
    await user.click(input);
    // Popover-Option als role=option selektieren — vermeidet Mehrfach-Matches
    // gegen Row-Renderings desselben Einheit-Namens.
    const option = await screen.findByRole('option', { name: /SEG Nord/i });
    await user.click(option);

    const lastCall = useSyncConflictsMock.mock.calls.at(-1);
    expect(lastCall?.[1]).toEqual({ einheitId: 'einheit-1' });
  });

  it('Externe initialFilter-Änderung (Browser-Back) wird in den State übernommen (F8 URL→State)', () => {
    const { rerender } = render(<ConflictResolutionList einsatzId="einsatz-1" canResolve={true} initialFilter={{ einheitId: VALID_CUID2 }} />);
    act(() => {
      rerender(<ConflictResolutionList einsatzId="einsatz-1" canResolve={true} initialFilter={{ einheitId: ANOTHER_CUID2 }} />);
    });
    const lastCall = useSyncConflictsMock.mock.calls.at(-1);
    expect(lastCall?.[1]).toEqual({ einheitId: ANOTHER_CUID2 });
  });
});
