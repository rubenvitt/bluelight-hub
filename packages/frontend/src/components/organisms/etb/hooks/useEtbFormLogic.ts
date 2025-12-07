import type { AddEintragDtoKategorieEnum as EtbKategorie } from '@bluelight-hub/shared/client';
import { useCallback, useState } from 'react';
import type { TextbausteinData } from '../types';

/**
 * Custom Hook für ETB-Formular-Logik
 */
export function useEtbFormLogic(textbausteine: TextbausteinData[]) {
  const [selectedTextbaustein, setSelectedTextbaustein] = useState<string>('');

  /**
   * Filtert Textbausteine nach Kategorie
   */
  const filteredTextbausteine = useCallback(
    (kategorie: EtbKategorie) => {
      return textbausteine.filter((tb) => tb.kategorie === kategorie && tb.isActive);
    },
    [textbausteine],
  );

  /**
   * Setzt alle Auswahlen zurück
   */
  const resetSelection = useCallback(() => {
    setSelectedTextbaustein('');
  }, []);

  /**
   * Findet einen Textbaustein nach ID
   */
  const findTextbausteinById = useCallback(
    (id: string) => {
      return textbausteine.find((tb) => tb.id === id);
    },
    [textbausteine],
  );

  /**
   * Prüft, ob Textbausteine für eine Kategorie verfügbar sind
   */
  const hasTextbausteineForKategorie = useCallback(
    (kategorie: EtbKategorie) => {
      return textbausteine.some((tb) => tb.kategorie === kategorie && tb.isActive);
    },
    [textbausteine],
  );

  return {
    selectedTextbaustein,
    setSelectedTextbaustein,
    filteredTextbausteine,
    resetSelection,
    findTextbausteinById,
    hasTextbausteineForKategorie,
  };
}
