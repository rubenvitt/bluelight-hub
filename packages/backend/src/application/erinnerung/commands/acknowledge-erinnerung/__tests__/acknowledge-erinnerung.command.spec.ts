import { AcknowledgeErinnerungCommand } from '../acknowledge-erinnerung.command';

describe('AcknowledgeErinnerungCommand', () => {
  // Deterministic Test Fixtures (R2-TEST3: No Math.random())
  const TEST_CUID = 'clwx2a9fb0000pq8r3p5t1b9x'; // 26 chars, valid CUID2
  const TEST_CUID_USER = 'clwx2a9fb0001pq8r3p5t1b9y'; // 26 chars, valid CUID2

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create()', () => {
    describe('Successful Creation', () => {
      it('sollte Command erfolgreich erstellen mit gültigen CUIDs', () => {
        // Given (Arrange)
        const props = {
          erinnerungId: TEST_CUID,
          acknowledgedBy: TEST_CUID_USER,
        };

        // When (Act)
        const result = AcknowledgeErinnerungCommand.create(props);

        // Then (Assert)
        expect(result.isSuccess).toBe(true);
        expect(result.value).toBeDefined();
        expect(result.value!.erinnerungId).toBe(TEST_CUID);
        expect(result.value!.acknowledgedBy).toBe(TEST_CUID_USER);
      });

      it('sollte Command mit 24-Zeichen CUID erstellen (Minimum)', () => {
        // Given (Arrange)
        const minCuid = 'abcdefghijklmnopqrstuvwx'; // 24 chars

        // When (Act)
        const result = AcknowledgeErinnerungCommand.create({
          erinnerungId: minCuid,
          acknowledgedBy: minCuid,
        });

        // Then (Assert)
        expect(result.isSuccess).toBe(true);
      });

      it('sollte Command mit 32-Zeichen CUID erstellen (Maximum)', () => {
        // Given (Arrange)
        const maxCuid = 'abcdefghijklmnopqrstuvwxyz012345'; // 32 chars

        // When (Act)
        const result = AcknowledgeErinnerungCommand.create({
          erinnerungId: maxCuid,
          acknowledgedBy: maxCuid,
        });

        // Then (Assert)
        expect(result.isSuccess).toBe(true);
      });
    });

    describe('erinnerungId Validation', () => {
      it('sollte fehlschlagen wenn erinnerungId undefined ist', () => {
        // Given (Arrange)
        const props = {
          erinnerungId: undefined as unknown as string,
          acknowledgedBy: TEST_CUID_USER,
        };

        // When (Act)
        const result = AcknowledgeErinnerungCommand.create(props);

        // Then (Assert)
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('ERINNERUNG_ID_REQUIRED');
      });

      it('sollte fehlschlagen wenn erinnerungId null ist', () => {
        // Given (Arrange)
        const props = {
          erinnerungId: null as unknown as string,
          acknowledgedBy: TEST_CUID_USER,
        };

        // When (Act)
        const result = AcknowledgeErinnerungCommand.create(props);

        // Then (Assert)
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('ERINNERUNG_ID_REQUIRED');
      });

      it('sollte fehlschlagen wenn erinnerungId leer ist', () => {
        // Given (Arrange)
        const props = {
          erinnerungId: '',
          acknowledgedBy: TEST_CUID_USER,
        };

        // When (Act)
        const result = AcknowledgeErinnerungCommand.create(props);

        // Then (Assert)
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('ERINNERUNG_ID_REQUIRED');
      });

      it('sollte fehlschlagen wenn erinnerungId zu kurz ist (<24 Zeichen)', () => {
        // Given (Arrange)
        const tooShort = 'abcdefghijklmnopqrstuv'; // 22 chars

        // When (Act)
        const result = AcknowledgeErinnerungCommand.create({
          erinnerungId: tooShort,
          acknowledgedBy: TEST_CUID_USER,
        });

        // Then (Assert)
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('ERINNERUNG_ID_INVALID_FORMAT');
      });

      it('sollte fehlschlagen wenn erinnerungId zu lang ist (>32 Zeichen)', () => {
        // Given (Arrange)
        const tooLong = 'abcdefghijklmnopqrstuvwxyz0123456789'; // 36 chars

        // When (Act)
        const result = AcknowledgeErinnerungCommand.create({
          erinnerungId: tooLong,
          acknowledgedBy: TEST_CUID_USER,
        });

        // Then (Assert)
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('ERINNERUNG_ID_INVALID_FORMAT');
      });

      it('sollte fehlschlagen wenn erinnerungId Grossbuchstaben enthaelt', () => {
        // Given (Arrange)
        const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWX'; // 24 chars uppercase

        // When (Act)
        const result = AcknowledgeErinnerungCommand.create({
          erinnerungId: uppercase,
          acknowledgedBy: TEST_CUID_USER,
        });

        // Then (Assert)
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('ERINNERUNG_ID_INVALID_FORMAT');
      });

      it('sollte fehlschlagen wenn erinnerungId Sonderzeichen enthaelt', () => {
        // Given (Arrange)
        const withSpecial = 'abc-def_ghi.jkl@mnopqrst'; // 24 chars with special

        // When (Act)
        const result = AcknowledgeErinnerungCommand.create({
          erinnerungId: withSpecial,
          acknowledgedBy: TEST_CUID_USER,
        });

        // Then (Assert)
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('ERINNERUNG_ID_INVALID_FORMAT');
      });

      it('sollte fehlschlagen wenn erinnerungId keine String ist', () => {
        // Given (Arrange)
        const props = {
          erinnerungId: 12345 as unknown as string,
          acknowledgedBy: TEST_CUID_USER,
        };

        // When (Act)
        const result = AcknowledgeErinnerungCommand.create(props);

        // Then (Assert)
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('ERINNERUNG_ID_REQUIRED');
      });
    });

    describe('acknowledgedBy Validation', () => {
      it('sollte fehlschlagen wenn acknowledgedBy undefined ist', () => {
        // Given (Arrange)
        const props = {
          erinnerungId: TEST_CUID,
          acknowledgedBy: undefined as unknown as string,
        };

        // When (Act)
        const result = AcknowledgeErinnerungCommand.create(props);

        // Then (Assert)
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('ACKNOWLEDGED_BY_REQUIRED');
      });

      it('sollte fehlschlagen wenn acknowledgedBy null ist', () => {
        // Given (Arrange)
        const props = {
          erinnerungId: TEST_CUID,
          acknowledgedBy: null as unknown as string,
        };

        // When (Act)
        const result = AcknowledgeErinnerungCommand.create(props);

        // Then (Assert)
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('ACKNOWLEDGED_BY_REQUIRED');
      });

      it('sollte fehlschlagen wenn acknowledgedBy leer ist', () => {
        // Given (Arrange)
        const props = {
          erinnerungId: TEST_CUID,
          acknowledgedBy: '',
        };

        // When (Act)
        const result = AcknowledgeErinnerungCommand.create(props);

        // Then (Assert)
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('ACKNOWLEDGED_BY_REQUIRED');
      });

      it('sollte fehlschlagen wenn acknowledgedBy zu kurz ist (<24 Zeichen)', () => {
        // Given (Arrange)
        const tooShort = 'abcdefghijklmnopqrstuv'; // 22 chars

        // When (Act)
        const result = AcknowledgeErinnerungCommand.create({
          erinnerungId: TEST_CUID,
          acknowledgedBy: tooShort,
        });

        // Then (Assert)
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('ACKNOWLEDGED_BY_INVALID_FORMAT');
      });

      it('sollte fehlschlagen wenn acknowledgedBy zu lang ist (>32 Zeichen)', () => {
        // Given (Arrange)
        const tooLong = 'abcdefghijklmnopqrstuvwxyz0123456789'; // 36 chars

        // When (Act)
        const result = AcknowledgeErinnerungCommand.create({
          erinnerungId: TEST_CUID,
          acknowledgedBy: tooLong,
        });

        // Then (Assert)
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('ACKNOWLEDGED_BY_INVALID_FORMAT');
      });

      it('sollte fehlschlagen wenn acknowledgedBy Grossbuchstaben enthaelt', () => {
        // Given (Arrange)
        const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWX'; // 24 chars uppercase

        // When (Act)
        const result = AcknowledgeErinnerungCommand.create({
          erinnerungId: TEST_CUID,
          acknowledgedBy: uppercase,
        });

        // Then (Assert)
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('ACKNOWLEDGED_BY_INVALID_FORMAT');
      });

      it('sollte fehlschlagen wenn acknowledgedBy keine String ist', () => {
        // Given (Arrange)
        const props = {
          erinnerungId: TEST_CUID,
          acknowledgedBy: 12345 as unknown as string,
        };

        // When (Act)
        const result = AcknowledgeErinnerungCommand.create(props);

        // Then (Assert)
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('ACKNOWLEDGED_BY_REQUIRED');
      });
    });

    describe('Validation Order', () => {
      it('sollte erinnerungId vor acknowledgedBy validieren', () => {
        // Given (Arrange) - Beide ungültig
        const props = {
          erinnerungId: '',
          acknowledgedBy: '',
        };

        // When (Act)
        const result = AcknowledgeErinnerungCommand.create(props);

        // Then (Assert) - erinnerungId Fehler zuerst
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('ERINNERUNG_ID_REQUIRED');
      });
    });

    describe('Immutability', () => {
      it('sollte Command mit readonly Properties erstellen', () => {
        // Given (Arrange)
        const result = AcknowledgeErinnerungCommand.create({
          erinnerungId: TEST_CUID,
          acknowledgedBy: TEST_CUID_USER,
        });

        // When (Act)
        const command = result.value!;

        // Then (Assert) - TypeScript würde compile error zeigen bei Assignment
        expect(command.erinnerungId).toBe(TEST_CUID);
        expect(command.acknowledgedBy).toBe(TEST_CUID_USER);
      });
    });
  });
});
