import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDeck } from '../shared/deck';
import { createGame, playCard } from '../shared/engine';
import type { Card, GameState, PlayerGameView, RoomSnapshot } from '../shared/types';
import App from './App';
import { GameTable } from './components/GameTable';

type SocketListener = (...args: unknown[]) => void;

const { mockIo, fakeSocket, resetFakeSocket, triggerServerEvent } = vi.hoisted(() => {
  const listeners = new Map<string, Set<SocketListener>>();

  const socket = {
    on: vi.fn((event: string, listener: SocketListener) => {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event)!.add(listener);
      return socket;
    }),
    off: vi.fn((event: string, listener?: SocketListener) => {
      if (!listener) {
        listeners.delete(event);
      } else {
        listeners.get(event)?.delete(listener);
      }
      return socket;
    }),
    emit: vi.fn(),
    disconnect: vi.fn(),
  };

  const ioFn = vi.fn(() => socket);

  const reset = () => {
    listeners.clear();
    socket.on.mockClear();
    socket.off.mockClear();
    socket.emit.mockClear();
    socket.disconnect.mockClear();
    ioFn.mockClear();
  };

  const trigger = (event: string, ...args: unknown[]) => {
    for (const listener of listeners.get(event) ?? []) {
      listener(...args);
    }
  };

  return {
    mockIo: ioFn,
    fakeSocket: socket,
    resetFakeSocket: reset,
    triggerServerEvent: trigger,
  };
});

vi.mock('socket.io-client', () => ({
  io: mockIo,
  default: mockIo,
}));

function pickCards(ids: string[]): Card[] {
  const byId = new Map(createDeck().map((card) => [card.id, card]));
  return ids.map((id) => {
    const card = byId.get(id);
    if (!card) throw new Error(`Missing card ${id}`);
    return card;
  });
}

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
    vi.useRealTimers();
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

  it('permite seleccionar carta, elegir entre 0/1/>1 combinaciones, descartar, capturar y mostrar ¡ESCOBA!', async () => {
    const user = userEvent.setup();
    const onPlayAction = vi.fn();

    const game = createGame({
      dealerIndex: 1,
      players: [
        { id: 'p1', name: 'Tú' },
        { id: 'p2', name: 'Bot', isBot: true },
      ],
      deck: buildDeckWithPrefix([
        'oros-3',
        'oros-11',
        'oros-5',
        'bastos-1',
        'bastos-3',
        'bastos-4',
        'copas-12',
        'oros-4',
        'copas-6',
        'espadas-7',
      ]),
    });

    const { rerender } = render(
      <GameTable game={game} localPlayerId="p1" onPlayAction={onPlayAction} />,
    );

    const rivalZone = screen.getByRole('region', { name: /rival/i });
    const turnIndicator = screen.getByText(/turno/i);
    expect(turnIndicator).toHaveTextContent(/tú/i);
    expect(rivalZone).not.toContainElement(turnIndicator);

    const playerHand = screen.getByRole('region', { name: /tu mano/i });
    const handButtons = within(playerHand).getAllByRole('button');
    expect(handButtons).toHaveLength(3);
    for (const button of handButtons) {
      expect(button).toHaveAttribute('type', 'button');
    }

    const tableZone = screen.getByRole('region', { name: /mesa/i });

    // 0 combinaciones: 3 de oros contra {12 copas, 4 oros, 6 copas, 7 espadas}
    const card3 = within(playerHand).getByRole('button', { name: '3 de oros' });
    await user.click(card3);
    expect(card3).toHaveAttribute('data-selected', 'true');
    expect(screen.queryByRole('button', { name: /levantar/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /tirar a la mesa/i }));
    expect(onPlayAction).toHaveBeenCalledWith({ type: 'discard', cardId: 'oros-3' });

    // 1 combinación: 11 de oros (9) + 6 de copas (6) = 15
    await user.click(within(playerHand).getByRole('button', { name: '11 de oros' }));
    expect(within(tableZone).getByLabelText('6 de copas')).toHaveAttribute('data-highlighted', 'true');
    expect(within(tableZone).getByLabelText('12 de copas')).not.toHaveAttribute('data-highlighted', 'true');
    expect(screen.getByRole('button', { name: /levantar \(15\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tirar a la mesa/i })).toBeInTheDocument();

    // >1 combinaciones: 5 de oros con [12 copas] y [4 oros, 6 copas]
    await user.click(within(playerHand).getByRole('button', { name: '5 de oros' }));
    expect(within(tableZone).getByLabelText('12 de copas')).toHaveAttribute('data-highlighted', 'true');
    expect(within(tableZone).getByLabelText('4 de oros')).not.toHaveAttribute('data-highlighted', 'true');

    expect(screen.getByRole('button', { name: /12 de copas/i })).toBeInTheDocument();
    const secondComboChip = screen.getByRole('button', { name: /4 de oros.*6 de copas/i });
    await user.click(secondComboChip);

    expect(within(tableZone).getByLabelText('12 de copas')).not.toHaveAttribute('data-highlighted', 'true');
    expect(within(tableZone).getByLabelText('4 de oros')).toHaveAttribute('data-highlighted', 'true');
    expect(within(tableZone).getByLabelText('6 de copas')).toHaveAttribute('data-highlighted', 'true');

    await user.click(screen.getByRole('button', { name: /levantar \(15\)/i }));
    expect(onPlayAction).toHaveBeenCalledWith({
      type: 'capture',
      cardId: 'oros-5',
      tableCardIds: ['oros-4', 'copas-6'],
    });

    // Estado con lastAction.madeEscoba === true
    const escobaState = playCard(
      { ...game, table: [game.table[0]] },
      'p1',
      { type: 'capture', cardId: 'oros-5', tableCardIds: ['copas-12'] },
    );

    rerender(<GameTable game={escobaState} localPlayerId="p1" onPlayAction={onPlayAction} />);
    expect(screen.getByText(/¡ESCOBA!/)).toBeInTheDocument();
    expect(screen.getByText(/5 de oros/i)).toBeInTheDocument();
    expect(screen.getByText(/12 de copas/i)).toBeInTheDocument();
  });

  it('permite jugar una carta en turno humano desde App y pasa el turno a Bot con la mano deshabilitada', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const user = userEvent.setup();

    render(<App />);
    await user.click(screen.getByRole('button', { name: /jugar/i }));

    expect(screen.getByText(/turno:\s*tú/i)).toBeInTheDocument();

    const playerHand = screen.getByRole('region', { name: /tu mano/i });
    const tableZone = screen.getByRole('region', { name: /mesa/i });
    expect(within(playerHand).getAllByRole('button')).toHaveLength(3);
    expect(within(tableZone).getAllByLabelText(/de (oros|copas|espadas|bastos)/i)).toHaveLength(4);

    await user.click(within(playerHand).getByRole('button', { name: '1 de oros' }));
    await user.click(screen.getByRole('button', { name: /tirar a la mesa/i }));

    const remainingHandButtons = within(playerHand).getAllByRole('button');
    expect(remainingHandButtons).toHaveLength(2);
    for (const button of remainingHandButtons) {
      expect(button).toBeDisabled();
    }

    expect(within(tableZone).getAllByLabelText(/de (oros|copas|espadas|bastos)/i)).toHaveLength(5);
    expect(within(tableZone).getByLabelText('1 de oros')).toBeInTheDocument();
    expect(screen.getByText(/tú tiró 1 de oros/i)).toBeInTheDocument();
    expect(screen.getByText(/turno:\s*bot/i)).toBeInTheDocument();
  });

  it('muestra RoundSummaryModal en round_end con desempate, inicia siguiente ronda y reinicia con revancha en game_over', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const user = userEvent.setup();

    const tiebreakerInitialGame: GameState = {
      players: [
        {
          id: 'player-1',
          name: 'Tú',
          isBot: false,
          hand: pickCards(['oros-5']),
          captured: pickCards(['oros-7', 'copas-7', 'oros-1', 'oros-2', 'oros-3', 'copas-1', 'copas-2']),
          escobas: 0,
          score: 12,
        },
        {
          id: 'bot-1',
          name: 'Bot',
          isBot: true,
          hand: [],
          captured: pickCards([
            'espadas-7',
            'bastos-7',
            'copas-3',
            'copas-4',
            'copas-5',
            'copas-6',
            'espadas-1',
            'espadas-2',
            'espadas-3',
            'espadas-4',
          ]),
          escobas: 1,
          score: 13,
        },
      ],
      table: pickCards(['copas-12']),
      deck: [],
      dealerIndex: 0,
      currentPlayerIndex: 0,
      lastCapturerId: 'bot-1',
      lastAction: null,
      targetScore: 15,
      round: 2,
      escobaDeMano: 0,
      phase: 'playing',
      roundSummary: null,
      winnerId: null,
      winnerTeamId: null,
      isTiebreaker: false,
    };

    const { unmount } = render(<App initialGame={tiebreakerInitialGame} />);

    await user.click(within(screen.getByRole('region', { name: /tu mano/i })).getByRole('button', { name: '5 de oros' }));
    await user.click(screen.getByRole('button', { name: /levantar \(15\)/i }));

    const tieDialog = screen.getByRole('dialog');
    const summaryTable = within(tieDialog).getByRole('table');
    expect(within(summaryTable).getByText(/escobas/i)).toBeInTheDocument();
    expect(within(summaryTable).getByText(/7 de oros/i)).toBeInTheDocument();
    expect(within(summaryTable).getByText(/sietes/i)).toBeInTheDocument();
    expect(within(summaryTable).getByText(/^oros$/i)).toBeInTheDocument();
    expect(within(summaryTable).getByText(/cartas/i)).toBeInTheDocument();
    expect(within(summaryTable).getByText(/tú/i)).toBeInTheDocument();
    expect(within(summaryTable).getByText(/bot/i)).toBeInTheDocument();
    expect(within(summaryTable).getAllByText('3').length).toBeGreaterThan(0);
    expect(within(summaryTable).getAllByText('2').length).toBeGreaterThan(0);
    expect(within(summaryTable).getAllByText('15')).toHaveLength(2);
    expect(within(tieDialog).getByText(/desempate/i)).toBeInTheDocument();

    await user.click(within(tieDialog).getByRole('button', { name: /siguiente ronda/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: /tu mano/i })).getAllByRole('button')).toHaveLength(3);
    expect(within(screen.getByRole('region', { name: /rival/i })).getAllByLabelText(/dorso|carta oculta/i)).toHaveLength(3);
    expect(within(screen.getByRole('region', { name: /mazo/i })).getByText(/\b30\b/)).toBeInTheDocument();
    expect(screen.getByText(/turno:\s*tú/i)).toBeInTheDocument();

    unmount();

    const gameOverInitialGame: GameState = {
      players: [
        {
          id: 'player-1',
          name: 'Tú',
          isBot: false,
          hand: pickCards(['oros-5']),
          captured: pickCards(['oros-7', 'oros-1', 'oros-2']),
          escobas: 0,
          score: 14,
        },
        {
          id: 'bot-1',
          name: 'Bot',
          isBot: true,
          hand: [],
          captured: pickCards(['copas-1', 'copas-2']),
          escobas: 0,
          score: 10,
        },
      ],
      table: pickCards(['copas-12']),
      deck: [],
      dealerIndex: 1,
      currentPlayerIndex: 0,
      lastCapturerId: 'player-1',
      lastAction: null,
      targetScore: 15,
      round: 3,
      escobaDeMano: 0,
      phase: 'playing',
      roundSummary: null,
      winnerId: null,
      winnerTeamId: null,
      isTiebreaker: false,
    };

    render(<App initialGame={gameOverInitialGame} />);

    await user.click(within(screen.getByRole('region', { name: /tu mano/i })).getByRole('button', { name: '5 de oros' }));
    await user.click(screen.getByRole('button', { name: /levantar \(15\)/i }));

    const gameOverDialog = screen.getByRole('dialog');
    expect(within(gameOverDialog).getByText(/ganó|ganador|victoria/i)).toBeInTheDocument();
    expect(within(gameOverDialog).getAllByText(/tú/i).length).toBeGreaterThan(0);

    await user.click(within(gameOverDialog).getByRole('button', { name: /jugar revancha/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: /tu mano/i })).getAllByRole('button')).toHaveLength(3);
    expect(within(screen.getByRole('region', { name: /rival/i })).getAllByLabelText(/dorso|carta oculta/i)).toHaveLength(3);
    expect(within(screen.getByRole('region', { name: /mazo/i })).getByText(/\b30\b/)).toBeInTheDocument();
    expect(screen.queryByText(/levantó/i)).not.toBeInTheDocument();
  });

  it('muestra HomeScreen con selectores por defecto, permite cambiar dificultad y ejecuta el turno del bot tras 650ms', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<App />);

    expect(screen.getByRole('heading', { name: /escoba del 15/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /medio/i })).toBeChecked();
    expect(screen.getByRole('radio', { name: /2 jugadores \(1v1\)/i })).toBeChecked();
    expect(screen.getByRole('radio', { name: /15 puntos/i })).toBeChecked();
    const playButton = screen.getByRole('button', { name: /jugar/i });
    expect(playButton).toBeInTheDocument();

    const hardRadio = screen.getByRole('radio', { name: /difícil/i });
    await user.click(hardRadio);
    expect(hardRadio).toBeChecked();

    await user.click(playButton);

    expect(screen.getByText(/turno:\s*tú/i)).toBeInTheDocument();

    const playerHand = screen.getByRole('region', { name: /tu mano/i });
    const rivalZone = screen.getByRole('region', { name: /rival/i });

    await user.click(within(playerHand).getByRole('button', { name: '1 de oros' }));
    await user.click(screen.getByRole('button', { name: /tirar a la mesa/i }));

    expect(screen.getByText(/turno:\s*bot/i)).toBeInTheDocument();
    expect(screen.getByText(/tú tiró 1 de oros/i)).toBeInTheDocument();
    expect(within(rivalZone).getAllByLabelText(/dorso|carta oculta/i)).toHaveLength(3);

    const handButtonsWhileBotThinks = within(playerHand).getAllByRole('button');
    expect(handButtonsWhileBotThinks).toHaveLength(2);
    for (const button of handButtonsWhileBotThinks) {
      expect(button).toBeDisabled();
    }

    await act(async () => {
      vi.advanceTimersByTime(650);
    });

    expect(screen.getByText(/bot (levantó|tiró)/i)).toBeInTheDocument();
    expect(within(rivalZone).getAllByLabelText(/dorso|carta oculta/i)).toHaveLength(2);
    expect(screen.getByText(/turno:\s*tú/i)).toBeInTheDocument();

    const handButtonsAfterBotTurn = within(playerHand).getAllByRole('button');
    expect(handButtonsAfterBotTurn).toHaveLength(2);
    for (const button of handButtonsAfterBotTurn) {
      expect(button).not.toBeDisabled();
    }
  });

  it('soporta modalidades de 3 jugadores y 4 jugadores en parejas 2v2 a 21 puntos con revancha', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const fakeUser = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    // Parte 1: 3 jugadores con turnos encadenados de Bot 1 y Bot 2
    const firstRender = render(<App />);

    await fakeUser.click(screen.getByRole('radio', { name: /3 jugadores/i }));
    await fakeUser.click(screen.getByRole('button', { name: /jugar/i }));

    const rival3p = screen.getByRole('region', { name: /rival/i });
    expect(within(rival3p).getByText(/bot 1/i)).toBeInTheDocument();
    expect(within(rival3p).getByText(/bot 2/i)).toBeInTheDocument();
    expect(within(rival3p).getAllByLabelText(/dorso|carta oculta/i)).toHaveLength(6);
    expect(rival3p).not.toHaveTextContent(/oros|copas|espadas|bastos|turno|\b(4|5|6|7|10|11|12)\b/i);
    expect(within(rival3p).queryByLabelText(/de (oros|copas|espadas|bastos)/i)).not.toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: /mazo/i })).getByText(/\b27\b/)).toBeInTheDocument();

    const hand3p = screen.getByRole('region', { name: /tu mano/i });
    await fakeUser.click(within(hand3p).getByRole('button', { name: '1 de oros' }));
    await fakeUser.click(screen.getByRole('button', { name: /tirar a la mesa/i }));

    expect(screen.getByText(/turno:\s*bot 1/i)).toBeInTheDocument();
    for (const button of within(hand3p).getAllByRole('button')) {
      expect(button).toBeDisabled();
    }

    await act(async () => {
      vi.advanceTimersByTime(650);
    });

    expect(screen.getByText(/bot 1 (levantó|tiró)/i)).toBeInTheDocument();
    expect(within(rival3p).getAllByLabelText(/dorso|carta oculta/i)).toHaveLength(5);
    expect(screen.getByText(/turno:\s*bot 2/i)).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(650);
    });

    expect(screen.getByText(/bot 2 (levantó|tiró)/i)).toBeInTheDocument();
    expect(within(rival3p).getAllByLabelText(/dorso|carta oculta/i)).toHaveLength(4);
    expect(screen.getByText(/turno:\s*tú/i)).toBeInTheDocument();
    for (const button of within(hand3p).getAllByRole('button')) {
      expect(button).not.toBeDisabled();
    }

    firstRender.unmount();
    vi.useRealTimers();

    // Parte 2: 4 jugadores (2v2) a 21 puntos, resumen agrupado por parejas y revancha
    const user = userEvent.setup();
    const secondRender = render(<App />);

    await user.click(screen.getByRole('radio', { name: /4 jugadores \(2v2\)/i }));
    await user.click(screen.getByRole('radio', { name: /21 puntos/i }));
    await user.click(screen.getByRole('button', { name: /jugar/i }));

    const rival4p = screen.getByRole('region', { name: /rival/i });
    expect(within(rival4p).getByText(/bot 1/i)).toBeInTheDocument();
    expect(within(rival4p).getByText(/bot 2/i)).toBeInTheDocument();
    expect(within(rival4p).getByText(/bot 3/i)).toBeInTheDocument();
    expect(within(rival4p).getByText(/equipo a/i)).toBeInTheDocument();
    expect(within(rival4p).getByText(/pareja/i)).toBeInTheDocument();
    expect(within(rival4p).getAllByText(/equipo b/i)).toHaveLength(2);
    expect(within(rival4p).getAllByLabelText(/dorso|carta oculta/i)).toHaveLength(9);
    expect(within(screen.getByRole('region', { name: /tu mano/i })).getByText(/equipo a/i)).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: /mazo/i })).getByText(/\b24\b/)).toBeInTheDocument();

    secondRender.unmount();

    const teamGameOverInitial: GameState = {
      players: [
        {
          id: 'player-1',
          name: 'Tú',
          isBot: false,
          teamId: 0,
          hand: pickCards(['oros-5']),
          captured: pickCards(['oros-7', 'oros-1', 'oros-2']),
          escobas: 0,
          score: 20,
        },
        {
          id: 'bot-1',
          name: 'Bot 1',
          isBot: true,
          teamId: 1,
          hand: [],
          captured: pickCards(['copas-1', 'copas-2']),
          escobas: 0,
          score: 14,
        },
        {
          id: 'bot-2',
          name: 'Bot 2',
          isBot: true,
          teamId: 0,
          hand: [],
          captured: pickCards(['oros-3']),
          escobas: 0,
          score: 20,
        },
        {
          id: 'bot-3',
          name: 'Bot 3',
          isBot: true,
          teamId: 1,
          hand: [],
          captured: pickCards(['espadas-1']),
          escobas: 0,
          score: 14,
        },
      ],
      table: pickCards(['copas-12']),
      deck: [],
      dealerIndex: 3,
      currentPlayerIndex: 0,
      lastCapturerId: 'player-1',
      lastAction: null,
      targetScore: 21,
      round: 4,
      escobaDeMano: 0,
      phase: 'playing',
      roundSummary: null,
      winnerId: null,
      winnerTeamId: null,
      isTiebreaker: false,
    };

    render(<App initialGame={teamGameOverInitial} />);

    await user.click(within(screen.getByRole('region', { name: /tu mano/i })).getByRole('button', { name: '5 de oros' }));
    await user.click(screen.getByRole('button', { name: /levantar \(15\)/i }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/fin de la partida/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/victoria de tú y bot 2/i)).toBeInTheDocument();
    const summaryTable = within(dialog).getByRole('table');
    expect(within(summaryTable).getByText(/tú y bot 2/i)).toBeInTheDocument();
    expect(within(summaryTable).getByText(/bot 1 y bot 3/i)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: /jugar revancha/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const rematchRival = screen.getByRole('region', { name: /rival/i });
    expect(within(rematchRival).getByText(/bot 1/i)).toBeInTheDocument();
    expect(within(rematchRival).getByText(/bot 2/i)).toBeInTheDocument();
    expect(within(rematchRival).getByText(/bot 3/i)).toBeInTheDocument();
    expect(within(rematchRival).getByText(/equipo a/i)).toBeInTheDocument();
    expect(within(rematchRival).getByText(/pareja/i)).toBeInTheDocument();
    expect(within(rematchRival).getAllByText(/equipo b/i)).toHaveLength(2);
    expect(within(rematchRival).getAllByLabelText(/dorso|carta oculta/i)).toHaveLength(9);
    expect(within(screen.getByRole('region', { name: /tu mano/i })).getByText(/equipo a/i)).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: /tu mano/i })).getAllByRole('button')).toHaveLength(3);
    expect(within(screen.getByRole('region', { name: /mazo/i })).getByText(/\b24\b/)).toBeInTheDocument();
  });
});

describe('App — lobby online y salas con código (H5)', () => {
  const originalClipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  const originalSearch = window.location.search;

  afterEach(() => {
    resetFakeSocket();
    window.history.replaceState({}, '', originalSearch || '/');
    if (originalClipboardDescriptor) {
      Object.defineProperty(navigator, 'clipboard', originalClipboardDescriptor);
    } else {
      delete (navigator as { clipboard?: unknown }).clipboard;
    }
    vi.restoreAllMocks();
  });

  it('permite alternar a Online con un amigo, validar nombre, crear sala a 21 puntos y copiar código y enlace', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(<App />);

    const vsAiTab = screen.getByRole('tab', { name: /contra ia/i });
    const onlineTab = screen.getByRole('tab', { name: /online con un amigo/i });
    expect(vsAiTab).toHaveAttribute('aria-selected', 'true');
    expect(onlineTab).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('button', { name: /^jugar$/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /medio/i })).toBeInTheDocument();
    expect(mockIo).not.toHaveBeenCalled();

    await user.click(onlineTab);

    expect(onlineTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('button', { name: /^jugar$/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /crear sala/i }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(mockIo).not.toHaveBeenCalled();
    expect(fakeSocket.emit).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/nombre/i), 'Ana');
    await user.click(screen.getByRole('radio', { name: /21 puntos/i }));
    await user.click(screen.getByRole('button', { name: /crear sala/i }));

    expect(mockIo).toHaveBeenCalledTimes(1);
    const createCall = fakeSocket.emit.mock.calls.find(([event]) => event === 'room:create');
    expect(createCall).toBeDefined();
    expect(createCall?.[1]).toEqual({ playerName: 'Ana', targetScore: 21 });

    const waitingSnapshot: RoomSnapshot = {
      code: 'K7M9P',
      status: 'waiting',
      maxPlayers: 2,
      targetScore: 21,
      players: [{ id: 'p1', name: 'Ana', connected: true }],
      selfPlayerId: 'p1',
      sessionToken: 'token-1',
      gameView: null,
    };

    act(() => {
      triggerServerEvent('room:state', waitingSnapshot);
    });

    expect(screen.getByText('K7M9P')).toBeInTheDocument();
    expect(screen.getByText(/ana/i)).toBeInTheDocument();
    expect(screen.getByText(/esperando a tu amigo\.\.\./i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /copiar código/i }));
    expect(writeText).toHaveBeenLastCalledWith('K7M9P');

    await user.click(screen.getByRole('button', { name: /copiar enlace/i }));
    expect(writeText).toHaveBeenLastCalledWith(expect.stringMatching(/\?sala=K7M9P$/));
  });

  it('abre Online con un amigo desde ?sala=, se une con código normalizado, muestra room:error y renderiza GameTable con PlayerGameView', async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, '', '?sala=k7m9p');

    render(<App />);

    const onlineTab = screen.getByRole('tab', { name: /online con un amigo/i });
    expect(onlineTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText(/código de sala/i)).toHaveValue('K7M9P');

    await user.type(screen.getByLabelText(/tu nombre/i), 'Luis');
    await user.click(screen.getByRole('button', { name: /unirse a sala/i }));

    expect(mockIo).toHaveBeenCalledTimes(1);
    const joinCall = fakeSocket.emit.mock.calls.find(([event]) => event === 'room:join');
    expect(joinCall).toBeDefined();
    expect(joinCall?.[1]).toEqual({ code: 'K7M9P', playerName: 'Luis' });

    act(() => {
      triggerServerEvent('room:error', { message: 'La sala no existe' });
    });

    expect(screen.getByRole('alert')).toHaveTextContent(/la sala no existe/i);

    const gameView: PlayerGameView = {
      players: [
        {
          id: 'p1',
          name: 'Ana',
          isBot: false,
          handCount: 3,
          captured: [],
          escobas: 0,
          score: 0,
          connected: true,
        },
        {
          id: 'p2',
          name: 'Luis',
          isBot: false,
          hand: pickCards(['oros-1', 'oros-2', 'oros-3']),
          handCount: 3,
          captured: [],
          escobas: 0,
          score: 0,
          connected: true,
        },
      ],
      table: pickCards(['copas-4', 'espadas-5', 'bastos-6', 'oros-7']),
      deckCount: 30,
      localPlayerId: 'p2',
      dealerIndex: 1,
      currentPlayerIndex: 0,
      lastCapturerId: null,
      lastAction: null,
      targetScore: 15,
      round: 1,
      escobaDeMano: 0,
      phase: 'playing',
      roundSummary: null,
      winnerId: null,
      winnerTeamId: null,
      isTiebreaker: false,
    };

    const playingSnapshot: RoomSnapshot = {
      code: 'K7M9P',
      status: 'playing',
      maxPlayers: 2,
      targetScore: 15,
      players: [
        { id: 'p1', name: 'Ana', connected: true },
        { id: 'p2', name: 'Luis', connected: true },
      ],
      selfPlayerId: 'p2',
      sessionToken: 'token-2',
      gameView,
    };

    act(() => {
      triggerServerEvent('room:state', playingSnapshot);
    });

    expect(screen.queryByRole('button', { name: /unirse a sala/i })).not.toBeInTheDocument();

    const playerHand = screen.getByRole('region', { name: /tu mano/i });
    expect(within(playerHand).getAllByLabelText(/de (oros|copas|espadas|bastos)/i)).toHaveLength(3);
    expect(within(playerHand).getByLabelText(/1 de oros/i)).toBeInTheDocument();
    expect(within(playerHand).getByLabelText(/2 de oros/i)).toBeInTheDocument();
    expect(within(playerHand).getByLabelText(/3 de oros/i)).toBeInTheDocument();

    const tableZone = screen.getByRole('region', { name: /mesa/i });
    expect(within(tableZone).getAllByLabelText(/de (oros|copas|espadas|bastos)/i)).toHaveLength(4);
    expect(within(tableZone).getByLabelText(/4 de copas/i)).toBeInTheDocument();
    expect(within(tableZone).getByLabelText(/5 de espadas/i)).toBeInTheDocument();
    expect(within(tableZone).getByLabelText(/6 de bastos/i)).toBeInTheDocument();
    expect(within(tableZone).getByLabelText(/7 de oros/i)).toBeInTheDocument();

    const deckZone = screen.getByRole('region', { name: /mazo/i });
    expect(within(deckZone).getByText(/\b30\b/)).toBeInTheDocument();

    const rivalZone = screen.getByRole('region', { name: /rival/i });
    expect(within(rivalZone).getByText(/ana/i)).toBeInTheDocument();
    expect(within(rivalZone).getAllByLabelText(/dorso|carta oculta/i)).toHaveLength(3);
    expect(within(rivalZone).queryAllByLabelText(/de (oros|copas|espadas|bastos)/i)).toHaveLength(0);
  });
});
