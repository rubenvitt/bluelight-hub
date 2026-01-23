// GetActiveEinsaetze
export { GetActiveEinsaetzeQuery, GetActiveEinsaetzeQueryHandler } from './get-active-einsaetze';

// GetAllEinsaetze (Paginated with Filters)
export { GetAllEinsaetzeQuery, GetAllEinsaetzeQueryHandler } from './get-all-einsaetze';

// GetEinsatzById
export { GetEinsatzByIdQuery, GetEinsatzByIdQueryHandler } from './get-einsatz-by-id';

// GetEinsatzByNummer
export { GetEinsatzByNummerQuery, GetEinsatzByNummerQueryHandler } from './get-einsatz-by-nummer';

// GetEinsatzDetails
export { GetEinsatzDetailsQuery, GetEinsatzDetailsQueryHandler } from './get-einsatz-details';

// GetActiveEinsaetzeWithCounts (Story 4-3b: Combined Queries)
export { GetActiveEinsaetzeWithCountsQuery, GetActiveEinsaetzeWithCountsQueryHandler } from './get-active-einsaetze-with-counts';

// GetStatusCounts (Story 4-8: Status Statistics)
export { GetStatusCountsQuery, GetStatusCountsQueryHandler } from './get-status-counts';

// GetEinsatzCompleteness (Story 4-8: Completeness Check)
export { GetEinsatzCompletenessQuery, GetEinsatzCompletenessQueryHandler } from './get-einsatz-completeness';

// Navigation Queries (Story 4-8: Previous/Next Navigation)
export { GetPreviousEinsatzIdQuery, GetPreviousEinsatzIdQueryHandler } from './get-previous-einsatz-id';
export { GetNextEinsatzIdQuery, GetNextEinsatzIdQueryHandler } from './get-next-einsatz-id';

// GetEinsatzTeilnehmer (Story 3.3: Teilnehmer für Zuweisung)
export { GetEinsatzTeilnehmerQuery, GetEinsatzTeilnehmerHandler } from './get-einsatz-teilnehmer';
