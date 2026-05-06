import { Combobox, type ComboboxItem } from '@/shared/ui/headless/combobox';
import { AddEintragDtoKategorieEnum as EtbKategorie } from '@/shared';
import { useMemo } from 'react';
import { kategorieLabels } from '../../types/etb.types';

interface EtbKategorieSelectProps {
  value: EtbKategorie;
  onChange: (value: EtbKategorie) => void;
  onBlur?: () => void;
  error?: string;
  disabled?: boolean;
}

/**
 * Auswahl-Komponente für ETB-Kategorien
 */
export function EtbKategorieSelect({ value, onChange, onBlur, error, disabled = false }: EtbKategorieSelectProps) {
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
    const kategorie = (newValue || EtbKategorie.Dokumentation) as EtbKategorie;
    onChange(kategorie);
  };

  return (
    <Combobox
      label="Kategorie"
      items={kategorieItems}
      value={value}
      onChange={handleChange}
      onBlur={onBlur}
      placeholder="Kategorie wählen"
      error={error}
      disabled={disabled}
      allowCustomValue={false}
      openOnFocus
    />
  );
}
