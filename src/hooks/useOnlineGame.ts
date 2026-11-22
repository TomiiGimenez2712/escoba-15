import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { PlayAction, RoomSnapshot, TargetScore } from '../../shared/types';

export const ONLINE_SESSION_STORAGE_KEY = 'escoba15_online_session';

export interface CreateOnlineRoomInput {
  playerName: string;
  targetScore: TargetScore;
}

export interface JoinOnlineRoomInput {
  code: string;
  playerName: string;
}

type RoomAck =
  | { ok: true; snapshot: RoomSnapshot }
  | { ok: false; error: string };

export interface UseOnlineGameResult {
  snapshot: RoomSnapshot | null;
  error: string | null;
  loading: boolean;
  connectAndCreate: (input: CreateOnlineRoomInput) => void;
  connectAndJoin: (input: JoinOnlineRoomInput) => void;
  playOnlineAction: (action: PlayAction) => void;
  requestNextRound: () => void;
  requestRematch: () => void;
  leaveRoom: () => void;
}

function persistOnlineSession(snapshot: RoomSnapshot): void {
  if (!snapshot.sessionToken) {
    return;
  }
  try {
    if (typeof sessionStorage === 'undefined') {
      return;
    }
    const playerName =
      snapshot.players.find((player) => player.id === snapshot.selfPlayerId)?.name ?? '';
    sessionStorage.setItem(
      ONLINE_SESSION_STORAGE_KEY,
      JSON.stringify({
        code: snapshot.code,
        sessionToken: snapshot.sessionToken,
        playerName,
      })
    );
  } catch {
    // Ignorar errores de acceso a sessionStorage (ej. modo privado o cuota).
  }
}

function clearOnlineSession(): void {
  try {
    if (typeof sessionStorage === 'undefined') {
      return;
    }
    sessionStorage.removeItem(ONLINE_SESSION_STORAGE_KEY);
  } catch {
    // Ignorar errores de acceso a sessionStorage.
  }
}

function extractRoomErrorMessage(payload: unknown): string {
  if (typeof payload === 'string' && payload.trim()) {
    return payload;
  }
  if (
    payload &&
    typeof payload === 'object' &&
    'message' in payload &&
    typeof (payload as { message?: unknown }).message === 'string' &&
    (payload as { message: string }).message.trim()
  ) {
    return (payload as { message: string }).message;
  }
  return 'Ocurrió un error al procesar la sala.';
}

/** Gestiona la conexión Socket.IO bajo demanda y el estado del lobby/sala online. */
export function useOnlineGame(): UseOnlineGameResult {
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const handleRoomState = useCallback((nextSnapshot: RoomSnapshot) => {
    persistOnlineSession(nextSnapshot);
    setSnapshot(nextSnapshot);
    setError(null);
    setLoading(false);
  }, []);

  const handleRoomError = useCallback((payload: unknown) => {
    setError(extractRoomErrorMessage(payload));
    setLoading(false);
  }, []);

  const handleConnectError = useCallback(() => {
    setError('No se pudo conectar con el servidor.');
    setLoading(false);
  }, []);

  const disconnectSocket = useCallback(() => {
    const socket = socketRef.current;
    if (!socket) {
      return;
    }
    socket.off('room:state', handleRoomState);
    socket.off('room:error', handleRoomError);
    socket.off('connect_error', handleConnectError);
    socket.disconnect();
    socketRef.current = null;
  }, [handleConnectError, handleRoomError, handleRoomState]);

  useEffect(() => disconnectSocket, [disconnectSocket]);

  const ensureSocket = useCallback((): Socket => {
    const existing = socketRef.current;
    if (existing && !existing.disconnected) {
      return existing;
    }
    if (existing) {
      disconnectSocket();
    }

    const socket = io();
    socket.on('room:state', handleRoomState);
    socket.on('room:error', handleRoomError);
    socket.on('connect_error', handleConnectError);
    socketRef.current = socket;
    return socket;
  }, [disconnectSocket, handleConnectError, handleRoomError, handleRoomState]);

  const handleAck = useCallback((ack?: RoomAck) => {
    if (!ack) {
      return;
    }
    setLoading(false);
    if (ack.ok) {
      persistOnlineSession(ack.snapshot);
      setSnapshot(ack.snapshot);
      setError(null);
    } else if (ack.error) {
      setError(ack.error);
    }
  }, []);

  const connectAndCreate = useCallback(
    ({ playerName, targetScore }: CreateOnlineRoomInput) => {
      const trimmedName = playerName.trim();
      if (!trimmedName) {
        setError('Ingresá tu nombre para crear una sala.');
        return;
      }

      setError(null);
      setLoading(true);
      const socket = ensureSocket();
      socket.emit('room:create', { playerName: trimmedName, targetScore }, (ack?: RoomAck) => {
        handleAck(ack);
      });
    },
    [ensureSocket, handleAck]
  );

  const connectAndJoin = useCallback(
    ({ code, playerName }: JoinOnlineRoomInput) => {
      const trimmedName = playerName.trim();
      if (!trimmedName) {
        setError('Ingresá tu nombre para unirte a una sala.');
        return;
      }

      const normalizedCode = code.trim().toUpperCase();
      if (!normalizedCode) {
        setError('Ingresá el código de la sala.');
        return;
      }

      setError(null);
      setLoading(true);
      const socket = ensureSocket();
      socket.emit(
        'room:join',
        { code: normalizedCode, playerName: trimmedName },
        (ack?: RoomAck) => {
          handleAck(ack);
        }
      );
    },
    [ensureSocket, handleAck]
  );

  const emitRoomGameEvent = useCallback(
    (event: 'game:play' | 'game:nextRound' | 'game:rematch', payload: unknown) => {
      const socket = socketRef.current;
      if (!socket) {
        return;
      }
      socket.emit(event, payload, (ack?: RoomAck) => {
        handleAck(ack);
      });
    },
    [handleAck]
  );

  const playOnlineAction = useCallback(
    (action: PlayAction) => {
      emitRoomGameEvent('game:play', { action });
    },
    [emitRoomGameEvent]
  );

  const requestNextRound = useCallback(() => {
    emitRoomGameEvent('game:nextRound', {});
  }, [emitRoomGameEvent]);

  const requestRematch = useCallback(() => {
    emitRoomGameEvent('game:rematch', {});
  }, [emitRoomGameEvent]);

  const leaveRoom = useCallback(() => {
    clearOnlineSession();
    disconnectSocket();
    setSnapshot(null);
    setError(null);
    setLoading(false);
  }, [disconnectSocket]);

  return {
    snapshot,
    error,
    loading,
    connectAndCreate,
    connectAndJoin,
    playOnlineAction,
    requestNextRound,
    requestRematch,
    leaveRoom,
  };
}
