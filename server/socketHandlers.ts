import type { Server, Socket } from 'socket.io';
import type { PlayAction, RoomSnapshot } from '../shared/types';
import type {
  CreateRoomInput,
  JoinRoomInput,
  ReconnectRoomInput,
  RoomManager,
  SocketBinding,
} from './roomManager';

export type RoomAck =
  | { ok: true; snapshot: RoomSnapshot }
  | { ok: false; error: string };

interface GamePlayPayload {
  action?: PlayAction;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function resolveAck(
  payloadOrAck?: unknown,
  maybeAck?: (response: RoomAck) => void
): ((response: RoomAck) => void) | undefined {
  if (typeof payloadOrAck === 'function') {
    return payloadOrAck as (response: RoomAck) => void;
  }
  return typeof maybeAck === 'function' ? maybeAck : undefined;
}

function respondWithRoomError(
  socket: Socket,
  error: unknown,
  fallback: string,
  ack?: (response: RoomAck) => void
): void {
  const message = getErrorMessage(error, fallback);
  socket.emit('room:error', { message });
  if (typeof ack === 'function') {
    ack({ ok: false, error: message });
  }
}

function requireSocketBinding(roomManager: RoomManager, socketId: string): SocketBinding {
  const binding = roomManager.getSocketBinding(socketId);
  if (!binding) {
    throw new Error('No estás conectado a ninguna sala activa.');
  }
  return binding;
}

function broadcastRoomState(
  io: Server,
  roomManager: RoomManager,
  code: string,
  overrideBySocketId?: Map<string, RoomSnapshot>
): void {
  const recipients = roomManager.getSocketRecipients(code);
  for (const recipient of recipients) {
    const snapshot =
      overrideBySocketId?.get(recipient.socketId) ??
      roomManager.getRoomSnapshotForPlayer(code, recipient.playerId);
    io.to(recipient.socketId).emit('room:state', snapshot);
  }
}

function handleBoundRoomAction(
  io: Server,
  socket: Socket,
  roomManager: RoomManager,
  execute: (binding: SocketBinding) => RoomSnapshot,
  fallbackError: string,
  payloadOrAck?: unknown,
  maybeAck?: (response: RoomAck) => void
): void {
  const ack = resolveAck(payloadOrAck, maybeAck);
  try {
    const binding = requireSocketBinding(roomManager, socket.id);
    const snapshot = execute(binding);
    broadcastRoomState(io, roomManager, binding.code);
    ack?.({ ok: true, snapshot });
  } catch (error) {
    respondWithRoomError(socket, error, fallbackError, ack);
  }
}

/** Registra los eventos Socket.IO de sala, partida sincronizada y reconexión. */
export function registerSocketHandlers(io: Server, roomManager: RoomManager): void {
  io.on('connection', (socket) => {
    socket.on('room:create', (payload: CreateRoomInput, ack?: (response: RoomAck) => void) => {
      try {
        const input = payload && typeof payload === 'object' ? payload : ({} as CreateRoomInput);
        const result = roomManager.createRoom(input);
        roomManager.attachSocket(socket.id, result.snapshot.code, result.snapshot.selfPlayerId);

        socket.emit('room:state', result.snapshot);
        if (typeof ack === 'function') {
          ack({ ok: true, snapshot: result.snapshot });
        }
      } catch (error) {
        respondWithRoomError(socket, error, 'No se pudo crear la sala.', ack);
      }
    });

    socket.on('room:join', (payload: JoinRoomInput, ack?: (response: RoomAck) => void) => {
      try {
        const input = payload && typeof payload === 'object' ? payload : ({} as JoinRoomInput);
        const result = roomManager.joinRoom(input);
        roomManager.attachSocket(socket.id, result.snapshot.code, result.snapshot.selfPlayerId);

        broadcastRoomState(
          io,
          roomManager,
          result.snapshot.code,
          new Map([[socket.id, result.snapshot]])
        );

        if (typeof ack === 'function') {
          ack({ ok: true, snapshot: result.snapshot });
        }
      } catch (error) {
        respondWithRoomError(socket, error, 'No se pudo unir a la sala.', ack);
      }
    });

    socket.on(
      'room:reconnect',
      (payload: ReconnectRoomInput, ack?: (response: RoomAck) => void) => {
        const safeAck = typeof ack === 'function' ? ack : undefined;
        try {
          const input =
            payload && typeof payload === 'object' ? payload : ({} as ReconnectRoomInput);
          const snapshot = roomManager.reconnect(input);
          roomManager.attachSocket(socket.id, snapshot.code, snapshot.selfPlayerId);

          broadcastRoomState(
            io,
            roomManager,
            snapshot.code,
            new Map([[socket.id, snapshot]])
          );
          safeAck?.({ ok: true, snapshot });
        } catch (error) {
          respondWithRoomError(socket, error, 'No se pudo reconectar a la sala.', safeAck);
        }
      }
    );

    socket.on(
      'game:play',
      (payload: GamePlayPayload, ack?: (response: RoomAck) => void) => {
        const safeAck = typeof ack === 'function' ? ack : undefined;
        try {
          const binding = requireSocketBinding(roomManager, socket.id);
          const action = payload && typeof payload === 'object' ? payload.action : undefined;
          const snapshot = roomManager.playMove({
            code: binding.code,
            playerId: binding.playerId,
            action: action as PlayAction,
          });

          broadcastRoomState(io, roomManager, binding.code);
          safeAck?.({ ok: true, snapshot });
        } catch (error) {
          respondWithRoomError(socket, error, 'No se pudo realizar la jugada.', safeAck);
        }
      }
    );

    socket.on(
      'game:nextRound',
      (payloadOrAck?: unknown, maybeAck?: (response: RoomAck) => void) => {
        handleBoundRoomAction(
          io,
          socket,
          roomManager,
          (binding) => roomManager.nextRound(binding),
          'No se pudo avanzar a la siguiente ronda.',
          payloadOrAck,
          maybeAck
        );
      }
    );

    socket.on(
      'game:rematch',
      (payloadOrAck?: unknown, maybeAck?: (response: RoomAck) => void) => {
        handleBoundRoomAction(
          io,
          socket,
          roomManager,
          (binding) => roomManager.rematch(binding),
          'No se pudo iniciar la revancha.',
          payloadOrAck,
          maybeAck
        );
      }
    );

    socket.on('disconnect', () => {
      const detached = roomManager.detachSocket(socket.id);
      if (detached && detached.becameDisconnected) {
        try {
          broadcastRoomState(io, roomManager, detached.code);
        } catch {
          // La sala pudo haber expirado o no tener otros sockets activos.
        }
      }
    });
  });
}
