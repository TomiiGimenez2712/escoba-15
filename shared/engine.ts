import { createDeck, getCardValue, shuffleDeck } from './deck';
import { scoreRound } from './scoring';
import type {
  Card,
  CreateGameOptions,
  GameState,
  LastAction,
  PlayAction,
  Player,
  Suit,
  TargetScore,
} from './types';

const VALID_SUITS = new Set<Suit>(['oros', 'copas', 'espadas', 'bastos']);
const CARDS_PER_HAND = 3;
const TABLE_CARD_COUNT = 4;
const DECK_SIZE = 40;
const ESCOBA_SUM = 15;
const DOUBLE_ESCOBA_SUM = 30;

/** Determina si 4 cartas que suman 30 admiten una partición en dos grupos de suma 15. */
function canPartitionIntoTwo15s(cards: readonly Card[]): boolean {
  if (cards.length !== TABLE_CARD_COUNT) {
    return false;
  }
  const [first, ...rest] = cards;
  // Con valores de baraja española (1..10), ninguna carta alcanza 15 por sí sola,
  // por lo que toda partición válida en suma 30 es de 2+2 y una incluye a `first`.
  return rest.some((card) => first.value + card.value === ESCOBA_SUM);
}

/** Calcula cuántas escobas de mano (0, 1 o 2) se forman con las cartas iniciales de la mesa. */
function detectEscobaDeMano(tableCards: readonly Card[]): GameState['escobaDeMano'] {
  const sum = tableCards.reduce((acc, card) => acc + card.value, 0);
  if (sum === ESCOBA_SUM) {
    return 1;
  }
  if (sum === DOUBLE_ESCOBA_SUM && canPartitionIntoTwo15s(tableCards)) {
    return 2;
  }
  return 0;
}

/** Valida que el mazo contenga exactamente 40 cartas únicas de baraja española. */
function validateDeck(deck: readonly Card[]): void {
  if (deck.length !== DECK_SIZE) {
    throw new Error(`Invalid deck length: expected ${DECK_SIZE} cards, got ${deck.length}`);
  }

  const seenIds = new Set<string>();
  for (const card of deck) {
    if (!card || !VALID_SUITS.has(card.suit)) {
      throw new Error(`Invalid card suit: ${String(card?.suit)}`);
    }
    const expectedValue = getCardValue(card.number);
    if (card.value !== expectedValue || card.id !== `${card.suit}-${card.number}`) {
      throw new Error(`Invalid card data for ${card.id}`);
    }
    if (seenIds.has(card.id)) {
      throw new Error(`Duplicate card in deck: ${card.id}`);
    }
    seenIds.add(card.id);
  }
}

/** Valida opciones iniciales y resuelve valores por defecto para una nueva partida. */
function resolveOptions(options: CreateGameOptions): {
  dealerIndex: number;
  targetScore: TargetScore;
} {
  const playerCount = options.players.length;
  if (playerCount < 2 || playerCount > 4) {
    throw new Error(`Invalid player count: expected 2 to 4 players, got ${playerCount}`);
  }

  const dealerIndex = options.dealerIndex ?? 0;
  if (!Number.isInteger(dealerIndex) || dealerIndex < 0 || dealerIndex >= playerCount) {
    throw new Error(`Invalid dealerIndex: ${dealerIndex}`);
  }

  const targetScore = options.targetScore ?? 15;
  if (targetScore !== 15 && targetScore !== 21) {
    throw new Error(`Invalid targetScore: ${String(targetScore)}`);
  }

  if (options.deck !== undefined) {
    validateDeck(options.deck);
  }

  return { dealerIndex, targetScore };
}

/** Crea el estado inicial de una partida repartiendo 3 cartas por jugador y 4 a la mesa. */
export function createGame(options: CreateGameOptions): GameState {
  const { dealerIndex, targetScore } = resolveOptions(options);
  const sourceDeck = options.deck ? [...options.deck] : shuffleDeck(createDeck());
  const isTeamGame = options.players.length === 4;

  const players: Player[] = options.players.map((config, index) => {
    const start = index * CARDS_PER_HAND;
    return {
      id: config.id,
      name: config.name,
      isBot: config.isBot ?? false,
      hand: sourceDeck.slice(start, start + CARDS_PER_HAND),
      captured: [],
      escobas: 0,
      score: 0,
      ...(isTeamGame ? { teamId: (index % 2) as 0 | 1 } : {}),
    };
  });

  const tableStart = options.players.length * CARDS_PER_HAND;
  const initialTable = sourceDeck.slice(tableStart, tableStart + TABLE_CARD_COUNT);
  const deck = sourceDeck.slice(tableStart + TABLE_CARD_COUNT);

  const escobaDeMano = detectEscobaDeMano(initialTable);

  if (escobaDeMano > 0) {
    const dealer = players[dealerIndex];
    dealer.captured = initialTable;
    dealer.escobas = escobaDeMano;
  }

  return {
    players,
    table: escobaDeMano > 0 ? [] : initialTable,
    deck,
    dealerIndex,
    currentPlayerIndex: (dealerIndex + 1) % players.length,
    lastCapturerId: escobaDeMano > 0 ? players[dealerIndex].id : null,
    lastAction: null,
    targetScore,
    round: 1,
    escobaDeMano,
    phase: 'playing',
    roundSummary: null,
    winnerId: null,
    winnerTeamId: null,
    isTiebreaker: false,
  };
}

/** Devuelve todos los subconjuntos no vacíos de la mesa que suman 15 junto con `handCard`. */
export function findCaptureCombinations(handCard: Card, tableCards: readonly Card[]): Card[][] {
  const target = ESCOBA_SUM - handCard.value;
  if (target <= 0 || tableCards.length === 0) {
    return [];
  }

  const combinations: Card[][] = [];
  const current: Card[] = [];

  function backtrack(startIndex: number, currentSum: number): void {
    if (currentSum === target) {
      combinations.push([...current]);
      return;
    }

    for (let i = startIndex; i < tableCards.length; i += 1) {
      const card = tableCards[i];
      const nextSum = currentSum + card.value;
      if (nextSum > target) {
        continue;
      }
      current.push(card);
      backtrack(i + 1, nextSum);
      current.pop();
    }
  }

  backtrack(0, 0);
  return combinations;
}

/** Valida una captura contra la mesa y devuelve las cartas capturadas sin mutar la entrada. */
function resolveCapturedCards(
  table: readonly Card[],
  playedCard: Card,
  tableCardIds: readonly string[],
): Card[] {
  if (tableCardIds.length === 0) {
    throw new Error('Capture requires at least one table card');
  }

  const seenIds = new Set<string>();
  for (const id of tableCardIds) {
    if (seenIds.has(id)) {
      throw new Error(`Duplicate table card ID in capture: ${id}`);
    }
    seenIds.add(id);
  }

  const tableIds = new Set(table.map((card) => card.id));
  for (const id of tableCardIds) {
    if (!tableIds.has(id)) {
      throw new Error(`Table card ${id} is not on the table`);
    }
  }

  const capturedCards = table.filter((card) => seenIds.has(card.id));
  const totalSum = capturedCards.reduce((sum, card) => sum + card.value, playedCard.value);
  if (totalSum !== ESCOBA_SUM) {
    throw new Error(`Invalid capture sum: expected ${ESCOBA_SUM}, got ${totalSum}`);
  }

  return capturedCards;
}

/** Reparte 3 nuevas cartas por jugador desde el mazo sin modificar la mesa. */
function dealNextHands(state: GameState): GameState {
  const players = state.players.map((player, index) => {
    const start = index * CARDS_PER_HAND;
    return {
      ...player,
      hand: state.deck.slice(start, start + CARDS_PER_HAND),
    };
  });

  return {
    ...state,
    players,
    deck: state.deck.slice(state.players.length * CARDS_PER_HAND),
    phase: 'playing',
    roundSummary: null,
  };
}

/** Asigna cartas sobrantes sin sumar escoba y cierra la ronda calculando el puntaje oficial. */
function finishRound(state: GameState): GameState {
  const hasLeftovers = state.table.length > 0 && state.lastCapturerId !== null;
  const leftoverCards = hasLeftovers ? [...state.table] : [];
  const leftoverWinnerId = hasLeftovers ? state.lastCapturerId : null;

  const playersWithLeftovers = hasLeftovers
    ? state.players.map((player) =>
        player.id === leftoverWinnerId
          ? { ...player, captured: [...player.captured, ...leftoverCards] }
          : player,
      )
    : state.players;

  const roundResult = scoreRound({
    players: playersWithLeftovers,
    round: state.round,
    targetScore: state.targetScore,
    leftoverCards,
    leftoverWinnerId,
  });

  return {
    ...state,
    players: roundResult.players,
    table: [],
    phase: roundResult.phase,
    roundSummary: roundResult.summary,
    winnerId: roundResult.winnerId,
    winnerTeamId: roundResult.winnerTeamId,
    isTiebreaker: roundResult.isTiebreaker,
  };
}

/** Ejecuta una jugada (`capture` o `discard`) del jugador actual y retorna el nuevo estado. */
export function playCard(state: GameState, playerId: string, action: PlayAction): GameState {
  if (state.phase !== 'playing') {
    throw new Error(`Cannot play card when game phase is '${state.phase}'`);
  }

  const playerIndex = state.currentPlayerIndex;
  const player = state.players[playerIndex];
  if (!player || player.id !== playerId) {
    throw new Error(`It is not player ${playerId}'s turn`);
  }

  const playedCard = player.hand.find((card) => card.id === action.cardId);
  if (!playedCard) {
    throw new Error(`Card ${action.cardId} is not in player ${playerId}'s hand`);
  }

  let capturedCards: Card[] = [];
  let nextTable: Card[];
  let madeEscoba = false;
  let nextLastCapturerId = state.lastCapturerId;

  if (action.type === 'capture') {
    capturedCards = resolveCapturedCards(state.table, playedCard, action.tableCardIds);
    const capturedIdSet = new Set(action.tableCardIds);
    nextTable = state.table.filter((card) => !capturedIdSet.has(card.id));
    madeEscoba = nextTable.length === 0;
    nextLastCapturerId = player.id;
  } else {
    nextTable = [...state.table, playedCard];
  }

  const updatedPlayer: Player = {
    ...player,
    hand: player.hand.filter((card) => card.id !== action.cardId),
    captured:
      action.type === 'capture'
        ? [...player.captured, playedCard, ...capturedCards]
        : player.captured,
    escobas: player.escobas + (madeEscoba ? 1 : 0),
  };

  const lastAction: LastAction = {
    playerId: player.id,
    playerName: player.name,
    type: action.type,
    playedCard,
    capturedCards,
    madeEscoba,
  };

  const nextPlayers = state.players.map((p, index) => (index === playerIndex ? updatedPlayer : p));
  const nextState: GameState = {
    ...state,
    players: nextPlayers,
    table: nextTable,
    currentPlayerIndex: (playerIndex + 1) % state.players.length,
    lastCapturerId: nextLastCapturerId,
    lastAction,
  };

  if (nextPlayers.some((p) => p.hand.length > 0)) {
    return nextState;
  }

  if (state.deck.length > 0) {
    return dealNextHands(nextState);
  }

  return finishRound(nextState);
}
