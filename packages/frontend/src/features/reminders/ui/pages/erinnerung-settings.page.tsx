import { ErinnerungKonfigurationSettingsCard } from '../settings/erinnerung-konfiguration-settings-card';

export const ErinnerungSettingsPage = () => {
  return (
    <div className="space-y-6">
      <div className="border-slate-200 border-b pb-4 dark:border-slate-700">
        <h1 className="font-bold text-2xl text-slate-900 dark:text-slate-100">Erinnerungs-Einstellungen</h1>
        <p className="mt-1 text-slate-500 text-sm dark:text-slate-400">Verwalten Sie globale Konfigurationen für das Erinnerungssystem.</p>
      </div>

      <ErinnerungKonfigurationSettingsCard />
    </div>
  );
};
