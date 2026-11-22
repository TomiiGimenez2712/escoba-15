export type Suit = 'oros' | 'copas' | 'espadas' | 'bastos';

export type CardNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 10 | 11 | 12;

export interface Card {
  id: string;
  suit: Suit;
  number: CardNumber;
  value: number;
}

export interface PlayerConfig {
  id: string;
  name: string;
  isBot?: boolean;
}

export interface Player {
  id: string;
  name: string;
  isBot: boolean;
  hand: Card[];
  captured: Card[];
  escobas: number;
  score: number;
  teamId?: 0 | 1;
}

export type TargetScore = 15 | 21;

export type BotDifficulty = 'facil' | 'medio' | 'dificil';

export interface CreateGameOptions {
  players: PlayerConfig[];
  targetScore?: TargetScore;
  dealerIndex?: number;
  deck?: Card[];
}

export type PlayAction =
  | {
      type: 'capture';
      cardId: string;
      tableCardIds: string[];
    }
  | {
      type: 'discard';
      cardId: string;
    };

export interface LastAction {
  playerId: string;
  playerName: string;
  type: PlayAction['type'];
  playedCard: Card;
  capturedCards: Card[];
  madeEscoba: boolean;
}

export type GamePhase = 'playing' | 'round_end' | 'game_over';

export interface ParticipantRoundScore {
  participantId: string;
  label: string;
  teamId?: 0 | 1;
  playerIds: string[];
  escobas: number;
  sieteDeOros: 0 | 1;
  sietes: 0 | 1;
  oros: 0 | 1;
  cartas: 0 | 1;
  roundTotal: number;
  totalScore: number;
  totalCardsCount: number;
  orosCount: number;
  sietesCount: number;
}

export interface RoundScoreSummary {
  round: number;
  leftoverCards: Card[];
  leftoverWinnerId: string | null;
  participants: ParticipantRoundScore[];
  isTiebreaker: boolean;
  winnerId: string | null;
  winnerTeamId: 0 | 1 | null;
}

export interface GameState {
  players: Player[];
  table: Card[];
  deck: Card[];
  dealerIndex: number;
  currentPlayerIndex: number;
  lastCapturerId: string | null;
  lastAction: LastAction | null;
  targetScore: TargetScore;
  round: number;
  escobaDeMano: 0 | 1 | 2;
  phase: GamePhase;
  roundSummary: RoundScoreSummary | null;
  winnerId: string | null;
  winnerTeamId: 0 | 1 | null;
  isTiebreaker: boolean;
}

export interface RoomPlayerInfo {
  id: string;
  name: string;
  connected: boolean;
}

export interface PublicPlayer extends Omit<Player, 'hand'> {
  hand?: Card[];
  handCount: number;
  connected: boolean;
}

export interface PlayerGameView extends Omit<GameState, 'players' | 'deck'> {
  players: PublicPlayer[];
  deckCount: number;
  localPlayerId: string;
}

export type RoomStatus = 'waiting' | 'playing';

export interface RoomSnapshot {
  code: string;
  status: RoomStatus;
  maxPlayers: number;
  targetScore: TargetScore;
  players: RoomPlayerInfo[];
  selfPlayerId: string;
  sessionToken?: string;
  gameView: PlayerGameView | null;
}
