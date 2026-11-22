import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDeck } from '../shared/deck';
import { createGame, playCard } from '../shared/engine';
import type { Card, GameState } from '../shared/types';
import App from './App';
import { GameTable } from './components/GameTable';
import { OPPONENT_PERSON_NAMES } from './hooks/useLocalGame';
import * as soundUtils from './utils/sound';

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

    // 0 selecciones en mesa -> no aparece "Levantar", solo "Tirar a la mesa" y ninguna sugerencia resaltada
    const card3 = within(playerHand).getByRole('button', { name: '3 de oros' });
    await user.click(card3);
    expect(card3).toHaveAttribute('data-selected', 'true');
    expect(screen.queryByRole('button', { name: /levantar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /combinaciones posibles/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /tirar a la mesa/i }));
    expect(onPlayAction).toHaveBeenCalledWith({ type: 'discard', cardId: 'oros-3' });

    // Caso sin sugerencias: teniendo 5 de oros con [12 copas] y [4 oros, 6 copas] en la mesa, no resalta ni sugiere combos
    await user.click(within(playerHand).getByRole('button', { name: '5 de oros' }));
    expect(screen.queryByRole('group', { name: /combinaciones posibles/i })).not.toBeInTheDocument();
    for (const tableCard of within(tableZone).getAllByRole('button')) {
      expect(tableCard).not.toHaveAttribute('data-highlighted', 'true');
    }
    expect(screen.queryByRole('button', { name: /levantar/i })).not.toBeInTheDocument();

    // Selección manual de 12 de copas (5 + 10 = 15) -> habilita "Levantar (15)" y ejecuta captura directa
    const twelveCopasBtn = within(tableZone).getByRole('button', { name: '12 de copas' });
    await user.click(twelveCopasBtn);
    expect(twelveCopasBtn).toHaveAttribute('data-selected', 'true');
    expect(screen.getByText(/suma elegida:\s*15\s*\/\s*15/i)).toBeInTheDocument();
    const captureBtn = screen.getByRole('button', { name: /levantar \(15\)/i });
    expect(captureBtn).toBeEnabled();

    await user.click(captureBtn);
    expect(onPlayAction).toHaveBeenCalledWith({
      type: 'capture',
      cardId: 'oros-5',
      tableCardIds: ['copas-12'],
    });

    // Selección manual de suma inválida y luego múltiple (5 + 4 = 9 deshabilita, + 6 = 15 habilita)
    await user.click(within(playerHand).getByRole('button', { name: '5 de oros' }));
    await user.click(within(tableZone).getByRole('button', { name: '4 de oros' }));
    expect(screen.getByText(/suma elegida:\s*9\s*\/\s*15/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /levantar \(15\)/i })).toBeDisabled();

    await user.click(within(tableZone).getByRole('button', { name: '6 de copas' }));
    expect(screen.getByText(/suma elegida:\s*15\s*\/\s*15/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /levantar \(15\)/i }));
    expect(onPlayAction).toHaveBeenLastCalledWith({
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
    const rivalName = OPPONENT_PERSON_NAMES[0];
    expect(screen.getByText(new RegExp(`turno:\\s*${rivalName}`, 'i'))).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /rival/i })).not.toHaveTextContent(/\bbot\b/i);
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
    await user.click(within(screen.getByRole('region', { name: /mesa/i })).getByRole('button', { name: '12 de copas' }));
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
    await user.click(within(screen.getByRole('region', { name: /mesa/i })).getByRole('button', { name: '12 de copas' }));
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
    expect(screen.queryByRole('tab', { name: /online/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /crear sala/i })).not.toBeInTheDocument();
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
    const rivalName = OPPONENT_PERSON_NAMES[0];
    expect(within(rivalZone).getByText(rivalName)).toBeInTheDocument();
    expect(rivalZone).not.toHaveTextContent(/\bbot\b/i);

    await user.click(within(playerHand).getByRole('button', { name: '1 de oros' }));
    await user.click(screen.getByRole('button', { name: /tirar a la mesa/i }));

    expect(screen.getByText(new RegExp(`turno:\\s*${rivalName}`, 'i'))).toBeInTheDocument();
    expect(screen.getByText(/tú tiró 1 de oros/i)).toBeInTheDocument();
    expect(within(rivalZone).getAllByLabelText(/dorso|carta oculta/i)).toHaveLength(3);

    const handButtonsWhileBotThinks = within(playerHand).getAllByRole('button');
    expect(handButtonsWhileBotThinks).toHaveLength(2);
    for (const button of handButtonsWhileBotThinks) {
      expect(button).toBeDisabled();
    }

    await act(async () => {
      vi.advanceTimersByTime(450);
    });
    await act(async () => {
      vi.advanceTimersByTime(850);
    });

    expect(screen.getByText(new RegExp(`${rivalName} (levantó|tiró)`, 'i'))).toBeInTheDocument();
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
    const [opp1, opp2, opp3] = OPPONENT_PERSON_NAMES;

    // Parte 1: 3 jugadores con turnos encadenados con nombres de persona
    const firstRender = render(<App />);

    await fakeUser.click(screen.getByRole('radio', { name: /3 jugadores/i }));
    await fakeUser.click(screen.getByRole('button', { name: /jugar/i }));

    const rival3p = screen.getByRole('region', { name: /rival/i });
    expect(within(rival3p).getByText(opp1)).toBeInTheDocument();
    expect(within(rival3p).getByText(opp2)).toBeInTheDocument();
    expect(rival3p).not.toHaveTextContent(/\bbot\b/i);
    expect(within(rival3p).getAllByLabelText(/dorso|carta oculta/i)).toHaveLength(6);
    expect(rival3p).not.toHaveTextContent(/oros|copas|espadas|bastos|turno|\b(4|5|6|7|10|11|12)\b/i);
    expect(within(rival3p).queryByLabelText(/de (oros|copas|espadas|bastos)/i)).not.toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: /mazo/i })).getByText(/\b27\b/)).toBeInTheDocument();

    const hand3p = screen.getByRole('region', { name: /tu mano/i });
    await fakeUser.click(within(hand3p).getByRole('button', { name: '1 de oros' }));
    await fakeUser.click(screen.getByRole('button', { name: /tirar a la mesa/i }));

    expect(screen.getByText(new RegExp(`turno:\\s*${opp1}`, 'i'))).toBeInTheDocument();
    for (const button of within(hand3p).getAllByRole('button')) {
      expect(button).toBeDisabled();
    }

    await act(async () => {
      vi.advanceTimersByTime(450);
    });
    await act(async () => {
      vi.advanceTimersByTime(850);
    });

    expect(screen.getByText(new RegExp(`${opp1} (levantó|tiró)`, 'i'))).toBeInTheDocument();
    expect(within(rival3p).getAllByLabelText(/dorso|carta oculta/i)).toHaveLength(5);
    expect(screen.getByText(new RegExp(`turno:\\s*${opp2}`, 'i'))).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(450);
    });
    await act(async () => {
      vi.advanceTimersByTime(850);
    });

    expect(screen.getByText(new RegExp(`${opp2} (levantó|tiró)`, 'i'))).toBeInTheDocument();
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
    expect(within(rival4p).getByText(opp1)).toBeInTheDocument();
    expect(within(rival4p).getByText(opp2)).toBeInTheDocument();
    expect(within(rival4p).getByText(opp3)).toBeInTheDocument();
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
    await user.click(within(screen.getByRole('region', { name: /mesa/i })).getByRole('button', { name: '12 de copas' }));
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


describe('App — pulido UI, reglas rápidas, valores y feedback (H7)', () => {
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
    vi.restoreAllMocks();
  });

  it('abre el modal de reglas rápidas desde "Reglas" con reglas oficiales y lo cierra con "Cerrar" o Escape', async () => {
    const user = userEvent.setup();

    render(<App />);
    await user.click(screen.getByRole('button', { name: /jugar/i }));

    const rulesButton = screen.getByRole('button', { name: /reglas/i });
    await user.click(rulesButton);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveTextContent(/1\s*(al?|–|-)\s*7/i);
    expect(dialog).toHaveTextContent(/sota\s*\(10\).*\b8\b/i);
    expect(dialog).toHaveTextContent(/caballo\s*\(11\).*\b9\b/i);
    expect(dialog).toHaveTextContent(/rey\s*\(12\).*\b10\b/i);
    expect(dialog).toHaveTextContent(/escoba.*\+1/i);
    expect(dialog).toHaveTextContent(/escoba de mano/i);
    expect(dialog).toHaveTextContent(/\b15\b/);
    expect(dialog).toHaveTextContent(/\b30\b/);
    expect(dialog).toHaveTextContent(/escobas/i);
    expect(dialog).toHaveTextContent(/7 de oros/i);
    expect(dialog).toHaveTextContent(/sietes/i);
    expect(within(dialog).getAllByText(/\boros\b/i).length).toBeGreaterThanOrEqual(2);
    expect(dialog).toHaveTextContent(/cartas/i);
    expect(dialog).toHaveTextContent(/empate.*\b0\b/i);
    expect(dialog).toHaveTextContent(/15.*21/);

    await user.click(within(dialog).getByRole('button', { name: /cerrar/i }));
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(rulesButton);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('muestra ayuda visual de figuras con toggle "Valores", controla audio con "Sonido" y vuelve al menú con un único botón "Salir"', async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const discardSpy = vi.spyOn(soundUtils, 'playDiscardSound');
    const captureSpy = vi.spyOn(soundUtils, 'playCaptureSound');

    const initialGame: GameState = {
      players: [
        {
          id: 'player-1',
          name: 'Tú',
          isBot: false,
          hand: pickCards(['oros-10', 'copas-11', 'oros-3']),
          captured: [],
          escobas: 0,
          score: 0,
        },
        {
          id: 'bot-1',
          name: 'Bot',
          isBot: true,
          hand: pickCards(['bastos-1', 'bastos-2', 'espadas-1']),
          captured: [],
          escobas: 0,
          score: 0,
        },
      ],
      table: pickCards(['bastos-12', 'copas-7', 'espadas-5']),
      deck: pickCards(['oros-1', 'oros-2', 'oros-4', 'oros-5', 'oros-6', 'oros-7']),
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

    render(<App initialGame={initialGame} />);

    const valuesButton = screen.getByRole('button', { name: /valores/i });
    const soundButton = screen.getByRole('button', { name: /sonido/i });
    expect(valuesButton).toHaveAttribute('aria-pressed', 'true');
    expect(soundButton).toHaveAttribute('aria-pressed', 'true');

    const playerHand = screen.getByRole('region', { name: /tu mano/i });
    const tableZone = screen.getByRole('region', { name: /mesa/i });
    const rivalZone = screen.getByRole('region', { name: /rival/i });

    const card10 = within(playerHand).getByRole('button', { name: '10 de oros' });
    const card11 = within(playerHand).getByRole('button', { name: '11 de copas' });
    const card12 = within(tableZone).getByLabelText('12 de bastos');

    expect(within(card10).getByText('= 8')).toBeInTheDocument();
    expect(within(card11).getByText('= 9')).toBeInTheDocument();
    expect(within(card12).getByText('= 10')).toBeInTheDocument();

    expect(within(rivalZone).getAllByLabelText(/dorso|carta oculta/i)).toHaveLength(3);
    expect(rivalZone).not.toHaveTextContent(/=\s*(8|9|10)|oros|copas|espadas|bastos|turno|\b(4|5|6|7|10|11|12)\b/i);

    await user.click(valuesButton);
    expect(valuesButton).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByText('= 8')).not.toBeInTheDocument();
    expect(screen.queryByText('= 9')).not.toBeInTheDocument();
    expect(screen.queryByText('= 10')).not.toBeInTheDocument();

    await user.click(card10);
    await user.click(within(tableZone).getByRole('button', { name: '7 de copas' }));
    await user.click(screen.getByRole('button', { name: /levantar \(15\)/i }));
    expect(captureSpy).toHaveBeenCalledWith({ muted: false });

    await user.click(soundButton);
    expect(soundButton).toHaveAttribute('aria-pressed', 'false');

    await act(async () => {
      vi.advanceTimersByTime(450);
    });
    await act(async () => {
      vi.advanceTimersByTime(850);
    });
    expect(discardSpy).toHaveBeenCalledWith({ muted: true });

    const exitButtons = screen.getAllByRole('button', { name: /salir/i });
    expect(exitButtons).toHaveLength(1);
    await user.click(exitButtons[0]);

    expect(screen.getByRole('heading', { name: /escoba del 15/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /jugar/i })).toBeInTheDocument();
  });

  it('muestra barra meta, marcador detallado sin tablas, historial de jugadas en orden y lo resetea al jugar revancha', async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    const initialGame: GameState = {
      players: [
        {
          id: 'player-1',
          name: 'Tú',
          isBot: false,
          hand: pickCards(['oros-5', 'espadas-1']),
          captured: pickCards([
            'oros-7',
            'copas-7',
            'espadas-7',
            'oros-1',
            'oros-2',
            'oros-3',
            'oros-4',
            'oros-6',
          ]),
          escobas: 1,
          score: 13,
        },
        {
          id: 'bot-1',
          name: 'Bot',
          isBot: true,
          hand: pickCards(['bastos-1', 'bastos-2']),
          captured: [],
          escobas: 0,
          score: 2,
        },
      ],
      table: pickCards(['copas-12']),
      deck: [],
      dealerIndex: 1,
      currentPlayerIndex: 0,
      lastCapturerId: null,
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

    render(<App initialGame={initialGame} />);

    expect(screen.getByText(/ronda\s*2/i)).toBeInTheDocument();
    expect(screen.getByText(/meta\s*15/i)).toBeInTheDocument();

    const scoreboard = screen.getByRole('region', { name: /marcador/i });
    expect(within(scoreboard).queryByRole('table')).toBeNull();
    expect(scoreboard).toHaveTextContent(/2 jugadores/i);
    expect(scoreboard).toHaveTextContent(/media/i);

    const initialScoreItems = within(scoreboard).getAllByRole('listitem');
    const tuInitialScore = initialScoreItems.find((item) => /(?:^|[^\p{L}])tú(?=$|[^\p{L}])/iu.test(item.textContent ?? ''));
    const botInitialScore = initialScoreItems.find((item) => /\bbot\b/i.test(item.textContent ?? ''));
    expect(tuInitialScore).toBeDefined();
    expect(botInitialScore).toBeDefined();
    expect(tuInitialScore).toHaveTextContent(/(?:\b13\s*pts?|pts?[:\s]*13\b|\b13\s*puntos?\b|\b13\b)/i);
    expect(tuInitialScore).toHaveTextContent(/(?:\b1\s*escobas?|escobas?[:\s]*1\b)/i);
    expect(tuInitialScore).toHaveTextContent(/(?:\b8\s*cartas?|cartas?[:\s]*8\b)/i);
    expect(botInitialScore).toHaveTextContent(/(?:\b2\s*pts?|pts?[:\s]*2\b|\b2\s*puntos?\b|\b2\b)/i);
    expect(botInitialScore).toHaveTextContent(/(?:\b0\s*escobas?|escobas?[:\s]*0\b)/i);
    expect(botInitialScore).toHaveTextContent(/(?:\b0\s*cartas?|cartas?[:\s]*0\b)/i);

    const historyRegion = screen.getByRole('region', { name: /historial de jugadas/i });
    expect(within(historyRegion).queryByRole('listitem')).toBeNull();
    expect(screen.getAllByText(/turno/i)).toHaveLength(1);

    const playerHand = screen.getByRole('region', { name: /tu mano/i });
    const tableZone = screen.getByRole('region', { name: /mesa/i });
    await user.click(within(playerHand).getByRole('button', { name: '5 de oros' }));
    await user.click(within(tableZone).getByRole('button', { name: '12 de copas' }));
    await user.click(screen.getByRole('button', { name: /levantar \(15\)/i }));

    const updatedTuScore = within(scoreboard)
      .getAllByRole('listitem')
      .find((item) => /(?:^|[^\p{L}])tú(?=$|[^\p{L}])/iu.test(item.textContent ?? ''));
    expect(updatedTuScore).toHaveTextContent(/(?:\b2\s*escobas?|escobas?[:\s]*2\b)/i);
    expect(updatedTuScore).toHaveTextContent(/(?:\b10\s*cartas?|cartas?[:\s]*10\b)/i);

    const historyAfterMove1 = within(historyRegion).getAllByRole('listitem');
    expect(historyAfterMove1).toHaveLength(1);
    expect(historyAfterMove1[0]).toHaveTextContent(/tú/i);
    expect(historyAfterMove1[0]).toHaveTextContent(/capturó/i);
    expect(historyAfterMove1[0]).toHaveTextContent(/5\s+oros/i);
    expect(historyAfterMove1[0]).toHaveTextContent(/12\s+copas/i);
    expect(historyAfterMove1[0]).toHaveTextContent(/escoba/i);
    expect(historyRegion).not.toHaveTextContent(/levantó|5 de oros|¡escoba!|turno/i);
    expect(screen.getAllByText(/5 de oros/i)).toHaveLength(1);
    expect(screen.getAllByText(/turno/i)).toHaveLength(1);

    await act(async () => {
      vi.advanceTimersByTime(450);
    });
    await act(async () => {
      vi.advanceTimersByTime(850);
    });

    const historyAfterMove2 = within(historyRegion).getAllByRole('listitem');
    expect(historyAfterMove2).toHaveLength(2);
    expect(historyAfterMove2[1]).toHaveTextContent(/bot/i);
    expect(historyAfterMove2[1]).toHaveTextContent(/descartó/i);
    expect(historyAfterMove2[1]).toHaveTextContent(/1\s+bastos/i);

    await user.click(within(playerHand).getByRole('button', { name: '1 de espadas' }));
    await user.click(screen.getByRole('button', { name: /tirar a la mesa/i }));

    const historyAfterMove3 = within(historyRegion).getAllByRole('listitem');
    expect(historyAfterMove3).toHaveLength(3);
    expect(historyAfterMove3[2]).toHaveTextContent(/tú/i);
    expect(historyAfterMove3[2]).toHaveTextContent(/descartó/i);
    expect(historyAfterMove3[2]).toHaveTextContent(/1\s+espadas/i);

    await act(async () => {
      vi.advanceTimersByTime(450);
    });
    await act(async () => {
      vi.advanceTimersByTime(850);
    });

    const historyAfterMove4 = within(historyRegion).getAllByRole('listitem');
    expect(historyAfterMove4).toHaveLength(4);
    expect(historyAfterMove4[3]).toHaveTextContent(/bot/i);
    expect(historyAfterMove4[3]).toHaveTextContent(/descartó/i);
    expect(historyAfterMove4[3]).toHaveTextContent(/2\s+bastos/i);

    const gameOverModal = screen.getByRole('dialog');
    await user.click(within(gameOverModal).getByRole('button', { name: /jugar revancha/i }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText(/ronda\s*1/i)).toBeInTheDocument();
    expect(screen.queryByText(/levantó/i)).toBeNull();

    const resetHistoryRegion = screen.getByRole('region', { name: /historial de jugadas/i });
    expect(within(resetHistoryRegion).queryAllByRole('listitem')).toHaveLength(0);
    expect(resetHistoryRegion).not.toHaveTextContent(/capturó|descartó/i);
  });

  it('muestra puntos con palitos estilo Truco (fósforos de a 5), reproduce sonidos de toque y permite activar/silenciar "Música"', async () => {
    const user = userEvent.setup();
    const selectSpy = vi.spyOn(soundUtils, 'playCardSelectSound');
    const musicMutedSpy = vi.spyOn(soundUtils, 'setBackgroundMusicMuted');
    const stopMusicSpy = vi.spyOn(soundUtils, 'stopBackgroundMusic');

    const trucoGame: GameState = {
      players: [
        {
          id: 'player-1',
          name: 'Tú',
          isBot: false,
          hand: pickCards(['oros-5']),
          captured: pickCards(['oros-7', 'copas-7', 'espadas-7']),
          escobas: 1,
          score: 17,
        },
        {
          id: 'bot-1',
          name: 'Bot',
          isBot: true,
          hand: [],
          captured: [],
          escobas: 0,
          score: 4,
        },
      ],
      table: pickCards(['copas-12']),
      deck: [],
      dealerIndex: 1,
      currentPlayerIndex: 0,
      lastCapturerId: null,
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

    const { unmount } = render(<App initialGame={trucoGame} />);

    expect(musicMutedSpy).toHaveBeenCalledWith(false);

    const musicButton = screen.getByRole('button', { name: /música/i });
    expect(musicButton).toHaveAttribute('aria-pressed', 'true');

    const scoreboard = screen.getByRole('region', { name: /marcador/i });
    const tuPalitos = within(scoreboard).getByRole('img', { name: '17 puntos en palitos' });
    const tuStickBoxes = Array.from(tuPalitos.querySelectorAll('[data-sticks]')).map((el) =>
      Number(el.getAttribute('data-sticks')),
    );
    expect(tuStickBoxes).toEqual([5, 5, 5, 2]);
    expect(tuPalitos.querySelectorAll('.truco-score__divider')).toHaveLength(1);

    const botPalitos = within(scoreboard).getByRole('img', { name: '4 puntos en palitos' });
    const botStickBoxes = Array.from(botPalitos.querySelectorAll('[data-sticks]')).map((el) =>
      Number(el.getAttribute('data-sticks')),
    );
    expect(botStickBoxes).toEqual([4]);

    await user.click(musicButton);
    expect(musicButton).toHaveAttribute('aria-pressed', 'false');
    expect(musicMutedSpy).toHaveBeenCalledWith(true);

    await user.click(within(screen.getByRole('region', { name: /tu mano/i })).getByRole('button', { name: '5 de oros' }));
    await user.click(within(screen.getByRole('region', { name: /mesa/i })).getByRole('button', { name: '12 de copas' }));
    expect(selectSpy).toHaveBeenCalledWith({ muted: false });

    await user.click(screen.getByRole('button', { name: /levantar \(15\)/i }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('img', { name: '23 puntos en palitos' })).toBeInTheDocument();

    unmount();
    expect(stopMusicSpy).toHaveBeenCalled();
  });
});
