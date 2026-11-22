import { describe, expect, it } from 'vitest';
import { chooseAiMove } from './ai';
import { createDeck, getCardValue } from './deck';
import { createGame, playCard } from './engine';
import type { Card, CardNumber, GameState, Player, Suit } from './types';

function makeCard(suit: Suit, number: CardNumber): Card {
  return {
    id: `${suit}-${number}`,
    suit,
    number,
    value: getCardValue(number),
  };
}

function makePlayingState(overrides: {
  botHand: Card[];
  table: Card[];
  humanHand?: Card[];
  currentPlayerIndex?: number;
  phase?: GameState['phase'];
  deck?: Card[];
}): GameState {
  const base = createGame({
    players: [
      { id: 'human', name: 'Tú' },
      { id: 'bot', name: 'Bot', isBot: true },
    ],
    dealerIndex: 0,
    deck: createDeck(),
  });

  const players: Player[] = [
    {
      ...base.players[0],
      hand: overrides.humanHand ?? [makeCard('espadas', 1)],
    },
    {
      ...base.players[1],
      hand: overrides.botHand,
    },
  ];

  return {
    ...base,
    players,
    table: overrides.table,
    deck: overrides.deck ?? [],
    currentPlayerIndex: overrides.currentPlayerIndex ?? 1,
    phase: overrides.phase ?? 'playing',
  };
}

describe('shared/ai — validaciones de chooseAiMove', () => {
  it('lanza Error sin mutar el estado ante fase inválida, turno ajeno, mano vacía o dificultad inválida', () => {
    const validState = makePlayingState({
      botHand: [makeCard('bastos', 5)],
      table: [makeCard('copas', 10)],
    });

    const wrongPhaseState: GameState = { ...validState, phase: 'round_end' };
    const wrongPhaseSnapshot = structuredClone(wrongPhaseState);
    expect(() => chooseAiMove(wrongPhaseState, 'bot', 'medio')).toThrow();
    expect(wrongPhaseState).toEqual(wrongPhaseSnapshot);

    const wrongTurnState: GameState = { ...validState, currentPlayerIndex: 0 };
    const wrongTurnSnapshot = structuredClone(wrongTurnState);
    expect(() => chooseAiMove(wrongTurnState, 'bot', 'medio')).toThrow();
    expect(wrongTurnState).toEqual(wrongTurnSnapshot);

    const emptyHandState = makePlayingState({
      botHand: [],
      table: [makeCard('copas', 10)],
    });
    const emptyHandSnapshot = structuredClone(emptyHandState);
    expect(() => chooseAiMove(emptyHandState, 'bot', 'medio')).toThrow();
    expect(emptyHandState).toEqual(emptyHandSnapshot);

    const validSnapshot = structuredClone(validState);
    expect(() => chooseAiMove(validState, 'bot', 'imposible' as never)).toThrow();
    expect(validState).toEqual(validSnapshot);
  });
});

describe('shared/ai — nivel facil', () => {
  it('descarta válidamente cuando no hay capturas posibles', () => {
    const state = makePlayingState({
      botHand: [makeCard('bastos', 2), makeCard('espadas', 4)],
      table: [makeCard('copas', 3)],
    });

    const action = chooseAiMove(state, 'bot', 'facil', () => 0.75);
    expect(action).toEqual({ type: 'discard', cardId: 'espadas-4' });

    const next = playCard(state, 'bot', action);
    expect(next.lastAction?.type).toBe('discard');
  });

  it('ante capturas sin Escoba puede optar por descarte con rng bajo o por captura con rng alto', () => {
    const state = makePlayingState({
      botHand: [makeCard('bastos', 5), makeCard('espadas', 3)],
      table: [makeCard('copas', 12), makeCard('oros', 1)],
    });

    const lowRngAction = chooseAiMove(state, 'bot', 'facil', () => 0.1);
    expect(lowRngAction.type).toBe('discard');
    expect(['bastos-5', 'espadas-3']).toContain(lowRngAction.cardId);

    const highRngAction = chooseAiMove(state, 'bot', 'facil', () => 0.9);
    expect(highRngAction).toEqual({
      type: 'capture',
      cardId: 'bastos-5',
      tableCardIds: ['copas-12'],
    });
  });

  it('captura formando Escoba cuando hay una Escoba disponible', () => {
    const state = makePlayingState({
      botHand: [makeCard('bastos', 5), makeCard('espadas', 2)],
      table: [makeCard('copas', 12)],
    });

    const action = chooseAiMove(state, 'bot', 'facil', () => 0.05);
    expect(action).toEqual({
      type: 'capture',
      cardId: 'bastos-5',
      tableCardIds: ['copas-12'],
    });

    const next = playCard(state, 'bot', action);
    expect(next.table).toHaveLength(0);
    expect(next.lastAction?.madeEscoba).toBe(true);
  });
});

describe('shared/ai — nivel medio', () => {
  it('prioriza Escoba por encima de 7 de Oros sin Escoba', () => {
    const state = makePlayingState({
      botHand: [makeCard('oros', 7), makeCard('espadas', 5)],
      table: [makeCard('bastos', 10), makeCard('copas', 2)],
    });

    const action = chooseAiMove(state, 'bot', 'medio');
    expect(action.type).toBe('capture');
    if (action.type === 'capture') {
      expect(action.cardId).toBe('espadas-5');
      expect(new Set(action.tableCardIds)).toEqual(new Set(['bastos-10', 'copas-2']));
    }
  });

  it('prioriza capturar el 7 de Oros sobre otro 7 con más Oros y más cartas', () => {
    const state = makePlayingState({
      botHand: [makeCard('bastos', 10), makeCard('copas', 7)],
      table: [
        makeCard('oros', 7),
        makeCard('oros', 3),
        makeCard('oros', 2),
        makeCard('bastos', 3),
      ],
    });

    const action = chooseAiMove(state, 'bot', 'medio');
    expect(action).toEqual({
      type: 'capture',
      cardId: 'bastos-10',
      tableCardIds: ['oros-7'],
    });
  });

  it('prioriza capturar un 7 sobre capturar más Oros y más cartas', () => {
    const state = makePlayingState({
      botHand: [makeCard('bastos', 7), makeCard('copas', 10)],
      table: [
        makeCard('espadas', 10),
        makeCard('oros', 4),
        makeCard('oros', 2),
        makeCard('oros', 1),
      ],
    });

    const action = chooseAiMove(state, 'bot', 'medio');
    expect(action).toEqual({
      type: 'capture',
      cardId: 'bastos-7',
      tableCardIds: ['espadas-10'],
    });
  });

  it('prioriza capturar más Oros sobre capturar mayor cantidad de cartas', () => {
    const state = makePlayingState({
      botHand: [makeCard('bastos', 6)],
      table: [
        makeCard('oros', 11),
        makeCard('bastos', 4),
        makeCard('copas', 3),
        makeCard('espadas', 2),
      ],
    });

    const action = chooseAiMove(state, 'bot', 'medio');
    expect(action).toEqual({
      type: 'capture',
      cardId: 'bastos-6',
      tableCardIds: ['oros-11'],
    });
  });

  it('prioriza capturar la mayor cantidad de cartas en igualdad de criterios superiores', () => {
    const state = makePlayingState({
      botHand: [makeCard('bastos', 6)],
      table: [
        makeCard('bastos', 11),
        makeCard('bastos', 4),
        makeCard('copas', 3),
        makeCard('espadas', 2),
      ],
    });

    const action = chooseAiMove(state, 'bot', 'medio');
    expect(action.type).toBe('capture');
    if (action.type === 'capture') {
      expect(action.cardId).toBe('bastos-6');
      expect(new Set(action.tableCardIds)).toEqual(
        new Set(['bastos-4', 'copas-3', 'espadas-2']),
      );
    }
  });

  it('descarta evitando 7 de Oros, otros 7s, Oros y sumas vulnerables 5..14', () => {
    const emptyTableState = makePlayingState({
      botHand: [
        makeCard('oros', 7),
        makeCard('copas', 7),
        makeCard('oros', 3),
        makeCard('copas', 6),
        makeCard('bastos', 2),
      ],
      table: [],
    });

    expect(chooseAiMove(emptyTableState, 'bot', 'medio')).toEqual({
      type: 'discard',
      cardId: 'bastos-2',
    });

    const avoidVulnerableSumState = makePlayingState({
      botHand: [makeCard('copas', 5), makeCard('espadas', 12)],
      table: [makeCard('bastos', 10)],
    });

    expect(chooseAiMove(avoidVulnerableSumState, 'bot', 'medio')).toEqual({
      type: 'discard',
      cardId: 'espadas-12',
    });
  });
});
