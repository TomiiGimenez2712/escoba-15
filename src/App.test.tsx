import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDeck } from '../shared/deck';
import { createGame } from '../shared/engine';
import type { Card } from '../shared/types';
import App from './App';
import { GameTable } from './components/GameTable';

function buildDeckWithPrefix(prefixIds: string[]): Card[] {
  const base = createDeck();
  const byId = new Map(base.map((card) => [card.id, card]));
  const prefix = prefixIds.map((id) => {
    const card = byId.get(id);
    if (!card) throw new Error(`Missing card ${id}`);
    return card;
  });
  const used = new Set(prefixIds);
  return [...prefix, ...base.filter((card) => !used.has(card.id))];
}

describe('App — flujo inicial y mesa de juego', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('muestra la pantalla inicial y al hacer clic en "Jugar" renderiza la mesa completa', async () => {
    // Con Math.random en 0.99, Fisher-Yates mantiene el mazo base:
    // jugador (1,2,3 oros), rival (4,5,6 oros), mesa (7,10,11,12 oros -> suma 34, sin escoba de mano).
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const user = userEvent.setup();

    render(<App />);

    expect(screen.getByRole('heading', { name: /escoba del 15/i })).toBeInTheDocument();
    const playButton = screen.getByRole('button', { name: /jugar/i });
    expect(playButton).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /mesa/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/de oros/i)).not.toBeInTheDocument();

    await user.click(playButton);

    expect(screen.queryByRole('button', { name: /jugar/i })).not.toBeInTheDocument();

    const playerHand = screen.getByRole('region', { name: /tu mano/i });
    expect(within(playerHand).getAllByLabelText(/de (oros|copas|espadas|bastos)/i)).toHaveLength(3);
    expect(within(playerHand).getByLabelText(/1 de oros/i)).toBeInTheDocument();
    expect(within(playerHand).getByLabelText(/2 de oros/i)).toBeInTheDocument();
    expect(within(playerHand).getByLabelText(/3 de oros/i)).toBeInTheDocument();

    const tableZone = screen.getByRole('region', { name: /mesa/i });
    expect(within(tableZone).getAllByLabelText(/de (oros|copas|espadas|bastos)/i)).toHaveLength(4);
    expect(within(tableZone).getByLabelText(/7 de oros/i)).toBeInTheDocument();
    expect(within(tableZone).getByLabelText(/10 de oros/i)).toBeInTheDocument();
    expect(within(tableZone).getByLabelText(/11 de oros/i)).toBeInTheDocument();
    expect(within(tableZone).getByLabelText(/12 de oros/i)).toBeInTheDocument();

    const deckZone = screen.getByRole('region', { name: /mazo/i });
    expect(within(deckZone).getByText(/\b30\b/)).toBeInTheDocument();

    const opponentHand = screen.getByRole('region', { name: /rival/i });
    expect(within(opponentHand).getAllByLabelText(/dorso|carta oculta/i)).toHaveLength(3);
    expect(opponentHand).not.toHaveTextContent(/oros|copas|espadas|bastos|[456]/i);
    expect(within(opponentHand).queryByLabelText(/oros|copas|espadas|bastos|[456]/i)).not.toBeInTheDocument();
  });

  it('renderiza cartas españolas SVG con los 4 palos y figuras, y muestra aviso de Escoba de mano con mesa vacía', () => {
    const players = [
      { id: 'p1', name: 'Tú' },
      { id: 'p2', name: 'Bot', isBot: true },
    ];

    const cardsGame = createGame({
      players,
      deck: buildDeckWithPrefix([
        'oros-10',
        'copas-11',
        'espadas-12',
        'oros-1',
        'oros-2',
        'oros-3',
        'bastos-7',
        'bastos-10',
        'copas-12',
        'espadas-11',
      ]),
    });

    const { rerender } = render(<GameTable game={cardsGame} />);

    const expectedFigures = [
      { label: /10 de oros/i, number: '10', figure: /sota/i, suit: 'oros' },
      { label: /11 de copas/i, number: '11', figure: /caballo/i, suit: 'copas' },
      { label: /12 de espadas/i, number: '12', figure: /rey/i, suit: 'espadas' },
    ];

    for (const item of expectedFigures) {
      const cardEl = screen.getByLabelText(item.label);
      expect(within(cardEl).getByText(item.number)).toBeInTheDocument();
      expect(within(cardEl).getByText(item.figure)).toBeInTheDocument();
      expect(cardEl.querySelector(`svg[data-suit-svg="${item.suit}"]`)).toBeInTheDocument();
      expect(cardEl.querySelector('svg.spanish-card__pinta')).toBeInTheDocument();
    }

    const bastosCard = screen.getByLabelText(/7 de bastos/i);
    expect(within(bastosCard).getByText('7')).toBeInTheDocument();
    expect(bastosCard.querySelector('svg[data-suit-svg="bastos"]')).toBeInTheDocument();
    expect(screen.queryByText(/escoba de mano/i)).not.toBeInTheDocument();

    const escoba1Game = createGame({
      players,
      deck: buildDeckWithPrefix([
        'oros-10',
        'copas-11',
        'espadas-12',
        'oros-2',
        'oros-3',
        'oros-4',
        'bastos-1',
        'oros-1',
        'copas-6',
        'espadas-7',
      ]),
    });
    expect(escoba1Game.escobaDeMano).toBe(1);

    rerender(<GameTable game={escoba1Game} />);
    expect(screen.getByRole('status')).toHaveTextContent(/escoba de mano/i);
    expect(
      within(screen.getByRole('region', { name: /mesa/i })).queryAllByLabelText(
        /de (oros|copas|espadas|bastos)/i,
      ),
    ).toHaveLength(0);

    const escoba2Game = createGame({
      players,
      deck: buildDeckWithPrefix([
        'oros-1',
        'oros-2',
        'oros-3',
        'oros-4',
        'copas-1',
        'copas-2',
        'oros-12',
        'copas-5',
        'espadas-11',
        'bastos-6',
      ]),
    });
    expect(escoba2Game.escobaDeMano).toBe(2);

    rerender(<GameTable game={escoba2Game} />);
    expect(screen.getByRole('status')).toHaveTextContent(/escoba de mano/i);
    expect(
      within(screen.getByRole('region', { name: /mesa/i })).queryAllByLabelText(
        /de (oros|copas|espadas|bastos)/i,
      ),
    ).toHaveLength(0);
  });
});
