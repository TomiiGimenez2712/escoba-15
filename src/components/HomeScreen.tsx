import { useId } from 'react';
import { motion } from 'motion/react';
import type { BotDifficulty, TargetScore } from '../../shared/types';
import type { PlayerCount } from '../hooks/useLocalGame';
import { playDealSound, unlockAudio } from '../utils/sound';
import { RadioSelectorGroup, type RadioOption } from './RadioSelectorGroup';

export interface HomeScreenProps {
  difficulty: BotDifficulty;
  playerCount: PlayerCount;
  targetScore: TargetScore;
  onDifficultyChange: (difficulty: BotDifficulty) => void;
  onPlayerCountChange: (playerCount: PlayerCount) => void;
  onTargetScoreChange: (targetScore: TargetScore) => void;
  onStart: () => void;
  onOpenScorer?: () => void;
}

const DIFFICULTY_OPTIONS: RadioOption<BotDifficulty>[] = [
  { value: 'facil', label: 'Fácil' },
  { value: 'medio', label: 'Medio' },
  { value: 'dificil', label: 'Difícil' },
];

const PLAYER_COUNT_OPTIONS: RadioOption<PlayerCount>[] = [
  { value: 2, label: '2 jugadores (1v1)' },
  { value: 3, label: '3 jugadores' },
  { value: 4, label: '4 jugadores (2v2)' },
];

const TARGET_SCORE_OPTIONS: RadioOption<TargetScore>[] = [
  { value: 15, label: '15 puntos' },
  { value: 21, label: '21 puntos' },
];

/** Pantalla inicial de configuración de partida. */
export function HomeScreen({
  difficulty,
  playerCount,
  targetScore,
  onDifficultyChange,
  onPlayerCountChange,
  onTargetScoreChange,
  onStart,
  onOpenScorer,
}: HomeScreenProps) {
  const baseId = useId();

  return (
    <main className="app-shell start-screen">
      <motion.div
        className="start-card"
        initial={{ opacity: 0, y: 18, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      >
        <h1 className="start-title">Escoba del 15</h1>

        <div className="mode-panel">
          <div className="home-config">
            <RadioSelectorGroup
              legend="Dificultad"
              name={`${baseId}-difficulty`}
              options={DIFFICULTY_OPTIONS}
              selectedValue={difficulty}
              onChange={onDifficultyChange}
            />

            <RadioSelectorGroup
              legend="Cantidad de jugadores"
              name={`${baseId}-player-count`}
              options={PLAYER_COUNT_OPTIONS}
              selectedValue={playerCount}
              onChange={onPlayerCountChange}
            />

            <RadioSelectorGroup
              legend="Puntaje objetivo"
              name={`${baseId}-target-score`}
              options={TARGET_SCORE_OPTIONS}
              selectedValue={targetScore}
              onChange={onTargetScoreChange}
            />
          </div>

          <button
            type="button"
            className="play-button"
            onClick={() => {
              unlockAudio();
              playDealSound();
              onStart();
            }}
          >
            Jugar
          </button>

          {onOpenScorer && (
            <button
              type="button"
              className="secondary-button"
              onClick={onOpenScorer}
            >
              Anotador
            </button>
          )}
        </div>
      </motion.div>
    </main>
  );
}
