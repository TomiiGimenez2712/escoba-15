import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';

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
});
