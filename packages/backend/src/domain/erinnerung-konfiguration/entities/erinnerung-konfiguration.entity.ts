import { AggregateRoot } from '@domain/common/aggregate-root';
import { Result } from '@domain/common/result';
import type { UserId } from '@domain/value-objects/user-id';
import { ErinnerungKonfigurationId } from '../value-objects/erinnerung-konfiguration-id';
import { ErinnerungKonfigurationUpdatedEvent } from '../events/erinnerung-konfiguration-updated.event';
import { EskalationsTimeout } from '../value-objects/eskalations-timeout';

interface ErinnerungKonfigurationProps {
  eskalationsTimeout: EskalationsTimeout;
  updatedBy?: UserId;
}

/**
 * AggregateRoot für die globale Erinnerungs-Konfiguration.
 * Aktuell als Singleton konzipiert (System-weite Einstellung).
 */
export class ErinnerungKonfiguration extends AggregateRoot<ErinnerungKonfigurationId> {
  private _eskalationsTimeout: EskalationsTimeout;
  private _updatedBy?: UserId;

  get eskalationsTimeout(): EskalationsTimeout {
    return this._eskalationsTimeout;
  }

  get updatedBy(): UserId | undefined {
    return this._updatedBy;
  }

  private constructor(props: ErinnerungKonfigurationProps, id?: ErinnerungKonfigurationId) {
    const idToUse = id ?? ErinnerungKonfigurationId.create().value;
    if (!idToUse) {
      throw new Error('Failed to create ErinnerungKonfigurationId');
    }
    super(idToUse);
    this._eskalationsTimeout = props.eskalationsTimeout;
    this._updatedBy = props.updatedBy;
  }

  public static create(props: ErinnerungKonfigurationProps, id?: ErinnerungKonfigurationId): Result<ErinnerungKonfiguration> {
    const config = new ErinnerungKonfiguration(props, id);
    return Result.ok<ErinnerungKonfiguration>(config);
  }

  /**
   * Erstellt eine Default-Konfiguration.
   */
  public static createDefault(): ErinnerungKonfiguration {
    const defaultResult = ErinnerungKonfiguration.create({
      eskalationsTimeout: EskalationsTimeout.default(),
    });

    if (defaultResult.isFailure || !defaultResult.value) {
      throw new Error('Failed to create default ErinnerungKonfiguration');
    }
    return defaultResult.value;
  }

  /**
   * Aktualisiert den Eskalations-Timeout.
   *
   * @param newTimeout Neuer Timeout-Wert
   * @param updatedBy User der das Update durchführt
   */
  public updateTimeout(newTimeout: EskalationsTimeout, updatedBy: UserId): Result<void> {
    this._eskalationsTimeout = newTimeout;
    this._updatedBy = updatedBy;

    this.addDomainEvent(new ErinnerungKonfigurationUpdatedEvent(this.id.toString(), newTimeout.value, updatedBy.value));

    return Result.ok<void>(undefined);
  }
}
