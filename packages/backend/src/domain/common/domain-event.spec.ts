import { DomainEvent } from '@domain/common/domain-event';

// Mock nanoid for Jest compatibility (ESM module issue)
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

// Concrete Test Event Classes (für Testing der Abstract Base Class)
class TestCreatedEvent extends DomainEvent {
  constructor(
    public readonly testId: string,
    public readonly testName: string,
    aggregateId?: string,
  ) {
    super(aggregateId);
  }

  static eventName(): string {
    return 'TestCreated';
  }
}

class TestUpdatedEvent extends DomainEvent {
  constructor(
    public readonly testId: string,
    public readonly updates: { name?: string },
    aggregateId?: string,
  ) {
    super(aggregateId);
  }

  static eventName(): string {
    return 'TestUpdated';
  }

  // Override eventVersion for testing
  static eventVersion(): number {
    return 2;
  }
}

describe('DomainEvent', () => {
  describe('Auto-Generation', () => {
    it('should auto-generate eventId with valid nanoid (21 chars)', () => {
      // Given: Event creation
      const event = new TestCreatedEvent('test-123', 'Test Name');

      // When: Checking eventId
      const eventId = event.eventId;

      // Then: eventId is valid nanoid (exactly 21 URL-safe chars)
      expect(eventId).toBeDefined();
      expect(eventId).toHaveLength(21);
      expect(eventId).toMatch(/^[A-Za-z0-9_-]{21}$/);
    });

    it('should auto-generate occurredAt with recent timestamp', () => {
      // Given: Current time before event creation
      const beforeCreation = new Date();

      // When: Creating event
      const event = new TestCreatedEvent('test-123', 'Test Name');

      // Then: occurredAt is recent timestamp (within 100ms)
      const afterCreation = new Date();
      expect(event.occurredAt).toBeInstanceOf(Date);
      expect(event.occurredAt.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
      expect(event.occurredAt.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
    });

    it('should generate unique eventIds for multiple events', () => {
      // Given: Creating 100 events
      const events = Array.from({ length: 100 }, (_, i) => new TestCreatedEvent(`test-${i}`, `Test ${i}`));

      // When: Extracting all eventIds
      const eventIds = events.map((e) => e.eventId);

      // Then: All eventIds are unique (no duplicates)
      const uniqueIds = new Set(eventIds);
      expect(uniqueIds.size).toBe(100);
    });

    it('should respect chronological order for occurredAt', async () => {
      // Given: Creating two events with 10ms delay
      const event1 = new TestCreatedEvent('test-1', 'First');
      await new Promise((resolve) => setTimeout(resolve, 10));
      const event2 = new TestCreatedEvent('test-2', 'Second');

      // When: Comparing timestamps
      const timestamp1 = event1.occurredAt.getTime();
      const timestamp2 = event2.occurredAt.getTime();

      // Then: First event has earlier timestamp
      expect(timestamp1).toBeLessThan(timestamp2);
    });
  });

  describe('Immutability', () => {
    it('should have readonly eventId property enforced by TypeScript', () => {
      // Given: Event with auto-generated eventId
      const event = new TestCreatedEvent('test-123', 'Test Name');
      const originalEventId = event.eventId;

      // When: Reading eventId
      const readEventId = event.eventId;

      // Then: eventId is accessible and unchanged
      expect(readEventId).toBe(originalEventId);
      expect(event.eventId).toBe(originalEventId);

      // Note: TypeScript readonly prevents modification at compile-time
      // Runtime enforcement not possible without Object.freeze() or setters
      // @ts-expect-error - Testing compile-time readonly enforcement
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _compileError = () => {
        event.eventId = 'new-id';
      };
    });

    it('should have readonly occurredAt property enforced by TypeScript', () => {
      // Given: Event with auto-generated occurredAt
      const event = new TestCreatedEvent('test-123', 'Test Name');
      const originalOccurredAt = event.occurredAt;

      // When: Reading occurredAt
      const readOccurredAt = event.occurredAt;

      // Then: occurredAt is accessible and unchanged
      expect(readOccurredAt).toBe(originalOccurredAt);
      expect(event.occurredAt).toBe(originalOccurredAt);

      // Note: TypeScript readonly prevents modification at compile-time
      // @ts-expect-error - Testing compile-time readonly enforcement
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _compileError = () => {
        event.occurredAt = new Date();
      };
    });

    it('should have readonly aggregateId property enforced by TypeScript', () => {
      // Given: Event with aggregateId
      const event = new TestCreatedEvent('test-123', 'Test Name', 'aggregate-123');
      const originalAggregateId = event.aggregateId;

      // When: Reading aggregateId
      const readAggregateId = event.aggregateId;

      // Then: aggregateId is accessible and unchanged
      expect(readAggregateId).toBe(originalAggregateId);
      expect(event.aggregateId).toBe(originalAggregateId);

      // Note: TypeScript readonly prevents modification at compile-time
      // @ts-expect-error - Testing compile-time readonly enforcement
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _compileError = () => {
        event.aggregateId = 'new-aggregate';
      };
    });
  });

  describe('Optional aggregateId', () => {
    it('should accept optional aggregateId parameter', () => {
      // Given: Event with aggregateId
      const aggregateId = 'aggregate-123';

      // When: Creating event with aggregateId
      const event = new TestCreatedEvent('test-123', 'Test Name', aggregateId);

      // Then: aggregateId is set
      expect(event.aggregateId).toBe(aggregateId);
    });

    it('should allow undefined aggregateId', () => {
      // Given: Event without aggregateId
      // When: Creating event without aggregateId parameter
      const event = new TestCreatedEvent('test-123', 'Test Name');

      // Then: aggregateId is undefined
      expect(event.aggregateId).toBeUndefined();
    });
  });

  describe('Concrete Event Classes', () => {
    it('should support custom properties in concrete events', () => {
      // Given: Concrete event with domain-specific properties
      const testId = 'test-123';
      const testName = 'Test Name';

      // When: Creating concrete event
      const event = new TestCreatedEvent(testId, testName);

      // Then: Custom properties are accessible
      expect(event.testId).toBe(testId);
      expect(event.testName).toBe(testName);
    });

    it('should support partial updates in concrete events', () => {
      // Given: Update event with partial data
      const testId = 'test-123';
      const updates = { name: 'Updated Name' };

      // When: Creating update event
      const event = new TestUpdatedEvent(testId, updates);

      // Then: Partial updates are accessible
      expect(event.testId).toBe(testId);
      expect(event.updates).toEqual(updates);
      expect(event.updates.name).toBe('Updated Name');
    });
  });

  describe('Static Methods', () => {
    it('should throw error when calling eventName on base DomainEvent class', () => {
      // Given: Base DomainEvent class
      // When: Calling static eventName() without override
      // Then: Error is thrown with helpful message
      expect(() => DomainEvent.eventName()).toThrow('DomainEvent must override static eventName() method. Event names must be in past tense (e.g., "EinsatzCreated", not "CreateEinsatz").');
    });

    it('should return correct eventName from concrete class', () => {
      // Given: TestCreatedEvent class
      // When: Calling static eventName()
      const eventName = TestCreatedEvent.eventName();

      // Then: eventName is "TestCreated"
      expect(eventName).toBe('TestCreated');
    });

    it('should support different eventNames for different event types', () => {
      // Given: Multiple event types
      // When: Calling eventName() on each
      const createdName = TestCreatedEvent.eventName();
      const updatedName = TestUpdatedEvent.eventName();

      // Then: Each event has unique name
      expect(createdName).toBe('TestCreated');
      expect(updatedName).toBe('TestUpdated');
      expect(createdName).not.toBe(updatedName);
    });

    it('should return default eventVersion 1', () => {
      // Given: Base DomainEvent class
      // When: Calling static eventVersion()
      const version = DomainEvent.eventVersion();

      // Then: Default version is 1
      expect(version).toBe(1);
    });

    it('should support overriding eventVersion in concrete classes', () => {
      // Given: TestUpdatedEvent with overridden eventVersion
      // When: Calling static eventVersion()
      const version = TestUpdatedEvent.eventVersion();

      // Then: Version is 2 (overridden)
      expect(version).toBe(2);
    });

    it('should maintain default eventVersion for classes without override', () => {
      // Given: TestCreatedEvent without eventVersion override
      // When: Calling static eventVersion()
      const version = TestCreatedEvent.eventVersion();

      // Then: Version is 1 (default)
      expect(version).toBe(1);
    });
  });

  describe('Event Naming Convention', () => {
    it('should use past tense for event names', () => {
      // Given: Concrete event classes
      // When: Checking eventName()
      const createdName = TestCreatedEvent.eventName();
      const updatedName = TestUpdatedEvent.eventName();

      // Then: Event names are past tense (Created/Updated, not Create/Update)
      expect(createdName).toMatch(/Created$/);
      expect(updatedName).toMatch(/Updated$/);
    });
  });

  describe('Event Properties Access', () => {
    it('should allow reading all auto-generated properties', () => {
      // Given: Created event
      const event = new TestCreatedEvent('test-123', 'Test Name', 'aggregate-123');

      // When: Accessing all properties
      const eventId = event.eventId;
      const occurredAt = event.occurredAt;
      const aggregateId = event.aggregateId;
      const testId = event.testId;
      const testName = event.testName;

      // Then: All properties are accessible
      expect(eventId).toBeDefined();
      expect(occurredAt).toBeInstanceOf(Date);
      expect(aggregateId).toBe('aggregate-123');
      expect(testId).toBe('test-123');
      expect(testName).toBe('Test Name');
    });
  });
});
