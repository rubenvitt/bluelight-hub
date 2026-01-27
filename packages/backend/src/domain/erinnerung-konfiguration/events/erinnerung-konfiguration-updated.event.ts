import { DomainEvent } from '@domain/common/domain-event';

export class ErinnerungKonfigurationUpdatedEvent extends DomainEvent {
  constructor(
    public readonly konfigurationId: string,
    public readonly newTimeoutMinutes: number,
    public readonly updatedBy: string,
  ) {
    super(konfigurationId, new Date());
  }
}
