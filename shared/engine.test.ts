import { describe, expect, it } from 'vitest';
import { createDeck } from './deck';
import { createGame, findCaptureCombinations, playCard } from './engine';

describe('shared/engine — createGame', () => {
  it('inicia una partida de 2 jugadores repartiendo 3 cartas c/u, 4 en mesa y 30 en el mazo', () => {
    const deck = createDeck();
    const state = createGame({
      players: [
        { id: 'p1', name: 'Tú' },
        { id: 'p2', name: 'Bot', isBot: true },
      ],
      dealerIndex: 0,
      deck,
    });

    expect(state.players).toHaveLength(2);
    expect(state.players[0].hand).toHaveLength(3);
    expect(state.players[1].hand).toHaveLength(3);
    expect(state.players[0].isBot).toBe(false);
    expect(state.players[1].isBot).toBe(true);
    expect(state.table).toHaveLength(4);
    expect(state.deck).toHaveLength(30);
    expect(state.dealerIndex).toBe(0);
    expect(state.currentPlayerIndex).toBe(1);
    expect(state.targetScore).toBe(15);
    expect(state.escobaDeMano).toBe(0);
    expect(state.lastCapturerId).toBeNull();
  });

  it('asigna equipos alternados en 4 jugadores, deja 24 cartas en mazo y rota el primer turno', () => {
    const deck = createDeck();
    const state = createGame({
      players: [
        { id: 'p1', name: 'Jugador 1' },
        { id: 'p2', name: 'Jugador 2', isBot: true },
        { id: 'p3', name: 'Jugador 3', isBot: true },
        { id: 'p4', name: 'Jugador 4', isBot: true },
      ],
      targetScore: 21,
      dealerIndex: 3,
      deck,
    });

    expect(state.players.map((p) => p.teamId)).toEqual([0, 1, 0, 1]);
    expect(state.players.every((p) => p.hand.length === 3)).toBe(true);
    expect(state.table).toHaveLength(4);
    expect(state.deck).toHaveLength(24);
    expect(state.targetScore).toBe(21);
    expect(state.currentPlayerIndex).toBe(0);
  });

  it('lanza Error ante cantidad de jugadores, dealerIndex, targetScore o deck inválidos', () => {
    const validPlayers = [
      { id: 'p1', name: 'A' },
      { id: 'p2', name: 'B' },
    ];
    const validDeck = createDeck();

    expect(() => createGame({ players: [{ id: 'p1', name: 'Solo' }] })).toThrow();
    expect(() =>
      createGame({
        players: [
          { id: 'p1', name: '1' },
          { id: 'p2', name: '2' },
          { id: 'p3', name: '3' },
          { id: 'p4', name: '4' },
          { id: 'p5', name: '5' },
        ],
      }),
    ).toThrow();

    expect(() => createGame({ players: validPlayers, dealerIndex: -1 })).toThrow();
    expect(() => createGame({ players: validPlayers, dealerIndex: 2 })).toThrow();
    expect(() => createGame({ players: validPlayers, targetScore: 30 as never })).toThrow();

    expect(() => createGame({ players: validPlayers, deck: validDeck.slice(0, 39) })).toThrow();

    const duplicatedDeck = [...validDeck.slice(0, 39), validDeck[0]];
    expect(() => createGame({ players: validPlayers, deck: duplicatedDeck })).toThrow();
  });

  it('detecta Escoba de mano de 15 asignando las 4 cartas de la mesa al repartidor', () => {
    const baseDeck = createDeck();
    const tableIds = ['oros-1', 'oros-2', 'oros-5', 'oros-7'];
    const tableCards = tableIds.map((id) => baseDeck.find((c) => c.id === id)!);
    const otherCards = baseDeck.filter((c) => !tableIds.includes(c.id));
    const deck = [...otherCards.slice(0, 6), ...tableCards, ...otherCards.slice(6)];

    const state = createGame({
      players: [
        { id: 'p1', name: 'Tú' },
        { id: 'p2', name: 'Bot', isBot: true },
      ],
      dealerIndex: 1,
      deck,
    });

    expect(state.escobaDeMano).toBe(1);
    expect(state.table).toEqual([]);
    expect(state.lastCapturerId).toBe('p2');
    expect(state.players[1].escobas).toBe(1);
    expect(state.players[1].captured).toEqual(tableCards);
  });

  it('detecta Escoba de mano de 30 solo cuando las 4 cartas se particionan en dos grupos de 15', () => {
    const buildDeckWithTable = (tableIds: string[]) => {
      const baseDeck = createDeck();
      const tableCards = tableIds.map((id) => baseDeck.find((c) => c.id === id)!);
      const otherCards = baseDeck.filter((c) => !tableIds.includes(c.id));
      return {
        tableCards,
        deck: [...otherCards.slice(0, 6), ...tableCards, ...otherCards.slice(6)],
      };
    };

    const players = [
      { id: 'p1', name: 'Tú' },
      { id: 'p2', name: 'Bot', isBot: true },
    ];

    const valid30 = buildDeckWithTable(['oros-12', 'oros-5', 'copas-11', 'copas-6']);
    const validState = createGame({ players, dealerIndex: 0, deck: valid30.deck });

    expect(validState.escobaDeMano).toBe(2);
    expect(validState.table).toEqual([]);
    expect(validState.lastCapturerId).toBe('p1');
    expect(validState.players[0].escobas).toBe(2);
    expect(validState.players[0].captured).toEqual(valid30.tableCards);

    const invalid30 = buildDeckWithTable(['oros-12', 'oros-11', 'oros-10', 'oros-3']);
    const invalidState = createGame({ players, dealerIndex: 0, deck: invalid30.deck });

    expect(invalidState.escobaDeMano).toBe(0);
    expect(invalidState.table).toEqual(invalid30.tableCards);
    expect(invalidState.players[0].captured).toEqual([]);
    expect(invalidState.players[0].escobas).toBe(0);
    expect(invalidState.lastCapturerId).toBeNull();
  });
});

describe('shared/engine — findCaptureCombinations', () => {
  it('detecta 0, 1 y múltiples combinaciones que suman 15 sin mutar las entradas', () => {
    const deck = createDeck();
    const card = (id: string) => deck.find((c) => c.id === id)!;

    const handCard = card('oros-5'); // value: 5
    const doceCopas = card('copas-12'); // value: 10
    const cuatroOros = card('oros-4'); // value: 4
    const seisCopas = card('copas-6'); // value: 6
    const unoEspadas = card('espadas-1'); // value: 1

    expect(findCaptureCombinations(handCard, [])).toEqual([]);
    expect(findCaptureCombinations(handCard, [cuatroOros, unoEspadas])).toEqual([]);

    expect(findCaptureCombinations(handCard, [doceCopas, unoEspadas])).toEqual([[doceCopas]]);
    expect(findCaptureCombinations(handCard, [cuatroOros, seisCopas, unoEspadas])).toEqual([
      [cuatroOros, seisCopas],
    ]);

    const table = [doceCopas, cuatroOros, seisCopas];
    const tableSnapshot = table.map((c) => ({ ...c }));
    const handSnapshot = { ...handCard };

    expect(findCaptureCombinations(handCard, table)).toEqual([
      [doceCopas],
      [cuatroOros, seisCopas],
    ]);
    expect(table).toEqual(tableSnapshot);
    expect(handCard).toEqual(handSnapshot);
  });
});

describe('shared/engine — playCard', () => {
  it('ejecuta captura normal, descarte con combinaciones disponibles, Escoba al vaciar mesa y mantiene inmutabilidad', () => {
    const baseDeck = createDeck();
    const card = (id: string) => baseDeck.find((c) => c.id === id)!;
    const fixedIds = [
      'oros-5',
      'espadas-4',
      'oros-1',
      'bastos-5',
      'espadas-12',
      'copas-2',
      'copas-12',
      'oros-4',
      'bastos-6',
      'espadas-1',
    ];
    const deck = [
      ...fixedIds.map(card),
      ...baseDeck.filter((c) => !fixedIds.includes(c.id)),
    ];

    const state0 = createGame({
      players: [
        { id: 'p1', name: 'Tú' },
        { id: 'p2', name: 'Bot', isBot: true },
      ],
      dealerIndex: 1,
      deck,
    });
    expect(state0.lastAction).toBeNull();
    const snapshot0 = structuredClone(state0);

    // 1) Captura normal (deja cartas en mesa) sin mutar state0
    const state1 = playCard(state0, 'p1', {
      type: 'capture',
      cardId: 'oros-5',
      tableCardIds: ['copas-12'],
    });
    expect(state0).toEqual(snapshot0);
    expect(state1.players[0].hand.map((c) => c.id)).toEqual(['espadas-4', 'oros-1']);
    expect(state1.players[0].captured).toHaveLength(2);
    expect(state1.players[0].captured).toEqual(
      expect.arrayContaining([card('oros-5'), card('copas-12')]),
    );
    expect(state1.players[0].escobas).toBe(0);
    expect(state1.table.map((c) => c.id)).toEqual(['oros-4', 'bastos-6', 'espadas-1']);
    expect(state1.lastCapturerId).toBe('p1');
    expect(state1.currentPlayerIndex).toBe(1);
    expect(state1.lastAction).toEqual({
      playerId: 'p1',
      playerName: 'Tú',
      type: 'capture',
      playedCard: card('oros-5'),
      capturedCards: [card('copas-12')],
      madeEscoba: false,
    });

    // 2) Descarte permitido aun existiendo combinación válida (bastos-5 + oros-4 + bastos-6 = 15)
    const state2 = playCard(state1, 'p2', { type: 'discard', cardId: 'bastos-5' });
    expect(state2.players[1].hand.map((c) => c.id)).toEqual(['espadas-12', 'copas-2']);
    expect(state2.table.map((c) => c.id)).toEqual(['oros-4', 'bastos-6', 'espadas-1', 'bastos-5']);
    expect(state2.lastCapturerId).toBe('p1');
    expect(state2.currentPlayerIndex).toBe(0);
    expect(state2.lastAction).toEqual({
      playerId: 'p2',
      playerName: 'Bot',
      type: 'discard',
      playedCard: card('bastos-5'),
      capturedCards: [],
      madeEscoba: false,
    });

    // 3) Captura previa y 4) Captura que vacía la mesa (Escoba)
    const state3 = playCard(state2, 'p1', {
      type: 'capture',
      cardId: 'espadas-4',
      tableCardIds: ['oros-4', 'bastos-6', 'espadas-1'],
    });
    const state4 = playCard(state3, 'p2', {
      type: 'capture',
      cardId: 'espadas-12',
      tableCardIds: ['bastos-5'],
    });
    expect(state4.table).toEqual([]);
    expect(state4.players[1].escobas).toBe(1);
    expect(state4.lastCapturerId).toBe('p2');
    expect(state4.currentPlayerIndex).toBe(0);
    expect(state4.lastAction).toEqual({
      playerId: 'p2',
      playerName: 'Bot',
      type: 'capture',
      playedCard: card('espadas-12'),
      capturedCards: [card('bastos-5')],
      madeEscoba: true,
    });
  });

  it('lanza Error descriptivo sin mutar el estado ante jugadas inválidas', () => {
    const baseDeck = createDeck();
    const card = (id: string) => baseDeck.find((c) => c.id === id)!;
    const fixedIds = [
      'oros-5',
      'espadas-4',
      'oros-1',
      'bastos-12',
      'espadas-12',
      'copas-2',
      'copas-12',
      'bastos-5',
      'oros-4',
      'espadas-1',
    ];
    const deck = [
      ...fixedIds.map(card),
      ...baseDeck.filter((c) => !fixedIds.includes(c.id)),
    ];

    const state = createGame({
      players: [
        { id: 'p1', name: 'Tú' },
        { id: 'p2', name: 'Bot', isBot: true },
      ],
      dealerIndex: 1,
      deck,
    });
    const snapshot = structuredClone(state);

    // No es el turno del jugador (turno actual: p1)
    expect(() => playCard(state, 'p2', { type: 'discard', cardId: 'bastos-12' })).toThrow(/\S/);
    expect(() => playCard(state, 'p2', { type: 'discard', cardId: 'oros-5' })).toThrow(/\S/);
    // La carta jugada no está en la mano del jugador actual
    expect(() => playCard(state, 'p1', { type: 'discard', cardId: 'bastos-12' })).toThrow(/\S/);
    // Captura con tableCardIds vacío
    expect(() =>
      playCard(state, 'p1', { type: 'capture', cardId: 'oros-5', tableCardIds: [] }),
    ).toThrow(/\S/);
    // Captura con tableCardIds duplicados (aun cuando sumarían 15)
    expect(() =>
      playCard(state, 'p1', {
        type: 'capture',
        cardId: 'oros-5',
        tableCardIds: ['bastos-5', 'bastos-5'],
      }),
    ).toThrow(/\S/);
    // Captura con carta ausente en la mesa
    expect(() =>
      playCard(state, 'p1', {
        type: 'capture',
        cardId: 'oros-5',
        tableCardIds: ['espadas-12'],
      }),
    ).toThrow(/\S/);
    // Captura cuya suma total difiere de 15 (5 + 4 = 9)
    expect(() =>
      playCard(state, 'p1', {
        type: 'capture',
        cardId: 'oros-5',
        tableCardIds: ['oros-4'],
      }),
    ).toThrow(/\S/);

    expect(state).toEqual(snapshot);
  });

  it('reparte 3 cartas al vaciarse las manos, asigna sobrantes sin escoba al agotar el mazo, bloquea playCard fuera de playing y maneja lastCapturerId null', () => {
    const deck = createDeck();
    const players = [
      { id: 'p1', name: 'Tú' },
      { id: 'p2', name: 'Bot', isBot: true },
    ];

    const state0 = createGame({ players, dealerIndex: 1, deck });
    expect(state0.phase).toBe('playing');
    expect(state0.roundSummary).toBeNull();
    expect(state0.winnerId).toBeNull();
    expect(state0.winnerTeamId).toBeNull();
    expect(state0.isTiebreaker).toBe(false);

    // Mano 1 (6 jugadas): p1 descarta oros-1, p2 captura oros-5 + oros-12 (15) y el resto descarta
    let state = playCard(state0, 'p1', { type: 'discard', cardId: 'oros-1' });
    state = playCard(state, 'p2', {
      type: 'capture',
      cardId: 'oros-5',
      tableCardIds: ['oros-12'],
    });
    expect(state.lastCapturerId).toBe('p2');

    for (let turn = 0; turn < 4; turn += 1) {
      const current = state.players[state.currentPlayerIndex];
      state = playCard(state, current.id, { type: 'discard', cardId: current.hand[0].id });
    }

    // Al vaciarse todas las manos con deck.length > 0, reparte 3 cartas nuevas a c/u sin tocar table
    expect(state.phase).toBe('playing');
    expect(state.roundSummary).toBeNull();
    expect(state.currentPlayerIndex).toBe(0);
    expect(state.players[0].hand).toEqual(state0.deck.slice(0, 3));
    expect(state.players[1].hand).toEqual(state0.deck.slice(3, 6));
    expect(state.deck).toEqual(state0.deck.slice(6));
    expect(state.table).toHaveLength(8);

    // Completar las 29 jugadas siguientes hasta quedar en la última carta de la ronda (deck.length === 0)
    for (let turn = 0; turn < 29; turn += 1) {
      const current = state.players[state.currentPlayerIndex];
      state = playCard(state, current.id, { type: 'discard', cardId: current.hand[0].id });
    }

    expect(state.deck).toEqual([]);
    expect(state.phase).toBe('playing');
    expect(state.currentPlayerIndex).toBe(1);
    expect(state.players[0].hand).toHaveLength(0);
    expect(state.players[1].hand).toHaveLength(1);

    const lastCard = state.players[1].hand[0];
    const expectedLeftovers = [...state.table, lastCard];
    const endState = playCard(state, 'p2', { type: 'discard', cardId: lastCard.id });

    // Fin de ronda: sobrantes van a lastCapturerId ('p2') sin sumar escobas ni marcar madeEscoba
    expect(endState.table).toEqual([]);
    expect(endState.players[1].escobas).toBe(0);
    expect(endState.lastAction?.madeEscoba).toBe(false);
    expect(endState.players[0].captured).toEqual([]);
    expect(endState.players[1].captured).toHaveLength(40);
    expect(endState.players[1].captured).toEqual(expect.arrayContaining(expectedLeftovers));
    expect(endState.phase).toBe('round_end');
    expect(endState.roundSummary).not.toBeNull();
    expect(endState.roundSummary?.leftoverWinnerId).toBe('p2');
    expect(endState.roundSummary?.leftoverCards).toEqual(expectedLeftovers);

    // Bloqueo de playCard fuera de 'playing' sin mutar el estado
    const endSnapshot = structuredClone(endState);
    expect(() => playCard(endState, 'p1', { type: 'discard', cardId: 'oros-1' })).toThrow(/\S/);
    expect(endState).toEqual(endSnapshot);

    const roundEndWithCards = { ...state0, phase: 'round_end' as const };
    const roundEndSnapshot = structuredClone(roundEndWithCards);
    expect(() =>
      playCard(roundEndWithCards, 'p1', { type: 'discard', cardId: state0.players[0].hand[0].id }),
    ).toThrow(/\S/);
    expect(roundEndWithCards).toEqual(roundEndSnapshot);

    const gameOverWithCards = { ...state0, phase: 'game_over' as const };
    const gameOverSnapshot = structuredClone(gameOverWithCards);
    expect(() =>
      playCard(gameOverWithCards, 'p1', { type: 'discard', cardId: state0.players[0].hand[0].id }),
    ).toThrow(/\S/);
    expect(gameOverWithCards).toEqual(gameOverSnapshot);

    // Caso borde: fin de ronda sin capturas (lastCapturerId === null)
    let noCaptureState = createGame({ players, dealerIndex: 1, deck });
    for (let turn = 0; turn < 36; turn += 1) {
      const current = noCaptureState.players[noCaptureState.currentPlayerIndex];
      noCaptureState = playCard(noCaptureState, current.id, {
        type: 'discard',
        cardId: current.hand[0].id,
      });
    }

    expect(noCaptureState.lastCapturerId).toBeNull();
    expect(noCaptureState.table).toEqual([]);
    expect(noCaptureState.players[0].captured).toEqual([]);
    expect(noCaptureState.players[1].captured).toEqual([]);
    expect(noCaptureState.players[0].escobas).toBe(0);
    expect(noCaptureState.players[1].escobas).toBe(0);
    expect(noCaptureState.phase).toBe('round_end');
    expect(noCaptureState.roundSummary?.leftoverWinnerId).toBeNull();
    expect(noCaptureState.roundSummary?.leftoverCards).toEqual([]);
  });
});
