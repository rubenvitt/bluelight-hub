import { BehandlungsstatusEnum, SkEnum, TransportstatusEnum } from '@/generated/prisma/enums';
import { PatientListItemMapper, type PatientListRow } from '../patient-list-item.mapper';

describe('PatientListItemMapper (Story 1.6)', () => {
  const baseRow: PatientListRow = {
    id: 'pat_01HXYZ',
    einsatzId: 'ein_01HXYZ',
    patientennummer: 'P-001',
    diviVakNummer: 'DIVI-2026-0042',
    aktuelleSk: SkEnum.SK_II,
    behandlungsstatus: BehandlungsstatusEnum.IN_BEHANDLUNG,
    transportstatus: TransportstatusEnum.WARTEND,
    erfasstAm: new Date('2026-05-20T14:21:01.234Z'),
    eventVersion: 3,
  };

  it('mappt alle Pflichtfelder verlustfrei', () => {
    const dto = PatientListItemMapper.fromPersistence(baseRow);

    expect(dto.id).toBe('pat_01HXYZ');
    expect(dto.patientennummer).toBe('P-001');
    expect(dto.diviVakNummer).toBe('DIVI-2026-0042');
    expect(dto.aktuelleSk).toBe(SkEnum.SK_II);
    expect(dto.behandlungsstatus).toBe(BehandlungsstatusEnum.IN_BEHANDLUNG);
    expect(dto.transportstatus).toBe(TransportstatusEnum.WARTEND);
    expect(dto.erfasstAm).toBe('2026-05-20T14:21:01.234Z');
    expect(dto.eventVersion).toBe(3);
  });

  it('liefert `name` konstant als null (Forward-Compat bis Pseudonym-Erfassung)', () => {
    const dto = PatientListItemMapper.fromPersistence(baseRow);
    expect(dto.name).toBeNull();
  });

  it('reicht null-`diviVakNummer` als null durch (kein leerer String)', () => {
    const dto = PatientListItemMapper.fromPersistence({ ...baseRow, diviVakNummer: null });
    expect(dto.diviVakNummer).toBeNull();
  });

  it('serialisiert `erfasstAm` als ISO-8601-UTC-String', () => {
    const dto = PatientListItemMapper.fromPersistence(baseRow);
    expect(dto.erfasstAm).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});
