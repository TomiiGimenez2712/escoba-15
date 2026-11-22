import { useId } from 'react';
import type { BotDifficulty, TargetScore } from '../../shared/types';
import type { PlayerCount } from '../hooks/useLocalGame';

export interface HomeScreenProps {
  difficulty: BotDifficulty;
  playerCount: PlayerCount;
  targetScore: TargetScore;
  onDifficultyChange: (difficulty: BotDifficulty) => void;
  onPlayerCountChange: (playerCount: PlayerCount) => void;
  onTargetScoreChange: (targetScore: TargetScore) => void;
  onStart: () => void;
}

interface RadioOption<T extends string | number> {
  value: T;
  label: string;
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

interface RadioSelectorGroupProps<T extends string | number> {
  legend: string;
  name: string;
  options: readonly RadioOption<T>[];
  selectedValue: T;
  onChange: (value: T) => void;
}

/** Grupo accesible de opciones tipo radio con diseño táctil. */
function RadioSelectorGroup<T extends string | number>({
  legend,
  name,
  options,
  selectedValue,
  onChange,
}: RadioSelectorGroupProps<T>) {
  return (
    <fieldset className="selector-group">
      <legend className="selector-legend">{legend}</legend>
      <div className="selector-options">
        {options.map((option) => {
          const isSelected = selectedValue === option.value;
          return (
            <label
              key={String(option.value)}
              className={`selector-pill ${isSelected ? 'selector-pill--selected' : ''}`.trim()}
            >
              <input
                type="radio"
                className="selector-pill__input"
                name={name}
                value={String(option.value)}
                checked={isSelected}
                onChange={() => onChange(option.value)}
              />
              <span className="selector-pill__label">{option.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Pantalla inicial para configurar dificultad, cantidad de jugadores y puntaje objetivo. */
export function HomeScreen({
  difficulty,
  playerCount,
  targetScore,
  onDifficultyChange,
  onPlayerCountChange,
  onTargetScoreChange,
  onStart,
}: HomeScreenProps) {
  const baseId = useId();

  return (
    <main className="app-shell start-screen">
      <div className="start-card">
        <h1 className="start-title">Escoba del 15</h1>

        <div className="home-config">
          <RadioSelectorGroup
            legend="Dificultad del bot"
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
          onClick={onStart}
        >
          Jugar
        </button>
      </div>
    </main>
  );
}
