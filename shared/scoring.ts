import type {
  Card,
  GamePhase,
  ParticipantRoundScore,
  Player,
  RoundScoreSummary,
  TargetScore,
} from './types';

export interface ScoreRoundInput {
  players: readonly Player[];
  round: number;
  targetScore: TargetScore;
  leftoverCards?: Card[];
  leftoverWinnerId?: string | null;
}

export interface ScoreRoundResult {
  players: Player[];
  summary: RoundScoreSummary;
  phase: GamePhase;
  winnerId: string | null;
  winnerTeamId: 0 | 1 | null;
  isTiebreaker: boolean;
}

interface ParticipantAggregate {
  participantId: string;
  label: string;
  teamId?: 0 | 1;
  playerIds: string[];
  previousScore: number;
  escobas: number;
  sieteDeOros: 0 | 1;
  totalCardsCount: number;
  orosCount: number;
  sietesCount: number;
}

/** Retorna el índice del participante con único máximo estricto (> 0), o `null` si hay empate o es 0. */
function resolveStrictMajorityWinner(counts: readonly number[]): number | null {
  if (counts.length === 0) {
    return null;
  }

  const maxCount = Math.max(...counts);
  if (maxCount <= 0) {
    return null;
  }

  let winnerIndex: number | null = null;
  for (let i = 0; i < counts.length; i += 1) {
    if (counts[i] === maxCount) {
      if (winnerIndex !== null) {
        return null;
      }
      winnerIndex = i;
    }
  }

  return winnerIndex;
}

/** Construye los acumulados base por participante según modo individual (2/3) o parejas (4 con teamId). */
function buildParticipantAggregates(
  players: readonly Player[],
  isTeamMode: boolean,
): ParticipantAggregate[] {
  const buildFromGroup = (
    participantId: string,
    label: string,
    groupPlayers: readonly Player[],
    teamId?: 0 | 1,
  ): ParticipantAggregate => {
    const captured = groupPlayers.flatMap((player) => player.captured);
    const hasSieteDeOros = captured.some((card) => card.suit === 'oros' && card.number === 7);

    return {
      participantId,
      label,
      ...(teamId !== undefined ? { teamId } : {}),
      playerIds: groupPlayers.map((player) => player.id),
      previousScore: groupPlayers[0]?.score ?? 0,
      escobas: groupPlayers.reduce((sum, player) => sum + player.escobas, 0),
      sieteDeOros: hasSieteDeOros ? 1 : 0,
      totalCardsCount: captured.length,
      orosCount: captured.filter((card) => card.suit === 'oros').length,
      sietesCount: captured.filter((card) => card.number === 7).length,
    };
  };

  if (isTeamMode) {
    return ([0, 1] as const).map((teamId) => {
      const teamPlayers = players.filter((player) => player.teamId === teamId);
      const label = teamPlayers.map((player) => player.name).join(' y ');
      return buildFromGroup(`team-${teamId}`, label, teamPlayers, teamId);
    });
  }

  return players.map((player) => buildFromGroup(player.id, player.name, [player]));
}

/** Calcula los 5 rubros oficiales de la ronda, actualiza puntajes y determina fin de ronda o victoria. */
export function scoreRound(input: ScoreRoundInput): ScoreRoundResult {
  if (input.players.length === 0) {
    throw new Error('Cannot score round without players');
  }

  const isTeamMode =
    input.players.length === 4 &&
    input.players.some((player) => player.teamId === 0) &&
    input.players.some((player) => player.teamId === 1) &&
    input.players.every((player) => player.teamId === 0 || player.teamId === 1);

  const aggregates = buildParticipantAggregates(input.players, isTeamMode);

  const sietesWinner = resolveStrictMajorityWinner(aggregates.map((p) => p.sietesCount));
  const orosWinner = resolveStrictMajorityWinner(aggregates.map((p) => p.orosCount));
  const cartasWinner = resolveStrictMajorityWinner(aggregates.map((p) => p.totalCardsCount));

  const roundTotalByPlayerId = new Map<string, number>();

  const participants: ParticipantRoundScore[] = aggregates.map((aggregate, index) => {
    const sietes: 0 | 1 = sietesWinner === index ? 1 : 0;
    const oros: 0 | 1 = orosWinner === index ? 1 : 0;
    const cartas: 0 | 1 = cartasWinner === index ? 1 : 0;
    const roundTotal = aggregate.escobas + aggregate.sieteDeOros + sietes + oros + cartas;
    const totalScore = aggregate.previousScore + roundTotal;

    for (const playerId of aggregate.playerIds) {
      roundTotalByPlayerId.set(playerId, roundTotal);
    }

    return {
      participantId: aggregate.participantId,
      label: aggregate.label,
      ...(aggregate.teamId !== undefined ? { teamId: aggregate.teamId } : {}),
      playerIds: aggregate.playerIds,
      escobas: aggregate.escobas,
      sieteDeOros: aggregate.sieteDeOros,
      sietes,
      oros,
      cartas,
      roundTotal,
      totalScore,
      totalCardsCount: aggregate.totalCardsCount,
      orosCount: aggregate.orosCount,
      sietesCount: aggregate.sietesCount,
    };
  });

  const players: Player[] = input.players.map((player) => ({
    ...player,
    hand: [...player.hand],
    captured: [...player.captured],
    score: player.score + (roundTotalByPlayerId.get(player.id) ?? 0),
  }));

  const maxTotalScore = Math.max(...participants.map((p) => p.totalScore));
  const topParticipants = participants.filter((p) => p.totalScore === maxTotalScore);

  let phase: GamePhase = 'round_end';
  let isTiebreaker = false;
  let winnerId: string | null = null;
  let winnerTeamId: 0 | 1 | null = null;

  if (maxTotalScore >= input.targetScore) {
    if (topParticipants.length > 1) {
      isTiebreaker = true;
    } else {
      const winner = topParticipants[0];
      phase = 'game_over';
      if (isTeamMode) {
        winnerTeamId = winner.teamId ?? null;
      } else {
        winnerId = winner.participantId;
      }
    }
  }

  const summary: RoundScoreSummary = {
    round: input.round,
    leftoverCards: input.leftoverCards ? [...input.leftoverCards] : [],
    leftoverWinnerId: input.leftoverWinnerId ?? null,
    participants,
    isTiebreaker,
    winnerId,
    winnerTeamId,
  };

  return {
    players,
    summary,
    phase,
    winnerId,
    winnerTeamId,
    isTiebreaker,
  };
}
