import { ErinnerungKonfiguration } from '../erinnerung-konfiguration.entity';
import { EskalationsTimeout } from '../../value-objects/eskalations-timeout';
import { UserId } from '@domain/value-objects/user-id';
import { ErinnerungKonfigurationUpdatedEvent } from '../../events/erinnerung-konfiguration-updated.event';

describe('ErinnerungKonfiguration', () => {
  it('should create a default configuration', () => {
    const config = ErinnerungKonfiguration.createDefault();
    expect(config).toBeDefined();
    expect(config.eskalationsTimeout.value).toBe(5);
  });

  it('should update timeout and emit event', () => {
    const config = ErinnerungKonfiguration.createDefault();
    const newTimeout = EskalationsTimeout.create(10).value!;
    const user = UserId.create('clq4kx3z0000008l40g5z8q9z').value!;

    config.updateTimeout(newTimeout, user);

    expect(config.eskalationsTimeout.value).toBe(10);
    expect(config.updatedBy).toEqual(user);

    const events = config.getDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(ErinnerungKonfigurationUpdatedEvent);
    expect((events[0] as ErinnerungKonfigurationUpdatedEvent).newTimeoutMinutes).toBe(10);
    expect((events[0] as ErinnerungKonfigurationUpdatedEvent).updatedBy).toBe('clq4kx3z0000008l40g5z8q9z');
  });
});
