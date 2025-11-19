/**
 * Query Handlers for Lagekarte Application Layer.
 *
 * Implementiert CQRS Query-Side für Lagekarten-Lesezugriffe.
 * Query Handlers sind read-only und ändern niemals den Domain State.
 */

export { GetLagekarteQuery } from './get-lagekarte.query';
export { GetLagekarteQueryHandler } from './get-lagekarte.handler';
