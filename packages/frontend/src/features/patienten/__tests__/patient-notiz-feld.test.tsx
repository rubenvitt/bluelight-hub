import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { expectNoAxeViolations } from '@/test/a11y';

const korrigiereApiSpy = vi.fn();

vi.mock('@/shared', () => ({
  api: {
    patienten: () => ({
      patientenControllerKorrigiereVAlpha: korrigiereApiSpy,
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

const { PatientNotizFeld } = await import('../ui/patient-notiz-feld.molecule');

function buildWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('PatientNotizFeld (Story 1.7, AC9)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    korrigiereApiSpy.mockReset();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // Story 1.7 Code-Review-Patch: Debounce-Mechanik nutzt `@tanstack/pacer`
    // (AsyncDebouncer) statt rohem `setTimeout` — fake-Timer können dort
    // den Promise-Resolve-Pfad blockieren. Wir nutzen darum Real-Timer mit
    // bewusst kurzen Debounce-Erwartungs-Zeitfenstern.
  });

  afterEach(() => {
    // No-Op — bewusst keine fake-Timer in dieser Suite, siehe beforeEach.
  });

  it('rendert Textarea + Status-Region (a11y label + hint + status)', () => {
    const Wrapper = buildWrapper(queryClient);
    render(<PatientNotizFeld einsatzId="ein_1" patientId="pat_1" initialValue={null} />, { wrapper: Wrapper });

    expect(screen.getByLabelText(/Notiz/i)).toBeInTheDocument();
    expect(screen.getByText(/Max\. 500 Zeichen/i)).toBeInTheDocument();
  });

  it('zeigt initialValue als Textarea-Inhalt', () => {
    const Wrapper = buildWrapper(queryClient);
    render(<PatientNotizFeld einsatzId="ein_1" patientId="pat_1" initialValue="Verdacht SHT" />, { wrapper: Wrapper });
    expect(screen.getByDisplayValue('Verdacht SHT')).toBeInTheDocument();
  });

  it('triggert nach 2 s Debounce einen Korrektur-API-Call mit feld=notiz', async () => {
    korrigiereApiSpy.mockResolvedValue({ data: { id: 'pat_1', patientennummer: 'P-001' } });
    const Wrapper = buildWrapper(queryClient);

    render(<PatientNotizFeld einsatzId="ein_1" patientId="pat_1" initialValue={null} />, { wrapper: Wrapper });

    const textarea = screen.getByLabelText(/Notiz/i);
    fireEvent.change(textarea, { target: { value: 'Neue Notiz' } });

    // Real-Timer, weil `useAutoSave` über `@tanstack/pacer` debounced.
    await waitFor(() => expect(korrigiereApiSpy).toHaveBeenCalled(), { timeout: 3500 });

    const call = korrigiereApiSpy.mock.calls[0]?.[0];
    expect(call?.einsatzId).toBe('ein_1');
    expect(call?.patientId).toBe('pat_1');
    expect(call?.korrigierePatientDto?.feld).toBe('notiz');
    expect(call?.korrigierePatientDto?.neuerWert).toBe('Neue Notiz');
  });

  it('reflektiert Status-Transitions (dirty → debouncing → syncing → synced) in der aria-live-Region', async () => {
    korrigiereApiSpy.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ data: { id: 'pat_1', patientennummer: 'P-001' } }), 50)));
    const Wrapper = buildWrapper(queryClient);
    render(<PatientNotizFeld einsatzId="ein_1" patientId="pat_1" initialValue={null} />, { wrapper: Wrapper });

    // Initial: keine Eingabe → „gespeichert" / idle.
    const liveRegion = document.getElementById('patient-notiz-status-pat_1');
    expect(liveRegion?.textContent).toMatch(/gespeichert/i);

    fireEvent.change(screen.getByLabelText(/Notiz/i), { target: { value: 'Tipp' } });

    // Direkt nach onChange → debouncing („Eingabe wird verarbeitet").
    await waitFor(() => expect(liveRegion?.textContent).toMatch(/Eingabe wird verarbeitet|verarbeitet/i), { timeout: 1500 });

    // Nach Debounce + Mutation-Resolve → final „gespeichert"/idle.
    await waitFor(() => expect(korrigiereApiSpy).toHaveBeenCalled(), { timeout: 3500 });
    await waitFor(() => expect(liveRegion?.textContent).toMatch(/gespeichert/i), { timeout: 1500 });
  });

  it('respektiert maxLength=500 (Textarea hartes Limit)', () => {
    const Wrapper = buildWrapper(queryClient);
    render(<PatientNotizFeld einsatzId="ein_1" patientId="pat_1" initialValue={null} />, { wrapper: Wrapper });
    const textarea = screen.getByLabelText(/Notiz/i) as HTMLTextAreaElement;
    expect(textarea.maxLength).toBe(500);
  });

  it('ist axe-clean (AC12 A11y-Audit für PatientNotizFeld als Standalone-Component)', async () => {
    vi.useRealTimers();
    const Wrapper = buildWrapper(queryClient);
    const { container } = render(<PatientNotizFeld einsatzId="ein_1" patientId="pat_1" initialValue="Übergabe an LNA-Schicht 2" />, { wrapper: Wrapper });
    await expectNoAxeViolations(container);
  });
});
