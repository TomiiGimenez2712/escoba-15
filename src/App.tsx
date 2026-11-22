import type { GameState } from '../shared/types';
import { GameTable } from './components/GameTable';
import { HomeScreen } from './components/HomeScreen';
import { RoundSummaryModal } from './components/RoundSummaryModal';
import { useLocalGame } from './hooks/useLocalGame';
import { useOnlineGame } from './hooks/useOnlineGame';

export interface AppProps {
  initialGame?: GameState | null;
}

export default function App({ initialGame = null }: AppProps = {}) {
  const {
    difficulty,
    setDifficulty,
    playerCount,
    setPlayerCount,
    targetScore,
    setTargetScore,
    game,
    startGame,
    playAction,
    nextRound,
    rematch,
  } = useLocalGame({ initialGame });

  const {
    snapshot: onlineSnapshot,
    error: onlineError,
    loading: onlineLoading,
    connectAndCreate,
    connectAndJoin,
    leaveRoom,
  } = useOnlineGame();

  if (game) {
    const showRoundModal =
      (game.phase === 'round_end' || game.phase === 'game_over') && Boolean(game.roundSummary);

    return (
      <main className="app-shell">
        <GameTable
          game={game}
          localPlayerId={game.players[0].id}
          onPlayAction={playAction}
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

  return (
    <HomeScreen
      difficulty={difficulty}
      playerCount={playerCount}
      targetScore={targetScore}
      onDifficultyChange={setDifficulty}
      onPlayerCountChange={setPlayerCount}
      onTargetScoreChange={setTargetScore}
      onStart={startGame}
      onlineSnapshot={onlineSnapshot}
      onlineError={onlineError}
      onlineLoading={onlineLoading}
      onCreateOnlineRoom={connectAndCreate}
      onJoinOnlineRoom={connectAndJoin}
      onLeaveOnlineRoom={leaveRoom}
    />
  );
}
