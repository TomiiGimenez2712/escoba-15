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
}
