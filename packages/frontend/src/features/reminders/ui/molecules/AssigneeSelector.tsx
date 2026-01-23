/**
 * AssigneeSelector Komponente
 *
 * **Story 3.3:** Erinnerung einer anderen Person zuweisen
 * AC1: "sehe ich alle aktiven Einsatz-Teilnehmer als Auswahl"
 * AC2: "Jeder Teilnehmer wird mit Username und Funkrufname angezeigt"
 * AC3: "Ich kann optional einen Teilnehmer auswaehlen"
 *
 * Nutzt die Combobox-Komponente fuer Such- und Auswahl-Funktionalitaet.
 * Laedt aktive Teilnehmer ueber useAktiveEinsatzTeilnehmer Hook.
 */

import { useEffect, useMemo } from 'react';
import { PiUser } from 'react-icons/pi';
import { cn } from '@/shared/ui/cn';
import { Combobox, type ComboboxItem } from '@/shared/ui/headless/combobox';
import { useAktiveEinsatzTeilnehmer } from '@/features/einsatz';

interface AssigneeSelectorProps {
  /** Einsatz ID fuer das Laden der Teilnehmer */
  einsatzId: string;
  /** Aktuell ausgewaehlte User ID (optional) */
  value?: string | null;
  /** Handler fuer Auswahl-Aenderung */
  onChange: (userId: string | null) => void;
  /** Handler fuer Blur Event (fuer Form-Integration) */
  onBlur?: () => void;
  /** Ob das Feld deaktiviert ist */
  disabled?: boolean;
  /** Fehlermeldung */
  error?: string;
  /** Zusaetzliche CSS-Klassen */
  className?: string;
  /** ID fuer das Input-Element (fuer Label-Verknuepfung) */
  id?: string;
  /** ARIA Label fuer Accessibility */
  'aria-label'?: string;
  /** Callback wenn sich der Loading-State aendert */
  onLoadingChange?: (isLoading: boolean) => void;
}

/**
 * Dropdown zur Auswahl eines Einsatz-Teilnehmers fuer Erinnerungs-Zuweisung.
 *
 * **Felder im Dropdown:**
 * - Primary: Username
 * - Secondary: Funkrufname (in Klammern)
 *
 * **Verhalten:**
 * - Optional: Leere Auswahl bedeutet "Fuer alle" (keine Zuweisung)
 * - Suchbar: Filtert nach Username und Funkrufname
 * - Loading State: Zeigt Skeleton waehrend API-Abruf
 *
 * @example
 * ```tsx
 * <AssigneeSelector
 *   einsatzId={einsatzId}
 *   value={selectedUserId}
 *   onChange={(userId) => setSelectedUserId(userId)}
 * />
 * ```
 */
export function AssigneeSelector({ einsatzId, value, onChange, onBlur, disabled = false, error, className, id, 'aria-label': ariaLabel, onLoadingChange }: AssigneeSelectorProps) {
  const { data: teilnehmer, isLoading, isError, refetch } = useAktiveEinsatzTeilnehmer(einsatzId);

  // Kommuniziere Loading-State nach aussen (fuer Button-Disabling im Parent)
  useEffect(() => {
    onLoadingChange?.(isLoading);
  }, [isLoading, onLoadingChange]);

  // AC2: Formatiere Teilnehmer fuer Combobox (Username + Funkrufname)
  const comboboxItems: ComboboxItem[] = useMemo(() => {
    if (!teilnehmer) return [];

    return teilnehmer.map((t) => ({
      value: t.userId,
      label: `${t.username} (${t.funkrufname})`,
    }));
  }, [teilnehmer]);

  // Handler fuer Auswahl
  const handleChange = (selectedValue: string) => {
    // Leerer String = keine Zuweisung
    onChange(selectedValue || null);
  };

  // Loading State
  if (isLoading) {
    return (
      <div className={cn('w-full', className)}>
        <div className="animate-pulse">
          <div className="h-[52px] rounded-lg bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
    );
  }

  // Error State mit Retry
  if (isError) {
    return (
      <div className={cn('w-full', className)}>
        <div className="flex flex-col gap-2 rounded-lg border-2 border-red-300 bg-red-50 px-4 py-3 text-red-700 text-sm dark:border-red-700 dark:bg-red-900/20 dark:text-red-400">
          <p>Teilnehmer konnten nicht geladen werden</p>
          <button type="button" onClick={() => refetch()} className="self-start text-red-600 underline hover:text-red-800 dark:text-red-400 dark:hover:text-red-300">
            Erneut versuchen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('w-full', className)}>
      <Combobox
        id={id}
        aria-label={ariaLabel ?? 'Teilnehmer auswaehlen'}
        items={comboboxItems}
        value={value ?? ''}
        onChange={handleChange}
        onBlur={onBlur}
        placeholder="Fuer alle (keine Zuweisung)"
        disabled={disabled || comboboxItems.length === 0}
        leadingIcon={<PiUser className="h-5 w-5" />}
        error={error}
        openOnFocus
      />
      {comboboxItems.length === 0 && !isLoading && <p className="mt-1 text-gray-500 text-xs dark:text-gray-400">Keine aktiven Teilnehmer in diesem Einsatz</p>}
    </div>
  );
}
