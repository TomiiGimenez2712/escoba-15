import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from '../App';
import { SCORER_STORAGE_KEY } from '../hooks/useScorerState';
import { ScorerScreen } from './ScorerScreen';

describe('ScorerScreen — Anotador estilo Truco Blyts', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('se abre desde HomeScreen y permite volver a la pantalla inicial', async () => {
    const user = userEvent.setup();
    render(<App />);

    const scorerButton = screen.getByRole('button', { name: /anotador/i });
    await user.click(scorerButton);

    expect(screen.getByRole('heading', { name: /anotador/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre de participante 1')).toHaveValue('Nosotros');
    expect(screen.getByLabelText('Nombre de participante 2')).toHaveValue('Ellos');

    await user.click(screen.getByRole('button', { name: /volver/i }));
    expect(screen.getByRole('heading', { name: /escoba del 15/i })).toBeInTheDocument();
  });

  it('guarda los nombres, puntajes y configuración en memoria (localStorage) al salir y volver', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<ScorerScreen onBack={() => {}} />);

    const input1 = screen.getByLabelText('Nombre de participante 1');
    const input2 = screen.getByLabelText('Nombre de participante 2');

    await user.clear(input1);
    await user.type(input1, 'Tomás');
    await user.clear(input2);
    await user.type(input2, 'Mateo');

    await user.click(screen.getByRole('radio', { name: '21 pts' }));
    await user.click(screen.getByRole('button', { name: 'Sumar 1 punto a Tomás' }));
    await user.click(screen.getByRole('button', { name: 'Tocar para sumar 1 punto a Tomás' }));
    await user.click(screen.getByRole('button', { name: 'Sumar 1 punto a Mateo' }));

    expect(window.localStorage.getItem(SCORER_STORAGE_KEY)).toContain('Tomás');

    // Simular cierre/salida de la app y reapertura
    unmount();
    render(<ScorerScreen onBack={() => {}} />);

    expect(screen.getByLabelText('Nombre de participante 1')).toHaveValue('Tomás');
    expect(screen.getByLabelText('Nombre de participante 2')).toHaveValue('Mateo');
    expect(screen.getByRole('radio', { name: '21 pts' })).toBeChecked();

    const col1 = screen.getByRole('article', { name: 'Columna de Tomás' });
    expect(within(col1).getByLabelText('2 puntos en palitos')).toBeInTheDocument();

    const col2 = screen.getByRole('article', { name: 'Columna de Mateo' });
    expect(within(col2).getByLabelText('1 punto en palitos')).toBeInTheDocument();
  });

  it('permite sumar, restar, ganar la partida y jugar revanchas sin volver a escribir los nombres', async () => {
    const user = userEvent.setup();
    render(<ScorerScreen onBack={() => {}} />);

    const input1 = screen.getByLabelText('Nombre de participante 1');
    await user.clear(input1);
    await user.type(input1, 'Los Pibes');

    const input2 = screen.getByLabelText('Nombre de participante 2');
    await user.clear(input2);
    await user.type(input2, 'Rivales');

    const plus1 = screen.getByRole('button', { name: 'Sumar 1 punto a Los Pibes' });
    const minus1 = screen.getByRole('button', { name: 'Restar 1 punto a Los Pibes' });

    await user.click(plus1);
    await user.click(plus1);
    await user.click(minus1);

    const col1 = screen.getByRole('article', { name: 'Columna de Los Pibes' });
    expect(within(col1).getByLabelText('1 punto en palitos')).toBeInTheDocument();

    // Completar hasta 15 puntos
    for (let i = 0; i < 14; i += 1) {
      await user.click(plus1);
    }

    expect(screen.getByRole('status')).toHaveTextContent('¡Victoria de Los Pibes!');
    expect(plus1).toBeEnabled();

    // Permite pasarse de 15 (por ejemplo 16 a 17 en la última ronda) y gana el mayor puntaje
    await user.click(plus1); // Los Pibes: 16
    expect(within(col1).getByLabelText('16 puntos en palitos')).toBeInTheDocument();

    const plus2 = screen.getByRole('button', { name: 'Sumar 1 punto a Rivales' });
    for (let i = 0; i < 17; i += 1) {
      await user.click(plus2);
    }
    expect(screen.getByRole('status')).toHaveTextContent('¡Victoria de Rivales!');

    // Jugar revancha: reinicia puntos a 0, suma victoria al ganador (Rivales) y conserva los nombres
    await user.click(screen.getByRole('button', { name: /revancha/i }));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Nombre de participante 1')).toHaveValue('Los Pibes');
    expect(screen.getByLabelText('Nombre de participante 2')).toHaveValue('Rivales');
    expect(within(col1).getByLabelText('0 puntos en palitos')).toBeInTheDocument();

    const col2 = screen.getByRole('article', { name: 'Columna de Rivales' });
    expect(within(col2).getByLabelText('0 puntos en palitos')).toBeInTheDocument();
    expect(within(col2).getByLabelText('1 partida ganada')).toBeInTheDocument();
  });

  it('limita el excedente a 5 puntos sobre la meta (20, 26 y 35 máximo)', async () => {
    const user = userEvent.setup();
    render(<ScorerScreen onBack={() => {}} />);

    const plus1 = screen.getByRole('button', { name: 'Sumar 1 punto a Nosotros' });
    for (let i = 0; i < 20; i += 1) {
      await user.click(plus1);
    }
    const col1 = screen.getByRole('article', { name: 'Columna de Nosotros' });
    expect(within(col1).getByLabelText('20 puntos en palitos')).toBeInTheDocument();
    expect(plus1).toBeDisabled();

    await user.click(screen.getByRole('radio', { name: '21 pts' }));
    expect(plus1).toBeEnabled();
    for (let i = 0; i < 6; i += 1) {
      await user.click(plus1);
    }
    expect(within(col1).getByLabelText('26 puntos en palitos')).toBeInTheDocument();
    expect(plus1).toBeDisabled();

    await user.click(screen.getByRole('radio', { name: '30 pts' }));
    expect(plus1).toBeEnabled();
    for (let i = 0; i < 9; i += 1) {
      await user.click(plus1);
    }
    expect(within(col1).getByLabelText('35 puntos en palitos')).toBeInTheDocument();
    expect(plus1).toBeDisabled();
  });

  it('soporta cambiar a 3 o 4 jugadores y reiniciar la serie conservando nombres', async () => {
    const user = userEvent.setup();
    render(<ScorerScreen onBack={() => {}} />);

    await user.click(screen.getByRole('radio', { name: '3' }));
    const input3 = screen.getByLabelText('Nombre de participante 3');
    await user.clear(input3);
    await user.type(input3, 'Sofía');

    await user.click(screen.getByRole('button', { name: 'Sumar 1 punto a Sofía' }));
    await user.click(screen.getByRole('button', { name: /reiniciar serie/i }));

    expect(screen.getByLabelText('Nombre de participante 3')).toHaveValue('Sofía');
    const col3 = screen.getByRole('article', { name: 'Columna de Sofía' });
    expect(within(col3).getByLabelText('0 puntos en palitos')).toBeInTheDocument();
  });
});
