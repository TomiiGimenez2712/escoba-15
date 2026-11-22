import { randomInt, randomUUID } from 'node:crypto';
import { createGame, playCard, startNextRound } from '../shared/engine';
import type {
  GameState,
  PlayAction,
  PlayerGameView,
  PublicPlayer,
  RoomPlayerInfo,
  RoomSnapshot,
  RoomStatus,
  TargetScore,
} from '../shared/types';

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_CODE_LENGTH = 5;
const MAX_CODE_GENERATION_ATTEMPTS = 100;

export type ConnectionMap = Record<string, boolean> | ReadonlyMap<string, boolean>;

export interface CreateRoomInput {
  playerName: string;
  targetScore?: TargetScore;
  maxPlayers?: number;
}

export interface JoinRoomInput {
  code: string;
  playerName: string;
}

export interface PlayMoveInput {
  code: string;
  playerId: string;
  action: PlayAction;
}

export interface RoomPlayerActionInput {
  code: string;
  playerId: string;
}

export interface ReconnectRoomInput {
  code: string;
  sessionToken: string;
}

export interface RoomActionResult {
  snapshot: RoomSnapshot;
  sessionToken: string;
}

export interface SocketBinding {
  code: string;
  playerId: string;
}

export interface DetachSocketResult extends SocketBinding {
  becameDisconnected: boolean;
}

export interface SocketRecipient {
  socketId: string;
  playerId: string;
}

interface InternalRoomPlayer extends RoomPlayerInfo {
  sessionToken: string;
}

interface InternalRoom {
  code: string;
  status: RoomStatus;
  maxPlayers: number;
  targetScore: TargetScore;
  players: InternalRoomPlayer[];
  gameState: GameState | null;
  emptySince: number | null;
}

function isPlayerConnected(playerId: string, connectionMap?: ConnectionMap): boolean {
  if (!connectionMap) {
    return true;
  }
  if (connectionMap instanceof Map || typeof (connectionMap as ReadonlyMap<string, boolean>).get === 'function') {
    return (connectionMap as ReadonlyMap<string, boolean>).get(playerId) ?? true;
  }
  return (connectionMap as Record<string, boolean>)[playerId] ?? true;
}

function normalizePlayerName(playerName: string): string {
  const trimmed = typeof playerName === 'string' ? playerName.trim() : '';
  if (!trimmed) {
    throw new Error('El nombre del jugador es obligatorio.');
  }
  return trimmed;
}

function normalizeRoomCode(code: string): string {
  const normalized = typeof code === 'string' ? code.trim().toUpperCase() : '';
  if (!normalized) {
    throw new Error('El código de sala es obligatorio.');
  }
  return normalized;
}

function generateRandomCode(): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
    const index = randomInt(0, ROOM_CODE_ALPHABET.length);
    code += ROOM_CODE_ALPHABET[index];
  }
  return code;
}

/** Construye una vista del estado de partida filtrada para ocultar mazo y manos rivales. */
export function buildPlayerGameView(
  state: GameState,
  targetPlayerId: string,
  connectionMap?: ConnectionMap
): PlayerGameView {
  const { deck: _deck, players: sourcePlayers, ...restState } = state;

  const players: PublicPlayer[] = sourcePlayers.map((player) => ({
    id: player.id,
    name: player.name,
    isBot: player.isBot,
    handCount: player.hand.length,
    captured: [...player.captured],
    escobas: player.escobas,
    score: player.score,
    connected: isPlayerConnected(player.id, connectionMap),
    ...(player.teamId !== undefined ? { teamId: player.teamId } : {}),
    ...(player.id === targetPlayerId ? { hand: [...player.hand] } : {}),
  }));

  return {
    ...restState,
    table: [...state.table],
    players,
    deckCount: state.deck.length,
    localPlayerId: targetPlayerId,
  };
}

/** Administra salas online en memoria, sus jugadores y el ciclo completo de partida. */
export class RoomManager {
  private readonly rooms = new Map<string, InternalRoom>();
  private readonly socketBindings = new Map<string, SocketBinding>();

  /** Crea una sala en espera con código único y registra al jugador creador. */
  createRoom(input: CreateRoomInput): RoomActionResult {
    const name = normalizePlayerName(input.playerName);
    const targetScore = input.targetScore ?? 15;
    const maxPlayers = input.maxPlayers ?? 2;

    if (targetScore !== 15 && targetScore !== 21) {
      throw new Error('El puntaje objetivo debe ser 15 o 21.');
    }
    if (!Number.isInteger(maxPlayers) || maxPlayers < 2 || maxPlayers > 4) {
      throw new Error('La cantidad máxima de jugadores debe ser entre 2 y 4.');
    }

    const code = this.generateUniqueCode();
    const creator: InternalRoomPlayer = {
      id: randomUUID(),
      name,
      sessionToken: randomUUID(),
      connected: true,
    };

    const room: InternalRoom = {
      code,
      status: 'waiting',
      maxPlayers,
      targetScore,
      players: [creator],
      gameState: null,
      emptySince: null,
    };

    this.rooms.set(code, room);

    return {
      snapshot: this.buildSnapshot(room, creator.id, creator.sessionToken),
      sessionToken: creator.sessionToken,
    };
  }

  /** Une un jugador a una sala en espera e inicia la partida cuando se completa el cupo. */
  joinRoom(input: JoinRoomInput): RoomActionResult {
    const name = normalizePlayerName(input.playerName);
    const normalizedCode = normalizeRoomCode(input.code);
    const room = this.getRoomOrThrow(normalizedCode);

    if (room.status !== 'waiting') {
      throw new Error('La partida de esta sala ya comenzó.');
    }
    if (room.players.length >= room.maxPlayers) {
      throw new Error('La sala ya está completa.');
    }

    const newPlayer: InternalRoomPlayer = {
      id: randomUUID(),
      name,
      sessionToken: randomUUID(),
      connected: true,
    };

    room.players.push(newPlayer);
    room.emptySince = null;

    if (room.players.length === room.maxPlayers) {
      room.gameState = this.createInitialRoomGame(room);
      room.status = 'playing';
    }

    return {
      snapshot: this.buildSnapshot(room, newPlayer.id, newPlayer.sessionToken),
      sessionToken: newPlayer.sessionToken,
    };
  }

  /** Obtiene el snapshot actualizado de la sala personalizado para un jugador. */
  getRoomSnapshotForPlayer(code: string, playerId: string): RoomSnapshot {
    const { room } = this.getRoomAndPlayer(code, playerId);
    return this.buildSnapshot(room, playerId);
  }

  /** Ejecuta una jugada en una partida online activa validando sala, jugador, turno y reglas. */
  playMove(input: PlayMoveInput): RoomSnapshot {
    const { room, gameState } = this.getPlayingRoomAndPlayer(input.code, input.playerId);
    if (!input.action || typeof input.action !== 'object') {
      throw new Error('La jugada es obligatoria.');
    }

    room.gameState = playCard(gameState, input.playerId, input.action);
    return this.buildSnapshot(room, input.playerId);
  }

  /** Avanza a la siguiente ronda cuando la ronda actual alcanzó 'round_end'. */
  nextRound(input: RoomPlayerActionInput): RoomSnapshot {
    const { room, gameState } = this.getPlayingRoomAndPlayer(input.code, input.playerId);
    if (gameState.phase !== 'round_end') {
      throw new Error('Solo se puede avanzar a la siguiente ronda cuando finaliza la ronda actual.');
    }

    room.gameState = startNextRound(gameState);
    return this.buildSnapshot(room, input.playerId);
  }

  /** Reinicia la partida dentro de la misma sala al finalizar ('game_over'), conservando jugadores y tokens. */
  rematch(input: RoomPlayerActionInput): RoomSnapshot {
    const { room } = this.getRoomAndPlayer(input.code, input.playerId);
    if (room.gameState?.phase !== 'game_over') {
      throw new Error('Solo se puede pedir revancha cuando la partida ha terminado.');
    }

    room.gameState = this.createInitialRoomGame(room);
    room.status = 'playing';
    return this.buildSnapshot(room, input.playerId);
  }

  /** Restaura la sesión de un jugador mediante su código de sala y sessionToken. */
  reconnect(input: ReconnectRoomInput): RoomSnapshot {
    const normalizedCode = normalizeRoomCode(input.code);
    const token = typeof input.sessionToken === 'string' ? input.sessionToken.trim() : '';
    if (!token) {
      throw new Error('El token de sesión es obligatorio.');
    }

    const room = this.getRoomOrThrow(normalizedCode);
    const player = room.players.find((item) => item.sessionToken === token);
    if (!player) {
      throw new Error('La sesión no es válida para esta sala.');
    }

    player.connected = true;
    room.emptySince = null;
    return this.buildSnapshot(room, player.id, player.sessionToken);
  }

  /** Devuelve el código de sala y jugador asociados a un socket, o null si no está registrado. */
  getSocketBinding(socketId: string): SocketBinding | null {
    const binding = this.socketBindings.get(socketId);
    if (!binding) {
      return null;
    }
    return { code: binding.code, playerId: binding.playerId };
  }

  /** Asocia un socket conectado a un jugador dentro de una sala y marca su conexión como activa. */
  attachSocket(socketId: string, code: string, playerId: string): void {
    if (typeof socketId !== 'string' || !socketId.trim()) {
      throw new Error('El identificador del socket es obligatorio.');
    }

    const { room, player } = this.getRoomAndPlayer(code, playerId);

    if (this.socketBindings.has(socketId)) {
      this.detachSocket(socketId);
    }

    player.connected = true;
    room.emptySince = null;
    this.socketBindings.set(socketId, {
      code: room.code,
      playerId,
    });
  }

  /** Desasocia un socket, actualiza el estado de conexión del jugador y registra vaciamiento si corresponde. */
  detachSocket(socketId: string): DetachSocketResult | null {
    const binding = this.socketBindings.get(socketId);
    if (!binding) {
      return null;
    }

    this.socketBindings.delete(socketId);

    const hasOtherSocket = Array.from(this.socketBindings.values()).some(
      (entry) => entry.code === binding.code && entry.playerId === binding.playerId
    );

    let becameDisconnected = false;
    const room = this.rooms.get(binding.code);

    if (!hasOtherSocket) {
      const player = room?.players.find((item) => item.id === binding.playerId);
      if (player) {
        player.connected = false;
      }
      becameDisconnected = true;
    }

    if (room && room.players.every((player) => !player.connected)) {
      room.emptySince = Date.now();
    }

    return {
      code: binding.code,
      playerId: binding.playerId,
      becameDisconnected,
    };
  }

  /** Elimina las salas totalmente desconectadas cuyo tiempo de vaciamiento superó el TTL indicado. */
  cleanupExpiredRooms(ttlMs: number, now: number = Date.now()): string[] {
    const expiredCodes: string[] = [];

    for (const [code, room] of this.rooms.entries()) {
      const allDisconnected = room.players.every((player) => !player.connected);
      if (allDisconnected && room.emptySince !== null && now - room.emptySince >= ttlMs) {
        expiredCodes.push(code);
      }
    }

    for (const code of expiredCodes) {
      this.rooms.delete(code);
      for (const [socketId, binding] of this.socketBindings.entries()) {
        if (binding.code === code) {
          this.socketBindings.delete(socketId);
        }
      }
    }

    return expiredCodes;
  }

  /** Devuelve los sockets actualmente asociados a una sala junto con su playerId. */
  getSocketRecipients(code: string): SocketRecipient[] {
    const normalizedCode = normalizeRoomCode(code);
    this.getRoomOrThrow(normalizedCode);

    const recipients: SocketRecipient[] = [];
    for (const [socketId, binding] of this.socketBindings.entries()) {
      if (binding.code === normalizedCode) {
        recipients.push({ socketId, playerId: binding.playerId });
      }
    }
    return recipients;
  }

  private createInitialRoomGame(room: InternalRoom): GameState {
    return createGame({
      players: room.players.map((player) => ({
        id: player.id,
        name: player.name,
      })),
      targetScore: room.targetScore,
      dealerIndex: room.players.length - 1,
    });
  }

  private generateUniqueCode(): string {
    for (let attempt = 0; attempt < MAX_CODE_GENERATION_ATTEMPTS; attempt += 1) {
      const candidate = generateRandomCode();
      if (!this.rooms.has(candidate)) {
        return candidate;
      }
    }
    throw new Error('No se pudo generar un código de sala único.');
  }

  private getRoomOrThrow(code: string): InternalRoom {
    const room = this.rooms.get(code);
    if (!room) {
      throw new Error(`No existe ninguna sala con el código ${code}.`);
    }
    return room;
  }

  private getRoomAndPlayer(
    code: string,
    playerId: string
  ): { room: InternalRoom; player: InternalRoomPlayer } {
    const normalizedCode = normalizeRoomCode(code);
    const room = this.getRoomOrThrow(normalizedCode);
    const player = room.players.find((item) => item.id === playerId);
    if (!player) {
      throw new Error(`El jugador no pertenece a la sala ${normalizedCode}.`);
    }
    return { room, player };
  }

  private getPlayingRoomAndPlayer(
    code: string,
    playerId: string
  ): { room: InternalRoom; gameState: GameState } {
    const { room } = this.getRoomAndPlayer(code, playerId);
    if (room.status !== 'playing' || !room.gameState) {
      throw new Error(`La sala ${room.code} no tiene una partida en curso.`);
    }
    return { room, gameState: room.gameState };
  }

  private buildSnapshot(
    room: InternalRoom,
    playerId: string,
    sessionToken?: string
  ): RoomSnapshot {
    const connectionMap: Record<string, boolean> = {};
    const players: RoomPlayerInfo[] = room.players.map((player) => {
      connectionMap[player.id] = player.connected;
      return {
        id: player.id,
        name: player.name,
        connected: player.connected,
      };
    });

    const gameView = room.gameState
      ? buildPlayerGameView(room.gameState, playerId, connectionMap)
      : null;

    return {
      code: room.code,
      status: room.status,
      maxPlayers: room.maxPlayers,
      targetScore: room.targetScore,
      players,
      selfPlayerId: playerId,
      ...(sessionToken !== undefined ? { sessionToken } : {}),
      gameView,
    };
  }
}
