// Mock cuid2 for Jest compatibility (ESM module issue) - MUST be before imports
jest.mock('@paralleldrive/cuid2', () => ({
  createId: jest.fn(() => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'c';
    for (let i = 0; i < 24; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }),
  isCuid: jest.fn((id: string) => {
    if (typeof id !== 'string') return false;
    if (id.length < 20 || id.length > 30) return false;
    return /^[a-z][a-z0-9]+$/.test(id);
  }),
}));

import { describe, it, expect, beforeEach } from '@jest/globals';

import { AggregateRoot } from './aggregate-root';
import { EntityId } from './entity-id';
import { DomainEvent } from './domain-event';
import { Result } from './result';

// Test EntityId für Testing
class TestId extends EntityId<'Test'> {}

// Test DomainEvent für Testing
class TestEvent extends DomainEvent {
  constructor(
    public readonly testData: string,
    aggregateId?: string,
  ) {
    super(aggregateId);
  }

  static eventName(): string {
    return 'TestEvent';
  }
}

// Concrete Test Aggregate für Testing
class TestAggregate extends AggregateRoot<TestId> {
  private constructor(
    id: TestId,
    private _value: string,
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    super(id, createdAt, updatedAt);
  }

  static create(value: string): Result<TestAggregate> {
    if (!value || value.trim().length === 0) {
      return Result.fail('Value is required');
    }

    const idResult = TestId.create();
    if (idResult.isFailure) {
      return Result.fail(idResult.error!);
    }

    const aggregate = new TestAggregate(idResult.value!, value);
    aggregate.addDomainEvent(new TestEvent('created', idResult.value!.value));
    return Result.ok(aggregate);
  }

  get value(): string {
    return this._value;
  }

  updateValue(value: string): void {
    this._value = value;
    this.addDomainEvent(new TestEvent('updated', this.id.value));
  }

  // Public wrapper für protected addDomainEvent (für Testing)
  public testAddEvent(event: DomainEvent): void {
    this.addDomainEvent(event);
  }
}

describe('AggregateRoot<TId>', () => {
  describe('Constructor & Properties', () => {
    it('Given valid parameters, When creating aggregate, Then should initialize id, createdAt, updatedAt', () => {
      // Given
      const _idResult = TestId.create();
      const _id = _idResult.value;
      const _createdAt = new Date('2024-01-01');
      const _updatedAt = new Date('2024-01-02');

      // When
      const aggregate = TestAggregate.create('test').value!;

      // Then
      expect(aggregate.id).toBeDefined();
      expect(aggregate.id).toBeInstanceOf(TestId);
      expect(aggregate.createdAt).toBeInstanceOf(Date);
      expect(aggregate.updatedAt).toBeInstanceOf(Date);
    });

    it('Given no timestamps, When creating aggregate, Then should auto-generate createdAt and updatedAt', () => {
      // Given & When
      const before = new Date();
      const aggregate = TestAggregate.create('test').value!;
      const after = new Date();

      // Then
      expect(aggregate.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(aggregate.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(aggregate.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(aggregate.updatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('Given aggregate created, When accessing id, Then should return readonly id', () => {
      // Given
      const aggregate = TestAggregate.create('test').value!;

      // When
      const id = aggregate.id;

      // Then
      expect(id).toBeInstanceOf(TestId);
      expect(id.value).toMatch(/^[a-z][a-z0-9]{19,29}$/);
    });
  });

  describe('Event Accumulation', () => {
    let aggregate: TestAggregate;

    beforeEach(() => {
      aggregate = TestAggregate.create('test').value!;
      // Clear creation event für saubere Tests
      aggregate.clearDomainEvents();
    });

    it('Given aggregate, When adding 2 events, Then getDomainEvents should return 2 events in order', () => {
      // Given (aggregate from beforeEach)

      // When
      const event1 = new TestEvent('first');
      const event2 = new TestEvent('second');
      aggregate.testAddEvent(event1);
      aggregate.testAddEvent(event2);

      // Then
      const events = aggregate.getDomainEvents();
      expect(events).toHaveLength(2);
      expect(events[0]).toBe(event1);
      expect(events[1]).toBe(event2);
    });

    it('Given aggregate with no events, When calling getDomainEvents, Then should return empty array', () => {
      // Given (aggregate from beforeEach, events cleared)

      // When
      const events = aggregate.getDomainEvents();

      // Then
      expect(events).toHaveLength(0);
      expect(events).toEqual([]);
    });

    it('Given aggregate with events, When calling getDomainEvents multiple times, Then should return consistent results', () => {
      // Given
      aggregate.testAddEvent(new TestEvent('test'));

      // When
      const events1 = aggregate.getDomainEvents();
      const events2 = aggregate.getDomainEvents();

      // Then
      expect(events1).toHaveLength(1);
      expect(events2).toHaveLength(1);
      expect(events1[0]).toBe(events2[0]); // Same event instance
    });
  });

  describe('getDomainEvents() Shallow Copy (CRITICAL!)', () => {
    let aggregate: TestAggregate;

    beforeEach(() => {
      aggregate = TestAggregate.create('test').value!;
      aggregate.clearDomainEvents();
    });

    it('Given aggregate with 2 events, When calling getDomainEvents twice, Then should return different array instances', () => {
      // Given
      aggregate.testAddEvent(new TestEvent('event1'));
      aggregate.testAddEvent(new TestEvent('event2'));

      // When
      const events1 = aggregate.getDomainEvents();
      const events2 = aggregate.getDomainEvents();

      // Then
      expect(events1).not.toBe(events2); // Different array instances
      expect(events1).toEqual(events2); // But same content
    });

    it('Given aggregate with events, When mutating returned array, Then original events should remain unchanged', () => {
      // Given
      aggregate.testAddEvent(new TestEvent('event1'));
      aggregate.testAddEvent(new TestEvent('event2'));

      // When
      const events = aggregate.getDomainEvents();
      events.push(new TestEvent('malicious-event')); // Mutate copy

      // Then
      const originalEvents = aggregate.getDomainEvents();
      expect(originalEvents).toHaveLength(2); // Original unchanged
      expect(events).toHaveLength(3); // Copy mutated
    });

    it('Given aggregate with events, When clearing returned array, Then original events should remain unchanged', () => {
      // Given
      aggregate.testAddEvent(new TestEvent('event1'));
      aggregate.testAddEvent(new TestEvent('event2'));

      // When
      const events = aggregate.getDomainEvents();
      events.length = 0; // Clear copy

      // Then
      const originalEvents = aggregate.getDomainEvents();
      expect(originalEvents).toHaveLength(2); // Original unchanged
      expect(events).toHaveLength(0); // Copy cleared
    });
  });

  describe('clearDomainEvents()', () => {
    let aggregate: TestAggregate;

    beforeEach(() => {
      aggregate = TestAggregate.create('test').value!;
      aggregate.clearDomainEvents();
    });

    it('Given aggregate with 3 events, When calling clearEvents, Then getDomainEvents should return empty array', () => {
      // Given
      aggregate.testAddEvent(new TestEvent('event1'));
      aggregate.testAddEvent(new TestEvent('event2'));
      aggregate.testAddEvent(new TestEvent('event3'));
      expect(aggregate.getDomainEvents()).toHaveLength(3);

      // When
      aggregate.clearDomainEvents();

      // Then
      const events = aggregate.getDomainEvents();
      expect(events).toHaveLength(0);
      expect(events).toEqual([]);
    });

    it('Given aggregate with no events, When calling clearEvents, Then should not throw error', () => {
      // Given (aggregate from beforeEach, no events)

      // When & Then
      expect(() => aggregate.clearDomainEvents()).not.toThrow();
      expect(aggregate.getDomainEvents()).toHaveLength(0);
    });

    it('Given aggregate with cleared events, When adding new event, Then should accumulate again', () => {
      // Given
      aggregate.testAddEvent(new TestEvent('event1'));
      aggregate.clearDomainEvents();

      // When
      aggregate.testAddEvent(new TestEvent('event2'));

      // Then
      const events = aggregate.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0].testData).toBe('event2');
    });
  });

  describe('Identity Equality', () => {
    it('Given same aggregate instance, When calling equals, Then should return true', () => {
      // Given
      const aggregate = TestAggregate.create('test').value!;

      // When
      const result = aggregate.equals(aggregate);

      // Then
      expect(result).toBe(true);
    });

    it('Given two aggregates with same ID, When calling equals, Then should return true despite different state', () => {
      // Given
      const idResult = TestId.create();
      const id = idResult.value!;

      // Create two aggregates with SAME ID but different values
      const aggregate1 = TestAggregate.create('value1').value!;
      const aggregate2 = TestAggregate.create('value2').value!;

      // Hack: Replace IDs to make them equal (for testing)
      // @ts-expect-error - Private field access for testing
      aggregate1._id = id;
      // @ts-expect-error - Private field access for testing
      aggregate2._id = id;

      // When
      const result = aggregate1.equals(aggregate2);

      // Then
      expect(result).toBe(true); // Same ID = Equal (despite different values)
      expect(aggregate1.value).not.toBe(aggregate2.value); // Different state
    });

    it('Given two aggregates with different IDs, When calling equals, Then should return false', () => {
      // Given
      const aggregate1 = TestAggregate.create('test1').value!;
      const aggregate2 = TestAggregate.create('test2').value!;

      // When
      const result = aggregate1.equals(aggregate2);

      // Then
      expect(result).toBe(false);
      expect(aggregate1.id.equals(aggregate2.id)).toBe(false);
    });

    it('Given aggregate and undefined, When calling equals, Then should return false', () => {
      // Given
      const aggregate = TestAggregate.create('test').value!;

      // When
      const result = aggregate.equals(undefined);

      // Then
      expect(result).toBe(false);
    });

    it('Given aggregate and null, When calling equals, Then should return false', () => {
      // Given
      const aggregate = TestAggregate.create('test').value!;

      // When
      // @ts-expect-error - Testing null explicitly
      const result = aggregate.equals(null);

      // Then
      expect(result).toBe(false);
    });
  });

  describe('Concrete Aggregate Business Logic', () => {
    it('Given valid value, When creating TestAggregate, Then should emit TestEvent', () => {
      // Given & When
      const aggregate = TestAggregate.create('test-value').value!;

      // Then
      const events = aggregate.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(TestEvent);
      expect((events[0] as TestEvent).testData).toBe('created');
    });

    it('Given empty value, When creating TestAggregate, Then should fail validation', () => {
      // Given & When
      const result = TestAggregate.create('');

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Value is required');
    });

    it('Given aggregate, When calling business method, Then should emit event', () => {
      // Given
      const aggregate = TestAggregate.create('initial').value!;
      aggregate.clearDomainEvents(); // Clear creation event

      // When
      aggregate.updateValue('updated');

      // Then
      expect(aggregate.value).toBe('updated');
      const events = aggregate.getDomainEvents();
      expect(events).toHaveLength(1);
      expect((events[0] as TestEvent).testData).toBe('updated');
    });

    it('Given aggregate, When calling multiple business methods, Then should accumulate events', () => {
      // Given
      const aggregate = TestAggregate.create('initial').value!;
      aggregate.clearDomainEvents();

      // When
      aggregate.updateValue('update1');
      aggregate.updateValue('update2');
      aggregate.updateValue('update3');

      // Then
      const events = aggregate.getDomainEvents();
      expect(events).toHaveLength(3);
      expect(events.every((e) => e instanceof TestEvent)).toBe(true);
    });
  });

  describe('Protected Constructor Enforcement', () => {
    it('Given TestAggregate class, When trying direct instantiation, Then TypeScript should prevent it', () => {
      // This test verifies TypeScript compile-time behavior
      // If this code compiles, the test fails!

      // @ts-expect-error - Constructor is private, should not be accessible
      const aggregate = new TestAggregate(TestId.create().value!, 'test');

      // Runtime check (in case TypeScript is bypassed)
      expect(aggregate).toBeDefined(); // Would work if @ts-expect-error removed
    });
  });
});
