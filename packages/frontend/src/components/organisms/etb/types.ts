import { AddEintragDtoKategorieEnum as EtbKategorie } from '@bluelight-hub/shared/client';
import { z } from 'zod';

/**
 * Schema für ETB-Eintrag-Formular-Daten
 */
export const etbEntrySchema = z.object({
  kategorie: z.nativeEnum(EtbKategorie),
  text: z.string().min(1, 'Text ist erforderlich').max(2000, 'Maximal 2000 Zeichen'),
  timestamp: z.date().optional(),
});

/**
 * Typ für ETB-Eintrag-Formular-Daten
 */
export type EtbEntryFormData = z.infer<typeof etbEntrySchema>;

/**
 * Kategorie-Labels für die Anzeige
 */
export const kategorieLabels: Record<EtbKategorie, string> = {
  [EtbKategorie.Alarmierung]: '🚨 Alarmierung',
  [EtbKategorie.Ankunft]: '🚐 Ankunft',
  [EtbKategorie.Befehl]: '📢 Befehl',
  [EtbKategorie.Erkundung]: '🔍 Erkundung',
  [EtbKategorie.Lage]: '📍 Lage',
  [EtbKategorie.Massnahme]: '⚡ Maßnahme',
  [EtbKategorie.Personal]: '👥 Personal',
  [EtbKategorie.Fahrzeug]: '🚒 Fahrzeug',
  [EtbKategorie.Material]: '📦 Material',
  [EtbKategorie.Kommunikation]: '📡 Kommunikation',
  [EtbKategorie.Wetter]: '🌦️ Wetter',
  [EtbKategorie.Dokumentation]: '📄 Dokumentation',
  [EtbKategorie.Sonstiges]: '📝 Sonstiges',
  [EtbKategorie.System]: '⚙️ System',
};

/**
 * Interface für Textbaustein-Daten
 */
export interface TextbausteinData {
  id: string;
  kurztext: string;
  volltext: string;
  kategorie: EtbKategorie;
  isActive: boolean;
}
