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
}: UseErinnerungWebSocketOptions): UseErinnerungWebSocketReturn {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<WebSocketStatus>('disconnected');

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
      invalidateCache();

      if (showTeamToasts && event.titel) {
        toast.warning(`Erinnerung "${event.titel}" wurde ausgelöst`, {
          description: 'Ein Teammitglied hat diese Erinnerung ausgelöst',
        });
      }

      onTriggered?.(event);
    },
    [invalidateCache, showTeamToasts, onTriggered],
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
      logger.info('WebSocket: Connected, joining room', { room: roomName });
      setStatus('connected');

      // Room beitreten
      socket.emit('join', { einsatzId });
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

    socketRef.current = socket;
  }, [enabled, einsatzId, roomName, handleTriggered, handleCreated, handleUpdated, handleDeleted]);

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

  // Room wechseln bei einsatzId-Änderung
  useEffect(() => {
    if (socketRef.current?.connected && einsatzId) {
      logger.debug('WebSocket: Switching room to', { room: roomName });
      socketRef.current.emit('join', { einsatzId });
    }
  }, [einsatzId, roomName]);

  return {
    status,
    isConnected: status === 'connected',
    connect,
    disconnect,
  };
}
