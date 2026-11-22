import { describe, expect, it } from 'vitest';
import { createDeck } from './deck';
import { createGame } from './engine';

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
});
