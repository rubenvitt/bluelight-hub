import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { ReactElement } from 'react';
import { PATIENT_QUERY_KEYS } from '../api/queries';

const fetchSpy = vi.fn();
const erfassePatientApiSpy = vi.fn();

// Wir mocken `@/shared` mit einer minimalen Stub-API: der Mutation-Hook
// (`use-erfasse-patient.ts`) importiert `api` und `ResponseError`. Das genügt.
vi.mock('@/shared', () => ({
  api: {
    patienten: () => ({
      patientenControllerErfassePatientVAlpha: erfassePatientApiSpy,
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

// Form muss NACH dem vi.mock importiert werden, sonst zieht es den echten `@/shared`.
const { ErfassePatientForm } = await import('../ui/erfasse-patient-form');

function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
  const utils = render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  return { ...utils, queryClient, invalidateSpy };
}

describe('ErfassePatientForm (Story 1.2 AC5)', () => {
  const originalFetch = globalThis.fetch;
  const swallowUnhandled = (_reason: unknown) => {
    // TanStack-Query propagiert in `mutateAsync` rejected Promises auch dann,
    // wenn die UI sie über `mutation.isError` rendert — dadurch entsteht im
    // Reject-Test ein „Unhandled Rejection"-Lärm-Event. Wir schlucken es
    // gezielt während der Test-Suite.
  };

  beforeEach(() => {
    fetchSpy.mockReset();
    erfassePatientApiSpy.mockReset();
    // Globaler fetch wird durch Spy ersetzt — so können wir verifizieren,
    // dass die Komponente NICHT direkt fetch() aufruft (AC5).
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    process.on('unhandledRejection', swallowUnhandled);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.off('unhandledRejection', swallowUnhandled);
  });

  it('Happy-Path: ruft den generierten API-Hook auf und ruft NICHT direkt fetch()', async () => {
    erfassePatientApiSpy.mockResolvedValue({
      data: {
        id: 'pat-1',
        einsatzId: 'einsatz-1',
        patientennummer: 'P-001',
        aktuelleSk: 'SK_II',
        behandlungsstatus: 'UNVERSORGT',
        transportstatus: 'WARTEND',
        erfasstAm: '2026-05-19T10:00:00.000Z',
        erfasserRef: { type: 'user', userId: 'user-1' },
        eventVersion: 1,
      },
    });

    const { invalidateSpy } = renderWithProviders(<ErfassePatientForm einsatzId="einsatz-1" />);

    fireEvent.click(screen.getByTestId('sk-selector-pill-SK_II'));
    fireEvent.click(screen.getByRole('button', { name: /patient erfassen/i }));

    await waitFor(() => expect(erfassePatientApiSpy).toHaveBeenCalledTimes(1));

    expect(erfassePatientApiSpy).toHaveBeenCalledWith({
      einsatzId: 'einsatz-1',
      erfassePatientDto: {
        initialeSk: 'SK_II',
        diviVakNummer: undefined,
        notiz: undefined,
      },
    });

    // Kein direkter fetch()-Call (NFR-I3 / AC5)
    expect(fetchSpy).not.toHaveBeenCalled();

    // Erfolg → Inline-Confirmation-Pill (kein Toast)
    await waitFor(() => {
      expect(screen.getByTestId('erfasse-patient-confirmation')).toHaveTextContent(/P-001/);
    });

    // onSuccess invalidiert list + kpis Query-Keys
    const invalidatedKeys = invalidateSpy.mock.calls.map((call) => call[0]?.queryKey);
    expect(invalidatedKeys).toEqual(expect.arrayContaining([PATIENT_QUERY_KEYS.list('einsatz-1'), PATIENT_QUERY_KEYS.kpis('einsatz-1')]));
  });

  it('Mutation in flight: Button zeigt „Erfasse …" und ist disabled', async () => {
    let resolveApi!: (value: unknown) => void;
    erfassePatientApiSpy.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveApi = resolve;
        }),
    );

    renderWithProviders(<ErfassePatientForm einsatzId="einsatz-1" />);

    fireEvent.click(screen.getByTestId('sk-selector-pill-SK_I'));
    fireEvent.click(screen.getByRole('button', { name: /patient erfassen/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /erfasse/i })).toBeDisabled();
    });

    resolveApi({
      data: {
        id: 'pat-2',
        einsatzId: 'einsatz-1',
        patientennummer: 'P-002',
        aktuelleSk: 'SK_I',
        behandlungsstatus: 'UNVERSORGT',
        transportstatus: 'WARTEND',
        erfasstAm: '2026-05-19T10:00:00.000Z',
        erfasserRef: { type: 'user', userId: 'user-1' },
        eventVersion: 1,
      },
    });
  });

  it('zeigt Fehler-Pill bei Mutation-Error (UX: kein Toast, Inline)', async () => {
    erfassePatientApiSpy.mockRejectedValueOnce(new Error('Backend down'));

    renderWithProviders(<ErfassePatientForm einsatzId="einsatz-1" />);

    fireEvent.click(screen.getByTestId('sk-selector-pill-SK_III'));
    fireEvent.click(screen.getByRole('button', { name: /patient erfassen/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/fehlgeschlagen/i);
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('blockt Submit ohne ausgewählte SK (Zod-Validation)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ErfassePatientForm einsatzId="einsatz-1" />);

    await user.click(screen.getByRole('button', { name: /patient erfassen/i }));

    // Zod fängt invalid state ab — kein API-Call passiert
    expect(erfassePatientApiSpy).not.toHaveBeenCalled();
  });
});
