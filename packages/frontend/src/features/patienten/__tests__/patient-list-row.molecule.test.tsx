import { fireEvent, render, screen } from '@testing-library/react';
import type { PatientListItemDto } from '@bluelight-hub/shared/client';
import { describe, expect, it, vi } from 'vitest';
import { PatientListRow } from '../ui/patient-list-row.molecule';

function buildPatient(overrides: Partial<PatientListItemDto> = {}): PatientListItemDto {
  return {
    id: 'pat_1',
    patientennummer: 'P-001',
    diviVakNummer: null,
    name: null,
    aktuelleSk: 'SK_II',
    behandlungsstatus: 'IN_BEHANDLUNG',
    transportstatus: 'WARTEND',
    erfasstAm: new Date(Date.now() - 12 * 60_000).toISOString(),
    eventVersion: 1,
    ...overrides,
  } as PatientListItemDto;
}

describe('PatientListRow (Story 1.6)', () => {
  it('rendert Patientennummer, SK-Badge, Behandlungs- und Transport-Pill', () => {
    render(<PatientListRow patient={buildPatient()} />);

    expect(screen.getByTestId('patient-list-row-nummer')).toHaveTextContent('P-001');
    expect(screen.getByTestId('sk-badge-SK_II')).toBeInTheDocument();
    expect(screen.getByTestId('behandlungs-pill-readonly-IN_BEHANDLUNG')).toBeInTheDocument();
    expect(screen.getByTestId('transport-pill-readonly-WARTEND')).toBeInTheDocument();
  });

  it('zeigt em-dash bei fehlendem Name (kein "unbekannt"-Text)', () => {
    render(<PatientListRow patient={buildPatient({ name: null })} />);
    expect(screen.getByTestId('patient-list-row-name')).toHaveTextContent('—');
  });

  it('zeigt name, wenn gesetzt', () => {
    render(<PatientListRow patient={buildPatient({ name: 'Max Mustermann' })} />);
    expect(screen.getByTestId('patient-list-row-name')).toHaveTextContent('Max Mustermann');
  });

  it('formatiert erfasstAm als relative Zeit (deutsch)', () => {
    render(<PatientListRow patient={buildPatient()} />);
    const zeit = screen.getByTestId('patient-list-row-zeit').textContent;
    // formatDistanceToNow mit addSuffix=true und locale=de liefert "vor … min/Stunden/etc."
    expect(zeit).toMatch(/(vor|in)/i);
  });

  it('rendert button-Element + Click-Handler, wenn onClick gesetzt', () => {
    const onClick = vi.fn();
    render(<PatientListRow patient={buildPatient()} onClick={onClick} />);
    const button = screen.getByTestId('patient-list-row-pat_1');
    expect(button.tagName).toBe('BUTTON');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('rendert div-Element ohne Click-Handler, wenn onClick fehlt', () => {
    render(<PatientListRow patient={buildPatient()} />);
    const row = screen.getByTestId('patient-list-row-pat_1');
    expect(row.tagName).toBe('DIV');
  });

  it('vollständiges aria-label enthält alle Status-Klartexte', () => {
    render(<PatientListRow patient={buildPatient()} />);
    const row = screen.getByTestId('patient-list-row-pat_1');
    const aria = row.getAttribute('aria-label') ?? '';
    expect(aria).toContain('P-001');
    expect(aria).toContain('SK II');
    expect(aria).toContain('Behandlung');
    expect(aria).toContain('Transport');
  });

  it('aktiviert animate-highlight-updated bei highlighted=true', () => {
    render(<PatientListRow patient={buildPatient()} highlighted />);
    const row = screen.getByTestId('patient-list-row-pat_1');
    expect(row.className).toContain('animate-highlight-updated');
  });
});
