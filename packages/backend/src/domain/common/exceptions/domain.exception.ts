/**
 * Abstrakte Basisklasse für alle Domain-Exceptions.
 *
 * Domain Exceptions sind Framework-agnostisch und enthalten
 * strukturierte Kontextinformationen für Logging und Debugging.
 *
 * @example
 * throw new EinsatzNotFoundException('123-abc');
 */
export abstract class DomainException extends Error {
  constructor(
    message: string,
    public readonly aggregateId?: string,
    public readonly operation?: string,
    public readonly originalError?: Error,
  ) {
    super(message);
    this.name = this.constructor.name;
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Serialisiert die Exception für Logging/API-Responses.
   * SECURITY: originalError wird NICHT exponiert (kann Secrets enthalten).
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      aggregateId: this.aggregateId,
      operation: this.operation,
    };
  }
}
