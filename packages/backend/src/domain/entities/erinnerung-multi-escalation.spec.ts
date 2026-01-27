import { Erinnerung } from './erinnerung.entity';
import { ErinnerungStatus } from '../value-objects/erinnerung-status';
import { ErinnerungTitel } from '../value-objects/erinnerung-titel';
import { EinsatzId } from '../value-objects/einsatz-id';
import { ErinnerungId } from '../value-objects/erinnerung-id';
import { UserId } from '../value-objects/user-id';
import { ErinnerungEskaliertEvent } from '../events/erinnerung-eskaliert.event';
import { ErinnerungIntensiviertEvent } from '../events/erinnerung-intensiviert.event';

// Mock CUID2 for Jest compatibility
jest.mock('@paralleldrive/cuid2', () => ({
  createId: jest.fn(() => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'c';
    for (let i = 0; i < 24; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }),
  isCuid: jest.fn((id: string) => {
    if (typeof id !== 'string') return false;
    if (id.length < 20 || id.length > 30) return false;
    return /^[a-z][a-z0-9]+$/.test(id);
  }),
}));

describe('Erinnerung - Multi-Level Escalation (Story 4.8)', () => {
  const createTestErinnerung = (status: ErinnerungStatus, assignedToId: UserId | null = null, previousAssigneeId: UserId | null = null, eskalationsPersonId: UserId | null = null) => {
    return Erinnerung.reconstruct({
      id: ErinnerungId.create().value!,
      einsatzId: EinsatzId.create().value!,
      titel: ErinnerungTitel.create('Test').value!,
      beschreibung: null,
      faelligAm: new Date(),
      status: status,
      erstelltVon: UserId.create().value!,
      createdAt: new Date(),
      updatedAt: new Date(),
      assignedToId: assignedToId,
      previousAssigneeId: previousAssigneeId,
      eskalationsPersonId: eskalationsPersonId,
      intensivierungsCount: 0,
    });
  };

  const userIdA = UserId.create().value!;
  const userIdB = UserId.create().value!;
  const userIdC = UserId.create().value!;
  const systemUser = 'SYSTEM';

  describe('eskalieren() with chained targets', () => {
    it('should escalate from A to B (Level 1)', () => {
      // Given: Triggered reminder with escalation person B
      const erinnerung = createTestErinnerung(ErinnerungStatus.AUSGELOEST(), userIdA, null, userIdB);

      // When: Escalate
      const result = erinnerung.eskalieren(systemUser);

      // Then: Status ESKALIERT, Assigned to B, Previous A
      expect(result.isSuccess).toBe(true);
      expect(erinnerung.status.isEskaliert()).toBe(true);
      expect(erinnerung.assignedToId?.equals(userIdB)).toBe(true);
      // Wait, reconstruct doesn't set assignedToId automatically if not passed?
      // In createTestErinnerung I pass assignedToId=userIdA.
      expect(erinnerung.previousAssigneeId?.equals(userIdA)).toBe(true);
    });

    it('should escalate from B to C (Level 2)', () => {
      // Given: Already escalated reminder (A -> B), now assigned to B
      const erinnerung = createTestErinnerung(ErinnerungStatus.ESKALIERT(), userIdB, userIdA, userIdB);
      // Note: eskalationsPersonId is currently B (from first escalation).

      // When: Escalate with nextTarget = C
      const result = erinnerung.eskalieren(systemUser, userIdC);

      // Then: Status remains ESKALIERT, Assigned to C, Previous B
      expect(result.isSuccess).toBe(true);
      expect(erinnerung.status.isEskaliert()).toBe(true);
      expect(erinnerung.assignedToId?.equals(userIdC)).toBe(true);
      expect(erinnerung.previousAssigneeId?.equals(userIdB)).toBe(true);
      expect(erinnerung.eskalationsPersonId?.equals(userIdC)).toBe(true);

      // Check Events
      const events = erinnerung.getDomainEvents();
      const event = events.find((e) => e instanceof ErinnerungEskaliertEvent) as ErinnerungEskaliertEvent;
      expect(event).toBeDefined();
      expect(event.eskalationsPersonId?.equals(userIdC)).toBe(true);
    });
  });

  describe('Loop Prevention', () => {
    it('should prevent ping-pong loop (A -> B -> A)', () => {
      // Given: Escalated reminder assigned to B, previous was A
      const erinnerung = createTestErinnerung(ErinnerungStatus.ESKALIERT(), userIdB, userIdA, userIdB);

      // When: Escalate with nextTarget = A
      const result = erinnerung.eskalieren(systemUser, userIdA);

      // Then: Should NOT change assignment, should fallback to Intensivierung
      expect(result.isSuccess).toBe(true); // Intensivierung returns OK
      expect(erinnerung.assignedToId?.equals(userIdB)).toBe(true); // Still B

      const events = erinnerung.getDomainEvents();
      const event = events.find((e) => e instanceof ErinnerungIntensiviertEvent);
      expect(event).toBeDefined();
    });

    it('should prevent self-loop (B -> B)', () => {
      // Given: Escalated reminder assigned to B
      const erinnerung = createTestErinnerung(ErinnerungStatus.ESKALIERT(), userIdB, userIdA, userIdB);

      // When: Escalate with nextTarget = B
      const result = erinnerung.eskalieren(systemUser, userIdB);

      // Then: Fallback to Intensivierung
      expect(erinnerung.assignedToId?.equals(userIdB)).toBe(true);
      const events = erinnerung.getDomainEvents();
      expect(events[0]).toBeInstanceOf(ErinnerungIntensiviertEvent);
    });
  });

  describe('Fallback', () => {
    it('should intensify if no next target provided for already escalated reminder', () => {
      // Given: Escalated reminder assigned to B
      const erinnerung = createTestErinnerung(ErinnerungStatus.ESKALIERT(), userIdB, userIdA, userIdB);

      // When: Escalate without next target
      const result = erinnerung.eskalieren(systemUser, null);

      // Then: Intensivierung
      expect(result.isSuccess).toBe(true);
      const events = erinnerung.getDomainEvents();
      expect(events[0]).toBeInstanceOf(ErinnerungIntensiviertEvent);
    });
  });
});
