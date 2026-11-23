import { useEffect, useId, useRef } from 'react';
import { motion } from 'motion/react';
import {
  getMaxScore,
  useScorerState,
  type ScorerPlayerCount,
  type ScorerTargetScore,
} from '../hooks/useScorerState';
import {
  playCardSelectSound,
  playDealSound,
  playDiscardSound,
  playVictorySound,
  unlockAudio,
} from '../utils/sound';
import { RadioSelectorGroup, type RadioOption } from './RadioSelectorGroup';
import { TrucoScore } from './TrucoScore';

export interface ScorerScreenProps {
  onBack: () => void;
}

const TARGET_OPTIONS: RadioOption<ScorerTargetScore>[] = [
  { value: 15, label: '15 pts' },
  { value: 21, label: '21 pts' },
  { value: 30, label: '30 pts' },
];

const PLAYER_COUNT_OPTIONS: RadioOption<ScorerPlayerCount>[] = [
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
];

const PLACEHOLDERS = ['Nosotros', 'Ellos', 'Jugador 3', 'Jugador 4'] as const;

/**
 * Anotador manual de puntos estilo Truco Blyts con fósforos, nombres editables
 * persistidos en memoria (localStorage) y soporte para revanchas rápidas.
 */
export function ScorerScreen({ onBack }: ScorerScreenProps) {
  const baseId = useId();
  const {
    targetScore,
    playerCount,
    participants,
    winner,
    isTie,
    tieScore,
    setTargetScore,
    setPlayerCount,
    setParticipantName,
    adjustScore,
    rematch,
    resetSeries,
  } = useScorerState();

  const previousWinnerIdRef = useRef<string | null>(winner?.id ?? null);

  useEffect(() => {
    const currentWinnerId = winner?.id ?? null;
    if (currentWinnerId && currentWinnerId !== previousWinnerIdRef.current) {
      playVictorySound();
    }
    previousWinnerIdRef.current = currentWinnerId;
  }, [winner]);

  const handleAddPoint = (index: number) => {
    unlockAudio();
    playCardSelectSound();
    adjustScore(index, 1);
  };

  const handleSubtractPoint = (index: number) => {
    unlockAudio();
    playDiscardSound();
    adjustScore(index, -1);
  };

  const handleRematch = () => {
    unlockAudio();
    playDealSound();
    rematch();
  };

  const winnerDisplayName = winner
    ? winner.name.trim() || `Jugador ${participants.findIndex((p) => p.id === winner.id) + 1}`
    : null;

  const maxScore = getMaxScore(targetScore);
  const hasAnyProgress = participants.some((p) => p.score > 0 || p.wins > 0);

  return (
    <main className="app-shell start-screen scorer-screen">
      <motion.section
        className="start-card scorer-card"
        aria-label="Anotador de puntos"
        initial={{ opacity: 0, y: 18, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      >
        <header className="scorer-header">
          <button type="button" className="scorer-back-button" onClick={onBack}>
            ← Volver
          </button>
          <h1 className="scorer-title">Anotador</h1>
          <span className="scorer-header__spacer" aria-hidden="true" />
        </header>

        <div className="scorer-config">
          <RadioSelectorGroup
            legend="A cuánto"
            name={`${baseId}-target`}
            options={TARGET_OPTIONS}
            selectedValue={targetScore}
            onChange={setTargetScore}
          />
          <RadioSelectorGroup
            legend="Jugadores"
            name={`${baseId}-players`}
            options={PLAYER_COUNT_OPTIONS}
            selectedValue={playerCount}
            onChange={setPlayerCount}
          />
        </div>

        {winnerDisplayName && (
          <p className="winner-banner scorer-winner-banner" role="status">
            ¡Victoria de {winnerDisplayName}!
          </p>
        )}

        {!winnerDisplayName && isTie && tieScore !== null && (
          <p className="winner-banner scorer-winner-banner" role="status">
            Empate en {tieScore} pts — ¡a desempatar!
          </p>
        )}

        <div
          className="scorer-grid"
          data-player-count={playerCount}
          data-target-score={targetScore}
        >
          {participants.map((participant, index) => {
            const fallbackName = PLACEHOLDERS[index] ?? `Jugador ${index + 1}`;
            const displayName = participant.name.trim() || fallbackName;
            const isWinner = winner?.id === participant.id;
            const isMaxed = participant.score >= maxScore;

            return (
              <article
                key={participant.id}
                className={`scorer-column ${isWinner ? 'scorer-column--winner' : ''}`}
                aria-label={`Columna de ${displayName}`}
              >
                <div className="scorer-column__top">
                  <input
                    type="text"
                    className="scorer-name-input"
                    aria-label={`Nombre de participante ${index + 1}`}
                    value={participant.name}
                    placeholder={fallbackName}
                    maxLength={24}
                    onChange={(event) => setParticipantName(index, event.target.value)}
                  />
                  {participant.wins > 0 && (
                    <span
                      className="scorer-wins"
                      aria-label={`${participant.wins} ${participant.wins === 1 ? 'partida ganada' : 'partidas ganadas'}`}
                    >
                      🏆 {participant.wins}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  className="scorer-board"
                  aria-label={`Tocar para sumar 1 punto a ${displayName}`}
                  disabled={isMaxed}
                  onClick={() => handleAddPoint(index)}
                >
                  <TrucoScore score={participant.score} board />
                  <div className="scorer-numeric">
                    <span className="scorer-numeric__value">{participant.score}</span>
                    <span className="scorer-numeric__target">/ {targetScore}</span>
                  </div>
                </button>

                <div className="scorer-controls">
                  <button
                    type="button"
                    className="scorer-step-btn scorer-step-btn--minus"
                    aria-label={`Restar 1 punto a ${displayName}`}
                    disabled={participant.score <= 0}
                    onClick={() => handleSubtractPoint(index)}
                  >
                    -1
                  </button>
                  <button
                    type="button"
                    className="scorer-step-btn scorer-step-btn--plus"
                    aria-label={`Sumar 1 punto a ${displayName}`}
                    disabled={isMaxed}
                    onClick={() => handleAddPoint(index)}
                  >
                    +1
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <div className="scorer-actions">
          <button
            type="button"
            className={winner ? 'play-button' : 'secondary-button'}
            onClick={handleRematch}
          >
            Revancha
          </button>

          {hasAnyProgress && (
            <button
              type="button"
              className="scorer-reset-button"
              onClick={resetSeries}
            >
              Reiniciar serie
            </button>
          )}
        </div>
      </motion.section>
    </main>
  );
}

export default ScorerScreen;
