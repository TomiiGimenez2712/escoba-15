import { describe, expect, it } from 'vitest';
import { createDeck } from './deck';
import { scoreRound } from './scoring';
import type { Card, Player } from './types';

function makePlayer(overrides: Partial<Player> & Pick<Player, 'id' | 'name'>): Player {
  return {
    isBot: false,
    hand: [],
    captured: [],
    escobas: 0,
    score: 0,
    ...overrides,
  };
}

function pickCards(deck: readonly Card[], ids: readonly string[]): { picked: Card[]; rest: Card[] } {
  const idSet = new Set(ids);
  const picked = deck.filter((card) => idSet.has(card.id));
  const rest = deck.filter((card) => !idSet.has(card.id));
  return { picked, rest };
}

describe('shared/scoring — scoreRound', () => {
  it('calcula los 5 rubros en 2 jugadores con 40 cartas, respeta empates exactos y no muta players', () => {
    const deck = createDeck();

    // Caso 1: máximos estrictos en todos los rubros y nadie llega a 15
    const p1StrictIds = [
      ...deck.filter((c) => c.suit === 'oros').map((c) => c.id), // 10 oros (incluye oros-7)
      'copas-7',
      'espadas-7',
      ...deck.filter((c) => c.suit === 'copas' && c.number !== 7).map((c) => c.id), // 9 cartas
      'espadas-1',
      'espadas-2',
    ]; // 23 cartas, 10 oros, 3 sietes
    const { picked: p1StrictCards, rest: p2StrictCards } = pickCards(deck, p1StrictIds);

    const strictPlayers: Player[] = [
      makePlayer({ id: 'p1', name: 'Ana', captured: p1StrictCards, escobas: 2, score: 3 }),
      makePlayer({ id: 'p2', name: 'Beto', captured: p2StrictCards, escobas: 1, score: 4 }),
    ];
    const snapshot = structuredClone(strictPlayers);

    const strictResult = scoreRound({
      players: strictPlayers,
      round: 1,
      targetScore: 15,
    });

    expect(strictPlayers).toEqual(snapshot);
    expect(strictResult.phase).toBe('round_end');
    expect(strictResult.isTiebreaker).toBe(false);
    expect(strictResult.winnerId).toBeNull();
    expect(strictResult.winnerTeamId).toBeNull();
    expect(strictResult.summary.round).toBe(1);
    expect(strictResult.summary.leftoverCards).toEqual([]);
    expect(strictResult.summary.leftoverWinnerId).toBeNull();

    expect(strictResult.summary.participants).toEqual([
      {
        participantId: 'p1',
        label: 'Ana',
        playerIds: ['p1'],
        escobas: 2,
        sieteDeOros: 1,
        sietes: 1,
        oros: 1,
        cartas: 1,
        roundTotal: 6,
        totalScore: 9,
        totalCardsCount: 23,
        orosCount: 10,
        sietesCount: 3,
      },
      {
        participantId: 'p2',
        label: 'Beto',
        playerIds: ['p2'],
        escobas: 1,
        sieteDeOros: 0,
        sietes: 0,
        oros: 0,
        cartas: 0,
        roundTotal: 1,
        totalScore: 5,
        totalCardsCount: 17,
        orosCount: 0,
        sietesCount: 1,
      },
    ]);
    expect(strictResult.players.map((p) => p.score)).toEqual([9, 5]);

    // Caso 2: empate exacto 20 vs 20 cartas, 5 vs 5 oros y 2 vs 2 sietes -> 0 puntos de mayoría
    const p1TieIds = [
      'oros-1',
      'oros-2',
      'oros-3',
      'oros-4',
      'oros-7',
      'copas-7',
      ...deck.filter((c) => c.suit === 'copas' && c.number !== 7).map((c) => c.id), // 9 cartas
      'espadas-1',
      'espadas-2',
      'espadas-3',
      'espadas-4',
      'espadas-5',
    ]; // 20 cartas, 5 oros, 2 sietes
    const { picked: p1TieCards, rest: p2TieCards } = pickCards(deck, p1TieIds);

    const tieResult = scoreRound({
      players: [
        makePlayer({ id: 'p1', name: 'Ana', captured: p1TieCards, escobas: 1, score: 0 }),
        makePlayer({ id: 'p2', name: 'Beto', captured: p2TieCards, escobas: 0, score: 0 }),
      ],
      round: 2,
      targetScore: 15,
    });

    expect(tieResult.summary.participants[0]).toMatchObject({
      escobas: 1,
      sieteDeOros: 1,
      sietes: 0,
      oros: 0,
      cartas: 0,
      roundTotal: 2,
      totalCardsCount: 20,
      orosCount: 5,
      sietesCount: 2,
    });
    expect(tieResult.summary.participants[1]).toMatchObject({
      escobas: 0,
      sieteDeOros: 0,
      sietes: 0,
      oros: 0,
      cartas: 0,
      roundTotal: 0,
      totalCardsCount: 20,
      orosCount: 5,
      sietesCount: 2,
    });
  });

  it('agrupa por teamId en 4 jugadores 2v2, actualiza el score de ambos integrantes y define winnerTeamId a 21 puntos', () => {
    const deck = createDeck();
    const p1Ids = [
      'oros-1',
      'oros-2',
      'oros-3',
      ...deck.filter((c) => c.suit === 'copas' && c.number !== 7).map((c) => c.id),
    ]; // 12 cartas, 3 oros, 0 sietes
    const p3Ids = ['espadas-1', 'espadas-2', 'espadas-3', 'espadas-4', 'espadas-5']; // 5 cartas
    const p4Ids = deck.filter((c) => c.suit === 'bastos').map((c) => c.id); // 10 cartas, 1 siete

    const { picked: p1Cards, rest: afterP1 } = pickCards(deck, p1Ids);
    const { picked: p3Cards, rest: afterP3 } = pickCards(afterP1, p3Ids);
    const { picked: p4Cards, rest: p2Cards } = pickCards(afterP3, p4Ids); // p2 recibe 13 cartas con 7 oros (incluido oros-7) y 3 sietes

    const result = scoreRound({
      players: [
        makePlayer({ id: 'p1', name: 'Ana', teamId: 0, captured: p1Cards, escobas: 1, score: 12 }),
        makePlayer({ id: 'p2', name: 'Beto', teamId: 1, captured: p2Cards, escobas: 1, score: 16 }),
        makePlayer({ id: 'p3', name: 'Carlos', teamId: 0, captured: p3Cards, escobas: 0, score: 12 }),
        makePlayer({ id: 'p4', name: 'Dani', teamId: 1, captured: p4Cards, escobas: 1, score: 16 }),
      ],
      round: 3,
      targetScore: 21,
    });

    expect(result.phase).toBe('game_over');
    expect(result.isTiebreaker).toBe(false);
    expect(result.winnerId).toBeNull();
    expect(result.winnerTeamId).toBe(1);
    expect(result.summary.winnerId).toBeNull();
    expect(result.summary.winnerTeamId).toBe(1);

    expect(result.summary.participants).toEqual([
      {
        participantId: 'team-0',
        label: 'Ana y Carlos',
        teamId: 0,
        playerIds: ['p1', 'p3'],
        escobas: 1,
        sieteDeOros: 0,
        sietes: 0,
        oros: 0,
        cartas: 0,
        roundTotal: 1,
        totalScore: 13,
        totalCardsCount: 17,
        orosCount: 3,
        sietesCount: 0,
      },
      {
        participantId: 'team-1',
        label: 'Beto y Dani',
        teamId: 1,
        playerIds: ['p2', 'p4'],
        escobas: 2,
        sieteDeOros: 1,
        sietes: 1,
        oros: 1,
        cartas: 1,
        roundTotal: 6,
        totalScore: 22,
        totalCardsCount: 23,
        orosCount: 7,
        sietesCount: 4,
      },
    ]);
    expect(result.players.map((p) => p.score)).toEqual([13, 22, 13, 22]);
  });

  it('resuelve game_over a 15 puntos y activa round_end con isTiebreaker ante empate >= targetScore a 21 puntos', () => {
    const deck = createDeck();
    const { picked: p1Cards, rest: p2Cards } = pickCards(
      deck,
      deck.filter((c) => c.suit === 'oros').map((c) => c.id),
    );

    const winAt15 = scoreRound({
      players: [
        makePlayer({ id: 'p1', name: 'Ana', captured: p1Cards, escobas: 0, score: 14 }),
        makePlayer({ id: 'p2', name: 'Beto', captured: p2Cards, escobas: 0, score: 10 }),
      ],
      round: 4,
      targetScore: 15,
    });

    expect(winAt15.phase).toBe('game_over');
    expect(winAt15.isTiebreaker).toBe(false);
    expect(winAt15.winnerId).toBe('p1');
    expect(winAt15.winnerTeamId).toBeNull();

    // Empate exacto en la cima >= 21: p1 (20 + 2 = 22) vs p2 (20 + 2 = 22)
    // p1 gana oros (1 vs 0) + 1 escoba = 2; p2 gana cartas (2 vs 1) + 1 escoba = 2
    const tieAt21 = scoreRound({
      players: [
        makePlayer({
          id: 'p1',
          name: 'Ana',
          captured: deck.filter((c) => c.id === 'oros-1'),
          escobas: 1,
          score: 20,
        }),
        makePlayer({
          id: 'p2',
          name: 'Beto',
          captured: deck.filter((c) => c.id === 'copas-1' || c.id === 'espadas-1'),
          escobas: 1,
          score: 20,
        }),
      ],
      round: 5,
      targetScore: 21,
    });

    expect(tieAt21.phase).toBe('round_end');
    expect(tieAt21.isTiebreaker).toBe(true);
    expect(tieAt21.winnerId).toBeNull();
    expect(tieAt21.winnerTeamId).toBeNull();
    expect(tieAt21.summary.isTiebreaker).toBe(true);
    expect(tieAt21.summary.winnerId).toBeNull();
    expect(tieAt21.summary.winnerTeamId).toBeNull();
    expect(tieAt21.players.map((p) => p.score)).toEqual([22, 22]);
  });
});
