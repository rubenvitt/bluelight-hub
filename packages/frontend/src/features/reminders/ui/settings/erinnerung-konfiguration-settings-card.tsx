import { useState, useEffect } from 'react';
import { useErinnerungKonfiguration } from '../../hooks/use-erinnerung-konfiguration';
import { LuLoader } from 'react-icons/lu';

export const ErinnerungKonfigurationSettingsCard = () => {
  const { config, isLoading, updateTimeout, isUpdating } = useErinnerungKonfiguration();
  const [minutes, setMinutes] = useState<number | string>(5);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (config && config.eskalationsTimeoutMinutes !== undefined) {
      setMinutes(config.eskalationsTimeoutMinutes);
    }
  }, [config]);

  const handleSave = () => {
    const min = typeof minutes === 'string' ? (minutes === '' ? 5 : parseInt(minutes, 10)) : minutes;
    updateTimeout(
      { timeoutMinutes: min },
      {
        onSuccess: () => setIsDirty(false),
      },
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-4">
        <LuLoader className="animate-spin" />
      </div>
    );
  }

  const parsedMinutes = typeof minutes === 'string' ? (minutes === '' ? 0 : parseInt(minutes, 10)) : minutes;
  const isValid = !Number.isNaN(parsedMinutes) && parsedMinutes >= 1 && parsedMinutes <= 60;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow dark:border-slate-700 dark:bg-slate-800">
      <h3 className="mb-4 font-medium text-lg text-slate-900 dark:text-slate-100">Erinnerungs-Konfiguration (Global)</h3>

      <div className="space-y-4">
        <div>
          <label htmlFor="timeout" className="mb-1 block font-medium text-slate-700 text-sm dark:text-slate-300">
            Eskalations-Timeout (Minuten)
          </label>
          <div className="flex items-center gap-4">
            <input
              type="number"
              id="timeout"
              min={1}
              max={60}
              value={minutes}
              onChange={(e) => {
                const val = e.target.value;
                setMinutes(val === '' ? '' : parseInt(val, 10));
                setIsDirty(true);
              }}
              className="block w-24 rounded-md border-slate-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:border-slate-600 dark:bg-slate-700"
            />
            <span className="text-slate-500 text-sm dark:text-slate-400">(1-60 Minuten)</span>
          </div>
          {!isValid && <p className="mt-1 text-red-600 text-sm">Bitte einen Wert zwischen 1 und 60 Minuten eingeben.</p>}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || !isValid || isUpdating}
            className={`inline-flex justify-center rounded-md border border-transparent px-4 py-2 font-medium text-sm text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${!isDirty || !isValid || isUpdating ? 'cursor-not-allowed bg-slate-400' : 'bg-blue-600 hover:bg-blue-700'}
            `}
          >
            {isUpdating && <LuLoader className="mr-2 -ml-1 h-4 w-4 animate-spin" />}
            Speichern
          </button>
        </div>
      </div>

      <div className="mt-4 rounded bg-blue-50 p-3 text-blue-700 text-sm dark:bg-blue-900/20 dark:text-blue-300">
        <p>Diese Einstellung gilt global für alle Einsätze. Wenn Erinnerungen überfällig sind, werden sie nach dieser Zeit eskaliert (Status: ESKALIERT).</p>
      </div>
    </div>
  );
};
