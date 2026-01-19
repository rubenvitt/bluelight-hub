import { z } from 'zod';

/**
 * Schema für Quick-Create Erinnerung Form.
 *
 * **Story 1.1 AC2/AC3:**
 * - Titel ist erforderlich (max 100 Zeichen)
 * - Minuten-Preset wird ausgewählt (Frontend berechnet faelligAm)
 *
 * @example
 * ```typescript
 * const form = useForm({
 *   defaultValues: { titel: '', minuten: 30 },
 *   validatorAdapter: zodValidator(),
 *   validators: { onChange: createErinnerungSchema },
 * });
 * ```
 */
export const createErinnerungSchema = z.object({
  titel: z.string().min(1, 'Titel ist erforderlich').max(100, 'Titel darf maximal 100 Zeichen lang sein'),
  minuten: z.number().int('Minuten muss eine ganze Zahl sein').min(1, 'Minuten muss mindestens 1 sein').max(1440, 'Minuten darf maximal 1440 (24h) sein'),
  beschreibung: z.string().max(500, 'Beschreibung darf maximal 500 Zeichen lang sein').optional(),
});

export type CreateErinnerungFormData = z.infer<typeof createErinnerungSchema>;

/**
 * Verfügbare Zeit-Presets für Quick-Create Dialog.
 *
 * **Story 1.1 AC1:** "Zeit-Presets (5, 10, 15, 30, 60 Min) sind als Chips wählbar"
 */
export const TIME_PRESETS = [
  { label: '5 Min', value: 5 },
  { label: '10 Min', value: 10 },
  { label: '15 Min', value: 15 },
  { label: '30 Min', value: 30 },
  { label: '60 Min', value: 60 },
] as const;

export type TimePreset = (typeof TIME_PRESETS)[number];
