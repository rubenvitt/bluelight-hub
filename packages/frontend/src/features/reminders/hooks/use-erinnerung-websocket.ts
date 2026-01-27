/**
 * useErinnerungWebSocket Hook
 *
 * WebSocket-Integration für Echtzeit-Erinnerungs-Updates.
 * Verbindet zum Backend-WebSocket Gateway und invalidiert
 * Query-Cache bei relevanten Events.
 *
 * **Story 1.5 Task 15 (AC4):**
 * - Verbindung zum Namespace `/erinnerungen`
 * - Room: `einsatz:{einsatzId}:erinnerungen`
 * - Events: `erinnerung.triggered`, `erinnerung.created`, `erinnerung.updated`, `erinnerung.deleted`
 * - Toast-Notification bei Team-Member Events
 *
 * **Story 1.6 AC2:**
 * - Event: `erinnerung.acknowledged` fuer Team-Sync bei Bestaetigung
 */

import { useCurrentUser } from '@/features/auth/api';
import { logger } from '@/shared/lib/logger';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { ERINNERUNG_QUERY_KEYS } from '../api/queries';
import { sendAssignmentNotification } from '../services/notification.service';

/** WebSocket Server URL (Backend Port) */
const WS_URL = import.meta.env.VITE_API_URL || 'http://localhost:3091';

/** WebSocket Namespace für Erinnerungen */
const WS_NAMESPACE = '/erinnerungen';

/** Reconnection Konfiguration */
const RECONNECT_DELAY_MS = 1000;
const RECONNECT_DELAY_MAX_MS = 10000;

/**
 * WebSocket Event Payload Typen
 */
export interface ErinnerungWebSocketEvent {
  erinnerungId: string;
  einsatzId: string;
  titel?: string;
  timestamp: string;
  userId?: string;
  /** Story 1.6: User der die Erinnerung bestätigt hat */
  acknowledgedBy?: string;
}

/**
 * WebSocket Event Payload für Assigned Events (Story 3.4)
 */
export interface ErinnerungAssignedWebSocketEvent extends ErinnerungWebSocketEvent {
  assignedToId: string;
  assignedToName: string;
  assignedById: string;
  assignedByName: string;
}

/**
 * WebSocket Event Payload für Escalated Events (Story 4.5)
 */
export interface ErinnerungEscalatedWebSocketEvent extends ErinnerungWebSocketEvent {
  eskalationsPersonId: string | null;
  eskalationsPersonName: string | null;
  erstelltVon: string;
  eskaliertAm: string;
}

/**
 * WebSocket Connection Status
 */
export type WebSocketStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Hook Options
 */
export interface UseErinnerungWebSocketOptions {
  /** Einsatz-ID für Room-Subscription */
  einsatzId: string;
  /** Ob WebSocket aktiviert sein soll (default: true) */
  enabled?: boolean;
  /** Toast bei Team-Events anzeigen (default: true) */
  showTeamToasts?: boolean;
  /** Callback bei Trigger-Event */
  onTriggered?: (event: ErinnerungWebSocketEvent) => void;
  /** Callback bei Create-Event */
  onCreated?: (event: ErinnerungWebSocketEvent) => void;
  /** Callback bei Update-Event */
  onUpdated?: (event: ErinnerungWebSocketEvent) => void;
  /** Callback bei Delete-Event */
  onDeleted?: (event: ErinnerungWebSocketEvent) => void;
  /** Callback bei Acknowledge-Event (Story 1.6) */
  onAcknowledged?: (event: ErinnerungWebSocketEvent) => void;
  /** Callback bei Assign-Event (Story 3.4) */
  onAssigned?: (event: ErinnerungAssignedWebSocketEvent) => void;
}

/**
 * Hook Return Type
 */
export interface UseErinnerungWebSocketReturn {
  /** Aktueller Verbindungsstatus */
  status: WebSocketStatus;
  /** Ob verbunden */
  isConnected: boolean;
  /** Manuelles Verbinden */
  connect: () => void;
  /** Manuelles Trennen */
  disconnect: () => void;
}

/**
 * WebSocket Hook für Echtzeit-Erinnerungs-Updates
 *
 * Verbindet automatisch beim Mount und invalidiert Query-Cache
 * bei relevanten Events.
 *
 * @example
 * ```tsx
 * function ErinnerungenPage({ einsatzId }: Props) {
 *   const { status, isConnected } = useErinnerungWebSocket({
 *     einsatzId,
 *     onTriggered: (event) => {
 *       console.log('Erinnerung ausgelöst:', event.titel);
 *     },
 *   });
 *
 *   return (
 *     <div>
 *       <StatusIndicator connected={isConnected} />
 *       <ErinnerungsList einsatzId={einsatzId} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useErinnerungWebSocket({
  einsatzId,
  enabled = true,
  showTeamToasts = true,
  onTriggered,
  onCreated,
  onUpdated,
  onDeleted,
  onAcknowledged,
  onAssigned,
}: UseErinnerungWebSocketOptions): UseErinnerungWebSocketReturn {
  const queryClient = useQueryClient();
  const { user: currentUser } = useCurrentUser();
  const currentUserId = currentUser?.id;
  const socketRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<WebSocketStatus>('disconnected');

  // C8 Fix: Use refs for callbacks to ensure stable dependencies for useEffect
  const onTriggeredRef = useRef(onTriggered);
  const onCreatedRef = useRef(onCreated);
  const onUpdatedRef = useRef(onUpdated);
  const onDeletedRef = useRef(onDeleted);
  const onAcknowledgedRef = useRef(onAcknowledged);
  const onAssignedRef = useRef(onAssigned);
  const onEscalatedRef = useRef<(event: ErinnerungEscalatedWebSocketEvent) => void>(undefined);

  // Update refs on every render
  useEffect(() => {
    onTriggeredRef.current = onTriggered;
    onCreatedRef.current = onCreated;
    onUpdatedRef.current = onUpdated;
    onDeletedRef.current = onDeleted;
    onAcknowledgedRef.current = onAcknowledged;
    onAssignedRef.current = onAssigned;
  });

  // H5 Fix: Ref für aktuelle einsatzId um stale Closures im connect Handler zu vermeiden
  const currentEinsatzIdRef = useRef(einsatzId);
  currentEinsatzIdRef.current = einsatzId;

  // Issue #2 Fix: Ref für aktuelle userId um stale Closures in Event Handlers zu vermeiden
  const currentUserIdRef = useRef(currentUserId);
  currentUserIdRef.current = currentUserId;

  // C4 Fix: Track previous einsatzId for room cleanup
  const previousEinsatzIdRef = useRef<string | null>(null);

  // Room Name für den Einsatz
  const roomName = `einsatz:${einsatzId}:erinnerungen`;

  /**
   * Invalidiert den Erinnerungen-Query-Cache
   */
  const invalidateCache = useCallback(() => {
    logger.debug('WebSocket: Invalidating erinnerungen cache', { einsatzId });
    queryClient.invalidateQueries({
      queryKey: ERINNERUNG_QUERY_KEYS.list(einsatzId),
    });
  }, [queryClient, einsatzId]);

  /**
   * Handler für 'erinnerung.triggered' Event
   *
   * Issue 7 Fix: Toast nur bei Events von anderen Usern anzeigen (nicht bei eigenen Actions)
   */
  const handleTriggered = useCallback(
    (event: ErinnerungWebSocketEvent) => {
      logger.info('WebSocket: Erinnerung triggered', event);

      // Issue #2 Fix: Nutze Ref statt Closure für aktuelle userId
      const userId = currentUserIdRef.current;
      // Issue 7 Fix: Prüfe ob Event vom aktuellen User stammt
      const isOwnEvent = userId && event.userId === userId;

      // C7 Fix: Check if mutation is pending for this erinnerung
      const mutationCache = queryClient.getMutationCache();
      const pendingMutation = mutationCache.find({
        predicate: (mutation) => mutation.state.status === 'pending' && (mutation.options.mutationKey?.some((key) => typeof key === 'string' && key.includes(event.erinnerungId)) ?? false),
      });

      if (pendingMutation) {
        logger.debug('WebSocket: Skipping cache invalidation - mutation pending', { erinnerungId: event.erinnerungId });
        // Skip cache invalidation but still show toast (nur bei Team-Events) and call callback
        if (showTeamToasts && !isOwnEvent && event.titel) {
          toast.warning(`Erinnerung "${event.titel}" wurde ausgelöst`, {
            description: 'Ein Teammitglied hat diese Erinnerung ausgelöst',
          });
        }
        onTriggeredRef.current?.(event);
        return;
      }

      invalidateCache();

      // Issue 7 Fix: Toast nur bei Team-Events (nicht eigene Actions)
      if (showTeamToasts && !isOwnEvent && event.titel) {
        toast.warning(`Erinnerung "${event.titel}" wurde ausgelöst`, {
          description: 'Ein Teammitglied hat diese Erinnerung ausgelöst',
        });
      }

      onTriggeredRef.current?.(event);
    },
    [invalidateCache, showTeamToasts, queryClient],
  );

  /**
   * Handler für 'erinnerung.created' Event
   *
   * Issue 7 Fix: Toast nur bei Events von anderen Usern anzeigen (nicht bei eigenen Actions)
   */
  const handleCreated = useCallback(
    (event: ErinnerungWebSocketEvent) => {
      logger.info('WebSocket: Erinnerung created', event);
      invalidateCache();

      // Issue #2 Fix: Nutze Ref statt Closure für aktuelle userId
      const userId = currentUserIdRef.current;
      // Issue 7 Fix: Prüfe ob Event vom aktuellen User stammt
      const isOwnEvent = userId && event.userId === userId;

      // Issue 7 Fix: Toast nur bei Team-Events (nicht eigene Actions)
      if (showTeamToasts && !isOwnEvent && event.titel) {
        toast.success(`Neue Erinnerung: "${event.titel}"`, {
          description: 'Ein Teammitglied hat eine Erinnerung erstellt',
        });
      }

      onCreatedRef.current?.(event);
    },
    [invalidateCache, showTeamToasts],
  );

  /**
   * Handler für 'erinnerung.updated' Event
   */
  const handleUpdated = useCallback(
    (event: ErinnerungWebSocketEvent) => {
      logger.info('WebSocket: Erinnerung updated', event);
      invalidateCache();

      onUpdatedRef.current?.(event);
    },
    [invalidateCache],
  );

  /**
   * Handler für 'erinnerung.deleted' Event
   *
   * Issue 7 Fix: Toast nur bei Events von anderen Usern anzeigen (nicht bei eigenen Actions)
   */
  const handleDeleted = useCallback(
    (event: ErinnerungWebSocketEvent) => {
      logger.info('WebSocket: Erinnerung deleted', event);
      invalidateCache();

      // Issue #2 Fix: Nutze Ref statt Closure für aktuelle userId
      const userId = currentUserIdRef.current;
      // Issue 7 Fix: Prüfe ob Event vom aktuellen User stammt
      const isOwnEvent = userId && event.userId === userId;

      // Issue 7 Fix: Toast nur bei Team-Events (nicht eigene Actions)
      if (showTeamToasts && !isOwnEvent && event.titel) {
        toast.info(`Erinnerung "${event.titel}" gelöscht`, {
          description: 'Ein Teammitglied hat diese Erinnerung gelöscht',
        });
      }

      onDeletedRef.current?.(event);
    },
    [invalidateCache, showTeamToasts],
  );

  /**
   * Handler für 'erinnerung.acknowledged' Event (Story 1.6 AC2)
   *
   * C7 Fix: Prüft ob eine lokale Mutation pending ist, um Race Conditions
   * zwischen eigenem Acknowledge und WebSocket-Event zu vermeiden.
   *
   * Issue 7 Fix: Toast nur bei Events von anderen Usern anzeigen (nicht bei eigenen Actions)
   */
  const handleAcknowledged = useCallback(
    (event: ErinnerungWebSocketEvent) => {
      logger.info('WebSocket: Erinnerung acknowledged', event);

      // Issue #2 Fix: Nutze Ref statt Closure für aktuelle userId
      const userId = currentUserIdRef.current;
      // Issue 7 Fix: Prüfe ob Event vom aktuellen User stammt
      const isOwnEvent = userId && event.userId === userId;

      // C7 Fix: Check if mutation is pending for this erinnerung
      const mutationCache = queryClient.getMutationCache();
      const pendingMutation = mutationCache.find({
        predicate: (mutation) => mutation.state.status === 'pending' && (mutation.options.mutationKey?.some((key) => typeof key === 'string' && key.includes(event.erinnerungId)) ?? false),
      });

      if (pendingMutation) {
        logger.debug('WebSocket: Skipping cache invalidation - acknowledge mutation pending', { erinnerungId: event.erinnerungId });
        // Skip cache invalidation but still show toast (nur bei Team-Events) and call callback for team sync
        if (showTeamToasts && !isOwnEvent) {
          toast.success('Erinnerung bestätigt', {
            description: 'Ein Teammitglied hat eine Erinnerung bestätigt',
          });
        }
        onAcknowledgedRef.current?.(event);
        return;
      }

      invalidateCache();

      // Issue 7 Fix: Toast nur bei Team-Events (nicht eigene Actions)
      if (showTeamToasts && !isOwnEvent) {
        toast.success('Erinnerung bestätigt', {
          description: 'Ein Teammitglied hat eine Erinnerung bestätigt',
        });
      }

      onAcknowledgedRef.current?.(event);
    },
    [invalidateCache, showTeamToasts, queryClient],
  );

  /**
   * Handler für 'erinnerung.assigned' Event (Story 3.4)
   *
   * Invalidiert Cache und zeigt Toast wenn eine Erinnerung
   * einem Teammitglied zugewiesen wurde.
   *
   * Issue 7 Fix: Toast nur bei Events von anderen Usern anzeigen (nicht bei eigenen Actions)
   *
   * Story 3.7 AC1: OS Notification bei Zuweisung an mich
   * Story 3.7 AC2: Toast mit 5 Sekunden Dauer
   */
  const handleAssigned = useCallback(
    (event: ErinnerungAssignedWebSocketEvent) => {
      logger.info('WebSocket: Erinnerung assigned', event);

      // Issue #2 Fix: Nutze Ref statt Closure für aktuelle userId
      const userId = currentUserIdRef.current;
      // Issue 7 Fix: Prüfe ob Event vom aktuellen User stammt
      const isOwnEvent = userId && event.assignedById === userId;
      const isAssignedToMe = userId && event.assignedToId === userId;

      // Story 3.7 AC2: Toast-Dauer 5 Sekunden
      const TOAST_DURATION_MS = 5000;

      /**
       * Story 3.7: Zeigt Notification + Toast bei Zuweisung an mich
       */
      const showAssignmentNotifications = async () => {
        // Issue #3: Keine Notification bei eigenen Assignment-Actions (inkl. Self-Assignment).
        // Self-Assignment: User weist sich selbst zu → isOwnEvent=true → kein Notify (gewollt)
        if (!showTeamToasts || isOwnEvent) return;

        try {
          if (isAssignedToMe) {
            // Story 3.7 AC1: OS Notification bei Zuweisung an mich
            await sendAssignmentNotification(event.titel ?? 'Neue Erinnerung', event.assignedByName, event.erinnerungId, event.einsatzId);

            // Issue #5: Check ob noch verbunden bevor Toast angezeigt wird (Cleanup-Safety)
            if (socketRef.current?.connected) {
              // Story 3.7 AC2: In-App Toast mit 5 Sekunden Dauer
              toast.info(`${event.assignedByName} hat dir eine Erinnerung zugewiesen`, {
                description: event.titel,
                duration: TOAST_DURATION_MS,
              });
            }
          } else if (socketRef.current?.connected) {
            // Issue #5: Check ob noch verbunden bevor Toast angezeigt wird (Cleanup-Safety)
            // Toast für Team-Mitglieder (andere Zuweisung)
            toast.info('Erinnerung zugewiesen', {
              description: `${event.assignedByName} hat eine Erinnerung an ${event.assignedToName} zugewiesen`,
              duration: TOAST_DURATION_MS,
            });
          }
        } catch (error) {
          logger.error('Failed to send assignment notification', error);
        }
      };

      // C7 Fix: Check if mutation is pending for this erinnerung
      const mutationCache = queryClient.getMutationCache();
      const pendingMutation = mutationCache.find({
        predicate: (mutation) => mutation.state.status === 'pending' && (mutation.options.mutationKey?.some((key) => typeof key === 'string' && key.includes(event.erinnerungId)) ?? false),
      });

      if (pendingMutation) {
        logger.debug('WebSocket: Skipping cache invalidation - assign mutation pending', { erinnerungId: event.erinnerungId });
        // Skip cache invalidation but still show notifications and call callback for team sync
        showAssignmentNotifications();
        onAssignedRef.current?.(event);
        return;
      }

      invalidateCache();
      showAssignmentNotifications();
      onAssignedRef.current?.(event);
    },
    [invalidateCache, showTeamToasts, queryClient],
  );

  /**
   * Handler für 'erinnerung.escalated' Event (Story 4.5)
   *
   * Zeigt Notification + Toast wenn eine Erinnerung eskaliert wird.
   */
  const handleEscalated = useCallback(
    (event: ErinnerungEscalatedWebSocketEvent) => {
      logger.info('WebSocket: Erinnerung escalated', event);

      // Issue #2 Fix: Nutze Ref statt Closure für aktuelle userId
      const userId = currentUserIdRef.current;
      const isEscalatedToMe = userId && event.eskalationsPersonId === userId;
      const isMyReminder = userId && event.erstelltVon === userId;

      // Story 3.7 AC2: Toast-Dauer 5 Sekunden (auch für Eskalation sinnvoll)
      const TOAST_DURATION_MS = 5000; // Urgent

      const showEscalationNotifications = async () => {
        if (!showTeamToasts) return;

        try {
          if (isEscalatedToMe) {
            // Eskalation an MICH -> WICHTIG!
            await sendAssignmentNotification(`ESKALATION: ${event.titel}`, 'System', event.erinnerungId, event.einsatzId);

            if (socketRef.current?.connected) {
              toast.error(`ESKALATION: ${event.titel}`, {
                description: 'Diese Erinnerung wurde an dich eskaliert!',
                duration: TOAST_DURATION_MS,
              });
            }
          } else if (isMyReminder && socketRef.current?.connected) {
            // Meine Erinnerung wurde eskaliert
            toast.warning(`Deine Erinnerung wurde eskaliert: ${event.titel}`, {
              description: 'Zeitüberschreitung - an Vorgesetzten eskaliert',
            });
          } else if (socketRef.current?.connected) {
            // Team Notification
            toast.warning(`Erinnerung eskaliert: ${event.titel}`, {
              description: 'Zeitüberschreitung',
            });
          }
        } catch (error) {
          logger.error('Failed to send escalation notification', error);
        }
      };

      invalidateCache();
      showEscalationNotifications();
      onEscalatedRef.current?.(event);
    },
    [invalidateCache, showTeamToasts],
  );

  /**
   * Verbindung herstellen
   */
  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      logger.debug('WebSocket: Already connected');
      return;
    }

    if (!enabled || !einsatzId) {
      logger.debug('WebSocket: Not connecting (disabled or no einsatzId)');
      return;
    }

    setStatus('connecting');
    logger.info('WebSocket: Connecting to', { url: WS_URL, namespace: WS_NAMESPACE, room: roomName });

    const socket = io(`${WS_URL}${WS_NAMESPACE}`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: RECONNECT_DELAY_MS,
      reconnectionDelayMax: RECONNECT_DELAY_MAX_MS,
      reconnectionAttempts: 10,
      withCredentials: true,
    });

    socket.on('connect', () => {
      // H5 Fix: Nutze currentEinsatzIdRef.current statt einsatzId aus Closure
      const currentEinsatzId = currentEinsatzIdRef.current;
      const currentRoomName = `einsatz:${currentEinsatzId}:erinnerungen`;

      logger.info('WebSocket: Connected, joining room', { room: currentRoomName });
      setStatus('connected');

      // Room beitreten mit aktueller einsatzId
      socket.emit('join', { einsatzId: currentEinsatzId });
    });

    socket.on('disconnect', (reason) => {
      logger.warn('WebSocket: Disconnected', { reason });
      setStatus('disconnected');
    });

    socket.on('connect_error', (error) => {
      logger.error('WebSocket: Connection error', error);
      setStatus('error');
    });

    // Erinnerungs-Events registrieren
    socket.on('erinnerung.triggered', handleTriggered);
    socket.on('erinnerung.created', handleCreated);
    socket.on('erinnerung.updated', handleUpdated);
    socket.on('erinnerung.deleted', handleDeleted);
    socket.on('erinnerung.acknowledged', handleAcknowledged);
    socket.on('erinnerung.assigned', handleAssigned);
    socket.on('erinnerung.escalated', handleEscalated);
    socket.on('erinnerung.intensified', (event) => {
      logger.info('WebSocket: Erinnerung intensified', event);
      invalidateCache();
    });

    socketRef.current = socket;
  }, [enabled, einsatzId, roomName, handleTriggered, handleCreated, handleUpdated, handleDeleted, handleAcknowledged, handleAssigned, handleEscalated, invalidateCache]);

  /**
   * Verbindung trennen
   */
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      logger.info('WebSocket: Disconnecting');
      socketRef.current.emit('leave', { einsatzId });
      socketRef.current.disconnect();
      socketRef.current = null;
      setStatus('disconnected');
    }
  }, [einsatzId]);

  // Auto-Connect beim Mount
  useEffect(() => {
    if (enabled && einsatzId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, einsatzId, connect, disconnect]);

  // C4 Fix: Room wechseln bei einsatzId-Änderung (leave old room first)
  useEffect(() => {
    if (socketRef.current?.connected && einsatzId) {
      // Leave old room if einsatzId changed
      if (previousEinsatzIdRef.current && previousEinsatzIdRef.current !== einsatzId) {
        logger.debug('WebSocket: Leaving old room', { oldEinsatzId: previousEinsatzIdRef.current });
        socketRef.current.emit('leave', { einsatzId: previousEinsatzIdRef.current });
      }

      // Join new room
      logger.debug('WebSocket: Switching room to', { room: roomName });
      socketRef.current.emit('join', { einsatzId });

      // Update ref
      previousEinsatzIdRef.current = einsatzId;
    }
  }, [einsatzId, roomName]);

  return {
    status,
    isConnected: status === 'connected',
    connect,
    disconnect,
  };
}
