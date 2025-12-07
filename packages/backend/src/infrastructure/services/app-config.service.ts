import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Prüft ob die Anwendung in der Produktionsumgebung läuft
   */
  isProduction(): boolean {
    return this.configService.get<string>('NODE_ENV') === 'production';
  }

  /**
   * Prüft ob die Anwendung in der Entwicklungsumgebung läuft
   */
  isDevelopment(): boolean {
    return this.configService.get<string>('NODE_ENV') === 'development';
  }

  /**
   * Prüft ob die Anwendung in der Testumgebung läuft
   */
  isTest(): boolean {
    return this.configService.get<string>('NODE_ENV') === 'test';
  }

  /**
   * Gibt den aktuellen NODE_ENV Wert zurück
   */
  getNodeEnv(): string {
    return this.configService.get<string>('NODE_ENV', 'development');
  }

  /**
   * Proxy-Methode für ConfigService.get
   * Ermöglicht es anderen Services, Konfigurationswerte abzurufen
   */
  get<T = unknown>(propertyPath: string): T | undefined;
  get<T = unknown>(propertyPath: string, defaultValue: T): T;
  get<T = unknown>(propertyPath: string, defaultValue?: T): T | undefined {
    return this.configService.get<T>(propertyPath, defaultValue as T);
  }

  /**
   * Proxy-Methode für ConfigService.getOrThrow
   * Wirft einen Fehler wenn der Konfigurationswert nicht existiert
   */
  getOrThrow<T = unknown>(propertyPath: string): T {
    return this.configService.getOrThrow<T>(propertyPath);
  }
}
