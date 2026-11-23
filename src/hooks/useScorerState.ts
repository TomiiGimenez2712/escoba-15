import { useEffect, useState } from 'react';

export type ScorerTargetScore = 15 | 21 | 30;
export type ScorerPlayerCount = 2 | 3 | 4;

export interface ScorerParticipant {
  id: string;
  name: string;
  score: number;
  wins: number;
}

export interface ScorerState {
  targetScore: ScorerTargetScore;
  playerCount: ScorerPlayerCount;
  participants: ScorerParticipant[];
}

export const SCORER_STORAGE_KEY = 'escoba15.anotador.v1';

export function getMaxScore(targetScore: ScorerTargetScore): number {
  return targetScore + 5;
}

const DEFAULT_NAMES = ['Nosotros', 'Ellos', 'Jugador 3', 'Jugador 4'] as const;

function createDefaultParticipants(): ScorerParticipant[] {
  return DEFAULT_NAMES.map((name, index) => ({
    id: `scorer-p-${index + 1}`,
    name,
    score: 0,
    wins: 0,
  }));
}

function createDefaultState(): ScorerState {
  return {
    targetScore: 15,
    playerCount: 2,
    participants: createDefaultParticipants(),
  };
}

function isValidTargetScore(value: unknown): value is ScorerTargetScore {
  return value === 15 || value === 21 || value === 30;
}

function isValidPlayerCount(value: unknown): value is ScorerPlayerCount {
  return value === 2 || value === 3 || value === 4;
}

function sanitizeLoadedState(raw: unknown): ScorerState {
  const fallback = createDefaultState();
  if (!raw || typeof raw !== 'object') {
    return fallback;
  }

  const record = raw as Record<string, unknown>;
  const targetScore = isValidTargetScore(record.targetScore)
    ? record.targetScore
    : fallback.targetScore;
  const playerCount = isValidPlayerCount(record.playerCount)
    ? record.playerCount
    : fallback.playerCount;

  const rawParticipants = Array.isArray(record.participants) ? record.participants : [];
  const participants = fallback.participants.map((defaultParticipant, index) => {
    const item = rawParticipants[index];
    if (!item || typeof item !== 'object') {
      return defaultParticipant;
    }
    const itemRecord = item as Record<string, unknown>;
    const name = typeof itemRecord.name === 'string' ? itemRecord.name : defaultParticipant.name;
    const rawScore =
      typeof itemRecord.score === 'number' && Number.isFinite(itemRecord.score)
        ? Math.floor(itemRecord.score)
        : 0;
    const rawWins =
      typeof itemRecord.wins === 'number' && Number.isFinite(itemRecord.wins)
        ? Math.floor(itemRecord.wins)
        : 0;

    return {
      id: defaultParticipant.id,
      name,
      score: Math.max(0, Math.min(getMaxScore(targetScore), rawScore)),
      wins: Math.max(0, rawWins),
    };
  });

  return {
    targetScore,
    playerCount,
    participants,
  };
}

function loadScorerState(): ScorerState {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return createDefaultState();
    }
    const serialized = window.localStorage.getItem(SCORER_STORAGE_KEY);
    if (!serialized) {
      return createDefaultState();
    }
    return sanitizeLoadedState(JSON.parse(serialized));
  } catch {
    return createDefaultState();
  }
}

function saveScorerState(state: ScorerState): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    window.localStorage.setItem(SCORER_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignorar errores de cuota o almacenamiento bloqueado.
  }
}

/**
 * Gestiona el estado del anotador manual de puntos con persistencia en localStorage
 * para conservar nombres, puntajes y series al salir de la app o jugar revanchas.
 */
export function useScorerState() {
  const [state, setState] = useState<ScorerState>(() => loadScorerState());

  useEffect(() => {
    saveScorerState(state);
  }, [state]);

  const activeParticipants = state.participants.slice(0, state.playerCount);
  const qualified = activeParticipants.filter((p) => p.score >= state.targetScore);
  const maxQualifiedScore =
    qualified.length > 0 ? Math.max(...qualified.map((p) => p.score)) : null;
  const topQualified =
    maxQualifiedScore !== null ? qualified.filter((p) => p.score === maxQualifiedScore) : [];
  const winner = topQualified.length === 1 ? topQualified[0] : null;
  const isTie = topQualified.length > 1;

  const setTargetScore = (targetScore: ScorerTargetScore) => {
    const maxScore = getMaxScore(targetScore);
    setState((prev) => ({
      ...prev,
      targetScore,
      participants: prev.participants.map((p) => ({
        ...p,
        score: Math.min(p.score, maxScore),
      })),
    }));
  };

  const setPlayerCount = (playerCount: ScorerPlayerCount) => {
    setState((prev) => ({
      ...prev,
      playerCount,
    }));
  };

  const setParticipantName = (index: number, name: string) => {
    setState((prev) => ({
      ...prev,
      participants: prev.participants.map((p, i) => (i === index ? { ...p, name } : p)),
    }));
  };

  const adjustScore = (index: number, delta: number) => {
    setState((prev) => {
      const maxScore = getMaxScore(prev.targetScore);
      return {
        ...prev,
        participants: prev.participants.map((p, i) => {
          if (i !== index) {
            return p;
          }
          const nextScore = Math.max(0, Math.min(maxScore, p.score + delta));
          return { ...p, score: nextScore };
        }),
      };
    });
  };

  const rematch = () => {
    setState((prev) => {
      const currentActive = prev.participants.slice(0, prev.playerCount);
      const currentQualified = currentActive.filter((p) => p.score >= prev.targetScore);
      const maxScore =
        currentQualified.length > 0
          ? Math.max(...currentQualified.map((p) => p.score))
          : null;
      const top =
        maxScore !== null ? currentQualified.filter((p) => p.score === maxScore) : [];
      const currentWinner = top.length === 1 ? top[0] : undefined;

      return {
        ...prev,
        participants: prev.participants.map((p, index) => {
          const isWinner =
            currentWinner !== undefined && index < prev.playerCount && p.id === currentWinner.id;
          return {
            ...p,
            score: 0,
            wins: isWinner ? p.wins + 1 : p.wins,
          };
        }),
      };
    });
  };

  const resetSeries = () => {
    setState((prev) => ({
      ...prev,
      participants: prev.participants.map((p) => ({
        ...p,
        score: 0,
        wins: 0,
      })),
    }));
  };

  return {
    targetScore: state.targetScore,
    playerCount: state.playerCount,
    participants: activeParticipants,
    winner,
    isTie,
    tieScore: isTie ? maxQualifiedScore : null,
    setTargetScore,
    setPlayerCount,
    setParticipantName,
    adjustScore,
    rematch,
    resetSeries,
  };
}
