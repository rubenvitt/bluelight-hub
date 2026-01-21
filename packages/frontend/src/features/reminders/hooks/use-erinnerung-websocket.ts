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

import { logger } from '@/shared/lib/logger';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { ERINNERUNG_QUERY_KEYS } from '../api/queries';

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
}: UseErinnerungWebSocketOptions): UseErinnerungWebSocketReturn {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<WebSocketStatus>('disconnected');

  // H5 Fix: Ref für aktuelle einsatzId um stale Closures im connect Handler zu vermeiden
  const currentEinsatzIdRef = useRef(einsatzId);
  currentEinsatzIdRef.current = einsatzId;

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
   */
  const handleTriggered = useCallback(
    (event: ErinnerungWebSocketEvent) => {
      logger.info('WebSocket: Erinnerung triggered', event);

      // C7 Fix: Check if mutation is pending for this erinnerung
      const mutationCache = queryClient.getMutationCache();
      const pendingMutation = mutationCache.find({
        predicate: (mutation) => mutation.state.status === 'pending' && mutation.options.mutationKey?.some((key) => typeof key === 'string' && key.includes(event.erinnerungId)),
      });

      if (pendingMutation) {
        logger.debug('WebSocket: Skipping cache invalidation - mutation pending', { erinnerungId: event.erinnerungId });
        // Skip cache invalidation but still show toast and call callback
        if (showTeamToasts && event.titel) {
          toast.warning(`Erinnerung "${event.titel}" wurde ausgelöst`, {
            description: 'Ein Teammitglied hat diese Erinnerung ausgelöst',
          });
        }
        onTriggered?.(event);
        return;
      }

      invalidateCache();

      if (showTeamToasts && event.titel) {
        toast.warning(`Erinnerung "${event.titel}" wurde ausgelöst`, {
          description: 'Ein Teammitglied hat diese Erinnerung ausgelöst',
        });
      }

      onTriggered?.(event);
    },
    [invalidateCache, showTeamToasts, onTriggered, queryClient],
  );

  /**
   * Handler für 'erinnerung.created' Event
   */
  const handleCreated = useCallback(
    (event: ErinnerungWebSocketEvent) => {
      logger.info('WebSocket: Erinnerung created', event);
      invalidateCache();

      if (showTeamToasts && event.titel) {
        toast.success(`Neue Erinnerung: "${event.titel}"`, {
          description: 'Ein Teammitglied hat eine Erinnerung erstellt',
        });
      }

      onCreated?.(event);
    },
    [invalidateCache, showTeamToasts, onCreated],
  );

  /**
   * Handler für 'erinnerung.updated' Event
   */
  const handleUpdated = useCallback(
    (event: ErinnerungWebSocketEvent) => {
      logger.info('WebSocket: Erinnerung updated', event);
      invalidateCache();

      onUpdated?.(event);
    },
    [invalidateCache, onUpdated],
  );

  /**
   * Handler für 'erinnerung.deleted' Event
   */
  const handleDeleted = useCallback(
    (event: ErinnerungWebSocketEvent) => {
      logger.info('WebSocket: Erinnerung deleted', event);
      invalidateCache();

      if (showTeamToasts && event.titel) {
        toast.info(`Erinnerung "${event.titel}" gelöscht`, {
          description: 'Ein Teammitglied hat diese Erinnerung gelöscht',
        });
      }

      onDeleted?.(event);
    },
    [invalidateCache, showTeamToasts, onDeleted],
  );

  /**
   * Handler für 'erinnerung.acknowledged' Event (Story 1.6 AC2)
   *
   * C7 Fix: Prüft ob eine lokale Mutation pending ist, um Race Conditions
   * zwischen eigenem Acknowledge und WebSocket-Event zu vermeiden.
   */
  const handleAcknowledged = useCallback(
    (event: ErinnerungWebSocketEvent) => {
      logger.info('WebSocket: Erinnerung acknowledged', event);

      // C7 Fix: Check if mutation is pending for this erinnerung
      const mutationCache = queryClient.getMutationCache();
      const pendingMutation = mutationCache.find({
        predicate: (mutation) => mutation.state.status === 'pending' && mutation.options.mutationKey?.some((key) => typeof key === 'string' && key.includes(event.erinnerungId)),
      });

      if (pendingMutation) {
        logger.debug('WebSocket: Skipping cache invalidation - acknowledge mutation pending', { erinnerungId: event.erinnerungId });
        // Skip cache invalidation but still show toast and call callback for team sync
        if (showTeamToasts) {
          toast.success('Erinnerung bestätigt', {
            description: 'Ein Teammitglied hat eine Erinnerung bestätigt',
          });
        }
        onAcknowledged?.(event);
        return;
      }

      invalidateCache();

      if (showTeamToasts) {
        toast.success('Erinnerung bestätigt', {
          description: 'Ein Teammitglied hat eine Erinnerung bestätigt',
        });
      }

      onAcknowledged?.(event);
    },
    [invalidateCache, showTeamToasts, onAcknowledged, queryClient],
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

    socketRef.current = socket;
  }, [enabled, einsatzId, roomName, handleTriggered, handleCreated, handleUpdated, handleDeleted, handleAcknowledged]);

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
