import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { milliseconds } from 'date-fns';
import { createHash } from 'node:crypto';

/**
 * Service für Cache-basierte Duplicate Detection und idempotente Operationen
 *
 * Dieser Service nutzt den NestJS Cache Manager für skalierbare
 * Duplikatserkennung und idempotente Operation-Ausführung.
 *
 * Features:
 * - Hash-basierte Cache-Key Generierung mit SHA-256
 * - Zeitfenster-basiertes Caching mit konfigurierbarem TTL
 * - Fehlertoleranz: Cache-Fehler blockieren keine Operationen
 * - Automatische Cache-Expiration durch TTL
 *
 * @class CacheDuplicateDetectionService
 */
@Injectable()
export class CacheDuplicateDetectionService {
  private readonly logger = new Logger(CacheDuplicateDetectionService.name);
  private readonly DEFAULT_TTL = milliseconds({ minutes: 1 }); // 1 Minute in Millisekunden

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  /**
   * Führt eine Operation idempotent aus
   *
   * Diese Methode prüft zunächst den Cache auf ein vorhandenes Ergebnis.
   * Falls gefunden, wird das gecachte Ergebnis zurückgegeben.
   * Andernfalls wird die Operation ausgeführt und das Ergebnis gecacht.
   *
   * @template T Der Typ des Ergebnisses
   * @param key Eindeutiger Schlüssel für die Operation
   * @param operation Die auszuführende Operation
   * @param ttl Time-to-live in Millisekunden (optional)
   * @returns Das Ergebnis der Operation
   */
  async executeIdempotent<T>(key: string, operation: () => Promise<T>, ttl?: number): Promise<T> {
    const cacheKey = this.generateCacheKey(key);
    const effectiveTtl = ttl ?? this.DEFAULT_TTL;

    let cached: { result?: T; error?: string } | null = null;

    try {
      // Versuche Ergebnis aus Cache zu laden
      cached =
        (await this.cacheManager.get<{
          result?: T;
          error?: string;
        }>(cacheKey)) ?? null;
    } catch (cacheError) {
      // Cache-Fehler sollen Operation nicht blockieren
      this.logger.warn(`Cache-Zugriff fehlgeschlagen für ${key}: ${(cacheError as Error).message}`);
    }

    if (cached) {
      this.logger.debug(`Cache hit für Operation: ${key}`);

      if (cached.error) {
        // Gecachten Fehler erneut werfen
        throw new Error(cached.error);
      }

      return cached.result as T;
    }

    // Operation ausführen
    try {
      this.logger.debug(`Führe neue Operation aus: ${key}`);
      const result = await operation();

      // Erfolgreiches Ergebnis cachen
      try {
        await this.cacheManager.set(cacheKey, { result }, effectiveTtl);
      } catch (cacheError) {
        // Cache-Fehler beim Speichern ignorieren
        this.logger.warn(`Cache-Speicherung fehlgeschlagen für ${key}: ${(cacheError as Error).message}`);
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Fehler cachen für konsistente Wiederholung
      try {
        await this.cacheManager.set(cacheKey, { error: errorMessage }, effectiveTtl);
      } catch (cacheError) {
        // Cache-Fehler beim Speichern ignorieren
        this.logger.warn(`Cache-Speicherung von Fehler fehlgeschlagen für ${key}: ${(cacheError as Error).message}`);
      }

      throw error;
    }
  }

  /**
   * Löscht einen spezifischen Cache-Eintrag
   *
   * @param key Der Schlüssel des zu löschenden Eintrags
   */
  async invalidateCache(key: string): Promise<void> {
    const cacheKey = this.generateCacheKey(key);

    try {
      await this.cacheManager.del(cacheKey);
      this.logger.debug(`Cache-Eintrag gelöscht: ${key}`);
    } catch (error) {
      this.logger.warn(`Fehler beim Löschen des Cache-Eintrags ${key}: ${(error as Error).message}`);
    }
  }

  /**
   * Löscht alle Cache-Einträge (für Tests oder Reset)
   *
   * Hinweis: Da cache-manager v7 keine reset() Methode hat,
   * ist diese Methode nur als Platzhalter implementiert.
   * Für echtes Cache-Reset muss der Cache-Store direkt
   * konfiguriert werden.
   */
  async clearCache(): Promise<void> {
    try {
      // Cache-Manager v7 hat keine reset() Methode
      // Diese Methode ist als Platzhalter für zukünftige Implementierung
      await this.cacheManager.clear();
      this.logger.debug('Cache geleert');
    } catch (error) {
      this.logger.warn(`Fehler beim Leeren des Caches: ${(error as Error).message}`);
    }
  }

  /**
   * Generiert einen SHA-256 basierten Cache-Key
   *
   * @param input Der Input für die Hash-Generierung
   * @returns SHA-256 Hash als Hex-String
   */
  private generateCacheKey(input: string): string {
    const hash = createHash('sha256').update(input).digest('hex');
    return `duplicate-detection:${hash}`;
  }
}
