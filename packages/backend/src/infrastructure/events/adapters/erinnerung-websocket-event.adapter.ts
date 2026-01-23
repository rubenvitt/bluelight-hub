import { Inject, Injectable, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
// biome-ignore lint/style/useImportType: ILogger needed for DI at runtime
import { ILogger } from '@domain/ports/i-logger.port';
import { ErinnerungAusgeloestEvent } from '@domain/events/erinnerung-ausgeloest.event';
import { ErinnerungAcknowledgedEvent } from '@domain/events/erinnerung-acknowledged.event';
import { ErinnerungSnoozedEvent } from '@domain/events/erinnerung-snoozed.event';
import { ErinnerungRetriggeredEvent } from '@domain/events/erinnerung-retriggered.event';
import { ErinnerungErstelltEvent } from '@domain/events/erinnerung-erstellt.event';
import { ErinnerungAssignedEvent } from '@domain/events/erinnerung-assigned.event';
import { LOGGER } from '@infrastructure/di-tokens';
// biome-ignore lint/style/useImportType: ErinnerungGateway needed for DI at runtime
import { ErinnerungGateway } from '@/modules/erinnerung/gateways/erinnerung.gateway';
// biome-ignore lint/style/useImportType: PrismaService needed for DI at runtime
import { PrismaService } from '@/infrastructure/database/prisma.service';

/**
 * WebSocket Event Adapter fuer Erinnerung Domain Events.
 *
 * **Story 1.5 AC4: WebSocket Event fuer Team-Sync (Ausgeloest)**
 * - Empfaengt ErinnerungAusgeloestEvent via @OnEvent (parallel zum ETB-Adapter)
 * - Konvertiert Domain Event in WebSocket Event
 * - Emittiert `erinnerung.triggered` via ErinnerungGateway
 *
 * **Story 1.6 AC2: WebSocket Event fuer Team-Sync (Acknowledged)**
 * - Empfaengt ErinnerungAcknowledgedEvent via @OnEvent
 * - Emittiert `erinnerung.acknowledged` via ErinnerungGateway
 *
 * **Fire-and-Forget Pattern:**
 * - Fehler werden geloggt, nicht propagiert
 * - WebSocket-Emission darf Domain-Flow nicht blockieren
 */
@Injectable()
export class ErinnerungWebSocketEventAdapter {
  constructor(
    @Optional() private readonly gateway: ErinnerungGateway | undefined,
    @Inject(LOGGER) private readonly logger: ILogger,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Empfaengt ErinnerungErstelltEvent und emittiert WebSocket Event.
   *
   * **Story 3.3:** WebSocket Event fuer Team-Sync bei Erstellung mit Zuweisung
   *
   * **Event Flow:**
   * 1. OutboxEventPublisher emittiert 'erinnerung.erstellt' Event
   * 2. NestJS EventEmitter ruft diese Methode auf (via @OnEvent)
   * 3. Diese Methode laedt User-Namen aus DB und emittiert WebSocket Event via ErinnerungGateway
   *
   * @param event - Das empfangene Domain Event
   */
  @OnEvent(ErinnerungErstelltEvent.eventName())
  async onErinnerungErstellt(event: ErinnerungErstelltEvent): Promise<void> {
    this.logger.log(
      `Processing ErinnerungErstellt for WebSocket: erinnerungId=${event.erinnerungId}, einsatzId=${event.einsatzId}, assignedToId=${event.assignedToId?.toString() ?? 'null'}`,
      'ErinnerungWebSocketEventAdapter',
    );

    // Graceful Degradation: Wenn Gateway nicht verfuegbar, nur loggen
    if (!this.gateway) {
      this.logger.error(
        'ErinnerungGateway not available - WebSocket event will not be emitted. Check module configuration and ensure ErinnerungGateway is properly registered.',
        'ErinnerungWebSocketEventAdapter',
      );
      return;
    }

    // H1 Workaround: Race Condition Prevention - Delay to ensure DB commit is completed
    await new Promise((resolve) => setTimeout(resolve, 50));

    try {
      // Story 3.3: User-Namen aus DB laden
      const [erstellerUser, assignedToUser] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: event.erstelltVon.toString() },
          select: { username: true },
        }),
        event.assignedToId
          ? this.prisma.user.findUnique({
              where: { id: event.assignedToId.toString() },
              select: { username: true },
            })
          : Promise.resolve(null),
      ]);

      // WebSocket Event emittieren
      this.gateway.emitErinnerungCreated({
        erinnerungId: event.erinnerungId.toString(),
        einsatzId: event.einsatzId.toString(),
        titel: event.titel,
        faelligAm: event.faelligAm.toISOString(),
        erstelltVon: event.erstelltVon.toString(),
        erstellerName: erstellerUser?.username ?? 'Unbekannt',
        assignedToId: event.assignedToId?.toString() ?? null,
        assignedToName: assignedToUser?.username ?? null,
        timestamp: new Date().toISOString(),
      });

      this.logger.log(
        `WebSocket event emitted for ErinnerungErstellt: erinnerungId=${event.erinnerungId}, assignedToId=${event.assignedToId?.toString() ?? 'null'}`,
        'ErinnerungWebSocketEventAdapter',
      );
    } catch (error) {
      // Fire-and-Forget: Fehler loggen, aber nicht propagieren
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to emit WebSocket event for ErinnerungErstellt: erinnerungId=${event.erinnerungId}, error=${errorMessage}`, 'ErinnerungWebSocketEventAdapter');
    }
  }

  /**
   * Empfaengt ErinnerungAusgeloestEvent und emittiert WebSocket Event.
   *
   * **Event Flow:**
   * 1. OutboxEventPublisher emittiert 'erinnerung.ausgeloest' Event
   * 2. NestJS EventEmitter ruft diese Methode auf (via @OnEvent)
   * 3. Diese Methode emittiert WebSocket Event via ErinnerungGateway
   *
   * @param event - Das empfangene Domain Event
   */
  @OnEvent(ErinnerungAusgeloestEvent.eventName())
  async onErinnerungAusgeloest(event: ErinnerungAusgeloestEvent): Promise<void> {
    this.logger.log(`Processing ErinnerungAusgeloest for WebSocket: erinnerungId=${event.erinnerungId}, einsatzId=${event.einsatzId}`, 'ErinnerungWebSocketEventAdapter');

    // Graceful Degradation: Wenn Gateway nicht verfuegbar, nur loggen
    if (!this.gateway) {
      this.logger.error(
        'ErinnerungGateway not available - WebSocket event will not be emitted. Check module configuration and ensure ErinnerungGateway is properly registered.',
        'ErinnerungWebSocketEventAdapter',
      );
      return;
    }

    // H1 Workaround: Race Condition Prevention - Delay to ensure DB commit is completed
    // Problem: OutboxEventPublisher emittiert Events innerhalb der Transaction, aber der
    // WebSocket-Client koennte die DB vor dem Commit abfragen und veraltete Daten sehen.
    // Loesung: 50ms Delay ist ein pragmatischer Workaround. Eine sauberere Loesung waere
    // ein separater "post-commit" Event Bus, aber das erfordert groessere Architektur-Aenderung.
    // Die 50ms funktionieren in der Praxis zuverlaessig fuer typische DB-Commit-Zeiten.
    await new Promise((resolve) => setTimeout(resolve, 50));

    try {
      // WebSocket Event emittieren
      this.gateway.emitErinnerungTriggered({
        erinnerungId: event.erinnerungId.toString(),
        einsatzId: event.einsatzId.toString(),
        titel: event.titel,
        timestamp: event.ausgeloestAm.toISOString(),
      });

      this.logger.log(`WebSocket event emitted for ErinnerungAusgeloest: erinnerungId=${event.erinnerungId}`, 'ErinnerungWebSocketEventAdapter');
    } catch (error) {
      // Fire-and-Forget: Fehler loggen, aber nicht propagieren
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to emit WebSocket event for ErinnerungAusgeloest: erinnerungId=${event.erinnerungId}, error=${errorMessage}`, 'ErinnerungWebSocketEventAdapter');
    }
  }

  /**
   * Empfaengt ErinnerungAcknowledgedEvent und emittiert WebSocket Event.
   *
   * **Story 1.6 AC2: WebSocket Event fuer Team-Sync bei Bestaetigung**
   *
   * **Event Flow:**
   * 1. OutboxEventPublisher emittiert 'erinnerung.acknowledged' Event
   * 2. NestJS EventEmitter ruft diese Methode auf (via @OnEvent)
   * 3. Diese Methode emittiert WebSocket Event via ErinnerungGateway
   *
   * @param event - Das empfangene Domain Event
   */
  @OnEvent(ErinnerungAcknowledgedEvent.eventName())
  async onErinnerungAcknowledged(event: ErinnerungAcknowledgedEvent): Promise<void> {
    this.logger.log(`Processing ErinnerungAcknowledged for WebSocket: erinnerungId=${event.erinnerungId}, einsatzId=${event.einsatzId}`, 'ErinnerungWebSocketEventAdapter');

    // Graceful Degradation: Wenn Gateway nicht verfuegbar, nur loggen
    if (!this.gateway) {
      this.logger.error(
        'ErinnerungGateway not available - WebSocket event will not be emitted. Check module configuration and ensure ErinnerungGateway is properly registered.',
        'ErinnerungWebSocketEventAdapter',
      );
      return;
    }

    // H1 Workaround: Race Condition Prevention - Delay to ensure DB commit is completed
    // Problem: OutboxEventPublisher emittiert Events innerhalb der Transaction, aber der
    // WebSocket-Client koennte die DB vor dem Commit abfragen und veraltete Daten sehen.
    // Loesung: 50ms Delay ist ein pragmatischer Workaround. Eine sauberere Loesung waere
    // ein separater "post-commit" Event Bus, aber das erfordert groessere Architektur-Aenderung.
    // Die 50ms funktionieren in der Praxis zuverlaessig fuer typische DB-Commit-Zeiten.
    await new Promise((resolve) => setTimeout(resolve, 50));

    try {
      // WebSocket Event emittieren
      this.gateway.emitErinnerungAcknowledged({
        erinnerungId: event.erinnerungId.toString(),
        einsatzId: event.einsatzId.toString(),
        acknowledgedBy: event.acknowledgedBy.toString(),
        timestamp: event.acknowledgedAm.toISOString(),
      });

      this.logger.log(`WebSocket event emitted for ErinnerungAcknowledged: erinnerungId=${event.erinnerungId}`, 'ErinnerungWebSocketEventAdapter');
    } catch (error) {
      // Fire-and-Forget: Fehler loggen, aber nicht propagieren
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to emit WebSocket event for ErinnerungAcknowledged: erinnerungId=${event.erinnerungId}, error=${errorMessage}`, 'ErinnerungWebSocketEventAdapter');
    }
  }

  /**
   * Empfaengt ErinnerungSnoozedEvent und emittiert WebSocket Event.
   *
   * **Story 2.1 AC2:** WebSocket Event fuer Team-Sync bei Snooze
   *
   * **Event Flow:**
   * 1. OutboxEventPublisher emittiert 'erinnerung.snoozed' Event
   * 2. NestJS EventEmitter ruft diese Methode auf (via @OnEvent)
   * 3. Diese Methode emittiert WebSocket Event via ErinnerungGateway
   *
   * @param event - Das empfangene Domain Event
   */
  @OnEvent(ErinnerungSnoozedEvent.eventName())
  async onErinnerungSnoozed(event: ErinnerungSnoozedEvent): Promise<void> {
    this.logger.log(
      `Processing ErinnerungSnoozed for WebSocket: erinnerungId=${event.erinnerungId}, einsatzId=${event.einsatzId}, snoozeMinutes=${event.snoozeMinutes}`,
      'ErinnerungWebSocketEventAdapter',
    );

    // Graceful Degradation: Wenn Gateway nicht verfuegbar, nur loggen
    if (!this.gateway) {
      this.logger.error(
        'ErinnerungGateway not available - WebSocket event will not be emitted. Check module configuration and ensure ErinnerungGateway is properly registered.',
        'ErinnerungWebSocketEventAdapter',
      );
      return;
    }

    // H1 Workaround: Race Condition Prevention - Delay to ensure DB commit is completed
    // Problem: OutboxEventPublisher emittiert Events innerhalb der Transaction, aber der
    // WebSocket-Client koennte die DB vor dem Commit abfragen und veraltete Daten sehen.
    // Loesung: 50ms Delay ist ein pragmatischer Workaround. Eine sauberere Loesung waere
    // ein separater "post-commit" Event Bus, aber das erfordert groessere Architektur-Aenderung.
    // Die 50ms funktionieren in der Praxis zuverlaessig fuer typische DB-Commit-Zeiten.
    await new Promise((resolve) => setTimeout(resolve, 50));

    try {
      // WebSocket Event emittieren
      this.gateway.emitErinnerungSnoozed({
        erinnerungId: event.erinnerungId.toString(),
        einsatzId: event.einsatzId.toString(),
        snoozedBy: event.snoozedBy.toString(),
        snoozedUntil: event.snoozedUntil.toISOString(),
        snoozeMinutes: event.snoozeMinutes,
        snoozeCount: event.snoozeCount,
        timestamp: event.snoozedAt.toISOString(),
      });

      this.logger.log(`WebSocket event emitted for ErinnerungSnoozed: erinnerungId=${event.erinnerungId}, snoozeMinutes=${event.snoozeMinutes}`, 'ErinnerungWebSocketEventAdapter');
    } catch (error) {
      // Fire-and-Forget: Fehler loggen, aber nicht propagieren
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to emit WebSocket event for ErinnerungSnoozed: erinnerungId=${event.erinnerungId}, error=${errorMessage}`, 'ErinnerungWebSocketEventAdapter');
    }
  }

  /**
   * Empfaengt ErinnerungRetriggeredEvent und emittiert WebSocket Event.
   *
   * **Story 2.2 AC4:** WebSocket Event fuer Team-Sync bei erneuter Ausloesung nach Snooze
   *
   * **Event Flow:**
   * 1. OutboxEventPublisher emittiert 'erinnerung.retriggered' Event
   * 2. NestJS EventEmitter ruft diese Methode auf (via @OnEvent)
   * 3. Diese Methode emittiert WebSocket Event via ErinnerungGateway
   *
   * @param event - Das empfangene Domain Event
   */
  @OnEvent(ErinnerungRetriggeredEvent.eventName())
  async onErinnerungRetriggered(event: ErinnerungRetriggeredEvent): Promise<void> {
    this.logger.log(
      `Processing ErinnerungRetriggered for WebSocket: erinnerungId=${event.erinnerungId}, einsatzId=${event.einsatzId}, snoozeCount=${event.snoozeCount}`,
      'ErinnerungWebSocketEventAdapter',
    );

    // Graceful Degradation: Wenn Gateway nicht verfuegbar, nur loggen
    if (!this.gateway) {
      this.logger.error(
        'ErinnerungGateway not available - WebSocket event will not be emitted. Check module configuration and ensure ErinnerungGateway is properly registered.',
        'ErinnerungWebSocketEventAdapter',
      );
      return;
    }

    // H1 Workaround: Race Condition Prevention - Delay to ensure DB commit is completed
    // Problem: OutboxEventPublisher emittiert Events innerhalb der Transaction, aber der
    // WebSocket-Client koennte die DB vor dem Commit abfragen und veraltete Daten sehen.
    // Loesung: 50ms Delay ist ein pragmatischer Workaround. Eine sauberere Loesung waere
    // ein separater "post-commit" Event Bus, aber das erfordert groessere Architektur-Aenderung.
    // Die 50ms funktionieren in der Praxis zuverlaessig fuer typische DB-Commit-Zeiten.
    await new Promise((resolve) => setTimeout(resolve, 50));

    try {
      // WebSocket Event emittieren
      this.gateway.emitErinnerungRetriggered({
        erinnerungId: event.erinnerungId.toString(),
        einsatzId: event.einsatzId.toString(),
        titel: event.titel,
        snoozeCount: event.snoozeCount,
        isRetrigger: true,
        timestamp: event.retriggeredAm.toISOString(),
      });

      this.logger.log(`WebSocket event emitted for ErinnerungRetriggered: erinnerungId=${event.erinnerungId}, snoozeCount=${event.snoozeCount}`, 'ErinnerungWebSocketEventAdapter');
    } catch (error) {
      // Fire-and-Forget: Fehler loggen, aber nicht propagieren
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to emit WebSocket event for ErinnerungRetriggered: erinnerungId=${event.erinnerungId}, error=${errorMessage}`, 'ErinnerungWebSocketEventAdapter');
    }
  }

  /**
   * Empfaengt ErinnerungAssignedEvent und emittiert WebSocket Event.
   *
   * **Story 3.4:** WebSocket Event fuer Team-Sync bei Zuweisung einer bestehenden Erinnerung
   *
   * **Event Flow:**
   * 1. OutboxEventPublisher emittiert 'erinnerung.assigned' Event
   * 2. NestJS EventEmitter ruft diese Methode auf (via @OnEvent)
   * 3. Diese Methode laedt User-Namen aus DB und emittiert WebSocket Event via ErinnerungGateway
   *
   * @param event - Das empfangene Domain Event
   */
  @OnEvent(ErinnerungAssignedEvent.eventName())
  async onErinnerungAssigned(event: ErinnerungAssignedEvent): Promise<void> {
    this.logger.log(
      `Processing ErinnerungAssigned for WebSocket: erinnerungId=${event.erinnerungId}, einsatzId=${event.einsatzId}, assignedToId=${event.assignedToId}`,
      'ErinnerungWebSocketEventAdapter',
    );

    // Graceful Degradation: Wenn Gateway nicht verfuegbar, nur loggen
    if (!this.gateway) {
      this.logger.error(
        'ErinnerungGateway not available - WebSocket event will not be emitted. Check module configuration and ensure ErinnerungGateway is properly registered.',
        'ErinnerungWebSocketEventAdapter',
      );
      return;
    }

    // H1 Workaround: Race Condition Prevention - Delay to ensure DB commit is completed
    await new Promise((resolve) => setTimeout(resolve, 50));

    try {
      // User-Namen aus DB laden
      const [assignedToUser, assignedByUser] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: event.assignedToId.toString() },
          select: { username: true },
        }),
        this.prisma.user.findUnique({
          where: { id: event.assignedById.toString() },
          select: { username: true },
        }),
      ]);

      // WebSocket Event emittieren
      this.gateway.emitErinnerungAssigned({
        erinnerungId: event.erinnerungId.toString(),
        einsatzId: event.einsatzId.toString(),
        assignedToId: event.assignedToId.toString(),
        assignedToName: assignedToUser?.username ?? 'Unbekannt',
        assignedById: event.assignedById.toString(),
        assignedByName: assignedByUser?.username ?? 'Unbekannt',
        titel: event.titel,
        timestamp: event.assignedAt.toISOString(),
      });

      this.logger.log(`WebSocket event emitted for ErinnerungAssigned: erinnerungId=${event.erinnerungId}, assignedToId=${event.assignedToId}`, 'ErinnerungWebSocketEventAdapter');
    } catch (error) {
      // Fire-and-Forget: Fehler loggen, aber nicht propagieren
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to emit WebSocket event for ErinnerungAssigned: erinnerungId=${event.erinnerungId}, error=${errorMessage}`, 'ErinnerungWebSocketEventAdapter');
    }
  }
}
