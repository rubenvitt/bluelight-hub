import { Erinnerung } from '../erinnerung.entity';
import { UserId } from '@domain/value-objects/user-id';
import { EinsatzId } from '@domain/value-objects/einsatz-id';

describe('Erinnerung Escalation Reproduction', () => {
  it('should escalate correctly when eskalationsPersonId is set', () => {
    // Given
    const eskalationsPersonId = UserId.create().value!;
    const originalAssignee = UserId.create().value!;
    const creator = UserId.create().value!;
    const einsatzId = EinsatzId.create().value!;

    const createResult = Erinnerung.create({
      einsatzId,
      titel: 'Test Escalation',
      faelligAm: new Date(Date.now() + 3600000), // 1h in future
      erstelltVon: creator,
      eskalationsPersonId: eskalationsPersonId,
    });

    if (createResult.isFailure) {
      throw new Error(`Create failed: ${createResult.error}`);
    }
    const reminder = createResult.value!;

    // Initial State: GEPLANT
    expect(reminder.status.isGeplant()).toBe(true);

    // Trigger
    reminder.ausloesen();
    expect(reminder.status.isAusgeloest()).toBe(true);

    // Set initial assignment
    reminder.assignToUser(originalAssignee, creator);
    expect(reminder.assignedToId?.equals(originalAssignee)).toBe(true);

    // When: Escalate
    const result = reminder.eskalieren('SYSTEM');

    // Then
    expect(result.isSuccess).toBe(true);
    expect(reminder.status.isEskaliert()).toBe(true);
    expect(reminder.assignedToId?.equals(eskalationsPersonId)).toBe(true);
    expect(reminder.previousAssigneeId?.equals(originalAssignee)).toBe(true);
    expect(reminder.assignedBy).toBe(null); // System escalation
  });

  it('should NOT escalate if already Acknowledged (Story 4.7)', () => {
    // Given
    const createResult = Erinnerung.create({
      einsatzId: EinsatzId.create().value!,
      titel: 'Test No Escalation',
      faelligAm: new Date(Date.now() + 3600000), // 1h in future
      erstelltVon: UserId.create().value!,
      eskalationsPersonId: UserId.create().value!,
    });

    if (createResult.isFailure) {
      throw new Error(`Create failed: ${createResult.error}`);
    }
    const reminder = createResult.value!;

    reminder.ausloesen();
    reminder.acknowledge(UserId.create().value!);

    expect(reminder.status.isAcknowledged()).toBe(true);

    // When
    const result = reminder.eskalieren('SYSTEM');

    // Then
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe('ERINNERUNG_NOT_ESCALATABLE');
  });

  describe('Intensivierung Limit (Hotfix)', () => {
    /**
     * Helper: Erstellt eine ausgelöste Erinnerung OHNE Eskalationsperson
     * (für Intensivierungs-Tests)
     */
    const createAusgeloesteErinnerungOhneEskalation = () => {
      const createResult = Erinnerung.create({
        einsatzId: EinsatzId.create().value!,
        titel: 'Test Intensivierung',
        faelligAm: new Date(Date.now() + 3600000),
        erstelltVon: UserId.create().value!,
        // KEINE eskalationsPersonId -> führt zu Intensivierung statt Eskalation
      });
      if (createResult.isFailure) throw new Error(createResult.error);
      const reminder = createResult.value!;
      reminder.ausloesen();
      return reminder;
    };

    it('sollte intensivierungsCount bei jeder Intensivierung erhöhen', () => {
      // Given
      const reminder = createAusgeloesteErinnerungOhneEskalation();
      expect(reminder.intensivierungsCount).toBe(0);

      // When: 1. Intensivierung
      const result1 = reminder.eskalieren('SYSTEM');
      expect(result1.isSuccess).toBe(true);
      expect(reminder.intensivierungsCount).toBe(1);

      // When: 2. Intensivierung
      const result2 = reminder.eskalieren('SYSTEM');
      expect(result2.isSuccess).toBe(true);
      expect(reminder.intensivierungsCount).toBe(2);

      // Status sollte AUSGELOEST bleiben
      expect(reminder.status.isAusgeloest()).toBe(true);
    });

    it('sollte nach MAX_INTENSIVIERUNGEN mit INTENSIVIERUNG_LIMIT_ERREICHT fehlschlagen', () => {
      // Given
      const reminder = createAusgeloesteErinnerungOhneEskalation();
      const maxIntensivierungen = Erinnerung.MAX_INTENSIVIERUNGEN;

      // When: Intensiviere bis zum Limit
      for (let i = 0; i < maxIntensivierungen; i++) {
        const result = reminder.eskalieren('SYSTEM');
        expect(result.isSuccess).toBe(true);
      }
      expect(reminder.intensivierungsCount).toBe(maxIntensivierungen);

      // Then: Die nächste Intensivierung sollte fehlschlagen
      const result = reminder.eskalieren('SYSTEM');
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('INTENSIVIERUNG_LIMIT_ERREICHT');

      // Counter sollte nicht weiter erhöht worden sein
      expect(reminder.intensivierungsCount).toBe(maxIntensivierungen);
    });

    it('Eskalation mit eskalationsPersonId sollte vom Limit unberührt sein', () => {
      // Given: Erinnerung MIT Eskalationsperson
      const eskalationsPersonId = UserId.create().value!;
      const createResult = Erinnerung.create({
        einsatzId: EinsatzId.create().value!,
        titel: 'Test Mit Eskalation',
        faelligAm: new Date(Date.now() + 3600000),
        erstelltVon: UserId.create().value!,
        eskalationsPersonId: eskalationsPersonId,
      });
      if (createResult.isFailure) throw new Error(createResult.error);
      const reminder = createResult.value!;
      reminder.ausloesen();

      // When: Eskalation (nicht Intensivierung!)
      const result = reminder.eskalieren('SYSTEM');

      // Then: Sollte funktionieren (geht zu ESKALIERT, nicht zu Intensivierung)
      expect(result.isSuccess).toBe(true);
      expect(reminder.status.isEskaliert()).toBe(true);
      expect(reminder.intensivierungsCount).toBe(0); // Wurde nicht verwendet
    });
  });
});
