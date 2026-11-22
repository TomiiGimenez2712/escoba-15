import { findCaptureCombinations } from './engine';
import type { BotDifficulty, Card, GameState, PlayAction, Player } from './types';

const VALID_DIFFICULTIES = new Set<BotDifficulty>(['facil', 'medio', 'dificil']);
const FACIL_DISCARD_PROBABILITY = 0.35;
const VULNERABLE_MIN_SUM = 5;
const VULNERABLE_MAX_SUM = 14;

interface CaptureCandidate {
  action: Extract<PlayAction, { type: 'capture' }>;
  playedCard: Card;
  tableCards: Card[];
  isEscoba: boolean;
}

interface CaptureScore {
  isEscoba: number;
  hasSieteDeOros: number;
  sietesCount: number;
  orosCount: number;
  totalCardsCount: number;
}

/** Valida precondiciones del turno, mano y dificultad sin mutar `state`. */
function validateAiContext(
  state: GameState,
  playerId: string,
  difficulty: BotDifficulty,
): Player {
  if (state.phase !== 'playing') {
    throw new Error(`Cannot choose AI move when game phase is '${state.phase}'`);
  }

  const currentPlayer = state.players[state.currentPlayerIndex];
  if (!currentPlayer || currentPlayer.id !== playerId) {
    throw new Error(`It is not player ${playerId}'s turn`);
  }

  if (currentPlayer.hand.length === 0) {
    throw new Error(`Player ${playerId} has no cards in hand`);
  }

  if (!VALID_DIFFICULTIES.has(difficulty)) {
    throw new Error(`Invalid bot difficulty: ${String(difficulty)}`);
  }

  return currentPlayer;
}

/** Genera todas las capturas legales posibles desde la mano contra la mesa actual. */
function collectCaptureCandidates(
  hand: readonly Card[],
  table: readonly Card[],
): CaptureCandidate[] {
  const candidates: CaptureCandidate[] = [];

  for (const playedCard of hand) {
    const combinations = findCaptureCombinations(playedCard, table);
    for (const tableCards of combinations) {
      candidates.push({
        action: {
          type: 'capture',
          cardId: playedCard.id,
          tableCardIds: tableCards.map((card) => card.id),
        },
        playedCard,
        tableCards,
        isEscoba: tableCards.length === table.length,
      });
    }
  }

  return candidates;
}

/** Selecciona un elemento de una lista no vacía usando el generador `rng`. */
function pickRandomItem<T>(items: readonly T[], rng: () => number): T {
  const rawIndex = Math.floor(rng() * items.length);
  const index = Math.max(0, Math.min(items.length - 1, rawIndex));
  return items[index];
}

/** Resuelve una jugada casual de dificultad `'facil'`. */
function chooseFacilMove(
  hand: readonly Card[],
  captures: readonly CaptureCandidate[],
  rng: () => number,
): PlayAction {
  const escobaCaptures = captures.filter((candidate) => candidate.isEscoba);
  if (escobaCaptures.length > 0) {
    return pickRandomItem(escobaCaptures, rng).action;
  }

  if (captures.length > 0 && rng() >= FACIL_DISCARD_PROBABILITY) {
    return pickRandomItem(captures, rng).action;
  }

  const discardCard = pickRandomItem(hand, rng);
  return { type: 'discard', cardId: discardCard.id };
}

/** Calcula la tupla oficial de prioridad para capturas en dificultad `'medio'`. */
function getMedioCaptureScore(candidate: CaptureCandidate): CaptureScore {
  const capturedCards = [candidate.playedCard, ...candidate.tableCards];
  return {
    isEscoba: candidate.isEscoba ? 1 : 0,
    hasSieteDeOros: capturedCards.some((card) => card.suit === 'oros' && card.number === 7) ? 1 : 0,
    sietesCount: capturedCards.filter((card) => card.number === 7).length,
    orosCount: capturedCards.filter((card) => card.suit === 'oros').length,
    totalCardsCount: capturedCards.length,
  };
}

/** Compara dos puntuaciones de captura en orden estricto de prioridad. */
function compareCaptureScores(a: CaptureScore, b: CaptureScore): number {
  if (a.isEscoba !== b.isEscoba) {
    return a.isEscoba - b.isEscoba;
  }
  if (a.hasSieteDeOros !== b.hasSieteDeOros) {
    return a.hasSieteDeOros - b.hasSieteDeOros;
  }
  if (a.sietesCount !== b.sietesCount) {
    return a.sietesCount - b.sietesCount;
  }
  if (a.orosCount !== b.orosCount) {
    return a.orosCount - b.orosCount;
  }
  return a.totalCardsCount - b.totalCardsCount;
}

/** Cuenta cuántos subconjuntos no vacíos de la mesa suman entre 5 y 14 (capturables con 1 carta). */
function countVulnerableSubsets(cards: readonly Card[]): number {
  const counts = new Array<number>(VULNERABLE_MAX_SUM + 1).fill(0);
  counts[0] = 1;

  for (const card of cards) {
    for (let sum = VULNERABLE_MAX_SUM; sum >= card.value; sum -= 1) {
      counts[sum] += counts[sum - card.value];
    }
  }

  let total = 0;
  for (let sum = VULNERABLE_MIN_SUM; sum <= VULNERABLE_MAX_SUM; sum += 1) {
    total += counts[sum];
  }
  return total;
}

/** Evalúa el riesgo/penalización de descartar `card` sobre `table` (menor es mejor). */
function getMedioDiscardPenalty(card: Card, table: readonly Card[]): number {
  const isOros7 = card.suit === 'oros' && card.number === 7;
  const isOtherSeven = card.number === 7 && card.suit !== 'oros';
  const isOtherOros = card.suit === 'oros' && card.number !== 7;

  const resultingTable = [...table, card];
  const tableSum = resultingTable.reduce((sum, tableCard) => sum + tableCard.value, 0);
  const risksOneCardEscoba = tableSum >= VULNERABLE_MIN_SUM && tableSum <= VULNERABLE_MAX_SUM;
  const vulnerableSubsets = countVulnerableSubsets(resultingTable);

  return (
    (isOros7 ? 1000 : 0) +
    (isOtherSeven ? 80 : 0) +
    (isOtherOros ? 30 : 0) +
    (risksOneCardEscoba ? 100 : 0) +
    vulnerableSubsets * 5 +
    card.value
  );
}

/** Resuelve la mejor jugada determinista de dificultad `'medio'`. */
function chooseMedioMove(
  hand: readonly Card[],
  table: readonly Card[],
  captures: readonly CaptureCandidate[],
): PlayAction {
  if (captures.length > 0) {
    let bestCandidate = captures[0];
    let bestScore = getMedioCaptureScore(bestCandidate);

    for (let i = 1; i < captures.length; i += 1) {
      const candidate = captures[i];
      const score = getMedioCaptureScore(candidate);
      if (compareCaptureScores(score, bestScore) > 0) {
        bestCandidate = candidate;
        bestScore = score;
      }
    }

    return bestCandidate.action;
  }

  let bestCard = hand[0];
  let lowestPenalty = getMedioDiscardPenalty(bestCard, table);

  for (let i = 1; i < hand.length; i += 1) {
    const card = hand[i];
    const penalty = getMedioDiscardPenalty(card, table);
    if (penalty < lowestPenalty) {
      bestCard = card;
      lowestPenalty = penalty;
    }
  }

  return { type: 'discard', cardId: bestCard.id };
}

/** Elige la acción legal (`capture` o `discard`) para el bot según la dificultad configurada. */
export function chooseAiMove(
  state: GameState,
  playerId: string,
  difficulty: BotDifficulty,
  rng: () => number = Math.random,
): PlayAction {
  const player = validateAiContext(state, playerId, difficulty);

  if (difficulty === 'dificil') {
    throw new Error("Bot difficulty 'dificil' is not implemented yet");
  }

  const captures = collectCaptureCandidates(player.hand, state.table);

  if (difficulty === 'facil') {
    return chooseFacilMove(player.hand, captures, rng);
  }

  return chooseMedioMove(player.hand, state.table, captures);
}
