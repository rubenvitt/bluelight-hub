import type { PrismaService } from '@/infrastructure/database/prisma.service';
import type { EventSerializer } from '@/infrastructure/outbox/event-serializer';
import { PatientRepositoryAdapter } from '../patient-repository.adapter';

/**
 * Unit-Test für `findEventsByPatientId` (Story 1.7, AC3).
 *
 * Fokus:
 *  - Sort-Reihenfolge: `occurredAt asc`, Tie-Breaker `eventVersion asc`.
 *  - Defensive: leerer Patient → leeres Array.
 *  - Prisma-Fehler → `Result.fail('Infrastructure:PatientEventsQueryFailed:…')`.
 *  - Mapping: snake_case-Spalten → camelCase, `payload` als generisches Objekt.
 */
describe('PatientRepositoryAdapter.findEventsByPatientId', () => {
  function buildAdapter(findManyImpl: jest.Mock) {
    const prisma = {
      patientEvent: { findMany: findManyImpl },
    } as unknown as PrismaService;
    const serializer = {} as EventSerializer;
    return new PatientRepositoryAdapter(prisma, serializer);
  }

  it('ruft findMany mit orderBy=[occurredAt asc, eventVersion asc] auf', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const adapter = buildAdapter(findMany);

    await adapter.findEventsByPatientId('pat-1');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { patientId: 'pat-1' },
        orderBy: [{ occurredAt: 'asc' }, { eventVersion: 'asc' }],
      }),
    );
  });

  it('mappt Prisma-Rows in PatientEventRow-Shape (camelCase, payload als Record)', async () => {
    const rows = [
      {
        id: 'evt-1',
        patientId: 'pat-1',
        einsatzId: 'ein-A',
        eventType: 'patient.erfasst',
        eventVersion: 1,
        payload: { kind: 'patient.erfasst', patientennummer: 'P-003' },
        occurredAt: new Date('2026-05-20T14:21:01.234Z'),
        recordedAt: new Date('2026-05-20T14:21:01.500Z'),
        actorUserId: 'usr-42',
        actorDeviceId: null,
        originSessionId: null,
        clockDriftSeconds: null,
      },
    ];
    const findMany = jest.fn().mockResolvedValue(rows);
    const adapter = buildAdapter(findMany);

    const result = await adapter.findEventsByPatientId('pat-1');

    expect(result.isSuccess).toBe(true);
    expect(result.value).toEqual([
      {
        id: 'evt-1',
        patientId: 'pat-1',
        einsatzId: 'ein-A',
        eventType: 'patient.erfasst',
        eventVersion: 1,
        payload: { kind: 'patient.erfasst', patientennummer: 'P-003' },
        occurredAt: new Date('2026-05-20T14:21:01.234Z'),
        recordedAt: new Date('2026-05-20T14:21:01.500Z'),
        actorUserId: 'usr-42',
        actorDeviceId: null,
        originSessionId: null,
        clockDriftSeconds: null,
      },
    ]);
  });

  it('liefert leeres Array bei Patient ohne Events (kein Fehler)', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const adapter = buildAdapter(findMany);

    const result = await adapter.findEventsByPatientId('pat-orphan');

    expect(result.isSuccess).toBe(true);
    expect(result.value).toEqual([]);
  });

  it('reicht null-payload als leeres Objekt durch (defensiv, kein null im DTO)', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'evt-null',
        patientId: 'pat-1',
        einsatzId: 'ein-A',
        eventType: 'patient.erfasst',
        eventVersion: 1,
        payload: null,
        occurredAt: new Date(),
        recordedAt: new Date(),
        actorUserId: null,
        actorDeviceId: null,
        originSessionId: null,
        clockDriftSeconds: null,
      },
    ]);
    const adapter = buildAdapter(findMany);

    const result = await adapter.findEventsByPatientId('pat-1');

    expect(result.value?.[0]?.payload).toEqual({});
  });

  it('übersetzt Prisma-Fehler in Infrastructure:PatientEventsQueryFailed-Sentinel', async () => {
    const findMany = jest.fn().mockRejectedValue(new Error('DB connection lost'));
    const adapter = buildAdapter(findMany);

    const result = await adapter.findEventsByPatientId('pat-1');

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/^Infrastructure:PatientEventsQueryFailed:DB connection lost$/);
  });
});
