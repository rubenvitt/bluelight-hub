import { Combobox, type ComboboxItem } from '@/components/ui/combobox';
import { AddEintragDtoKategorieEnum as EtbKategorie } from '@bluelight-hub/shared/client';
import { useMemo } from 'react';
import { kategorieLabels } from './types';

interface EtbKategorieSelectProps {
  value: EtbKategorie;
  onChange: (value: EtbKategorie) => void;
  error?: string;
  disabled?: boolean;
}

/**
 * Auswahl-Komponente für ETB-Kategorien
 */
export function EtbKategorieSelect({ value, onChange, error, disabled = false }: EtbKategorieSelectProps) {
  const kategorieItems: ComboboxItem[] = useMemo(
    () =>
      Object.entries(kategorieLabels).map(([key, label]) => ({
        value: key,
        label,
      })),
    [],
  );

  const handleChange = (newValue: string | null) => {
    // Bei leerem Wert die Standard-Kategorie setzen
    const kategorie = (newValue || EtbKategorie.Lage) as EtbKategorie;
    onChange(kategorie);
  };

  return (
    <Combobox label="Kategorie" items={kategorieItems} value={value} onChange={handleChange} placeholder="Kategorie wählen" error={error} disabled={disabled} allowCustomValue={false} openOnFocus />
  );
}
