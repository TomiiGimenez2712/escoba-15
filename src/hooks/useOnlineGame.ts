import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { RoomSnapshot, TargetScore } from '../../shared/types';

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
  leaveRoom: () => void;
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

  const leaveRoom = useCallback(() => {
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
    leaveRoom,
  };
}
