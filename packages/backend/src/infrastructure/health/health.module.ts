import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { PrismaHealthIndicator } from './prisma-health.indicator';

/**
 * Health-Check-Modul für die Anwendungsüberwachung
 *
 * Dieses Modul stellt Endpunkte und Services für die Überwachung
 * der Anwendungsgesundheit bereit. Es integriert Terminus für
 * standardisierte Health-Checks und bietet benutzerdefinierte
 * Indikatoren für kritische Komponenten.
 *
 * Features:
 * - Datenbank-Konnektivitätsprüfung über PrismaHealthIndicator
 * - HTTP-basierte Health-Check-Endpunkte
 * - Integration mit Monitoring-Systemen
 *
 * @module HealthModule
 * @class HealthModule
 */
@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [PrismaHealthIndicator],
  exports: [PrismaHealthIndicator],
})
export class HealthModule {}
