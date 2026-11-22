import type { GameState } from '../../shared/types';
import { SpanishCard } from './SpanishCard';

export interface GameTableProps {
  game: GameState;
}

export function GameTable({ game }: GameTableProps) {
  const humanPlayer = game.players[0];
  const opponents = game.players.slice(1);

  return (
    <div className="game-table">
      <section
        className="table-zone table-zone--rival"
        role="region"
        aria-label="Rival"
      >
        <span className="zone-label">Rival</span>
        <div className="card-row card-row--rival">
          {opponents.map((opponent) => (
            <div key={opponent.id} className="opponent-hand">
              {opponent.hand.map((card) => (
                <SpanishCard key={card.id} faceDown compact />
              ))}
            </div>
          ))}
        </div>
      </section>

      <div className="table-middle">
        <section
          className="table-zone table-zone--deck"
          role="region"
          aria-label="Mazo"
        >
          <span className="zone-label">Mazo</span>
          <div className="deck-stack">
            {game.deck.length > 0 ? (
              <SpanishCard faceDown compact />
            ) : (
              <div className="deck-empty" aria-hidden="true" />
            )}
            <span className="deck-count">{game.deck.length}</span>
          </div>
        </section>

        <section
          className="table-zone table-zone--mesa"
          role="region"
          aria-label="Mesa"
        >
          <span className="zone-label">Mesa</span>
          {game.escobaDeMano > 0 && (
            <div className="escoba-mano-banner" role="status">
              ¡Escoba de mano!{game.escobaDeMano === 2 ? ' (Doble)' : ''}
            </div>
          )}
          <div className="card-row card-row--mesa">
            {game.table.map((card) => (
              <SpanishCard key={card.id} card={card} />
            ))}
          </div>
        </section>
      </div>

      <section
        className="table-zone table-zone--player"
        role="region"
        aria-label="Tu mano"
      >
        <span className="zone-label">Tu mano</span>
        <div className="card-row card-row--player">
          {humanPlayer?.hand.map((card) => (
            <SpanishCard key={card.id} card={card} />
          ))}
        </div>
      </section>
    </div>
  );
}

export default GameTable;
