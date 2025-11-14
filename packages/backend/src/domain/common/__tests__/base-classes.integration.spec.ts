/**
 * Integration Tests für Domain Layer Base Classes
 *
 * Verifiziert die Integration aller Base Classes:
 * - ValueObject<TProps>
 * - EntityId<TAggregateType>
 * - DomainEvent
 * - AggregateRoot<TId>
 *
 * Story 1.2 - Task 5: Integration & Validation
 */

// Mock nanoid for Jest ESM compatibility (domain-event.ts uses nanoid/non-secure)
jest.mock('nanoid/non-secure', () => ({
  nanoid: jest.fn(() => {
    // Generate valid nanoid format: 21 URL-safe characters
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
    let result = '';
    for (let i = 0; i < 21; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }),
}));

// Mock nanoid for EntityId (uses 'nanoid')
jest.mock('nanoid', () => ({
  nanoid: jest.fn(() => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
    let result = '';
    for (let i = 0; i < 21; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }),
}));

import { Einsatz } from '@domain/aggregates/einsatz.aggregate';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { EinsatzCreatedEvent } from '@domain/events/einsatz-created.event';
import { Result } from '@domain/common/result';

describe('Base Classes Integration', () => {
  describe('End-to-End Aggregate Creation Flow', () => {
    it('should create Einsatz aggregate with typed ID and emit domain event', () => {
      // Given: Valid Einsatz data
      const name = 'Wohnungsbrand';
      const location = 'Musterstraße 42, 12345 Berlin';

      // When: Creating Einsatz via factory method
      const result = Einsatz.create(name, location);

      // Then: Success with all base classes integrated
      expect(result.isSuccess).toBe(true);
      expect(result.isFailure).toBe(false);

      const einsatz = result.value!;

      // AggregateRoot<EinsatzId> - typed ID
      expect(einsatz.id).toBeInstanceOf(EinsatzId);
      expect(einsatz.id.value).toMatch(/^[A-Za-z0-9_-]{21}$/);

      // AggregateRoot - timestamps
      expect(einsatz.createdAt).toBeInstanceOf(Date);
      expect(einsatz.updatedAt).toBeInstanceOf(Date);

      // DomainEvent - event accumulation
      const events = einsatz.getDomainEvents();
      expect(events).toHaveLength(1);

      const createdEvent = events[0];
      expect(createdEvent).toBeInstanceOf(EinsatzCreatedEvent);

      // DomainEvent - auto-generated properties
      expect(createdEvent.eventId).toMatch(/^[A-Za-z0-9_-]{21}$/); // nanoid
      expect(createdEvent.occurredAt).toBeInstanceOf(Date);

      // EinsatzCreatedEvent - domain data
      expect((createdEvent as EinsatzCreatedEvent).einsatzId).toBe(einsatz.id.value);
      expect((createdEvent as EinsatzCreatedEvent).name).toBe(name);
      expect((createdEvent as EinsatzCreatedEvent).location).toBe(location);
    });

    it('should validate nanoid format in EntityId', () => {
      // Given: Einsatz created
      const result = Einsatz.create('Test', 'Location');

      // When: Accessing ID
      const einsatz = result.value!;
      const nanoidValue = einsatz.id.value;

      // Then: Valid nanoid format (21 URL-safe chars)
      expect(nanoidValue).toHaveLength(21);
      expect(nanoidValue).toMatch(/^[A-Za-z0-9_-]{21}$/);

      // And: No invalid characters
      expect(nanoidValue).not.toMatch(/[^A-Za-z0-9_-]/);
    });

    it('should validate nanoid format in DomainEvent', () => {
      // Given: Einsatz created with event
      const result = Einsatz.create('Test', 'Location');

      // When: Accessing event
      const event = result.value!.getDomainEvents()[0];
      const eventId = event.eventId;

      // Then: Valid nanoid format (21 URL-safe chars)
      expect(eventId).toHaveLength(21);
      expect(eventId).toMatch(/^[A-Za-z0-9_-]{21}$/);

      // And: No invalid characters
      expect(eventId).not.toMatch(/[^A-Za-z0-9_-]/);
    });
  });

  describe('Result<T> Pattern Integration', () => {
    it('should use Result pattern in Aggregate factory methods', () => {
      // Given: Valid data
      const result = Einsatz.create('Test', 'Location');

      // When: Checking result type
      // Then: Is Result<Einsatz>
      expect(result).toBeInstanceOf(Result);
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeInstanceOf(Einsatz);
    });

    it('should return Result.fail for invalid Aggregate creation', () => {
      // Given: Invalid data (empty name)
      const result = Einsatz.create('', 'Location');

      // When: Checking result
      // Then: Failure with error message
      expect(result.isFailure).toBe(true);
      expect(result.isSuccess).toBe(false);
      expect(result.error).toContain('required');
      expect(result.value).toBeUndefined();
    });

    it('should use Result pattern in EntityId.create()', () => {
      // Given: Valid nanoid
      const validNanoid = 'A1B2C3D4E5F6G7H8I9J0K';

      // When: Creating EntityId
      const result = EinsatzId.create(validNanoid);

      // Then: Success
      expect(result).toBeInstanceOf(Result);
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeInstanceOf(EinsatzId);
      expect(result.value!.value).toBe(validNanoid);
    });
  });

  describe('ValueObject Equality Integration', () => {
    it('should compare EntityIds by value (structural equality)', () => {
      // Given: Two EntityIds with same value
      const nanoid = 'A1B2C3D4E5F6G7H8I9J0K';
      const id1 = EinsatzId.create(nanoid).value!;
      const id2 = EinsatzId.create(nanoid).value!;

      // When: Comparing with equals()
      const areEqual = id1.equals(id2);

      // Then: Equal by value (not reference)
      expect(areEqual).toBe(true);
      expect(id1).not.toBe(id2); // different references
    });

    it('should compare Aggregates by ID (identity equality)', () => {
      // Given: Two Einsatz instances with different data
      const result1 = Einsatz.create('Wohnungsbrand', 'Location A');
      const result2 = Einsatz.create('Verkehrsunfall', 'Location B');

      const einsatz1 = result1.value!;
      const einsatz2 = result2.value!;

      // When: Comparing with equals()
      const areEqual = einsatz1.equals(einsatz2);

      // Then: Not equal (different IDs)
      expect(areEqual).toBe(false);
      expect(einsatz1.id.equals(einsatz2.id)).toBe(false);
    });

    it('should recognize same Aggregate by ID despite property changes', () => {
      // Given: Einsatz created
      const result = Einsatz.create('Original Name', 'Original Location');
      const einsatz1 = result.value!;

      // When: Creating second instance with same ID (simulation)
      const einsatz2 = result.value!; // same instance in this test

      // Then: Equal by ID (identity equality)
      expect(einsatz1.equals(einsatz2)).toBe(true);
      expect(einsatz1.id.equals(einsatz2.id)).toBe(true);
    });
  });

  describe('Event Accumulation Integration', () => {
    it('should accumulate multiple events from business operations', () => {
      // Given: Einsatz created
      const result = Einsatz.create('Wohnungsbrand', 'Location');
      const einsatz = result.value!;

      // When: Performing business operations
      einsatz.updateName('Großbrand');
      einsatz.updateLocation('New Location');
      einsatz.updateStatus('In Progress');

      // Then: All events accumulated
      const events = einsatz.getDomainEvents();
      expect(events).toHaveLength(4); // Created + 3 Updates

      // And: Events in chronological order
      expect(events[0]).toBeInstanceOf(EinsatzCreatedEvent);
      // Remaining are EinsatzUpdatedEvent instances
    });

    it('should clear events after publishing (workflow simulation)', () => {
      // Given: Einsatz with accumulated events
      const result = Einsatz.create('Test', 'Location');
      const einsatz = result.value!;
      einsatz.updateName('Updated');

      expect(einsatz.getDomainEvents()).toHaveLength(2);

      // When: Simulating event publishing (infrastructure layer)
      const eventsToPub = einsatz.getDomainEvents();
      // ... publish to event bus ...
      einsatz.clearDomainEvents();

      // Then: Events cleared
      expect(einsatz.getDomainEvents()).toHaveLength(0);

      // And: Published events still available (shallow copy!)
      expect(eventsToPub).toHaveLength(2);
    });
  });

  describe('Type Safety Integration', () => {
    it('should enforce type-safe IDs at compile time', () => {
      // Given: EinsatzId
      const einsatzId = EinsatzId.create().value!;

      // When: Using in type-safe function
      const processEinsatz = (id: EinsatzId): string => id.value;

      // Then: Accepts EinsatzId only (TypeScript enforces this)
      const result = processEinsatz(einsatzId);
      expect(result).toBe(einsatzId.value);

      // Note: TypeScript would reject UserId here at compile-time
      // const userId = UserId.create().value!;
      // processEinsatz(userId); // ❌ Compile Error!
    });

    it('should enforce Generic constraint TId extends EntityId<any>', () => {
      // Given: Einsatz extends AggregateRoot<EinsatzId>
      const result = Einsatz.create('Test', 'Location');
      const einsatz = result.value!;

      // When: Accessing id property
      const id = einsatz.id;

      // Then: id is EinsatzId (type-safe)
      expect(id).toBeInstanceOf(EinsatzId);

      // Note: TypeScript enforces TId extends EntityId<any>
      // AggregateRoot<string> would be compile error!
    });
  });

  describe('Cross-Class Dependencies', () => {
    it('should verify all base classes work together seamlessly', () => {
      // Given: Complete workflow
      const result = Einsatz.create('Wohnungsbrand', 'Location');

      // When: Accessing all layers
      const einsatz = result.value!;
      const id = einsatz.id; // EntityId<'Einsatz'>
      const events = einsatz.getDomainEvents(); // DomainEvent[]
      const event = events[0] as EinsatzCreatedEvent;

      // Then: All base classes integrated
      // 1. Result<T> - error handling
      expect(result.isSuccess).toBe(true);

      // 2. AggregateRoot<TId> - aggregate pattern
      expect(einsatz.id).toBeDefined();
      expect(einsatz.createdAt).toBeDefined();

      // 3. EntityId<T> - typed IDs
      expect(id).toBeInstanceOf(EinsatzId);
      expect(id.value).toHaveLength(21);

      // 4. ValueObject - structural equality
      const sameId = EinsatzId.create(id.value).value!;
      expect(id.equals(sameId)).toBe(true);

      // 5. DomainEvent - event sourcing
      expect(event.eventId).toHaveLength(21);
      expect(event.occurredAt).toBeInstanceOf(Date);
      expect(EinsatzCreatedEvent.eventName()).toBe('EinsatzCreated');
    });
  });
});
