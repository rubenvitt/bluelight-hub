import { fireEvent, render, screen } from '@testing-library/react';
import type { PatientListItemDto } from '@bluelight-hub/shared/client';
import { describe, expect, it, vi } from 'vitest';
import { PatientPill } from '../ui/patient-pill.molecule';

function buildPatient(overrides: Partial<PatientListItemDto> = {}): PatientListItemDto {
  return {
    id: 'pat_123',
    patientennummer: 'P-003',
    name: 'Beifahrerin',
    zeit: new Date().toISOString(),
    aktuelleSk: 'SK_I',
    behandlungsstatus: 'IN_BEHANDLUNG',
    transportstatus: 'WARTEND',
    erfasstAm: new Date(Date.now() - 30 * 60_000).toISOString(),
    eventVersion: 1,
    ...overrides,
  } as PatientListItemDto;
}

describe('PatientPill (Story 1.8, AC4)', () => {
  it('rendert Patientennummer, Name, SK und Uhrzeit', () => {
    const patient = buildPatient();
    render(<PatientPill patient={patient} />);

    expect(screen.getByText('P-003')).toBeInTheDocument();
    expect(screen.getByText(/— „Beifahrerin“/)).toBeInTheDocument();
    expect(screen.getByText('SK I')).toBeInTheDocument();
  });

  it('sollte das SK-Farbflächel mit der richtigen CSS-Klasse rendern', () => {
    const patient = buildPatient({ aktuelleSk: 'SK_I' });
    const { container } = render(<PatientPill patient={patient} />);
    const skColorBar = container.querySelector('.bg-sk-rot-fill');
    expect(skColorBar).toBeInTheDocument();
  });

  it('sollte das Farbflächel für alle SKs korrekt zuordnen', () => {
    const checkSkClass = (sk: 'SK_I' | 'SK_II' | 'SK_III' | 'SK_IV' | 'TOT', expectedClass: string) => {
      const { container, unmount } = render(<PatientPill patient={buildPatient({ aktuelleSk: sk })} />);
      expect(container.querySelector(`.${expectedClass}`)).toBeInTheDocument();
      unmount();
    };

    checkSkClass('SK_I', 'bg-sk-rot-fill');
    checkSkClass('SK_II', 'bg-sk-gelb-fill');
    checkSkClass('SK_III', 'bg-sk-gruen-fill');
    checkSkClass('SK_IV', 'bg-sk-blau-fill');
    checkSkClass('TOT', 'bg-sk-schwarz-fill');
  });

  it('rendert den Reevaluierungs-Indikator, wenn reevaluationDueIn gesetzt ist', () => {
    const patient = buildPatient();
    render(<PatientPill patient={patient} reevaluationDueIn="vor 24 min" />);

    expect(screen.getByText('vor 24 min')).toBeInTheDocument();
  });

  it('ruft onClick auf, wenn auf die Pille geklickt wird', () => {
    const onClick = vi.fn();
    const patient = buildPatient();
    render(<PatientPill patient={patient} onClick={onClick} />);

    const button = screen.getByTestId('patient-pill-pat_123');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('generiert ein vollständiges aria-label für Screenreader', () => {
    const patient = buildPatient({ name: 'Beifahrerin', aktuelleSk: 'SK_I' });
    render(<PatientPill patient={patient} reevaluationDueIn="vor 24 min" />);

    const button = screen.getByTestId('patient-pill-pat_123');
    const ariaLabel = button.getAttribute('aria-label') ?? '';

    expect(ariaLabel).toContain('P-003');
    expect(ariaLabel).toContain('Beifahrerin');
    expect(ariaLabel).toContain('SK I — Akut'); // Aus SK_LABELS
    expect(ariaLabel).toContain('Reevaluierung vor 24 min');
  });

  it('rendert "Ungesichtet" im aria-label, wenn aktuelleSk null ist', () => {
    const patient = buildPatient({ aktuelleSk: null as unknown as PatientListItemDto['aktuelleSk'] });
    render(<PatientPill patient={patient} />);

    const button = screen.getByTestId('patient-pill-pat_123');
    const ariaLabel = button.getAttribute('aria-label') ?? '';

    expect(ariaLabel).toContain('Ungesichtet');
    expect(ariaLabel).not.toContain('SK null');
    expect(ariaLabel).not.toContain('null');
  });

  it('lässt den "erfasst"-Teil im aria-label weg, wenn erfasstAm fehlt', () => {
    const patient = buildPatient({ erfasstAm: undefined as unknown as string });
    render(<PatientPill patient={patient} />);

    const button = screen.getByTestId('patient-pill-pat_123');
    const ariaLabel = button.getAttribute('aria-label') ?? '';

    expect(ariaLabel).not.toMatch(/erfasst\s*(,|$)/);
    expect(ariaLabel).not.toContain('undefined');
  });

  it('stellt sicher, dass die Mindesthöhe für Touch-Bedienung (>= 44px) vorhanden ist', () => {
    const patient = buildPatient();
    render(<PatientPill patient={patient} />);

    const button = screen.getByTestId('patient-pill-pat_123');
    expect(button.className).toContain('min-h-[44px]');
  });
});
