import { useErfassePatientForm } from '../hooks/use-erfasse-patient-form';
import { SkSelector } from './sk-selector';

interface ErfassePatientFormProps {
  einsatzId: string;
  /** Wird nach erfolgreichem Submit aufgerufen (Drawer-Schließ-Hook, Story 1.6 AC6). */
  onSuccess?: (patientennummer: string) => void;
}

/**
 * Formular „Patient erfassen" (Story 1.2, AC5).
 *
 * Bewusste UX-Reduktion gegenüber der UX-Spec (Story 1.2 Task 7): Das
 * Counter-Tile + Long-Press-Drawer-Pattern setzt KPI-Strip, Patientenliste
 * und ManV-Tokens voraus, die Stories 1.5 / 1.6 liefern. Story 1.2 baut
 * daher nur das minimale Erfassen-Formular als Aufhänger; Folge-Stories
 * verdrahten es in das Counter-Pattern.
 */
export function ErfassePatientForm({ einsatzId, onSuccess }: ErfassePatientFormProps) {
  const { form, mutation, lastErfasstePatientennummer } = useErfassePatientForm({ einsatzId, onSuccess });

  return (
    <form
      data-testid="erfasse-patient-form"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
      className="flex flex-col gap-4"
    >
      <form.Field name="initialeSk">
        {(field) => (
          <div className="flex flex-col gap-2">
            <span id="initiale-sk-label" className="text-sm font-medium">
              Initiale Sichtungskategorie
            </span>
            <SkSelector id="initiale-sk" labelledBy="initiale-sk-label" value={field.state.value} onChange={(sk) => field.handleChange(sk)} disabled={mutation.isPending} />
            {field.state.meta.errors.length > 0 && <p className="text-sm text-red-700">{String(field.state.meta.errors[0])}</p>}
          </div>
        )}
      </form.Field>

      <form.Field name="diviVakNummer">
        {(field) => (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" htmlFor="divi-vak-nummer">
              DIVI-VAK-Nummer (optional)
            </label>
            <input
              id="divi-vak-nummer"
              type="text"
              maxLength={64}
              value={field.state.value ?? ''}
              onChange={(event) => field.handleChange(event.target.value || undefined)}
              disabled={mutation.isPending}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
            {field.state.meta.errors.length > 0 && <p className="text-sm text-red-700">{String(field.state.meta.errors[0])}</p>}
          </div>
        )}
      </form.Field>

      <form.Field name="notiz">
        {(field) => (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" htmlFor="notiz">
              Notiz (optional, max. 500 Zeichen)
            </label>
            <textarea
              id="notiz"
              rows={3}
              maxLength={500}
              value={field.state.value ?? ''}
              onChange={(event) => field.handleChange(event.target.value || undefined)}
              disabled={mutation.isPending}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
            {field.state.meta.errors.length > 0 && <p className="text-sm text-red-700">{String(field.state.meta.errors[0])}</p>}
          </div>
        )}
      </form.Field>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {mutation.isPending ? 'Erfasse …' : 'Patient erfassen'}
        </button>
        {lastErfasstePatientennummer && (
          <span data-testid="erfasse-patient-confirmation" className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
            Patient {lastErfasstePatientennummer} erfasst
          </span>
        )}
        {mutation.isError && (
          <span role="alert" className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-800">
            Erfassen fehlgeschlagen
          </span>
        )}
      </div>
    </form>
  );
}
