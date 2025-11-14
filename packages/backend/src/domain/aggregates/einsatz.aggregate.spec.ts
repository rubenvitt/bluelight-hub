import { describe, it, expect, beforeEach } from '@jest/globals';

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

import { Einsatz } from './einsatz.aggregate';
import { EinsatzCreatedEvent } from '@domain/events/einsatz-created.event';
import { EinsatzUpdatedEvent } from '@domain/events/einsatz-updated.event';
import { EinsatzId } from '@domain/value-objects/einsatz-id';

describe('Einsatz Aggregate', () => {
  describe('Factory Method - create()', () => {
    it('Given valid name, When creating Einsatz, Then should return success Result with Einsatz', () => {
      // Given
      const name = 'Wohnungsbrand';
      const location = 'Musterstraße 42';

      // When
      const result = Einsatz.create(name, location);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeInstanceOf(Einsatz);
      expect(result.value!.name).toBe(name);
      expect(result.value!.location).toBe(location);
    });

    it('Given name without location, When creating Einsatz, Then should succeed with undefined location', () => {
      // Given
      const name = 'Verkehrsunfall';

      // When
      const result = Einsatz.create(name);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.name).toBe(name);
      expect(result.value!.location).toBeUndefined();
    });

    it('Given name with status, When creating Einsatz, Then should succeed with status', () => {
      // Given
      const name = 'Großbrand';
      const location = 'Industriestraße 10';
      const status = 'offen';

      // When
      const result = Einsatz.create(name, location, status);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.status).toBe(status);
    });

    it('Given empty name, When creating Einsatz, Then should fail with error', () => {
      // Given
      const name = '';

      // When
      const result = Einsatz.create(name);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Einsatz name is required and must not be empty');
    });

    it('Given whitespace-only name, When creating Einsatz, Then should fail with error', () => {
      // Given
      const name = '   ';

      // When
      const result = Einsatz.create(name);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Einsatz name is required and must not be empty');
    });

    it('Given name with leading/trailing whitespace, When creating Einsatz, Then should trim name', () => {
      // Given
      const name = '  Wohnungsbrand  ';

      // When
      const result = Einsatz.create(name);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.name).toBe('Wohnungsbrand');
    });
  });

  describe('Domain Events - Creation', () => {
    it('Given valid parameters, When creating Einsatz, Then should emit EinsatzCreatedEvent', () => {
      // Given
      const name = 'Wohnungsbrand';
      const location = 'Musterstraße 42';

      // When
      const einsatz = Einsatz.create(name, location).value!;
      const events = einsatz.getDomainEvents();

      // Then
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(EinsatzCreatedEvent);

      const createdEvent = events[0] as EinsatzCreatedEvent;
      expect(createdEvent.einsatzId).toBe(einsatz.id.value);
      expect(createdEvent.name).toBe(name);
      expect(createdEvent.location).toBe(location);
      expect(EinsatzCreatedEvent.eventName()).toBe('EinsatzCreated');
    });

    it('Given creation without location, When creating Einsatz, Then event should have empty location', () => {
      // Given
      const name = 'Verkehrsunfall';

      // When
      const einsatz = Einsatz.create(name).value!;
      const events = einsatz.getDomainEvents();

      // Then
      const createdEvent = events[0] as EinsatzCreatedEvent;
      expect(createdEvent.location).toBe('');
    });
  });

  describe('Business Method - updateName()', () => {
    let einsatz: Einsatz;

    beforeEach(() => {
      einsatz = Einsatz.create('Wohnungsbrand').value!;
      einsatz.clearDomainEvents(); // Clear creation event
    });

    it('Given valid new name, When updating name, Then should change name and emit event', () => {
      // Given
      const newName = 'Großbrand';

      // When
      einsatz.updateName(newName);

      // Then
      expect(einsatz.name).toBe(newName);

      const events = einsatz.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(EinsatzUpdatedEvent);

      const updatedEvent = events[0] as EinsatzUpdatedEvent;
      expect(updatedEvent.einsatzId).toBe(einsatz.id.value);
      expect(updatedEvent.updates.name).toBe(newName);
      expect(updatedEvent.updates.location).toBeUndefined();
      expect(updatedEvent.updates.status).toBeUndefined();
    });

    it('Given name with whitespace, When updating name, Then should trim whitespace', () => {
      // Given
      const newName = '  Großbrand  ';

      // When
      einsatz.updateName(newName);

      // Then
      expect(einsatz.name).toBe('Großbrand');
    });

    it('Given empty name, When updating name, Then should throw error', () => {
      // Given
      const emptyName = '';

      // When & Then
      expect(() => einsatz.updateName(emptyName)).toThrow('Einsatz name is required and must not be empty');
    });

    it('Given whitespace-only name, When updating name, Then should throw error', () => {
      // Given
      const whitespace = '   ';

      // When & Then
      expect(() => einsatz.updateName(whitespace)).toThrow('Einsatz name is required and must not be empty');
    });

    it('Given multiple name updates, When calling updateName multiple times, Then should accumulate events', () => {
      // Given & When
      einsatz.updateName('Großbrand');
      einsatz.updateName('Waldbrand');
      einsatz.updateName('Flächenbrand');

      // Then
      const events = einsatz.getDomainEvents();
      expect(events).toHaveLength(3);
      expect(events.every((e) => e instanceof EinsatzUpdatedEvent)).toBe(true);
    });
  });

  describe('Business Method - updateLocation()', () => {
    let einsatz: Einsatz;

    beforeEach(() => {
      einsatz = Einsatz.create('Wohnungsbrand', 'Alte Straße 1').value!;
      einsatz.clearDomainEvents();
    });

    it('Given new location, When updating location, Then should change location and emit event', () => {
      // Given
      const newLocation = 'Neue Straße 123';

      // When
      einsatz.updateLocation(newLocation);

      // Then
      expect(einsatz.location).toBe(newLocation);

      const events = einsatz.getDomainEvents();
      expect(events).toHaveLength(1);

      const updatedEvent = events[0] as EinsatzUpdatedEvent;
      expect(updatedEvent.updates.location).toBe(newLocation);
      expect(updatedEvent.updates.name).toBeUndefined();
      expect(updatedEvent.updates.status).toBeUndefined();
    });

    it('Given empty location, When updating location, Then should accept empty string', () => {
      // Given
      const emptyLocation = '';

      // When
      einsatz.updateLocation(emptyLocation);

      // Then
      expect(einsatz.location).toBe('');
    });
  });

  describe('Business Method - updateStatus()', () => {
    let einsatz: Einsatz;

    beforeEach(() => {
      einsatz = Einsatz.create('Wohnungsbrand').value!;
      einsatz.clearDomainEvents();
    });

    it('Given new status, When updating status, Then should change status and emit event', () => {
      // Given
      const newStatus = 'in Bearbeitung';

      // When
      einsatz.updateStatus(newStatus);

      // Then
      expect(einsatz.status).toBe(newStatus);

      const events = einsatz.getDomainEvents();
      expect(events).toHaveLength(1);

      const updatedEvent = events[0] as EinsatzUpdatedEvent;
      expect(updatedEvent.updates.status).toBe(newStatus);
      expect(updatedEvent.updates.name).toBeUndefined();
      expect(updatedEvent.updates.location).toBeUndefined();
    });

    it('Given status transitions, When updating status multiple times, Then should track all changes', () => {
      // Given & When
      einsatz.updateStatus('offen');
      einsatz.updateStatus('in Bearbeitung');
      einsatz.updateStatus('abgeschlossen');

      // Then
      expect(einsatz.status).toBe('abgeschlossen');

      const events = einsatz.getDomainEvents();
      expect(events).toHaveLength(3);

      const statusUpdates = events.map((e) => (e as EinsatzUpdatedEvent).updates.status);
      expect(statusUpdates).toEqual(['offen', 'in Bearbeitung', 'abgeschlossen']);
    });
  });

  describe('Aggregate Root Properties', () => {
    it('Given created Einsatz, When accessing id, Then should return EinsatzId instance', () => {
      // Given
      const einsatz = Einsatz.create('Wohnungsbrand').value!;

      // When
      const id = einsatz.id;

      // Then
      expect(id).toBeInstanceOf(EinsatzId);
      expect(id.value).toMatch(/^[A-Za-z0-9_-]{21}$/);
    });

    it('Given created Einsatz, When accessing timestamps, Then should have valid createdAt and updatedAt', () => {
      // Given
      const before = new Date();

      // When
      const einsatz = Einsatz.create('Wohnungsbrand').value!;
      const after = new Date();

      // Then
      expect(einsatz.createdAt).toBeInstanceOf(Date);
      expect(einsatz.updatedAt).toBeInstanceOf(Date);
      expect(einsatz.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(einsatz.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('Given two Einsatz instances, When comparing by ID, Then should use identity equality', () => {
      // Given
      const einsatz1 = Einsatz.create('Wohnungsbrand').value!;
      const einsatz2 = Einsatz.create('Verkehrsunfall').value!;

      // When
      const sameInstance = einsatz1.equals(einsatz1);
      const differentInstances = einsatz1.equals(einsatz2);

      // Then
      expect(sameInstance).toBe(true);
      expect(differentInstances).toBe(false);
    });
  });

  describe('Event Workflow Integration', () => {
    it('Given full workflow, When creating and updating Einsatz, Then should accumulate all events', () => {
      // Given & When: Create
      const einsatz = Einsatz.create('Wohnungsbrand', 'Musterstraße 42').value!;

      // When: Update operations
      einsatz.updateName('Großbrand');
      einsatz.updateLocation('Neue Straße 123');
      einsatz.updateStatus('in Bearbeitung');

      // Then: All events accumulated
      const events = einsatz.getDomainEvents();
      expect(events).toHaveLength(4); // 1 created + 3 updated

      expect(events[0]).toBeInstanceOf(EinsatzCreatedEvent);
      expect(events[1]).toBeInstanceOf(EinsatzUpdatedEvent);
      expect(events[2]).toBeInstanceOf(EinsatzUpdatedEvent);
      expect(events[3]).toBeInstanceOf(EinsatzUpdatedEvent);
    });

    it('Given workflow with event clearing, When clearing after publishing, Then events should be removed', () => {
      // Given
      const einsatz = Einsatz.create('Wohnungsbrand').value!;
      einsatz.updateName('Großbrand');
      expect(einsatz.getDomainEvents()).toHaveLength(2);

      // When: Simulate event publishing + clearing
      einsatz.clearDomainEvents();

      // Then
      expect(einsatz.getDomainEvents()).toHaveLength(0);

      // When: New events after clearing
      einsatz.updateStatus('abgeschlossen');

      // Then: Only new event
      expect(einsatz.getDomainEvents()).toHaveLength(1);
    });
  });
});
