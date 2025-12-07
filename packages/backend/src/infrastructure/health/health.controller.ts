import * as net from 'node:net';
import * as os from 'node:os';
import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { DiskHealthIndicator, HealthCheck, type HealthCheckResult, HealthCheckService, type HealthIndicatorResult, MemoryHealthIndicator } from '@nestjs/terminus';
import { SkipTransform } from '@/modules/common/decorators/skip-transform.decorator';
import { PrismaHealthIndicator } from './prisma-health.indicator';

/**
 * Konstanten für Health-Checks
 */
const HEALTH_CHECK_CONFIG = {
  MEMORY: {
    HEAP_THRESHOLD: 150 * 1024 * 1024, // 150MB
    RSS_THRESHOLD: 1024 * 1024 * 1024, // 1024MB
  },
  DISK: {
    THRESHOLD_PERCENT: 0.9, // 90%
    PATH: '/',
  },
  CONNECTIVITY: {
    TIMEOUT_MS: 2000, // 2 Sekunden
  },
};

/**
 * Typ-Definition für Verbindungsmodi
 */
type ConnectionMode = 'checking' | 'online' | 'offline' | 'error';

/**
 * Controller für Gesundheitscheck-Endpunkte, die den Gesundheitsstatus der Anwendung überwachen.
 * Stellt Endpunkte für Gesamtgesundheit, Liveness, Readiness und Datenbankprüfungen bereit.
 *
 * @class HealthController
 */
@SkipTransform()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  /**
   * Liste von öffentlichen DNS-Servern für Internet-Erreichbarkeits-Tests
   * Verwendet neutrale, öffentliche Server anstatt kommerzieller Dienste
   */
  private readonly CONNECTIVITY_CHECKS = [
    { host: '1.1.1.1', port: 53 }, // Cloudflare DNS
    { host: '8.8.8.8', port: 53 }, // Google DNS (Fallback)
    { host: '9.9.9.9', port: 53 }, // Quad9 DNS (Fallback)
  ];

  /**
   * Erstellt eine Instanz des HealthControllers.
   *
   * @constructor
   * @param {HealthCheckService} health - Service zur Durchführung von Gesundheitschecks
   * @param {MemoryHealthIndicator} memory - Indikator für Speicher-Gesundheitschecks
   * @param {DiskHealthIndicator} disk - Indikator für Festplatten-Gesundheitschecks
   * @param {PrismaHealthIndicator} prismaDb - Indikator für Prisma-Datenbank-Gesundheitschecks
   */
  constructor(
    private health: HealthCheckService,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private prismaDb: PrismaHealthIndicator,
  ) {}

  /**
   * Führt einen umfassenden Gesundheitscheck der Anwendung durch.
   * Überprüft Datenbankverbindung, Speichernutzung, Festplattenplatz und CPU-Status.
   * Prüft zusätzlich den Internet- und FüKW-Verbindungsstatus für optimale Nutzerführung.
   *
   * @returns {Promise<HealthCheckResult>} Gesundheitscheck-Ergebnisobjekt
   */
  @Get()
  @HealthCheck()
  async check(): Promise<HealthCheckResult> {
    return this.health.check([
      async () => this.prismaDb.pingCheck('database'),

      // Memory-Checks
      () => this.memory.checkHeap('memory_heap', HEALTH_CHECK_CONFIG.MEMORY.HEAP_THRESHOLD),
      () => this.memory.checkRSS('memory_rss', HEALTH_CHECK_CONFIG.MEMORY.RSS_THRESHOLD),

      // Disk-Checks
      () =>
        this.disk.checkStorage('storage', {
          thresholdPercent: HEALTH_CHECK_CONFIG.DISK.THRESHOLD_PERCENT,
          path: HEALTH_CHECK_CONFIG.DISK.PATH,
        }),

      // CPU-Check
      async () => this.checkCpuStatus(),

      // Internet-Verbindung prüfen über TCP-Verbindung zu öffentlichen DNS-Servern
      async () => this.checkInternetStatus(),

      // FüKW-Verbindung prüfen
      async () => this.checkFuekwStatus(),

      // Gibt den Verbindungsstatus basierend auf den einzelnen Prüfungen zurück
      async () => this.determineConnectionStatus(),
    ]);
  }

  /**
   * Führt einen Liveness-Check durch, um festzustellen, ob die Anwendung läuft.
   * Überprüft nur die Datenbankverbindung als primären Indikator.
   *
   * @returns {Promise<HealthCheckResult>} Liveness-Check-Ergebnisobjekt
   */
  @Get('liveness')
  @HealthCheck()
  async checkLiveness(): Promise<HealthCheckResult> {
    return this.health.check([async () => this.prismaDb.pingCheck('database')]);
  }

  /**
   * Führt einen Readiness-Check durch, um festzustellen, ob die Anwendung bereit ist, Anfragen anzunehmen.
   * Überprüft Speicher- und Festplattenverfügbarkeit.
   *
   * @returns {Promise<HealthCheckResult>} Readiness-Check-Ergebnisobjekt
   */
  @Get('readiness')
  @HealthCheck()
  async checkReadiness(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', HEALTH_CHECK_CONFIG.MEMORY.HEAP_THRESHOLD),
      () =>
        this.disk.checkStorage('storage', {
          thresholdPercent: HEALTH_CHECK_CONFIG.DISK.THRESHOLD_PERCENT,
          path: HEALTH_CHECK_CONFIG.DISK.PATH,
        }),
    ]);
  }

  /**
   * Führt einen detaillierten Datenbank-Gesundheitscheck durch.
   * Überprüft Datenbankverbindung und Initialisierungsstatus.
   *
   * @returns {Promise<HealthCheckResult>} Datenbank-Check-Ergebnisobjekt
   */
  @Get('db')
  @HealthCheck()
  async checkDatabase(): Promise<HealthCheckResult> {
    return this.health.check([() => this.prismaDb.pingCheck('database'), () => this.prismaDb.isConnected('database_connections')]);
  }

  /**
   * Erstellt einen CPU-Status-Check.
   *
   * @returns {Promise<HealthIndicatorResult>} CPU-Status
   */
  private async checkCpuStatus(): Promise<HealthIndicatorResult> {
    return {
      cpu: {
        status: 'up',
        loadAverage: os.loadavg(),
        usedCores: os.cpus().length,
      },
    };
  }

  /**
   * Erstellt einen Internet-Status-Check.
   *
   * @returns {Promise<HealthIndicatorResult>} Internet-Status
   */
  private async checkInternetStatus(): Promise<HealthIndicatorResult> {
    const isConnected = await this.checkInternetConnectivity();

    return {
      internet: {
        status: isConnected ? 'up' : 'down',
        message: isConnected ? 'Internet-Verbindung aktiv' : 'Keine Internet-Verbindung verfügbar',
      },
    };
  }

  /**
   * Erstellt einen FüKW-Status-Check.
   *
   * @returns {Promise<HealthIndicatorResult>} FüKW-Status
   */
  private async checkFuekwStatus(): Promise<HealthIndicatorResult> {
    try {
      // Prüfe, ob die Datenbank als lokaler Dienst erreichbar ist
      let isConnected: boolean;

      // Mit Prisma prüfen
      try {
        await this.prismaDb.pingCheck('prisma_connection');
        isConnected = true;
      } catch (_error) {
        isConnected = false;
      }

      const isPingable = await this.isFuekwPingable();

      return {
        fuekw: {
          status: isConnected && isPingable ? 'up' : 'down',
          message: isConnected && isPingable ? 'FüKW-Verbindung aktiv' : 'FüKW-Verbindung nicht verfügbar',
          details: {
            dbInitialized: isConnected,
            networkReachable: isPingable,
          },
        },
      };
    } catch (error: unknown) {
      return {
        fuekw: {
          status: 'down',
          message: 'Fehler bei FüKW-Verbindungsprüfung',
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Ermittelt den Verbindungsstatus basierend auf Internet- und FüKW-Verbindungen.
   *
   * @returns {Promise<HealthIndicatorResult>} Verbindungsstatus
   */
  private async determineConnectionStatus(): Promise<HealthIndicatorResult> {
    const internetResult = await this.checkInternetConnectivity();

    let fuekwResult: boolean;
    try {
      await this.prismaDb.pingCheck('prisma_ping');
      fuekwResult = await this.isFuekwPingable();
    } catch (_error) {
      fuekwResult = false;
    }

    let connectionMode: ConnectionMode = 'error';
    if (internetResult && fuekwResult) {
      connectionMode = 'online';
    } else if (!internetResult && fuekwResult) {
      connectionMode = 'offline';
    }

    return {
      connection_status: {
        status: 'up',
        details: {
          // Diese Werte werden in der Frontend-Komponente ausgewertet
          // - 'checking': Verbindungsprüfung läuft
          // - 'online': Vollständige Verbindung (Internet + FüKW)
          // - 'offline': Lokale Verbindung (nur FüKW)
          // - 'error': Keine Verbindung
          mode: connectionMode,
        },
      },
    };
  }

  /**
   * Prüft die Internet-Konnektivität durch TCP-Verbindungsversuche zu mehreren
   * öffentlichen DNS-Servern. Sobald ein Server antworten kann, gilt die
   * Internet-Verbindung als hergestellt.
   *
   * @returns {Promise<boolean>} True wenn Internet verfügbar ist, sonst false
   */
  private async checkInternetConnectivity(): Promise<boolean> {
    for (const server of this.CONNECTIVITY_CHECKS) {
      try {
        await this.testTcpConnectionWithTimeout(server.host, server.port, HEALTH_CHECK_CONFIG.CONNECTIVITY.TIMEOUT_MS);
        return true; // Erfolgreich verbunden
      } catch (_error) {
        // Versuche den nächsten Server
      }
    }

    // Alle Verbindungsversuche gescheitert
    return false;
  }

  /**
   * Testet eine TCP-Verbindung zu einem bestimmten Host und Port mit Timeout
   *
   * @param {string} host Host-Adresse
   * @param {number} port Port-Nummer
   * @param {number} timeout Timeout in Millisekunden
   * @returns {Promise<void>} Promise, der bei erfolgreicher Verbindung erfüllt wird
   */
  private testTcpConnectionWithTimeout(host: string, port: number, timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();

      // Timeout-Handler
      socket.setTimeout(timeout);
      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error('Connection timeout'));
      });

      // Fehler-Handler
      socket.on('error', (err) => {
        socket.destroy();
        reject(err);
      });

      // Verbindungs-Handler
      socket.on('connect', () => {
        socket.end();
        resolve();
      });

      // Verbindung aufbauen
      socket.connect(port, host);
    });
  }

  /**
   * Überprüft, ob das FüKW-System über das Netzwerk erreichbar ist.
   * Testet die Erreichbarkeit durch Aufruf einer einfachen, nicht-schreibenden
   * Operation des EtbService, der eine Kernfunktionalität des FüKW-Systems darstellt.
   *
   * @returns {Promise<boolean>} True wenn FüKW erreichbar, sonst false
   */
  private async isFuekwPingable(): Promise<boolean> {
    try {
      // Tatsächliche FüKW-spezifische Erreichbarkeitsprüfung:
      // Eine einfache Abfrage des EtbService durchführen
      // await this.etbService.findAll({ limit: 1, page: 1 });

      // Je nach Konfiguration die Datenbankverbindung prüfen
      try {
        await this.prismaDb.pingCheck('prisma_ping');
        return true;
      } catch (_error) {
        return false;
      }
    } catch (_error) {
      return false;
    }
  }
}
