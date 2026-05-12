import { z } from 'zod';

/**
 * Schema fuer einen einzelnen Eintrag im Fuehrungsrhythmus-Template (Story 6.6 AC1).
 */
const eintragSchema = z.object({
  titel: z.string().trim().min(1, 'Titel ist erforderlich').max(100, 'Titel darf maximal 100 Zeichen lang sein'),
  intervallMinuten: z.number().int('Intervall muss eine ganze Zahl sein').min(1, 'Mindestens 1 Minute').max(1440, 'Maximal 1440 Minuten (24h)'),
  offsetMinuten: z.number().int('Offset muss eine ganze Zahl sein').min(0, 'Offset darf nicht negativ sein').max(1440, 'Maximal 1440 Minuten (24h)').default(0),
});

/**
 * Schema zum Erstellen eines Fuehrungsrhythmus-Templates (Story 6.6 AC3).
 */
export const createFuehrungsrhythmusTemplateSchema = z.object({
  name: z.string().trim().min(1, 'Name ist erforderlich').max(100, 'Name darf maximal 100 Zeichen lang sein'),
  beschreibung: z.string().max(500, 'Beschreibung darf maximal 500 Zeichen lang sein').optional(),
  eintraege: z.array(eintragSchema).min(1, 'Mindestens eine Erinnerung erforderlich'),
});

export type CreateFuehrungsrhythmusTemplateFormData = z.infer<typeof createFuehrungsrhythmusTemplateSchema>;

/**
 * Schema zum Aktualisieren eines Fuehrungsrhythmus-Templates (Story 6.8 AC4).
 * Gleiche Validierung wie beim Erstellen.
 */
export const updateFuehrungsrhythmusTemplateSchema = z.object({
  name: z.string().trim().min(1, 'Name ist erforderlich').max(100, 'Name darf maximal 100 Zeichen lang sein'),
  beschreibung: z.string().max(500, 'Beschreibung darf maximal 500 Zeichen lang sein').optional(),
  eintraege: z.array(eintragSchema).min(1, 'Mindestens eine Erinnerung erforderlich'),
});

export type UpdateFuehrungsrhythmusTemplateFormData = z.infer<typeof updateFuehrungsrhythmusTemplateSchema>;
