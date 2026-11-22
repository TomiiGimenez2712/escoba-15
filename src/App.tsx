import { useState } from 'react';
import { createGame, playCard } from '../shared/engine';
import type { GameState } from '../shared/types';
import { GameTable } from './components/GameTable';

export default function App() {
  const [game, setGame] = useState<GameState | null>(null);

  const handleStartGame = () => {
    setGame(
      createGame({
        players: [
          { id: 'player-1', name: 'Tú', isBot: false },
          { id: 'bot-1', name: 'Bot', isBot: true },
        ],
        targetScore: 15,
        dealerIndex: 1,
      })
    );
  };

  if (game) {
    return (
      <main className="app-shell">
        <GameTable
          game={game}
          localPlayerId={game.players[0].id}
          onPlayAction={(action) =>
            setGame((prev) => (prev ? playCard(prev, prev.players[0].id, action) : null))
          }
        />
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
