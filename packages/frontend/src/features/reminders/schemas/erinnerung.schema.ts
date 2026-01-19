import { z } from 'zod';

/**
 * Schema für benutzerdefinierte Zeit-Eingabe.
 *
 * **Story 1.2 AC2:** Time-Picker zeigt Stunden (00-23) und Minuten (00-59)
 */
export const customTimeSchema = z.object({
  hours: z.number().int().min(0, 'Stunden müssen 0-23 sein').max(23, 'Stunden müssen 0-23 sein'),
  minutes: z.number().int().min(0, 'Minuten müssen 0-59 sein').max(59, 'Minuten müssen 0-59 sein'),
});

export type CustomTime = z.infer<typeof customTimeSchema>;

/**
 * Schema für Quick-Create Erinnerung Form.
 *
 * **Story 1.1 AC2/AC3:**
 * - Titel ist erforderlich (max 100 Zeichen)
 * - Minuten-Preset wird ausgewählt (Frontend berechnet faelligAm)
 *
 * **Story 1.2 AC1-5:**
 * - Benutzerdefiniert-Option mit Time-Picker
 * - Discriminated Union: timeMode = 'preset' | 'custom'
 * - Preset: minuten erforderlich
 * - Custom: customTime erforderlich (hours, minutes)
 *
 * @example
 * ```typescript
 * const form = useForm({
 *   defaultValues: { titel: '', timeMode: 'preset', minuten: 30 },
 *   validatorAdapter: zodValidator(),
 *   validators: { onChange: createErinnerungSchema },
 * });
 * ```
 */
export const createErinnerungSchema = z
  .object({
    titel: z.string().min(1, 'Titel ist erforderlich').max(100, 'Titel darf maximal 100 Zeichen lang sein'),
    timeMode: z.enum(['preset', 'custom']),
    minuten: z.number().int('Minuten muss eine ganze Zahl sein').min(1, 'Minuten muss mindestens 1 sein').max(1440, 'Minuten darf maximal 1440 (24h) sein').optional(),
    customTime: customTimeSchema.optional(),
    beschreibung: z.string().max(500, 'Beschreibung darf maximal 500 Zeichen lang sein').optional(),
  })
  .refine(
    (data) => {
      if (data.timeMode === 'preset') {
        return data.minuten !== undefined;
      }
      return data.customTime !== undefined;
    },
    {
      message: 'Zeit ist erforderlich',
      path: ['minuten'],
    },
  );

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
