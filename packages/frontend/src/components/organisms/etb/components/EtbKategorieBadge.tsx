import { Badge } from '@/components/atoms/badge.atom';
import { cn } from '@/utils/cn';
import type { EintragDtoKategorieEnum as EtbKategorie } from '@bluelight-hub/shared/client';
import { kategorieFarben } from '../constants/kategorie.constants';
import { kategorieLabels } from '../types';

interface EtbKategorieBadgeProps {
  kategorie: EtbKategorie;
  className?: string;
}

/**
 * Badge zur Anzeige der ETB-Kategorie mit farblicher Kennzeichnung
 *
 * Nutzt das Badge-Atom mit kategorie-spezifischen Farben aus kategorie.constants
 *
 * @param kategorie - Die Kategorie des ETB-Eintrags
 * @param className - Zusätzliche CSS-Klassen
 */
export function EtbKategorieBadge({ kategorie, className }: EtbKategorieBadgeProps) {
  return (
    <Badge size="sm" className={cn('rounded-md', kategorieFarben[kategorie], className)}>
      {kategorieLabels[kategorie]}
    </Badge>
  );
}
