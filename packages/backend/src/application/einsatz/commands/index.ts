// Create
export { CreateEinsatzCommand } from './create-einsatz/create-einsatz.command';
export { CreateEinsatzHandler } from './create-einsatz/create-einsatz.handler';

// Update
export { UpdateEinsatzCommand } from './update-einsatz/update-einsatz.command';
export { UpdateEinsatzHandler } from './update-einsatz/update-einsatz.handler';

// Delete
export { DeleteEinsatzCommand } from './delete-einsatz/delete-einsatz.command';
export { DeleteEinsatzHandler } from './delete-einsatz/delete-einsatz.handler';

// Complete (Story 4-2)
export { CompleteEinsatzCommand } from './complete-einsatz/complete-einsatz.command';
export { CompleteEinsatzHandler } from './complete-einsatz/complete-einsatz.handler';

// Archive (Story 4-2)
export { ArchiveEinsatzCommand } from './archive-einsatz/archive-einsatz.command';
export { ArchiveEinsatzHandler } from './archive-einsatz/archive-einsatz.handler';

// Update Status (Story 4-2)
export { UpdateEinsatzStatusCommand } from './update-status/update-status.command';
export { UpdateEinsatzStatusHandler } from './update-status/update-status.handler';

// Archive Old Einsaetze (Story 5-6: Bulk Archive)
export { ArchiveOldEinsaetzeCommand, ArchiveOldEinsaetzeHandler, type BulkArchiveResult } from './archive-old-einsaetze';
