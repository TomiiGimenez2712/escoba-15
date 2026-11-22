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

interface SavedOnlineSession {
  code: string;
  sessionToken: string;
  playerName: string;
}

function readSavedOnlineSession(): SavedOnlineSession | null {
  try {
    if (typeof sessionStorage === 'undefined') {
      return null;
    }
    const raw = sessionStorage.getItem(ONLINE_SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    const { code, sessionToken, playerName } = parsed as Record<string, unknown>;
    if (
      typeof code !== 'string' ||
      !code.trim() ||
      typeof sessionToken !== 'string' ||
      !sessionToken.trim()
    ) {
      return null;
    }
    return {
      code,
      sessionToken,
      playerName: typeof playerName === 'string' ? playerName : '',
    };
  } catch {
    return null;
  }
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
  const snapshotRef = useRef<RoomSnapshot | null>(null);
  const reconnectingRef = useRef(false);
  const disconnectSocketRef = useRef<() => void>(() => {});

  const updateSnapshot = useCallback((nextSnapshot: RoomSnapshot | null) => {
    snapshotRef.current = nextSnapshot;
    setSnapshot(nextSnapshot);
  }, []);

  const handleRoomState = useCallback(
    (nextSnapshot: RoomSnapshot) => {
      reconnectingRef.current = false;
      persistOnlineSession(nextSnapshot);
      updateSnapshot(nextSnapshot);
      setError(null);
      setLoading(false);
    },
    [updateSnapshot]
  );

  const handleRoomError = useCallback(
    (payload: unknown) => {
      if (reconnectingRef.current && snapshotRef.current === null) {
        reconnectingRef.current = false;
        clearOnlineSession();
        disconnectSocketRef.current();
        updateSnapshot(null);
      }
      setError(extractRoomErrorMessage(payload));
      setLoading(false);
    },
    [updateSnapshot]
  );

  const handleConnectError = useCallback(() => {
    reconnectingRef.current = false;
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

  disconnectSocketRef.current = disconnectSocket;

  useEffect(() => {
    return () => {
      reconnectingRef.current = false;
      disconnectSocket();
    };
  }, [disconnectSocket]);

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

  const handleAck = useCallback(
    (ack?: RoomAck) => {
      if (!ack) {
        return;
      }
      setLoading(false);
      if (ack.ok) {
        persistOnlineSession(ack.snapshot);
        updateSnapshot(ack.snapshot);
        setError(null);
      } else if (ack.error) {
        setError(ack.error);
      }
    },
    [updateSnapshot]
  );

  useEffect(() => {
    const savedSession = readSavedOnlineSession();
    if (!savedSession) {
      return;
    }

    const salaParam =
      typeof window !== 'undefined'
        ? (new URLSearchParams(window.location.search).get('sala')?.trim().toUpperCase() ?? '')
        : '';
    if (salaParam && salaParam !== savedSession.code.trim().toUpperCase()) {
      return;
    }

    reconnectingRef.current = true;
    const socket = ensureSocket();
    setLoading(true);
    socket.emit(
      'room:reconnect',
      { code: savedSession.code, sessionToken: savedSession.sessionToken },
      (ack?: RoomAck) => {
        if (socketRef.current !== socket) {
          return;
        }
        reconnectingRef.current = false;
        if (ack?.ok) {
          handleAck(ack);
          return;
        }
        if (ack && !ack.ok) {
          clearOnlineSession();
          disconnectSocket();
          updateSnapshot(null);
          setError(ack.error || 'No se pudo reconectar a la sala.');
          setLoading(false);
        }
      }
    );
  }, [disconnectSocket, ensureSocket, handleAck, updateSnapshot]);

  const connectAndCreate = useCallback(
    ({ playerName, targetScore }: CreateOnlineRoomInput) => {
      const trimmedName = playerName.trim();
      if (!trimmedName) {
        setError('Ingresá tu nombre para crear una sala.');
        return;
      }

      reconnectingRef.current = false;
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

      reconnectingRef.current = false;
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
    reconnectingRef.current = false;
    clearOnlineSession();
    disconnectSocket();
    updateSnapshot(null);
    setError(null);
    setLoading(false);
  }, [disconnectSocket, updateSnapshot]);

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
