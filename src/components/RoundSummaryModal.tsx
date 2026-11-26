import { useId } from 'react';
import { motion } from 'motion/react';
import type { GameState, ParticipantRoundScore, PlayerGameView } from '../../shared/types';
import { TrucoScore } from './TrucoScore';

export interface RoundSummaryModalProps {
  game: GameState | PlayerGameView;
  onNextRound: () => void;
  onRematch: () => void;
}

interface ScoreRow {
  key: string;
  label: string;
  className?: string;
  getValue: (participant: ParticipantRoundScore) => number;
  getDetailCount?: (participant: ParticipantRoundScore) => number;
}

const SCORE_ROWS: ScoreRow[] = [
  { key: 'escobas', label: 'Escobas', getValue: (p) => p.escobas },
  { key: 'sieteDeOros', label: '7 de Oros', getValue: (p) => p.sieteDeOros },
  {
    key: 'sietes',
    label: 'Sietes',
    getValue: (p) => p.sietes,
    getDetailCount: (p) => p.sietesCount,
  },
  {
    key: 'oros',
    label: 'Oros',
    getValue: (p) => p.oros,
    getDetailCount: (p) => p.orosCount,
  },
  {
    key: 'cartas',
    label: 'Cartas',
    getValue: (p) => p.cartas,
    getDetailCount: (p) => p.totalCardsCount,
  },
  {
    key: 'roundTotal',
    label: 'Total de ronda',
    className: 'summary-table__row--total',
    getValue: (p) => p.roundTotal,
  },
  {
    key: 'totalScore',
    label: 'Puntaje acumulado',
    className: 'summary-table__row--accumulated',
    getValue: (p) => p.totalScore,
  },
];

/** Resuelve el participante ganador a partir de `winnerId` o `winnerTeamId`. */
function findWinnerParticipant(
  game: GameState | PlayerGameView,
): ParticipantRoundScore | undefined {
  const summary = game.roundSummary;
  if (!summary) {
    return undefined;
  }

  const resolvedWinnerId = game.winnerId ?? summary.winnerId;
  const resolvedWinnerTeamId = game.winnerTeamId ?? summary.winnerTeamId;

  return summary.participants.find(
    (participant) =>
      (resolvedWinnerId !== null && participant.participantId === resolvedWinnerId) ||
      (resolvedWinnerTeamId !== null && participant.teamId === resolvedWinnerTeamId),
  );
}

/** Modal de fin de ronda o fin de partida con el desglose oficial de puntajes y acción de continuidad. */
export function RoundSummaryModal({ game, onNextRound, onRematch }: RoundSummaryModalProps) {
  const titleId = useId();
  const isRoundEnd = game.phase === 'round_end';
  const isGameOver = game.phase === 'game_over';

  if ((!isRoundEnd && !isGameOver) || !game.roundSummary) {
    return null;
  }

  const summary = game.roundSummary;
  const winnerParticipant = isGameOver ? findWinnerParticipant(game) : undefined;
  const showTiebreaker = isRoundEnd && game.isTiebreaker;

  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="round-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={{ opacity: 0, scale: 0.9, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 360, damping: 26 }}
      >
        <h2 id={titleId} className="round-modal__title">
          {isGameOver ? 'Fin de la partida' : `Fin de la ronda ${summary.round}`}
        </h2>

        {showTiebreaker && (
          <p className="tiebreaker-badge">Desempate</p>
        )}

        {isGameOver && (
          <p className="winner-banner">
            {winnerParticipant ? `¡Victoria de ${winnerParticipant.label}!` : '¡Victoria!'}
          </p>
        )}

        <table className="summary-table">
          <thead>
            <tr>
              <th scope="col">Rubro</th>
              {summary.participants.map((participant) => (
                <th key={participant.participantId} scope="col">
                  {participant.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SCORE_ROWS.map((row) => (
              <tr key={row.key} className={row.className}>
                <th scope="row">{row.label}</th>
                {summary.participants.map((participant) => {
                  const value = row.getValue(participant);
                  const detailCount = row.getDetailCount?.(participant);
                  return (
                    <td key={participant.participantId}>
                      {row.key === 'totalScore' ? (
                        <div className="summary-score-cell">
                          <span>{value}</span>
                          <TrucoScore score={value} compact />
                        </div>
                      ) : detailCount !== undefined ? (
                        <>
                          <span>{value}</span>
                          <span className="summary-count">{`(${detailCount})`}</span>
                        </>
                      ) : (
                        value
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="round-modal__actions">
          {isGameOver ? (
            <button
              type="button"
              className="play-button round-modal__button"
              onClick={onRematch}
            >
              Jugar revancha
            </button>
          ) : (
            <button
              type="button"
              className="play-button round-modal__button"
              onClick={onNextRound}
            >
              Siguiente ronda
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default RoundSummaryModal;
