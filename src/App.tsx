import { useState } from 'react';
import type { BotDifficulty, GameState } from '../shared/types';
import { GameTable } from './components/GameTable';
import { HomeScreen } from './components/HomeScreen';
import { RoundSummaryModal } from './components/RoundSummaryModal';
import { ScorerScreen } from './components/ScorerScreen';
import { useLocalGame } from './hooks/useLocalGame';

const DIFFICULTY_LABELS: Record<BotDifficulty, string> = {
  facil: 'Fácil',
  medio: 'Media',
  dificil: 'Difícil',
};

export interface AppProps {
  initialGame?: GameState | null;
}

export default function App({ initialGame = null }: AppProps = {}) {
  const [showScorer, setShowScorer] = useState(false);
  const {
    difficulty,
    setDifficulty,
    playerCount,
    setPlayerCount,
    targetScore,
    setTargetScore,
    game,
    botPreview,
    startGame,
    playAction,
    nextRound,
    rematch,
    exitGame,
  } = useLocalGame({ initialGame });

  if (game) {
    const showRoundModal =
      (game.phase === 'round_end' || game.phase === 'game_over') && Boolean(game.roundSummary);

    return (
      <main className="app-shell">
        <GameTable
          game={game}
          localPlayerId={game.players[0].id}
          modeLabel={DIFFICULTY_LABELS[difficulty]}
          botPreview={botPreview}
          onPlayAction={playAction}
          onExit={exitGame}
        />
        {showRoundModal && (
          <RoundSummaryModal
            game={game}
            onNextRound={nextRound}
            onRematch={rematch}
          />
        )}
      </main>
    );
  }

  if (showScorer) {
    return <ScorerScreen onBack={() => setShowScorer(false)} />;
  }

  return (
    <HomeScreen
      difficulty={difficulty}
      playerCount={playerCount}
      targetScore={targetScore}
      onDifficultyChange={setDifficulty}
      onPlayerCountChange={setPlayerCount}
      onTargetScoreChange={setTargetScore}
      onStart={startGame}
      onOpenScorer={() => setShowScorer(true)}
    />
  );
}
