import { randomInt, randomUUID } from 'node:crypto';
import { createGame } from '../shared/engine';
import type {
  GameState,
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

export interface RoomActionResult {
  snapshot: RoomSnapshot;
  sessionToken: string;
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

/** Administra salas online en memoria, sus jugadores y el ciclo inicial de partida. */
export class RoomManager {
  private readonly rooms = new Map<string, InternalRoom>();

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

    if (room.players.length === room.maxPlayers) {
      room.gameState = createGame({
        players: room.players.map((player) => ({
          id: player.id,
          name: player.name,
        })),
        targetScore: room.targetScore,
        dealerIndex: room.players.length - 1,
      });
      room.status = 'playing';
    }

    return {
      snapshot: this.buildSnapshot(room, newPlayer.id, newPlayer.sessionToken),
      sessionToken: newPlayer.sessionToken,
    };
  }

  /** Obtiene el snapshot actualizado de la sala personalizado para un jugador. */
  getRoomSnapshotForPlayer(code: string, playerId: string): RoomSnapshot {
    const normalizedCode = normalizeRoomCode(code);
    const room = this.getRoomOrThrow(normalizedCode);

    const playerExists = room.players.some((player) => player.id === playerId);
    if (!playerExists) {
      throw new Error(`El jugador no pertenece a la sala ${normalizedCode}.`);
    }

    return this.buildSnapshot(room, playerId);
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
