import type { Card, CardNumber, Suit } from './types';

const SUITS: readonly Suit[] = ['oros', 'copas', 'espadas', 'bastos'];
const CARD_NUMBERS: readonly CardNumber[] = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];

const CARD_VALUES = new Map<number, number>([
  [1, 1],
  [2, 2],
  [3, 3],
  [4, 4],
  [5, 5],
  [6, 6],
  [7, 7],
  [10, 8],
  [11, 9],
  [12, 10],
]);

/** Devuelve el valor de una carta en Escoba del 15 o lanza Error si el número es inválido. */
export function getCardValue(number: CardNumber): number {
  const value = CARD_VALUES.get(number);
  if (value === undefined) {
    throw new Error(`Invalid card number: ${number}`);
  }
  return value;
}

/** Crea una baraja española ordenada de 40 cartas únicas (sin 8 ni 9). */
export function createDeck(): Card[] {
  const deck: Card[] = [];

  for (const suit of SUITS) {
    for (const number of CARD_NUMBERS) {
      deck.push({
        id: `${suit}-${number}`,
        suit,
        number,
        value: getCardValue(number),
      });
    }
  }

  return deck;
}

/** Devuelve un nuevo arreglo con las mismas cartas mezcladas usando Fisher-Yates sin mutar el original. */
export function shuffleDeck(deck: readonly Card[]): Card[] {
  const shuffled = [...deck];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}
