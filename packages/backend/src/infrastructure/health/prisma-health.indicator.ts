import { Injectable } from '@nestjs/common';
import { type HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus';
import { PrismaService } from '@/infrastructure/database/prisma.service';

/**
 * Health Indicator für Prisma-Datenbankverbindungen
 *
 * Diese Klasse implementiert benutzerdefinierte Health-Checks für
 * die Datenbankverbindung über den Prisma ORM. Sie wird von
 * Terminus für Monitoring und Liveness/Readiness-Probes verwendet.
 *
 * Features:
 * - Ping-Check zur Überprüfung der Datenbankverbindung
 * - Verbindungsstatus-Check mit detaillierten Informationen
 * - Integration in das Terminus Health-Check-System
 *
 * @class PrismaHealthIndicator
 */
@Injectable()
export class PrismaHealthIndicator {
  /**
   * Konstruktor für den PrismaHealthIndicator
   *
   * @param prisma Der Prisma-Service für Datenbankzugriffe
   * @param healthIndicatorService Der HealthIndicatorService von Terminus
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  /**
   * Prüft die Verbindung zur Datenbank durch Ausführung eines einfachen Queries.
   *
   * @param key Der Name des Indikators im Gesundheitsbericht
   * @returns Ein HealthIndicatorResult mit dem Status der Datenbankverbindung
   */
  async pingCheck(key: string): Promise<HealthIndicatorResult> {
    try {
      // Führe eine einfache Query aus, um die Verbindung zu prüfen
      await this.prisma.$queryRaw`SELECT 1`;

      return this.healthIndicatorService.check(key).up();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return this.healthIndicatorService.check(key).down(errorMessage);
    }
  }

  /**
   * Prüft, ob der Prisma-Client verbunden ist.
   *
   * @param key Der Name des Indikators im Gesundheitsbericht
   * @returns Ein HealthIndicatorResult mit dem Status der Verbindung
   */
  async isConnected(key: string): Promise<HealthIndicatorResult> {
    try {
      // Prüfe, ob der Client verbunden ist
      const connectionStatus = await this.prisma.$executeRaw`SELECT 1 as connected`;
      return this.healthIndicatorService.check(key).up({
        connected: connectionStatus !== null,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return this.healthIndicatorService.check(key).down(errorMessage);
    }
  }
}
