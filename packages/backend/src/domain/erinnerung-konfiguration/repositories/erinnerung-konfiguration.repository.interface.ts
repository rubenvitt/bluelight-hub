import type { ErinnerungKonfiguration } from '../entities/erinnerung-konfiguration.entity';

export const IErinnerungKonfigurationRepository = Symbol('IErinnerungKonfigurationRepository');

export interface IErinnerungKonfigurationRepository {
  /**
   * Lädt die globale Konfiguration.
   * Gibt null zurück, wenn noch keine Konfiguration existiert.
   */
  get(): Promise<ErinnerungKonfiguration | null>;

  /**
   * Speichert die Konfiguration (Create oder Update).
   */
  save(config: ErinnerungKonfiguration): Promise<void>;
}
