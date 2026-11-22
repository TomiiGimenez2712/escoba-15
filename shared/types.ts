export type Suit = 'oros' | 'copas' | 'espadas' | 'bastos';

export type CardNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 10 | 11 | 12;

export interface Card {
  id: string;
  suit: Suit;
  number: CardNumber;
  value: number;
}
