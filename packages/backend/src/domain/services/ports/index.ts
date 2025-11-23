/**
 * Domain Services Ports (Hexagonale Architektur).
 *
 * Diese Barrel-Datei exportiert alle Port Interfaces für die Domain-Schicht.
 * Ports definieren Schnittstellen (WAS), die von der Infrastructure-Schicht
 * implementiert werden (WIE) - Dependency Inversion Principle.
 */

export type { IEventPublisher } from './i-event-publisher.port';
export type { IGeocodingPort } from './i-geocoding.port';
export type { ITokenServicePort } from './i-token-service.port';
