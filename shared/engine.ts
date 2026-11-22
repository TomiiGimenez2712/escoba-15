import { createDeck, getCardValue, shuffleDeck } from './deck';
import type { Card, CreateGameOptions, GameState, Player, Suit, TargetScore } from './types';

const VALID_SUITS = new Set<Suit>(['oros', 'copas', 'espadas', 'bastos']);
const CARDS_PER_HAND = 3;
const TABLE_CARD_COUNT = 4;
const DECK_SIZE = 40;
const ESCOBA_SUM = 15;

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

  const tableSum = initialTable.reduce((sum, card) => sum + card.value, 0);
  const escobaDeMano: GameState['escobaDeMano'] = tableSum === ESCOBA_SUM ? 1 : 0;

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
    targetScore,
    round: 1,
    escobaDeMano,
  };
}
