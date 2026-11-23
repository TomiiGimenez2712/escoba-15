export interface TrucoScoreProps {
  score: number;
  compact?: boolean;
  board?: boolean;
}

interface MatchstickBoxProps {
  sticks: number;
}

const MAX_STICKS_PER_BOX = 5;
const BOXES_PER_GROUP = 3;

function splitScoreIntoBoxes(score: number): number[] {
  const safeScore = Math.max(0, Math.floor(score));
  const boxes: number[] = [];
  let remaining = safeScore;

  while (remaining > 0) {
    const count = Math.min(MAX_STICKS_PER_BOX, remaining);
    boxes.push(count);
    remaining -= count;
  }

  return boxes;
}

function groupBoxesByFifteen(boxes: number[]): number[][] {
  const groups: number[][] = [];
  for (let index = 0; index < boxes.length; index += BOXES_PER_GROUP) {
    groups.push(boxes.slice(index, index + BOXES_PER_GROUP));
  }
  return groups;
}

/** Dibuja un cuadradito de 1 a 5 fósforos estilo marcador de Truco. */
function MatchstickBox({ sticks }: MatchstickBoxProps) {
  return (
    <svg
      className="truco-score__box"
      viewBox="0 0 32 32"
      aria-hidden="true"
      data-sticks={sticks}
    >
      {sticks >= 1 && (
        <g className="truco-score__stick">
          <line x1="6.5" y1="25.5" x2="6.5" y2="8.5" />
          <circle className="truco-score__head" cx="6.5" cy="6.5" r="2.2" />
        </g>
      )}
      {sticks >= 2 && (
        <g className="truco-score__stick">
          <line x1="8.5" y1="6.5" x2="23.5" y2="6.5" />
          <circle className="truco-score__head" cx="25.5" cy="6.5" r="2.2" />
        </g>
      )}
      {sticks >= 3 && (
        <g className="truco-score__stick">
          <line x1="25.5" y1="8.5" x2="25.5" y2="23.5" />
          <circle className="truco-score__head" cx="25.5" cy="25.5" r="2.2" />
        </g>
      )}
      {sticks >= 4 && (
        <g className="truco-score__stick">
          <line x1="23.5" y1="25.5" x2="8.5" y2="25.5" />
          <circle className="truco-score__head" cx="6.5" cy="25.5" r="2.2" />
        </g>
      )}
      {sticks >= 5 && (
        <g className="truco-score__stick truco-score__stick--diagonal">
          <line x1="6" y1="26" x2="24.5" y2="7.5" />
          <circle className="truco-score__head" cx="26" cy="6" r="2.2" />
        </g>
      )}
    </svg>
  );
}

/**
 * Representa un puntaje usando grupos de 5 palitos (fósforos) al estilo del Truco.
 */
export function TrucoScore({ score, compact = false, board = false }: TrucoScoreProps) {
  const safeScore = Math.max(0, Math.floor(score));
  const boxes = splitScoreIntoBoxes(safeScore);
  const groups = groupBoxesByFifteen(boxes);
  const label = `${safeScore} ${safeScore === 1 ? 'punto' : 'puntos'} en palitos`;
  const className = [
    'truco-score',
    compact ? 'truco-score--compact' : '',
    board ? 'truco-score--board' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={className}
      role="img"
      aria-label={label}
      data-truco-score={safeScore}
    >
      {groups.length === 0 ? (
        <span className="truco-score__zero" aria-hidden="true" />
      ) : (
        groups.map((group, groupIndex) => (
          <div key={groupIndex} className="truco-score__section">
            {groupIndex > 0 && (
              <span className="truco-score__divider" aria-hidden="true" />
            )}
            <div className="truco-score__group">
              {group.map((sticks, boxIndex) => (
                <MatchstickBox key={boxIndex} sticks={sticks} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default TrucoScore;
