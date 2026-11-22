import { describe, expect, it } from 'vitest';
import { createDeck, getCardValue, shuffleDeck } from './deck';

describe('shared/deck', () => {
  it('createDeck() produce 40 cartas únicas de los 4 palos y números válidos sin 8 ni 9', () => {
    const deck = createDeck();
    const expectedSuits = ['oros', 'copas', 'espadas', 'bastos'];
    const expectedNumbers = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];

    expect(deck).toHaveLength(40);
    expect(new Set(deck.map((c) => c.id)).size).toBe(40);

    for (const suit of expectedSuits) {
      const suitNumbers = deck
        .filter((c) => c.suit === suit)
        .map((c) => c.number)
        .sort((a, b) => a - b);
      expect(suitNumbers).toEqual(expectedNumbers);
    }

    expect(deck.some((c) => c.number === (8 as never) || c.number === (9 as never))).toBe(false);
    expect(deck.every((c) => c.id === `${c.suit}-${c.number}` && c.value === getCardValue(c.number))).toBe(true);
  });

  it('getCardValue() mapea valores de Escoba del 15 y lanza Error ante números inválidos', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map((n) => getCardValue(n as never))).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(getCardValue(10)).toBe(8);
    expect(getCardValue(11)).toBe(9);
    expect(getCardValue(12)).toBe(10);

    expect(() => getCardValue(8 as never)).toThrow();
    expect(() => getCardValue(9 as never)).toThrow();
  });

  it('shuffleDeck() devuelve un nuevo arreglo con las mismas 40 cartas únicas sin mutar el original', () => {
    const deck = createDeck();
    const snapshot = deck.map((c) => ({ ...c }));

    const shuffled = shuffleDeck(deck);

    expect(shuffled).not.toBe(deck);
    expect(shuffled).toHaveLength(40);
    expect(shuffled.map((c) => c.id).sort()).toEqual(snapshot.map((c) => c.id).sort());
    expect(deck).toEqual(snapshot);
  });
});
