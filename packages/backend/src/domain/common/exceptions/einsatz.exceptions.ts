import { DomainException } from './domain.exception';

/**
 * Wird geworfen wenn ein Einsatz nicht gefunden wurde.
 */
export class EinsatzNotFoundException extends DomainException {
  constructor(einsatzId: string) {
    super(`Einsatz nicht gefunden: ${einsatzId}`, einsatzId, 'find');
  }
}

/**
 * Wird geworfen bei Validierungsfehlern von Einsatz-Daten.
 * z.B. ungültiges ID-Format, fehlende Pflichtfelder.
 */
export class EinsatzValidationException extends DomainException {
  public readonly field?: string;

  constructor(message: string, field?: string, aggregateId?: string) {
    super(message, aggregateId, 'validate');
    this.field = field;
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      field: this.field,
    };
  }
}

/**
 * Wird geworfen bei Verletzung von Business Rules.
 * z.B. ungültige Status-Transition, Archivierung vor 10-Jahres-Frist.
 */
export class EinsatzBusinessRuleException extends DomainException {
  public readonly rule: string;

  constructor(message: string, einsatzId: string, rule: string) {
    super(message, einsatzId, rule);
    this.rule = rule;
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      rule: this.rule,
    };
  }
}

/**
 * Wird geworfen bei Persistenz-Fehlern (Datenbank).
 * Wrapper für Prisma/DB-Errors mit generischer Fehlermeldung.
 */
export class EinsatzPersistenceException extends DomainException {
  public readonly errorCode?: string;

  constructor(message: string, einsatzId?: string, originalError?: Error, errorCode?: string) {
    super(message, einsatzId, 'persist', originalError);
    this.errorCode = errorCode;
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      errorCode: this.errorCode,
    };
  }
}
