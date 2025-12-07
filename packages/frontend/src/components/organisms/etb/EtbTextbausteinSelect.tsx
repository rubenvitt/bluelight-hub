import { Combobox, type ComboboxItem } from '@/components/ui/combobox';
import type { AddEintragDtoKategorieEnum as EtbKategorie } from '@bluelight-hub/shared/client';
import { useCallback, useMemo } from 'react';
import { kategorieLabels, type TextbausteinData } from './types';

interface EtbTextbausteinSelectProps {
  kategorie: EtbKategorie;
  value: string;
  onChange: (value: string) => void;
  textbausteine: TextbausteinData[];
  disabled?: boolean;
}

/**
 * Auswahl-Komponente für ETB-Textbausteine
 */
export function EtbTextbausteinSelect({ kategorie, value, onChange, textbausteine, disabled = false }: EtbTextbausteinSelectProps) {
  const textbausteinItems: ComboboxItem[] = useMemo(
    () =>
      textbausteine.map((tb) => ({
        value: tb.id,
        label: tb.kurztext,
      })),
    [textbausteine],
  );

  const label = useMemo(() => {
    const count = textbausteine.length;
    return count > 0 ? `Textbausteine (${count})` : 'Textbausteine';
  }, [textbausteine.length]);

  const placeholder = useMemo(() => {
    if (textbausteine.length === 0) {
      const kategorieLabel = kategorieLabels[kategorie];
      return `Keine Textbausteine für "${kategorieLabel}" verfügbar`;
    }
    return 'Textbaustein wählen (optional)';
  }, [textbausteine.length, kategorie]);

  const handleChange = useCallback(
    (newValue: string | null) => {
      onChange(newValue || '');
    },
    [onChange],
  );

  return (
    <Combobox
      label={label}
      items={textbausteinItems}
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      disabled={disabled || textbausteine.length === 0}
      allowCustomValue={false}
      openOnFocus
    />
  );
}
