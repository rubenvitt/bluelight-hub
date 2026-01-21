import { Inject, Injectable, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer, SubscribeMessage, type OnGatewayConnection, type OnGatewayDisconnect, ConnectedSocket, MessageBody } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
// biome-ignore lint/style/useImportType: ConfigService needed for NestJS DI at runtime (AC1)
import { ConfigService } from '@nestjs/config';
// biome-ignore lint/style/useImportType: ILogger needed for DI at runtime
import { ILogger } from '@domain/ports/i-logger.port';
import { LOGGER } from '@infrastructure/di-tokens';
import { WsJwtAuthGuard } from '../guards/ws-jwt-auth.guard';
import type { JoinEinsatzDto } from '../dto/join-einsatz.dto';

/**
 * WebSocket Payload fuer erinnerung.triggered Event (Story 1.5 AC4).
 */
export interface ErinnerungTriggeredPayload {
  erinnerungId: string;
  einsatzId: string;
  titel: string;
  timestamp: string;
}

/**
 * WebSocket Payload fuer erinnerung.created Event.
 */
export interface ErinnerungCreatedPayload {
  erinnerungId: string;
  einsatzId: string;
  titel: string;
  faelligAm: string;
  timestamp: string;
}

/**
 * WebSocket Payload fuer erinnerung.updated Event.
 */
export interface ErinnerungUpdatedPayload {
  erinnerungId: string;
  einsatzId: string;
  titel: string;
  faelligAm: string;
  timestamp: string;
}

/**
 * WebSocket Payload fuer erinnerung.deleted Event.
 */
export interface ErinnerungDeletedPayload {
  erinnerungId: string;
  einsatzId: string;
  timestamp: string;
}

/**
 * WebSocket Payload fuer erinnerung.acknowledged Event (Story 1.6 AC2).
 */
export interface ErinnerungAcknowledgedPayload {
  erinnerungId: string;
  einsatzId: string;
  acknowledgedBy: string;
  timestamp: string;
}

/**
 * WebSocket Payload fuer erinnerung.snoozed Event (Story 2.1 AC2).
 */
export interface ErinnerungSnoozedPayload {
  erinnerungId: string;
  einsatzId: string;
  snoozedBy: string;
  snoozedUntil: string;
  snoozeMinutes: number;
  snoozeCount: number;
  timestamp: string;
}

/**
 * WebSocket Payload fuer erinnerung.retriggered Event (Story 2.2 AC4).
 */
export interface ErinnerungRetriggeredPayload {
  erinnerungId: string;
  einsatzId: string;
  titel: string;
  snoozeCount: number;
  isRetrigger: true;
  timestamp: string;
}

/**
 * WebSocket Gateway fuer Erinnerungen.
 *
 * **Story 1.5 AC4: WebSocket Event fuer Team-Sync**
 * - Emittiert `erinnerung.triggered` wenn eine Erinnerung ausgeloest wird
 * - Alle Clients im Room `einsatz:{einsatzId}:erinnerungen` erhalten das Event
 *
 * **Security (C1, C2, C3):**
 * - CORS: Nur FRONTEND_URL erlaubt (kein wildcard '*')
 * - Authentication: JWT Token bei Connection erforderlich (WsJwtAuthGuard)
 * - Authorization: einsatzId wird validiert (UUID v4 Format)
 * - Input Validation: JoinEinsatzDto mit class-validator
 *
 * **Room Pattern:**
 * - Clients joinen Room `einsatz:{einsatzId}:erinnerungen` beim Connect
 * - Events werden an den Room gebroadcastet
 *
 * **Events:**
 * - `erinnerung.triggered`: Erinnerung wurde ausgeloest (Story 1.5)
 * - `erinnerung.created`: Neue Erinnerung erstellt
 * - `erinnerung.updated`: Erinnerung aktualisiert
 * - `erinnerung.deleted`: Erinnerung geloescht
 */
@Injectable()
@UseGuards(WsJwtAuthGuard)
@WebSocketGateway({
  namespace: '/erinnerungen',
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3090',
    credentials: true,
  },
})
export class ErinnerungGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    @Inject(LOGGER) private readonly logger: ILogger,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Handler fuer neue WebSocket-Verbindungen.
   *
   * **Security (C2):** JWT Token wird via WsJwtAuthGuard validiert.
   * `client.data.userId` und `client.data.role` sind nach erfolgreicher Auth gesetzt.
   *
   * @param client - WebSocket Client (authenticated via WsJwtAuthGuard)
   */
  handleConnection(client: Socket): void {
    const userId = client.data.userId as string | undefined;
    this.logger.log(`Client connected: ${client.id}, userId: ${userId || 'unknown'}`, 'ErinnerungGateway');
  }

  /**
   * Handler fuer WebSocket-Verbindungstrennung.
   */
  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`, 'ErinnerungGateway');
  }

  /**
   * Client joined einen Einsatz-Room fuer Erinnerungen.
   *
   * **Security (C3):** Input Validation via JoinEinsatzDto.
   * - einsatzId MUSS UUID v4 Format sein (verhindert Room Traversal)
   * - ValidationPipe validiert automatisch vor Room-Join
   *
   * **Authorization (C2):** Pruefen ob User Zugriff auf Einsatz hat.
   * TODO (Future Enhancement): Repository-Check ob User dem Einsatz zugeordnet ist.
   *
   * @param dto - Validiertes JoinEinsatzDto mit einsatzId
   * @param client - WebSocket Client (authenticated)
   */
  @SubscribeMessage('join:einsatz')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  handleJoinEinsatz(@MessageBody() dto: JoinEinsatzDto, @ConnectedSocket() client: Socket): void {
    const { einsatzId } = dto;
    const userId = client.data.userId as string;

    // TODO (Future Enhancement): Authorization Check
    // Pruefen ob userId Zugriff auf einsatzId hat:
    // const hasAccess = await this.einsatzRepository.userHasAccess(userId, einsatzId);
    // if (!hasAccess) {
    //   client.emit('error', { message: 'Forbidden: No access to this einsatz' });
    //   return;
    // }

    const roomName = this.getRoomName(einsatzId);
    client.join(roomName);
    this.logger.log(`Client ${client.id} (userId: ${userId}) joined room ${roomName}`, 'ErinnerungGateway');
  }

  /**
   * Client verlaesst einen Einsatz-Room.
   *
   * **Security (C3):** Input Validation via JoinEinsatzDto.
   *
   * @param dto - Validiertes JoinEinsatzDto mit einsatzId
   * @param client - WebSocket Client
   */
  @SubscribeMessage('leave:einsatz')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  handleLeaveEinsatz(@MessageBody() dto: JoinEinsatzDto, @ConnectedSocket() client: Socket): void {
    const { einsatzId } = dto;
    const userId = client.data.userId as string;
    const roomName = this.getRoomName(einsatzId);
    client.leave(roomName);
    this.logger.log(`Client ${client.id} (userId: ${userId}) left room ${roomName}`, 'ErinnerungGateway');
  }

  /**
   * Emittiert `erinnerung.triggered` Event an alle Clients im Einsatz-Room.
   *
   * **Story 1.5 AC4:** WebSocket Event fuer Team-Sync
   *
   * @param payload - Event-Payload mit erinnerungId, einsatzId, titel, timestamp
   */
  emitErinnerungTriggered(payload: ErinnerungTriggeredPayload): void {
    const roomName = this.getRoomName(payload.einsatzId);
    this.server.to(roomName).emit('erinnerung.triggered', payload);
    this.logger.log(`Emitted erinnerung.triggered to room ${roomName}: erinnerungId=${payload.erinnerungId}`, 'ErinnerungGateway');
  }

  /**
   * Emittiert `erinnerung.created` Event an alle Clients im Einsatz-Room.
   *
   * @param payload - Event-Payload
   */
  emitErinnerungCreated(payload: ErinnerungCreatedPayload): void {
    const roomName = this.getRoomName(payload.einsatzId);
    this.server.to(roomName).emit('erinnerung.created', payload);
    this.logger.log(`Emitted erinnerung.created to room ${roomName}: erinnerungId=${payload.erinnerungId}`, 'ErinnerungGateway');
  }

  /**
   * Emittiert `erinnerung.updated` Event an alle Clients im Einsatz-Room.
   *
   * @param payload - Event-Payload
   */
  emitErinnerungUpdated(payload: ErinnerungUpdatedPayload): void {
    const roomName = this.getRoomName(payload.einsatzId);
    this.server.to(roomName).emit('erinnerung.updated', payload);
    this.logger.log(`Emitted erinnerung.updated to room ${roomName}: erinnerungId=${payload.erinnerungId}`, 'ErinnerungGateway');
  }

  /**
   * Emittiert `erinnerung.deleted` Event an alle Clients im Einsatz-Room.
   *
   * @param payload - Event-Payload
   */
  emitErinnerungDeleted(payload: ErinnerungDeletedPayload): void {
    const roomName = this.getRoomName(payload.einsatzId);
    this.server.to(roomName).emit('erinnerung.deleted', payload);
    this.logger.log(`Emitted erinnerung.deleted to room ${roomName}: erinnerungId=${payload.erinnerungId}`, 'ErinnerungGateway');
  }

  /**
   * Emittiert `erinnerung.acknowledged` Event an alle Clients im Einsatz-Room.
   *
   * **Story 1.6 AC2:** WebSocket Event fuer Team-Sync bei Bestaetigung
   *
   * @param payload - Event-Payload mit erinnerungId, einsatzId, acknowledgedBy, timestamp
   */
  emitErinnerungAcknowledged(payload: ErinnerungAcknowledgedPayload): void {
    const roomName = this.getRoomName(payload.einsatzId);
    this.server.to(roomName).emit('erinnerung.acknowledged', payload);
    this.logger.log(`Emitted erinnerung.acknowledged to room ${roomName}: erinnerungId=${payload.erinnerungId}`, 'ErinnerungGateway');
  }

  /**
   * Emittiert `erinnerung.snoozed` Event an alle Clients im Einsatz-Room.
   *
   * **Story 2.1 AC2:** WebSocket Event fuer Team-Sync bei Snooze
   *
   * @param payload - Event-Payload mit erinnerungId, einsatzId, snoozedBy, snoozedUntil, snoozeMinutes, snoozeCount, timestamp
   */
  emitErinnerungSnoozed(payload: ErinnerungSnoozedPayload): void {
    const roomName = this.getRoomName(payload.einsatzId);
    this.server.to(roomName).emit('erinnerung.snoozed', payload);
    this.logger.log(`Emitted erinnerung.snoozed to room ${roomName}: erinnerungId=${payload.erinnerungId}, snoozeMinutes=${payload.snoozeMinutes}`, 'ErinnerungGateway');
  }

  /**
   * Emittiert `erinnerung.retriggered` Event an alle Clients im Einsatz-Room.
   *
   * **Story 2.2 AC4:** WebSocket Event fuer Team-Sync bei erneuter Ausloesung nach Snooze
   *
   * @param payload - Event-Payload mit erinnerungId, einsatzId, titel, snoozeCount, isRetrigger, timestamp
   */
  emitErinnerungRetriggered(payload: ErinnerungRetriggeredPayload): void {
    const roomName = this.getRoomName(payload.einsatzId);
    this.server.to(roomName).emit('erinnerung.retriggered', payload);
    this.logger.log(`Emitted erinnerung.retriggered to room ${roomName}: erinnerungId=${payload.erinnerungId}, snoozeCount=${payload.snoozeCount}`, 'ErinnerungGateway');
  }

  /**
   * Generiert den Room-Namen fuer einen Einsatz.
   *
   * @param einsatzId - ID des Einsatzes
   * @returns Room-Name im Format `einsatz:{einsatzId}:erinnerungen`
   */
  private getRoomName(einsatzId: string): string {
    return `einsatz:${einsatzId}:erinnerungen`;
  }
}
