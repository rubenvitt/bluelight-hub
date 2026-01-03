/**
 * Domain Ports - Hexagonal Architecture Port Interfaces.
 *
 * Ports definieren die Schnittstellen zwischen Domain Layer und Infrastructure Layer.
 * Sie ermöglichen Dependency Inversion: Domain hängt von Abstraktion (Port) ab,
 * nicht von konkreter Implementierung (Adapter).
 *
 * **Port Types:**
 * - Service Ports: Technische Services (JWT, Email, Geocoding)
 * - Repository Ports: Data Access (bereits in repositories/ definiert)
 * - Integration Ports: External APIs (z.B. Nominatim Geocoding)
 * - Event Handler Ports: Domain Event Processing (IEventHandler)
 */

export * from './i-jwt-auth-service.port';
export * from './i-event-handler.port';
export * from './i-logger.port';
export * from './i-encryption.port';
export * from './i-oauth2.port';
export * from './i-hiorg-server.port';
