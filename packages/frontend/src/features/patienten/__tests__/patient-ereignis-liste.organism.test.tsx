import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PatientEventDto } from '@bluelight-hub/shared/client';
import { expectNoAxeViolations } from '@/test/a11y';
import { PatientEreignisListe } from '../ui/patient-ereignis-liste.organism';

function buildEvent(overrides: Partial<PatientEventDto> = {}): PatientEventDto {
  return {
    id: 'evt_1',
    eventVersion: 1,
    eventType: 'patient.erfasst',
    occurredAt: '2026-05-20T14:21:01.000Z',
    recordedAt: '2026-05-20T14:21:01.500Z',
    actorUserId: 'usr-42',
    actorDeviceId: null,
    originSessionId: null,
    clockDriftSeconds: null,
    payload: { kind: 'patient.erfasst', initialeSk: 'SK_II' },
    ...overrides,
  } as PatientEventDto;
}

describe('PatientEreignisListe (Story 1.7, AC8)', () => {
  it('rendert leeren Hinweis bei 0 Events', () => {
    render(<PatientEreignisListe events={[]} />);
    expect(screen.getByTestId('patient-ereignis-empty')).toBeInTheDocument();
  });

  it('rendert als <ol> mit <li>-Einträgen pro Event', () => {
    render(
      <PatientEreignisListe events={[buildEvent({ id: 'a' }), buildEvent({ id: 'b', eventType: 'patient.gesichtet', payload: { kind: 'patient.gesichtet', sk: 'SK_II', sichtungArt: 'INITIAL' } })]} />,
    );
    const list = screen.getByTestId('patient-ereignis-liste');
    expect(list.tagName).toBe('OL');
    expect(within(list).getAllByTestId('patient-ereignis-eintrag')).toHaveLength(2);
  });

  it('rendert die Event-Type-Labels deutsch', () => {
    render(
      <PatientEreignisListe
        events={[
          buildEvent({ eventType: 'patient.erfasst' }),
          buildEvent({ id: 'b', eventType: 'patient.sichtung-aktualisiert', payload: { vorher: 'SK_II', neu: 'SK_III', grund: 'Stabilisiert' } }),
          buildEvent({ id: 'c', eventType: 'patient.behandlung-begonnen' }),
          buildEvent({ id: 'd', eventType: 'patient.behandlung-abgeschlossen', payload: { neu: 'VERSORGT' } }),
          buildEvent({ id: 'e', eventType: 'patient.transport-gestartet' }),
          buildEvent({ id: 'f', eventType: 'patient.transport-abgeschlossen' }),
          buildEvent({ id: 'g', eventType: 'patient.korrigiert', payload: { feld: 'behandlungsstatus', vorher: 'IN_BEHANDLUNG', neu: 'VERSORGT', grund: 'Tippfehler' } }),
        ]}
      />,
    );
    expect(screen.getByText('Patient erfasst')).toBeInTheDocument();
    expect(screen.getByText('Sichtung aktualisiert')).toBeInTheDocument();
    expect(screen.getAllByText('Korrektur').length).toBeGreaterThan(0);
  });

  it('rendert Drift-Indikator nur bei clockDriftSeconds > 30', () => {
    render(<PatientEreignisListe events={[buildEvent({ id: 'no-drift', clockDriftSeconds: 10 }), buildEvent({ id: 'with-drift', clockDriftSeconds: 42 })]} />);
    expect(screen.getByText(/Geräte-Zeit-Drift \+42 s/)).toBeInTheDocument();
  });

  it('rendert Akteur-Varianten User/Device/Session', () => {
    render(
      <PatientEreignisListe
        events={[
          buildEvent({ id: 'user', actorUserId: 'usr-1' }),
          buildEvent({ id: 'device', actorUserId: null, actorDeviceId: 'tablet-3a' }),
          buildEvent({ id: 'device+session', actorUserId: null, actorDeviceId: 'tablet-3a', originSessionId: 'sess-456' }),
        ]}
      />,
    );
    expect(screen.getByText(/durch User usr-1/)).toBeInTheDocument();
    expect(screen.getByText(/durch Gerät tablet-3a$/)).toBeInTheDocument();
    expect(screen.getByText(/durch Gerät tablet-3a \(Session sess-456\)/)).toBeInTheDocument();
  });

  it('Fallback für unbekannte eventType-Strings', () => {
    render(<PatientEreignisListe events={[buildEvent({ id: 'unknown', eventType: 'patient.zukunfts-event-9000' })]} />);
    expect(screen.getByText(/Unbekanntes Ereignis \(patient\.zukunfts-event-9000\)/)).toBeInTheDocument();
  });

  it('rendert Sichtung-Aktualisiert mit vorher → neu + Grund', () => {
    render(<PatientEreignisListe events={[buildEvent({ id: 's', eventType: 'patient.sichtung-aktualisiert', payload: { vorher: 'SK_II', neu: 'SK_III', grund: 'Stabilisiert' } })]} />);
    expect(screen.getByText(/SK_II → SK_III · Grund: Stabilisiert/)).toBeInTheDocument();
  });

  it('rendert Korrektur(notiz) ohne PII-Leak (nur Grund, kein Klartext)', () => {
    render(<PatientEreignisListe events={[buildEvent({ id: 'k', eventType: 'patient.korrigiert', payload: { feld: 'notiz', vorher: null, neu: 'Geheime Notiz', grund: 'Update' } })]} />);
    expect(screen.queryByText(/Geheime Notiz/)).toBeNull();
    expect(screen.getByText(/Notiz aktualisiert · Grund: Update/)).toBeInTheDocument();
  });

  it('axe-clean — keine WCAG 2.1 AA-Verstöße bei voller Event-Liste (Story 1.7, AC12)', async () => {
    const { container } = render(
      <PatientEreignisListe
        events={[
          buildEvent({ id: '1', eventType: 'patient.erfasst' }),
          buildEvent({ id: '2', eventType: 'patient.gesichtet', payload: { sk: 'SK_II' } }),
          buildEvent({ id: '3', eventType: 'patient.sichtung-aktualisiert', payload: { vorher: 'SK_II', neu: 'SK_III', grund: 'Stabilisiert' } }),
          buildEvent({ id: '4', eventType: 'patient.korrigiert', payload: { feld: 'behandlungsstatus', vorher: 'IN_BEHANDLUNG', neu: 'VERSORGT', grund: 'Tippfehler' } }),
          buildEvent({ id: '5', eventType: 'patient.erfasst', clockDriftSeconds: 42 }),
        ]}
      />,
    );
    await expectNoAxeViolations(container);
  });
});
