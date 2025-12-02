import { Prisma } from '@prisma/client';
import { DomainException, EinsatzPersistenceException } from '../../domain/common/exceptions';

/**
 * Prisma Error Codes die gemappt werden sollen.
 * @see https://www.prisma.io/docs/reference/api-reference/error-reference
 */
export const PRISMA_ERROR_CODES = {
  UNIQUE_CONSTRAINT: 'P2002',
  NOT_FOUND: 'P2025',
  TIMEOUT: 'P2024',
  TRANSACTION_CONFLICT: 'P2034',
} as const;

/**
 * Generische Exception für Unique Constraint Violations.
 * Kann für alle Aggregate verwendet werden.
 */
export class DuplicateEntityException extends DomainException {
  public readonly constraintFields: string[];

  constructor(message: string, constraintFields: string[], aggregateId?: string, originalError?: Error) {
    super(message, aggregateId, 'create', originalError);
    this.constraintFields = constraintFields;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      constraintFields: this.constraintFields,
    };
  }
}

/**
 * Generische Exception für Not Found in DB-Operationen.
 * Wrapper für P2025 wenn keine spezifische NotFoundException existiert.
 */
export class EntityNotFoundException extends DomainException {
  constructor(message: string, aggregateId?: string, originalError?: Error) {
    super(message, aggregateId, 'find', originalError);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Exception für Datenbank-Timeouts.
 */
export class DatabaseTimeoutException extends DomainException {
  constructor(message: string, operation?: string, originalError?: Error) {
    super(message, undefined, operation ?? 'query', originalError);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Exception für Transaction-Konflikte (Optimistic Locking).
 */
export class ConcurrencyException extends DomainException {
  constructor(message: string, aggregateId?: string, originalError?: Error) {
    super(message, aggregateId, 'transaction', originalError);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Mapper-Service für Prisma-Errors zu Domain-Exceptions.
 *
 * Konvertiert technische Prisma-Fehlercodes zu verständlichen Domain-Exceptions
 * mit strukturierten Kontextinformationen.
 *
 * @example
 * try {
 *   await prisma.einsatz.create(...);
 * } catch (error) {
 *   throw PrismaErrorMapper.mapError(error, einsatzId, 'create');
 * }
 */
export class PrismaErrorMapper {
  /**
   * Mappt einen Prisma-Error zu einer Domain-Exception.
   *
   * @param error - Der aufgetretene Fehler (unknown für Type-Safety)
   * @param aggregateId - Optional: ID des betroffenen Aggregats
   * @param operation - Optional: Die ausgeführte Operation
   * @returns DomainException mit strukturierten Kontextinformationen
   */
  static mapError(error: unknown, aggregateId?: string, operation?: string): DomainException {
    // Handle Prisma Known Request Errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return PrismaErrorMapper.mapKnownRequestError(error, aggregateId, operation);
    }

    // Handle Prisma Validation Errors
    if (error instanceof Prisma.PrismaClientValidationError) {
      return new EinsatzPersistenceException('Datenbankvalidierung fehlgeschlagen', aggregateId, error, 'VALIDATION_ERROR');
    }

    // Handle Prisma Initialization Errors
    if (error instanceof Prisma.PrismaClientInitializationError) {
      return new EinsatzPersistenceException('Datenbankverbindung konnte nicht hergestellt werden', aggregateId, error, 'INITIALIZATION_ERROR');
    }

    // Handle generic errors
    if (error instanceof Error) {
      return new EinsatzPersistenceException(`Datenbankfehler: ${error.message}`, aggregateId, error, 'UNKNOWN_ERROR');
    }

    // Fallback for non-Error objects
    return new EinsatzPersistenceException('Unbekannter Datenbankfehler', aggregateId, undefined, 'UNKNOWN_ERROR');
  }

  /**
   * Mappt bekannte Prisma Request Errors basierend auf Error Code.
   */
  private static mapKnownRequestError(error: Prisma.PrismaClientKnownRequestError, aggregateId?: string, operation?: string): DomainException {
    switch (error.code) {
      case PRISMA_ERROR_CODES.UNIQUE_CONSTRAINT: {
        const target = error.meta?.target;
        const fields = Array.isArray(target) ? target : [String(target ?? 'unknown')];
        return new DuplicateEntityException(`Duplikat: Eintrag mit ${fields.join(', ')} existiert bereits`, fields, aggregateId, error);
      }

      case PRISMA_ERROR_CODES.NOT_FOUND:
        return new EntityNotFoundException(`Datensatz nicht gefunden${aggregateId ? `: ${aggregateId}` : ''}`, aggregateId, error);

      case PRISMA_ERROR_CODES.TIMEOUT:
        return new DatabaseTimeoutException('Datenbankoperation hat das Zeitlimit überschritten', operation, error);

      case PRISMA_ERROR_CODES.TRANSACTION_CONFLICT:
        return new ConcurrencyException('Konflikt: Der Datensatz wurde zwischenzeitlich geändert', aggregateId, error);

      default:
        return new EinsatzPersistenceException(`Datenbankfehler: ${error.message}`, aggregateId, error, error.code);
    }
  }

  /**
   * Prüft ob ein Error ein Prisma-Error ist.
   */
  static isPrismaError(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError || error instanceof Prisma.PrismaClientValidationError || error instanceof Prisma.PrismaClientInitializationError;
  }
}
