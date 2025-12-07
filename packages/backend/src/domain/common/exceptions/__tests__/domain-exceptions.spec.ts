import { DomainException } from '../domain.exception';
import { EinsatzBusinessRuleException, EinsatzNotFoundException, EinsatzPersistenceException, EinsatzValidationException } from '../einsatz.exceptions';

describe('DomainException', () => {
  // Konkrete Implementierung für Tests der abstrakten Klasse
  class TestDomainException extends DomainException {}

  describe('constructor', () => {
    it('should create exception with required parameters only', () => {
      // Given: Eine einfache Fehlermeldung
      const message = 'Test error';

      // When: Exception wird mit minimalen Parametern erstellt
      const exception = new TestDomainException(message);

      // Then: Nur die Message ist gesetzt
      expect(exception.message).toBe(message);
      expect(exception.aggregateId).toBeUndefined();
      expect(exception.operation).toBeUndefined();
      expect(exception.originalError).toBeUndefined();
    });

    it('should create exception with all parameters', () => {
      // Given: Vollständige Exception-Parameter
      const message = 'Test error';
      const aggregateId = 'agg-123';
      const operation = 'testOp';
      const originalError = new Error('Original');

      // When: Exception wird mit allen Parametern erstellt
      const exception = new TestDomainException(message, aggregateId, operation, originalError);

      // Then: Alle Parameter sind korrekt zugewiesen
      expect(exception.message).toBe(message);
      expect(exception.aggregateId).toBe(aggregateId);
      expect(exception.operation).toBe(operation);
      expect(exception.originalError).toBe(originalError);
    });

    it('should set name property to class name', () => {
      // Given: Eine TestDomainException
      const exception = new TestDomainException('Test');

      // When: Name wird abgerufen
      const name = exception.name;

      // Then: Name entspricht dem Klassennamen
      expect(name).toBe('TestDomainException');
    });

    it('should maintain correct prototype chain', () => {
      // Given: Eine TestDomainException
      const exception = new TestDomainException('Test');

      // When: instanceof Checks werden durchgeführt
      const isTestException = exception instanceof TestDomainException;
      const isDomainException = exception instanceof DomainException;
      const isError = exception instanceof Error;

      // Then: Alle instanceof Checks sind erfolgreich
      expect(isTestException).toBe(true);
      expect(isDomainException).toBe(true);
      expect(isError).toBe(true);
    });
  });

  describe('toJSON', () => {
    it('should serialize exception with all properties', () => {
      // Given: Exception mit allen Parametern
      const exception = new TestDomainException('Test error', 'agg-123', 'testOp', new Error('Original'));

      // When: toJSON wird aufgerufen
      const json = exception.toJSON();

      // Then: JSON enthält name, message, aggregateId, operation
      expect(json).toEqual({
        name: 'TestDomainException',
        message: 'Test error',
        aggregateId: 'agg-123',
        operation: 'testOp',
      });
    });

    it('should NOT expose originalError in JSON (SECURITY)', () => {
      // Given: Exception mit originalError (könnte sensible Daten enthalten)
      const originalError = new Error('Sensitive stack trace');
      const exception = new TestDomainException('Safe message', 'agg-123', 'testOp', originalError);

      // When: toJSON wird aufgerufen
      const json = exception.toJSON();

      // Then: originalError ist NICHT im JSON enthalten
      expect(json).not.toHaveProperty('originalError');
      expect(Object.keys(json)).toEqual(['name', 'message', 'aggregateId', 'operation']);
    });

    it('should serialize exception with minimal parameters', () => {
      // Given: Exception nur mit Message
      const exception = new TestDomainException('Test error');

      // When: toJSON wird aufgerufen
      const json = exception.toJSON();

      // Then: JSON enthält name und message, andere sind undefined
      expect(json).toEqual({
        name: 'TestDomainException',
        message: 'Test error',
        aggregateId: undefined,
        operation: undefined,
      });
    });
  });
});

describe('EinsatzNotFoundException', () => {
  describe('constructor', () => {
    it('should create exception with formatted message', () => {
      // Given: Eine Einsatz-ID
      const einsatzId = 'test-123';

      // When: Exception wird erstellt
      const exception = new EinsatzNotFoundException(einsatzId);

      // Then: Message enthält die ID mit korrektem Format
      expect(exception.message).toBe(`Einsatz nicht gefunden: ${einsatzId}`);
    });

    it('should set aggregateId and operation correctly', () => {
      // Given: Eine Einsatz-ID
      const einsatzId = 'test-456';

      // When: Exception wird erstellt
      const exception = new EinsatzNotFoundException(einsatzId);

      // Then: aggregateId und operation sind korrekt gesetzt
      expect(exception.aggregateId).toBe(einsatzId);
      expect(exception.operation).toBe('find');
    });

    it('should set name property to EinsatzNotFoundException', () => {
      // Given: Eine EinsatzNotFoundException
      const exception = new EinsatzNotFoundException('test-id');

      // When: Name wird abgerufen
      const name = exception.name;

      // Then: Name ist korrekt
      expect(name).toBe('EinsatzNotFoundException');
    });

    it('should be instanceof DomainException and Error', () => {
      // Given: Eine EinsatzNotFoundException
      const exception = new EinsatzNotFoundException('test-id');

      // When: instanceof Checks werden durchgeführt
      const isDomainException = exception instanceof DomainException;
      const isError = exception instanceof Error;

      // Then: Vererbung funktioniert korrekt
      expect(isDomainException).toBe(true);
      expect(isError).toBe(true);
    });
  });

  describe('toJSON', () => {
    it('should serialize with correct structure', () => {
      // Given: Eine EinsatzNotFoundException
      const einsatzId = 'test-789';
      const exception = new EinsatzNotFoundException(einsatzId);

      // When: toJSON wird aufgerufen
      const json = exception.toJSON();

      // Then: JSON hat korrekte Struktur
      expect(json).toEqual({
        name: 'EinsatzNotFoundException',
        message: `Einsatz nicht gefunden: ${einsatzId}`,
        aggregateId: einsatzId,
        operation: 'find',
      });
    });
  });
});

describe('EinsatzValidationException', () => {
  describe('constructor', () => {
    it('should create exception with message only', () => {
      // Given: Eine Validierungsfehlermeldung
      const message = 'Ungültige Eingabe';

      // When: Exception wird nur mit Message erstellt
      const exception = new EinsatzValidationException(message);

      // Then: Message ist gesetzt, field und aggregateId sind undefined
      expect(exception.message).toBe(message);
      expect(exception.field).toBeUndefined();
      expect(exception.aggregateId).toBeUndefined();
      expect(exception.operation).toBe('validate');
    });

    it('should create exception with field', () => {
      // Given: Fehlermeldung und Feldname
      const message = 'Ungültiges Format';
      const field = 'einsatznummer';

      // When: Exception wird mit field erstellt
      const exception = new EinsatzValidationException(message, field);

      // Then: Field ist korrekt gesetzt
      expect(exception.message).toBe(message);
      expect(exception.field).toBe(field);
      expect(exception.operation).toBe('validate');
    });

    it('should create exception with all parameters', () => {
      // Given: Vollständige Validierungsparameter
      const message = 'Ungültiges Datum';
      const field = 'alarmzeit';
      const aggregateId = 'einsatz-123';

      // When: Exception wird mit allen Parametern erstellt
      const exception = new EinsatzValidationException(message, field, aggregateId);

      // Then: Alle Parameter sind korrekt
      expect(exception.message).toBe(message);
      expect(exception.field).toBe(field);
      expect(exception.aggregateId).toBe(aggregateId);
      expect(exception.operation).toBe('validate');
    });

    it('should set name property correctly', () => {
      // Given: Eine EinsatzValidationException
      const exception = new EinsatzValidationException('Test');

      // When: Name wird abgerufen
      const name = exception.name;

      // Then: Name ist korrekt
      expect(name).toBe('EinsatzValidationException');
    });
  });

  describe('toJSON', () => {
    it('should include field in JSON serialization', () => {
      // Given: Exception mit field
      const exception = new EinsatzValidationException('Ungültig', 'testField', 'agg-123');

      // When: toJSON wird aufgerufen
      const json = exception.toJSON();

      // Then: field ist im JSON enthalten
      expect(json).toEqual({
        name: 'EinsatzValidationException',
        message: 'Ungültig',
        aggregateId: 'agg-123',
        operation: 'validate',
        field: 'testField',
      });
    });

    it('should handle undefined field in JSON', () => {
      // Given: Exception ohne field
      const exception = new EinsatzValidationException('Ungültig');

      // When: toJSON wird aufgerufen
      const json = exception.toJSON();

      // Then: field ist undefined im JSON
      expect(json).toEqual({
        name: 'EinsatzValidationException',
        message: 'Ungültig',
        aggregateId: undefined,
        operation: 'validate',
        field: undefined,
      });
    });
  });
});

describe('EinsatzBusinessRuleException', () => {
  describe('constructor', () => {
    it('should create exception with all required parameters', () => {
      // Given: Business Rule Violation Parameter
      const message = 'Einsatz kann nicht abgeschlossen werden';
      const einsatzId = 'einsatz-456';
      const rule = 'requireMinimumDuration';

      // When: Exception wird erstellt
      const exception = new EinsatzBusinessRuleException(message, einsatzId, rule);

      // Then: Alle Parameter sind korrekt gesetzt
      expect(exception.message).toBe(message);
      expect(exception.aggregateId).toBe(einsatzId);
      expect(exception.operation).toBe(rule);
      expect(exception.rule).toBe(rule);
    });

    it('should set name property correctly', () => {
      // Given: Eine EinsatzBusinessRuleException
      const exception = new EinsatzBusinessRuleException('Test', 'id', 'testRule');

      // When: Name wird abgerufen
      const name = exception.name;

      // Then: Name ist korrekt
      expect(name).toBe('EinsatzBusinessRuleException');
    });

    it('should be instanceof DomainException', () => {
      // Given: Eine EinsatzBusinessRuleException
      const exception = new EinsatzBusinessRuleException('Test', 'id', 'rule');

      // When: instanceof Check wird durchgeführt
      const isDomainException = exception instanceof DomainException;

      // Then: Vererbung funktioniert
      expect(isDomainException).toBe(true);
    });
  });

  describe('toJSON', () => {
    it('should include rule in JSON serialization', () => {
      // Given: Exception mit Business Rule
      const message = 'Rule violated';
      const einsatzId = 'einsatz-789';
      const rule = 'cannotDeleteActiveEinsatz';
      const exception = new EinsatzBusinessRuleException(message, einsatzId, rule);

      // When: toJSON wird aufgerufen
      const json = exception.toJSON();

      // Then: rule ist im JSON enthalten
      expect(json).toEqual({
        name: 'EinsatzBusinessRuleException',
        message,
        aggregateId: einsatzId,
        operation: rule,
        rule,
      });
    });

    it('should have rule as both operation and rule property', () => {
      // Given: Exception mit Business Rule
      const rule = 'testRule';
      const exception = new EinsatzBusinessRuleException('Test', 'id', rule);

      // When: toJSON wird aufgerufen
      const json = exception.toJSON();

      // Then: operation und rule haben denselben Wert
      expect(json.operation).toBe(rule);
      expect(json.rule).toBe(rule);
    });
  });
});

describe('EinsatzPersistenceException', () => {
  describe('constructor', () => {
    it('should create exception with message only', () => {
      // Given: Eine Persistence-Fehlermeldung
      const message = 'Database connection failed';

      // When: Exception wird nur mit Message erstellt
      const exception = new EinsatzPersistenceException(message);

      // Then: Message ist gesetzt, andere Parameter sind optional
      expect(exception.message).toBe(message);
      expect(exception.aggregateId).toBeUndefined();
      expect(exception.originalError).toBeUndefined();
      expect(exception.errorCode).toBeUndefined();
      expect(exception.operation).toBe('persist');
    });

    it('should create exception with einsatzId', () => {
      // Given: Fehlermeldung und Einsatz-ID
      const message = 'Save failed';
      const einsatzId = 'einsatz-123';

      // When: Exception wird mit einsatzId erstellt
      const exception = new EinsatzPersistenceException(message, einsatzId);

      // Then: einsatzId ist gesetzt
      expect(exception.message).toBe(message);
      expect(exception.aggregateId).toBe(einsatzId);
    });

    it('should create exception with originalError', () => {
      // Given: Fehlermeldung und Original-Error
      const message = 'Database error';
      const originalError = new Error('Connection timeout');

      // When: Exception wird mit originalError erstellt
      const exception = new EinsatzPersistenceException(message, undefined, originalError);

      // Then: originalError ist gesetzt
      expect(exception.message).toBe(message);
      expect(exception.originalError).toBe(originalError);
    });

    it('should create exception with all parameters', () => {
      // Given: Vollständige Persistence-Parameter
      const message = 'Transaction failed';
      const einsatzId = 'einsatz-456';
      const originalError = new Error('Constraint violation');
      const errorCode = 'P2002';

      // When: Exception wird mit allen Parametern erstellt
      const exception = new EinsatzPersistenceException(message, einsatzId, originalError, errorCode);

      // Then: Alle Parameter sind korrekt
      expect(exception.message).toBe(message);
      expect(exception.aggregateId).toBe(einsatzId);
      expect(exception.originalError).toBe(originalError);
      expect(exception.errorCode).toBe(errorCode);
      expect(exception.operation).toBe('persist');
    });

    it('should set name property correctly', () => {
      // Given: Eine EinsatzPersistenceException
      const exception = new EinsatzPersistenceException('Test');

      // When: Name wird abgerufen
      const name = exception.name;

      // Then: Name ist korrekt
      expect(name).toBe('EinsatzPersistenceException');
    });
  });

  describe('toJSON', () => {
    it('should include errorCode in JSON serialization', () => {
      // Given: Exception mit errorCode
      const message = 'Database error';
      const einsatzId = 'einsatz-789';
      const errorCode = 'DB_CONSTRAINT';
      const exception = new EinsatzPersistenceException(message, einsatzId, undefined, errorCode);

      // When: toJSON wird aufgerufen
      const json = exception.toJSON();

      // Then: errorCode ist im JSON enthalten
      expect(json).toEqual({
        name: 'EinsatzPersistenceException',
        message,
        aggregateId: einsatzId,
        operation: 'persist',
        errorCode,
      });
    });

    it('should NOT expose originalError in JSON (SECURITY)', () => {
      // Given: Exception mit originalError (könnte Stacktrace enthalten)
      const originalError = new Error('Sensitive database info');
      const exception = new EinsatzPersistenceException('Safe message', 'einsatz-123', originalError, 'ERR_001');

      // When: toJSON wird aufgerufen
      const json = exception.toJSON();

      // Then: originalError ist NICHT im JSON
      expect(json).not.toHaveProperty('originalError');
      expect(Object.keys(json)).toEqual(['name', 'message', 'aggregateId', 'operation', 'errorCode']);
    });

    it('should handle undefined errorCode in JSON', () => {
      // Given: Exception ohne errorCode
      const exception = new EinsatzPersistenceException('Test');

      // When: toJSON wird aufgerufen
      const json = exception.toJSON();

      // Then: errorCode ist undefined
      expect(json).toEqual({
        name: 'EinsatzPersistenceException',
        message: 'Test',
        aggregateId: undefined,
        operation: 'persist',
        errorCode: undefined,
      });
    });
  });
});
