import { createDeck } from './deck';
import { findCaptureCombinations } from './engine';
import type { BotDifficulty, Card, GameState, PlayAction, Player } from './types';

const VALID_DIFFICULTIES = new Set<BotDifficulty>(['facil', 'medio', 'dificil']);
const FACIL_DISCARD_PROBABILITY = 0.35;
const VULNERABLE_MIN_SUM = 5;
const VULNERABLE_MAX_SUM = 14;
const ESCOBA_TARGET_SUM = 15;
const TOTAL_DECK_SIETES = 4;
const TOTAL_DECK_OROS = 10;
const TOTAL_DECK_CARDS = 40;
const SIETES_MAJORITY = 3;
const OROS_MAJORITY = 6;
const CARDS_MAJORITY = 21;
const TARGET_SCORE_PROXIMITY_THRESHOLD = 2;

const DIFICIL_WEIGHTS = {
  escobaBonus: 105,
  sieteDeOrosBonus: 75,
  disputedSieteValue: 18,
  decidedSieteValue: 1,
  sieteMajorityBonus: 48,
  sieteBlockBonus: 22,
  disputedOroValue: 10,
  blockingOroValue: 12,
  decidedOroValue: 0.5,
  oroMajorityBonus: 50,
  oroBlockBonus: 22,
  disputedCardValue: 2.5,
  decidedCardValue: 0.3,
  cardsMajorityBonus: 50,
  cardsBlockBonus: 20,
  escobaDangerWeight: 115,
  subsetDangerWeight: 14,
  sieteDeOrosExposePenalty: 35,
  disputedSieteExposePenalty: 10,
  disputedOroExposePenalty: 5,
  discardOpportunityCost: 2.5,
  lastHandLeftoverWeight: 0.4,
  stealLastCapturerBonus: 8,
} as const;

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

/** Indica si una carta es el 7 de Oros. */
function isSieteDeOros(card: Card): boolean {
  return card.suit === 'oros' && card.number === 7;
}

/** Calcula la tupla oficial de prioridad para capturas en dificultad `'medio'`. */
function getMedioCaptureScore(candidate: CaptureCandidate): CaptureScore {
  const capturedCards = [candidate.playedCard, ...candidate.tableCards];
  return {
    isEscoba: candidate.isEscoba ? 1 : 0,
    hasSieteDeOros: capturedCards.some(isSieteDeOros) ? 1 : 0,
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

/** Calcula por DP cuántos subconjuntos de `cards` suman cada valor en `0..VULNERABLE_MAX_SUM`. */
function countSubsetSumsInRange(cards: readonly Card[]): number[] {
  const counts = new Array<number>(VULNERABLE_MAX_SUM + 1).fill(0);
  counts[0] = 1;

  for (const card of cards) {
    for (let sum = VULNERABLE_MAX_SUM; sum >= card.value; sum -= 1) {
      counts[sum] += counts[sum - card.value];
    }
  }

  return counts;
}

/** Cuenta cuántos subconjuntos no vacíos de la mesa suman entre 5 y 14 (capturables con 1 carta). */
function countVulnerableSubsets(cards: readonly Card[]): number {
  const counts = countSubsetSumsInRange(cards);

  let total = 0;
  for (let sum = VULNERABLE_MIN_SUM; sum <= VULNERABLE_MAX_SUM; sum += 1) {
    total += counts[sum];
  }
  return total;
}

/** Evalúa el riesgo/penalización de descartar `card` sobre `table` (menor es mejor). */
function getMedioDiscardPenalty(card: Card, table: readonly Card[]): number {
  const isOros7 = isSieteDeOros(card);
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

interface CardMemory {
  unseenCountByValue: Map<number, number>;
  totalUnseenCards: number;
}

interface GroupStats {
  playerIds: Set<string>;
  sietesCount: number;
  orosCount: number;
  cardsCount: number;
  hasSieteDeOros: boolean;
  escobas: number;
  score: number;
}

interface DificilEvalContext {
  myGroup: GroupStats;
  rivalGroups: GroupStats[];
  remainingSietes: number;
  remainingOros: number;
  remainingCards: number;
  hasPendingOpponentTurns: boolean;
  isFinalTurnOfRound: boolean;
  lookaheadCards: number;
  offenseMultiplier: number;
  defenseMultiplier: number;
  canSietesChange: boolean;
  canOrosChange: boolean;
  canCardsChange: boolean;
  lastCapturerGroup: GroupStats | null;
  isLastCapturerRival: boolean;
}

/** Deduce las cartas aún no vistas (por valor 1..10) sobre las 40 cartas de `createDeck()`. */
function buildCardMemory(state: GameState, player: Player): CardMemory {
  const seenIds = new Set<string>();

  for (const card of player.hand) {
    seenIds.add(card.id);
  }
  for (const card of state.table) {
    seenIds.add(card.id);
  }
  for (const participant of state.players) {
    for (const card of participant.captured) {
      seenIds.add(card.id);
    }
  }
  if (state.lastAction?.playedCard) {
    seenIds.add(state.lastAction.playedCard.id);
  }

  const unseenCountByValue = new Map<number, number>();
  let totalUnseenCards = 0;

  for (const card of createDeck()) {
    if (!seenIds.has(card.id)) {
      unseenCountByValue.set(card.value, (unseenCountByValue.get(card.value) ?? 0) + 1);
      totalUnseenCards += 1;
    }
  }

  return { unseenCountByValue, totalUnseenCards };
}

/** Agrega estadísticas de capturas, escobas y puntaje para un jugador o pareja 2v2. */
function buildGroupStats(groupPlayers: readonly Player[]): GroupStats {
  const captured = groupPlayers.flatMap((member) => member.captured);
  return {
    playerIds: new Set(groupPlayers.map((member) => member.id)),
    sietesCount: captured.filter((card) => card.number === 7).length,
    orosCount: captured.filter((card) => card.suit === 'oros').length,
    cardsCount: captured.length,
    hasSieteDeOros: captured.some(isSieteDeOros),
    escobas: groupPlayers.reduce((sum, member) => sum + member.escobas, 0),
    score: Math.max(0, ...groupPlayers.map((member) => member.score)),
  };
}

/** Determina si el puntaje de un rubro de mayoría todavía puede cambiar para `targetGroup`. */
function canMajorityPointChange(
  groupCount: number,
  maxOtherCount: number,
  remainingInPlay: number,
  majorityThreshold: number,
): boolean {
  if (groupCount >= majorityThreshold || maxOtherCount >= majorityThreshold) {
    return false;
  }
  return groupCount + remainingInPlay >= maxOtherCount;
}

/** Calcula el puntaje proyectado en la partida sumando puntos ya garantizados de la ronda. */
function getProjectedScore(group: GroupStats): number {
  const guaranteedRoundPoints =
    group.escobas +
    (group.hasSieteDeOros ? 1 : 0) +
    (group.sietesCount >= SIETES_MAJORITY ? 1 : 0) +
    (group.orosCount >= OROS_MAJORITY ? 1 : 0) +
    (group.cardsCount >= CARDS_MAJORITY ? 1 : 0);
  return group.score + guaranteedRoundPoints;
}

/** Arma el contexto táctico de equipos/rivales, umbrales y turnos pendientes para `'dificil'`. */
function buildDificilContext(state: GameState, player: Player): DificilEvalContext {
  const isTeamMode = player.teamId !== undefined;
  const allyPlayers = isTeamMode
    ? state.players.filter((candidate) => candidate.teamId === player.teamId)
    : [player];
  const myGroup = buildGroupStats(allyPlayers);

  const opponents = state.players.filter((candidate) => !myGroup.playerIds.has(candidate.id));
  const rivalGroups: GroupStats[] = [];

  if (isTeamMode) {
    const groupedByKey = new Map<string, Player[]>();
    for (const opponent of opponents) {
      const key = opponent.teamId !== undefined ? `team-${opponent.teamId}` : opponent.id;
      const existing = groupedByKey.get(key) ?? [];
      existing.push(opponent);
      groupedByKey.set(key, existing);
    }
    for (const members of groupedByKey.values()) {
      rivalGroups.push(buildGroupStats(members));
    }
  } else {
    for (const opponent of opponents) {
      rivalGroups.push(buildGroupStats([opponent]));
    }
  }

  const allGroups = [myGroup, ...rivalGroups];
  const totalCapturedSietes = allGroups.reduce((sum, group) => sum + group.sietesCount, 0);
  const totalCapturedOros = allGroups.reduce((sum, group) => sum + group.orosCount, 0);
  const totalCapturedCards = allGroups.reduce((sum, group) => sum + group.cardsCount, 0);

  const remainingSietes = Math.max(0, TOTAL_DECK_SIETES - totalCapturedSietes);
  const remainingOros = Math.max(0, TOTAL_DECK_OROS - totalCapturedOros);
  const remainingCards = Math.max(0, TOTAL_DECK_CARDS - totalCapturedCards);

  const maxRivalSietes = Math.max(0, ...rivalGroups.map((group) => group.sietesCount));
  const maxRivalOros = Math.max(0, ...rivalGroups.map((group) => group.orosCount));
  const maxRivalCards = Math.max(0, ...rivalGroups.map((group) => group.cardsCount));

  const opponentHandCardsCount = opponents.reduce((sum, opp) => sum + opp.hand.length, 0);
  const hasPendingOpponentTurns = state.deck.length > 0 || opponentHandCardsCount > 0;
  const isFinalTurnOfRound =
    state.deck.length === 0 &&
    state.players.every((p) => (p.id === player.id ? p.hand.length === 1 : p.hand.length === 0));

  let lookaheadCards = 0;
  if (hasPendingOpponentTurns) {
    const rivalUnitCount = Math.max(1, opponents.length);
    lookaheadCards =
      opponentHandCardsCount > 0
        ? opponentHandCardsCount + (state.deck.length > 0 ? Math.min(state.deck.length, rivalUnitCount) : 0)
        : Math.min(state.deck.length, rivalUnitCount * 3);
  }

  const myRemainingToTarget = state.targetScore - getProjectedScore(myGroup);
  const maxRivalProjected = Math.max(0, ...rivalGroups.map(getProjectedScore));
  const rivalRemainingToTarget = state.targetScore - maxRivalProjected;

  const offenseMultiplier = myRemainingToTarget <= TARGET_SCORE_PROXIMITY_THRESHOLD ? 1.2 : 1;
  const defenseMultiplier = rivalRemainingToTarget <= TARGET_SCORE_PROXIMITY_THRESHOLD ? 1.25 : 1;

  const lastCapturerId = state.lastCapturerId;
  const lastCapturerGroup =
    lastCapturerId === null
      ? null
      : (allGroups.find((group) => group.playerIds.has(lastCapturerId)) ?? null);
  const isLastCapturerRival = lastCapturerGroup !== null && lastCapturerGroup !== myGroup;

  return {
    myGroup,
    rivalGroups,
    remainingSietes,
    remainingOros,
    remainingCards,
    hasPendingOpponentTurns,
    isFinalTurnOfRound,
    lookaheadCards,
    offenseMultiplier,
    defenseMultiplier,
    canSietesChange: canMajorityPointChange(
      myGroup.sietesCount,
      maxRivalSietes,
      remainingSietes,
      SIETES_MAJORITY,
    ),
    canOrosChange: canMajorityPointChange(
      myGroup.orosCount,
      maxRivalOros,
      remainingOros,
      OROS_MAJORITY,
    ),
    canCardsChange: canMajorityPointChange(
      myGroup.cardsCount,
      maxRivalCards,
      remainingCards,
      CARDS_MAJORITY,
    ),
    lastCapturerGroup,
    isLastCapturerRival,
  };
}

/** Probabilidad hipergeométrica de que un rival tenga o robe al menos 1 carta entre `unseenCount`. */
function getComplementHitProbability(
  unseenCount: number,
  totalUnseenCards: number,
  draws: number,
): number {
  if (unseenCount <= 0 || totalUnseenCards <= 0 || draws <= 0) {
    return 0;
  }

  const effectiveDraws = Math.min(draws, totalUnseenCards);
  if (unseenCount > totalUnseenCards - effectiveDraws) {
    return 1;
  }

  let noHitProbability = 1;
  for (let i = 0; i < effectiveDraws; i += 1) {
    noHitProbability *= (totalUnseenCards - unseenCount - i) / (totalUnseenCards - i);
  }
  return 1 - noHitProbability;
}

/** Evalúa el peligro de dejar `resultingTable` según cartas no vistas y turnos rivales pendientes. */
function evaluateTableDanger(
  resultingTable: readonly Card[],
  memory: CardMemory,
  context: DificilEvalContext,
): number {
  if (resultingTable.length === 0 || !context.hasPendingOpponentTurns) {
    return 0;
  }

  const hitProbForComplement = (sum: number): number => {
    const neededValue = ESCOBA_TARGET_SUM - sum;
    const unseenComplement = memory.unseenCountByValue.get(neededValue) ?? 0;
    return getComplementHitProbability(
      unseenComplement,
      memory.totalUnseenCards,
      context.lookaheadCards,
    );
  };

  let danger = 0;
  const tableSum = resultingTable.reduce((sum, card) => sum + card.value, 0);
  const hasOneCardEscobaRisk = tableSum >= VULNERABLE_MIN_SUM && tableSum <= VULNERABLE_MAX_SUM;

  if (hasOneCardEscobaRisk) {
    danger += hitProbForComplement(tableSum) * DIFICIL_WEIGHTS.escobaDangerWeight;
  }

  const subsetCounts = countSubsetSumsInRange(resultingTable);
  if (hasOneCardEscobaRisk && subsetCounts[tableSum] > 0) {
    subsetCounts[tableSum] -= 1;
  }

  for (let sum = VULNERABLE_MIN_SUM; sum <= VULNERABLE_MAX_SUM; sum += 1) {
    const count = subsetCounts[sum];
    if (count > 0) {
      danger += hitProbForComplement(sum) * DIFICIL_WEIGHTS.subsetDangerWeight * Math.min(count, 2);
    }
  }

  for (const card of resultingTable) {
    const directHitProb = hitProbForComplement(card.value);
    if (directHitProb <= 0) {
      continue;
    }
    if (isSieteDeOros(card)) {
      danger += directHitProb * DIFICIL_WEIGHTS.sieteDeOrosExposePenalty;
    } else if (card.number === 7 && context.canSietesChange) {
      danger += directHitProb * DIFICIL_WEIGHTS.disputedSieteExposePenalty;
    } else if (card.suit === 'oros' && context.canOrosChange) {
      danger += directHitProb * DIFICIL_WEIGHTS.disputedOroExposePenalty;
    }
  }

  return danger * context.defenseMultiplier;
}

interface MajorityCategoryEval {
  added: number;
  currentCount: number;
  maxOtherCount: number;
  remainingInPlay: number;
  majorityThreshold: number;
  tieThreshold: number;
  disputedValue: number;
  decidedValue: number;
  majorityBonus: number;
  blockBonus: number;
  offenseMultiplier: number;
  defenseMultiplier: number;
}

/** Evalúa el aporte táctico de sumar cartas en un rubro de mayoría (Sietes, Oros o Cartas). */
function evaluateMajorityCategoryGain(params: MajorityCategoryEval): number {
  if (params.added <= 0) {
    return 0;
  }

  const canChange = canMajorityPointChange(
    params.currentCount,
    params.maxOtherCount,
    params.remainingInPlay,
    params.majorityThreshold,
  );
  if (!canChange) {
    return params.added * params.decidedValue;
  }

  const nextCount = params.currentCount + params.added;
  let gain = params.added * params.disputedValue;

  if (params.currentCount < params.majorityThreshold && nextCount >= params.majorityThreshold) {
    gain += params.majorityBonus * params.offenseMultiplier;
  } else if (
    params.currentCount < params.tieThreshold &&
    nextCount >= params.tieThreshold &&
    params.maxOtherCount <= params.tieThreshold
  ) {
    gain += params.blockBonus * params.defenseMultiplier;
  }

  return gain;
}

/** Calcula el valor táctico de sumar `cards` (y opcional Escoba) para `targetGroup`. */
function evaluateGroupCardsGain(
  cards: readonly Card[],
  isEscoba: boolean,
  targetGroup: GroupStats,
  otherGroups: readonly GroupStats[],
  context: DificilEvalContext,
): number {
  let gain = isEscoba ? DIFICIL_WEIGHTS.escobaBonus * context.offenseMultiplier : 0;

  if (cards.some(isSieteDeOros)) {
    gain += DIFICIL_WEIGHTS.sieteDeOrosBonus * context.offenseMultiplier;
  }

  const maxOtherSietes = Math.max(0, ...otherGroups.map((group) => group.sietesCount));
  const maxOtherOros = Math.max(0, ...otherGroups.map((group) => group.orosCount));
  const maxOtherCards = Math.max(0, ...otherGroups.map((group) => group.cardsCount));

  gain += evaluateMajorityCategoryGain({
    added: cards.filter((card) => card.number === 7).length,
    currentCount: targetGroup.sietesCount,
    maxOtherCount: maxOtherSietes,
    remainingInPlay: context.remainingSietes,
    majorityThreshold: SIETES_MAJORITY,
    tieThreshold: 2,
    disputedValue: DIFICIL_WEIGHTS.disputedSieteValue,
    decidedValue: DIFICIL_WEIGHTS.decidedSieteValue,
    majorityBonus: DIFICIL_WEIGHTS.sieteMajorityBonus,
    blockBonus: DIFICIL_WEIGHTS.sieteBlockBonus,
    offenseMultiplier: context.offenseMultiplier,
    defenseMultiplier: context.defenseMultiplier,
  });

  const disputedOroValue =
    maxOtherOros >= 3 && maxOtherOros <= 5
      ? DIFICIL_WEIGHTS.blockingOroValue
      : DIFICIL_WEIGHTS.disputedOroValue;

  gain += evaluateMajorityCategoryGain({
    added: cards.filter((card) => card.suit === 'oros').length,
    currentCount: targetGroup.orosCount,
    maxOtherCount: maxOtherOros,
    remainingInPlay: context.remainingOros,
    majorityThreshold: OROS_MAJORITY,
    tieThreshold: 5,
    disputedValue: disputedOroValue,
    decidedValue: DIFICIL_WEIGHTS.decidedOroValue,
    majorityBonus: DIFICIL_WEIGHTS.oroMajorityBonus,
    blockBonus: DIFICIL_WEIGHTS.oroBlockBonus,
    offenseMultiplier: context.offenseMultiplier,
    defenseMultiplier: context.defenseMultiplier,
  });

  gain += evaluateMajorityCategoryGain({
    added: cards.length,
    currentCount: targetGroup.cardsCount,
    maxOtherCount: maxOtherCards,
    remainingInPlay: context.remainingCards,
    majorityThreshold: CARDS_MAJORITY,
    tieThreshold: 20,
    disputedValue: DIFICIL_WEIGHTS.disputedCardValue,
    decidedValue: DIFICIL_WEIGHTS.decidedCardValue,
    majorityBonus: DIFICIL_WEIGHTS.cardsMajorityBonus,
    blockBonus: DIFICIL_WEIGHTS.cardsBlockBonus,
    offenseMultiplier: context.offenseMultiplier,
    defenseMultiplier: context.defenseMultiplier,
  });

  return gain;
}

/** Evalúa la puntuación táctica de una captura candidata en dificultad `'dificil'`. */
function evaluateDificilCapture(
  candidate: CaptureCandidate,
  state: GameState,
  memory: CardMemory,
  context: DificilEvalContext,
): number {
  const capturedIds = new Set(candidate.action.tableCardIds);
  const resultingTable = state.table.filter((card) => !capturedIds.has(card.id));
  const capturedCards = [candidate.playedCard, ...candidate.tableCards];

  const effectiveCaptured =
    context.isFinalTurnOfRound && resultingTable.length > 0
      ? [...capturedCards, ...resultingTable]
      : capturedCards;

  const gain = evaluateGroupCardsGain(
    effectiveCaptured,
    candidate.isEscoba,
    context.myGroup,
    context.rivalGroups,
    context,
  );

  let lastHandBonus = 0;
  if (state.deck.length === 0 && !context.isFinalTurnOfRound && resultingTable.length > 0) {
    const leftoverPotential = evaluateGroupCardsGain(
      resultingTable,
      false,
      context.myGroup,
      context.rivalGroups,
      context,
    );
    lastHandBonus =
      leftoverPotential * DIFICIL_WEIGHTS.lastHandLeftoverWeight +
      (context.isLastCapturerRival ? DIFICIL_WEIGHTS.stealLastCapturerBonus : 0);
  }

  const danger = evaluateTableDanger(resultingTable, memory, context);
  return gain + lastHandBonus - danger;
}

/** Evalúa la puntuación táctica de descartar `card` en dificultad `'dificil'`. */
function evaluateDificilDiscard(
  card: Card,
  state: GameState,
  memory: CardMemory,
  context: DificilEvalContext,
): number {
  const resultingTable = [...state.table, card];

  let cardLossPenalty = DIFICIL_WEIGHTS.discardOpportunityCost + card.value * 0.1;
  if (!context.isFinalTurnOfRound || context.lastCapturerGroup === null) {
    if (isSieteDeOros(card)) {
      cardLossPenalty += DIFICIL_WEIGHTS.sieteDeOrosBonus;
    } else if (card.number === 7) {
      cardLossPenalty += context.canSietesChange
        ? DIFICIL_WEIGHTS.disputedSieteValue
        : DIFICIL_WEIGHTS.decidedSieteValue;
    } else if (card.suit === 'oros') {
      cardLossPenalty += context.canOrosChange
        ? DIFICIL_WEIGHTS.disputedOroValue
        : DIFICIL_WEIGHTS.decidedOroValue;
    }
  }

  let lastHandDelta = 0;
  if (context.isFinalTurnOfRound && context.lastCapturerGroup !== null) {
    if (context.isLastCapturerRival) {
      const rivalOtherGroups = [
        context.myGroup,
        ...context.rivalGroups.filter((group) => group !== context.lastCapturerGroup),
      ];
      lastHandDelta = -evaluateGroupCardsGain(
        resultingTable,
        false,
        context.lastCapturerGroup,
        rivalOtherGroups,
        context,
      );
    } else {
      lastHandDelta = evaluateGroupCardsGain(
        resultingTable,
        false,
        context.myGroup,
        context.rivalGroups,
        context,
      );
    }
  } else if (state.deck.length === 0 && context.isLastCapturerRival && resultingTable.length > 0) {
    const leftoverPotential = evaluateGroupCardsGain(
      resultingTable,
      false,
      context.myGroup,
      context.rivalGroups,
      context,
    );
    lastHandDelta = -leftoverPotential * 0.25;
  }

  const danger = evaluateTableDanger(resultingTable, memory, context);
  return lastHandDelta - cardLossPenalty - danger;
}

/** Resuelve la jugada óptima de dificultad `'dificil'` evaluando capturas y descartes en una escala unificada. */
function chooseDificilMove(
  state: GameState,
  player: Player,
  captures: readonly CaptureCandidate[],
): PlayAction {
  const memory = buildCardMemory(state, player);
  const context = buildDificilContext(state, player);

  let bestAction: PlayAction | null = null;
  let bestScore = -Infinity;

  for (const candidate of captures) {
    const score = evaluateDificilCapture(candidate, state, memory, context);
    if (score > bestScore) {
      bestScore = score;
      bestAction = candidate.action;
    }
  }

  for (const card of player.hand) {
    const score = evaluateDificilDiscard(card, state, memory, context);
    if (score > bestScore) {
      bestScore = score;
      bestAction = { type: 'discard', cardId: card.id };
    }
  }

  return bestAction as PlayAction;
}

/** Elige la acción legal (`capture` o `discard`) para el bot según la dificultad configurada. */
export function chooseAiMove(
  state: GameState,
  playerId: string,
  difficulty: BotDifficulty,
  rng: () => number = Math.random,
): PlayAction {
  const player = validateAiContext(state, playerId, difficulty);
  const captures = collectCaptureCandidates(player.hand, state.table);

  if (difficulty === 'facil') {
    return chooseFacilMove(player.hand, captures, rng);
  }

  if (difficulty === 'medio') {
    return chooseMedioMove(player.hand, state.table, captures);
  }

  return chooseDificilMove(state, player, captures);
}
