import type { Server, Socket } from 'socket.io';
import type { RoomSnapshot } from '../shared/types';
import type { CreateRoomInput, JoinRoomInput, RoomManager } from './roomManager';

export type RoomAck =
  | { ok: true; snapshot: RoomSnapshot }
  | { ok: false; error: string };

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
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

/** Registra los eventos Socket.IO de creación, unión y desconexión de salas. */
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

        const recipients = roomManager.getSocketRecipients(result.snapshot.code);
        for (const recipient of recipients) {
          if (recipient.socketId === socket.id) {
            socket.emit('room:state', result.snapshot);
          } else {
            const snapshot = roomManager.getRoomSnapshotForPlayer(
              result.snapshot.code,
              recipient.playerId
            );
            io.to(recipient.socketId).emit('room:state', snapshot);
          }
        }

        if (typeof ack === 'function') {
          ack({ ok: true, snapshot: result.snapshot });
        }
      } catch (error) {
        respondWithRoomError(socket, error, 'No se pudo unir a la sala.', ack);
      }
    });

    socket.on('disconnect', () => {
      roomManager.detachSocket(socket.id);
    });
  });
}
