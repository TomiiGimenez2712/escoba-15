import { useState } from 'react';
import { createGame, playCard, startNextRound } from '../shared/engine';
import type { GameState, PlayerConfig } from '../shared/types';
import { GameTable } from './components/GameTable';
import { RoundSummaryModal } from './components/RoundSummaryModal';

export interface AppProps {
  initialGame?: GameState | null;
}

const DEFAULT_PLAYERS: PlayerConfig[] = [
  { id: 'player-1', name: 'Tú', isBot: false },
  { id: 'bot-1', name: 'Bot', isBot: true },
];

/** Inicia una partida limpia preservando participantes y puntaje objetivo si existen. */
function createFreshGame(previousGame: GameState | null = null): GameState {
  const players: PlayerConfig[] = previousGame
    ? previousGame.players.map((player) => ({
        id: player.id,
        name: player.name,
        isBot: player.isBot,
      }))
    : DEFAULT_PLAYERS;

  return createGame({
    players,
    targetScore: previousGame?.targetScore ?? 15,
    dealerIndex: 1,
  });
}

export default function App({ initialGame = null }: AppProps = {}) {
  const [game, setGame] = useState<GameState | null>(initialGame);

  const handleStartGame = () => {
    setGame(createFreshGame());
  };

  const handleNextRound = () => {
    setGame((prev) => (prev ? startNextRound(prev) : null));
  };

  const handleRematch = () => {
    setGame((prev) => createFreshGame(prev));
  };

  if (game) {
    const showRoundModal =
      (game.phase === 'round_end' || game.phase === 'game_over') && Boolean(game.roundSummary);

    return (
      <main className="app-shell">
        <GameTable
          game={game}
          localPlayerId={game.players[0].id}
          onPlayAction={(action) =>
            setGame((prev) =>
              prev && prev.phase === 'playing' ? playCard(prev, prev.players[0].id, action) : prev,
            )
          }
        />
        {showRoundModal && (
          <RoundSummaryModal
            game={game}
            onNextRound={handleNextRound}
            onRematch={handleRematch}
          />
        )}
      </main>
    );
  }

  return (
    <main className="app-shell start-screen">
      <div className="start-card">
        <h1 className="start-title">Escoba del 15</h1>
        <button
          type="button"
          className="play-button"
          onClick={handleStartGame}
        >
          Jugar
        </button>
      </div>
    </main>
  );
}
