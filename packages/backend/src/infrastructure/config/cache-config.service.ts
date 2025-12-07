import { CacheModuleOptions, CacheOptionsFactory } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { milliseconds } from 'date-fns';
import { cacheConfig } from './cache.config';

/**
 * Service zur Bereitstellung der Cache-Konfiguration
 *
 * Dieser Service kapselt die Cache-Konfiguration und stellt sie
 * für das CacheModule zur Verfügung. Er nutzt typisierte Konfiguration
 * über ConfigModule.forFeature für flexible Konfiguration in verschiedenen Umgebungen.
 */
@Injectable()
export class CacheConfigService implements CacheOptionsFactory {
  private logger = new Logger(CacheConfigService.name);

  constructor(
    @Inject(cacheConfig.KEY)
    private readonly config: ConfigType<typeof cacheConfig>,
  ) {}

  /**
   * Erstellt die Cache-Konfiguration für das CacheModule
   * @returns Cache-Konfigurationsoptionen
   */
  createCacheOptions(): CacheModuleOptions {
    return {
      store: this.config.store as 'memory',
      ttl: this.config.ttl,
      max: this.config.max,
      // isGlobal wird über das @Global() InfrastructureCommonModule gewährleistet
    };
  }

  /**
   * Gibt die TTL (Time To Live) in Millisekunden zurück
   * @returns TTL in Millisekunden
   */
  getCacheTtl(): number {
    return this.validatePositiveNumber(this.config.ttl, 'CACHE_TTL', milliseconds({ minutes: 1 }));
  }

  /**
   * Gibt die maximale Anzahl von Cache-Einträgen zurück
   * @returns Maximale Anzahl von Cache-Einträgen
   */
  getCacheMaxItems(): number {
    return this.validatePositiveNumber(this.config.max, 'CACHE_MAX_ITEMS', 100);
  }

  /**
   * Gibt die aktuelle Cache-Konfiguration zurück (für Tests und Debugging)
   * @returns Aktuelle Cache-Konfiguration
   */
  getCacheConfig() {
    return {
      store: this.config.store,
      ttl: this.config.ttl,
      max: this.config.max,
    };
  }

  /**
   * Validiert, dass ein Wert eine positive Zahl ist
   * @param value - Der zu validierende Wert
   * @param name - Name der Environment-Variable für Fehlermeldungen
   * @param defaultValue - Fallback-Wert bei ungültiger Eingabe
   * @returns Validierter Wert oder Default-Wert
   */
  private validatePositiveNumber(value: number, name: string, defaultValue: number): number {
    // Prüfe ob der Wert existiert und eine positive ganze Zahl ist
    if (value === undefined || value === null || value <= 0 || !Number.isInteger(value)) {
      // Nur warnen wenn der Wert ungültig ist (nicht wenn er dem Default entspricht)
      if (value !== defaultValue && value !== undefined && value !== null) {
        this.logger.warn(`Invalid ${name} value: ${value}. Using default: ${defaultValue}`);
      }
      return defaultValue;
    }
    return value;
  }
}
