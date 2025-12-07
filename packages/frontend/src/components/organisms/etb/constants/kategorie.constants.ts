import { EintragDtoKategorieEnum as EtbKategorie } from '@bluelight-hub/shared/client';

/**
 * Farben für verschiedene Kategorien
 */
export const kategorieFarben: Record<EtbKategorie, string> = {
  [EtbKategorie.Alarmierung]: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  [EtbKategorie.Ankunft]: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  [EtbKategorie.Befehl]: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  [EtbKategorie.Erkundung]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  [EtbKategorie.Lage]: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  [EtbKategorie.Massnahme]: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  [EtbKategorie.Personal]: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  [EtbKategorie.Fahrzeug]: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  [EtbKategorie.Material]: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  [EtbKategorie.Kommunikation]: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
  [EtbKategorie.Wetter]: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200',
  [EtbKategorie.Dokumentation]: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
  [EtbKategorie.Sonstiges]: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  [EtbKategorie.System]: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200',
};
